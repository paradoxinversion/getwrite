#!/usr/bin/env node
// ADR-021 Phase 2 (FR4, FR14) — clean, version-controlled native static
// export build.
//
// Produces `frontend/out/` (a directory of static assets Capacitor's
// `webDir` can serve, per `android/capacitor.config.ts`) by running
// `next build` with `output: "export"` against a *generated* app tree that
// excludes every surface that's dead or broken on native: `app/api/**` (no
// server to run route handlers against on-device) and the three hosted-auth
// pages (`app/login`, `app/reset-password`, `app/verify-email` — hosted auth
// never runs natively).
//
// This replaces a prior spike's stash/restore script (which temporarily
// MOVED those paths out of `frontend/app/` and back), which the spec (FR4)
// rejected as unsafe. This script is copy-forward only:
//
//   `frontend/app/` (the real source tree) is only ever READ. It is never
//   mutated, moved, renamed, or deleted from — verify this yourself after a
//   run with `git status` under `frontend/app/`.
//
// Mechanism: Next.js's `app` directory must live at `<project root>/app`
// (or `<project root>/src/app`) — there is no config knob to point it
// elsewhere. So this script builds a full *shadow project root* at
// `frontend/.native-build/`:
//
//   - `app/` in the shadow root is a real, physical recursive copy of
//     `frontend/app/`, with `app/api/`, `app/login/`, `app/reset-password/`,
//     and `app/verify-email/` removed from *that copy only*.
//   - A handful of small config files that `next build` can plausibly write
//     back to (`package.json`, `tsconfig.json`, `next.config.mjs`,
//     `next-env.d.ts`) are also physically copied, so any such write lands
//     in the shadow root, never in `frontend/`.
//   - Everything else at the top level of `frontend/` (`node_modules/`,
//     `src/`, `components/`, `styles/`, `public/` if present, `.browserslistrc`,
//     `postcss.config.mjs`, `tailwind.config.cjs`, etc.) is exposed via a
//     symlink into the shadow root — cheap, and safe, because `next build`
//     doesn't write into any of them.
//   - `.next/`, `out/`, and `.native-build/` itself are never symlinked or
//     copied in (they're build outputs / the shadow root itself).
//
// `next build` then runs with `cwd` set to the shadow root and
// `GETWRITE_BUILD_TARGET=native` + `NEXT_PUBLIC_GETWRITE_RUNTIME=native` in
// its environment. `next.config.mjs` responds to `GETWRITE_BUILD_TARGET`
// by setting `output: "export"` and a custom `distDir: "../out"`, which
// (per Next's `hasCustomExportOutput` handling) makes the static export land
// directly at `frontend/out/` — no separate copy-back step is needed.
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { cpSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureConfigLink } from "./ensure-config-link.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const buildDir = join(frontendRoot, ".native-build");
const outDir = join(frontendRoot, "out");
const appSrc = join(frontendRoot, "app");
const appDest = join(buildDir, "app");

// Excluded natively-dead app/ subtrees (FR4): API route handlers (no server
// on device) and the three hosted-auth pages (hosted auth never runs
// natively).
// Note: `project-types` is the standalone project-type *management* page — a
// server component that reads template JSON via node:fs at prerender time, which
// can't coexist with the client bundle's shimmed fs in a static export. It's
// excluded from the native export; the create-project flow does NOT need it (it
// lists types via the client transport → the static-import registry). Converting
// that page to a client-fetch for native parity is deferred follow-up work.
const EXCLUDED_APP_SUBPATHS = [
  "api",
  "login",
  "reset-password",
  "verify-email",
  "project-types",
];

// Never symlinked or copied into the shadow root: build outputs and the
// shadow root itself.
const SKIP_ENTIRELY = new Set([".next", "out", ".native-build"]);

// Physically copied (not symlinked) into the shadow root: `app/` (filtered,
// handled separately below) plus small config files `next build` could
// plausibly rewrite. Copying means any such write lands only in the shadow
// root, never back through a symlink into the real `frontend/` tree.
const COPY_INSTEAD_OF_SYMLINK = new Set([
  "app",
  "package.json",
  "tsconfig.json",
  "next.config.mjs",
  "next-env.d.ts",
]);

function log(message) {
  console.log(`[build-native-static] ${message}`);
}

function fail(message) {
  console.error(`[build-native-static] ERROR: ${message}`);
  process.exit(1);
}

function cleanPreviousBuild() {
  log("Cleaning previous build directory and export output...");
  rmSync(buildDir, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
}

function assembleShadowRoot() {
  log(`Assembling shadow build root at ${buildDir}...`);
  mkdirSync(buildDir, { recursive: true });

  const entries = readdirSync(frontendRoot, { withFileTypes: true });
  for (const entry of entries) {
    const { name } = entry;
    if (SKIP_ENTIRELY.has(name)) {
      continue;
    }
    if (name === "app") {
      // Handled separately below (filtered copy).
      continue;
    }

    const src = join(frontendRoot, name);
    const dest = join(buildDir, name);

    if (COPY_INSTEAD_OF_SYMLINK.has(name)) {
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true });
      }
      continue;
    }

    symlinkSync(src, dest, entry.isDirectory() ? "dir" : "file");
  }

  assembleFilteredAppCopy();
}

function assembleFilteredAppCopy() {
  log(`Copying app/ (filtered) to ${appDest}...`);
  // A real, physical, recursive copy — never a symlink — since the excluded
  // subpaths below are removed from *this copy only*. `appSrc` (the real
  // `frontend/app/`) is only ever read here.
  cpSync(appSrc, appDest, { recursive: true });

  for (const subpath of EXCLUDED_APP_SUBPATHS) {
    rmSync(join(appDest, subpath), { recursive: true, force: true });
  }
}

function runNativeBuild() {
  log("Running `next build` (output: export) against the shadow root...");
  const nextBin = join(buildDir, "node_modules", ".bin", "next");
  const result = spawnSync(nextBin, ["build"], {
    cwd: buildDir,
    stdio: "inherit",
    env: {
      ...process.env,
      GETWRITE_BUILD_TARGET: "native",
      NEXT_PUBLIC_GETWRITE_RUNTIME: "native",
      // app/project-types/page.tsx resolves its template directory as
      // `path.join(process.cwd(), "..", "getwrite-config", "templates",
      // "project-types")` by default, assuming `cwd` is `frontend/` (whose
      // parent is the repo root). Since this build's `cwd` is one level
      // deeper (`frontend/.native-build/`), that default would resolve to
      // a nonexistent directory. The page already supports an explicit
      // override for exactly this kind of situation — use it rather than
      // touching the page's source.
      GETWRITE_TEMPLATES_DIR: join(
        frontendRoot,
        "..",
        "getwrite-config",
        "templates",
        "project-types",
      ),
    },
  });

  if (result.error) {
    fail(`Failed to spawn \`next build\`: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`\`next build\` exited with status ${result.status}.`);
  }
}

function verifyOutput() {
  if (!existsSync(outDir)) {
    fail(`Expected static export output at ${outDir}, but it doesn't exist.`);
  }
  const outEntries = readdirSync(outDir);
  if (outEntries.length === 0) {
    fail(`Static export output at ${outDir} is empty.`);
  }
  log(`Native static export produced at ${outDir} (${outEntries.length} top-level entries).`);
}

function main() {
  // The native template imports resolve through frontend/getwrite-config (a
  // generated, gitignored link — see ensure-config-link.mjs). Guarantee it
  // exists before assembling the shadow root, which mirrors it inward.
  ensureConfigLink();
  cleanPreviousBuild();
  assembleShadowRoot();
  runNativeBuild();
  verifyOutput();
  log("Done.");
}

main();
