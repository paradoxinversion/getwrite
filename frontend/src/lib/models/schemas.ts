import { z } from "zod";

/** UUID schema (v4) */
export const UUID = z.string().uuid();

/** ISO 8601-ish date/time string validation (uses Date.parse) */
const IsoDateString = z.string().refine((s) => !isNaN(Date.parse(s)), {
    message: "Expected ISO 8601 date string",
});

// Recursive metadata value schema (JSON-friendly, allows nested objects/arrays)
export const MetadataValue: z.ZodTypeAny = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string()),
        z.array(z.number()),
        z.array(z.boolean()),
        z.record(MetadataValue),
    ]),
);

export const ProjectConfigSchema = z.object({
    maxRevisions: z.number().int().nonnegative().optional(),
    statuses: z.array(z.string()).optional(),
    autoPrune: z.boolean().optional(),
});

export const ProjectSchema = z.object({
    id: UUID,
    slug: z.string().optional(),
    name: z.string(),
    createdAt: IsoDateString,
    updatedAt: IsoDateString.optional(),
    projectType: z.string().optional(),
    rootPath: z.string().optional(),
    config: ProjectConfigSchema.optional(),
    metadata: z.record(MetadataValue).optional(),
});

export const FolderSchema = z.object({
    id: UUID,
    slug: z.string().optional(),
    name: z.string(),
    parentId: UUID.nullable().optional(),
    orderIndex: z.number().optional(),
    createdAt: IsoDateString,
    updatedAt: IsoDateString.optional(),
});

export const ResourceTypeSchema = z.enum(["text", "image", "audio"]);

export const TipTapNodeSchema: z.ZodTypeAny = z.lazy(() =>
    z.object({
        type: z.string(),
        attrs: z.record(MetadataValue).optional(),
        content: z.array(TipTapNodeSchema).optional(),
    }),
);

export const TipTapDocumentSchema = z.object({
    type: z.literal("doc"),
    content: z.array(TipTapNodeSchema),
});

export const ResourceBaseSchema = z.object({
    id: UUID,
    slug: z.string().optional(),
    name: z.string(),
    type: ResourceTypeSchema,
    folderId: UUID.nullable().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    statuses: z.array(z.string()).optional(),
    metadata: z.record(MetadataValue).optional(),
    createdAt: IsoDateString,
    updatedAt: IsoDateString.optional(),
});

export const TextResourceSchema = ResourceBaseSchema.extend({
    type: z.literal("text"),
    plainText: z.string().optional(),
    tiptap: TipTapDocumentSchema.optional(),
    wordCount: z.number().int().nonnegative().optional(),
    charCount: z.number().int().nonnegative().optional(),
    paragraphCount: z.number().int().nonnegative().optional(),
});

export const ImageResourceSchema = ResourceBaseSchema.extend({
    type: z.literal("image"),
    width: z.number().int().nonnegative().optional(),
    height: z.number().int().nonnegative().optional(),
    exif: z.record(MetadataValue).optional(),
});

export const AudioResourceSchema = ResourceBaseSchema.extend({
    type: z.literal("audio"),
    durationSeconds: z.number().nonnegative().optional(),
    format: z.string().optional(),
});

export const AnyResourceSchema = z.union([
    TextResourceSchema,
    ImageResourceSchema,
    AudioResourceSchema,
]);

export const RevisionSchema = z.object({
    id: UUID,
    resourceId: UUID,
    versionNumber: z.number().int().nonnegative(),
    createdAt: IsoDateString,
    savedAt: IsoDateString.optional(),
    author: z.string().optional(),
    filePath: z.string(),
    isCanonical: z.boolean(),
});

export const Schemas = {
    UUID,
    MetadataValue,
    ProjectConfigSchema,
    ProjectSchema,
    FolderSchema,
    ResourceBaseSchema,
    TextResourceSchema,
    ImageResourceSchema,
    AudioResourceSchema,
    AnyResourceSchema,
    RevisionSchema,
    TipTapDocumentSchema,
    TipTapNodeSchema,
};

export type Infer<T extends z.ZodTypeAny> = z.infer<T>;

export default Schemas;
