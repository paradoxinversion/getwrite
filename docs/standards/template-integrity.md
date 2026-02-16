# Template Integrity & Mutation Governance

This document defines how template-derived files must be handled after generation.

The purpose is to:

- Preserve structural integrity
- Prevent formatting drift
- Avoid task duplication
- Ensure deterministic evolution
- Maintain clean diffs
- Protect template authority

Template-derived files are treated as structured artifacts, not freeform documents.

---

## 1. Template Integrity Rule

Files generated from templates are considered authoritative in structure.

When editing a file that was created from a template:

- Do not reformat the entire file.
- Do not reorder sections.
- Do not rename template-defined headings.
- Do not remove structural markers.
- Do not change indentation style.
- Do not alter whitespace conventions.
- Do not regenerate the file unless explicitly instructed.

Only modify the specific sections required by the user request.

The template structure is authoritative.

---

## 2. Targeted Mutation Rule

All edits must be minimal and localized.

When applying further edits to generated files:

- Modify only the necessary lines.
- Do not rewrite unchanged sections.
- Preserve existing formatting.
- Preserve comment style and placement.
- Preserve indentation and spacing patterns.
- Avoid global formatting changes.

If multiple edits are required:

- Consolidate them into a single coherent update.
- Avoid scattering similar changes across the file.
- Do not introduce structural drift.

Edits should produce the smallest meaningful diff.

---

## 3. No Regeneration Without Authorization

If a generated file already exists:

- Do not regenerate it.
- Do not reapply the template.
- Do not merge fresh template output into the file.
- Do not “refresh” the structure.

If the template has changed:

- Ask whether the file should be regenerated.
- Do not automatically sync template updates.

Regeneration requires explicit authorization.

---

## 4. Structured Sections Rule

When a template contains structured blocks (e.g., Tasks, Acceptance Criteria, Notes):

- Add new items within the correct block.
- Maintain numbering and identifier schemes.
- Do not reset numbering.
- Do not renumber existing items.
- Do not convert checklist formats.
- Do not alter ID prefixes.

If a similar entry already exists:

- Update the existing entry.
- Do not create a duplicate.
- Do not create near-duplicate task variants.

Structural consistency is more important than stylistic improvement.

---

## 5. Duplicate Prevention Rule

Never duplicate:

- TODO items
- Checklist entries
- Task identifiers
- Acceptance criteria
- Section blocks
- Comments with semantic meaning

If duplication risk exists:

- Modify the existing item instead of adding a new one.
- Merge overlapping tasks carefully.
- Preserve original identifiers.

---

## 6. Patch-Style Editing Rule

Template-derived files must be edited in a patch-style manner.

- Prefer surgical edits over rewrites.
- Do not refactor for aesthetics.
- Do not normalize formatting.
- Do not “clean up” unless explicitly instructed.

Stability and traceability are prioritized over cosmetic improvements.

---

## 7. Authority Hierarchy

When working with template-derived files:

1. The template structure is authoritative.
2. Existing identifiers are authoritative.
3. User instruction is authoritative.
4. Formatting preferences are subordinate to structural integrity.

If a conflict exists between formatting improvement and structural preservation:

- Preserve structure.
- Avoid reformatting.

---

## 8. Failure Handling

If an edit cannot be performed without:

- Breaking structure
- Renumbering identifiers
- Duplicating tasks
- Rewriting large portions of the file

Then:

- Pause.
- Explain the structural conflict.
- Ask for explicit instruction before proceeding.

Do not proceed with destructive changes.

---

## 9. Determinism Requirement

Edits to template-derived files must be:

- Deterministic
- Minimal
- Traceable
- Diff-friendly
- Structurally stable

No speculative improvements.
No structural reinterpretation.
No autonomous restructuring.

Template integrity is mandatory.
