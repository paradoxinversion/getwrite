import { configureStore } from "@reduxjs/toolkit";
import projectsReducer from "./projectsSlice";
import revisionsReducer from "./revisionsSlice";
import resourcesReducer from "./resourcesSlice";
import editorConfigReducer from "./editorConfigSlice";
import searchReducer from "./searchSlice";
import queryReducer from "./querySlice";
import cryptoReducer from "./cryptoSlice";
import entityAliasTableReducer from "./entityAliasTableSlice";
/**
 * @deprecated This is a temporary store instance for development and testing. In production, use makeStore to create a new store instance for each client.
 */
export const store = configureStore({
  reducer: {
    projects: projectsReducer,
    resources: resourcesReducer,
    revisions: revisionsReducer,
    editorConfig: editorConfigReducer,
    search: searchReducer,
    queries: queryReducer,
    crypto: cryptoReducer,
    entityAliasTable: entityAliasTableReducer,
  },
});

export const makeStore = () => {
  return configureStore({
    reducer: {
      projects: projectsReducer,
      resources: resourcesReducer,
      revisions: revisionsReducer,
      editorConfig: editorConfigReducer,
      search: searchReducer,
      queries: queryReducer,
      crypto: cryptoReducer,
      entityAliasTable: entityAliasTableReducer,
    },
  });
};
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export default store;
