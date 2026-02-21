import fs from "node:fs/promises";
import path from "node:path";
import { generateUUID } from "./uuid";
import {
    createTextResource,
    createImageResource,
    createAudioResource,
} from "./resource";
import { writeSidecar, readSidecar } from "./sidecar";
import { withMetaLock } from "./meta-locks";
import type {
    UUID,
    TextResource,
    ImageResource,
    AudioResource,
    ResourceType,
    MetadataValue,
} from "./types";

const TEMPLATES_DIR = (projectRoot: string) =>
    path.join(projectRoot, "meta", "templates");
const RESOURCES_DIR = (projectRoot: string) =>
    path.join(projectRoot, "resources");

export interface ResourceTemplate {
    id: string;
    name: string;
    type: ResourceType;
    folderId?: UUID | null;
    metadata?: Record<string, MetadataValue>;
    plainText?: string; // for text templates
}

async function ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
}

/** Persist a resource template under project meta/templates. */
export async function saveResourceTemplate(
    projectRoot: string,
    template: ResourceTemplate,
): Promise<void> {
    const dir = TEMPLATES_DIR(projectRoot);
    await ensureDir(dir);
    const file = path.join(dir, `${template.id}.json`);
    await withMetaLock(projectRoot, async () => {
        await fs.writeFile(file, JSON.stringify(template, null, 2), "utf8");
    });
}

/** Load a resource template by id. */
export async function loadResourceTemplate(
    projectRoot: string,
    templateId: string,
): Promise<ResourceTemplate> {
    const file = path.join(TEMPLATES_DIR(projectRoot), `${templateId}.json`);
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as ResourceTemplate;
}

/** Create a resource on disk from a saved template. Returns the created resource. */
export async function createResourceFromTemplate(
    projectRoot: string,
    templateId: string,
    opts?: { name?: string },
): Promise<TextResource | ImageResource | AudioResource> {
    const tmpl = await loadResourceTemplate(projectRoot, templateId);
    const name = opts?.name ?? tmpl.name;

    await ensureDir(RESOURCES_DIR(projectRoot));

    if (tmpl.type === "text") {
        const res = createTextResource({
            name,
            folderId: tmpl.folderId ?? null,
            plainText: tmpl.plainText ?? "",
            metadata: tmpl.metadata,
        });
        const filename = `${res.slug ?? name.replace(/\s+/g, "-")}-${res.id}.txt`;
        const filePath = path.join(RESOURCES_DIR(projectRoot), filename);
        await fs.writeFile(filePath, res.plainText ?? "", "utf8");
        await writeSidecar(projectRoot, res.id, {
            id: res.id,
            name: res.name,
            type: res.type,
            createdAt: res.createdAt,
        });
        return res;
    }

    if (tmpl.type === "image") {
        const res = createImageResource({
            name,
            folderId: tmpl.folderId ?? null,
            metadata: tmpl.metadata,
        });
        const filename = `${res.slug ?? name.replace(/\s+/g, "-")}-${res.id}.img`;
        const filePath = path.join(RESOURCES_DIR(projectRoot), filename);
        // create empty placeholder file
        await fs.writeFile(filePath, "", "utf8");
        await writeSidecar(projectRoot, res.id, {
            id: res.id,
            name: res.name,
            type: res.type,
            createdAt: res.createdAt,
        });
        return res;
    }

    // audio
    const res = createAudioResource({
        name,
        folderId: tmpl.folderId ?? null,
        metadata: tmpl.metadata,
    });
    const filename = `${res.slug ?? name.replace(/\s+/g, "-")}-${res.id}.aud`;
    const filePath = path.join(RESOURCES_DIR(projectRoot), filename);
    await fs.writeFile(filePath, "", "utf8");
    await writeSidecar(projectRoot, res.id, {
        id: res.id,
        name: res.name,
        type: res.type,
        createdAt: res.createdAt,
    });
    return res;
}

/** Duplicate an existing resource within the project, cloning metadata and initial file. */
export async function duplicateResource(
    projectRoot: string,
    resourceId: UUID,
): Promise<{ newId: UUID }> {
    // read sidecar to get metadata
    const meta = await readSidecar(projectRoot, resourceId);
    if (!meta) {
        throw new Error(`resource metadata for ${resourceId} not found`);
    }

    // find resource file in resources dir
    const resourcesDir = RESOURCES_DIR(projectRoot);
    let foundName: string | null = null;
    try {
        const entries = await fs.readdir(resourcesDir);
        for (const e of entries) {
            if (e.includes(resourceId)) {
                foundName = e;
                break;
            }
        }
    } catch (err) {
        // no resources dir
    }

    const newId = generateUUID();

    // clone sidecar metadata, replacing id
    const newMeta = { ...meta, id: newId } as Record<string, unknown>;
    await writeSidecar(
        projectRoot,
        newId,
        newMeta as Record<string, MetadataValue>,
    );

    if (foundName) {
        const src = path.join(resourcesDir, foundName);
        const ext = path.extname(foundName);
        const base = foundName.replace(resourceId, newId);
        const dest = path.join(resourcesDir, base);
        await fs.copyFile(src, dest);
    }

    return { newId };
}

export default {
    saveResourceTemplate,
    loadResourceTemplate,
    createResourceFromTemplate,
    duplicateResource,
};

/**
 * Create and persist a resource template based on an existing resource in the project.
 * Captures sidecar metadata and (for text resources) the file contents as `plainText`.
 */
export async function saveResourceTemplateFromResource(
    projectRoot: string,
    resourceId: UUID,
    templateId: string,
    opts?: { name?: string },
): Promise<void> {
    const meta = await readSidecar(projectRoot, resourceId);
    if (!meta) {
        throw new Error(
            `sidecar metadata for resource ${resourceId} not found`,
        );
    }

    // determine type (prefer sidecar.type)
    const type = (meta.type as ResourceType) ?? "text";

    // locate the resource file if present
    let plainText: string | undefined = undefined;
    try {
        const entries = await fs.readdir(RESOURCES_DIR(projectRoot));
        for (const e of entries) {
            if (e.includes(resourceId)) {
                const p = path.join(RESOURCES_DIR(projectRoot), e);
                if (type === "text") {
                    try {
                        plainText = await fs.readFile(p, "utf8");
                    } catch (_) {
                        plainText = undefined;
                    }
                }
                break;
            }
        }
    } catch (_) {
        // ignore missing resources dir
    }

    // Compose template; copy metadata but avoid embedding volatile fields like id/createdAt
    const {
        id: _id,
        createdAt: _created,
        ...restMeta
    } = meta as Record<string, unknown>;

    const tpl: ResourceTemplate = {
        id: templateId,
        name: opts?.name ?? (meta.name as string) ?? templateId,
        type,
        folderId: (meta.folderId as UUID) ?? null,
        metadata: Object.keys(restMeta).length
            ? (restMeta as Record<string, MetadataValue>)
            : undefined,
        plainText: plainText,
    };

    await saveResourceTemplate(projectRoot, tpl);
}

/**
 * Replace literal occurrences of the template's name in string fields with
 * a placeholder (e.g. "{{TITLE}}") and persist the updated template.
 * Returns the list of variable names introduced (extracted from the placeholder).
 */
export async function parametrizeResourceTemplate(
    projectRoot: string,
    templateId: string,
    placeholder: string,
): Promise<string[]> {
    const tpl = await loadResourceTemplate(projectRoot, templateId);
    if (!tpl) throw new Error(`template ${templateId} not found`);

    const m = String(placeholder).match(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/);
    if (!m) throw new Error("Invalid placeholder format. Use {{NAME}}");
    const varName = m[1];

    // Replace occurrences of the template name in strings recursively
    function replaceStrings(v: unknown): unknown {
        if (typeof v === "string") {
            return v.split(tpl.name).join(placeholder);
        }
        if (Array.isArray(v)) return v.map(replaceStrings);
        if (v && typeof v === "object") {
            const out: Record<string, unknown> = {};
            for (const k of Object.keys(v as Record<string, unknown>)) {
                out[k] = replaceStrings((v as Record<string, unknown>)[k]);
            }
            return out;
        }
        return v;
    }

    const newTpl: ResourceTemplate = {
        ...tpl,
        name: replaceStrings(tpl.name) as string,
        plainText: tpl.plainText
            ? (replaceStrings(tpl.plainText) as string)
            : tpl.plainText,
        metadata: tpl.metadata
            ? (replaceStrings(tpl.metadata) as Record<string, MetadataValue>)
            : tpl.metadata,
    };

    await saveResourceTemplate(projectRoot, newTpl);
    return [varName];
}
