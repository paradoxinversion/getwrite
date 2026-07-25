// ADR-021 Phase 0 — on-device harness bundle shim for `node:fs` / `fs`.
//
// The only value import of `fs` in the reachable graph is `backlinks-watcher.ts`
// (fs.watch), which is NOT statically reachable from the search transport graph
// the harness exercises — every other `node:fs` import in the model layer is
// type-only (`import type { Dirent, Stats }`) and erased at bundle time. This
// stub exists solely so esbuild can resolve any stray default import. On the
// native path the real filesystem is `@capacitor/filesystem` via
// `capacitorFsAdapter`; nothing here should ever be called. Any actual call
// throws loudly rather than silently no-op'ing, so a wrong assumption surfaces
// immediately during the device run instead of corrupting a check result.

function unavailable(member) {
  return () => {
    throw new Error(
      `node:fs.${member}() is not available in the on-device harness bundle. ` +
        `The native path must use @capacitor/filesystem (capacitorFsAdapter), ` +
        `not node:fs.`,
    );
  };
}

const fs = new Proxy(
  {},
  {
    get(_target, prop) {
      return unavailable(String(prop));
    },
  },
);

export default fs;
