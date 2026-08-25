/**
 * @module schemas
 *
 * Central Zod schemas for model validation and project-type specification
 * validation.
 *
 * Responsibilities:
 * - Define canonical runtime validators for persisted project/model data.
 * - Provide schema-derived TypeScript inference helpers.
 * - Validate project-type JSON specs from memory or file.
 */
import { z } from "zod";
import { QueryASTSchema } from "./query-ast";
export type {
  QueryAST,
  LeafNode,
  CombinatorNode,
  SpliceNode,
  ComparisonNode,
  ComparisonOp,
  InNode,
  ExistsNode,
  TextNode,
  TextOp,
  LinksToNode,
  LinkedFromNode,
  AndNode,
  OrNode,
  NotNode,
  RefNode,
  ParamNode,
} from "./query-ast";
export {
  QueryASTSchema,
  ComparisonNodeSchema,
  InNodeSchema,
  ExistsNodeSchema,
  TextNodeSchema,
  LinksToNodeSchema,
  LinkedFromNodeSchema,
  RefNodeSchema,
  ParamNodeSchema,
  ComparisonOpSchema,
  TextOpSchema,
} from "./query-ast";

/**
 * Canonical UUID v4 string validator used across model schemas.
 *
 * @example
 * UUID.parse("550e8400-e29b-41d4-a716-446655440000");
 */
export const UUID = z.string().uuid();

/**
 * Date-like ISO string validator using `Date.parse(...)` for acceptance.
 *
 * This is intentionally permissive and validates parseability rather than a
 * strict RFC format.
 */
const IsoDateString = z
  .string()
  .refine((s) => !isNaN(Date.parse(s)), {
    message: "Expected ISO 8601 date string",
  });

/**
 * Resource reference value shape used for `resource-ref` metadata fields.
 * Stores both the UUID (or null when the target has been deleted) and the
 * display name so the UI can render without a secondary lookup.
 */
export const ResourceRefValueSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
});

/**
 * Recursive metadata value validator used for extensible user/project metadata.
 *
 * Supports scalar values, homogeneous primitive arrays, resource references,
 * and nested objects.
 */
export const MetadataValue: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()),
    z.array(z.number()),
    z.array(z.boolean()),
    z.array(ResourceRefValueSchema),
    ResourceRefValueSchema,
    z.record(z.string(), MetadataValue),
  ]),
);

const EditorHeadingSchema = z.object({
  fontSize: z.string().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.string().optional(),
  letterSpacing: z.string().optional(),
  color: z.string().optional(),
});

const EditorBodySchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  lineHeight: z.string().optional(),
  paragraphSpacing: z.string().optional(),
});

export const EditorConfigSchema = z.object({
  headings: z
    .object({
      h1: EditorHeadingSchema.optional(),
      h2: EditorHeadingSchema.optional(),
      h3: EditorHeadingSchema.optional(),
      h4: EditorHeadingSchema.optional(),
      h5: EditorHeadingSchema.optional(),
      h6: EditorHeadingSchema.optional(),
    })
    .optional(),
  body: EditorBodySchema.optional(),
});

/**
 * Allowed field types for user-defined metadata fields.
 */
export const MetadataFieldTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "multiselect",
  "resource-ref",
  "multi-resource-ref",
]);

/**
 * Single metadata field definition within a schema group.
 *
 * - `key` accepts any non-empty string so that persisted camelCase built-in
 *   keys (`storyDate`, `storyDuration`, `storyEndDate`) round-trip cleanly.
 *   The slug-pattern constraint (`/^[a-z0-9-]+$/`) is enforced only at the
 *   API route layer, where it guards user-created fields on write.
 * - `options` is only meaningful for `select` / `multiselect` types.
 * - `multiple` is only meaningful for `resource-ref` type.
 * - `refFolder` and `includeSubfolders` are only meaningful for
 *   `resource-ref` / `multi-resource-ref` types.
 * - `maxSelections` is only meaningful for `multi-resource-ref` type.
 * - `locked` fields cannot be removed or have their key changed.
 */
export const MetadataFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  type: MetadataFieldTypeSchema,
  locked: z.boolean().optional(),
  deprecated: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  multiple: z.boolean().optional(),
  /** Scopes autocomplete candidates to resources in this folder (by folder id). */
  refFolder: z.string().optional(),
  /** When true and refFolder is set, candidates include descendant folders too. */
  includeSubfolders: z.boolean().optional(),
  /** Maximum number of selections allowed; unset means unbounded. */
  maxSelections: z.number().int().positive().optional(),
});

/**
 * A named group of metadata fields, optionally scoped to a specific folder.
 * When `folderId` is present, the group is only rendered for resources in that
 * folder.
 */
export const MetadataGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  folderId: z.string().optional(),
  fields: z.array(MetadataFieldSchema),
});

/**
 * Top-level metadata schema for a project, consisting of ordered groups.
 */
export const MetadataSchemaSchema = z.object({
  groups: z.array(MetadataGroupSchema),
});

/**
 * Per-project opt-in flags gating the previously-locked built-in metadata
 * features. An absent flag is treated as disabled.
 */
export const ProjectFeatureFlagsSchema = z.object({
  /** Activates the story-timeline metadata fields in the sidebar. */
  timeline: z.boolean().optional(),
  /** Activates the Timeline view/tab (independent of the date fields). */
  timelineView: z.boolean().optional(),
  /** Activates the Point of View metadata field. */
  pov: z.boolean().optional(),
  /** Activates the Synopsis metadata field. */
  synopsis: z.boolean().optional(),
  /** Activates the Notes metadata field. */
  notes: z.boolean().optional(),
});

/**
 * Source that drives the body text shown on Organizer cards.
 */
export const OrganizerCardBodySourceSchema = z.enum([
  "none",
  "text-excerpt",
  "field",
]);

/**
 * Per-project configuration for what Organizer cards render as their body.
 *
 * - `fieldKey` is only meaningful when `source` is `"field"`.
 * - `excerptLength` is only meaningful when `source` is `"text-excerpt"`.
 */
export const OrganizerCardBodyConfigSchema = z.object({
  source: OrganizerCardBodySourceSchema,
  fieldKey: z.string().min(1).optional(),
  excerptLength: z.number().int().positive().optional(),
});

/**
 * Project-level configuration schema persisted in `project.json`.
 */
export const ProjectConfigSchema = z.object({
  maxRevisions: z.number().int().nonnegative().optional(),
  wordCountGoal: z.number().int().nonnegative().optional(),
  statuses: z.array(z.string()).optional(),
  autoPrune: z.boolean().optional(),
  tags: z
    .array(
      z.object({ id: UUID, name: z.string(), color: z.string().optional() }),
    )
    .optional(),
  tagAssignments: z.record(z.string(), z.array(UUID)).optional(),
  editorConfig: EditorConfigSchema.optional(),
  defaultRevisionName: z.string().optional(),
  metadataSchema: MetadataSchemaSchema.optional(),
  metadataRevision: z.number().int().nonnegative().optional(),
  features: ProjectFeatureFlagsSchema.optional(),
  organizerCardBody: OrganizerCardBodyConfigSchema.optional(),
});

/**
 * Full project document schema for `project.json`.
 */
export const ProjectSchema = z.object({
  id: UUID,
  slug: z.string().optional(),
  name: z.string(),
  createdAt: IsoDateString,
  updatedAt: IsoDateString.optional(),
  projectType: z.string().optional(),
  rootPath: z.string().optional(),
  config: ProjectConfigSchema.optional(),
  metadata: z.record(z.string(), MetadataValue).optional(),
});

/**
 * Metadata source configuration shape shared by `FolderSchema`,
 * `ProjectTypeFolderSchema`, and `ProjectTypeDefaultFolderSchema`.
 *
 * Not exported — the three schemas that use it are the public API.
 */
const MetadataSourceSchema = z.object({
  isMetadataSource: z.boolean(),
  metadataInputType: z.enum(["text", "multiselect", "autocomplete"]).optional(),
});

/**
 * Folder schema used for logical project hierarchy.
 */
export const FolderSchema = z.object({
  id: UUID,
  slug: z.string(),
  name: z.string(),
  type: z.literal("folder"),
  parentId: UUID.nullable().optional(),
  orderIndex: z.number().default(0),
  createdAt: IsoDateString,
  updatedAt: IsoDateString.optional(),
  special: z.boolean().optional(),
  metadataSource: MetadataSourceSchema.optional(),
});

/**
 * Allowed runtime resource categories.
 */
export const ResourceTypeSchema = z.enum(["text", "image", "audio"]);

/**
 * Recursive TipTap node schema representing a subset of editor AST nodes.
 */
export const TipTapNodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), MetadataValue).optional(),
    content: z.array(TipTapNodeSchema).optional(),
  }),
);

/**
 * TipTap document root schema (`type: "doc"`).
 */
export const TipTapDocumentSchema: z.ZodTypeAny = z.object({
  type: z.literal("doc"),
  content: z.array(TipTapNodeSchema),
});

/**
 * Entity-layer sidecar fields (`entityKind` / `aliases`).
 *
 * - `entityKind` marks a resource as an entity. It is intentionally an open,
 *   user-definable string rather than an enum — this is a closed design
 *   decision from the entity-layer spec gate (FR-1/FR-2). Values like
 *   `"faction"` or `"mechanic"` must validate identically to `"character"` /
 *   `"place"` / `"object"`. Absent means the resource is not an entity.
 * - `aliases`, when present, is an ordered (insertion order preserved) array
 *   of non-empty strings. Length or common-word screening is intentionally
 *   out of scope here — that belongs to a later, non-blocking warning
 *   system.
 */
export const EntitySidecarFieldsSchema = z.object({
  entityKind: z.string().min(1).optional(),
  aliases: z.array(z.string().min(1)).optional(),
});

/**
 * Shared base schema for resource records regardless of subtype.
 */
export const ResourceBaseSchema = z
  .object({
    id: UUID,
    slug: z.string(),
    name: z.string(),
    type: ResourceTypeSchema,
    folderId: UUID.nullable().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    orderIndex: z.number().default(0),
    statuses: z.array(z.string()).optional(),
    userMetadata: z.record(z.string(), MetadataValue).optional(),
    createdAt: IsoDateString,
    updatedAt: IsoDateString.optional(),
  })
  .extend(EntitySidecarFieldsSchema.shape);

/**
 * Text resource schema extending base fields with editor/text metrics.
 */
export const TextResourceSchema = ResourceBaseSchema.extend({
  type: z.literal("text"),
  plainText: z.string().optional(),
  tiptap: TipTapDocumentSchema.optional(),
  wordCount: z.number().int().nonnegative().optional(),
  charCount: z.number().int().nonnegative().optional(),
  paragraphCount: z.number().int().nonnegative().optional(),
});

/**
 * Image resource schema extending base fields with dimensions and EXIF data.
 */
export const ImageResourceSchema = ResourceBaseSchema.extend({
  type: z.literal("image"),
  file: z.string().optional(),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  exif: z.record(z.string(), MetadataValue).optional(),
});

/**
 * Audio resource schema extending base fields with duration/format metadata.
 */
export const AudioResourceSchema = ResourceBaseSchema.extend({
  type: z.literal("audio"),
  file: z.string().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  format: z.string().optional(),
});

/**
 * Union schema for any supported resource subtype.
 */
export const AnyResourceSchema = z.union([
  TextResourceSchema,
  ImageResourceSchema,
  AudioResourceSchema,
]);

/**
 * Revision metadata schema persisted under each revision folder.
 */
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

/**
 * Resource template schema used for generated/default resources.
 */
export const ResourceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ResourceTypeSchema,
  folderId: UUID.nullable().optional(),
  userMetadata: z.record(z.string(), MetadataValue).optional(),
  plainText: z.string().optional(),
});

/**
 * Convenience object bundling core model schemas.
 *
 * Prefer named imports for tree-shaking in runtime bundles.
 */
export const Schemas = {
  UUID,
  MetadataValue,
  ResourceRefValueSchema,
  MetadataFieldTypeSchema,
  MetadataFieldSchema,
  MetadataGroupSchema,
  MetadataSchemaSchema,
  ProjectConfigSchema,
  ProjectSchema,
  FolderSchema,
  ResourceBaseSchema,
  EntitySidecarFieldsSchema,
  TextResourceSchema,
  ImageResourceSchema,
  AudioResourceSchema,
  AnyResourceSchema,
  RevisionSchema,
  ResourceTemplateSchema,
  TipTapDocumentSchema,
  TipTapNodeSchema,
  QueryASTSchema,
};

/**
 * Project-type default resource schema used inside project-type specs.
 */
export const ProjectTypeResourceSchema = z.object({
  folder: z.string().optional(),
  name: z.string(),
  type: ResourceTypeSchema,
  template: z.string().optional(),
  userMetadata: z.record(z.string(), MetadataValue).optional(),
});

/**
 * Project-type folder schema defining folder seed structure.
 */
export const ProjectTypeFolderSchema = z.object({
  name: z.string(),
  special: z.boolean().optional(),
  metadataSource: MetadataSourceSchema.optional(),
  defaultResources: z.array(ProjectTypeResourceSchema).optional(),
});

/**
 * Project-type default subfolder declaration.
 * Each entry declares one subfolder under a named parent folder.
 */
export const ProjectTypeDefaultFolderSchema = z.object({
  folder: z.string(),
  name: z.string(),
  special: z.boolean().optional(),
  metadataSource: MetadataSourceSchema.optional(),
});

export type ProjectTypeDefaultFolder = z.infer<
  typeof ProjectTypeDefaultFolderSchema
>;

/**
 * Project-type specification schema.
 *
 * Constraints:
 * - `id` must be lowercase slug-like text (`[a-z0-9-_]+`).
 * - At least one folder is required.
 *
 * Authors may use any folder layout; no folder name carries application
 * semantics. The deprecated `special` folder flag is still accepted (and
 * ignored) for backward compatibility with project types created before the
 * Workspace requirement was removed.
 */
export const ProjectTypeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-_]+$/),
    name: z.string(),
    description: z.string().optional(),
    folders: z.array(ProjectTypeFolderSchema).min(1),
    defaultResources: z.array(ProjectTypeResourceSchema).optional(),
    defaultFolders: z.array(ProjectTypeDefaultFolderSchema).optional(),
    editorConfig: EditorConfigSchema.optional(),
    statuses: z.array(z.string()).optional(),
    wordCountGoal: z.number().int().nonnegative().optional(),
  })
  .strict();

/**
 * Inferred TypeScript shape of a valid project-type spec.
 */
export type ProjectTypeSpec = z.infer<typeof ProjectTypeSchema>;

/**
 * Validates an in-memory unknown value as a project-type specification.
 *
 * @param spec - Unknown value to validate.
 * @returns Success object with parsed value, or failure object with formatted
 *   Zod errors.
 *
 * @example
 * const result = validateProjectType(input);
 * if (result.success) {
 *   console.log(result.value.id);
 * }
 */
export function validateProjectType(spec: unknown) {
  const result = ProjectTypeSchema.safeParse(spec);
  if (result.success) return { success: true, value: result.data };
  return { success: false, errors: result.error.format() };
}

/**
 * Reads and validates a project-type JSON file from disk.
 *
 * @param filePath - Absolute path to a JSON file.
 * @returns Validation result from {@link validateProjectType}, or an explicit
 *   invalid-JSON failure payload.
 * @throws {Error} If the file cannot be read.
 *
 * @example
 * const result = await validateProjectTypeFile("/tmp/novel.project-type.json");
 */
export async function validateProjectTypeFile(filePath: string) {
  const { default: fs } = await import("node:fs/promises");
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return validateProjectType(JSON.parse(raw));
  } catch (err) {
    return {
      success: false,
      errors: [`Invalid JSON: ${(err as Error).message}`],
    };
  }
}

/**
 * Generic helper type for inferring static TypeScript types from Zod schemas.
 *
 * @example
 * type Project = Infer<typeof ProjectSchema>;
 */
export type Infer<T extends z.ZodTypeAny> = z.infer<T>;

/**
 * Default export for compatibility with modules expecting grouped schema access.
 */
export default Schemas;
