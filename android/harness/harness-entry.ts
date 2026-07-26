// ADR-021 Phase 0 — on-device harness bundle entry point.
//
// Bundled (by scripts/build-harness.mjs) into `www/harness.bundle.js` and
// loaded by `www/index.html` inside the Capacitor Android WebView. It wires the
// two shipped native seams together:
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
// Two ways to get the result off the device:
//   - the "Run harness" button in index.html (window.getwriteHarness.run), and
//   - an automatic run on load that persists the outcome to
//     Directory.Data/harness-report.json, readable from the host via
//       adb shell run-as works.saboteur.getwrite cat files/harness-report.json
//     This lets the device gate (and any real-vs-fake divergence it surfaces) be
//     captured without a manual tap or logcat scraping.
//
// This module is native-only by construction: it statically imports the
// native-only bootstrap + harness modules, which pull in @capacitor/filesystem.
// It is NEVER imported by the frontend/hosted/desktop app.
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

/** The outcome shape persisted to disk for host-side capture. */
type HarnessOutcome =
  | { ok: true; report: NativeDeviceHarnessReport }
  | { ok: false; error: string; stack: string | null };

/** Runs the harness and writes the outcome to Directory.Data/harness-report.json. */
async function runAndPersist(): Promise<HarnessOutcome> {
  let outcome: HarnessOutcome;
  try {
    outcome = { ok: true, report: await run() };
  } catch (err) {
    outcome = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? (err.stack ?? null) : null,
    };
  }
  try {
    const { Filesystem, Directory, Encoding } =
      await import("@capacitor/filesystem");
    await Filesystem.writeFile({
      path: "harness-report.json",
      data: JSON.stringify(outcome, null, 2),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  } catch {
    // Persisting is a convenience for host capture; ignore its failure.
  }
  return outcome;
}

declare global {
  interface Window {
    /** Invoked by www/index.html's "Run harness" button. */
    getwriteHarness?: {
      run: () => Promise<NativeDeviceHarnessReport>;
      runAndPersist: () => Promise<HarnessOutcome>;
    };
  }
}

window.getwriteHarness = { run, runAndPersist };

// Auto-run once on load so the outcome is captured to disk without a manual tap.
window.addEventListener("load", () => {
  void runAndPersist();
});
