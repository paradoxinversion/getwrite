/**
 * Domain types for placeholder UI data.
 * Keep these minimal and strongly typed to guide component props.
 */

export type ResourceType = "document" | "scene" | "note" | "folder";

export interface Metadata {
    status?: "draft" | "in-review" | "published";
    characters?: string[];
    locations?: string[];
    items?: string[];
    pov?: string | null;
    wordCount?: number;
    notes?: string;
}

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

export interface Project {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    resources: Resource[];
}

export type ViewName = "edit" | "organizer" | "data" | "diff" | "timeline";
