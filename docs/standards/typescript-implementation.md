# TypeScript Implementation Standard

This document applies only during the implementation phase.

It does NOT apply during:

- Specification drafting
- Architectural discussion
- Planning
- High-level design

It applies when generating or modifying TypeScript source files.

---

## 1. Type Safety First

- Do not use `any`.
- Do not suppress type errors.
- Do not use `@ts-ignore`.
- Avoid type assertions unless strictly necessary.
- Prefer explicit return types on exported functions.

If a type cannot be expressed cleanly, ask for clarification.

---

## 2. Explicit Data Modeling

- Define interfaces or type aliases for structured data.
- Do not inline large object type literals repeatedly.
- Prefer named types over anonymous structural types.
- Avoid overly complex generic types unless clearly required.

---

## 3. Function Design

- Keep functions small and single-purpose.
- Explicitly type parameters.
- Prefer pure functions when possible.
- Avoid hidden mutation of external state.
- Separate orchestration from transformation logic.

---

## 4. Error Handling

- Use a consistent error strategy within the file.
- Do not mix throwing and result-return patterns.
- Do not swallow errors silently.
- Keep error types simple unless the spec requires hierarchy.

---

## 5. Module Structure

- One primary responsibility per file.
- Export only what is necessary.
- Avoid circular imports.
- Do not create “utility dumping grounds”.

---

## 6. Naming Conventions

- Use descriptive, literal names.
- Avoid abbreviations unless well-established.
- Use consistent verb prefixes for actions (e.g., `create`, `update`, `validate`).
- Name types as nouns and functions as verbs.

---

## 7. Readability Over Cleverness

- Avoid deeply nested ternaries.
- Avoid chaining that reduces clarity.
- Extract intermediate variables when helpful.
- Prefer clarity over compactness.

---

## 8. Dependency Discipline

- Do not introduce new libraries without explicit instruction.
- Use existing project dependencies.
- Do not upgrade versions implicitly.

---

End of TypeScript Implementation Standard.
