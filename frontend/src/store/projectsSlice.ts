import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type ProjectRef = {
    id: string;
    name: string;
} | null;

export interface ProjectsState {
    selectedProject: ProjectRef;
}

const initialState: ProjectsState = {
    selectedProject: null,
};

const projectsSlice = createSlice({
    name: "projects",
    initialState,
    reducers: {
        setSelectedProject(state, action: PayloadAction<ProjectRef>) {
            state.selectedProject = action.payload;
        },
    },
});

export const { setSelectedProject } = projectsSlice.actions;
export default projectsSlice.reducer;
