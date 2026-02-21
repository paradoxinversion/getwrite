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
import Schemas from "./schemas";

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
 * Export a template (and optional sample data) as a simple .zip package.
 * Currently packages only the template JSON as <templateId>.json.
 */
export async function exportResourceTemplate(
    projectRoot: string,
    templateId: string,
    outPath: string,
): Promise<void> {
    const tpl = await loadResourceTemplate(projectRoot, templateId);
    const name = `${tpl.id}.json`;
    const data = Buffer.from(JSON.stringify(tpl, null, 2), "utf8");
    const zip = createZipBuffer([{ name, data }]);
    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, zip);
}

/**
 * Import templates from a simple .zip package produced by `exportResourceTemplate`.
 * Extracts .json entries and writes them into meta/templates/.
 * Returns list of imported template ids.
 */
export async function importResourceTemplates(
    projectRoot: string,
    packPath: string,
): Promise<string[]> {
    const buf = await fs.readFile(packPath);
    const entries = parseZipBuffer(buf);
    if (!entries || entries.length === 0) {
        throw new Error("Invalid or empty template package");
    }
    const dir = TEMPLATES_DIR(projectRoot);
    await ensureDir(dir);
    const imported: string[] = [];
    for (const e of entries) {
        if (!e.name.endsWith(".json")) continue;
        const tpl = JSON.parse(e.data.toString("utf8")) as ResourceTemplate;
        const file = path.join(dir, `${tpl.id}.json`);
        await withMetaLock(projectRoot, async () => {
            await fs.writeFile(file, JSON.stringify(tpl, null, 2), "utf8");
        });
        imported.push(tpl.id);
    }
    return imported;
}

/** Validate a saved template against the runtime schema. Returns validation result. */
export async function validateResourceTemplate(
    projectRoot: string,
    templateId: string,
): Promise<{ valid: true } | { valid: false; errors: string[] }> {
    const tpl = await loadResourceTemplate(projectRoot, templateId);
    const res = Schemas.ResourceTemplateSchema.safeParse(tpl);
    if (res.success) return { valid: true };
    const errors: string[] = [];
    for (const issue of res.error.issues) {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { valid: false, errors };
}

// --- Minimal ZIP writer/reader for single/multiple file packages ---

function crc32(buf: Buffer): number {
    const table = CRC32_TABLE;
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++)
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
}

function createZipBuffer(
    entries: Array<{ name: string; data: Buffer }>,
): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const e of entries) {
        const nameBuf = Buffer.from(e.name, "utf8");
        const crc = crc32(e.data);
        const compSize = e.data.length;
        const uncompSize = e.data.length;

        const localHeader = Buffer.alloc(30);
        // local file header signature
        localHeader.writeUInt32LE(0x04034b50, 0);
        // version needed
        localHeader.writeUInt16LE(20, 4);
        // flags
        localHeader.writeUInt16LE(0, 6);
        // compression (0 = none)
        localHeader.writeUInt16LE(0, 8);
        // mod time/date
        localHeader.writeUInt16LE(0, 10);
        localHeader.writeUInt16LE(0, 12);
        // crc32
        localHeader.writeUInt32LE(crc, 14);
        // comp size
        localHeader.writeUInt32LE(compSize, 18);
        // uncomp size
        localHeader.writeUInt32LE(uncompSize, 22);
        // filename len
        localHeader.writeUInt16LE(nameBuf.length, 26);
        // extra len
        localHeader.writeUInt16LE(0, 28);

        localParts.push(localHeader, nameBuf, e.data);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(0, 4); // version made by
        centralHeader.writeUInt16LE(20, 6); // version needed
        centralHeader.writeUInt16LE(0, 8); // flags
        centralHeader.writeUInt16LE(0, 10); // compression
        centralHeader.writeUInt16LE(0, 12); // mod time
        centralHeader.writeUInt16LE(0, 14); // mod date
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(compSize, 20);
        centralHeader.writeUInt32LE(uncompSize, 24);
        centralHeader.writeUInt16LE(nameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30); // extra
        centralHeader.writeUInt16LE(0, 32); // comment
        centralHeader.writeUInt16LE(0, 34); // disk start
        centralHeader.writeUInt16LE(0, 36); // internal attrs
        centralHeader.writeUInt32LE(0, 38); // external attrs
        centralHeader.writeUInt32LE(offset, 42); // relative offset

        centralParts.push(centralHeader, nameBuf);

        offset += localHeader.length + nameBuf.length + e.data.length;
    }

    const centralDir = Buffer.concat(centralParts);
    const local = Buffer.concat(localParts);

    const eocdr = Buffer.alloc(22);
    eocdr.writeUInt32LE(0x06054b50, 0);
    eocdr.writeUInt16LE(0, 4); // disk
    eocdr.writeUInt16LE(0, 6); // start disk
    eocdr.writeUInt16LE(entries.length, 8); // entries this disk
    eocdr.writeUInt16LE(entries.length, 10); // total entries
    eocdr.writeUInt32LE(centralDir.length, 12); // size of central
    eocdr.writeUInt32LE(local.length, 16); // offset of start of central
    eocdr.writeUInt16LE(0, 20); // comment len

    return Buffer.concat([local, centralDir, eocdr]);
}

function parseZipBuffer(buf: Buffer): Array<{ name: string; data: Buffer }> {
    const out: Array<{ name: string; data: Buffer }> = [];
    let offset = 0;
    while (offset + 30 <= buf.length) {
        const sig = buf.readUInt32LE(offset);
        if (sig !== 0x04034b50) break;
        const nameLen = buf.readUInt16LE(offset + 26);
        const extraLen = buf.readUInt16LE(offset + 28);
        const crc = buf.readUInt32LE(offset + 14);
        const compSize = buf.readUInt32LE(offset + 18);
        const uncompSize = buf.readUInt32LE(offset + 22);
        const nameStart = offset + 30;
        const name = buf.slice(nameStart, nameStart + nameLen).toString("utf8");
        const dataStart = nameStart + nameLen + extraLen;
        const data = buf.slice(dataStart, dataStart + compSize);
        out.push({ name, data });
        offset = dataStart + compSize;
    }
    return out;
}

// CRC table (generated once)
const CRC32_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let r = i;
        for (let j = 0; j < 8; j++)
            r = r & 1 ? 0xedb88320 ^ (r >>> 1) : r >>> 1;
        t[i] = r >>> 0;
    }
    return Array.from(t);
})();
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
