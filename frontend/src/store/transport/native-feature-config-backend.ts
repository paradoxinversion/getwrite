// Last Updated: 2026-07-25

/**
 * @module store/transport/native-feature-config-backend
 *
 * **ADR-021 Phase 1 (Task 5).** The in-process implementation of
 * {@link FeatureConfigTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/project/features')`, it invokes the *same* transport-agnostic
 * `updateFeatureConfig` helper the HTTP route uses
 * (`lib/models/project-features.ts`). There is no server and no HTTP — the
 * exact same business logic runs directly in the WebView process.
 *
 * This is the smallest of the Phase 1 native backends: `updateFeatureConfig`
 * is already the transport-agnostic core (no dispatch-core layer to lift, as
 * with revision/query/metadata-schema), so this module's only job is
 * `projectId -> projectRoot` resolution plus ambient `StorageContext`
 * binding.
 *
 * This module is imported *only* on the native path (see
 * `feature-config-transport-service.ts`'s dynamic import), because it pulls
 * in the server-side project-features helper and storage layer, which must
 * never enter the web client bundle.
 *
 * **Storage context binding.** Mirrors `native-metadata-schema-backend.ts` /
 * `native-revision-backend.ts` / `native-query-backend.ts`: `deps.fs` is a
 * test-injection seam — when supplied, this module binds a fresh, one-off
 * {@link runInStorageContext} scope for that call. In production, `deps.fs`
 * is omitted and the ambient default {@link StorageContext} installed once
 * by `native-bootstrap.ts` (FR5) is used instead, with no per-operation
 * rebinding. `nativeFilesystem()` remains a defensive fallback for the
 * (unsupported) case where no bootstrap has run yet.
 */
import type { CapacitorFilesystemLike } from "../../lib/models/capacitor-filesystem";
import { createRealCapacitorFilesystem } from "../../lib/models/capacitor-filesystem-real";
import { capacitorFsAdapter } from "../../lib/models/capacitorFsAdapter";
import {
  getStorageContext,
  runInStorageContext,
} from "../../lib/models/storage-context";
import { resolveProjectRoot } from "../../lib/models/project-root-resolver";
import { updateFeatureConfig } from "../../lib/models/project-features";
import type {
  FeatureConfigResult,
  FeatureConfigUpdate,
  FeatureConfigTransport,
} from "../feature-config-transport-service";

/** Injectable dependencies — omitted in production, supplied by tests. */
export interface NativeFeatureConfigDeps {
  /** The device filesystem. Production: the real `@capacitor/filesystem` plugin. */
  fs?: CapacitorFilesystemLike;
  /** On-device projects root (the native analogue of `GETWRITE_PROJECTS_DIR`). */
  projectsDir?: string;
}

/**
 * Resolves the real Capacitor Filesystem plugin, scoped to the default
 * `Directory.Data` root. This is the production path: the native runtime
 * never supplies `deps.fs`, so every real device call flows through here.
 */
function nativeFilesystem(): CapacitorFilesystemLike {
  return createRealCapacitorFilesystem();
}

/**
 * Resolves `projectId` to its on-disk project root via the shared plain
 * resolver, throwing (rather than returning a `Response`, which the HTTP
 * route does) when `projectId` is not a well-formed UUID.
 */
function resolveProjectRootOrThrow(projectId: string): string {
  const projectRoot = resolveProjectRoot(projectId);
  if (!projectRoot) {
    throw new Error(`Invalid projectId: ${projectId}`);
  }
  return projectRoot;
}

/**
 * Builds the in-process feature-config transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeFeatureConfigTransport(
  deps: NativeFeatureConfigDeps = {},
): FeatureConfigTransport {
  const projectsDir = deps.projectsDir ?? "/projects";

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (deps.fs) {
      // Explicit test injection: bind a fresh, one-off context for this
      // call only, matching how the revision/query/metadata-schema spike
      // tests exercise this transport standalone, without any global native
      // bootstrap having run.
      const adapter = capacitorFsAdapter(deps.fs);
      return runInStorageContext({ tenantRoot: projectsDir, adapter }, fn);
    }

    if (getStorageContext()) {
      // Production path: an ambient StorageContext is already active —
      // either the process-wide default installed once at native app
      // startup (native-bootstrap.ts, FR5), or an explicit scope some
      // caller already established. Resolve directly; do not rebind.
      return fn();
    }

    // Defensive fallback: no ambient context yet. Bind a one-off context
    // against the real plugin so the call still resolves against the real
    // device filesystem instead of silently falling through to io.ts's
    // Node `fs/promises` default, which is meaningless on Android.
    const adapter = capacitorFsAdapter(nativeFilesystem());
    return runInStorageContext({ tenantRoot: projectsDir, adapter }, fn);
  }

  return {
    async updateFeatureConfig(
      projectId: string,
      update: FeatureConfigUpdate,
    ): Promise<FeatureConfigResult> {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(projectId);
        return updateFeatureConfig(projectRoot, update);
      });
    },
  };
}
