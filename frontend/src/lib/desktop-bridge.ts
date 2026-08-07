// Last Updated: 2026-08-06

/**
 * @module desktop-bridge
 *
 * The renderer's view of the Electron desktop bridge.
 *
 * `GETWRITE_DESKTOP` marks the desktop build, but it is a server-side
 * environment variable and so invisible to a client component. The presence of
 * `window.getwriteDesktop` is the client-visible signal, and it is exact: the
 * object exists only because `electron/src/preload.ts` put it there.
 *
 * Everything here degrades to `null`/no-op on web and native, so a caller can
 * ask without first knowing where it is running.
 */

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

/** The surface `preload.ts` exposes. Mirrors its `GetWriteDesktopBridge`. */
export interface DesktopBridge {
  getWorkspaceDir(): Promise<string>;
  chooseWorkspaceDir(): Promise<WorkspaceChangeResult>;
  restart(): Promise<void>;
}

/**
 * Returns the desktop bridge, or `null` when not running in the desktop app.
 *
 * @returns The bridge, or `null` on web and native.
 */
export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as { getwriteDesktop?: DesktopBridge })
    .getwriteDesktop;
  // Duck-typed rather than merely truthy: a half-initialised bridge should read
  // as absent, so the UI hides the control instead of rendering a dead button.
  return candidate && typeof candidate.chooseWorkspaceDir === "function"
    ? candidate
    : null;
}

/**
 * Whether this is the Electron desktop app.
 *
 * @returns `true` when the desktop bridge is present.
 */
export function isDesktopApp(): boolean {
  return getDesktopBridge() !== null;
}
