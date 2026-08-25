# Remove Workspace Requirement

## Overview

GetWrite currently forces every project type to contain a folder literally named `Workspace`, and supports a `special` boolean flag on folders that grants application-level semantics. This requirement predates the current freeform, field-based metadata system and now constrains users who want to define their own top-level project structure. This feature removes the mandatory `Workspace` folder and deprecates the `special` folder concept, letting authors structure projects however they choose while metadata continues to come from the field-based schema rather than folder identity.

## Goals

- A project type with any folder layout (including none named `Workspace`) validates and creates successfully.
- Project creation, loading, and the resource tree behave identically whether or not a `Workspace` folder exists.
- The `special` folder flag no longer changes application behavior anywhere in the stack.
- Built-in project-type templates no longer depend on `Workspace`-naming or `special`.
- Existing on-disk projects and saved project types created under the old rules continue to load without error or migration.

## Non-goals

- Introducing a new folder-level "metadata provider" marker or any folder-based metadata mechanism.
- Changing the field-based metadata schema, sidecars, or how metadata is authored.
- Migrating, renaming, or restructuring folders inside existing projects.

## User stories

- As a writer, I want to create a project type with my own top-level folders so that my structure reflects my workflow, not a fixed `Workspace` convention.
- As a project-type author, I want to define folders without a `special` flag so that folder identity carries no hidden behavior.
- As an existing user, I want my current projects to keep loading unchanged so that this change is non-breaking.

## Functional requirements

1. `ProjectTypeSchema` MUST NOT require a folder named `Workspace`; the `.refine` enforcing it must be removed.
2. `project-type.schema.json` MUST NOT require a `Workspace` folder via its `contains`/`const` constraint.
3. A project type whose folders omit `Workspace` MUST validate and scaffold a project successfully.
4. The `special` field MUST remain an accepted-but-ignored optional field in the Zod and JSON schemas (deprecated, not a hard error), so existing specs continue to validate.
5. No code path MUST branch on `folder.special` to alter behavior (resource tree, project creation, editor guardrails).
6. Built-in templates (`blank`, `novel`, `serial`, `article`, `poetry_and_lyrics`, `game_documentation`) MUST retain their current folder names but remove all `special: true` flags.
7. The Project Types editor MUST NOT display `Workspace` guardrail warnings or a `Special` toggle.
8. Loading a previously created project containing a `Workspace` or `special`-flagged folder MUST succeed without error.

## Open questions

None identified.

## Out of scope (deferred)

- A first-class folder-level metadata-provider designation.
- Bulk migration tooling to restructure legacy projects.
- Eventual full removal of the deprecated `special` field once no persisted specs reference it.
