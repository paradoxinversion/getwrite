# Concept: GetWrite Agentic QA

## Problem & Value

GetWrite has 38 Playwright specs, but every one runs against Storybook with
mocked state. They verify that components render and respond; they cannot
verify that the product works. No automated check in this repo exercises the
running app against a real filesystem — so a broken save path, a 500 from an
API route, a sidecar that never lands on disk, or a flow that dead-ends after
three correct-looking steps would all pass CI green. The gap is not test
coverage in the usual sense: it is that nothing confirms the assembled system
does what it claims. That matters more than usual here because GetWrite is
local-first and file-backed — the thing users actually care about is whether
their words are on disk, which is precisely what a component test cannot see
and precisely what an agent driving the real UI can check directly.

## Target Audience

**Primary:** the solo maintainer of GetWrite — one developer shipping a
multi-surface product (web, Electron desktop, Android) with no QA function,
who needs to know before a release that the whole surface still works and
cannot manually retest 40+ user-facing capabilities every time.

**Secondary:** a future contributor who needs a trustworthy statement of what
the product currently does and which parts are verified working — an
executable inventory rather than a README claim.

## Core Concept

An agent that opens a browser, uses GetWrite the way a person would, and
checks the filesystem to see whether the app told the truth.

It drives the real running app rather than a component harness. It navigates
by reading the accessibility tree at each step and deciding what to click,
which means it is not bound to pre-written selectors and can notice things no
assertion anticipated — a control that renders but is unreachable by keyboard,
an error in the console during an otherwise successful save. Where a scripted
test asserts what its author thought to assert, an agent can report what it
actually observed.

The second half is what makes the approach unusually strong for this codebase.
GetWrite has no database: every user action should leave an observable trace
on disk — `content.tiptap.json`, a sidecar under `meta/`, a directory under
`revisions/`, a move into `.trash/`. So the agent never has to trust the UI's
own report of success. It clicks Save, then reads the file. That two-sided
check — UI says it worked, disk confirms it — is the core of the design, and
it is only cheaply available because of the file-backed architecture.

Runs are destructive by necessity (creating, renaming, trashing, deleting
projects), so the agent works against a disposable workspace pointed at by
`GETWRITE_PROJECTS_DIR` and never touches real work. Findings are written back
to the repo as a run report and an updated feature inventory, so verification
status persists across sessions instead of evaporating with the context
window.

## Key Capabilities

- The agent drives the real running application in a browser, navigating from
  what is on screen rather than from hardcoded selectors.
- Every UI-reported success is independently confirmed against the filesystem
  as ground truth.
- Runs execute destructively against a disposable workspace, with no risk to
  real project data.
- Each run produces a checked-in report naming pass, fail, or unverified per
  feature, with evidence for each failure.
- A durable feature inventory carries verification status across runs, so
  coverage accumulates rather than resetting.
- Console errors and failed network requests are captured passively during
  every flow, not only where someone thought to look.
- Runs are scoped to one feature area at a time, so a sweep fits in a single
  agent context.
- The agent surfaces exploratory findings — problems no assertion was written
  for — separately from inventory pass/fail.

## Feature Milestones

**MVP** — proves the two-sided check works and finds real bugs.

1. Disposable workspace harness (`GETWRITE_PROJECTS_DIR` + dev server) — every
   later capability is unsafe to run without it, so it is first.
2. QA agent driving the real UI in a browser — the load-bearing unknown; if
   agentic navigation of this app is unreliable, nothing else matters.
3. Filesystem verification of each UI action — the differentiator over a
   scripted suite; belongs in MVP because without it this is just Playwright.
4. First inventory slice (projects, resources, revisions) plus a checked-in run
   report — the smallest end-to-end output that answers "did it work."

**v1** — makes it trustworthy across the whole web surface.

1. Inventory extended to the full web feature surface (search, queries and
   smart folders, metadata schemas, compile/export, trash, media) — needed
   before a run means anything as a release check.
2. Area-scoped runs with inventory state carried between them — the mechanism
   that makes full coverage possible despite context limits.
3. Passive console-error and network-failure capture on every flow — cheap
   signal that catches faults the scripted path walks past.
4. Failure evidence capture (screenshot, DOM snapshot, relevant file contents)
   — a failure report is not actionable without it.

**v2** — extends past the web app.

1. Packaged Electron desktop runs — catches packaging, projects-dir
   resolution, and update-check faults the web app structurally cannot.
2. Hosted multi-tenant and auth path runs — needs DB and env fixtures, so it
   waits until the local path is proven.
3. Native Android on-device runs — currently a manual gate; the largest lift.
4. Unattended/CI execution with automatic failure filing into Saboteur POS —
   only worth building once on-demand runs are known to have a low false-positive
   rate.

## What This Is Not

- Not a replacement for the Storybook e2e suite or the Vitest unit tests —
  it is a layer above both, and does not justify deleting either.
- Not a self-healing agent: it reports findings and never edits application
  code to make a check pass.
- Not a performance, load, or security testing tool.
- Not a visual regression system — it does not diff screenshots or judge
  layout fidelity.
- Not a CI gate in MVP or v1; it runs on demand, by the maintainer.

## Competitive Landscape

**The existing Storybook + Playwright suite (in-repo)**
Component-level verification with mocked state, run in CI on every push.
Overlaps in that both drive a browser and assert on UI. Differs in that this
runs the assembled app against real storage and can verify persistence.
Worth adopting from it: its selector and accessibility discipline, and its
existing `e2e/helpers` conventions.

**Scripted Playwright against the real app (the obvious alternative)**
The conventional answer to this exact gap: write app-level e2e specs with a
real dev server. Overlaps heavily — it can do the filesystem check too.
Differs in that it asserts only what its author anticipated and breaks when
the UI changes shape. Worth adopting: determinism and speed. A scripted suite
is faster and more repeatable; the agent's advantage is judgment and
resilience to UI change, not execution cost.

**AI-native QA services (QA Wolf, Momentic, Meticulous, Reflect and similar)**
Commercial products that generate, run, and maintain browser tests, several
using AI to author or self-heal them. I am not confident about any specific
product's current feature set or pricing and would not rely on the details
without checking. They overlap on agentic browser driving; they differ in
being hosted SaaS aimed at teams, which makes them poorly suited to a
local-first desktop app whose ground truth is the local filesystem. Worth
learning from: their failure-triage UX, which is generally better than a
markdown report.

**Manual pre-release checklist (the current de facto approach)**
What actually happens today — the maintainer clicks through key flows before
shipping, as with the Pixel gate for Android. Overlaps completely in intent.
Differs in that it does not scale to the full surface and is skipped under
time pressure. Worth adopting: the gate convention already used in the
ADR-021 phases, which is a good model for what "verified" means.

The clearest differentiator is the filesystem oracle. Every general-purpose QA
tool must trust the application's own UI to know whether an action succeeded.
Because GetWrite persists everything as inspectable files, this agent can
verify the actual outcome independently — which turns "the save button showed
a checkmark" into "the bytes are on disk." That is a stronger claim than any
generic tool can make about this product, and it is the reason to build rather
than buy.

## Caveats & Pitfalls

- **Adoption risk:** the maintainer already has a manual checklist that works
  well enough at current scale. If a run takes longer to set up and interpret
  than clicking through the flows by hand, it will not be used — the tool must
  be cheap to invoke and its report fast to read.
- **Execution risk:** agentic browser navigation is unreliable in exactly the
  situations that matter — modals, drag-and-drop reordering, TipTap's
  contenteditable surface, and any flow with a timing dependency. Prior
  attempts at agentic UI testing generally fail here, and GetWrite's editor is
  the least automatable part of the product.
- **Assumption risk:** this assumes an agent's "pass" is meaningful evidence.
  In practice a hard failure (error, missing file, 500) is strong signal,
  while a pass may only mean the agent did not look hard enough. Passes will
  be over-trusted unless the reporting format is explicit about what was
  actually checked.
- **False-positive risk:** an agent that reports flaky or imagined failures
  will be ignored within two runs. Every reported failure must carry
  reproducible evidence, and unverifiable observations must be filed
  separately from confirmed ones.
- **Maintenance risk:** the feature inventory is a second description of the
  product that can drift from the product. If it is not updated alongside
  feature work, runs will report failures against features that were
  deliberately changed.

## Technical Considerations

- **Ground-truth assertion vocabulary** worth exploring: a small shared set of
  filesystem checks (resource persisted, sidecar written, revision created,
  item in trash, index updated) that both the agent and any future scripted
  suite can use. This is the piece most likely to be reused and the most
  costly to get wrong late.
- **Inventory format** worth exploring: whether the feature inventory is prose
  the agent interprets, or structured enough to be machine-checkable and
  diffable. This decision determines whether v2's unattended mode is possible
  without a rewrite.
- **Workspace seeding** worth exploring: whether each run starts from an empty
  workspace or from a committed fixture project. Empty is simpler and tests
  creation paths; a fixture is faster and makes cross-run comparison
  meaningful.

## Open Questions

- Is the feature inventory authored by hand once, or derived from the existing
  specs and Storybook stories? The answer determines the true cost of v1.
- What is the pass/fail contract when the agent cannot reach a feature at all
  — is "could not verify" a failure, or a third state? This shapes every
  report.
- Does a run need to be reproducible by a human following the report, or is
  agent-only reproduction acceptable? Reproducibility raises the cost of the
  reporting format significantly.
- How is the TipTap editor surface verified, given that contenteditable is the
  hardest thing to drive agentically and also the product's core?
- Where do the run report and inventory live, and are run reports retained
  historically or overwritten each run?

## Next Steps

The concept is ready to be specced. The maintainer has scoped this run to the
MVP as a single feature against the web app, with Electron, Android, and
hosted-auth surfaces deferred — so take it to write-feature-spec rather than
write-product-spec, and answer the open questions above during triage.
