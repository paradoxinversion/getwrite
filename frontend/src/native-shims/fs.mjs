// ADR-021 Phase 2 — native WebView shim for `node:fs` / `fs`.
//
// The reachable value-use of `node:fs` in the model layer is `backlinks-watcher.ts`
// (`fs.watch` + `fs.existsSync`). Those are SYNCHRONOUS Node APIs with no
// Capacitor equivalent, so the file watcher can't run on device — but backlinks
// are recomputed on every save via the indexer, so a live FS watcher is not
// needed natively. Rather than throw (which sent the watcher into a 1s
// error-poll), degrade gracefully:
//   - `watch()` returns a no-op FSWatcher, so `startBacklinksWatcher()` succeeds
//     and never falls back to its existence-polling loop.
//   - `existsSync()` returns false (a sync existence check can't be answered
//     against the async plugin; io.ts exposes an async adapter-backed `exists`).
// Every other member still throws loudly, so an unexpected node:fs dependency
// surfaces immediately instead of silently corrupting state.

function unavailable(member) {
  return () => {
    throw new Error(
      `node:fs.${member}() is not available in the native WebView build. ` +
        `The native path must use @capacitor/filesystem (capacitorFsAdapter), ` +
        `not node:fs.`,
    );
  };
}

/** Minimal no-op FSWatcher — the native build has no live file watcher. */
function noopWatch() {
  return {
    close() {},
    ref() {
      return this;
    },
    unref() {
      return this;
    },
    on() {
      return this;
    },
  };
}

const known = {
  watch: noopWatch,
  existsSync: () => false,
};

const fs = new Proxy(known, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    return unavailable(String(prop));
  },
});

export default fs;
