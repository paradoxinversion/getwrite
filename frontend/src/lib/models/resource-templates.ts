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

/**
 * List saved templates with optional query filter against id/name/type.
 */
export async function listResourceTemplates(
    projectRoot: string,
    query?: string,
): Promise<Array<{ id: string; name: string; type: ResourceType }>> {
    const dir = TEMPLATES_DIR(projectRoot);
    const out: Array<{ id: string; name: string; type: ResourceType }> = [];
    try {
        const entries = await fs.readdir(dir);
        for (const e of entries) {
            if (!e.endsWith(".json")) continue;
            const raw = await fs.readFile(path.join(dir, e), "utf8");
            const parsed = JSON.parse(raw) as ResourceTemplate;
            const candidate = {
                id: parsed.id,
                name: parsed.name,
                type: parsed.type,
            };
            if (!query) out.push(candidate);
            else {
                const q = query.toLowerCase();
                if (
                    candidate.id.toLowerCase().includes(q) ||
                    candidate.name.toLowerCase().includes(q) ||
                    candidate.type.toLowerCase().includes(q)
                ) {
                    out.push(candidate);
                }
            }
        }
    } catch (_) {
        // ignore missing dir
    }
    return out;
}

/**
 * Inspect a saved template and extract simple info: placeholders and metadata keys.
 */
export async function inspectResourceTemplate(
    projectRoot: string,
    templateId: string,
): Promise<{
    id: string;
    name: string;
    type: ResourceType;
    placeholders: string[];
    metadataKeys: string[];
}> {
    const tpl = await loadResourceTemplate(projectRoot, templateId);
    const placeholders = new Set<string>();
    const placeholderRe = /{{\s*([A-Za-z0-9_]+)\s*}}/g;
    function scan(v: unknown) {
        if (typeof v === "string") {
            let m: RegExpExecArray | null;
            while ((m = placeholderRe.exec(v))) placeholders.add(m[1]);
        } else if (Array.isArray(v)) v.forEach(scan);
        else if (v && typeof v === "object")
            Object.values(v).forEach(scan as any);
    }
    scan(tpl.name);
    scan(tpl.plainText);
    const metadataKeys = tpl.metadata ? Object.keys(tpl.metadata) : [];
    return {
        id: tpl.id,
        name: tpl.name,
        type: tpl.type,
        placeholders: Array.from(placeholders),
        metadataKeys,
    };
}

/** Create a resource on disk from a saved template. Returns the created resource. */
export async function createResourceFromTemplate(
    projectRoot: string,
    templateId: string,
    opts?: {
        name?: string;
        vars?: Record<string, string> | string;
        dryRun?: boolean;
    },
): Promise<
    | TextResource
    | ImageResource
    | AudioResource
    | {
          plannedWrites: Array<{ path: string; content: string | null }>;
          resourcePreview: any;
      }
> {
    const tmpl = await loadResourceTemplate(projectRoot, templateId);

    const vars: Record<string, string> | undefined =
        typeof opts?.vars === "string"
            ? JSON.parse(opts!.vars as string)
            : (opts?.vars as any | undefined);

    // helper to apply vars substitution ({{VAR}}) into strings/objects
    function applyVars(v: unknown): unknown {
        if (!vars) return v;
        if (typeof v === "string") {
            let out = v as string;
            for (const k of Object.keys(vars)) {
                out = out.split(`{{${k}}}`).join(String(vars[k]));
            }
            return out;
        }
        if (Array.isArray(v)) return v.map(applyVars);
        if (v && typeof v === "object") {
            const o: Record<string, unknown> = {};
            for (const key of Object.keys(v as Record<string, unknown>)) {
                o[key] = applyVars((v as Record<string, unknown>)[key]);
            }
            return o;
        }
        return v;
    }

    const name = (opts?.name ?? tmpl.name) as string;
    const appliedName = (applyVars(name) as string) ?? name;

    await ensureDir(RESOURCES_DIR(projectRoot));

    const plannedWrites: Array<{ path: string; content: string | null }> = [];

    if (tmpl.type === "text") {
        const res = createTextResource({
            name: appliedName,
            folderId: tmpl.folderId ?? null,
            plainText: (applyVars(tmpl.plainText ?? "") as string) ?? "",
            metadata: tmpl.metadata,
        });
        const filename = `${res.slug ?? appliedName.replace(/\s+/g, "-")}-${res.id}.txt`;
        const filePath = path.join(RESOURCES_DIR(projectRoot), filename);

        const content = res.plainText ?? "";
        const sidecar = JSON.stringify(
            {
                id: res.id,
                name: res.name,
                type: res.type,
                createdAt: res.createdAt,
            },
            null,
            2,
        );

        if (opts?.dryRun) {
            plannedWrites.push({ path: filePath, content });
            plannedWrites.push({
                path: path.join(
                    projectRoot,
                    "meta",
                    `resource-${res.id}.meta.json`,
                ),
                content: sidecar,
            });
            return { plannedWrites, resourcePreview: res };
        }

        await fs.writeFile(filePath, content, "utf8");
        await writeSidecar(projectRoot, res.id, JSON.parse(sidecar));
        return res;
    }

    if (tmpl.type === "image") {
        const res = createImageResource({
            name: appliedName,
            folderId: tmpl.folderId ?? null,
            metadata: tmpl.metadata,
        });
        const filename = `${res.slug ?? appliedName.replace(/\s+/g, "-")}-${res.id}.img`;
        const filePath = path.join(RESOURCES_DIR(projectRoot), filename);
        const sidecar = JSON.stringify(
            {
                id: res.id,
                name: res.name,
                type: res.type,
                createdAt: res.createdAt,
            },
            null,
            2,
        );

        if (opts?.dryRun) {
            plannedWrites.push({ path: filePath, content: "" });
            plannedWrites.push({
                path: path.join(
                    projectRoot,
                    "meta",
                    `resource-${res.id}.meta.json`,
                ),
                content: sidecar,
            });
            return { plannedWrites, resourcePreview: res };
        }

        await fs.writeFile(filePath, "", "utf8");
        await writeSidecar(projectRoot, res.id, JSON.parse(sidecar));
        return res;
    }

    // audio
    const res = createAudioResource({
        name: appliedName,
        folderId: tmpl.folderId ?? null,
        metadata: tmpl.metadata,
    });
    const filename = `${res.slug ?? appliedName.replace(/\s+/g, "-")}-${res.id}.aud`;
    const filePath = path.join(RESOURCES_DIR(projectRoot), filename);
    const sidecar = JSON.stringify(
        {
            id: res.id,
            name: res.name,
            type: res.type,
            createdAt: res.createdAt,
        },
        null,
        2,
    );

    if (opts?.dryRun) {
        plannedWrites.push({ path: filePath, content: "" });
        plannedWrites.push({
            path: path.join(
                projectRoot,
                "meta",
                `resource-${res.id}.meta.json`,
            ),
            content: sidecar,
        });
        return { plannedWrites, resourcePreview: res };
    }

    await fs.writeFile(filePath, "", "utf8");
    await writeSidecar(projectRoot, res.id, JSON.parse(sidecar));
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
