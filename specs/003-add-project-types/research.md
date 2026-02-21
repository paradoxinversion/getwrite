# research.md

## Decision: Project Type format

- Decision: Use JSON-only Project Type templates.
- Rationale: The repository and contributor workflows already include JSON examples and JSON parsing is native in the frontend runtime; reducing format choices simplifies validation and UX.
- Alternatives considered: Accept both JSON and YAML (more flexible) — rejected to reduce parsing surface and avoid YAML security pitfalls. Support YAML later if demand arises.

## Decision: Template loading timing

- Decision: Parse Project Type files when the Create Project modal opens and cache results for the session.
- Rationale: Modal-open parsing offers acceptable latency for typical dev machines and simplifies refresh semantics (reparse on modal open or manual refresh).

## Decision: Contract for createProjectFromType

- Decision: `createProjectFromType(projectName: string, projectTypeId: string) => Promise<Project>` — returns a fully persisted project scaffold that the UI can render directly.
- Rationale: Keeps the frontend agnostic to persistence details; the function returns the final project shape required by the Resource Tree.
