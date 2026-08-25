# Project Types (developer reference)

This is the developer reference for the project-type JSON format, validation, and scaffolding. For the writer-facing guide to choosing and managing project types in the app, see [docs/user/project-types.md](../user/project-types.md).

**Purpose:** Define reusable templates that describe a project's folder structure and initial placeholder resources. Project types let users scaffold a new project with a consistent set of folders, placeholder documents, and metadata.

**File Location:** Typically shipped in `getwrite-config/templates/project-types/` or in `specs/002-define-data-models/project-types/` for examples used by tests and documentation.

**When to use:** When you need a repeatable project skeleton (novel, blog, research notes, etc.). Use project-types for onboarding, sample projects, and CLI scaffolding.

## Structure (JSON)

- `id` (string): stable identifier for the project type (snake_case recommended).
- `name` (string): human-facing display name.
- `description` (string, optional): short summary of the type.
- `folders` (array of objects): ordered list of **top-level** folders. Each has:
  - `name` (string): display name (e.g. `"Workspace"`, `"Story Elements"`).
  - `metadataSource` (object, optional): records authoring intent only; it has
    no runtime effect — see below.
  - `defaultResources` (array, optional): resources seeded into this folder.
  - `special` (boolean, optional): **deprecated and ignored.** See
    [Deprecated: `special`](#deprecated-special).
- `defaultFolders` (array of objects, optional): **subfolders**, each declared
  flat with a pointer to its parent rather than nested. Each has:
  - `folder` (string): the name of the parent folder it is created under.
    The parent may itself be a `defaultFolders` entry, so trees nest to any
    depth.
  - `name` (string): display name.
  - `metadataSource` (object, optional), `special` (boolean, optional): as above.
- `defaultResources` (array of objects, optional): resources to create. Each has:
  - `folder` (string): folder name that owns the resource. If omitted, the
    first folder is used.
  - `name` (string): resource title.
  - `type` (string): resource type (e.g. `text`).
  - `template` (string, optional): initial plain text for the resource.
- `statuses` (array of strings, optional), `wordCountGoal` (integer, optional),
  `editorConfig` (object, optional).

The schema is `.strict()` — unknown top-level keys are rejected.

### `metadataSource` — authoring intent, not a runtime mechanism

A folder may carry a `metadataSource` object:

```json
{
  "name": "Characters",
  "folder": "Story Elements",
  "metadataSource": {
    "isMetadataSource": true,
    "metadataInputType": "multiselect"
  }
}
```

- `isMetadataSource` (boolean, required within the object).
- `metadataInputType` (optional): `"text" | "multiselect" | "autocomplete"`.

**Be aware that this flag is superseded and now write-only.** It is a real
authoring control — the project-type editor renders a toggle for it, Zod
validates it, and `project-creator.ts` writes it onto the folder it creates.
It also used to do something: from `0094c97` (2026-04-02) until `cc04767`
(2026-05-17) the Metadata sidebar selected folders by this flag and generated
a reference row for each one, picking the control from `metadataInputType`.
The "schema-driven MetadataSidebar rewrite" removed that in favour of
per-field `refFolder` scoping, and nothing has consumed the flag since.

Treat it as a vestigial authoring surface rather than a switch that does
something. Note the retirement was never recorded as follow-up work, so the
editor still offers a control for a contract nothing honours.

What actually governs reference candidates is a **per-field** setting on the
metadata schema, not a property of the folder. A `multi-resource-ref` field
carries a `refFolder` (a folder **id**) chosen in the Metadata Fields manager,
which offers every folder in the project plus an "Any folder" option and an
include-descendants toggle; scoping is resolved by
`frontend/components/Sidebar/folderScope.ts`. A single `resource-ref` field is
not scoped at all and draws on every resource in the project.

So a template declaring `isMetadataSource` on `Characters` does not by itself
make anything reference-able — it documents that the author meant that folder
to be used that way. Twenty-two such declarations exist across the six shipped
templates, on folders as varied as `Chapters`, `Parts`, `Research`,
`Fact Checking` and `Dialogue & Scripts`, which is a fair indication that the
concept was always meant to be generic rather than tied to particular names.

### Deprecated: `special`

`special` is accepted by the schema and propagated, but **nothing reads it**.
It predates the removal of the Workspace requirement, when certain folder
names carried application behaviour. Today no folder name or flag confers
ordering, protection, or UI semantics (`schemas.ts`, `types.ts`), and there is
no protected folder — any folder can be renamed, moved, or deleted.

If you are updating a hand-written project type, drop `special` — leaving it
in place is harmless, it simply does nothing. Note that `metadataSource` is
not a replacement for it: that flag is also inert at runtime. To make a
folder's contents referenceable, add a `resource-ref` or `multi-resource-ref`
field in the project's Metadata Fields manager and scope it to the folder
there.

## Example

Excerpted from the real `novel` template
(`getwrite-config/templates/project-types/novel_project_type.json`):

```json
{
  "id": "novel",
  "name": "Novel",
  "folders": [
    { "name": "Workspace" },
    { "name": "Story Elements" },
    { "name": "Outline" },
    { "name": "Notes" }
  ],
  "defaultFolders": [
    { "name": "Front Matter", "folder": "Workspace" },
    {
      "name": "Chapters",
      "folder": "Workspace",
      "metadataSource": {
        "isMetadataSource": true,
        "metadataInputType": "multiselect"
      }
    },
    { "name": "Chapter 1", "folder": "Chapters" },
    {
      "name": "Characters",
      "folder": "Story Elements",
      "metadataSource": {
        "isMetadataSource": true,
        "metadataInputType": "multiselect"
      }
    },
    {
      "name": "Locations",
      "folder": "Story Elements",
      "metadataSource": {
        "isMetadataSource": true,
        "metadataInputType": "multiselect"
      }
    }
  ],
  "defaultResources": [
    {
      "folder": "Characters",
      "name": "Character Profile",
      "type": "text",
      "template": "# Character Name\n\n- Description\n- Significance\n"
    }
  ]
}
```

Note that `Front Matter` here is an ordinary folder with no flag and no
behaviour. There is no `Back Matter` folder in any shipped template.

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

- Additional optional fields may be added later (e.g., metadata, per-folder ordering). If you extend the spec, update the Zod schema in `frontend/src/lib/models/schemas.ts` and corresponding unit tests in `frontend/tests/unit`.

## Bundled Project Types

The following project types ship with GetWrite in `getwrite-config/templates/project-types/`:

| File                          | ID                  | Name              | Folders                                   |
| ----------------------------- | ------------------- | ----------------- | ----------------------------------------- |
| `blank_project_type.json`     | `blank`             | Blank             | Workspace                                 |
| `novel_project_type.json`     | `novel`             | Novel             | Workspace, Story Elements, Outline, Notes |
| `serial_project_type.json`    | `serial`            | Serial            | Workspace, Story Elements, Outline, Notes |
| `article_project_type.json`   | `article`           | Article           | Workspace, References, Sources, Ideas     |
| `game_documentation.json`     | `game_writing`      | Game Writing      | Workspace, Research, Notes                |
| `poetry_and_lyrics_type.json` | `poetry_and_lyrics` | Poetry and Lyrics | Workspace, Inspiration, Experiments       |

Note that the file name does not always match the `id` (e.g. `game_documentation.json` has id `game_writing`).

For detailed folder structure and default resources, see each JSON file directly. The project-type selection UI reads these at runtime via `GET /api/project-types`.

## Troubleshooting

- If scaffolding fails with a validation error, run the validator against the file to see field-level problems. The error message contains the zod validation errors.
