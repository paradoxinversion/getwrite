# Agentic QA — MVP: Task List

Source: `specs/features/agentic-qa.md` (approved, frozen; open questions: none).
Granularity: story points (1/2/3/5/8).

## Where the harness code lives

**Recommendation: `cli/` (`getwrite-cli qa run`), new modules under `cli/src/qa/`
and a new `cli/src/commands/qa.ts` command.**

Justification:

- `cli/` is already described in its own `package.json` as "Standalone
  command-line tools for GetWrite projects," already depends on `playwright`
  (the `screenshots capture` command drives a real browser against
  Storybook today), and already has a precedent for spawning/controlling
  processes and scaffolding project trees (`project create`, `doctor`).
  The QA harness — spawn a dev server, mkdtemp a workspace, drive a
  browser-attached agent, write a report — is the same shape of work.
- The harness must run *against* a spawned `frontend` dev server, not run
  as part of the Next.js app itself, so it does not belong under
  `frontend/` — there is no route, component, or Redux state to add, and
  bundling it into the Next build would pull Node-only child-process/tmpdir
  code into a build that also ships to the browser.
  `frontend/e2e/helpers/editor.ts` is reused for its *readiness signal*
  (FR-15), not as a reason to locate the harness inside `frontend/e2e/` —
  that directory is Playwright-test-file territory, and FR-13 explicitly
  forbids touching existing Vitest/Playwright/Storybook test files, so new
  harness code should not live alongside them.
- A brand-new pnpm workspace package (e.g. `qa/`) would need its own
  `package.json`, `tsconfig.json`, build script, and `pnpm-workspace.yaml`
  entry for what is, at MVP scope, one CLI command and roughly five small
  modules (workspace, server, verification, report, inventory I/O). That is
  disproportionate scaffolding for the current scope and would duplicate
  `cli/`'s existing esbuild/vitest setup rather than reuse it.
- Electron's dev-vs-packaged spawn pattern (`electron/src/main.ts` spawning
  the Next standalone server) is the closest existing precedent for
  "spawn a Next.js server as a child process and manage its lifecycle" —
  worth consulting for shape, but that code is Electron-specific
  (packaged-app resource paths) and not reusable directly; the new
  `cli/src/qa/server.ts` module targets `pnpm dev`, not the standalone
  build.

New files (all under `cli/`, created across the tasks below):
`cli/src/commands/qa.ts`, `cli/src/qa/workspace.ts`, `cli/src/qa/server.ts`,
`cli/src/qa/cleanup.ts`, `cli/src/qa/verify.ts`, `cli/src/qa/report.ts`,
plus their `cli/tests/qa/*.test.ts` counterparts, and the two hand-authored
markdown artifacts `specs/features/agentic-qa/inventory.md` and (as a
template/seed) `specs/features/agentic-qa/run-report.md`.

## FR coverage map

| FR | Covered by |
| --- | --- |
| FR-1 | Task 2 |
| FR-2 | Task 2 |
| FR-3 | Task 8, Task 13 |
| FR-4 | Task 8, Task 13 |
| FR-5 | Task 5, Task 13 |
| FR-6 | Task 5, Task 13 |
| FR-7 | Task 7 |
| FR-8 | Task 7 |
| FR-9 | Task 6, Task 13 |
| FR-10 | Task 6, Task 13 |
| FR-11 | Task 6, Task 8, Task 13 |
| FR-12 | Task 7 |
| FR-13 | Task 1, Task 3, Task 9 |
| FR-14 | Task 4 |
| FR-15 | Task 8, Task 13 |
| FR-16 | Task 6, Task 13 |

Every FR-1..FR-16 is covered by at least one task.

---

### Task 1: Scaffold the `qa` CLI command
**What:** Add a new `getwrite-cli qa` subcommand group skeleton — `qa start`,
`qa verify`, `qa report`, and `qa finish` (argument parsing, help text,
wiring into `commander`) — with no behavior yet beyond each printing a "not
yet implemented" stub, establishing the module layout later tasks fill in.
**Files:** `cli/src/getwrite-cli.ts` (register subcommand group), new
`cli/src/commands/qa.ts`, new empty `cli/src/qa/` directory.
**Done when:** `getwrite-cli qa --help` lists all four subcommands, each of
`getwrite-cli qa start --help`, `qa verify --help`, `qa report --help`, and
`qa finish --help` prints usage, and running each subcommand exits cleanly
with a visible "not implemented" message; `pnpm --filter getwrite-cli
typecheck` and existing `cli` tests still pass.
**Depends on:** none
**Estimate:** 2
**Notes:** Purely additive — do not touch `cli/src/commands/*` for existing
commands. This satisfies the "invoked on demand by the maintainer" half of
FR-13; the dev-server lifecycle half is Task 3.
**Done:** [ ]

### Task 2: Disposable workspace creation (FR-1, FR-2)
**What:** Implement `cli/src/qa/workspace.ts`: a function that creates a
fresh directory via the standard `fs.mkdtemp`/OS temp-dir pattern, located
outside the repository tree (verified, not merely assumed, by resolving
both paths and asserting non-containment), and returns its absolute path
for use as `GETWRITE_PROJECTS_DIR`.
**Files:** new `cli/src/qa/workspace.ts`.
**Done when:** Calling the function twice returns two distinct paths, each
under the OS temp directory and each outside `path.resolve(repoRoot)`; a
guard throws if the resolved repo root is ever detected as an ancestor of
the created path.
**Depends on:** Task 1
**Estimate:** 3
**Notes:** This is the mechanism that makes FR-2 ("MUST NOT read from or
write to the real `projects/` directory") true by construction, per the
spec's own framing — the containment check is what makes that a build-time
guarantee rather than a convention.
**Done:** [ ]

### Task 3: Dev server spawn/stop with pre-set `GETWRITE_PROJECTS_DIR` (FR-13)
**What:** Implement `cli/src/qa/server.ts`: spawn `pnpm --filter
getwrite-frontend dev` (or equivalent) as a child process with
`GETWRITE_PROJECTS_DIR` set in its environment to the workspace path
*before* the process starts, pick a free port rather than assuming 3000 is
available, wait for the server to report ready, and expose a stop function
that terminates the child process and waits for exit.
**Files:** new `cli/src/qa/server.ts`.
**Done when:** A test can start a server against a scratch workspace on a
free port, confirm it accepts requests, and stop it, with no reliance on
port 3000 being free (e.g. by binding to port 0 / probing availability
first and passing the resolved port to the child).
**Depends on:** Task 1
**Estimate:** 5
**Notes:** Parallelizable with Task 2 — both depend only on Task 1's
scaffold. `GETWRITE_PROJECTS_DIR` is read once at server start
(`frontend/src/lib/models/projects-dir.ts`), so this module must set the
env var on the child process's `env`, not via a post-start mechanism.
**Done:** [ ]

### Task 4: Retain-on-failure-or-unverified cleanup policy (FR-14)
**What:** Implement `cli/src/qa/cleanup.ts`: given a run's final
inventory-item outcomes, delete the disposable workspace only when every
exercised item passed, and retain it (with a clear message pointing at its
path) when any item failed or was recorded unverified.
**Files:** new `cli/src/qa/cleanup.ts`.
**Done when:** Given an all-pass outcome set, the workspace directory no
longer exists afterward; given any fail or unverified outcome, the
directory still exists and its path is surfaced to the caller.
**Depends on:** Task 2, Task 3
**Estimate:** 2
**Notes:** Depends on both workspace creation (what to delete) and server
lifecycle (must stop the server before deleting its workspace, or deletion
can race an open file handle).
**Done:** [ ]

### Task 5: Filesystem verification module (FR-5, FR-6)
**What:** Implement `cli/src/qa/verify.ts`: a small set of functions, one
per artifact kind named in CLAUDE.md's Data Layer —
`verifyProjectManifest`, `verifyResourceContent`, `verifyResourceSidecar`,
`verifyRevision` — each reading the corresponding on-disk path under a
given `GETWRITE_PROJECTS_DIR` workspace and returning a pass/fail result
with the expected-vs-actual detail needed for a report (FR-10 depends on
this detail existing).
**Files:** new `cli/src/qa/verify.ts`.
**Done when:** Each function, given a workspace path and the relevant
IDs, correctly distinguishes "artifact present and matches" from "artifact
missing or mismatched," and a UI-reported success with no matching artifact
resolves to fail per FR-6 (never a silent pass).
**Depends on:** Task 1
**Estimate:** 3
**Notes:** Parallelizable with Tasks 2, 3, 6, 7. This is the shared
ground-truth-assertion vocabulary the concept doc flags as worth getting
right — keep each function narrowly scoped to one artifact kind so it is
reusable if v1 extends the inventory.
**Done:** [ ]

### Task 6: Report writer module (FR-9, FR-10, FR-11, FR-16)
**What:** Implement `cli/src/qa/report.ts`: given a run's per-item
outcomes (pass/fail/unverified/unreachable — see Task 8's note on the
"cannot complete at all" case), write a single overwritten
`specs/features/agentic-qa/run-report.md`, including for every failure the
UI outcome, the filesystem check result, and the concrete on-disk paths
checked (FR-10); a distinct, explicitly-labeled outcome for items the
agent could not reach at all (FR-11); and a coverage-boundary statement —
item count exercised, feature areas in scope, and an explicit "all other
product areas are unchecked by this run" line — present even when every
item passed (FR-16).
**Files:** new `cli/src/qa/report.ts`.
**Done when:** Given a mix of pass/fail/unverified/unreachable outcomes,
the written file contains a per-item status, failure detail sufficient to
identify what broke without re-running (per FR-10's own test: a human-
readable expected-vs-actual plus concrete paths, not a replay script), and
the coverage-boundary statement; given an all-pass outcome set, the
coverage-boundary statement is still present.
**Depends on:** Task 1
**Estimate:** 3
**Notes:** Parallelizable with Tasks 2, 3, 5, 7. The report is overwritten
each run by design (FR-9) — do not add timestamped/retained report
directories, that is an explicit v1 non-goal.
**Done:** [ ]

### Task 7: Hand-author the feature inventory (FR-7, FR-8, FR-12)
**What:** Write `specs/features/agentic-qa/inventory.md` by hand: at least
one verifiable item each for project creation, resource creation, resource
content save, and revision creation (four items minimum), each with a
stable identifier, a human-readable description, and a status field drawn
from exactly `pass | fail | unverified` — no other feature areas included.
**Files:** new `specs/features/agentic-qa/inventory.md`.
**Done when:** The file lists >=4 items covering all four required
categories, each with id/description/status fields, all statuses set to
`unverified` (no run has executed yet), and no item outside
projects/resources/revisions.
**Depends on:** none
**Estimate:** 2
**Notes:** Parallelizable with everything else — pure content authoring,
no code dependency. Per FR-7, this is deliberately hand-authored, not
derived from specs/stories/test names; do not build a derivation step.
**Done:** [ ]

### Task 8: QA agent operating procedure (FR-3, FR-4, FR-11, FR-15)
**What:** Write the operating procedure the QA agent (the Playwright MCP
server driven by a Claude Code session, per the spec's Overview) follows
during a run — not application code, but a prompt/procedure document: for
each inventory item, perform the user-facing action via accessibility-tree
navigation only (role/name/state-based, no fixed selector map — the FR-3
prohibition applies to navigation, not to a narrow readiness probe);
observe the UI-reported outcome; call the Task 5 verification functions
against the workspace; before typing into the TipTap editor, wait for the
same readiness signal `frontend/e2e/helpers/editor.ts` proves, observed by
two different means for its two different parts — the menu bar and the
Bold toolbar button visible, checked via the accessibility snapshot (both
surface as roles and names in the accessibility tree), and the ProseMirror
empty-doc placeholder attached, checked via DOM evaluation using the
Playwright MCP server's `browser_evaluate` tool, because `data-placeholder`
is a DOM attribute with no accessibility-tree representation and is the
definitive post-mount signal FR-15 requires; using DOM evaluation for this
one narrow, documented readiness probe does not violate FR-3, whose
prohibition on a fixed selector map applies to navigation, not to this
probe; and record a distinct "unreachable" outcome (not a pass, not a
generic fail) when an expected control is not present or not reachable.
**Files:** new `specs/features/agentic-qa/procedure.md` (or an equivalent
location the lead can redirect at the gate — flagged here as a concrete
choice, not an open question).
**Done when:** The document gives an unambiguous, step-by-step-enough
procedure that a Claude Code session holding the Playwright MCP tools can
follow without additional interpretation, explicitly states the FR-3
navigation-vs-readiness-probe boundary, names the exact TipTap readiness
signal to wait for and how each of its parts is observed (accessibility
snapshot for the menu bar and toolbar button, DOM evaluation for the
ProseMirror placeholder), and defines the unreachable-outcome case
distinctly from fail/unverified.
**Depends on:** Task 7
**Estimate:** 3
**Notes:** This is explicitly *not* a coding task — no new browser-
automation runtime is in scope (Overview, Non-goals). Depends on Task 7
only so the procedure can reference the inventory's actual item ids.
**Done:** [ ]

### Task 9: Wire the `qa start` / `qa verify` / `qa report` / `qa finish` subcommands (FR-13)
**What:** Complete `cli/src/commands/qa.ts` and `cli/src/getwrite-cli.ts`
with four subcommands that let an out-of-process Claude Code session
(driving the browser via Playwright MCP) act against a run whose
workspace, dev server, and verification/report code all live inside the
CLI process:
- `qa start` — creates the workspace (Task 2), starts the dev server on a
  free port against it (Task 3), and writes a session record to a fixed
  path outside the repo (`path.join(os.tmpdir(), "getwrite-qa",
  "session.json")`) containing the workspace path, the server port, and
  the spawned server's PID; the server child is spawned detached and
  unref'd so it keeps running after `qa start` exits; prints the workspace
  path and server URL, then returns.
- `qa verify <kind> <args>` — reads the session record, resolves the run's
  workspace from it, and calls the matching Task 5 verification function
  against that workspace, printing the pass/fail/expected-vs-actual result
  for the driving agent session to read.
- `qa report` — reads the session record and the accumulated verification
  outcomes, and calls the Task 6 report writer against the run's
  workspace.
- `qa finish` — reads the session record, stops the server process by its
  recorded PID, applies the Task 4 cleanup policy (retain-or-delete the
  workspace) to the run's final outcome set, and removes the session
  record.

Because the session record is a discoverable file rather than only an
in-memory child-process handle, a run that is abandoned before `qa finish`
runs leaves a traceable workspace path, port, and PID instead of a
silently orphaned process; nothing auto-reaps an abandoned run in MVP
scope, but nothing hides it either.
**Files:** `cli/src/commands/qa.ts`, `cli/src/getwrite-cli.ts`.
**Done when:** `getwrite-cli qa start` starts a server on a free port
against a fresh out-of-tree workspace, prints the workspace path and
server URL, and persists a session record; `qa verify` and `qa report`,
each run as a separate invocation afterward, correctly locate that session
and act against its workspace; `qa finish` stops the server, applies the
Task 4 cleanup policy on a manually-supplied outcome set, and removes the
session record; none of the four subcommands modify, delete, or disable
any existing Vitest or Playwright/Storybook test file (FR-13's explicit
prohibition).
**Depends on:** Task 2, Task 3, Task 4, Task 5, Task 6, Task 8
**Estimate:** 8
**Notes:** This is the integration point — every earlier module task feeds
it. Estimate raised from 5 to 8: the CLI process hosts the workspace,
server, and verification/report code, while the agent driving the browser
runs in a separate out-of-process Claude Code session, so a single
blocking `qa run` invocation could not also accept verification calls from
that session mid-run. The corrected session-oriented shape —
`start`/`verify`/`report`/`finish` plus a session-record read/write path —
is four subcommands' worth of wiring, not one. The CLI process itself
still does not embed a browser-automation runtime; it hands off the
workspace/server URL to the agent session per the Overview's scope
boundary.
**Done:** [ ]

### Task 10: Unit tests for workspace + server + cleanup (FR-1, FR-2, FR-13, FR-14)
**What:** Add Vitest coverage in `cli/tests/qa/` for
`workspace.ts` (out-of-tree containment guard, uniqueness),
`server.ts` (port selection when 3000 is occupied, env var set before
start, clean stop), and `cleanup.ts` (retain-vs-delete branching).
**Files:** new `cli/tests/qa/workspace.test.ts`,
`cli/tests/qa/server.test.ts`, `cli/tests/qa/cleanup.test.ts`.
**Done when:** `pnpm --filter getwrite-cli test` passes, including a case
that simulates port 3000 already in use and asserts the harness picks a
different port rather than failing.
**Depends on:** Task 2, Task 3, Task 4
**Estimate:** 3
**Notes:** New test files only — per `docs/standards/testing.md` and
FR-13, no existing Vitest/Playwright/Storybook test file is modified,
deleted, or disabled by this or any other task in this list.
**Done:** [ ]

### Task 11: Unit tests for filesystem verification (FR-5, FR-6)
**What:** Add Vitest coverage in `cli/tests/qa/verify.test.ts` for each
`verify*` function against fixture workspace trees: matching artifact
(pass), missing artifact (fail), and a UI-success-with-no-artifact case
resolving to fail per FR-6.
**Files:** new `cli/tests/qa/verify.test.ts`.
**Done when:** `pnpm --filter getwrite-cli test` passes and includes at
least one fixture case per artifact kind (project manifest, resource
content, sidecar, revision) plus the FR-6 no-artifact-means-fail case.
**Depends on:** Task 5
**Estimate:** 3
**Notes:** Parallelizable with Task 10 and Task 12.
**Done:** [ ]

### Task 12: Unit tests for the report writer (FR-9, FR-10, FR-11, FR-16)
**What:** Add Vitest coverage in `cli/tests/qa/report.test.ts` asserting
the written `run-report.md` contains failure detail sufficient to diagnose
without re-running, a distinct unreachable-outcome rendering, and the
coverage-boundary statement on both a mixed-outcome run and an all-pass
run.
**Files:** new `cli/tests/qa/report.test.ts`.
**Done when:** `pnpm --filter getwrite-cli test` passes, with an explicit
assertion that the coverage-boundary statement appears even when every
outcome is `pass` (FR-16's specific requirement).
**Depends on:** Task 6
**Estimate:** 2
**Notes:** Parallelizable with Task 10 and Task 11.
**Done:** [ ]

### Task 13: First live QA run and checked-in evidence (FR-3, FR-4, FR-5, FR-6, FR-9, FR-10, FR-11, FR-15, FR-16)
**What:** Execute the first real run: a Claude Code session holding the
Playwright MCP tools runs `getwrite-cli qa start`, follows the Task 8
procedure against the four Task 7 inventory items, performs each action
via accessibility-tree navigation, applies the FR-15 TipTap readiness wait
before typing, calls `qa verify` against the spawned server's disposable
workspace as it works through the items and `qa report` once outcomes are
recorded, then runs `qa finish`, and the resulting
`specs/features/agentic-qa/inventory.md` statuses and
`specs/features/agentic-qa/run-report.md` are committed as the MVP's first
checked-in evidence.
**Files:** `specs/features/agentic-qa/inventory.md` (status fields
updated), `specs/features/agentic-qa/run-report.md` (written by the run).
**Done when:** `run-report.md` exists with a real per-item outcome for all
four inventory items, a coverage-boundary statement, and — for any failure
or unverified item — enough detail to diagnose without re-running;
`inventory.md`'s statuses reflect the run's actual outcomes; the workspace
was retained if any item failed or was unverified, deleted if all passed
(per Task 4's policy as applied by `qa finish`, observed for real).
**Depends on:** Task 7, Task 8, Task 9, Task 10, Task 11, Task 12
**Estimate:** 5
**Notes:** This is a run/execution task, not primarily a code-writing one
— it is the point where the Overview's "produces the first checked-in
evidence of it working" goal is actually satisfied. A genuine failure or
unverified result here is an acceptable, even expected, outcome; do not
treat "make everything pass" as the done condition.
**Done:** [ ]

---

## Summary

- Total tasks: 13
- Total estimated effort: 44 points
- Critical path: Tasks 1 -> 3 -> 4 -> 9 -> 13 (2 + 5 + 2 + 8 + 5 = 22
  points). Task 4 depends on both Task 2 (estimate 3) and Task 3 (estimate
  5); since Task 3's estimate is the larger of the two, the longest chain
  runs through Task 3, not Task 2, even though both depend only on Task 1
  and Task 2 runs concurrently with Task 3, off the critical path. Task 8
  depends on Task 7, and Task 13 depends on Task 8 both directly and via
  Task 9 (which also depends on Task 8) — there is no dependency of Task 8
  on Task 13.
- Risks:
  - Task 3 (dev server spawn/stop with dynamic port selection) is the
    highest-uncertainty module — Next.js dev server startup timing and
    port-conflict handling are the likeliest source of flakiness in the
    harness itself, independent of the product under test — and it now
    sits on the critical path above rather than off it.
  - Task 8's procedure quality is the load-bearing unknown per the concept
    doc: if accessibility-tree navigation of TipTap and the resource tree
    proves unreliable, Task 13 may legitimately record `unverified` items
    rather than clean passes — expected per the spec, but it means Task 13
    cannot be estimated as "run once and done."
  - Tasks 2, 3, 5, 6, 7 are parallelizable (each depends only on Task 1 or
    nothing); Tasks 10, 11, 12 are parallelizable with each other once
    their respective source modules (4-and-earlier, 5, 6) land.

## Open Questions

None. This task list inherits the frozen feature spec's resolved open
questions and introduces no new ones. The one spec-deferred decision this
list had to make — where the harness code lives — is resolved above with a
stated recommendation and justification, not left open, per the brief's
instruction to pick one and justify it rather than reopen it as a question.
