// Last Updated: 2026-07-25

/**
 * @module native-device-harness
 *
 * **ADR-021 Phase 0 (Task 6).** Manual, on-device verification harness for
 * the physical-device gate required by the native Android Phase 0 spec's
 * FR6/FR7/FR8 (`specs/features/native-android-phase0-walking-skeleton.md`).
 *
 * This module is deliberately **not** wired into any app UI, button, or
 * route — that is explicitly Phase 2 territory per the spec's non-goals. It
 * exposes a single top-level async function, {@link runNativeDeviceHarness},
 * that a human running Task 7 (out of scope here — no emulator/device exists
 * in this environment) can invoke manually from a debug console or a
 * temporary dev-only trigger, once the app has already called
 * `bootstrapNativeStorageContext()` (`native-bootstrap.ts`) at startup in the
 * same process. It returns one JSON-serializable
 * {@link NativeDeviceHarnessReport} — safe to
 * `console.log(JSON.stringify(report, null, 2))` — covering three checks:
 *
 * - **FR6 — search end-to-end.** Seeds a small, deterministic fixture — same
 *   shape as `transport-collapse.spike.test.ts`'s `seedProject()` helper
 *   (`project.json`, `meta/index/inverted.json`, a resource sidecar) — into an
 *   **isolated** fixture projects dir under `/harness` (never the real
 *   `/projects` dir the app lists), then runs a query through the in-process
 *   native transport ({@link createNativeSearchTransport}) pointed at that dir,
 *   and removes the fixture afterward. With no injected `deps.fs` the transport
 *   still awaits `native-bootstrap.ts`'s memoized bootstrap and resolves against
 *   the ambient {@link StorageContext} installed at startup — the same context
 *   production uses — but confined to the harness namespace so a run never
 *   mutates the user's real projects. This module imports
 *   `native-search-backend.ts` directly (it is itself native-only and never
 *   web-reachable, so this does not leak it into the web bundle — see the
 *   allowlist in `native-search-backend-web-exclusion.test.ts`). The report
 *   returns the raw, ordered hit array so a human can visually diff it against
 *   the same
 *   fixture run through the existing web/desktop `/api/project/:id/search`
 *   route to confirm "same hits, same ordering" (FR6). There is no live
 *   server on-device to automate that comparison against — the harness only
 *   makes its own output self-evidently comparable.
 * - **FR7a — base64 read/write throughput.** Times a synthetic buffer's
 *   round trip through `capacitorFsAdapter`'s base64-encoded
 *   `writeFile`/`readFileBuffer`, reporting bytes/sec (as MB/s) for each
 *   direction. Per FR8, **no threshold is asserted or hardcoded here** — a
 *   human sets an acceptable threshold from the numbers this reports after
 *   running it on a physical device.
 * - **FR7b — directory rename-on-collision.** `revision.ts`'s
 *   `writeRevision` stages a fresh temp directory and renames it onto the
 *   final `v-<N>` directory, with a comment asserting "If finalDir exists,
 *   this will throw" (see `revision.ts`) — but the in-memory fake
 *   (`capacitor-filesystem.ts`'s `createFakeCapacitorFilesystem().rename`)
 *   actually *merges* colliding directories silently: it overwrites
 *   file-name collisions and folds in the rest, never throwing. This check
 *   reproduces exactly that collision shape — a non-empty source directory
 *   renamed onto a pre-existing, non-empty destination directory — against
 *   the REAL plugin, and reports what was observed (error thrown and its
 *   message, whether the source directory still exists afterward, and what
 *   ended up in the destination) so a human can compare it to the fake's
 *   assumption. No pass/fail assertion is made — Phase 0 exists precisely to
 *   surface whether this mismatch is real.
 * - **FR9 (Phase 2) — image/audio media throughput.** Extends the FR7a
 *   generic-buffer throughput check with the same timing/MB/s methodology,
 *   but over a small range of media-shaped payload sizes representative of
 *   real image/audio resources a user would actually attach (see
 *   `media-validation.ts`'s `IMAGE_EXTENSION_MIME`/`AUDIO_EXTENSION_MIME`/
 *   `MAX_MEDIA_FILE_BYTES`, and `media-metadata.ts`'s
 *   `extractImageMetadata`/`extractAudioMetadata`, both used by the real
 *   `resources/<id>/original.<ext>` upload path). The Phase 0 generic
 *   benchmark measured a single 4 MiB synthetic buffer at ~0.8 MB/s on a
 *   physical Pixel; FR9 requires that number be re-measured specifically
 *   against representative media sizes (not just re-used) before any
 *   accept-with-limit-vs-chunked-transfer remediation decision is made. As
 *   with FR7a/FR8, **no threshold is asserted or hardcoded here** — this
 *   only reports raw per-size MB/s numbers for a human to evaluate against
 *   the Phase 0 baseline once measured on a physical device.
 *
 * **Native-only.** Statically imports `capacitor-filesystem-real.ts`, which
 * itself statically imports `@capacitor/filesystem`. Per that module's own
 * doc comment, this is only safe because THIS module is never statically
 * imported from anything reachable by the web/hosted/desktop client bundle —
 * by design, nothing in the tree imports it (see the spec's non-goals on
 * app-UI wiring); it exists as a correctly-implemented, unit-tested seam
 * ready for a human to invoke directly (e.g. via a REPL/debug console) or
 * wire behind a temporary dev-only trigger during Task 7.
 */
import { createRealCapacitorFilesystem } from "./capacitor-filesystem-real";
import { capacitorFsAdapter } from "./capacitorFsAdapter";
import { createNativeSearchTransport } from "../../store/transport/native-search-backend";
import type { SearchResult } from "../../store/search-transport-service";

/**
 * Scratch root the harness seeds/reads/writes under — fixed and disposable,
 * isolated from any real project data the app may already have on-device.
 */
const HARNESS_ROOT = "/harness";

/**
 * FR6 fixture identifiers, matching `transport-collapse.spike.test.ts`'s
 * `seedProject()` shape.
 *
 * The fixture projects dir lives under {@link HARNESS_ROOT}, **not** the real
 * `/projects` dir the app lists. The fixture manifest is intentionally minimal
 * (just an `id`, no `createdAt`) and would fail `validateProject`, so seeding it
 * into `/projects` used to poison the whole project list on the next app open
 * (`listProjectsCore` now skips such a manifest, but the harness must not write
 * into real user data regardless). Isolating it here keeps every harness run
 * free of side effects on the user's actual projects.
 */
const FIXTURE_PROJECTS_DIR = `${HARNESS_ROOT}/projects`;
const FIXTURE_PROJECT_ID = "harness-proj-1";
const FIXTURE_RESOURCE_ID = "harness-res-1";
const FIXTURE_RESOURCE_TITLE = "Dragon Notes";
const FIXTURE_QUERY = "dragon";

/**
 * FR7a synthetic payload size for the base64 read/write throughput
 * benchmark. 4 MiB is large enough to produce a meaningful, non-instant
 * timing signal for real device I/O plus base64 encode/decode overhead,
 * while staying practical for a human to re-run repeatedly by hand during
 * manual Task 7 verification (no multi-minute transfer per run).
 */
const THROUGHPUT_PAYLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Floor applied to a measured duration before computing a rate, to avoid a
 * divide-by-zero → `Infinity` when timing an effectively-instant operation
 * (e.g. an in-memory fake in unit tests). Real device I/O never approaches
 * this floor, so it never affects genuine on-device measurements.
 */
const MIN_DURATION_MS = 0.001;

/**
 * One named synthetic payload size used by the FR9 media throughput checks.
 */
interface MediaPayloadSpec {
  label: string;
  bytes: number;
}

/**
 * FR9 representative image payload sizes. Three points span the range a
 * user actually attaches, so fixed-overhead-vs-per-byte-cost behavior is
 * visible rather than masked by a single sample:
 * - `small` (200 KiB): a thumbnail-scale or lightly-compressed small JPEG
 *   (e.g. a cropped screenshot or profile-picture-sized image).
 * - `typical` (2 MiB): a typical modern smartphone-camera JPEG at default
 *   compression — the most common case for a "photo attached to a resource".
 * - `large` (8 MiB): a high-resolution photo or a screenshot-heavy PNG,
 *   representative of the upper end of what a writer might attach without
 *   approaching `MAX_MEDIA_FILE_BYTES` (100 MiB).
 */
const IMAGE_THROUGHPUT_PAYLOADS: readonly MediaPayloadSpec[] = [
  { label: "small", bytes: 200 * 1024 },
  { label: "typical", bytes: 2 * 1024 * 1024 },
  { label: "large", bytes: 8 * 1024 * 1024 },
];

/**
 * FR9 representative audio payload sizes. Two points cover the short and
 * long ends of what a writer would realistically attach as a voice memo or
 * reference recording:
 * - `short` (512 KiB): a short voice memo (roughly 30 seconds at a typical
 *   compressed bitrate).
 * - `long` (4 MiB): a several-minute voice recording or reference clip —
 *   the same order of magnitude as the FR7a generic benchmark, so it can be
 *   sanity-compared against the generic-buffer baseline at a matched size.
 */
const AUDIO_THROUGHPUT_PAYLOADS: readonly MediaPayloadSpec[] = [
  { label: "short", bytes: 512 * 1024 },
  { label: "long", bytes: 4 * 1024 * 1024 },
];

/** FR6 report: the raw, ordered search hits for a human to visually diff. */
export interface SearchCheckReport {
  projectId: string;
  query: string;
  hitCount: number;
  hits: SearchResult[];
}

/** FR7a report: measured base64 read/write throughput. No pass/fail — see FR8. */
export interface ThroughputCheckReport {
  payloadBytes: number;
  writeMs: number;
  readMs: number;
  writeMBps: number;
  readMBps: number;
  roundTripIntegrityOk: boolean;
}

/**
 * FR9 report: one representative payload size's measured base64 read/write
 * throughput. Structurally mirrors {@link ThroughputCheckReport}, adding a
 * `label` to distinguish which representative size this measurement is for.
 * No pass/fail — see FR8/FR9.
 */
export interface MediaSizeThroughputReport {
  label: string;
  payloadBytes: number;
  writeMs: number;
  readMs: number;
  writeMBps: number;
  readMBps: number;
  roundTripIntegrityOk: boolean;
}

/** FR9 report: measured throughput across all representative image payload sizes. */
export interface ImageThroughputCheckReport {
  sizes: MediaSizeThroughputReport[];
}

/** FR9 report: measured throughput across all representative audio payload sizes. */
export interface AudioThroughputCheckReport {
  sizes: MediaSizeThroughputReport[];
}

/** FR7b report: observed behavior of a real directory rename-on-collision. */
export interface RenameCollisionCheckReport {
  scenario: string;
  threw: boolean;
  errorMessage: string | null;
  sourceStillExistsAfter: boolean;
  destinationEntriesAfter: string[];
  observedBehavior: "overwrote-merged" | "threw" | "unknown";
}

/** The single, JSON-serializable report {@link runNativeDeviceHarness} returns. */
export interface NativeDeviceHarnessReport {
  generatedAt: string;
  search: SearchCheckReport;
  throughput: ThroughputCheckReport;
  renameCollision: RenameCollisionCheckReport;
  imageThroughput: ImageThroughputCheckReport;
  audioThroughput: AudioThroughputCheckReport;
}

/**
 * Seeds the FR6 fixture directly onto the real on-device filesystem, in the
 * exact shape `transport-collapse.spike.test.ts`'s `seedProject()` helper
 * uses: `project.json`, an inverted index mapping the fixture query to the
 * fixture resource, and a sidecar carrying the resource's display name.
 */
async function seedSearchFixture(): Promise<void> {
  const adapter = capacitorFsAdapter(createRealCapacitorFilesystem());
  const root = `${FIXTURE_PROJECTS_DIR}/${FIXTURE_PROJECT_ID}`;
  await adapter.mkdir(`${root}/meta/index`, { recursive: true });
  await adapter.writeFile(
    `${root}/project.json`,
    JSON.stringify({ id: FIXTURE_PROJECT_ID }),
  );
  await adapter.writeFile(
    `${root}/meta/index/inverted.json`,
    JSON.stringify({ [FIXTURE_QUERY]: { [FIXTURE_RESOURCE_ID]: 3 } }),
  );
  await adapter.writeFile(
    `${root}/meta/resource-${FIXTURE_RESOURCE_ID}.meta.json`,
    JSON.stringify({ name: FIXTURE_RESOURCE_TITLE }),
  );
}

/**
 * FR6: seeds the fixture, then runs a real search through the in-process native
 * search transport ({@link createNativeSearchTransport}) pointed at the isolated
 * {@link FIXTURE_PROJECTS_DIR} under {@link HARNESS_ROOT}. With no `deps.fs`
 * injected it still awaits the memoized native bootstrap and resolves against
 * the ambient {@link StorageContext} `native-bootstrap.ts` installed at startup
 * — the same context the production transport uses — but confined to the
 * harness namespace so it never touches the user's real `/projects` dir. The
 * fixture is removed in a `finally` so a run leaves nothing behind.
 */
async function runSearchCheck(): Promise<SearchCheckReport> {
  try {
    await seedSearchFixture();
    const transport = createNativeSearchTransport({
      projectsDir: FIXTURE_PROJECTS_DIR,
    });
    const hits = await transport.search(FIXTURE_PROJECT_ID, FIXTURE_QUERY);
    return {
      projectId: FIXTURE_PROJECT_ID,
      query: FIXTURE_QUERY,
      hitCount: hits.length,
      hits,
    };
  } finally {
    // Remove the whole isolated fixture projects tree (including the
    // `/harness/projects` parent `seedSearchFixture` created), so a run
    // genuinely leaves nothing behind.
    const adapter = capacitorFsAdapter(createRealCapacitorFilesystem());
    await adapter
      .rm(FIXTURE_PROJECTS_DIR, { recursive: true, force: true })
      .catch(() => {
        /* best-effort cleanup; a leftover under /harness never reaches the UI */
      });
  }
}

/** Converts bytes transferred over a duration (ms) into MB/s, floor-guarded against divide-by-zero. */
function toMBps(bytes: number, durationMs: number): number {
  const effectiveMs = Math.max(durationMs, MIN_DURATION_MS);
  return bytes / 1024 / 1024 / (effectiveMs / 1000);
}

/**
 * FR7a/FR8: writes and reads back a synthetic buffer through
 * `capacitorFsAdapter`'s base64-encoded `writeFile`/`readFileBuffer`, timing
 * each direction independently. Reports raw measured numbers only — no
 * threshold is asserted (FR8: a human sets one from real device data).
 */
async function runThroughputCheck(): Promise<ThroughputCheckReport> {
  const adapter = capacitorFsAdapter(createRealCapacitorFilesystem());
  const path = `${HARNESS_ROOT}/perf/blob.bin`;

  const payload = Buffer.alloc(THROUGHPUT_PAYLOAD_BYTES);
  for (let i = 0; i < payload.length; i += 1) payload[i] = i % 256;

  const writeStart = performance.now();
  await adapter.writeFile(path, payload);
  const writeMs = performance.now() - writeStart;

  const readStart = performance.now();
  const readBack = await adapter.readFileBuffer(path);
  const readMs = performance.now() - readStart;

  return {
    payloadBytes: THROUGHPUT_PAYLOAD_BYTES,
    writeMs,
    readMs,
    writeMBps: toMBps(THROUGHPUT_PAYLOAD_BYTES, writeMs),
    readMBps: toMBps(THROUGHPUT_PAYLOAD_BYTES, readMs),
    roundTripIntegrityOk: readBack.equals(payload),
  };
}

/**
 * Writes and reads back one named synthetic media-shaped payload through
 * `capacitorFsAdapter`'s base64-encoded `writeFile`/`readFileBuffer`, timing
 * each direction independently — the same methodology as
 * {@link runThroughputCheck}, parameterized over a single representative
 * size and file path.
 */
async function runMediaSizeThroughputCheck(
  path: string,
  spec: MediaPayloadSpec,
): Promise<MediaSizeThroughputReport> {
  const adapter = capacitorFsAdapter(createRealCapacitorFilesystem());

  const payload = Buffer.alloc(spec.bytes);
  for (let i = 0; i < payload.length; i += 1) payload[i] = i % 256;

  const writeStart = performance.now();
  await adapter.writeFile(path, payload);
  const writeMs = performance.now() - writeStart;

  const readStart = performance.now();
  const readBack = await adapter.readFileBuffer(path);
  const readMs = performance.now() - readStart;

  return {
    label: spec.label,
    payloadBytes: spec.bytes,
    writeMs,
    readMs,
    writeMBps: toMBps(spec.bytes, writeMs),
    readMBps: toMBps(spec.bytes, readMs),
    roundTripIntegrityOk: readBack.equals(payload),
  };
}

/**
 * FR9: measures base64 read/write throughput for each representative image
 * payload size in {@link IMAGE_THROUGHPUT_PAYLOADS}, mirroring the
 * production `resources/<id>/original.<ext>` binary-upload path's shape.
 * Reports raw measured numbers only — no threshold is asserted.
 */
async function runImageThroughputCheck(): Promise<ImageThroughputCheckReport> {
  const sizes: MediaSizeThroughputReport[] = [];
  for (const spec of IMAGE_THROUGHPUT_PAYLOADS) {
    sizes.push(
      await runMediaSizeThroughputCheck(
        `${HARNESS_ROOT}/media/image-${spec.label}.bin`,
        spec,
      ),
    );
  }
  return { sizes };
}

/**
 * FR9: measures base64 read/write throughput for each representative audio
 * payload size in {@link AUDIO_THROUGHPUT_PAYLOADS}, mirroring the
 * production `resources/<id>/original.<ext>` binary-upload path's shape.
 * Reports raw measured numbers only — no threshold is asserted.
 */
async function runAudioThroughputCheck(): Promise<AudioThroughputCheckReport> {
  const sizes: MediaSizeThroughputReport[] = [];
  for (const spec of AUDIO_THROUGHPUT_PAYLOADS) {
    sizes.push(
      await runMediaSizeThroughputCheck(
        `${HARNESS_ROOT}/media/audio-${spec.label}.bin`,
        spec,
      ),
    );
  }
  return { sizes };
}

/**
 * FR7: reproduces the directory rename-on-collision shape
 * `revision.ts`'s `writeRevision` comment assumes throws — a non-empty
 * source directory renamed onto a pre-existing, non-empty destination
 * directory — against the REAL plugin, and reports what was actually
 * observed. Makes no pass/fail assertion; the mismatch (if any) against the
 * in-memory fake's silent-merge behavior is exactly what a human evaluates.
 */
async function runRenameCollisionCheck(): Promise<RenameCollisionCheckReport> {
  const adapter = capacitorFsAdapter(createRealCapacitorFilesystem());
  const srcDir = `${HARNESS_ROOT}/rename/src`;
  const dstDir = `${HARNESS_ROOT}/rename/dst`;

  await adapter.mkdir(srcDir, { recursive: true });
  await adapter.writeFile(`${srcDir}/from-src.txt`, "from source");
  await adapter.mkdir(dstDir, { recursive: true });
  await adapter.writeFile(
    `${dstDir}/pre-existing.txt`,
    "pre-existing in destination",
  );

  let didThrow = false;
  let errorMessage: string | null = null;
  try {
    await adapter.rename(srcDir, dstDir);
  } catch (err) {
    didThrow = true;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  let isSourceStillPresentAfter = true;
  try {
    await adapter.readdir(srcDir);
  } catch {
    isSourceStillPresentAfter = false;
  }

  let destinationEntriesAfter: string[] = [];
  try {
    destinationEntriesAfter = (await adapter.readdir(dstDir)) as string[];
  } catch {
    destinationEntriesAfter = [];
  }

  const observedBehavior: RenameCollisionCheckReport["observedBehavior"] =
    didThrow
      ? "threw"
      : !isSourceStillPresentAfter && destinationEntriesAfter.length > 0
        ? "overwrote-merged"
        : "unknown";

  return {
    scenario:
      "rename a non-empty source directory onto a pre-existing, non-empty " +
      "destination directory — mirrors revision.ts's writeRevision temp-dir " +
      "-> v-<N> rename, whose comment assumes rename throws when the " +
      "destination already exists; the in-memory fake instead merges " +
      "silently rather than throwing",
    threw: didThrow,
    errorMessage,
    sourceStillExistsAfter: isSourceStillPresentAfter,
    destinationEntriesAfter,
    observedBehavior,
  };
}

/**
 * Runs all ADR-021 physical-device checks — Phase 0's FR6, FR7a, FR7b, plus
 * Phase 2's FR9 image/audio media throughput checks — and returns a single
 * structured, JSON-serializable report. Must be invoked manually, on-device,
 * after `bootstrapNativeStorageContext()` has already run for this process
 * (Phase 0 Task 7 — not automated, not run here).
 */
export async function runNativeDeviceHarness(): Promise<NativeDeviceHarnessReport> {
  const search = await runSearchCheck();
  const throughput = await runThroughputCheck();
  const renameCollision = await runRenameCollisionCheck();
  const imageThroughput = await runImageThroughputCheck();
  const audioThroughput = await runAudioThroughputCheck();

  return {
    generatedAt: new Date().toISOString(),
    search,
    throughput,
    renameCollision,
    imageThroughput,
    audioThroughput,
  };
}
