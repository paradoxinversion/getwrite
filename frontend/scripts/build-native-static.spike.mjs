// ADR-021 Phase 2 SPIKE — produce a static export of the app for the native
// (Capacitor) target.
//
// `output: "export"` cannot collect the 37 dynamic API route handlers (they
// read/write the filesystem at request time). On device there is no server, so
// those routes are dead — but they still live under app/api and break the
// export. This spike relocates app/api out of the tree for the duration of the
// native `next build`, then restores it (finally-guarded so a crash never leaves
// the tree mutated). Everything the client actually needs on device is the
// in-process transport layer (Phase 1) + the lib/api collapse (Phase 2 proper);
// this spike only proves the app can static-export and load in the WebView.
import { execSync } from "node:child_process";
import { renameSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const frontend = dirname(dirname(fileURLToPath(import.meta.url)));

// Surfaces that are dead on native (no server, no hosted auth) and block a
// static export: the API route handlers (dynamic, fs-backed) and the hosted-auth
// pages (login/reset-password/verify-email use request-time searchParams). On
// device none of these exist; stash them for the export, restore after.
const stashTargets = [
  "app/api",
  "app/login",
  "app/reset-password",
  "app/verify-email",
].map((rel) => ({
  live: join(frontend, ...rel.split("/")),
  stash: join(frontend, `.${rel.replaceAll("/", "-")}.spike-stash`),
}));

function restore() {
  for (const { live, stash } of stashTargets) {
    if (existsSync(stash)) {
      if (existsSync(live)) rmSync(live, { recursive: true, force: true });
      renameSync(stash, live);
      console.log(`[spike] restored ${live.replace(frontend + "/", "")}`);
    }
  }
}

process.on("exit", restore);
process.on("SIGINT", () => process.exit(1));

try {
  for (const { live, stash } of stashTargets) {
    if (existsSync(stash)) rmSync(stash, { recursive: true, force: true });
    if (existsSync(live)) renameSync(live, stash);
  }
  console.log(
    "[spike] moved dead-on-native surfaces aside; building native static export…",
  );
  execSync("pnpm build", {
    cwd: frontend,
    stdio: "inherit",
    env: {
      ...process.env,
      GETWRITE_BUILD_TARGET: "native",
      NEXT_PUBLIC_GETWRITE_RUNTIME: "native",
    },
  });
  console.log("[spike] native static export succeeded → frontend/out/");
} finally {
  restore();
}
