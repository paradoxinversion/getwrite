# getwrite-cli

This document describes the developer CLI `getwrite-cli` available in the `frontend` workspace.

Overview

- **CLI name:** `getwrite-cli`
- **Source:** `frontend/src/cli/getwrite-cli.ts`
- **Dev loader:** `frontend/bin/getwrite-cli.mjs` (ESM loader used for local/dev runs via `tsx`)
- **Built artifact:** `frontend/dist-cli/bin/getwrite-cli.cjs` (CommonJS bundle produced by `esbuild`)

Commands

-- `getwrite-cli prune [projectRoot] --max <n>` — Prune old revisions under a project root.
-- `getwrite-cli templates <save|save-from-resource|create|duplicate|list|inspect|parametrize|export|import|validate|scaffold|apply-multiple|preview|version|history|rollback|changeset>` — Manage resource templates in a project (detailed subcommands below).

**Templates CLI**

The `templates` subcommand group provides helpers for creating, inspecting, exporting, importing and auditing resource templates in a project.

Common subcommands (dev loader usage shown):

- `templates save-from-resource <projectRoot> <resourceId> <templateId> [--name <name>]` — Capture an existing resource into `meta/templates/<templateId>.json`.
- `templates save <projectRoot> <templateId> <name>` — Create a simple template file.
- `templates create <projectRoot> <templateId> [name] [--vars '{}'] [--dry-run]` — Instantiate a resource; `--dry-run` prints planned writes.
- `templates duplicate <projectRoot> <resourceId>` — Duplicate a resource (new id, cloned sidecar/file).
- `templates list <projectRoot> [--query <text>]` — List templates (id, name, type).
- `templates inspect <projectRoot> <templateId>` — Print template details: placeholders and metadata keys.
- `templates parametrize <projectRoot> <templateId> --placeholder "{{NAME}}"` — Replace literal strings with a placeholder variable and return introduced variables.
- `templates export <projectRoot> <templateId> <out.zip>` — Export template JSON into a .zip package.
- `templates import <projectRoot> <pack.zip>` — Import templates from a .zip package into `meta/templates/`.
- `templates validate <projectRoot> <templateId>` — Validate template JSON against the runtime schema (zod) and print errors.
- `templates scaffold <projectRoot> <templateId> <count>` — Generate `<count>` resources from a template using sequential names.
- `templates apply-multiple <projectRoot> <templateId> <inputPath>` — Create multiple resources from a JSON array or CSV file of variable sets.
- `templates preview <projectRoot> <templateId> [--vars '{}'] [--out <file>]` — Render the template with vars; prints plainText or writes to `--out`.
- `templates version <projectRoot> <templateId>` — Snapshot current template to `<templateId>.v<N>.json`.
- `templates history <projectRoot> <templateId>` — List saved template versions.
- `templates rollback <projectRoot> <templateId> <version>` — Restore a saved version into the main template file.
- `templates changeset <projectRoot> <templateId> [--since <ISO-date>]` — Show compact change entries recorded when templates are saved (timestamps, action, changed keys).

Examples for `templates` subcommands

```bash
# Capture an existing resource as a template
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates save-from-resource ./my/project <resourceId> my-template --name "My Template"

# Create a minimal template file
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates save ./my/project my-template "My Template"

# Instantiate a resource from a template (dry-run)
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates create ./my/project my-template --vars '{"TITLE":"Hello"}' --dry-run

# Instantiate a resource from a template (real)
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates create ./my/project my-template --vars '{"TITLE":"Hello"}'

# Duplicate an existing resource
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates duplicate ./my/project <resourceId>

# List templates (optional query)
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates list ./my/project --query "novel"

# Inspect a template for placeholders and metadata keys
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates inspect ./my/project my-template

# Replace literal values in a template with a placeholder
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates parametrize ./my/project my-template --placeholder "{{TITLE}}"

# Export a template as zip
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates export ./my/project my-template out.zip

# Import templates from a package
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates import ./my/project out.zip

# Validate a template against the runtime schema
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates validate ./my/project my-template

# Scaffold N resources from a template
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates scaffold ./my/project my-template 5

# Create multiple resources from JSON/CSV input
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates apply-multiple ./my/project my-template ./rows.json

# Preview a template rendered with variables (prints to stdout)
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates preview ./my/project my-template --vars '{"TITLE":"Preview"}'

# Preview and write to a file
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates preview ./my/project my-template --vars '{"TITLE":"Preview"}' --out preview.txt

# Snapshot the current template version
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates version ./my/project my-template

# List saved template versions
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates history ./my/project my-template

# Rollback to a saved version (e.g., v1)
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates rollback ./my/project my-template 1

# Show compact changeset (optionally since an ISO date)
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs templates changeset ./my/project my-template --since "2026-02-01T00:00:00Z"
```

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
