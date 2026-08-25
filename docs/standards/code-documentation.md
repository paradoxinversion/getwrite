# Code Documentation Standard

This document applies when creating or modifying comments and documentation in JavaScript or TypeScript source files.

---

## 1. File-Level Documentation

- Include a `@module` JSDoc comment at the top of every file with a description of the module's purpose
- Add `//Last Updated: YYYY-MM-DD` on the line immediately following the module docstring

---

## 2. Functions, Types, and Interfaces

- All functions, types, and interfaces must be preceded by a JSDoc docstring describing their purpose
- Include `@param`, `@returns`, and `@throws` tags where applicable
- All properties in `type` and `interface` declarations must be documented — including implicit ones (`name`, `id`, etc.)
- Include at least one `@example` in function docstrings where practical

---

## 3. Inline Comments

- Add inline comments to explain non-obvious or complex logic
- Do not comment self-explanatory code

---

## 4. Completeness Check

Before finishing documentation work, verify:

- Every exported function, type, and interface has a docstring
- Every type/interface property has a description
- The module docstring and last-updated timestamp are present at the top of the file
