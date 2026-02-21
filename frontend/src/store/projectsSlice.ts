import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

type Folder = { id: string; slug?: string; name?: string; orderIndex?: number };
type ResourceMeta = { id: string; metadata?: Record<string, unknown> };

export interface StoredProject {
    id: string;
    name?: string;
    folders?: Folder[];
    resources?: ResourceMeta[];
}

export interface ProjectsState {
    selectedProjectId: string | null;
    projects: Record<string, StoredProject>;
}

const initialState: ProjectsState = {
    selectedProjectId: null,
    projects: {},
};

/**
 * Persist reorder by calling the backend API and, on success, update local store
 * with the new orderIndex values for folders and resources.
 */
export const persistReorder = createAsyncThunk(
    "projects/persistReorder",
    async (payload: {
        projectId: string;
        folderOrder: Array<{ id: string; orderIndex: number }>;
        resourceOrder: Array<{ id: string; orderIndex: number }>;
    }) => {
        const { projectId, folderOrder, resourceOrder } = payload;
        await fetch(`/api/projects/${projectId}/reorder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderOrder, resourceOrder }),
        });
        return { projectId, folderOrder, resourceOrder };
    },
);

const projectsSlice = createSlice({
    name: "projects",
    initialState,
    reducers: {
        setProject(state, action: PayloadAction<StoredProject>) {
            state.projects[action.payload.id] = action.payload;
        },
        setSelectedProjectId(state, action: PayloadAction<string | null>) {
            state.selectedProjectId = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(persistReorder.fulfilled, (state, action) => {
            const { projectId, folderOrder, resourceOrder } = action.payload;
            const proj = state.projects[projectId];
            if (!proj) return;

            // merge folder orderIndex
            if (proj.folders) {
                const map = new Map(
                    folderOrder.map((f) => [f.id, f.orderIndex]),
                );
                proj.folders = proj.folders.map((f) => ({
                    ...f,
                    orderIndex: map.has(f.id)
                        ? (map.get(f.id) as number)
                        : f.orderIndex,
                }));
            }

            // merge resource orderIndex into metadata
            if (proj.resources) {
                const rmap = new Map(
                    resourceOrder.map((r) => [r.id, r.orderIndex]),
                );
                proj.resources = proj.resources.map((r) => ({
                    ...r,
                    metadata: {
                        ...(r.metadata ?? {}),
                        orderIndex: rmap.has(r.id)
                            ? (rmap.get(r.id) as number)
                            : (r.metadata?.orderIndex ?? undefined),
                    },
                }));
            }
        });
    },
});

export const { setProject, setSelectedProjectId } = projectsSlice.actions;
export default projectsSlice.reducer;
