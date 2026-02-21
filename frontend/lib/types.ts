/**
 * Domain types for placeholder UI data.
 * Keep these minimal and strongly typed to guide component props.
 */

/** Allowed resource kinds used across the UI (drives icon + behavior). */
export type ResourceType = "document" | "scene" | "note" | "folder";

/**
 * Lightweight metadata shape used for UI-only displays.
 * Values are optional because different resource types show different fields.
 */
export interface Metadata {
    status?: "draft" | "in-review" | "published";
    characters?: string[];
    locations?: string[];
    items?: string[];
    pov?: string | null;
    wordCount?: number;
    notes?: string;
}

/**
 * Represents a UI placeholder Resource.
 * - `parentId` supports simple trees rendered by `ResourceTree`.
 * - `metadata` is a UI-focused subset (no persistence semantics).
 */
export interface Resource {
    id: string;
    projectId: string;
    parentId?: string;
    title: string;
    type: ResourceType;
    content?: string;
    createdAt: string;
    updatedAt: string;
    metadata: Metadata;
}

/**
 * @deprecated Use `Project` from `frontend/src/lib/models/types.ts` instead.
 * Project container used in placeholder data with a small `resources` array.
 */
export interface Project {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    resources: Resource[];
}

/** Names of work-area views (used by view switcher and test fixtures). */
export type ViewName = "edit" | "organizer" | "data" | "diff" | "timeline";
