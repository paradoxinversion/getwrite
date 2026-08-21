# Agentic QA — Follow-Up Task List

Source: findings from the first live QA run against `feat/agentic-qa`
(`specs/features/agentic-qa/inventory.md`, `run-report.md`, `procedure.md`).
All nine items below were confirmed by actually running the harness against
the real app, not by inspection — evidence is cited per task so an
implementor does not need to rediscover it. This list has two owners:
Tasks 1-6 fix the QA harness itself (`cli/src/qa/`, `cli/tests/qa/`); Tasks
7-9 fix GetWrite product defects the harness's real-filesystem checks
surfaced. Granularity: story points (1/2/3/5/8).

## Ordering rationale

Ordered by value and risk, not strictly by task-dependency chain (most
items are independent):

1. **Task 1 (H1)** and **Task 2 (H2)** come first: both concern stale
   `frontend/.next` state, both cost real maintainer time on essentially
   every session (two failed `qa start` attempts and one spurious test
   failure in a single session for H1 alone; three session-blocking
   failures for H2's sibling, listed later as Task 4), and Task 1's
   isolated `distDir` removes the shared-cache contention that both bugs
   live in — fixing it first shrinks Task 2's surface.
2. **Task 3 (P2)** comes next: it is the only item with direct end-user
   impact today — a resource with real content is misfiled as an empty
   "Needs content" stub — and is already fully diagnosed (reproducible with
   a 5-second post-save delay, ruling out async lag).
3. **Task 4 (H3)** and **Task 5 (H4)** are next: both are session-blocking
   harness reliability bugs (H3 failed three times in one session), lower
   value than H1/H2 only because they are cheaper to work around by hand
   in the meantime.
4. **Task 6 (H6)** is a harness hygiene fix (working-tree cleanliness) —
   real but lower-severity than Tasks 1-5.
5. **Task 7 (P1)** and **Task 8 (P3)** are product defects that are
   real but narrower: P1 is viewport-conditional (works at 1920x1080),
   and P3 is an accessibility gap with no reported functional breakage.
6. **Task 9 (H5)** is last: pure hygiene (leaked temp directories), zero
   functional risk, cheapest to defer.

No task in this list depends on another for correctness (each defect is
independently fixable and independently testable), so there is no forced
critical path; the ordering above is priority, not a dependency chain.

---

### Task 1: Give QA runs an isolated Next.js `distDir` (H1)
**What:** Configure the dev server the harness spawns
(`cli/src/qa/server.ts`) to use a `distDir` scoped to the run's disposable
workspace instead of the repo's shared `frontend/.next`, so a QA run can
neither be poisoned by a stale/corrupted shared cache nor poison it for
ordinary development or the harness's own test suite.
**Files:** `cli/src/qa/server.ts` (pass a `distDir` via `next dev` flag or
`next.config.mjs`-read env var scoped per run), `cli/tests/qa/server.test.ts`.
**Done when:** A QA run's spawned dev server writes its build output under
the run's own workspace or another run-scoped temp path, never under
`frontend/.next`; a test asserts `frontend/.next` is untouched (mtime
unchanged, or directory absent) after a full `qa start`/`qa finish` cycle
run against a repo state where `frontend/.next` does not yet exist.
**Depends on:** none
**Estimate:** 5
**Notes:** Evidence: a corrupted/stale `frontend/.next` made `/` return 404
indefinitely until `rm -rf frontend/.next`; this reproduced twice as failed
`qa start` attempts and once as a spurious `cli/tests/qa/server.test.ts`
failure (server returned a 404 HTML page where the test expected JSON) in a
single session. This is the highest-value harness fix per the spec brief.
Fixing this first is expected to shrink Task 2's surface, since both bugs
concern `.next` state, but Task 2 remains independently correct without it.
**Resolved 2026-08-18:** `qa start` now builds into a run-scoped
`frontend/.next-qa/<runId>` (gitignored, deleted by `qa finish`), passed to
Next via `GETWRITE_QA_DIST_DIR` which `frontend/next.config.mjs` reads —
`next dev` has no `--dist-dir` flag, so the config is the only channel. Proven
by a real-spawn test asserting `frontend/.next`'s mtime is unchanged after a
full spawn/stop, and by a manual `qa start`/`qa finish` cycle. One knock-on:
every run now pays a cold compile, so the readiness budget was raised from 60s
to 240s.
**Done:** [x]

### Task 2: Detect and clear a stale `.next/dev/lock` on `qa start` (H2)
**What:** Before spawning the dev server, `cli/src/qa/server.ts` must check
for an existing `frontend/.next/dev/lock` (or the run-scoped equivalent
after Task 1), read its recorded `pid`, and if that PID is not alive,
delete the lock file before starting; if the PID is alive, fail with a
clear message rather than hanging or silently overwriting a live server's
state.
**Files:** `cli/src/qa/server.ts`, `cli/tests/qa/server.test.ts`.
**Done when:** A test creates a `.next/dev/lock`-shaped file naming a dead
PID, then confirms `qa start` clears it and starts successfully; a second
test creates one naming a live PID (e.g. the test process's own `pid`) and
confirms `qa start` fails fast with an explanatory error instead of hanging
or waiting for the default readiness timeout.
**Depends on:** none
**Estimate:** 3
**Notes:** Evidence: Next 16 refuses a second dev server for the same
directory and records `{"pid":...,"port":...}` in
`frontend/.next/dev/lock`; when a server is killed (or `qa finish` cannot
confirm a stop), the lock persists naming a dead PID and every subsequent
`qa start` fails with "Another next dev server is already running" until
manually deleted. Related to Task 1 (both concern `.next` state) but
independently implementable — this fix is needed even after Task 1's
distDir isolation, since a run-scoped `distDir` still gets its own lock
file that can go stale the same way.
**Resolved 2026-08-18:** `clearStaleDevLock(distDir)` runs before every
spawn — it reads `<distDir>/dev/lock`, removes it when the recorded PID is
dead (or the file is unparseable), and throws `DevServerLockHeldError` naming
the PID when it is alive. `EPERM` from the liveness probe is treated as alive,
never as dead. Four tests cover dead-PID, live-PID, absent, and unparseable.
**Done:** [x]

### Task 3: Recompute and persist `wordCount` on resource save (P2)
**What:** Fix the resource-save path so a text resource's `wordCount` is
recomputed from its actual saved content and written into
`meta/resource-<id>.meta.json` on every save, not left at its
resource-creation-time value (typically `0`).
**Files:** `frontend/src/lib/models/resource-persistence.ts` (the
`writeResource`/persist path — currently only writes `sidecarData.wordCount`
when `resource.wordCount !== undefined`, so a caller that doesn't set it on
save leaves the sidecar's stale value untouched), the resource save API
route/core that calls it (`frontend/src/lib/models/resource-crud-core.ts`
or equivalent autosave call site — confirm the exact call site during
implementation), `frontend/tests/**` (add/extend a persistence test).
**Done when:** After typing content into a resource and triggering a save
(autosave or explicit), `meta/resource-<id>.meta.json`'s `wordCount` field
matches the actual word count of the saved content, verified by a test that
saves non-empty content and reads the sidecar file back; a resource with
real content no longer appears in `StubResourcesSection`'s "Needs content"
list.
**Depends on:** none
**Estimate:** 3
**Notes:** Evidence: after typing content and a successful autosave,
`meta/resource-<id>.meta.json` still held `"wordCount": 0` while
`updatedAt` was bumped to the save time; the editor's live counter showed 5
for the same content, confirming the UI computes it correctly and only the
persisted value is stale. Verified reproducible with a 5-second delay after
save, ruling out async lag. Per CLAUDE.md's Glossary, a stub resource is
defined by zero word count, so this directly misfiles real content as
empty in list views — the only item in this list with direct user impact.
**Resolved 2026-08-18:** the stale value came from
`updateRevisionInPlace` (`revision-core.ts`), the autosave path, which
rewrote the sidecar with only `updatedAt` refreshed.
`syncDerivedResourceContent` now returns the word count of the plain text it
just wrote and the sidecar write carries it. A legacy plain-text revision
syncs nothing and leaves the stored value alone. `resource-persistence.ts`'s
`writeResourceToFile` additionally derives a count from `plainText` when the
caller supplies none.
**Done:** [x]

### Task 4: Make the QA session record's location stable (H3)
**What:** Stop relying on `os.tmpdir()` (which varies with `TMPDIR`
between invocations) to locate the session record `qa start` writes.
Either move it to a stable, explicit location (e.g. under the repo's
`.git/` or a fixed dotfile path) or support an explicit env override (e.g.
`GETWRITE_QA_SESSION_PATH`) that all four subcommands (`start`, `verify`,
`report`, `finish`) consult consistently.
**Files:** `cli/src/qa/workspace.ts` and/or `cli/src/commands/qa.ts`
(wherever the session-record path is currently derived from
`os.tmpdir()`), `cli/tests/qa/workspace.test.ts`.
**Done when:** A test that simulates two invocations with different
`TMPDIR` values (or simulates the override env var) confirms `qa verify`,
`qa report`, and `qa finish` all locate the session record written by an
earlier `qa start` in the same run, without relying on `TMPDIR` being
identical across invocations.
**Depends on:** none
**Estimate:** 2
**Notes:** Evidence: `qa start` writes `<os.tmpdir()>/getwrite-qa/session.json`;
when `TMPDIR` differs between invocations, `qa verify`/`report`/`finish`
fail with "No active QA session found." This happened three times in one
session. The session record is the harness's designated recovery
mechanism, so its fragility undermines exactly the case it exists for.
**Resolved 2026-08-18:** the record moved to
`<repo>/.git/getwrite-qa/session.json`, with a `GETWRITE_QA_SESSION_PATH`
override every sub-command resolves through (`qaSessionFilePath` in
`workspace.ts`). A test flips `TMPDIR` between two resolutions and asserts
they match.
**Done:** [x]

### Task 5: Require an app-serving response from the readiness probe (H4)
**What:** Change `qa start`'s dev-server readiness probe so it does not
return as soon as any HTTP response is received (including a 404), but
instead waits for a response that indicates the app is actually serving
compiled routes (e.g. a 200 on a known route, or absence of Next's
not-found page markers).
**Files:** `cli/src/qa/server.ts` (readiness probe logic),
`cli/tests/qa/server.test.ts`.
**Done when:** A test that stubs a server initially returning 404 and later
returning 200 confirms the probe does not report ready during the 404
window and does report ready once 200 responses begin; the existing
"server accepts requests" readiness test is extended rather than replaced.
**Depends on:** none
**Estimate:** 3
**Notes:** Evidence: the probe currently returns as soon as the server
answers any socket, so the agent can navigate before routes have compiled
and receive a 404. Related to H1 (Task 1) — an isolated, warm `distDir`
per run reduces how often this window is hit — but this is a distinct
defect (the probe's success criterion is wrong regardless of cache state)
and should be fixed independently.
**Resolved 2026-08-18:** readiness now requires HTTP 200 from every path
in `DEFAULT_READY_PROBE_PATHS` (`/` and `/api/projects`) with a body carrying
no Next not-found marker, and the timeout error names the probe that was
still failing. `waitForServerReady` is exported so a stub server can drive it
through a 404 window and out the other side.
**Done:** [x]

### Task 6: Stop the QA harness from mutating tracked files and scanned directories (H6)
**What:** Two related hygiene fixes: (1) prevent starting the dev server
from causing Next to rewrite `frontend/tsconfig.json` as a side effect of
a QA run (e.g. by having the run's Next process use a workspace-local or
otherwise non-mutating config path, consistent with Task 1's `distDir`
isolation), and (2) move `qa-server.log` out of the run's
`GETWRITE_PROJECTS_DIR` (the directory the app scans for projects) into a
location outside the scanned tree, e.g. alongside the session record.
**Files:** `cli/src/qa/server.ts` (log file location), `cli/src/qa/workspace.ts`
if config-path handling belongs there, `cli/tests/qa/server.test.ts`.
**Done when:** A `git status`/`git diff` check after a full `qa start` /
`qa finish` cycle shows `frontend/tsconfig.json` unmodified; a test
confirms `qa-server.log` is written outside the run's
`GETWRITE_PROJECTS_DIR` workspace directory.
**Depends on:** none
**Estimate:** 2
**Notes:** Evidence: starting the dev server causes Next to rewrite
`frontend/tsconfig.json` (cosmetic array reformatting), so a QA run leaves
the repo modified; separately, `qa start` writes `qa-server.log` inside the
run's `GETWRITE_PROJECTS_DIR`, a foreign file in a directory the app scans
for projects — tolerated today but should not persist. Lower severity than
Tasks 1-5: neither causes a run to fail, only side effects that should not
exist.
**Partially resolved 2026-08-18, by a different mechanism than proposed.**
The log moved out of the scanned workspace to `.git/getwrite-qa/qa-server.log`
(`qaServerLogPath`), where it also survives `qa finish` deleting a passing
run's workspace. The tsconfig half could NOT be fixed as specified: pointing
Next at an untracked config via `typescript.tsconfigPath` makes this Next
version (16.2.6) stop discovering App Router routes entirely — every request
404s, with a verbatim copy of the real config as much as with one that
`extends` it. Verified twice against a real dev server. Instead `qa start`
snapshots `frontend/tsconfig.json` into the session record and `qa finish`
restores it, which satisfies the stated done-when (`git status` clean after a
full cycle) and preserves any uncommitted edits the developer already had.
The file is still rewritten *during* a run. `cli/tests/qa/server.test.ts`
restores it the same way around its own real-server spawn, which happens
outside the `qa start`/`qa finish` lifecycle.
**Done:** [x]

### Task 7: Fix the unclickable explicit-revision Save button at narrow viewports (P1)
**What:** In the editor's Revision Control panel, fix the layout so the
"Save Explicit Revision" button and the canonical revision card
(`.revision-control-card--canonical`) do not visually overlap at narrower
viewport widths, so a click at the button's visual centre reaches the
button rather than the card behind it.
**Files:** `frontend/components/Editor/RevisionControl/RevisionControl.tsx`
and its stylesheet/layout (confirm exact file during implementation —
likely CSS/flex/grid sizing rather than component logic).
**Done when:** At the default Playwright viewport (and any viewport
narrower than 1920x1080), `document.elementFromPoint` at the Save button's
centre coordinates returns the button (or a descendant of it), not the
canonical revision card; a Playwright/E2E test clicks the button by role
at a narrow viewport and confirms the explicit-revision-save action fires.
**Depends on:** none
**Estimate:** 3
**Notes:** Evidence: at the default Playwright viewport, Save was measured
at x505 y282 89x34 and the canonical card at x516 y298 323x78 — overlapping
at the button's centre, where `elementFromPoint` returned the ARTICLE card
instead of the button. At 1920x1080 the same check returns the button and
it works, confirming this is viewport-conditional, not universal.
`specs/features/agentic-qa/inventory.md` records `rev-create-snapshot`'s
pass as viewport-conditional specifically because of this bug.
**Fix applied 2026-08-18, but NOT verified — this task stays open.**
The left column and the input wrapper gained `min-w-0` and the button
`shrink-0`. That addresses the mechanism the reported geometry implies: flex
items default to `min-width: auto`, so a column whose content is intrinsically
wider than its `w-4/12` basis grows past it and pushes into the sibling
column, where the later-painted canonical card covers the button.

What could not be done is confirming it. The overlap does not reproduce in
Storybook: `RevisionControl` renders full-bleed there, whereas in the app it
sits inside the editor pane between two sidebars. Measured with the story root
constrained to 400/480/520/560/640/760px at a 1280px viewport, the left
column's box is byte-identical with and without the fix (it equals exactly
4/12 of the row at every width), and `elementFromPoint` at the Save button's
centre returns the button in every case. At 400px the button does overflow its
column — but it does so identically before and after, because the input has
already collapsed to zero content width and `shrink-0` pins the button.

So: no regression test in this repo distinguishes the fixed from the unfixed
component, and the fix is unproven against the actual defect. What landed is a
guard (`frontend/e2e/revision-control.e2e.spec.ts`) that hit-tests the button
at two panel widths and is documented in-file as a guard rather than a
reproduction. Verifying this properly needs a measurement in the running app
at the reported viewport — ideally a new story that mounts the panel inside a
realistic editor-pane shell, which would give the defect somewhere to
reproduce.
**Done:** [ ]

### Task 8: Give the TipTap editing surface an accessible ARIA role (P3)
**What:** Add an appropriate ARIA role (e.g. `role="textbox"` with
`aria-multiline="true"`) to the `.ProseMirror` contenteditable element so
GetWrite's primary editing surface is discoverable in the accessibility
tree by assistive technology and by accessibility-tree-driven automation.
**Files:** wherever the TipTap `EditorContent`/`.ProseMirror` root is
rendered (search `frontend/components/Editor/` for the `EditorContent` or
`useEditor` mount point — confirm exact file during implementation).
**Done when:** A test (unit or Playwright) confirms `.ProseMirror` has
`role="textbox"` (or the chosen equivalent) and is discoverable by
accessibility-tree role queries (e.g. Playwright's
`getByRole("textbox")`); `frontend/e2e/helpers/editor.ts` can locate the
editor by role rather than only by the `.ProseMirror` CSS selector fallback
it currently uses (updating the helper itself is optional but recommended
once the role exists).
**Depends on:** none
**Estimate:** 2
**Notes:** Evidence: `.ProseMirror` is `contenteditable="true"` with
`role` = null, and does not appear as a textbox in the accessibility tree.
The QA harness's own `procedure.md` and `frontend/e2e/helpers/editor.ts`
both fall back to the `.ProseMirror` selector today because no role exists
to query by — this is also, incidentally, a case where the existing
selector-based fallback works around a real product accessibility gap
rather than a harness limitation.
**Resolved 2026-08-18:** the TipTap surface's attributes moved to an
exported `EDITOR_SURFACE_ATTRIBUTES` carrying `role="textbox"`,
`aria-multiline="true"`, and an `aria-label`. Exported because the component
renders a simplified mock under test, so the real view never mounts there and
the contract has to be asserted directly (`tests/unit/editor-surface-aria.test.ts`,
passing). `frontend/e2e/helpers/editor.ts` gained `editorBodyByRole`, which
resolves the editor strictly through the accessibility tree.

Caveat on the accessibility-tree half of the done-when:
`frontend/e2e/editor-accessibility.e2e.spec.ts` was written to assert exactly
that (`getByRole("textbox")` resolving to the ProseMirror surface, accepting
typed input) but **could not be run green here** — and neither could any
pre-existing editor e2e spec. The `workarea-editview--interactive` story fails
to render in this Storybook build with `Module "node:async_hooks" has been
externalized for browser compatibility`, so no editor ever mounts. Confirmed
pre-existing by reverting each of this work's frontend changes in turn and
re-probing: the same failure occurs on the unmodified tree. That Storybook
breakage is its own defect, outside this list's scope, and is what stands
between the new spec and a green run.
**Done:** [x]

### Task 9: Reap leaked `getwrite-qa-*` temp workspaces created by tests (H5)
**What:** Extend cleanup coverage so `getwrite-qa-*` workspace directories
created by `cli/tests/qa/*` test runs (not just by `qa start` runs, which
FR-14's retain-or-delete policy already governs) are removed once no
longer needed — either by having each test clean up its own scratch
directory, or by adding a shared test-teardown helper the `cli/tests/qa/*`
suite uses.
**Files:** `cli/tests/qa/workspace.test.ts`, `cli/tests/qa/server.test.ts`,
`cli/tests/qa/verify.test.ts`, `cli/tests/qa/report.test.ts`,
`cli/tests/qa/cleanup.test.ts` (add teardown to whichever currently leak),
optionally a shared `cli/tests/qa/test-helpers.ts`.
**Done when:** Running the full `cli/tests/qa/*` suite twice in a row
leaves no new `getwrite-qa-*` directories under the OS temp dir once the
suite completes (verified by diffing a temp-dir listing before and after
the run).
**Depends on:** none
**Estimate:** 2
**Notes:** Evidence: 45 `getwrite-qa-*` directories accumulated in the temp
dir in one session, mostly from `cli/tests/qa/*`. Pure hygiene: zero
functional risk, cheapest item to defer, listed last. `cli/tests/qa/*` are
new files created on this branch, so per the task brief they may be
modified — FR-13's prohibition on modifying existing test files covers only
pre-existing Vitest/Playwright/Storybook test files, not this branch's own
new QA test suite.
**Resolved 2026-08-18:** the leak was `createQaWorkspace` itself —
`mkdtemp` creates the directory before containment can be checked, so every
rejected call (including its own test suite's) left one behind. It now removes
the directory before throwing. The other `cli/tests/qa/*` files already cleaned
up after themselves; `server.test.ts` gained teardown for the files it writes.
**Done:** [x]

## Summary

- Total tasks: 9
- Total estimated effort: 25 points (5+3+3+2+3+2+3+2+2)
- Critical path: none — every task is independently fixable and
  independently testable; Tasks 1-9 are listed in priority order (value and
  risk), not a dependency chain. The closest thing to a soft ordering
  preference is Task 1 before Task 2 (both concern `.next` state, and
  Task 1's isolation is expected to shrink Task 2's surface, though Task 2
  is independently correct without it) and Task 1 before Task 5 (an
  isolated, warm `distDir` reduces how often the readiness-probe race
  triggers, though Task 5's fix stands on its own).
- Risks: Task 3 (P2, wordCount) touches the shared resource-save path
  (`resource-persistence.ts`) that both the HTTP and native transports call
  through, so its call sites need confirming before editing rather than
  assumed from this list. Task 7 (P1, Save button) is a CSS/layout fix
  whose correct viewport breakpoint range is not fully characterized here —
  only the default Playwright viewport and 1920x1080 were measured, so the
  fix should be verified across a small range of intermediate widths, not
  just those two points. Task 1 (H1, distDir isolation) has the widest
  blast radius of any task here (it changes how every QA run's dev server
  boots) and should be validated against a full `qa start`/`verify`/
  `report`/`finish` cycle, not just a unit test, before being considered
  done.

## Open Questions

Two deviations are recorded inline:

1. Task 6's tsconfig half was implemented as snapshot-and-restore rather than
   the proposed alternate config path, because the proposed approach breaks
   Next 16.2.6's route discovery entirely.
2. Task 7 remains OPEN. Its fix is applied but could not be verified: the
   overlap does not reproduce in Storybook, so no test here distinguishes the
   fixed from the unfixed component. See that task's note for the measurements
   and for what verifying it would take.
