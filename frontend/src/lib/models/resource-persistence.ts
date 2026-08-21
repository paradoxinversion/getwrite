/**
 * @module resource-persistence
 *
 * Resource local persistence and metadata loading helpers.
 *
 * This module is responsible for:
 * - Persisting resource payloads/metadata to local filesystem storage.
 * - Loading resource metadata from local sidecar/meta files.
 */
import path from "node:path";

import { exists, mkdir, readFile, readdir, writeFile } from "./io";
import { validateResource } from "./resource-factory";
import { countWords } from "../word-count";
import { writeSidecar } from "./sidecar";
import type {
  AnyResource,
  AudioResource,
  Folder,
  ImageResource,
  MetadataValue,
  TextResource,
} from "./types";

/**
 * Type guard for folder resources.
 */
function isFolderResource(resource: AnyResource): resource is Folder {
  return resource.type === "folder";
}

/**
 * Reads the `id` from a `folder.json` at `dir`, or `null` if the descriptor is
 * absent or unreadable. Used to detect slug collisions before overwriting.
 */
async function readFolderDescriptorId(dir: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(dir, "folder.json"), "utf8");
    const parsed = JSON.parse(raw) as { id?: unknown };
    return typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the on-disk directory for a folder, guarding against slug
 * collisions. Folders are stored at `folders/<slug>/`, but two distinct folders
 * can slugify to the same value (e.g. an "Episode 1" recreated after a previous
 * "Episode 1" was renamed in place). Writing both to the same directory would
 * silently overwrite the first descriptor and orphan its children.
 *
 * Resolution is deterministic so re-saving the same folder always lands on its
 * own directory:
 * - If `folders/<slug>/` is free or already holds *this* folder, use it.
 * - Otherwise fall back to `folders/<slug>-<id-prefix>/`, and finally to
 *   `folders/<slug>-<full-id>/` in the astronomically unlikely event the
 *   prefixed directory is itself taken by a different folder.
 */
async function resolveFolderDir(
  projectPath: string,
  folder: Folder,
): Promise<string> {
  const foldersRoot = path.join(projectPath, "folders");
  const slug = folder.slug ?? folder.id;

  const preferred = path.join(foldersRoot, slug);
  const preferredOwner = await readFolderDescriptorId(preferred);
  if (preferredOwner === null || preferredOwner === folder.id) {
    return preferred;
  }

  const prefixed = path.join(foldersRoot, `${slug}-${folder.id.slice(0, 8)}`);
  const prefixedOwner = await readFolderDescriptorId(prefixed);
  if (prefixedOwner === null || prefixedOwner === folder.id) {
    return prefixed;
  }

  return path.join(foldersRoot, `${slug}-${folder.id}`);
}

/**
 * Type guard for text resources.
 */
function isTextResource(resource: AnyResource): resource is TextResource {
  return resource.type === "text";
}

/**
 * Type guard for media (image/audio) resources backed by a binary file.
 */
function isMediaResource(
  resource: AnyResource,
): resource is ImageResource | AudioResource {
  return resource.type === "image" || resource.type === "audio";
}

/** Optional inputs for persisting a resource. */
export interface WriteResourceOptions {
  /** Raw bytes for image/audio resources, written to `<resource>/<file>`. */
  binary?: Uint8Array;
}

/**
 * Persists a resource to local filesystem storage.
 *
 * For image/audio resources, pass `options.binary` to write the uploaded bytes
 * to `resources/<id>/<resource.file>`. The binary is only written when both the
 * bytes and `resource.file` are present, so metadata-only re-saves leave the
 * stored file untouched.
 */
export async function writeResourceToFile(
  projectPath: string,
  resource: AnyResource,
  options?: WriteResourceOptions,
): Promise<AnyResource> {
  if (isFolderResource(resource)) {
    const dir = await resolveFolderDir(projectPath, resource);
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(
      path.join(dir, "folder.json"),
      JSON.stringify(resource, null, 2),
      "utf8",
    );
    return resource;
  }

  const base = path.join(projectPath, "resources", resource.id);

  if (isTextResource(resource)) {
    if (!(await exists(base))) {
      await mkdir(base, { recursive: true });
    }

    const tiptapPath = `${base}/content.tiptap.json`;
    const plainPath = `${base}/content.txt`;
    await writeFile(
      tiptapPath,
      JSON.stringify(resource.tiptap ?? {}, null, 2),
      "utf8",
    );
    await writeFile(plainPath, resource.plainText ?? "", "utf8");
  }

  if (isMediaResource(resource)) {
    if (!(await exists(base))) {
      await mkdir(base, { recursive: true });
    }

    if (options?.binary !== undefined) {
      if (!resource.file) {
        throw new Error(
          `Cannot persist binary for media resource ${resource.id}: missing 'file' name`,
        );
      }
      await writeFile(
        path.join(base, resource.file),
        Buffer.from(options.binary),
      );
    }
  }

  const sidecarData: Record<string, MetadataValue> = {
    id: resource.id,
    name: resource.name,
    type: resource.type,
    createdAt: resource.createdAt,
    orderIndex: resource.orderIndex,
    folderId: resource.folderId || null,
    slug: resource.slug || null,
    userMetadata: resource.userMetadata || {},
  };

  if (isTextResource(resource)) {
    // A caller that saves content without also supplying a count would
    // otherwise write a sidecar with no `wordCount` at all, leaving the
    // resource indistinguishable from an empty stub until something re-derived
    // it. The plain text written above is the authoritative source, so count
    // that rather than requiring every call site to remember.
    sidecarData.wordCount =
      resource.wordCount ?? countWords(resource.plainText ?? "");
  }

  if (isMediaResource(resource)) {
    if (resource.file !== undefined) sidecarData.file = resource.file;
    if (resource.type === "image") {
      if (resource.width !== undefined) sidecarData.width = resource.width;
      if (resource.height !== undefined) sidecarData.height = resource.height;
      if (resource.exif !== undefined) sidecarData.exif = resource.exif;
    } else {
      if (resource.durationSeconds !== undefined) {
        sidecarData.durationSeconds = resource.durationSeconds;
      }
      if (resource.format !== undefined) sidecarData.format = resource.format;
    }
  }

  await writeSidecar(projectPath, resource.id, sidecarData);
  return resource;
}

/**
 * Loads locally stored resources from `<projectPath>/meta/*.json`.
 */
export const getLocalResources = async (
  projectPath: string,
): Promise<AnyResource[]> => {
  const metaDir = path.join(projectPath, "meta");
  if (!(await exists(metaDir))) {
    return [];
  }

  const metaFiles = (await readdir(metaDir)).sort();
  const resources: AnyResource[] = [];
  for (const metaFile of metaFiles) {
    // Only resource sidecars match this pattern; skip ancillary meta files
    // like backlinks.json, redirects.json, or the index/ subdirectory.
    if (!metaFile.startsWith("resource-") || !metaFile.endsWith(".meta.json")) {
      continue;
    }
    const metaPath = path.join(metaDir, metaFile);
    const metaData = JSON.parse(await readFile(metaPath, "utf-8"));
    resources.push(validateResource(metaData));
  }

  return Promise.all(
    resources.map(async (r) => {
      if (r.type !== "text" || (r as TextResource).wordCount !== undefined) {
        return r;
      }
      const contentPath = path.join(
        projectPath,
        "resources",
        r.id,
        "content.txt",
      );
      if (!(await exists(contentPath))) return r;
      const plain = await readFile(contentPath, "utf-8");
      return { ...r, wordCount: countWords(plain) } as TextResource;
    }),
  );
};

/**
 * Reads short text excerpts for the given resources straight from their
 * `content.txt`. Intended for a bounded, on-demand set (e.g. the cards visible
 * in one Organizer folder) — not the whole project — so it stays off the hot
 * load path.
 *
 * Each excerpt is capped to `maxChars + 1` characters: the extra character lets
 * the caller's truncation add a trailing ellipsis when the source was longer.
 * Resources with no `content.txt` (folders, media) or empty content are omitted.
 *
 * @param projectPath - Absolute project root directory.
 * @param resourceIds - Resource ids to read excerpts for.
 * @param maxChars - Maximum excerpt length to read (defaults to 200).
 * @returns A map of resource id → excerpt for the resources that had content.
 */
export const readResourceExcerpts = async (
  projectPath: string,
  resourceIds: readonly string[],
  maxChars = 200,
): Promise<Record<string, string>> => {
  const cap = maxChars > 0 ? maxChars : 200;
  const excerpts: Record<string, string> = {};
  for (const id of resourceIds) {
    const contentPath = path.join(projectPath, "resources", id, "content.txt");
    let content: string;
    try {
      // Reads the whole content.txt via the storage adapter rather than a
      // bounded fd prefix. Excerpt targets are small text resources capped by
      // `cap`, so loading the file in full is acceptable and keeps the read on
      // the tenant adapter (no direct fd ops the adapter can't model).
      content = await readFile(contentPath, "utf-8");
    } catch {
      continue; // no content.txt (folder/media) or unreadable
    }
    // Trim before capping so the `cap + 1` "was-truncated" signal reflects real
    // content (the caller adds an ellipsis when the excerpt exceeds the cap);
    // leading whitespace must not eat into that one-char headroom.
    const text = content.trim();
    if (text === "") continue;
    excerpts[id] = text.slice(0, cap + 1);
  }
  return excerpts;
};
