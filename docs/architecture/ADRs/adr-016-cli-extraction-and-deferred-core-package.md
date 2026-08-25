# ADR-016: CLI Extracted to a Standalone Package; Core Extraction Deferred

**Date:** 2026-06-10
**Status:** Accepted

## Context

The GetWrite CLI (`getwrite-cli` — `prune`, `reindex`, `templates`, `project`,
`screenshots`, and now `doctor`) lived under `frontend/src/cli/`, built with its
own esbuild bundle and exposed via the frontend package's `bin`. It is not a
frontend concern: it is a Node tool that operates on the on-disk project store
through the model layer (`frontend/src/lib/models/` plus a few framework-free
`lib/` siblings).

Two facts shaped this decision:

1. **The model layer is already framework-free.** `frontend/src/lib/models/`
   (48 files) imports no React/Next/Redux/component code; it reaches only
   sideways to `utils`, `word-count`, and `tiptap-utils`, which are equally
   UI-free. It already exposes a curated public barrel at
   `frontend/src/lib/models/index.ts`.
2. **The frontend depends on the model layer broadly.** ~99 frontend files
   import it. Physically relocating those modules is a large, mechanical churn.

We also expect to build a **plugin system** soon. Plugins, the CLI, and the
frontend would all want to consume the core model/logic layer, which raises the
question of where the package boundary should sit.

## Options Considered

### Option 1: Relocate the CLI now; share the model layer via a barrel + path alias

Create a standalone `cli/` workspace package (its own `package.json`, `bin`,
esbuild build, tsconfig, vitest, tests). The CLI imports the model layer through
a single public barrel — `frontend/src/lib/core.ts`, exposed to the CLI as the
`@gw/core` path alias — which esbuild bundles at build time. The model layer
stays in `frontend/` for now.

- **Pros:** Small, surgical, low risk. The CLI is genuinely its own package and
  build unit. Routing imports through one barrel (rather than deep-importing
  internals) makes "what is the public surface" an incremental, low-stakes
  question and pre-stages a future extraction. No churn to the ~99 frontend
  importers.
- **Cons:** No _compiler-enforced_ boundary — the alias resolves into frontend
  source, so discipline (import only through `@gw/core`) is what keeps the
  boundary clean. The model layer still physically resides in `frontend/`.

### Option 2: Extract the model layer into a standalone `core/` package now

Move `frontend/src/lib/models/` (and the framework-free `lib/` siblings) into a
new `core/` package; have both `frontend` and `cli` depend on `@gw/core`.

- **Pros:** A real, compiler-enforced boundary (core cannot import UI;
  consumers cannot deep-import privates). Independent versioning/build/test. The
  right substrate for a third-party plugin API with stability guarantees.
- **Cons:** Large mechanical churn (~99 frontend imports rewritten) plus
  build/test/tsconfig changes. More importantly, it forces the public `@gw/core`
  API to be designed **now**, speculatively — before a real plugin consumer
  exists to validate the shape. The current consumers already deep-import
  internals not present in the barrel (`pruneExecutor`, `sidecar`, `backlinks`,
  `inverted-index`), so the "public surface" is unsettled. Designing it in a
  vacuum risks rework.

## Decision

Adopt **Option 1**.

- New `cli/` workspace package owns the CLI source, build (`pnpm cli:build` →
  `cli/dist/bin/getwrite-cli.cjs`), and tests (`cli/tests/`).
- The CLI consumes the model layer **only** through `@gw/core`
  (`frontend/src/lib/core.ts`), aliased in `cli/tsconfig.json` and
  `cli/vitest.config.ts`. `core.ts` re-exports the curated models barrel plus
  the specific model modules and `lib` helpers the CLI needs (named re-exports,
  since e.g. `backlinks` and `pruneExecutor` both export `listResourceIds`).
- The model layer stays in `frontend/` for now.

The key insight: the _decoupling_ that yields flexibility (a framework-free core
with a defined API) is already a property of the dependency graph. Moving files
to a package would add _enforcement_ and a _stable contract_, not new
decoupling — and those pay off only when a consumer needs the contract to be
stable. Today the CLI would be a captive consumer; a plugin tomorrow will not.

## Consequences

- The CLI is no longer coupled to the frontend's `bin`/build. `frontend`
  dropped its `build:cli` script, `bin` entry, and the `commander`/`esbuild`
  devDependencies. `pnpm-workspace.yaml`, `knip.json`, and the
  `cli-smoke-tests` CI workflow were updated for the new package.
- `frontend/src/lib/core.ts` is the de facto public surface. Keep it
  intentional: add a named re-export only when an external consumer needs one.
- Boundary protection is by discipline, not the compiler. Mitigation: the CLI
  imports solely via `@gw/core`, and `knip` runs across the workspace.

### Deferred work (when the plugin system lands)

Promote `@gw/core` to a real `core/` package (Option 2):

1. Move `frontend/src/lib/models/` + the framework-free `lib/` siblings into
   `core/`, with `core.ts` as the package entrypoint.
2. Rewrite the ~99 frontend imports to `@gw/core` (codemod-able).
3. Add an `exports` map and lint/`knip` rules forbidding deep imports, giving
   the compiler-enforced boundary.

By then the CLI already consumes only the public surface, so it becomes the
first real validator of the `@gw/core` API, and the extraction is "move files +
flip imports" rather than "design an API blind." Tracked in
[tech-debt.md](../../tech-debt.md) under Architecture.
