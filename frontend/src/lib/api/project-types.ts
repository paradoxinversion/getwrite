import type { ProjectTypeDefinition } from "../../types/project-types";
import { createTransport } from "../../store/transport/create-transport";

// ---------------------------------------------------------------------------
// Transport collapse (ADR-021 Phase 2, Task 5)
//
// One ProjectTypesTransport contract with two implementations selected by
// the build-time runtime, mirroring lib/api/projects.ts:
//
// - Web/hosted/desktop -> httpProjectTypesTransport, which carries the
//   original `fetch(...)` call verbatim.
// - Native (Capacitor) -> an in-process backend
//   (`../../store/transport/native-project-types-backend`), dynamically
//   imported only when `runtime === "native"`, reading the static,
//   build-time-imported template registry
//   (`../models/project-types-static.ts`) instead of HTTP — this transport
//   needs no storage-context binding at all, since the registry is pure
//   static data with zero filesystem access.
//
// `createTransport` centralizes the runtime branch and dispatch (see
// `../../store/transport/create-transport`).
// ---------------------------------------------------------------------------

/**
 * The project-types-route-backed operation both platforms implement. Shared
 * with `../../store/transport/native-project-types-backend`, which imports
 * this type rather than duplicating it.
 */
export interface ProjectTypesTransport {
  /** Lists every available project-type template. */
  list(): Promise<ProjectTypeDefinition[]>;
}

/**
 * HTTP transport — the hosted/desktop path. The method body below is the
 * original `listProjectTypes`'s `fetch` call verbatim; preserving it exactly
 * is what keeps the server build unchanged.
 */
export const httpProjectTypesTransport: ProjectTypesTransport = {
  async list() {
    const response = await fetch("/api/project-types");
    if (!response.ok) {
      throw new Error(`Failed to load project types (${response.status})`);
    }
    return (await response.json()) as ProjectTypeDefinition[];
  },
};

/**
 * Resolves the transport for the active runtime. On native, the in-process
 * backend is imported lazily so it forms its own chunk and never enters the
 * web bundle's module graph. The thunk carries the literal
 * `import("../../store/transport/native-project-types-backend")` specifier
 * so Turbopack's `resolveAlias` (`next.config.mjs`) can substitute a
 * `node:*`-free web-stub for it at build time.
 */
export const resolveProjectTypesTransport: () => Promise<ProjectTypesTransport> =
  createTransport(httpProjectTypesTransport, () =>
    import("../../store/transport/native-project-types-backend").then(
      ({ createNativeProjectTypesTransport }) =>
        createNativeProjectTypesTransport(),
    ),
  );

export async function listProjectTypes(): Promise<ProjectTypeDefinition[]> {
  const transport = await resolveProjectTypesTransport();
  return transport.list();
}
