# Feature Specification: Define Data Models

**Feature Branch**: `002-define-data-models`
**Created**: 2026-02-20
**Status**: Draft
**Input**: User description: "Determine the shape of data entities included in the app-spec.md: Projects, Folders, Resources (Text, Image, Audio), Revisions, and Metadata. Create configuration files for Project Types that define initial project structure and default project resources. Files should be easy for users to modify or create customized project types/structures. Do not integrate into app or compile resources — only data types, relations, and hierarchies."

## Clarifications

### Session 2026-02-20

- Q: What should the default maximum number of revisions per resource be and is it configurable? → A: Default to 50, configurable per project (project configuration setting `maxRevisions`).
- Q: What identity scheme should entities use (IDs)? → A: Use immutable UUID v4 as the canonical `id`, and provide an optional human-readable `slug` per-entity for UI/export purposes.
- Q: How should metadata be stored for resources/folders/projects? → A: Sidecar JSON files per entity (e.g., `resource-<id>.meta.json`) stored alongside the resource; project-level metadata in the project config file.

## User Scenarios & Testing (mandatory)

### User Story 1 - Create a new project from a project type (Priority: P1)

An end user selects "New Project" → chooses a Project Type (e.g., "Novel") → provides a project name → the system creates a project with the declared folder structure and default resources.

Why this priority: Creating projects with sensible defaults is the core UX that enables all other flows.

Independent Test: Given a Project Type definition, create a new project and assert that the project root, required top-level folders, and listed default resource placeholders exist.

Acceptance Scenarios:

1. Given an empty workspace, when a user creates a project from the "Novel" project type, then the resulting project contains `Workspace`, `Characters`, `Locations`, `Items`, `Front Matter`, and `Back Matter` in the declared order.
2. Given a Project Type that declares default resources, when creating a project, those resource placeholders are created with metadata matching the declaration.

---

### User Story 2 - Add and manage resources and revisions (Priority: P1)

Users add textual, image, or audio resources to folders; each resource always has at least one revision and maintains revision invariants.

Why this priority: Resource + revision model enforces data integrity and underpins editing and compile flows.

Independent Test: Create a resource, verify the initial revision exists and is canonical; add additional revisions and verify invariants hold.

Acceptance Scenarios:

1. Given a new resource, when created, then it has one canonical revision.
2. Given multiple revisions, when the user selects an older revision and saves it as current, then the saved revision becomes the newest canonical revision.
3. Given the canonical revision, when the user attempts to delete it, then the system prevents deletion.

---

### User Story 3 - Modify or create Project Types (Priority: P2)

Project Types are editable JSON/YAML files that users can copy or modify to create custom templates for new projects.

Why this priority: Enables user customization and reusability without developer changes.

Independent Test: Edit a Project Type file to add a new default folder and default resource; create a project and assert the new folder/resource appears.

Acceptance Scenarios:

1. Given a project type file with a specified folder order, when a project is created, then the Resource Tree order matches the definition.

---

### Edge Cases

- Creating a project type with duplicate folder names: system must normalize or reject duplicates at validation time.
- Project Type defines a default resource with an unsupported file type: system should ignore unsupported types and report validation warnings.
- Creating a resource with no content: allowed, but must create a first empty revision.

## Requirements (mandatory)

### Functional Requirements

- **FR-001**: System MUST support a Project entity that contains Folders and Resources and exposes metadata declared in the spec.
- **FR-002**: System MUST allow declarative Project Type files that define top-level folder order and optional default resources.
- **FR-003**: Resources MUST be typed as `text`, `image`, or `audio` and include type-specific metadata fields.
- **FR-004**: Revisions MUST be associated to exactly one Resource and follow revision invariants (see Key Entities).
- **FR-005**: Project Type definitions MUST be user-editable (JSON or YAML), and the system MUST validate them on project creation.
- **FR-006**: Default project resources declared by a Project Type are created as placeholder resources with metadata but empty content.

### Key Entities (include if feature involves data)

- **Project**: Represents a single user project.
    - Attributes: id (immutable UUID v4), slug (optional human-readable unique string per project), name, createdAt, updatedAt, projectType (string), config (project-scoped settings), rootPath (filesystem path for local-first), metadata (map)
    - Relationships: has many `Folder`, has many `Resource` (top-level), contains Project-level `Status` definitions

- **Folder**: Logical container within a Project.
    - Attributes: id (immutable UUID v4), slug (optional human-readable unique string per project), name, parentId (nullable), orderIndex, createdAt, updatedAt
    - Relationships: contains many `Resource` and many child `Folder`

- **Resource** (base): File-like entity stored in a project. Common attributes below; type-specific attributes follow.
    - Common attributes: id (immutable UUID v4), slug (optional human-readable unique string per project), name (display name), type (one of `text`|`image`|`audio`), createdAt, updatedAt, folderId, sizeBytes (derived), notes (multiline), statuses (list), metadata (map)

- **Text Resource** (extends Resource):
    - Additional metadata: wordCount, charCount, paragraphCount, pov (string or reference to Character id), characters (list of Character ids), locations (list of Location ids), items (list of Item ids), timeframe {start, end}

- **Image Resource** (extends Resource):
    - Additional metadata: width, height, exif (map)

- **Audio Resource** (extends Resource):
    - Additional metadata: durationSeconds, format, codec, additionalTags (map)

- **Revision**:
    - Attributes: id, resourceId, versionNumber (monotonic integer), createdAt, savedAt, author (optional), filePath (or storage reference), isCanonical (boolean)
    - Invariants:
        - A Resource MUST always have at least one Revision.
        - Exactly one Revision MUST be canonical per Resource.
        - A Revision BELONGS to exactly one Resource.
        - Deleting a Revision MUST NOT leave the Resource without a Revision; deletion of canonical revision is disallowed.
    - Operational limits:
        - `maxRevisions` (integer): default 50 per Resource; configurable at the Project level via project configuration. When creating a new revision that would exceed `maxRevisions`, the system MUST prompt the user to select revisions to delete. If the user declines to delete revisions, creation of the new revision MUST be aborted.

- **Metadata**: Flexible key/value pairs scoped to Projects, Folders, or Resources. Metadata keys used by the app include Statuses, Notes, and type-specific metrics. Metadata entries must be typed (string, number, boolean, date, list). - Storage and format: - Metadata for a resource or folder SHOULD be stored in a sidecar JSON file placed next to the resource file or folder root. Filename convention: `resource-<id>.meta.json` or `folder-<id>.meta.json`. - Project-level metadata (project config, Status definitions, `maxRevisions`) SHOULD reside in the project configuration file (eg, `project.json`). - Sidecar schema (example):
  `json
                  {
                      "id": "<uuid>",
                      "slug": "optional-human-slug",
                      "notes": "...",
                      "statuses": ["Draft"],
                      "metadata": { "wordCount": 1234 },
                      "updatedAt": "2026-02-20T12:34:56Z"
                  }
                  ` - Rationale: sidecar JSONs are type-agnostic (work for binary/audio), human-editable, and move with the resource when files are relocated.

### Project Type Definition (declarative template)

Project Type files define initial folder structure and default resources. They must be human-editable JSON or YAML and intentionally minimal so non-technical users can copy/modify them.

Core fields:

- `id`: short id for the project type (eg, `novel`)
- `name`: display name
- `description`: short description
- `folders`: ordered list of folder definitions. Each folder: `{ name, special?: boolean, defaultResources?: [resource-declaration] }`
- `defaultResources`: optional global defaults placed at creation time

Example resource-declaration fields:

- `name`, `type` (`text|image|audio`), `template` (optional text or placeholder), `metadata` (map)

## Success Criteria (mandatory)

### Measurable Outcomes

- **SC-001**: A user can create a project from a provided Project Type and see the declared top-level folders in the correct order (automated test passes 100%).
- **SC-002**: When creating a resource, the system ensures a first revision exists and canonical revision invariants are satisfied (automated test suite coverage: 100%).
- **SC-003**: Users can create or modify Project Type files and, when used to create a new project, the resulting project matches the definition (manual or automated test: 95% success across sample project types).

## Assumptions

- Projects are local-first in V1; file paths and storage references are local filesystem paths.
- Project Type validation will be performed at creation time; invalid declarations cause project creation to fail with a clear message.

## Deliverables for this feature (non-code)

- A completed spec file capturing data shapes and invariants (this file).
- Example Project Type config files (JSON) in `project-types/`.
- A spec quality checklist file at `checklists/requirements.md` (created alongside this spec).

## Notes

- This feature intentionally excludes wiring these models into the running app — it only defines shapes, validation rules, and example templates.
