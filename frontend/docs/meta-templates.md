# Project Meta: Templates

This document explains the on-disk layout and usage for resource templates.

Location

- Resource templates (used to create resources inside a project) are stored per-project under `meta/templates/` as individual JSON files named `<templateId>.json`.

- Project-type templates (JSON specs that define project folder structure and default resources) are maintained in the repository under `getwrite-config/templates/project-types/`. These files can be passed to the CLI `project create --spec <path>` to scaffold new projects.

Format

- Each template is a JSON object with at least the following fields:
    - `id`: string (template identifier)
    - `name`: string (human readable name)
    - `type`: `text|image|audio`
    - `plainText` (optional): for `text` templates the initial body
    - `metadata` (optional): sidecar metadata to apply on creation

Operations

- Use the CLI helper at `frontend/src/cli/templates.ts` for quick management in development. The helper supports the following commands (developer-facing):
    - `save-from-resource <projectRoot> <resourceId> <templateId> [--name <name>]` — capture an existing resource and persist it as a template.
    - `save <projectRoot> <templateId> <name>` — create an empty template stub.
    - `create <projectRoot> <templateId> [name] [--vars '{}'] [--dry-run]` — create a resource from a template; `--vars` accepts a JSON object of substitutions; `--dry-run` prints planned writes.
    - `duplicate <projectRoot> <resourceId>` — duplicate an existing resource in-place.
    - `list <projectRoot> [--query <text>]` — list available templates (optional query filter).
    - `inspect <projectRoot> <templateId>` — show template details and placeholders.
    - `parametrize <projectRoot> <templateId> --placeholder "{{NAME}}"` — replace literal occurrences with a placeholder and return introduced variables.
    - `export <projectRoot> <templateId> <out.zip>` — package a template (JSON) into a ZIP file for sharing.
    - `import <projectRoot> <pack.zip>` — import templates from a ZIP package into `meta/templates/`.

- Programmatic APIs are exposed by `frontend/src/lib/models/resource-templates.ts`.

Notes

- Templates are project-local; do not commit generated template files to version control unless intentionally shared.
