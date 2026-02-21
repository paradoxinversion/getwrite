# getwrite-cli

This document describes the developer CLI `getwrite-cli` available in the `frontend` workspace.

Overview

- **CLI name:** `getwrite-cli`
- **Source:** `frontend/src/cli/getwrite-cli.ts`
- **Dev loader:** `frontend/bin/getwrite-cli.mjs` (ESM loader used for local/dev runs via `tsx`)
- **Built artifact:** `frontend/dist-cli/bin/getwrite-cli.cjs` (CommonJS bundle produced by `esbuild`)

Commands

-- `getwrite-cli prune [projectRoot] --max <n>` — Prune old revisions under a project root.
-- `getwrite-cli templates <save|save-from-resource|create|duplicate|list|inspect|parametrize|export|import|validate|scaffold|apply-multiple|preview|version|history|rollback|changeset>` — Manage resource templates in a project. See the detailed templates documentation at [frontend/docs/templates.md](templates.md).

- `getwrite-cli screenshots capture` — Capture Storybook screenshots (uses Playwright).

Developer usage (no build)

```bash
# Run directly using tsx (preferred for development):
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs prune ./my/project --max 50
```

Build & run (production/dev bundle)

```bash
cd frontend
pnpm --filter getwrite-frontend run build:cli
# Run the built CLI (CommonJS bundle):
node ./frontend/dist-cli/bin/getwrite-cli.cjs --help
```

Notes

- Build output: the CLI is bundled with `esbuild` and emits a CommonJS artifact under `dist-cli/bin/*.cjs`.
- `frontend/package.json` exposes a `bin` mapping pointing to the built `dist-cli/bin/getwrite-cli.cjs` so installing the package makes `getwrite-cli` available on PATH.
- Dev loader: `frontend/bin/getwrite-cli.mjs` prefers the built CJS artifact but falls back to importing the TypeScript source (via `tsx`) for an iterative development experience.
- Playwright: the `screenshots capture` command depends on Playwright and its browsers. Run `pnpm install` in `frontend` and ensure Playwright browsers are installed in CI/dev machines (e.g. `pnpm exec playwright install --with-deps` where needed).
- Bundling note: Playwright and related internals are excluded from the esbuild bundle (marked external) and run at runtime; this avoids bundling native or internal Playwright modules.

Examples

- Show help for the built CLI:

```bash
node ./frontend/dist-cli/bin/getwrite-cli.cjs --help
```

- Show help for the `prune` subcommand (built):

```bash
node ./frontend/dist-cli/bin/getwrite-cli.cjs prune --help
```

-- Create a new project from a project-type spec JSON (built):

```bash
# use one of the project-type templates maintained in the repository:
node ./frontend/dist-cli/bin/getwrite-cli.cjs project create ./my/new-project \
	--spec ../getwrite-config/templates/project-types/novel_project_type.json \
	--name "My Project"
```

Note: Project-type specs must include a `folders` array and, per the project-type schema, a `Workspace` folder is required. Default resources in a spec should include a `folder` property (e.g. `"Workspace"`) so the CLI can place seeded resources correctly.

-- Export a template (dev loader):

```bash
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates export ./my/project my-template out.zip
```

-- Preview a template with vars and write to file (dev loader):

```bash
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates preview ./my/project my-template --vars '{"TITLE":"Hello"}' --out preview.txt
```

If you want me to also remove the dev loader (`frontend/bin/getwrite-cli.mjs`) or change the package `bin` mapping, say the word and I will update these files and CI accordingly.
