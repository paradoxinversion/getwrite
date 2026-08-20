# Agentic QA — Operating Procedure

Audience: a Claude Code session holding the Playwright MCP tools (declared as
`playwright` in `.mcp.json`), acting as "the agent" per
`specs/features/agentic-qa.md`'s Overview. This document is the procedure
that session follows during a run (executed for real in Task 13). It is not
application code and introduces no new browser-automation runtime — it only
sequences the already-configured Playwright MCP tools and the
`getwrite-cli qa` subcommands (Task 1/Task 9) and the `cli/src/qa/verify.ts`
functions (Task 5) against the four items in
`specs/features/agentic-qa/inventory.md` (Task 7): `proj-create-manifest`,
`res-create-content-files`, `res-save-content-roundtrip`,
`rev-create-snapshot`.

Follow this document top to bottom, in order, without additional
interpretation. Where a step names a tool, use that tool — do not substitute
an equivalent you judge to be simpler.

## 0. Vocabulary and boundary this procedure enforces

- **Navigation** — locating and choosing what to click, type into, or read
  the state of, in order to perform a user-facing action (open a menu, click
  a button, fill a field, select an item in the resource tree). Per FR-3,
  navigation MUST be done exclusively by reading the Playwright MCP
  accessibility snapshot (`browser_snapshot`) and acting on it by role and
  accessible name (and, where needed, state — e.g. `disabled`, `expanded`).
  Never write or use a fixed CSS/XPath selector map for navigation. Never
  hardcode an element handle, test id, or DOM path as the way to find what to
  interact with.
- **Readiness probe** — a narrow, one-time check of whether a specific,
  already-known surface has finished mounting, before acting on it. FR-3's
  prohibition on a fixed selector map applies to navigation, not to this. The
  one documented readiness probe in this procedure is the TipTap
  `data-placeholder` DOM check in Section 3 below, which uses
  `browser_evaluate` (DOM evaluation) because that attribute has no
  accessibility-tree representation at all — there is no role/name path to
  observe it by, so accessibility-tree navigation cannot substitute for it.
  Using `browser_evaluate` for this one check is not navigation and does not
  violate FR-3.

Every other observation in this procedure — locating buttons, tree items,
menu items, dialogs, form fields, and reading their post-action state — MUST
use the accessibility snapshot, never `browser_evaluate` or a selector map.

## 1. Outcome vocabulary

Record exactly one outcome per inventory item, per run:

- **pass** — the UI reported the action succeeded AND the matching
  `verify.ts` function returned `status: "pass"`.
- **fail** — either (a) the UI reported the action succeeded but the
  matching `verify.ts` call returned `status: "fail"` (FR-6: a UI success
  with no matching artifact is a fail, never a silent pass), or (b) the UI
  itself reported an error/failure for the action.
- **unreachable** — the agent could not even attempt the action because an
  expected control (identified by role/name) is not present in the
  accessibility snapshot, or is present but not actionable (e.g. permanently
  disabled, never becomes visible after a reasonable wait). This is distinct
  from `fail`: `fail` means the agent completed the action and something
  didn't check out; `unreachable` means the agent never got to complete the
  action at all because the control it needed wasn't there to use. It is
  also distinct from `unverified`: `unverified` means the agent performed
  the action but did not get to run the verification step (e.g. it ran out
  of time, or a prerequisite check for a later item failed first); FR-11
  requires `unreachable` and `unverified` never collapse into each other or
  into a silent omission.
- **unverified** — the agent performed the user-facing action and observed
  a UI outcome, but did not complete the corresponding `verify.ts` call
  (e.g. the run was interrupted, or a blocking prerequisite for the
  verification step itself failed).

Every inventory item MUST end the run with exactly one of these four values
recorded. Do not leave an item unrecorded.

## 2. Harness invocation (FR-13)

Run these once at the start and end of the QA session, in order:

1. `getwrite-cli qa start` — creates the disposable out-of-tree workspace,
   starts a `pnpm --filter getwrite-frontend dev` instance on a free port
   with `GETWRITE_PROJECTS_DIR` pointed at that workspace, and prints the
   workspace path and the server URL (e.g. `http://localhost:<port>`).
   Record both; they are used for the rest of the run. `qa start` persists a
   session record outside the repo — do not create or edit that file
   directly.
2. Use `browser_navigate` (Playwright MCP) to open the printed server URL.
   All subsequent navigation happens inside this app instance, against this
   workspace, for the rest of the run.
3. As each inventory item is exercised (Sections 3–4 below), call
   `getwrite-cli qa verify <kind> <args>` for the matching artifact kind
   immediately after observing the UI outcome for that item.

   **Every `qa verify` call MUST pass `--item-id <inventory id>` and
   `--ui-outcome "<what the UI reported>"`.** These are not optional
   bookkeeping:

   - Without `--item-id`, the harness invents an id (`resource-content-2`),
     so the report cannot be traced back to the inventory item it is
     reporting on, defeating FR-8's stable identifiers. Passing the same
     `--item-id` for two checks of one item (e.g. content and sidecar in
     4.3) folds them into that single item, which is what makes the
     report's item count match the inventory rather than counting checks.
   - Without `--ui-outcome`, the report renders "(not recorded by the
     agent)" for an item whose UI outcome the agent did in fact observe.
     A report that understates what was checked is a defect in the same
     family as one that overstates it.

   The four ids to use are exactly those in `inventory.md`:
   `proj-create-manifest`, `res-create-content-files`,
   `res-save-content-roundtrip`, `rev-create-snapshot`. Do not batch
   verification calls to the end of the run — call each as soon as its
   action is done, so a `qa finish` invoked early still has a correct
   partial outcome set.
4. After all four items have a recorded outcome (Section 1), run
   `getwrite-cli qa report` to write
   `specs/features/agentic-qa/run-report.md` from the accumulated outcomes
   (Section 5 below).
5. Run `getwrite-cli qa finish` last. It stops the dev server, applies the
   retain-or-delete workspace policy from the recorded outcomes (FR-14: keep
   the workspace if any item is `fail` or `unverified` or `unreachable`;
   delete it only if every exercised item is `pass`), and removes the
   session record.

Do not modify, delete, or disable any existing Vitest or
Playwright/Storybook test file at any point in this procedure (FR-13).

### 2.1 Do not run the harness inside a command sandbox

`qa start` must be run **without** a command sandbox (in Claude Code, that
means `dangerouslyDisableSandbox`). The same applies to
`cli/tests/qa/server.test.ts`, which spawns a real dev server.

Sandboxed, the run appears to work and then fails in a way that looks like a
product defect: the dev server starts, reports `✓ Ready`, and then answers
**every** request with a 404 until the readiness budget expires (4 minutes),
ending in

```
[qa start] Failed to start QA session: QA dev server did not become ready
within 240000ms (http://localhost:<port>) — .../ responded 404
```

It needs *both* the sandbox and the run-scoped `distDir` the harness uses.
Measured directly:

| Sandbox | `distDir`          | `/` |
| ------- | ------------------ | --- |
| on      | default `.next`    | 200 in ~7s |
| off     | run-scoped `.next-qa/<runId>` | 200 in ~8s |
| **on**  | **run-scoped**     | **404, indefinitely** |

Two things make this expensive to diagnose from inside a run, so recognise it
from the table rather than re-deriving it:

- The 404s are fast (~20ms) and log no compile step, so they read as "the app
  has no routes" rather than "the server is still starting".
- It is *not* caused by machine load, `NODE_ENV`, hosted-auth env vars, or
  probe cadence — all four were tested and excluded.

If a run must happen under a sandbox, the only known workaround is to let the
server use the default `frontend/.next` (which forfeits the cache isolation
`distDir` exists to provide, and can leave the shared cache poisoned for
ordinary development). Running unsandboxed is strongly preferred.

## 3. TipTap editor readiness wait (FR-15) — read before Section 4

Two of the four inventory items (`res-save-content-roundtrip`, and
`rev-create-snapshot` if the revision is triggered from an editor session
with typed content) require typing into the TipTap editor. TipTap creates
its editor view in a post-mount effect; typing before it is ready is
silently dropped and the content never reaches disk. Before typing into the
editor **on every occasion this procedure calls for it**, wait for both of
the following, in this order, and do not proceed until both hold:

1. **Menu bar and Bold toolbar button visible — checked via the
   accessibility snapshot.** Call `browser_snapshot` and confirm:
   - a landmark/toolbar region corresponding to the editor's menu bar is
     present in the tree, and
   - a control with role `button` and accessible name matching `Bold`
     (case-insensitive exact match, e.g. `/^Bold$/i`) is present.
   If either is absent, take a fresh `browser_snapshot` and re-check (poll)
   rather than typing anyway. This mirrors
   `frontend/e2e/helpers/editor.ts`'s `#editor-menu-bar` and
   `getByRole("button", { name: /^Bold$/i })` waits, translated into
   accessibility-snapshot terms because both the menu bar and the Bold
   button surface as ordinary roles/names in the tree.
2. **ProseMirror empty-doc placeholder attached — checked via
   `browser_evaluate`.** Call `browser_evaluate` with a function that
   queries the page DOM for `.ProseMirror [data-placeholder]` and returns
   whether at least one such element exists, e.g. (conceptually):
   `document.querySelector(".ProseMirror [data-placeholder]") !== null`.
   Poll this (re-invoke `browser_evaluate`) until it returns `true`. This is
   the one documented readiness-probe exception to FR-3's navigation rule
   (Section 0): `data-placeholder` is a DOM attribute with no
   accessibility-tree representation, so there is no role/name equivalent to
   check it by, and it is the definitive post-mount signal
   `frontend/e2e/helpers/editor.ts`'s `waitForEditorReady` proves before any
   Playwright spec types into this editor.

Only once both checks have independently returned true may the agent type.
If either check does not become true within a reasonable bounded wait (poll
for up to ~15 seconds, consistent with the timeout
`frontend/e2e/helpers/editor.ts`'s `typeIntoEditor` uses for its own
commit-verification poll), treat the editor surface as an `unreachable`
control for whichever inventory item needed it (Section 1) — do not type
into a surface that never signaled readiness.

When typing, click into the editor body first. Note that the TipTap surface
exposes NO `role="textbox"` — it is a bare `contenteditable` and does not
appear as a textbox in the accessibility tree at all (verified in the
2026-08-18 run). Locate it the way `frontend/e2e/helpers/editor.ts` does, by
falling back to the `.ProseMirror` contenteditable element. This is a
readiness/eligibility concern about one already-known surface, not
navigation, so it does not violate FR-3. Then type the distinctive text
for that item. After typing, re-read the accessibility snapshot or use
`browser_evaluate` to confirm the typed text is present in the editor's
rendered content before treating the "type" step as done — do not assume
keystrokes committed just because they were sent.

## 4. Per-inventory-item procedure

For every item below: (a) navigate and act using only the accessibility
snapshot per Section 0, (b) observe and record the UI-reported outcome,
(c) immediately call the named `verify.ts` function via
`getwrite-cli qa verify`, (d) record the Section 1 outcome for that item. If
any expected control named below is not present/reachable in the
accessibility snapshot, record `unreachable` for that item and move to the
next one — do not retry indefinitely or fall back to a different selection
mechanism.

### 4.1 `proj-create-manifest`

1. From the app's start/landing screen, use `browser_snapshot` to find a
   control with role `button` (or `link`) and an accessible name indicating
   project creation (e.g. containing "New Project"). Click it.
2. In the resulting dialog/screen, use the accessibility snapshot to find
   the project name field (role `textbox`, accessible name containing
   "Name") and type a distinctive project name (e.g.
   `QA Run <ISO timestamp>`).
3. Find and select a project type control (e.g. a `listbox`/`radiogroup`
   item, or `combobox`, with an accessible name/option matching a known
   project type such as "Blank" or "Article") using role/name only.
4. Find and click the confirming action control (role `button`, accessible
   name containing "Create").
5. Observe the UI outcome: the accessibility snapshot should show the new
   project selected/active (e.g. its name appears as the active project
   heading, or the resource tree for it is now visible). Record this as the
   UI-reported outcome — success if the new project appears as the active
   workspace, failure if an error message/toast is shown instead.
6. Call `getwrite-cli qa verify project-manifest <projectId>` (the CLI
   subcommand's argument for the `project-manifest` kind), which invokes
   `verifyProjectManifest(workspaceRoot, projectId, { name: <the typed
   name> })` against the run's workspace. Resolve `projectId` from whatever
   the UI/app surfaces for the newly created project (e.g. visible in the
   accessibility tree, or via a `browser_evaluate` read of the app's URL if
   the app encodes the project id in its route — this route-id read is
   navigation-adjacent bookkeeping, not acting on the page, and is
   permitted because it is not how the agent chooses what to click).
7. Record the Section 1 outcome from steps 5–6.

### 4.2 `res-create-content-files`

Prerequisite: a project exists (reuse the one from 4.1 if it passed or
reached a UI outcome; if 4.1 was `unreachable`, record `unreachable` here
too, since there is no project to create a resource inside, and continue to
4.3/4.4 attempting to work from whatever project state exists).

1. Using the accessibility snapshot, find the resource tree's create-new
   control (role `button`, accessible name containing "New" or "Add" /
   "Create", commonly scoped near the tree root or via a context menu
   reachable by role).
2. Select a document/text resource type if prompted (role/name selection,
   as in 4.1 step 3).
3. If prompted for a name, type a distinctive resource name; otherwise
   accept the default the UI proposes.
4. Confirm creation via the matching role `button` (accessible name
   containing "Create" or equivalent).
5. Observe the UI outcome: the new resource should appear as a node in the
   resource tree (accessibility snapshot shows a new `treeitem`/list entry
   with the given name) and/or open in the work area.
6. Call `getwrite-cli qa verify resource-content <projectId> <resourceId>`
   (no `expectedText` argument at this stage — creation only needs presence,
   per `verifyResourceContent`'s optional third argument), which invokes
   `verifyResourceContent(workspaceRoot, projectId, resourceId)` and checks
   both `content.txt` and `content.tiptap.json` exist.
7. Record the Section 1 outcome from steps 5–6.

### 4.3 `res-save-content-roundtrip`

Prerequisite: a resource exists and is open in the editor (reuse 4.2's
resource).

1. With the resource open, perform the Section 3 readiness wait in full
   before doing anything else in this section.
2. Once both readiness conditions hold, click into the editor body (role
   `textbox`) and type a distinctive string, e.g.
   `QA roundtrip <ISO timestamp>`, per Section 3's typing/confirmation
   steps.
3. Trigger a save: if the app autosaves, use the accessibility snapshot to
   find and wait for a save-status indicator (e.g. a status region reporting
   "Saved"); if the app exposes an explicit save control (role `button`,
   accessible name containing "Save"), click it instead. Prefer whichever
   the accessibility snapshot actually shows in this build — do not assume
   one exists without confirming it in the snapshot first.
4. Observe the UI outcome: a "Saved"/success status observed in the
   accessibility snapshot, versus an error/failure status.
5. Call `getwrite-cli qa verify resource-content <projectId> <resourceId> --expected-text "<the typed string>"`,
   which invokes `verifyResourceContent(workspaceRoot, projectId,
   resourceId, expectedText)` and fails if `content.txt` doesn't contain
   exactly that text. Also call
   `getwrite-cli qa verify resource-sidecar <projectId> <resourceId>`
   (`verifyResourceSidecar`) to confirm the sidecar exists post-save (no
   specific field expectation is required for this item beyond presence,
   per the inventory description).
6. Record the Section 1 outcome from steps 4–5, combining both verify
   calls: `pass` only if both verify calls pass.

### 4.4 `rev-create-snapshot`

Prerequisite: a resource with saved content exists (reuse 4.3's resource
and note its revision count before this step, if the UI surfaces one, so
"distinct from prior revisions" in step 4 below is checkable).

1. Using the accessibility snapshot, find the editor's revision/version
   action (role `button` or menu item, accessible name containing
   "Revision" or "Version" or "Save Revision" — use whatever name the
   snapshot actually shows).
2. Click it, and if a confirming dialog appears, confirm via its role
   `button` accessible name (e.g. "Create" / "Save").
3. Observe the UI outcome: a success indicator (e.g. a new entry appears in
   a revisions/version list visible in the accessibility snapshot, or a
   confirmation toast/status region).
4. Call `getwrite-cli qa verify revision <projectId> <resourceId>` (with an
   `--min-count` argument set to one more than the prior count if known,
   otherwise omitted so `verifyRevision` defaults to requiring at least 1), which invokes `verifyRevision(workspaceRoot, projectId,
   resourceId, expectedMinCount)`.
5. Record the Section 1 outcome from steps 3–4.

## 5. Feeding outcomes to `qa report`

`getwrite-cli qa report` (Task 6) is the only writer of
`specs/features/agentic-qa/run-report.md`; this procedure does not write
that file directly. By the time Section 2 step 4 runs `qa report`, every
one of the four items above MUST have exactly one Section 1 outcome
recorded via a prior `qa verify` call (for `pass`/`fail`) or otherwise
tracked by the agent for the `unreachable`/`unverified` cases, which have no
corresponding `verify.ts` call to make — for those two cases, report them to
`qa report`/the session record by whatever argument or mechanism `qa
report`'s interface (Task 9) exposes for recording an outcome without a
verify call, rather than inventing a synthetic pass/fail verify result to
stand in for them. `qa report` is responsible for rendering, per FR-16, a
coverage-boundary statement (item count exercised, feature areas in scope —
projects, resources, revisions only per FR-12 — and an explicit statement
that all other product areas are unchecked by this run) alongside the
per-item outcomes this procedure produced; this procedure's job ends at
producing a correct, complete outcome per item, not at formatting the
report file itself.

After `qa report` completes, run `getwrite-cli qa finish` (Section 2 step
5) to close out the run.
