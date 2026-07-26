import type { CapacitorConfig } from "@capacitor/cli";

// `webDir` points at a trivial placeholder (`android/www/`) rather than the
// frontend's real build output. GetWrite's `frontend` package builds via
// `next build` with `output: "standalone"` (see frontend/next.config.mjs) —
// a Node server bundle served over HTTP (this is how the Electron desktop
// shell consumes it, spawning it as a child process — see
// electron/src/main.ts) — not a static asset export. Capacitor's `webDir`
// model expects a directory of static assets it copies into the native
// project, which doesn't map onto that standalone server output.
//
// Phase 0 (ADR-021) only needs to prove the storage/transport spike
// (search) against the real @capacitor/filesystem plugin on-device via a
// minimal harness — not ship the full app UI in a WebView (full webview
// wiring against real built frontend assets is Phase 2, per the spec's
// non-goals). This placeholder keeps the config schema-valid and pointed at
// a directory that actually exists in the repo until that wiring lands.
const config: CapacitorConfig = {
  appId: "works.saboteur.getwrite",
  appName: "GetWrite",
  // ADR-021 Phase 2 SPIKE: point at the native static export of the real app
  // (frontend/out, produced by scripts/build-native-static.spike.mjs) to prove
  // the app loads in the WebView. (Reverts to the harness "www" after the spike.)
  webDir: "../frontend/out",
};

export default config;
