// Type definitions for GetWrite models
// Follow docs/standards/typescript-implementation.md: no `any`, explicit types, and clear documentation.

/** UUID v4 represented as a string. Use for stable opaque identities. */
export type UUID = string;

/**
 * A reference to another resource, used as the value shape for `resource-ref`
 * metadata fields. `id` is null when the referenced resource has been deleted
 * but the display name is preserved.
 */
export type ResourceRef = { id: string | null; name: string };

/**
 * MetadataValue: recursive union representing allowed sidecar metadata values.
 * Designed to be JSON-friendly while allowing nested structured metadata.
 * Includes ResourceRef and ResourceRef[] to support resource-ref field types.
 */
export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[]
  | ResourceRef
  | ResourceRef[]
  | { [key: string]: MetadataValue };

/** Union of heading levels supported in the editor. */
export type EditorHeadings = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
/** Per-heading visual styling overrides applied in the editor. All fields are optional. */
export type EditorHeading = {
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  letterSpacing?: string;
  color?: string;
};
/** Body text styling configuration for the editor. All fields are optional. */
export type EditorBodyConfig = {
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  paragraphSpacing?: string;
};

/**
 * Per-project opt-in flags gating the previously-locked built-in metadata
 * features. An absent flag is treated as disabled.
 */
export interface ProjectFeatureFlags {
  /** Activates the story-timeline metadata fields (`storyDate`/`storyDuration`/`storyEndDate`) in the sidebar. */
  timeline?: boolean;
  /**
   * Activates the Timeline view/tab. Independent of {@link ProjectFeatureFlags.timeline}
   * (the date fields the view reads): a project can keep the fields without the
   * view, or vice versa.
   */
  timelineView?: boolean;
  /** Activates the Point of View (`pov`) metadata field. */
  pov?: boolean;
  /** Activates the Synopsis (`synopsis`) metadata field. */
  synopsis?: boolean;
  /** Activates the Notes (`notes`) metadata field. */
  notes?: boolean;
  /** Activates the entity metadata UI (Entity, Entities Mentioned, Entity Mentions sections). */
  entities?: boolean;
}

/** Source that drives the body text shown on Organizer cards. */
export type OrganizerCardBodySource = "none" | "text-excerpt" | "field";

/** Per-project configuration for what Organizer cards render as their body. */
export interface OrganizerCardBodyConfig {
  /** Where the card body text comes from. */
  source: OrganizerCardBodySource;
  /** Metadata field key whose value is shown; only meaningful when `source` is `"field"`. */
  fieldKey?: string;
  /** Max characters of the resource's text content to show; only meaningful when `source` is `"text-excerpt"`. */
  excerptLength?: number;
}

/**
 * Project-level configuration persisted with the project (project.json).
 * Contains user-editable preferences that affect model behavior.
 */
export interface ProjectConfig {
  /** Maximum revisions to retain per resource. Defaults to 50 when omitted. */
  maxRevisions?: number;
  /** Target word count for the project (e.g. 80000 for a novel). */
  wordCountGoal?: number;
  /** Custom status values available to the project (e.g., ["Draft","Complete"]). */
  statuses?: string[];
  /**
   * When true, automatically prune oldest non-canonical revisions when limit is exceeded.
   * When false, the UI should prompt the user (interactive) or abort in headless contexts.
   */
  autoPrune?: boolean;
  /** Optional list of project-scoped tags. */
  tags?: Tag[];
  /** Optional map of resourceId -> tagId[] assignments persisted in project config. */
  tagAssignments?: Record<string, string[]>;
  /** Editor configuration for the project. */
  editorConfig: {
    headings?: { [index in EditorHeadings]?: EditorHeading };
    body?: EditorBodyConfig;
  };
  /** Default name applied to the initial canonical revision when a new text resource is created. */
  defaultRevisionName?: string;
  /** User-defined (and built-in locked) metadata field schema for the project. */
  metadataSchema?: MetadataSchema;
  /** Monotonically-increasing counter bumped on every sidecar or schema write. Used as a cache-invalidation key by the query evaluator. */
  metadataRevision?: number;
  /** Per-project opt-in flags gating the previously-locked built-in metadata features. Absent flag = disabled. */
  features?: ProjectFeatureFlags;
  /** Configures what Organizer cards render as their body text. */
  organizerCardBody?: OrganizerCardBodyConfig;
}

/** Allowed field types for user-defined metadata fields. */
export type MetadataFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multiselect"
  | "resource-ref"
  | "multi-resource-ref";

/** A single metadata field definition within a schema group. */
export interface MetadataField {
  /** URL-safe slug (`[a-z0-9-]+`), unique within the project schema. */
  key: string;
  /** Display label shown in the sidebar and schema manager. */
  label: string;
  type: MetadataFieldType;
  /** Locked fields cannot be removed or have their key renamed. */
  locked?: boolean;
  /** When true, the field is hidden from the sidebar but remains queryable; sidecar values are preserved. */
  deprecated?: boolean;
  /** Allowed values for `select` / `multiselect` types. */
  options?: string[];
  /** When true, a `resource-ref` field stores an array of refs. */
  multiple?: boolean;
  /** Scopes autocomplete candidates to resources in this folder (by folder id). Only meaningful for `resource-ref` / `multi-resource-ref`. */
  refFolder?: string;
  /** When true and refFolder is set, candidates include descendant folders. Only meaningful for `resource-ref` / `multi-resource-ref`. */
  includeSubfolders?: boolean;
  /** Maximum number of selections; unset means unbounded. Only meaningful for `multi-resource-ref`. */
  maxSelections?: number;
}

/** A named group of metadata fields, optionally scoped to one folder. */
export interface MetadataGroup {
  id: string;
  label: string;
  /** When present, this group is only rendered for resources in this folder. */
  folderId?: string;
  fields: MetadataField[];
}

/** Top-level metadata schema for a project, consisting of ordered groups. */
export interface MetadataSchema {
  groups: MetadataGroup[];
}

/** Simple Tag type for project-scoped tagging. */
export interface Tag {
  id: UUID;
  name: string;
  color?: string;
}

/** Represents a single GetWrite project (local-first). */
export interface Project {
  /** Immutable UUID v4 identity for the project. */
  id: UUID;
  /** Optional human-readable slug, unique within the project. */
  slug?: string;
  /** Display name provided by the user. */
  name: string;
  /** Creation timestamp in ISO 8601 format. */
  createdAt: string;
  /** Last-modified timestamp (ISO 8601). */
  updatedAt?: string;
  /** Optional project type identifier (e.g., 'novel'). */
  projectType?: string;
  /** Filesystem root path for the project (local-first storage). */
  rootPath?: string;
  /** Project-specific configuration (see ProjectConfig). */
  config?: ProjectConfig;
  /** Arbitrary project-scoped metadata stored in sidecar or project config. */
  metadata?: Record<string, MetadataValue>;
}

export type ResourceType = "text" | "image" | "audio" | "folder";

/**
 * UI view names used by the WorkArea view switcher and related components.
 * Added to canonical models to provide a single source-of-truth for small UI unions.
 */
export type ViewName = "edit" | "organizer" | "data" | "diff" | "timeline";

/** Input types for metadata collection. */
export type MetadataInputType = "text" | "multiselect" | "autocomplete";

/** Metadata source configuration for a folder or resource. */
export type MetadataSource = {
  /** `true` if this folder or resource is a metadata source. */
  isMetadataSource: boolean;
  /** Type of input used for metadata collection. Should only be set if `isMetadataSource` is true. */
  metadataInputType?: MetadataInputType;
};

/**
 * Reserved `userMetadata` keys used by the story timeline feature.
 * These are stored as plain values in the `userMetadata` record — no schema change required.
 *
 * - `storyDate`     string  ISO date "YYYY-MM-DD" — places the resource on the story timeline
 * - `storyTime`     string  Optional "HH:mm" time-of-day; combined with storyDate as "YYYY-MM-DDTHH:mm"
 * - `storyDuration` number  Optional duration in minutes; used to compute an endDate for the timeline item
 * - `storyEndDate`  string  Optional ISO datetime override for the end time; takes precedence over computed (storyDate + storyDuration)
 */

/** Base attributes common to all resource types (text/image/audio). */
export interface ResourceBase {
  /** Resource UUID (immutable identity independent of path). */
  id: UUID;
  /** Human-friendly slug, unique per-project. */
  slug: string;
  /** Display name (without extension). */
  name: string;
  /** Resource media type. */
  type: ResourceType;
  /** Owning folder UUID or null for root. */
  folderId?: UUID | null;
  /** Derived filesystem size in bytes (optional). */
  sizeBytes?: number;
  /** User-editable notes. */
  notes?: string;
  /** Ordering index used for tree ordering within a parent. */
  orderIndex: number;
  /** Status tags (project-scoped values). */
  statuses?: string[];
  /**
   * Marks this resource as an entity of the given kind (e.g. "character",
   * "place", "faction"). Open, user-definable value — not an enum. Absent
   * means the resource is not an entity.
   */
  entityKind?: string;
  /**
   * Ordered list of alternate names for this entity. Order is
   * insertion-preserved and significant (e.g. a later "primary alias"
   * feature may read the first entry). Each entry must be a non-empty
   * string.
   */
  aliases?: string[];
  /** User-set key/value metadata stored in sidecar (distinct from system fields like sizeBytes, createdAt, orderIndex). */
  userMetadata?: Record<string, MetadataValue>;
  /** Creation timestamp (ISO 8601). */
  createdAt: string;
  /** Last-modified timestamp (ISO 8601). */
  updatedAt?: string;
}

/** Logical container within a project used to group resources. */
export interface Folder extends ResourceBase {
  /** Discriminant for folder resources. */
  type: "folder";
  /** Parent folder UUID; null or undefined for top-level. */
  parentId?: UUID | null;
  /** @deprecated Legacy folder flag from older project-type files; still accepted and propagated, but assigns no special semantics. */
  special?: boolean;
  /** When set, marks this folder as a metadata collection source (see {@link MetadataSource}). */
  metadataSource?: MetadataSource;
}

// Minimal TipTap AST-safe types used for editor persistence.
/** Minimal TipTap AST node used for storing editor state. */
export interface TipTapNode {
  /** Node type name (e.g., 'paragraph', 'text', 'heading'). */
  type: string;
  /** Text payload for leaf `text` nodes. */
  text?: string;
  /** Optional attributes for the node (formatting, links, etc.). */
  attrs?: Record<string, MetadataValue>;
  /** Child nodes for nested structures. */
  content?: TipTapNode[];
}

/** Minimal TipTap document root used for persistence. */
export interface TipTapDocument {
  type: "doc";
  content: TipTapNode[];
}

/** Text resource model: stores both plain and TipTap representations. */
export interface TextResource extends ResourceBase {
  type: "text";
  /** Canonical plain-text representation used for exports and search. */
  plainText?: string;
  /** TipTap document used for editor persistence and rich editing. */
  tiptap?: TipTapDocument;
  /** Derived metrics for quick display. */
  wordCount?: number;
  charCount?: number;
  paragraphCount?: number;
}

/** Image resource model with common image metadata. */
export interface ImageResource extends ResourceBase {
  type: "image";
  /** Stored binary filename relative to the resource directory (e.g. 'original.png'). */
  file?: string;
  /** Optional image width in pixels. */
  width?: number;
  /** Optional image height in pixels. */
  height?: number;
  /** EXIF and related metadata extracted from the image. */
  exif?: Record<string, MetadataValue>;
}

/** Audio resource model with common audio metadata. */
export interface AudioResource extends ResourceBase {
  type: "audio";
  /** Stored binary filename relative to the resource directory (e.g. 'original.mp3'). */
  file?: string;
  /** Duration in seconds if available. */
  durationSeconds?: number;
  /** File format (e.g., 'mp3', 'wav'). */
  format?: string;
}

/** Revision metadata describing stored copies for a resource. */
export interface Revision {
  /** Revision UUID. */
  id: UUID;
  /** Parent resource UUID. */
  resourceId: UUID;
  /** Monotonic version number for the resource's revision history. */
  versionNumber: number;
  /** Creation timestamp for the revision (ISO 8601). */
  createdAt: string;
  /** Optional timestamp when the revision was saved to disk. */
  savedAt?: string;
  /** Optional author identifier or display name. */
  author?: string;
  /** Filesystem path to the stored revision file. */
  filePath: string;
  /** True when this revision is the canonical/current revision for the resource. */
  isCanonical: boolean;
  /** Optional arbitrary metadata persisted alongside the revision (e.g., preserve flags). */
  metadata?: Record<string, unknown>;
}

/** Discriminated union of all concrete resource types, keyed by `type`. */
export type AnyResource = TextResource | ImageResource | AudioResource | Folder;
