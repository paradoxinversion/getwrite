import type {
    Project as ProjectType,
    Folder as FolderType,
    TextResource,
    ResourceType,
    MetadataValue,
} from "./types";

/**
 * Minimal UI Resource shape expected by legacy UI components (adapter output).
 * We keep this local to the adapter to avoid changing legacy UI types.
 */
export interface UIResource {
    id: string;
    projectId: string;
    parentId?: string | null;
    title: string;
    type: string;
    content?: string;
    createdAt: string;
    updatedAt?: string;
    metadata?: Record<string, MetadataValue>;
    _orderIndex?: number;
}

export interface FolderWithResources extends FolderType {
    resources: UIResource[];
}

/**
 * Build a UI-friendly project view from canonical `project`, `folders`, and
 * `resources` produced by the scaffolder. This adapter sorts folders by
 * `orderIndex` and resources per-folder by `metadata.orderIndex` (fallback to
 * creation order).
 */
export function buildProjectView(options: {
    project: ProjectType;
    folders: FolderType[];
    resources: TextResource[];
}) {
    const { project, folders, resources } = options;

    const folderMap = new Map<string, FolderWithResources>();
    for (const f of folders) {
        folderMap.set(f.id, { ...f, resources: [] });
    }

    // Map resources into UI shape and attach to folders
    resources.forEach((r, idx) => {
        const order =
            r.metadata && typeof (r.metadata as any).orderIndex === "number"
                ? (r.metadata as any).orderIndex
                : idx;
        const ui: UIResource = {
            id: r.id,
            projectId: project.id,
            parentId: undefined,
            title: r.name,
            type: r.type as string,
            content: (r as any).plainText ?? undefined,
            createdAt: r.createdAt,
            updatedAt: (r as any).updatedAt,
            metadata: r.metadata as Record<string, MetadataValue> | undefined,
            _orderIndex: order,
        };

        const target = folderMap.get(r.folderId ?? "") ?? null;
        if (target) target.resources.push(ui);
    });

    // Sort folders and their resources by orderIndex
    const sortedFolders = Array.from(folderMap.values()).sort(
        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
    );

    for (const f of sortedFolders) {
        f.resources.sort((x, y) => (x._orderIndex ?? 0) - (y._orderIndex ?? 0));
    }

    // Build a flat list that includes folder entries (type: 'folder') followed by
    // their child resources. This mirrors the legacy placeholder shape expected
    // by `ResourceTree` and other UI components.
    const flatResources: UIResource[] = [];
    for (const f of sortedFolders) {
        const folderEntry: UIResource = {
            id: f.id,
            projectId: project.id,
            parentId: undefined,
            title: f.name,
            type: "folder",
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
            metadata: {},
            _orderIndex: f.orderIndex ?? 0,
        };
        flatResources.push(folderEntry);
        flatResources.push(...f.resources);
    }

    return {
        project,
        folders: sortedFolders,
        resources: flatResources,
    } as {
        project: ProjectType;
        folders: FolderWithResources[];
        resources: UIResource[];
    };
}

export default { buildProjectView };
