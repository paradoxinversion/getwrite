import type { CapacitorConfig } from "@capacitor/cli";

// `webDir` points directly at the frontend's real static export output,
// `frontend/out/`. ADR-021 Phase 2 wires the full app into the WebView:
// `frontend`'s `pnpm build:native` (GETWRITE_BUILD_TARGET=native, see
// frontend/next.config.mjs + frontend/scripts/build-native-static.mjs) runs
// `next build` with `output: "export"` against a generated native app tree
// (a copy-forward of `app/` minus `app/api/**` and the hosted-auth pages) and
// produces `frontend/out/` — a directory of static assets. `cap sync android`
// copies `webDir` straight into the native project, so no android-local copy
// step is needed here.
const config: CapacitorConfig = {
  appId: "works.saboteur.getwrite",
  appName: "GetWrite",
  webDir: "../frontend/out",
};

export default config;
