/**
 * @module preload
 *
 * The desktop bridge exposed to the renderer.
 *
 * This file was deliberately empty until the workspace-location setting needed
 * a native directory picker, which the web app cannot open for itself. It stays
 * as small as that requirement allows: three named channels, no general-purpose
 * `invoke` passthrough, and nothing that touches the filesystem directly. A
 * bridge that can be asked to do anything is a bridge that can be asked to do
 * something regrettable by whatever ends up running in the renderer.
 *
 * `window.getwriteDesktop` existing is also how the UI knows it is running in
 * the desktop app at all — the previous signal, `GETWRITE_DESKTOP`, is
 * server-side only and invisible to a client component.
 */
import { contextBridge, ipcRenderer } from "electron";

/** What changing the workspace location can result in. */
export interface WorkspaceChangeResult {
  /** Whether the new location was accepted and recorded. */
  ok: boolean;
  /** The chosen directory, when one was accepted. */
  projectsDir?: string;
  /** Why the choice was refused, in words meant for the user. */
  message?: string;
  /** True when the user closed the picker without choosing. */
  cancelled?: boolean;
}

/** The surface the renderer may call. */
export interface GetWriteDesktopBridge {
  /** Returns where projects are currently stored. */
  getWorkspaceDir(): Promise<string>;
  /** Opens a native folder picker and records the choice. */
  chooseWorkspaceDir(): Promise<WorkspaceChangeResult>;
  /** Restarts the app so the change takes effect. */
  restart(): Promise<void>;
}

const bridge: GetWriteDesktopBridge = {
  getWorkspaceDir: () => ipcRenderer.invoke("getwrite:workspace-dir"),
  chooseWorkspaceDir: () => ipcRenderer.invoke("getwrite:choose-workspace-dir"),
  restart: () => ipcRenderer.invoke("getwrite:restart"),
};

contextBridge.exposeInMainWorld("getwriteDesktop", bridge);
