// ADR-021 Phase 0 — on-device harness bundle entry point.
//
// Bundled (by scripts/build-harness.mjs) into `www/harness.bundle.js` and
// loaded by `www/index.html` inside the Capacitor Android WebView. It wires the
// two shipped native seams together and exposes a single function the page's
// "Run harness" button calls:
//
//   1. bootstrapNativeStorageContext() — resolves the app-private projects dir
//      (Directory.Data) and installs the process-wide default StorageContext
//      over the REAL @capacitor/filesystem plugin (Task 4 / FR4, FR5).
//   2. runNativeDeviceHarness() — runs the three physical-device checks
//      (FR6 search, FR7a base64 throughput, FR7b dir-rename-on-collision) and
//      returns one JSON-serializable report (Task 6).
//
// The build defines NEXT_PUBLIC_GETWRITE_RUNTIME="native", so resolveSearchTransport()
// inside runNativeDeviceHarness dispatches to the in-process native backend
// (no fetch, no server) against the ambient context installed in step 1.
//
// This module is native-only by construction: it statically imports the
// native-only bootstrap + harness modules, which pull in @capacitor/filesystem.
// It is NEVER imported by the frontend/hosted/desktop app — it exists purely as
// this throwaway device-loader entry.
import { bootstrapNativeStorageContext } from "../../frontend/src/lib/models/native-bootstrap";
import {
  runNativeDeviceHarness,
  type NativeDeviceHarnessReport,
} from "../../frontend/src/lib/models/native-device-harness";

/** Bootstraps the native storage context (idempotent) then runs all three checks. */
async function run(): Promise<NativeDeviceHarnessReport> {
  await bootstrapNativeStorageContext();
  return runNativeDeviceHarness();
}

declare global {
  interface Window {
    /** Invoked by www/index.html's "Run harness" button. */
    getwriteHarness?: { run: () => Promise<NativeDeviceHarnessReport> };
  }
}

window.getwriteHarness = { run };
