# Agentic QA — MVP

## Overview

GetWrite's 37 Playwright specs run against Storybook with mocked state: they
verify components render and respond, not that the assembled, file-backed
product actually works. Nothing in the repo drives the real running app
against a real filesystem and checks that a save, a revision, or a trash
action actually left the trace on disk it claims to. This feature adds an
agentic QA capability: an agent that opens a browser, drives the real
GetWrite web app (`pnpm dev` on `:3000`) the way a person would by reading
the accessibility tree rather than hardcoded selectors, and independently
confirms each UI-reported success against the filesystem — the one oracle
that cannot be fooled by a UI that merely looks like it worked. The MVP
proves this two-sided check is viable end-to-end on a small, real slice of
the product (projects, resources, revisions) and produces the first
checked-in evidence of it working. "The agent" in this spec is the
already-configured Playwright MCP server (declared in `.mcp.json`) driven by
a Claude Code session — its native interaction model of accessibility
snapshots plus click/type-by-role is exactly what FR-3 requires. This
feature builds no new browser-automation runtime; the build scope is the
disposable-workspace harness, the feature inventory file, and the report
writer around that already-configured agent. A central risk this MVP guards
against is the false failure: a check that reports the product broken when
it is actually fine, which erodes trust in the tool fast enough to get it
abandoned within two runs (see FR-15 for the concrete case this drives).

## Goals

- An agent can drive the real GetWrite web app in a browser, navigating from
  what is on screen (accessibility tree) rather than pre-written selectors.
- Every run executes against a disposable, throwaway workspace and never
  reads or writes the maintainer's real `projects/` data.
- For each UI action the agent performs, the corresponding filesystem trace
  (resource file, sidecar, revision, trash entry) is independently read and
  compared against what the UI reported, not merely assumed from the UI.
- A first feature inventory slice covering projects, resources, and
  revisions exists and records a verification status per feature.
- Each run produces a checked-in, human-readable report in the repo naming
  pass, fail, or unverified per inventory item, with evidence for failures.

## Non-goals

- Building a new browser-automation runtime: "the agent" is the
  already-configured Playwright MCP server (`.mcp.json`) driven by a Claude
  Code session; this feature builds only the disposable-workspace harness,
  the inventory file, and the report writer around it.
- Full web feature-surface coverage (search, queries/smart folders, metadata
  schemas, compile/export, trash, media) — deferred to v1.
- Area-scoped runs with inventory state carried between runs, and passive
  console-error/network-failure capture on every flow — deferred to v1.
- Structured failure-evidence capture (screenshot, DOM snapshot, relevant
  file contents attached to a report) — deferred to v1; MVP requires only
  that a failing run's report names the failure and points to what to check.
- Packaged Electron desktop runs — explicitly deferred (v2); this MVP
  targets the Next.js dev server only, not the packaged app, its
  `GETWRITE_PROJECTS_DIR` injection path, or update-check behavior.
- Native Android/Capacitor runs — explicitly deferred (v2); no on-device or
  WebView verification is in scope.
- The hosted multi-tenant + better-auth path — explicitly deferred (v2); no
  `DATABASE_URL`/`BETTER_AUTH_SECRET` env, sign-up/sign-in flow, or
  tenant-isolation check is in scope.
- Unattended/CI execution, including automatic failure filing into Saboteur
  POS — explicitly deferred (v2); MVP runs are on-demand, invoked in-session
  by the maintainer, not wired into any CI workflow.
- Replacing or deleting any part of the existing Storybook/Playwright suite
  or the Vitest unit tests.
- Self-healing behavior: the agent never edits application code to make a
  check pass.
- Performance, load, security, or visual-regression testing.

## User stories

- US-1: As a GetWrite maintainer, I want to have an agent drive the real
  web app against a disposable workspace so that I can find bugs the mocked
  Storybook suite structurally cannot see, without risking my real project
  data.
- US-2: As a GetWrite maintainer, I want to have every UI-reported success
  (save, create, revise) checked against the actual filesystem so that a
  false "it worked" from the UI is caught rather than trusted.
- US-3: As a GetWrite maintainer, I want to have a checked-in report after
  each run telling me what passed, failed, or could not be verified, so
  that I have durable evidence instead of a claim that evaporates with the
  agent's context window.
- US-4: As a future GetWrite contributor, I want to have a small, real
  inventory of verified project/resource/revision features so that I have
  an executable statement of what currently works, not just a README claim.

## Functional requirements

1. FR-1: The harness MUST set `GETWRITE_PROJECTS_DIR` to a workspace
   directory created fresh for the run via the standard `fs.mkdtemp`/OS
   temp-dir pattern, located outside the repository tree entirely (not
   merely distinct from `projects/`), before the Next.js dev server used by
   the run starts serving requests. [US-1]
2. FR-2: The harness MUST NOT read from or write to the repository's real
   `projects/` directory at any point during a run; the workspace's location
   outside the repository tree (FR-1) makes this true by construction rather
   than by convention. [US-1]
3. FR-3: The agent MUST interact with the running web app exclusively
   through browser automation against the accessibility tree (e.g. reading
   roles, names, and states to decide what to click or type), and MUST NOT
   rely on a fixed, pre-written CSS/XPath selector map for navigation. This
   prohibition applies to navigation — finding and choosing what to interact
   with — and does not forbid a narrow, documented readiness probe (see
   FR-15) that determines when a surface is safe to interact with before
   acting on it. [US-1]
4. FR-4: For each in-scope inventory item the agent exercises, the agent
   MUST perform the corresponding user-facing action in the browser (e.g.
   create a project, create a resource, edit and save content, create a
   revision) and observe the UI's reported outcome. [US-2]
5. FR-5: For each action in FR-4, the agent MUST separately read the
   corresponding on-disk artifact under the run's `GETWRITE_PROJECTS_DIR`
   workspace (per CLAUDE.md's Data Layer: `project.json`,
   `resources/<uuid>/content.tiptap.json`, `meta/resource-<uuid>.meta.json`,
   `revisions/<uuid>/v-<N>/`) and record whether that artifact matches what
   the UI reported. [US-2]
6. FR-6: An inventory item MUST be marked passing only when both the
   UI-reported outcome and the filesystem check in FR-5 succeed; a UI
   success with no matching filesystem artifact MUST be recorded as a
   failure, not a pass. [US-2]
7. FR-7: A first feature inventory MUST exist as a single hand-authored
   file at `specs/features/agentic-qa/inventory.md`, listing at least one
   verifiable item each for: project creation, resource creation, resource
   content save, and revision creation. It is hand-authored rather than
   derived from existing specs, Storybook stories, or e2e test names —
   derivation is disproportionate for a 4-item MVP list and is deferred
   alongside the full-surface inventory (see Out of scope). [US-4]
8. FR-8: Each inventory item MUST record, at minimum, a stable identifier,
   a human-readable description of the feature being checked, and its most
   recent verification status. `pass`, `fail`, and `unverified` are the
   complete set of statuses — there is no fourth value. [US-4]
9. FR-9: Each run MUST produce a single checked-in report file at
   `specs/features/agentic-qa/run-report.md`, overwritten on each run
   (retention across runs is provided by git history, since the file is
   checked in — timestamped or retained report directories are deferred to
   v1), summarizing, per inventory item exercised in that run, its
   pass/fail/unverified status. Comparing pass/fail trends across runs
   remains a v1 non-goal. [US-3]
10. FR-10: A report MUST record, for every failure, what the agent observed
    (the UI outcome and the filesystem check result) in enough detail that
    the maintainer can identify what broke without re-running the agent.
    Concretely, this means a human-readable record of the expected-vs-actual
    outcome and the concrete on-disk paths checked — not a step-by-step
    script a human could replay by hand to reproduce the run. [US-3]
11. FR-11: When the agent cannot complete an in-scope action at all (e.g. a
    control it expected is not present or not reachable), the run MUST
    record that item as a distinct, explicitly-labeled outcome in the
    report rather than silently omitting it or recording it as a pass.
    [US-2][US-3]
12. FR-12: The MVP scope of the inventory MUST be limited to projects,
    resources, and revisions; extending it to other feature areas is out
    of scope for this spec. [US-4]
13. FR-13: A run MUST be able to be invoked on demand by the maintainer,
    with the harness itself spawning and stopping its own Next.js dev server
    instance for the run — with `GETWRITE_PROJECTS_DIR` pre-set in that
    instance's environment per FR-1 — rather than assuming the maintainer
    already has a dev server running. This is because
    `GETWRITE_PROJECTS_DIR` is read from `process.env` once at server start
    and cannot be changed on an already-running process, so a pre-started
    `pnpm dev` cannot be redirected into the run's disposable workspace. The
    harness MUST NOT assume port 3000 is free. Invocation MUST NOT modify,
    delete, or disable any existing Vitest or Playwright/Storybook test
    file. [US-1]
14. FR-14: The harness MUST delete the run's disposable workspace only when
    every exercised inventory item passes, and MUST retain it (not delete
    it) when the run records any failure OR any unverified item, so the
    on-disk state needed to diagnose a failure or an unverified result
    (per FR-10's evidence requirement) remains available after the run
    ends. [US-1]
15. FR-15: Before typing into the TipTap editor surface, the agent MUST wait
    for editor readiness — the menu bar visible and the ProseMirror
    empty-doc placeholder attached, the same signal
    `frontend/e2e/helpers/editor.ts` already proves for the existing
    Playwright suite — rather than typing as soon as the contenteditable
    element exists. TipTap creates its editor view in a post-mount effect,
    so typing before that signal is silently dropped: the content never
    reaches disk, and without this wait the FR-5 filesystem check would
    report content-save as broken when the application is actually fine —
    the false-failure case called out in the Overview. [US-2]
16. FR-16: A report MUST state its own coverage boundary: at minimum, the
    number of inventory items that exist and were exercised in the run, the
    feature areas in scope (projects, resources, revisions per FR-12), and
    an explicit statement that all other product areas are unchecked by
    this run rather than known-working. A report in which every exercised
    item passes MUST NOT be expressible as an unqualified claim that the
    product works — the coverage-boundary statement MUST accompany even a
    fully-passing result. This guards against the inventory's hand-authored
    nature (FR-7): a small, correct inventory can still create a false
    impression of whole-product health if the report doesn't say what it
    did and didn't check. [US-3][US-4]

## Open questions

None. All 8 questions raised while drafting this spec (OQ-1 through OQ-8)
were resolved at triage before this spec's gate. Their resolutions are
folded into the requirements above — FR-1, FR-2, FR-3, FR-7, FR-8, FR-9,
FR-10, FR-13, FR-14, FR-15 — and into the Overview and Non-goals sections.
No open questions remain.

## Out of scope (deferred)

- Deriving the feature inventory automatically from existing specs,
  Storybook stories, or e2e test names, instead of hand-authoring it —
  disproportionate for a 4-item MVP list; belongs with the full-surface
  inventory below — v1.
- Inventory extended to the full web feature surface (search, queries and
  smart folders, metadata schemas, compile/export, trash, media) — v1.
- Area-scoped runs with inventory state carried between runs, including
  cross-run trend comparison of pass/fail status — v1.
- Passive console-error and network-failure capture on every flow — v1.
- Structured failure-evidence capture (screenshot, DOM snapshot, relevant
  file contents) attached to a report; timestamped/retained report
  directories beyond the single overwritten `run-report.md` — v1.
- Packaged Electron desktop runs — v2.
- Hosted multi-tenant and better-auth path runs — v2.
- Native Android on-device runs — v2.
- Unattended/CI execution with automatic failure filing into Saboteur POS —
  v2.
- A drift detector that cross-references the inventory against enumerable
  sources in the repo (e.g. API route files under `frontend/app/api/`,
  `*.e2e.spec.ts` files under `frontend/e2e/`, `*.stories.tsx` files under
  `frontend/stories/`) and lists sources with no corresponding inventory
  item, flagging candidates for a human to triage. Unlike deriving the
  inventory automatically (above), this does not generate inventory items —
  it only reports uncovered candidates, which makes it substantially
  cheaper and lets it degrade gracefully. Deferred rather than built now
  because against the 4-item MVP inventory it would report roughly
  34 uncovered API routes on every run, which is noise until the inventory
  expands at v1 — v1.
