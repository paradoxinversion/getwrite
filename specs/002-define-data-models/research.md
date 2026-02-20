# Research: Define Data Models

## Decisions

- Decision: Default `maxRevisions` = 50 (project-configurable).  
  Rationale: Balances history retention with disk usage for local-first projects.

- Decision: Identity scheme — immutable UUID v4 `id` + optional `slug`.  
  Rationale: UUIDs provide stable identity independent of file paths; slugs improve UX and exports.

- Decision: Metadata storage — sidecar JSON per entity (e.g., `resource-<id>.meta.json`).  
  Rationale: Consistent across file types, editable, moves with resource files.

- Decision: Revision storage — full-file copies per revision.  
  Rationale: Simpler for binary support and local-first; delta storage introduced later if needed.

- Decision: Revision layout — per-resource revisions folder `revisions/<resourceId>/v-<version>/`.  
  Rationale: Groups revisions per resource, simplifies pruning and backups.

## Alternatives Considered

- Unlimited revisions (rejected): too much disk usage risk for local-first.
- Human-slug-only identity (rejected): fragile when renaming or moving; collisions.
- Embedded metadata in files (rejected): inconsistent across binary formats; editing complexity.
- Delta storage by default (rejected): complexity and binary diffs are non-trivial.

## Recommendations

- Use `zod` for runtime schema validation and to derive JSON schema for `contracts/`.
- Implement models in TypeScript under `frontend/src/lib/models` and add unit tests with Vitest.
- Provide examples and migration notes in `quickstart.md` to help integrators.
