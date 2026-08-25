import type {
  ResourceBase,
  TextResource,
  MetadataValue,
  MetadataFieldType,
  ProjectConfig,
  ResourceRef,
} from "./types";
import type { BacklinkIndex } from "./backlinks";

/** Where the evaluator reads an intrinsic field's value from. */
export type IntrinsicFieldSource =
  | "resource"
  | "sidecar"
  | "config"
  | "backlinks"
  | "mentions";

/**
 * Runtime context passed to every intrinsic field's `read` accessor.
 * Contains everything beyond the resource record itself that an intrinsic
 * might need: the project config (for tags and statuses), the persisted
 * backlink index (for linkedFrom / linksTo), and the persisted mention index
 * — inverted to entityId → resourceIds (see `invertMentionIndex` in
 * `mention-index.ts`), so `mentions` can look up which entities mention a
 * given resource (FR-11).
 */
export interface QueryContext {
  config: ProjectConfig;
  backlinks: BacklinkIndex;
  mentions: Record<string, string[]>;
}

/** A single synthetic field entry in the intrinsic field registry. */
export interface IntrinsicField {
  /** Unique field key — matches the names used in query AST predicates. */
  key: string;
  /** Human-readable label shown in the chip UI field picker. */
  label: string;
  /** Field type — determines operator vocabulary and value picker. */
  type: MetadataFieldType;
  /** Allowed values for `select` / `multiselect` intrinsics (fixed enums). */
  options?: string[];
  /** Where the field's value is sourced from at evaluation time. */
  source: IntrinsicFieldSource;
  /**
   * Synchronous accessor that returns the field value for a given resource
   * and query context. Returns `null` when the field has no value for this
   * resource (equivalent to "is empty").
   */
  read(resource: ResourceBase, context: QueryContext): MetadataValue;
}

/**
 * Registry of all synthetic intrinsic fields available at query time.
 * These fields are not declared in `metadataSchema`; the evaluator merges
 * them in alongside declared fields when building the queryable field universe.
 *
 * Canonical source: decisions/04-chip-internals.md § Intrinsic fields and
 * decisions/05-schema-layer.md § Intrinsic queryable fields.
 */
export const INTRINSIC_FIELDS: readonly IntrinsicField[] = [
  {
    key: "type",
    label: "Type",
    type: "select",
    options: ["text", "image", "audio", "folder"],
    source: "resource",
    read: (resource) => resource.type,
  },
  {
    key: "folderId",
    label: "Folder",
    type: "resource-ref",
    source: "resource",
    read: (resource) =>
      resource.folderId != null
        ? ({ id: resource.folderId, name: "" } satisfies ResourceRef)
        : null,
  },
  {
    key: "wordCount",
    label: "Word Count",
    type: "number",
    source: "resource",
    read: (resource) =>
      resource.type === "text"
        ? ((resource as TextResource).wordCount ?? null)
        : null,
  },
  {
    key: "charCount",
    label: "Character Count",
    type: "number",
    source: "resource",
    read: (resource) =>
      resource.type === "text"
        ? ((resource as TextResource).charCount ?? null)
        : null,
  },
  {
    key: "createdAt",
    label: "Created At",
    type: "date",
    source: "resource",
    read: (resource) => resource.createdAt,
  },
  {
    key: "updatedAt",
    label: "Updated At",
    type: "date",
    source: "resource",
    read: (resource) => resource.updatedAt ?? null,
  },
  {
    key: "statuses",
    label: "Statuses",
    type: "multiselect",
    source: "resource",
    read: (resource) => resource.statuses ?? [],
  },
  {
    key: "tags",
    label: "Tags",
    type: "multi-resource-ref",
    source: "config",
    read: (resource, context) => {
      const tagIds = context.config.tagAssignments?.[resource.id] ?? [];
      const tags = context.config.tags ?? [];
      return tagIds.map((tagId): ResourceRef => {
        const tag = tags.find((t) => t.id === tagId);
        return { id: tagId, name: tag?.name ?? "" };
      });
    },
  },
  {
    // Resources whose prose or metadata-ref values point TO this resource.
    // The BacklinkIndex stores sourceId → [targetIds], so we invert the
    // lookup: find every sourceId whose target list contains resource.id.
    key: "linkedFrom",
    label: "Linked From",
    type: "multi-resource-ref",
    source: "backlinks",
    read: (resource, context) =>
      Object.entries(context.backlinks)
        .filter(([, targets]) => targets.includes(resource.id))
        .map(([sourceId]): ResourceRef => ({ id: sourceId, name: "" })),
  },
  {
    // Resources that this resource links to (forward links).
    // The BacklinkIndex stores sourceId → [targetIds], so this is a
    // direct lookup.
    key: "linksTo",
    label: "Links To",
    type: "multi-resource-ref",
    source: "backlinks",
    read: (resource, context) => {
      const targets = context.backlinks[resource.id] ?? [];
      return targets.map((id): ResourceRef => ({ id, name: "" }));
    },
  },
  {
    // Entities that mention this resource in their detected prose mentions
    // (FR-11). `context.mentions` is keyed by entityId → [resourceIds], so
    // we invert the lookup: find every entityId whose resource list contains
    // this resource. This is the shape a smart folder needs for US-3
    // ("scenes mentioning Aria"): filtering `mentions contains <entityId>`
    // selects every resource that entity mentions.
    key: "mentions",
    label: "Mentions",
    type: "multi-resource-ref",
    source: "mentions",
    read: (resource, context) =>
      Object.entries(context.mentions)
        .filter(([, resourceIds]) => resourceIds.includes(resource.id))
        .map(([entityId]): ResourceRef => ({ id: entityId, name: "" })),
  },
];

/** Look up an intrinsic field by key. Returns `undefined` for unknown keys. */
export function getIntrinsicField(key: string): IntrinsicField | undefined {
  return INTRINSIC_FIELDS.find((f) => f.key === key);
}

/** Set of all intrinsic field keys for O(1) membership tests. */
export const INTRINSIC_FIELD_KEYS: ReadonlySet<string> = new Set(
  INTRINSIC_FIELDS.map((f) => f.key),
);
