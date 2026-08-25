# Standards & Skills Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate overlapping documentation guidance, expand the testing standard, constrain the frontend-design skill to the GetWrite brand system, and tighten scholar's invocation model to reduce context cost.

**Architecture:** Six targeted file edits (one delete). No new files. Each task is independent — they can be executed in any order, though Tasks 1–3 are logically grouped around documentation consolidation.

**Spec:** `docs/superpowers/specs/2026-03-23-standards-skills-audit-design.md`

**Tech Stack:** Markdown only. No code changes.

---

## File Map

| Action  | File                                                                    |
| ------- | ----------------------------------------------------------------------- |
| Modify  | `docs/standards/code-documentation.md`                                  |
| Modify  | `docs/standards/typescript-implementation.md`                           |
| Rewrite | `docs/standards/testing.md`                                             |
| Rewrite | `.github/skills/code-documentation/SKILL.md`                            |
| Delete  | `.github/skills/code-documentation/references/javascript-typescript.md` |
| Modify  | `.github/skills/frontend-design/SKILL.md`                               |
| Modify  | `.github/skills/scholar/SKILL.md`                                       |

---

## Task 1: Expand `code-documentation.md` to be the single authority

**Goal:** Merge documentation rules from three sources into one standard. After this task, `docs/standards/code-documentation.md` contains everything; the other two sources will be trimmed/deleted in Tasks 2 and 3.

**Files:**

- Modify: `docs/standards/code-documentation.md`
- Reference (read-only): `.github/skills/code-documentation/references/javascript-typescript.md`

- [ ] **Step 1: Verify the gap — confirm Section 9 exists in `typescript-implementation.md`**

  Run:

  ```bash
  grep -n "Code Document Discipline" frontend/../docs/standards/typescript-implementation.md
  ```

  Expected: line ~91 shows `## 9. Code Document Discipline`

- [ ] **Step 2: Replace `docs/standards/code-documentation.md` with the merged standard**

  Write the following content to `docs/standards/code-documentation.md`:

  ```markdown
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
  ```

- [ ] **Step 3: Verify the merged standard contains all required rules**

  Check that the file contains each of these strings:

  ```bash
  grep -c "@module" docs/standards/code-documentation.md          # expect 1
  grep -c "//Last Updated" docs/standards/code-documentation.md     # expect 1 (no space after //)
  grep -c "@param" docs/standards/code-documentation.md            # expect 1
  grep -c "@throws" docs/standards/code-documentation.md           # expect 1
  grep -c "@example" docs/standards/code-documentation.md          # expect 1
  grep -c "interface" docs/standards/code-documentation.md         # expect 1
  grep -c "implicit" docs/standards/code-documentation.md          # expect 1
  ```

  All must return 1.

- [ ] **Step 4: Commit**

  ```bash
  git add docs/standards/code-documentation.md
  git commit -m "docs(standards): expand code-documentation standard — merge 3 sources into 1"
  ```

---

## Task 2: Remove Section 9 from `typescript-implementation.md`

**Goal:** Delete the two-line Section 9 that duplicated the documentation standard. The merged standard from Task 1 is now authoritative.

**Files:**

- Modify: `docs/standards/typescript-implementation.md`

- [ ] **Step 1: Confirm the exact lines to remove**

  ```bash
  grep -n "" docs/standards/typescript-implementation.md | tail -10
  ```

  Expected output includes:

  ```
  91:## 9. Code Document Discipline
  92:
  93:- Include thorough function comments
  94:- Include thorough variable comments
  95:
  96:End of TypeScript Implementation Standard.
  ```

- [ ] **Step 2: Remove Section 9**

  Delete these lines from `docs/standards/typescript-implementation.md`:

  ```
  ## 9. Code Document Discipline

  - Include thorough function comments
  - Include thorough variable comments

  ```

  The file should end with `End of TypeScript Implementation Standard.` immediately after Section 8.

- [ ] **Step 3: Verify Section 9 is gone and the file ends cleanly**

  ```bash
  grep -c "Code Document Discipline" docs/standards/typescript-implementation.md  # expect 0
  tail -5 docs/standards/typescript-implementation.md
  ```

  Expected tail: the last non-empty line is `End of TypeScript Implementation Standard.`

- [ ] **Step 4: Commit**

  ```bash
  git add docs/standards/typescript-implementation.md
  git commit -m "docs(standards): remove duplicate Section 9 from typescript-implementation"
  ```

---

## Task 3: Replace `code-documentation` skill with thin wrapper and delete reference file

**Goal:** The skill body becomes a lightweight invocation wrapper (~10 lines) that points at the standard. The `references/javascript-typescript.md` file is deleted — its content now lives in `docs/standards/code-documentation.md`.

**Files:**

- Rewrite: `.github/skills/code-documentation/SKILL.md`
- Delete: `.github/skills/code-documentation/references/javascript-typescript.md`

- [ ] **Step 1: Rewrite `.github/skills/code-documentation/SKILL.md`**

  Write the following content (complete replacement):

  ```markdown
  ---
  name: code-documentation
  description: Guide for documenting code. Use this when creating or updating documentation for source code files.
  metadata:
    author: saboteur-labs
    version: 2.0
    last_updated: 2026-03-23
  ---

  # Code Documentation Skill

  **Authority:** `docs/standards/code-documentation.md` defines all documentation rules. Do not restate them here.

  ## When to Use

  When creating or updating documentation for JavaScript or TypeScript source files.

  ## Workflow

  1. Declare use of this skill and confirm use of the code documentation standard
  2. Read `docs/standards/code-documentation.md`
  3. Read through the code to understand its functionality and purpose
  4. Identify functions, types, interfaces, and modules needing documentation
  5. Assess what needs to be created vs. updated — state clearly which components do not need changes and why
  6. Write documentation following the standard
  7. Review for accuracy, completeness, and correctness
  ```

- [ ] **Step 2: Delete the reference file**

  ```bash
  git rm .github/skills/code-documentation/references/javascript-typescript.md
  ```

- [ ] **Step 3: Verify the skill is ≤30 lines and contains no duplicate rules**

  ```bash
  wc -l .github/skills/code-documentation/SKILL.md   # expect ≤30
  grep -c "@module\|@param\|@throws\|@example" .github/skills/code-documentation/SKILL.md  # expect 0
  ```

- [ ] **Step 4: Verify the reference file is gone**

  ```bash
  ls .github/skills/code-documentation/references/  # expect: no such file or directory, or empty
  ```

- [ ] **Step 5: Commit**

  Note: the `git rm` in Step 2 already staged the deletion — do not attempt to `git add` the deleted file.

  ```bash
  git add .github/skills/code-documentation/SKILL.md
  git commit -m "docs(skills): replace code-documentation skill with thin wrapper, delete reference file"
  ```

---

## Task 4: Rewrite `testing.md` as an agent-agnostic standard

**Goal:** Replace the 3-line Copilot-framed stub with a full, agent-agnostic standard covering environment, all four command variants, file locations, and test scope.

**Files:**

- Rewrite: `docs/standards/testing.md`

- [ ] **Step 1: Confirm current state of the file**

  ```bash
  wc -l docs/standards/testing.md       # expect 11 or fewer
  head -3 docs/standards/testing.md     # expect "# Copilot Software Testing Instructions"
  ```

- [ ] **Step 2: Rewrite `docs/standards/testing.md`**

  Write the following content (complete replacement):

  ```markdown
  # Software Testing Standard

  This document applies when running or writing tests.

  ---

  ## 1. Environment

  - Run `nvm use 22.16.0` before any test command
  - Working directory must be the repo root for all test commands

  ---

  ## 2. Commands

  | Mode                | Command                                     |
  | ------------------- | ------------------------------------------- |
  | Watch (development) | `pnpm test`                                 |
  | CI / single pass    | `pnpm test:ci`                              |
  | Targeted by file    | `pnpm test:ci <filename-without-extension>` |
  | E2E                 | `pnpm test:e2e`                             |

  - E2E tests require Storybook running on port 6006; start with `pnpm storybook` before running `pnpm test:e2e`

  ---

  ## 3. Test File Locations

  - Unit / integration: `tests/`, `src/tests/unit/`
  - E2E: `e2e/`

  ---

  ## 4. Scope

  - Unit tests: models, schemas, utilities
  - Component tests: UI components in isolation
  - E2E tests: full user flows against Storybook
  ```

- [ ] **Step 3: Verify the rewrite meets acceptance criteria**

  ```bash
  grep -c "Copilot" docs/standards/testing.md           # expect 0 — no agent-specific framing
  grep -c "nvm use 22.16.0" docs/standards/testing.md   # expect 1
  grep -c "pnpm test:e2e" docs/standards/testing.md     # expect 1
  grep -c "port 6006" docs/standards/testing.md         # expect 1
  grep -c "src/tests/unit" docs/standards/testing.md    # expect 1
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add docs/standards/testing.md
  git commit -m "docs(standards): rewrite testing standard — agent-agnostic, all commands documented"
  ```

---

## Task 5: Add brand-deference preamble to `frontend-design` skill

**Goal:** Insert a non-negotiable brand constraint block before the existing `## Design Thinking` section. No other changes to the skill body.

**Files:**

- Modify: `.github/skills/frontend-design/SKILL.md`

- [ ] **Step 1: Confirm insertion point**

  ```bash
  grep -n "## Design Thinking" .github/skills/frontend-design/SKILL.md
  ```

  Expected: one match. Note the line number — the preamble inserts immediately before it.

- [ ] **Step 2: Insert the brand-deference preamble**

  Find the line that reads:

  ```
  ## Design Thinking
  ```

  Insert the following block immediately before it (one blank line between the preamble and `## Design Thinking`):

  ```markdown
  ## GetWrite Brand Constraints — Load First

  Before making any aesthetic decision, read `STYLING.md`. The following rules are non-negotiable and override any creative guidance below:

  - **Typography:** IBM Plex Sans (UI), IBM Plex Mono (code/labels/timestamps), IBM Plex Serif (editor body only) — no other typefaces
  - **Color:** Use only the brand tokens defined in `STYLING.md` Section 2 (`--color-black`, `--color-white`, `--color-red`, `--color-mid`, `--color-surface` variants) — no new colors
  - **Red:** Reserved for position and canonical state only (active file indicator, active tab, cursor, canonical revision badge, editor chapter headings) — never for actions, hover states, or decoration
  - **Editor line height:** `--leading-relaxed` (1.8) minimum — non-negotiable
  - **Theming:** Dark/light mode via the existing CSS token system only — no custom theming
  - **Surfaces:** Flat — elevation is communicated through surface color only; no drop shadows anywhere
  - **No decorative overlays:** Gradient meshes, noise textures, and decorative overlays are prohibited (see `STYLING.md` Section 9)
  - **Motion:** `150ms ease` for color/border/opacity transitions; `200ms ease` for layout transitions

  **Fallback:** When `STYLING.md` does not cover a scenario (component layout, iconography, interaction choreography), the creative judgment guidance below applies. The fallback covers genuine gaps only — it does not override any rule in `STYLING.md`, including the anti-patterns in Section 9.

  ---
  ```

- [ ] **Step 3: Verify the preamble is in place, correctly ordered, and the rest of the file is unchanged**

  ```bash
  grep -c "STYLING.md" .github/skills/frontend-design/SKILL.md                   # expect ≥2
  # Verify original skill body is intact:
  grep -c "AI slop" .github/skills/frontend-design/SKILL.md                      # expect 1
  grep -c "Frontend Aesthetics Guidelines" .github/skills/frontend-design/SKILL.md  # expect 1
  # Verify preamble appears BEFORE Design Thinking (order check):
  awk '/GetWrite Brand Constraints/{found=1} /## Design Thinking/{if(found) print "ORDER_OK"}' .github/skills/frontend-design/SKILL.md
  # expect ORDER_OK
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add .github/skills/frontend-design/SKILL.md
  git commit -m "docs(skills): add GetWrite brand-deference preamble to frontend-design skill"
  ```

---

## Task 6: Refine `scholar` skill — tighten invocation and add cheap scan model

**Goal:** Replace the broad Invocation Triggers section (4 catch-all conditions) with three precise trigger conditions and six explicit skip conditions. Replace the Protocol section with the cheap scan model (filename-first, hard cap of 3 pages, no-op fast path).

**Files:**

- Modify: `.github/skills/scholar/SKILL.md`

- [ ] **Step 1: Confirm the two sections to replace**

  ```bash
  grep -n "## Invocation Triggers\|## Protocol" .github/skills/scholar/SKILL.md
  ```

  Expected: two matches — `## Invocation Triggers` around line 19, `## Protocol (How to use)` around line 50.

- [ ] **Step 2: Replace the `## Invocation Triggers` section**

  Find and replace the entire `## Invocation Triggers` section (lines 19–27 in the current file):

  **Remove:**

  ```markdown
  ## Invocation Triggers

  This skill should be invoked whenever the agent is about to plan or make a decision that may be influenced by prior project knowledge, such as:

  1. Planning a new feature or implementation.
  2. Refactoring existing code.
  3. Making architectural decisions.
  4. Any situation where prior intent, decisions, or lessons could affect the outcome.
  ```

  **Replace with:**

  ```markdown
  ## Invocation Triggers

  Invoke `scholar` in exactly these three cases:

  1. Starting work on a named feature or component that could have a corresponding tome page.
  2. Choosing between competing implementation approaches where a prior decision could exist.
  3. Modifying code that is explicitly named in a previous exchange or in a known tome page.

  **Do not invoke** for:

  1. Bug fixes in working code
  2. Adding tests to existing behavior
  3. Renaming
  4. Formatting
  5. Routine maintenance
  6. Purely additive work with no pattern choices
  ```

- [ ] **Step 3: Replace the `## Protocol (How to use)` section**

  Find and replace the entire `## Protocol (How to use)` section (lines 50–56 in the current file):

  **Remove:**

  ```markdown
  ## Protocol (How to use)

  1. Enumerate all files in `/experiments-nopush` matching `tome-*.md`.
  2. For each page, quickly scan headings and the one-line summary (if present) to decide whether it might affect the current task.
  3. If a page may apply, extract a one-sentence rationale and a one-sentence concrete effect on the plan. Prefer short, actionable language.
  4. Produce the `Scholar Summary:` block. If none matched, output `Scholar Summary: No tome pages applied.`
  5. Only after the `Scholar Summary` is produced may the agent proceed to planning.
  ```

  **Replace with:**

  ```markdown
  ## Protocol (How to use)

  ### Phase 1 — Cheap scan (always)

  1. List all files in `/experiments-nopush` matching `tome-###-*.md`.
  2. Read only filenames and the one-line summary field of each page — do not load full content yet.
  3. If no filenames match the current task topic: output `Scholar Summary: No tome pages applied.` and stop. Do not read any file content.

  ### Phase 2 — Selective load (only when Phase 1 finds matches)

  4. Load full content only for pages whose filename or summary matches the current task by topic.
  5. Hard cap: load at most 3 pages. If more than 3 match, list the extras by filename in the Scholar Summary without loading their content.
  6. For each loaded page, extract a one-sentence rationale and a one-sentence effect on the plan.
  7. Produce the `Scholar Summary:` block.
  8. Only after the `Scholar Summary` is produced may the agent proceed to planning.
  ```

- [ ] **Step 4: Update the frontmatter version and last_updated**

  In the frontmatter, change:

  ```yaml
  version: 1.0
  last_updated: 2026-03-13
  ```

  to:

  ```yaml
  version: 1.1
  last_updated: 2026-03-23
  ```

- [ ] **Step 5: Verify the changes**

  ```bash
  # Trigger conditions
  grep -c "exactly these three cases" .github/skills/scholar/SKILL.md   # expect 1
  grep -c "Do not invoke" .github/skills/scholar/SKILL.md               # expect 1
  # Six skip conditions are present (count the numbered list items under "Do not invoke")
  grep -A8 "Do not invoke" .github/skills/scholar/SKILL.md              # expect 6 numbered items

  # Cheap scan model
  grep -c "Phase 1" .github/skills/scholar/SKILL.md           # expect 1
  grep -c "Phase 2" .github/skills/scholar/SKILL.md           # expect 1
  grep -c "Hard cap" .github/skills/scholar/SKILL.md          # expect 1
  grep -c "No tome pages applied" .github/skills/scholar/SKILL.md  # expect ≥1

  # Old broad triggers are gone
  grep -c "Any situation where prior intent" .github/skills/scholar/SKILL.md  # expect 0
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add .github/skills/scholar/SKILL.md
  git commit -m "docs(skills): tighten scholar invocation triggers and add cheap scan protocol"
  ```

---

## Final Verification

- [ ] **Run acceptance criteria check against the spec**

  ```bash
  # AC1: code-documentation.md contains all rules
  grep -c "@module\|@param\|@throws\|@example\|implicit\|Last Updated" docs/standards/code-documentation.md
  # expect 6

  # AC2: typescript-implementation.md Section 9 is removed
  grep -c "Code Document Discipline" docs/standards/typescript-implementation.md
  # expect 0

  # AC3: code-documentation skill ≤30 lines, no duplicate rules
  wc -l .github/skills/code-documentation/SKILL.md
  # expect ≤30

  # AC4: reference file deleted
  test -f .github/skills/code-documentation/references/javascript-typescript.md && echo "EXISTS" || echo "DELETED"
  # expect DELETED

  # AC5: testing.md covers all four commands, no Copilot framing
  grep -c "| Watch" docs/standards/testing.md           # watch mode row — expect 1
  grep -c "pnpm test:ci" docs/standards/testing.md      # CI and targeted rows — expect ≥1
  grep -c "pnpm test:e2e" docs/standards/testing.md     # E2E row — expect 1
  grep -c "nvm use 22.16.0" docs/standards/testing.md   # environment — expect 1
  grep -c "Copilot" docs/standards/testing.md           # no agent framing — expect 0

  # AC6: frontend-design preamble cites STYLING.md and lists constraints
  grep -c "STYLING.md\|drop shadows\|gradient mesh\|150ms\|IBM Plex" .github/skills/frontend-design/SKILL.md
  # expect ≥5

  # AC7: scholar has 3 trigger conditions and 6 skip conditions
  grep -c "exactly these three cases" .github/skills/scholar/SKILL.md
  # expect 1
  grep -c "Do not invoke" .github/skills/scholar/SKILL.md
  # expect 1

  # AC8: scholar cheap scan model and hard cap
  grep -c "Hard cap\|Phase 1\|Phase 2" .github/skills/scholar/SKILL.md
  # expect 3
  ```
