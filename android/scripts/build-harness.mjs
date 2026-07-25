// ADR-021 Phase 0 — builds the on-device verification harness into a single,
// WebView-loadable IIFE bundle at `android/www/harness.bundle.js`.
//
// Why a dedicated tiny bundler instead of the frontend's Next build: the harness
// deliberately runs OUTSIDE the app UI (Phase 2 territory), as a self-contained
// page dropped into Capacitor's `webDir` (`www/`). It pulls the native seams
// (native-bootstrap + native-device-harness) and their transitive model/search
// graph into one file that runs in the WebView against the real
// @capacitor/filesystem plugin.
//
// Node built-ins the model layer imports don't exist in a WebView, so they are
// aliased to the POSIX/shim implementations under `harness/shims/`:
//   - node:path / path        -> a faithful POSIX path port (join/dirname/normalize/posix)
//   - node:async_hooks        -> AsyncLocalStorage whose getStore() returns undefined
//                                (native uses the module-scoped default context, Task 4)
//   - node:fs / fs            -> a throwing stub (never called on the native path)
//
// The build inlines NEXT_PUBLIC_GETWRITE_RUNTIME="native" so the transport seam
// dispatches in-process (no fetch) exactly as a real native build would.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const androidRoot = resolve(here, "..");
const shims = resolve(androidRoot, "harness", "shims");

const shimPath = (name) => resolve(shims, name);

await build({
  entryPoints: [resolve(androidRoot, "harness", "harness-entry.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: ["es2020"],
  outfile: resolve(androidRoot, "www", "harness.bundle.js"),
  sourcemap: true,
  logLevel: "info",
  // Statically inline the native runtime flag so resolveSearchTransport() picks
  // the in-process backend, and quiet framework dev-only process.env reads.
  define: {
    "process.env.NEXT_PUBLIC_GETWRITE_RUNTIME": '"native"',
    "process.env.NODE_ENV": '"production"',
  },
  // A minimal `process` so any stray `process.env.X` read returns undefined
  // rather than throwing a ReferenceError in the WebView.
  banner: {
    js: "globalThis.process = globalThis.process || { env: {} };",
  },
  alias: {
    "node:path": shimPath("path.mjs"),
    path: shimPath("path.mjs"),
    "node:async_hooks": shimPath("async_hooks.mjs"),
    async_hooks: shimPath("async_hooks.mjs"),
    "node:fs/promises": shimPath("fs-promises.mjs"),
    "fs/promises": shimPath("fs-promises.mjs"),
    "node:fs": shimPath("fs.mjs"),
    fs: shimPath("fs.mjs"),
  },
});

console.log(
  "[build-harness] wrote android/www/harness.bundle.js (+ .map). Run `pnpm --filter getwrite-android sync` after `cap add android` to copy it into the native project.",
);
