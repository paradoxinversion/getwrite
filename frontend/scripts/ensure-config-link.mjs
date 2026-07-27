#!/usr/bin/env node
// ADR-021 Phase 2 — ensures `frontend/getwrite-config` exists as a link to the
// repo-root `getwrite-config/` directory.
//
// `frontend/src/lib/models/project-types-static.ts` statically imports the
// project-type template JSON via `../../../getwrite-config/...`, which requires
// a `getwrite-config` entry at the top level of whichever project root is
// building — the real `frontend/` for hosted/desktop + tsc, and the shadow root
// (`frontend/.native-build/`) for the native export, which mirrors every
// top-level `frontend/` entry into itself.
//
// This link is deliberately NOT tracked in git: a checked-in symlink is fragile
// on Windows (needs `core.symlinks` / admin, else it materializes as a broken
// text stub). Instead it is generated here — as a real symlink on POSIX and a
// directory *junction* on Windows (which needs neither admin rights nor
// `core.symlinks`). Idempotent and fast, so it is safe to run from `postinstall`
// and as a pre-step of typecheck/build.
import { existsSync, lstatSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function ensureConfigLink() {
  const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const link = join(frontendRoot, "getwrite-config");
  // Junctions on Windows require an absolute target.
  const target = resolve(frontendRoot, "..", "getwrite-config");

  // Already a working link/dir → nothing to do.
  if (existsSync(link)) return;

  // Clear a dangling/broken entry if one exists (lstat sees it; existsSync did not).
  try {
    lstatSync(link);
    rmSync(link, { force: true, recursive: false });
  } catch {
    // Nothing there — expected.
  }

  // "junction" is Windows-only (no admin / no core.symlinks needed); on POSIX
  // the type arg is ignored and a normal symlink is created.
  symlinkSync(target, link, "junction");
  console.log("[ensure-config-link] created frontend/getwrite-config → ../getwrite-config");
}

// Run when invoked directly (postinstall / pre-step); harmless to import too.
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureConfigLink();
}
