# Refactor: Brevity & Clarity

Branch: `refactor/brevity-and-clarity`. Goal: reduce code to its clearest form
**without changing observable behavior**. Not a feature reshape — no public API
signatures change inside a slice unless the slice's doc says so explicitly.

The codebase (~48k lines of non-test source) is split into **12 vertical domain
slices**. Each slice is a self-contained unit of work spanning its core logic
(`src/lib/models`, `src/store`, `app/api`) and its UI (`frontend/components`), so
one agent can refactor a whole feature with the tests that cover it.

## Slices

| #   | Slice                         | ~Lines | Risk | Status               | Doc                                            |
| --- | ----------------------------- | ------ | ---- | -------------------- | ---------------------------------------------- |
| 1   | Foundation (shared)           | 1.5k   | 🔴   | ✅ Done (2026-06-17) | [01-foundation.md](01-foundation.md)           |
| 2   | Query / Smart Folders         | 4.5k   | 🟡   | ✅ Done (2026-06-17) | [02-query.md](02-query.md)                     |
| 3   | Revisions                     | 3k     | 🔴   | ✅ Done (2026-06-17) | [03-revisions.md](03-revisions.md)             |
| 4   | Metadata & Schema             | 5.5k   | 🟡   | ✅ Done (2026-06-17) | [04-metadata-schema.md](04-metadata-schema.md) |
| 5   | Resources / Templates / Trash | 4k     | 🟡   | ✅ Done (2026-06-17) | [05-resources.md](05-resources.md)             |
| 6   | Projects & Types              | 6k     | 🟡   | ✅ Done (2026-06-17) | [06-projects.md](06-projects.md)               |
| 7   | Index & Search                | 2.5k   | 🟡   | ✅ Done (2026-06-17) | [07-index-search.md](07-index-search.md)       |
| 8   | Editor (TipTap)               | 3k     | 🟡   | ✅ Done (2026-06-17) | [08-editor.md](08-editor.md)                   |
| 9   | Compile & Export              | 1.2k   | 🟢   | ✅ Done (2026-06-17) | [09-compile-export.md](09-compile-export.md)   |
| 10  | Layout / Shell                | 3.5k   | 🔴   | ✅ Done (2026-06-17) | [10-shell.md](10-shell.md)                     |
| 11  | Timeline                      | 1.2k   | 🟢   | ✅ Done (2026-06-17) | [11-timeline.md](11-timeline.md)               |
| 12  | Common UI primitives          | 2k     | 🟡   | ✅ Done (2026-06-17) | [12-common-ui.md](12-common-ui.md)             |

Status legend: ⬜ Not started · 🚧 In progress · ✅ Done (gate green for the slice's own files). Slice 9 landed via commits `f21de5e` (brevity/clarity pass) and `a1a08cd` (route unification); route unification was its headline goal.

Per-file change deltas for completed slices live in [`deltas/`](deltas/) — see
[01](deltas/01-foundation.md), [02](deltas/02-query.md), [03](deltas/03-revisions.md), [04](deltas/04-metadata-schema.md), [05](deltas/05-resources.md), [06](deltas/06-projects.md),
[07](deltas/07-index-search.md), [08](deltas/08-editor.md), [09](deltas/09-compile-export.md), [10](deltas/10-shell.md), [11](deltas/11-timeline.md), [12](deltas/12-common-ui.md).

## Recommended sequence

1. **Leaves first** (calibrate the agents on low blast radius): 9 → 11 → 8.
2. **Mid domains**: 2 → 7 → 5 → 4 → 6.
3. **High-risk last, extra gates**: 3 → 10 → 1. Touch Foundation last so domain
   refactors aren't rebasing under shifting shared types.

## Definition of done (every slice)

- No public-signature changes (behavior refactor only) unless the slice doc says otherwise.
- Diff is brevity/clarity: naming, dead-code removal, decomposition of the big files,
  collapsing duplication — not logic changes.
- Gate passes. From `frontend/`:
  ```bash
  pnpm typecheck && pnpm lint && pnpm exec vitest run <slice test filters>
  ```
  Plus `pnpm knip` from the repo root (brevity exposes newly-unused exports).
- The five >1000-line files are the priority brevity targets:
  `AppShell.tsx`, `metadata-schema.ts`, `resource-templates.ts`,
  `SchemaManager.tsx`, `projectsSlice.ts`.

## Supporting agents

- **slice-refactorer** — workhorse; wraps `refactor-for-readability` with this DoD,
  scoped to one slice, enforces no-signature-change, runs the gate.
- **characterization-test-writer** — pins current behavior before touching 🔴 slices.
- **api-surface-guard** — diffs exported signatures pre/post to catch sneaked changes.
- **dead-code-sweeper** — knip-driven cleanup after each slice.
- **prop-contract-auditor** — UI slices; verifies props against `*.stories.tsx` + TS props.
- **doc-drift-reconciler** — reconciles CLAUDE.md / docs against the tree (e.g. the dead CLI).
