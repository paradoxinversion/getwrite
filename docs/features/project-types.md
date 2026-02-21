# Project Types

**Purpose:** Define reusable templates that describe a project's folder structure and initial placeholder resources. Project types let users scaffold a new project with a consistent set of folders, placeholder documents, and metadata.

**File Location:** Typically shipped in `getwrite-config/templates/project-types/` or in `specs/002-define-data-models/project-types/` for examples used by tests and documentation.

**When to use:** When you need a repeatable project skeleton (novel, blog, research notes, etc.). Use project-types for onboarding, sample projects, and CLI scaffolding.

## Structure (JSON)

- `id` (string): stable identifier for the project type (snake_case recommended).
- `name` (string): human-facing display name.
- `description` (string, optional): short summary of the type.
- `folders` (array of objects): ordered list of folders. Each folder object has:
    - `name` (string): display name for the folder (e.g., "Workspace", "Front Matter").
    - `special` (boolean, optional): indicates a special folder (UI affordance).
- `defaultResources` (array of objects, optional): resources to create by default. Each entry has:
    - `folder` (string): folder name that owns the resource. If omitted, the first folder is used.
    - `name` (string): resource title.
    - `type` (string): resource type (e.g., `text`).
    - `template` (string, optional): initial plain text for the resource.

## Example (minimal)

```json
{
    "id": "novel",
    "name": "Novel",
    "description": "Novel project skeleton with front/back matter",
    "folders": [
        { "name": "Workspace", "special": false },
        { "name": "Front Matter", "special": true },
        { "name": "Back Matter", "special": true }
    ],
    "defaultResources": [
        {
            "folder": "Front Matter",
            "name": "Title Page",
            "type": "text",
            "template": "Title:\nAuthor:\n"
        }
    ]
}
```

## Validation & Runtime

- Runtime validation is provided by the Zod schema in `frontend/src/lib/models/schemas.ts`. Use the exported helpers `validateProjectType()` and `validateProjectTypeFile()` to check a JSON object or file before scaffolding.
- The scaffolding entrypoint `createProjectFromType()` (in `frontend/src/lib/models/project-creator.ts`) validates incoming specs and throws a descriptive error if validation fails.

## Usage Notes & Best Practices

- Prefer stable `id` values and snake_case to make programmatic selection predictable.
- Keep folder `name` unique within the `folders` array; the scaffolder uses folder `name` values to match `defaultResources` entries (slug normalization applied).
- When authoring `defaultResources`, include `folder` where possible. If not present, scaffolder falls back to the first `folders[0]` entry.
- Keep templates short and focused; larger starter content can be added as separate templates or via CLI `templates import`.
- Place example types in `specs/002-define-data-models/project-types/` for documentation and tests; place user-configurable templates in `getwrite-config/templates/project-types/` for runtime discovery.

## Extending

- Additional optional fields may be added later (e.g., metadata, per-folder ordering). If you extend the spec, update the Zod schema in `frontend/src/lib/models/schemas.ts` and corresponding unit tests in `frontend/src/tests/unit`.

## Troubleshooting

- If scaffolding fails with a validation error, run the validator against the file to see field-level problems. The error message contains the zod validation errors.
