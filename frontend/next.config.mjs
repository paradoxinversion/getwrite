import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, "package.json"), "utf8"),
);

// ADR-021 Phase 2: a native build target produces a STATIC EXPORT
// (`output: "export"` -> an `out/` dir of assets Capacitor's webDir can serve),
// instead of the standalone Node server bundle web/desktop use. Gated behind an
// opt-in env var so web/desktop builds are completely unaffected when unset.
const isNativeTarget = process.env.GETWRITE_BUILD_TARGET === "native";

// The agentic QA harness (`cli/src/qa/server.ts`) spawns this dev server as a
// disposable child and needs it isolated from the checkout's shared build
// state: a stale or corrupt `frontend/.next` made a QA run's `/` serve a 404
// indefinitely, and conversely a QA run rewriting that cache disturbed
// ordinary development and the harness's own test suite. `next dev` has no
// `--dist-dir` flag, so the only channel for a per-run build directory is the
// config — hence these env vars, which are unset (and therefore inert) for
// every normal `dev`/`build` invocation.
//
// `distDir` is resolved by Next as `join(<project dir>, distDir)`, so an
// absolute path handed in via the env var has to be made relative to this
// file's directory first.
const qaDistDir = process.env.GETWRITE_QA_DIST_DIR;
const resolvedQaDistDir =
  qaDistDir === undefined || qaDistDir.length === 0
    ? undefined
    : isAbsolute(qaDistDir)
      ? relative(__dirname, qaDistDir)
      : qaDistDir;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: isNativeTarget ? "export" : "standalone",
  // ADR-021 Phase 2: when `output: "export"` is paired with a non-default
  // `distDir`, Next treats that custom `distDir` as the export output
  // directory itself (see `hasCustomExportOutput` in Next's build source) —
  // internally it still builds into `.next` under the project root, but
  // writes the final static export to `path.join(<project root>, distDir)`.
  // `frontend/scripts/build-native-static.mjs` always runs `next build` with
  // `cwd` set to its generated build directory (`frontend/.native-build/`),
  // so `"../out"` here resolves to `frontend/out/` — landing the export
  // directly where `android/capacitor.config.ts`'s `webDir` expects it,
  // with no separate copy-back step. This branch is unreachable for
  // web/desktop (`isNativeTarget` is false), so `distDir` stays unset
  // there and standalone builds are unaffected.
  ...(isNativeTarget
    ? { distDir: "../out" }
    : resolvedQaDistDir === undefined
      ? {}
      : { distDir: resolvedQaDistDir }),
  // The app doesn't use next/image, so disable image optimization. This stops
  // Next from ever loading the native `sharp` binary at runtime — it's required
  // only lazily by the image optimizer, which is now never invoked. That matters
  // for the x64 desktop build: the standalone bundle still carries a single
  // arch-specific sharp binary (darwin-arm64, since it's built on Apple Silicon),
  // and disabling optimization guarantees that wrong-arch binary is never loaded
  // on Intel. (Next pulls sharp into its global server trace regardless of config,
  // so it can't be excluded from the bundle here — but it's now dead, unused weight.)
  images: { unoptimized: true },
  // Inlined into the client bundle at build time so the UI can display the
  // running version. Desktop and web builds share this synced version number.
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // ADR-021 Phase 0: search-transport.ts dynamically imports
  // native-search-backend.ts only when NEXT_PUBLIC_GETWRITE_RUNTIME ===
  // "native" (never true for hosted/desktop builds), but that guard is a
  // runtime env comparison, not a compile-time literal Turbopack can prove
  // false before resolving the import() target. Turbopack still traces (and
  // fails on) the real module's transitive node:fs/node:path/node:async_hooks
  // imports in the client/SSR chunking context regardless of reachability.
  // This alias substitutes a node:*-free stub with the same export shape at
  // the exact specifier the dynamic import uses, so the real native backend
  // never enters the web/desktop build's module graph — restoring the
  // dynamic-import discipline the transport-collapse spike established.
  // Tests and `tsc` are unaffected: this is a Turbopack-only resolution
  // rule, not a TypeScript path mapping.
  // ADR-021 Phase 2 FIX: these web-stub aliases must apply ONLY to the
  // web/desktop build. In the NATIVE export (`isNativeTarget`) the app IS the
  // Capacitor client and MUST bundle the REAL native backends — aliasing them to
  // their web-stubs there makes every native transport hit its
  // "should never be invoked" guard on-device. So the stub map is gated below.
  turbopack: {
    resolveAlias: isNativeTarget
      ? {
          // ADR-021 Phase 2 FIX: the native export bundles the REAL model layer,
          // which imports node builtins a WebView has no equivalent for. Alias
          // each to a browser-safe shim (the same set the Phase 0 esbuild harness
          // proved makes the model layer run on-device): a POSIX `path`, an
          // `AsyncLocalStorage` whose getStore() returns undefined (native uses
          // the module-scoped default StorageContext), and throwing `fs`/
          // `fs/promises` stubs (native I/O goes through capacitorFsAdapter, never
          // node:fs). Buffer is provided as a global by NativeBootstrap.
          "node:path": "./src/native-shims/path.mjs",
          path: "./src/native-shims/path.mjs",
          "node:async_hooks": "./src/native-shims/async-hooks.mjs",
          async_hooks: "./src/native-shims/async-hooks.mjs",
          "node:fs/promises": "./src/native-shims/fs-promises.mjs",
          "fs/promises": "./src/native-shims/fs-promises.mjs",
          "node:fs": "./src/native-shims/fs.mjs",
          fs: "./src/native-shims/fs.mjs",
        }
      : {
          "./native-search-backend":
            "./src/store/transport/native-search-backend.web-stub",
          // revision-transport-service.ts lives in src/store/ (not
          // src/store/transport/, unlike search-transport.ts), so its dynamic
          // import's literal specifier is "./transport/native-revision-backend"
          // — the alias key below must match that exact request string.
          "./transport/native-revision-backend":
            "./src/store/transport/native-revision-backend.web-stub",
          // query-transport-service.ts lives in src/store/ as well, so its
          // dynamic import's literal specifier is
          // "./transport/native-query-backend" — same rule as above.
          "./transport/native-query-backend":
            "./src/store/transport/native-query-backend.web-stub",
          // metadata-schema-transport-service.ts lives in src/store/ as well, so
          // its dynamic import's literal specifier is
          // "./transport/native-metadata-schema-backend" — same rule as above.
          "./transport/native-metadata-schema-backend":
            "./src/store/transport/native-metadata-schema-backend.web-stub",
          // feature-config-transport-service.ts lives in src/store/ as well, so
          // its dynamic import's literal specifier is
          // "./transport/native-feature-config-backend" — same rule as above.
          "./transport/native-feature-config-backend":
            "./src/store/transport/native-feature-config-backend.web-stub",
          // ADR-021 Phase 2: components/native/NativeBootstrap.tsx dynamically
          // imports native-bootstrap.ts (root-layout call site for
          // bootstrapNativeStorageContext(), FR6) only when
          // NEXT_PUBLIC_GETWRITE_RUNTIME === "native" — same rule as above, keyed
          // on that call site's exact literal specifier.
          "../../src/lib/models/native-bootstrap":
            "./src/lib/models/native-bootstrap.web-stub",
          // ADR-021 Phase 2 (Task 2): project-actions-controller.ts lives in
          // src/store/ (like revision-transport-service.ts), so its dynamic
          // import's literal specifier is
          // "./transport/native-project-actions-backend" — same rule as above.
          "./transport/native-project-actions-backend":
            "./src/store/transport/native-project-actions-backend.web-stub",
          // ADR-021 Phase 2 (Task 2): lib/api/projects.ts lives in src/lib/api/
          // (not src/store/, unlike every other transport service so far), so
          // its dynamic import's literal specifier is
          // "../../store/transport/native-project-backend" — the alias key
          // below must match that exact relative request string, not the
          // "./transport/..." shape the src/store/-rooted services use.
          "../../store/transport/native-project-backend":
            "./src/store/transport/native-project-backend.web-stub",
          // ADR-021 Phase 2 (Task 3): lib/api/resources.ts lives in
          // src/lib/api/ (like lib/api/projects.ts), so its dynamic import's
          // literal specifier is "../../store/transport/native-resource-backend"
          // — same rule as the projects backend above.
          "../../store/transport/native-resource-backend":
            "./src/store/transport/native-resource-backend.web-stub",
          // ADR-021 Phase 2 (Task 3): lib/api/resource-excerpts.ts also lives in
          // src/lib/api/, so its dynamic import's literal specifier is
          // "../../store/transport/native-resource-excerpts-backend" — same
          // rule as above.
          "../../store/transport/native-resource-excerpts-backend":
            "./src/store/transport/native-resource-excerpts-backend.web-stub",
          // ADR-021 Phase 2 (Task 4): lib/api/tags.ts also lives in
          // src/lib/api/, so its dynamic import's literal specifier is
          // "../../store/transport/native-tags-backend" — same rule as above.
          "../../store/transport/native-tags-backend":
            "./src/store/transport/native-tags-backend.web-stub",
          // ADR-021 Phase 2 (Task 4): lib/api/preferences.ts also lives in
          // src/lib/api/, so its dynamic import's literal specifier is
          // "../../store/transport/native-preferences-backend" — same rule as
          // above.
          "../../store/transport/native-preferences-backend":
            "./src/store/transport/native-preferences-backend.web-stub",
          // ADR-021 Phase 2 (Task 4): lib/api/editor-config.ts also lives in
          // src/lib/api/, so its dynamic import's literal specifier is
          // "../../store/transport/native-editor-config-backend" — same rule as
          // above.
          "../../store/transport/native-editor-config-backend":
            "./src/store/transport/native-editor-config-backend.web-stub",
          // ADR-021 Phase 2 (Task 5): lib/api/project-types.ts also lives in
          // src/lib/api/, so its dynamic import's literal specifier is
          // "../../store/transport/native-project-types-backend" — same rule as
          // above.
          "../../store/transport/native-project-types-backend":
            "./src/store/transport/native-project-types-backend.web-stub",
          // ADR-021 Phase 2 (Task 5): lib/api/compile.ts also lives in
          // src/lib/api/, so its dynamic import's literal specifier is
          // "../../store/transport/native-compile-backend" — same rule as
          // above.
          "../../store/transport/native-compile-backend":
            "./src/store/transport/native-compile-backend.web-stub",
          // ADR-021 Phase 2 (Task 5): lib/api/export.ts also lives in
          // src/lib/api/, so its dynamic import's literal specifier is
          // "../../store/transport/native-export-backend" — same rule as above.
          "../../store/transport/native-export-backend":
            "./src/store/transport/native-export-backend.web-stub",
          // ADR-021 Phase 2 (Task 11): lib/api/mentions.ts also lives in
          // src/lib/api/, so its dynamic import's literal specifier is
          // "../../store/transport/native-mentions-backend" — same rule as
          // above.
          "../../store/transport/native-mentions-backend":
            "./src/store/transport/native-mentions-backend.web-stub",
        },
  },
};

export default nextConfig;
