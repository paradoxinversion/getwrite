# Tailwind v4 Styling Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all deprecated CSS tokens and utility classes with the canonical brand token system defined in `saboteur-base.css` and `getwrite-theme.css`, completing the Tailwind v4 migration.

**Architecture:** All component styles are rebuilt in `frontend/styles/getwrite-utilities.css` using semantic `gw-*` tokens. A CSS custom property cascade block on `.appshell-shell` resolves light vs dark mode — components do not contain dark mode overrides per class. Editor styles are isolated in `frontend/styles/editor.css`. All deprecated style files are deleted at the end.

**Tech Stack:** Tailwind CSS v4, CSS custom properties, Next.js App Router, TypeScript/React. All commands run from `frontend/` unless noted. Node version: 22.16.0 (`nvm use 22.16.0` before running any command).

---

## File Structure

**Created:**

- `frontend/styles/getwrite-utilities.css` — brand-token component classes, theme cascade, reduced-motion block
- `frontend/styles/editor.css` — `.tiptap` writing surface styles only

**Modified:**

- `frontend/app/globals.css` — import chain updated, `.tiptap` block removed
- `frontend/components/Start/StartPage.tsx` — deprecated inline tokens replaced
- `frontend/components/Start/CreateProjectModal.tsx` — deprecated inline tokens replaced
- `frontend/components/Start/RenameProjectModal.tsx` — deprecated inline tokens replaced
- `frontend/components/Start/ManageProjectMenu.tsx` — deprecated inline tokens replaced
- `frontend/components/project-types/ProjectTypeListPane.tsx` — deprecated inline tokens replaced
- `frontend/components/project-types/ProjectTypeEditorForm.tsx` — deprecated inline tokens replaced
- `frontend/components/project-types/ProjectTypesManagerPage.tsx` — deprecated inline tokens replaced
- `frontend/components/common/ConfirmDialog.tsx` — button pattern updated (D15)
- `frontend/components/common/CompilePreviewModal.tsx` — button pattern updated (D16)
- `frontend/components/common/ExportPreviewModal.tsx` — deprecated inline tokens replaced
- `frontend/components/common/ResourceCommandPalette.tsx` — deprecated inline tokens replaced
- `frontend/components/WorkArea/EditView.tsx` — deprecated inline tokens replaced
- `frontend/components/WorkArea/DiffView.tsx` — deprecated inline tokens replaced
- `frontend/components/WorkArea/ViewSwitcher.tsx` — deprecated inline tokens replaced
- `frontend/components/WorkArea/DataView.tsx` — deprecated inline tokens replaced
- `frontend/components/WorkArea/TimelineView.tsx` — deprecated inline tokens replaced
- `frontend/components/WorkArea/Views/OrganizerView/OrganizerView.tsx` — deprecated inline tokens replaced
- `frontend/components/WorkArea/Views/OrganizerView/OrganizerCard.tsx` — deprecated inline tokens replaced
- `frontend/components/Tree/ResourceTree.tsx` — deprecated inline tokens replaced
- `frontend/components/Tree/ResourceContextMenu.tsx` — deprecated inline tokens replaced
- `frontend/components/Tree/CreateResourceModal.tsx` — deprecated inline tokens replaced
- `frontend/components/ResourceTree/ResourceTree.tsx` — deprecated inline tokens replaced
- `frontend/components/SearchBar/SearchBar.tsx` — deprecated inline tokens replaced
- `frontend/components/Sidebar/MetadataSidebar.tsx` — deprecated inline tokens replaced
- `frontend/components/Sidebar/controls/*.tsx` — deprecated inline tokens replaced
- `frontend/components/Editor/RevisionControl/RevisionControl.tsx` — button pattern updated (D20)
- `frontend/components/help/HelpPage.tsx` — help-nav active state updated (D21)
- `frontend/components/help/HelpSectionCard.tsx` — deprecated inline tokens replaced
- `frontend/components/Layout/AppShell.tsx` — deprecated inline tokens replaced
- `frontend/components/Layout/ShellSettingsMenu.tsx` — deprecated inline tokens replaced
- `frontend/components/Layout/ShellModalCoordinator.tsx` — deprecated inline tokens replaced
- `frontend/components/Editor/MenuBar/MenuBar.tsx` — deprecated inline tokens replaced
- `frontend/components/Editor/MenuBar/EditorMenuIcon.tsx` — active state updated (D7)
- `frontend/components/Editor/MenuBar/EditorMenuIconGroup.tsx` — deprecated inline tokens replaced
- `frontend/components/Editor/MenuBar/EditorMenuInput.tsx` — deprecated inline tokens replaced
- `frontend/components/Editor/MenuBar/EditorMenuColorSubmenu.tsx` — deprecated inline tokens replaced
- `frontend/components/TipTapEditor.tsx` — deprecated inline tokens replaced

**Deleted (Task 14 only):**

- `frontend/styles/tokens.css`
- `frontend/styles/utilities.css`
- `frontend/styles/_variables.scss`
- `frontend/styles/_keyframe-animations.scss`

---

## Inline Token Substitution Reference

When you encounter these deprecated inline Tailwind utilities in any component JSX, replace them as shown. This table applies to ALL tasks.

| Deprecated class            | Brand replacement                        | Notes                           |
| --------------------------- | ---------------------------------------- | ------------------------------- |
| `text-ink-900`              | `text-gw-primary`                        |                                 |
| `text-ink-700`              | `text-gw-secondary`                      |                                 |
| `text-neutral-500`          | `text-gw-secondary`                      |                                 |
| `text-neutral-600`          | `text-gw-secondary`                      |                                 |
| `text-neutral-700`          | `text-gw-primary`                        |                                 |
| `text-neutral-900`          | `text-gw-primary`                        |                                 |
| `bg-neutral-50`             | `bg-gw-chrome`                           | via cascade                     |
| `bg-neutral-100`            | `bg-gw-chrome2`                          | via cascade                     |
| `bg-white`                  | `bg-gw-chrome`                           | via cascade                     |
| `bg-paper-50`               | `bg-gw-chrome2`                          |                                 |
| `bg-paper-100`              | `bg-gw-chrome2`                          |                                 |
| `bg-brand-50`               | `bg-gw-chrome2`                          |                                 |
| `border-neutral-200`        | `border-gw-border`                       |                                 |
| `border-neutral-300`        | `border-gw-border`                       |                                 |
| `border-neutral-400`        | `border-gw-border-md`                    |                                 |
| `border-brand-200`          | `border-gw-border`                       |                                 |
| `text-brand-700`            | `text-gw-primary`                        |                                 |
| `text-brand-200`            | `text-gw-primary`                        |                                 |
| `bg-brand-500` (non-button) | `bg-gw-secondary`                        | For indicator dots, not buttons |
| `bg-brand-400`              | `bg-gw-chrome2`                          |                                 |
| `rounded-2xl`               | `rounded-lg`                             | 16px → 8px per STYLING.md       |
| `rounded-xl` (modal)        | `rounded-lg`                             | 12px → 8px per STYLING.md       |
| `shadow-*`                  | _(delete, no replacement)_               | No drop shadows — STYLING.md S6 |
| `text-amber-700`            | `text-gw-red`                            | Only in dark mode warnings      |
| `text-slate-*`              | `text-gw-primary` or `text-gw-secondary` | Match semantic intent           |

**Button pattern replacements:**

| Deprecated pattern                                             | Brand replacement                                                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `bg-brand-500 text-white border-brand-600` (primary fill)      | `border border-gw-primary text-gw-primary bg-transparent hover:bg-gw-chrome2`                              |
| `bg-brand-50 border-brand-200 text-brand-700` (secondary fill) | `border border-[0.5px] border-gw-border text-gw-secondary hover:border-gw-border-md hover:text-gw-primary` |
| `bg-dc2626` or red fill (destructive)                          | `border border-gw-red-border text-gw-red bg-transparent hover:bg-gw-chrome2`                               |
| `rounded-full` on buttons                                      | `rounded-md`                                                                                               |

---

## Task 1: Wire Up — New Files and Import Chain

**Files:**

- Create: `frontend/styles/getwrite-utilities.css`
- Create: `frontend/styles/editor.css`
- Modify: `frontend/app/globals.css`

**Context:** This task creates the new CSS files (initially empty except for the theme cascade block), updates the import chain in globals.css, and moves the `.tiptap` block to editor.css. The existing `tokens.css` and `utilities.css` imports remain until Task 14. The app should look identical after this task.

- [x] **Step 1: Create `getwrite-utilities.css` with theme cascade**

Create `frontend/styles/getwrite-utilities.css` with this content:

```css
/*
 * getwrite-utilities.css
 * GetWrite component utilities for Tailwind v4.
 *
 * Structure:
 *   1. Theme token cascade (outside @layer) — resolves light/dark mode
 *   2. Reduced-motion blocks
 *   3. @layer components — component classes using gw-* semantic tokens
 *
 * Theming: .appshell-shell reassigns --color-gw-* tokens for light mode.
 *          .appshell-shell.appshell-theme-dark restores dark mode values.
 *          All component classes below use semantic tokens only — no explicit
 *          per-component dark mode overrides are needed.
 */

/* ── THEME CASCADE ── */
/* Light mode is the default. Reassign semantic tokens to light-mode values. */
.appshell-shell {
  --color-gw-bg: var(--color-gw-chrome-light);
  --color-gw-chrome: var(--color-gw-chrome-light);
  --color-gw-chrome2: var(--color-gw-chrome2-light);
  --color-gw-chrome3: var(--color-gw-chrome3-light);
  --color-gw-primary: #0a0a0a;
  --color-gw-secondary: var(--color-gw-secondary-light);
  --color-gw-border: var(--color-gw-border-light);
  --color-gw-border-md: #b0ada8;
  --color-gw-rule: var(--color-gw-rule-light);
  --color-gw-editor: var(--color-gw-paper);
}

/* Dark mode: restore @theme defaults */
.appshell-shell.appshell-theme-dark {
  --color-gw-bg: #0a0a0a;
  --color-gw-chrome: #111110;
  --color-gw-chrome2: #161614;
  --color-gw-chrome3: #1a1a18;
  --color-gw-primary: #f5f4f0;
  --color-gw-secondary: #6a6864;
  --color-gw-border: #2e2e2c;
  --color-gw-border-md: #3a3a38;
  --color-gw-rule: #1a1a18;
  --color-gw-editor: #1c1c1a;
}

/* ── REDUCED MOTION ── (only permitted !important blocks in this file) */
.gw-reduced-motion *,
.gw-reduced-motion *::before,
.gw-reduced-motion *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
  }
}

/* ── COMPONENT CLASSES ── */
@layer components {
  /* Component classes are added here in Tasks 2–13. */
  .truncate-2 {
    overflow: hidden;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}
```

- [x] **Step 2: Create `editor.css` (empty shell)**

Create `frontend/styles/editor.css` with this content:

```css
/*
 * editor.css
 * Styles scoped exclusively to the .tiptap writing surface.
 * No chrome, shell, or UI component styles here.
 * !important is prohibited in this file.
 */

/* .tiptap styles are added in Task 13 */
```

- [x] **Step 3: Update `globals.css`**

Replace the entire contents of `frontend/app/globals.css` with:

```css
@import "tailwindcss";
@import "../styles/saboteur-base.css";
@import "../styles/getwrite-theme.css";
@import "../styles/getwrite-utilities.css";
@import "../styles/editor.css";

/* Keeping deprecated files active until Task 14 */
@import "../styles/tokens.css";
@import "../styles/utilities.css";

html,
body,
#__next {
  height: 100%;
}
```

Note: The `.tiptap` block is NOT moved to editor.css yet. It will be moved in Task 13 after editor.css is fully populated.

- [x] **Step 4: Move Domine font loading to layout**

The Domine `@import url(...)` was removed from `globals.css` in Step 3. Domine must still load for the editor font-picker to work. Move it to `frontend/app/layout.tsx` as a `<link>` tag in the `<head>`.

Read `frontend/app/layout.tsx`. In the `<head>` block (or add one if absent), add:

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Domine:wght@400..700&display=swap"
/>
```

This matches the Google Fonts URL format already in `globals.css` and satisfies the spec requirement that "the dynamic loading system must support Google Fonts URL format." The font loads at runtime via the HTML head rather than via a CSS import, which is the Next.js App Router convention.

**Important:** Do NOT add Domine to the `<body>` className or any outer element — the font must remain scoped to the editor surface via the `.domine-400` class defined in `editor.css` (Task 12).

- [x] **Step 5: Verify the build**

```bash
cd frontend && nvm use 22.16.0 && pnpm typecheck
```

Expected: no errors.

```bash
pnpm build
```

Expected: build succeeds, no CSS errors.

- [x] **Step 6: Spot-check in browser**

Start the dev server (`pnpm dev`). Open the app. Verify it looks identical to before — no visual changes expected at this stage. Toggle dark/light mode to confirm both still work.

- [x] **Step 7: Commit**

```bash
git add frontend/styles/getwrite-utilities.css frontend/styles/editor.css frontend/app/globals.css frontend/app/layout.tsx
git commit -m "chore(styles): wire up new CSS architecture — create getwrite-utilities.css and editor.css, update import chain, move Domine to layout"
```

---

## Task 2: Start Page — CSS in getwrite-utilities.css

**Files:**

- Modify: `frontend/styles/getwrite-utilities.css`

**Context:** Add all `start-page-*` and `max-content-width` component classes to `getwrite-utilities.css` using brand tokens. The existing `utilities.css` classes remain active until Task 14 — adding to getwrite-utilities.css now establishes the new definitions; the old ones will be deleted later. Because both files are active, there will be no visual change yet (specificity cascade is fine; both are in @layer components, last-defined wins — the new ones load after the old).

- [x] **Step 1: Add start-page classes to getwrite-utilities.css**

Inside the `@layer components { }` block (after the `truncate-2` class), add:

```css
/* ── GENERIC UTILITIES ── */
.max-content-width {
  max-width: 72rem;
}

/* ── START PAGE ── */
.start-page-shell {
  min-height: 100vh;
  padding: var(--spacing-gw-8, 32px) var(--spacing-gw-6, 24px);
  background-color: var(
    --color-gw-editor
  ); /* warm surface for writing context */
  color: var(--color-gw-primary);
}

.start-page-hero {
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-gw-chrome);
  padding: var(--spacing-gw-8, 32px);
  position: relative;
  overflow: hidden;
}

.start-page-hero-grid {
  display: grid;
  gap: var(--spacing-gw-8, 32px);
}

@media (min-width: 1024px) {
  .start-page-hero-grid {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}

.start-page-hero-copy {
  display: flex;
  flex-direction: column;
}

.start-page-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  width: fit-content;
}

.start-page-wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.04em;
  color: var(--color-gw-primary);
  font-size: clamp(32px, 5vw, 48px);
  line-height: 1.05;
}

.start-page-wordmark-accent {
  /* Wordmark uses the standard brand split — see getwrite-theme.css utility notes */
  display: inline-block;
  border-left: 4px solid var(--color-gw-red);
  padding-left: 16px;
}

.start-page-chip {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
}

.start-page-panel {
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome2);
}

.start-page-card {
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome);
  transition:
    border-color 150ms ease,
    transform 200ms ease;
  position: relative;
  overflow: hidden;
}

.start-page-card:hover {
  border-color: var(--color-gw-border-md);
  transform: translateY(-4px);
}

/* Primary button: outlined white — never filled (D17) */
.start-page-primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--color-gw-primary);
  border-radius: var(--radius-md);
  color: var(--color-gw-primary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  background-color: transparent;
  padding: 8px 16px;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease;
}

.start-page-primary-button:hover {
  background-color: var(--color-gw-chrome2);
}

/* Secondary button: ghost (D18) */
.start-page-secondary-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  color: var(--color-gw-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background-color: transparent;
  padding: 6px 12px;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.start-page-secondary-button:hover {
  border-color: var(--color-gw-border-md);
  color: var(--color-gw-primary);
  background-color: var(--color-gw-chrome2);
}

/* Fade-in animations */
.start-page-fade-in {
  animation: start-page-reveal 500ms ease both;
}

.start-page-fade-in-delayed {
  animation: start-page-reveal 700ms ease 150ms both;
}

@keyframes start-page-reveal {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Note: `start-page-orb`, `start-page-orb-primary`, `start-page-orb-secondary` classes are intentionally NOT added. These were decorative elements (gradient orbs) that are prohibited by STYLING.md Section 9. They will be removed from JSX in Task 3.

- [x] **Step 2: Verify no build errors**

```bash
cd frontend && pnpm typecheck && pnpm build
```

Expected: success.

- [x] **Step 3: Commit**

```bash
git add frontend/styles/getwrite-utilities.css
git commit -m "chore(styles): add start-page component classes to getwrite-utilities.css with brand tokens"
```

---

## Task 3: Start Page — JSX Migration

**Files:**

- Modify: `frontend/components/Start/StartPage.tsx`
- Modify: `frontend/components/Start/CreateProjectModal.tsx`
- Modify: `frontend/components/Start/RenameProjectModal.tsx`
- Modify: `frontend/components/Start/ManageProjectMenu.tsx`

**Context:** Replace all deprecated inline token utilities in Start page JSX files. Remove the decorative orb elements. Update button patterns. The `start-page-*` class names stay the same (they now resolve to the new getwrite-utilities.css definitions).

- [x] **Step 1: Update `StartPage.tsx`**

Apply these changes to `frontend/components/Start/StartPage.tsx`:

1. Remove the `start-page-orb` divs (lines with `start-page-orb start-page-orb-primary` and `start-page-orb-secondary`). No replacement — these were decorative.

2. Replace the `start-page-wordmark-accent` span: change the inner content from just `GetWrite` text to the brand wordmark split:

```tsx
<span className="start-page-wordmark-accent">
  <span className="font-display font-normal tracking-[-0.02em] text-gw-secondary">
    Get
  </span>
  <span className="font-display font-bold tracking-[-0.04em] text-gw-primary">
    Write
  </span>
</span>
```

3. Replace all deprecated inline utilities using the substitution table:
   - `text-ink-700` → `text-gw-secondary`
   - `text-ink-900` → `text-gw-primary`
   - `text-neutral-500` → `text-gw-secondary`
   - `border-neutral-200 bg-paper-50` → `border-gw-border bg-gw-chrome2`
   - `border-neutral-200 bg-white` → `border-gw-border bg-gw-chrome`
   - `bg-brand-50 border-brand-200 text-brand-700` (secondary button) → remove these inline classes; the `start-page-secondary-button` class handles all styles
   - `bg-brand-50 px-3 py-1` (project type chip) → `bg-gw-chrome2 border border-[0.5px] border-gw-border px-3 py-1 rounded-sm`
   - `bg-paper-100 px-3 py-1` (root path chip) → `bg-gw-chrome border border-[0.5px] border-gw-border px-3 py-1 rounded-sm`
   - `rounded-2xl` → `rounded-lg`
   - `inline-block h-2 w-2 rounded-full bg-brand-500` (status dot in kicker) → `inline-block h-1.5 w-1.5 rounded-full bg-gw-secondary`

4. The `start-page-primary-button` and `start-page-secondary-button` now get all their styling from getwrite-utilities.css. Remove any inline color/bg/border classes that duplicate them (the `text-white`, `border-brand-200`, `bg-brand-50`, etc. on those button elements).

- [x] **Step 2: Update `CreateProjectModal.tsx`**

Read the file. Replace all deprecated inline utilities using the substitution table. Check for any blue fill buttons — replace with outlined pattern.

- [x] **Step 3: Update `RenameProjectModal.tsx` and `ManageProjectMenu.tsx`**

Read each file. Replace all deprecated inline utilities.

- [x] **Step 4: Update `ConfirmDialog.tsx` (D15 — destructive button)**

Read `frontend/components/common/ConfirmDialog.tsx`. Find the confirm/destructive button and replace the red fill pattern:

Change from (any variation of red fill):

```tsx
className = "bg-red-600 text-white ...";
/* or */
className = "confirm-dialog-confirm ...";
```

Change to:

```tsx
className =
  "border border-gw-red-border text-gw-red bg-transparent rounded-md font-mono text-[10px] uppercase tracking-[0.16em] px-4 py-2 hover:bg-gw-chrome2 transition-colors duration-150";
```

Also add `border border-gw-primary text-gw-primary bg-transparent rounded-md font-mono text-[10px] uppercase tracking-[0.16em] px-4 py-2 hover:bg-gw-chrome2 transition-colors duration-150` to any "cancel" button that currently uses generic styling.

- [x] **Step 5: Update `CompilePreviewModal.tsx` (D16 — blue fill button)**

Read `frontend/components/common/CompilePreviewModal.tsx`. Find `compile-modal-confirm` or any blue fill button and replace with the outlined primary pattern:

```tsx
className =
  "border border-gw-primary text-gw-primary bg-transparent rounded-md font-mono text-[10px] uppercase tracking-[0.16em] px-4 py-2 hover:bg-gw-chrome2 transition-colors duration-150";
```

- [x] **Step 6: Typecheck and visual verify**

```bash
cd frontend && pnpm typecheck
```

Start dev server, navigate to the Start page. Verify:

- No blue fills on any button
- No gradient orbs
- Cards have flat surfaces, no shadows
- Dark mode toggles correctly (colors shift from warm-light to warm-dark)
- Wordmark shows "Get" in secondary color and "Write" in primary color with red left border

- [x] **Step 7: Commit**

```bash
git add frontend/components/Start/ frontend/components/common/ConfirmDialog.tsx frontend/components/common/CompilePreviewModal.tsx
git commit -m "chore(styles): migrate Start page JSX to brand tokens — remove decorative elements, fix button patterns"
```

---

## Task 4: Project Type Screens

**Files:**

- Modify: `frontend/styles/getwrite-utilities.css`
- Modify: `frontend/components/project-types/ProjectTypeListPane.tsx`
- Modify: `frontend/components/project-types/ProjectTypeEditorForm.tsx`
- Modify: `frontend/components/project-types/ProjectTypesManagerPage.tsx`
- Modify: `frontend/components/common/ExportPreviewModal.tsx`
- Modify: `frontend/components/common/ResourceCommandPalette.tsx`

- [x] **Step 1: Add project-type CSS to getwrite-utilities.css**

Inside `@layer components`, add after the start-page section:

```css
/* ── PROJECT TYPE MANAGER ── */
.project-type-list-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-gw-chrome);
  border-right: 0.5px solid var(--color-gw-border);
}

.project-type-list-pane-header {
  padding: 16px;
  border-bottom: 0.5px solid var(--color-gw-border);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
}

.project-type-list-item {
  padding: 10px 16px;
  cursor: pointer;
  border-left: 2px solid transparent;
  color: var(--color-gw-secondary);
  font-size: 13px;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.project-type-list-item:hover {
  background-color: var(--color-gw-chrome2);
  color: var(--color-gw-primary);
}

.project-type-list-item--active {
  background-color: var(--color-gw-chrome2);
  border-left-color: var(--color-gw-red);
  color: var(--color-gw-primary);
  padding-left: 14px; /* compensate for 2px border */
}

.project-type-editor {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background-color: var(--color-gw-chrome2);
}

.project-type-editor-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 0.5px solid var(--color-gw-border);
}

.project-type-editor-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-gw-primary);
}

.project-type-editor-subtitle {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--color-gw-secondary);
  margin-top: 4px;
}
```

- [x] **Step 2: Update project-type JSX files**

Read each file. Replace deprecated inline utilities using the substitution table. Replace any blue fill buttons with the outlined primary pattern (D16). Replace `project-modal-button-primary` classes.

- [x] **Step 3: Update `ExportPreviewModal.tsx` and `ResourceCommandPalette.tsx`**

Read each file. Replace deprecated inline utilities. Check for any modal panels — ensure `rounded-lg` (not `rounded-xl` or `rounded-2xl`) is used.

- [x] **Step 4: Typecheck**

```bash
cd frontend && pnpm typecheck
```

Expected: no errors.

- [x] **Step 5: Commit**

```bash
git add frontend/styles/getwrite-utilities.css frontend/components/project-types/ frontend/components/common/ExportPreviewModal.tsx frontend/components/common/ResourceCommandPalette.tsx
git commit -m "chore(styles): migrate project type screens to brand tokens"
```

---

## Task 5: WorkArea — CSS in getwrite-utilities.css

**Files:**

- Modify: `frontend/styles/getwrite-utilities.css`

- [x] **Step 1: Add workarea classes to getwrite-utilities.css**

Inside `@layer components`, add:

```css
/* ── WORKAREA ── */
.workarea-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  background-color: var(--color-gw-chrome2);
  color: var(--color-gw-primary);
  /* No box-shadow — surfaces communicate elevation via color only (D10) */
}

.workarea-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.workarea-view-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Tab button — D9: no blue fill */
.workarea-tab-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border: 0.5px solid var(--color-gw-border);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease,
    border-color 150ms ease;
}

.workarea-tab-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-gw-focus-ring);
}

.workarea-tab-button[role="tab"][aria-selected="false"]:not(:disabled) {
  background-color: var(--color-gw-chrome);
  color: var(--color-gw-secondary);
  border-color: var(--color-gw-border);
}

.workarea-tab-button[role="tab"][aria-selected="false"]:not(:disabled):hover {
  background-color: var(--color-gw-chrome2);
  color: var(--color-gw-primary);
}

.workarea-tab-button[role="tab"][aria-selected="true"] {
  background-color: var(--color-gw-chrome2);
  color: var(--color-gw-primary);
  border-color: var(--color-gw-border-md);
}

.workarea-pane {
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome);
  padding: 16px;
}

.workarea-pane-title {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
  margin-bottom: 12px;
}

.workarea-pane-content {
  color: var(--color-gw-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.workarea-section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-gw-primary);
  margin-bottom: 12px;
}

.workarea-stat-card {
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome);
  padding: 16px;
}

.workarea-stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-gw-primary);
}

.workarea-stat-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
  margin-top: 4px;
}

.workarea-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-gw-chrome);
  transition: background-color 150ms ease;
  cursor: pointer;
}

.workarea-list-item:hover {
  background-color: var(--color-gw-chrome2);
}

.workarea-list-item-label {
  font-size: 13px;
  color: var(--color-gw-primary);
}

.workarea-list-item-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-gw-secondary);
}

.workarea-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: transparent;
  color: var(--color-gw-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease,
    border-color 150ms ease;
}

.workarea-button:hover {
  background-color: var(--color-gw-chrome2);
  color: var(--color-gw-primary);
  border-color: var(--color-gw-border-md);
}

/* ── EDITVIEW DOC HEADER ── */
.editview-doc-header {
  padding: 16px 24px;
  border-bottom: 0.5px solid var(--color-gw-border);
  background-color: var(--color-gw-chrome);
}

.editview-doc-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-gw-primary);
}

.editview-doc-subtitle {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--color-gw-secondary);
  margin-top: 4px;
}
```

- [x] **Step 2: Typecheck and commit**

```bash
cd frontend && pnpm typecheck
git add frontend/styles/getwrite-utilities.css
git commit -m "chore(styles): add workarea component classes to getwrite-utilities.css"
```

---

## Task 6: WorkArea and ResourceTree — JSX Migration

**Files:**

- Modify: `frontend/components/WorkArea/EditView.tsx`
- Modify: `frontend/components/WorkArea/DiffView.tsx`
- Modify: `frontend/components/WorkArea/ViewSwitcher.tsx`
- Modify: `frontend/components/WorkArea/DataView.tsx`
- Modify: `frontend/components/WorkArea/TimelineView.tsx`
- Modify: `frontend/components/WorkArea/Views/OrganizerView/OrganizerView.tsx`
- Modify: `frontend/components/WorkArea/Views/OrganizerView/OrganizerCard.tsx`
- Modify: `frontend/components/Tree/ResourceTree.tsx`
- Modify: `frontend/components/Tree/ResourceContextMenu.tsx`
- Modify: `frontend/components/Tree/CreateResourceModal.tsx`
- Modify: `frontend/components/ResourceTree/ResourceTree.tsx`
- Modify: `frontend/components/SearchBar/SearchBar.tsx`

- [x] **Step 1: Read and update each WorkArea component**

For each file, read it first. Replace deprecated inline utilities using the substitution table. Pay attention to:

- Any `workarea-tab-button[aria-selected="true"]` className — the aria attribute is set at runtime, the class name itself is fine
- Any focus ring that uses blue — replace with `focus-visible:ring-[3px] focus-visible:ring-gw-focus-ring focus-visible:outline-none`
- Any `shadow-*` utilities — delete with no replacement

- [x] **Step 2: Read and update ResourceTree and Tree components**

For `ResourceTree/ResourceTree.tsx` and `Tree/ResourceTree.tsx`: replace deprecated inline token utilities. Active resource items should have `border-l-[2px] border-gw-red-border bg-gw-chrome2 text-gw-primary pl-[14px]`.

For `Tree/ResourceContextMenu.tsx`: check for `resource-context-menu-item-danger` — ensure it uses `text-gw-red`. If inline, replace any red-variant Tailwind class with `text-gw-red`.

- [x] **Step 3: Read and update SearchBar**

Read `frontend/components/SearchBar/SearchBar.tsx`. Replace deprecated inline utilities. Focus ring: `focus-visible:ring-[3px] focus-visible:ring-gw-focus-ring`.

- [x] **Step 4: Also add resource-related CSS classes to getwrite-utilities.css**

Add inside `@layer components`:

```css
/* ── RESOURCE CONTEXT MENU ── */
.resource-context-menu {
  min-width: 180px;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome2);
  padding: 4px;
}

.resource-context-menu-header {
  padding: 6px 10px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
  border-bottom: 0.5px solid var(--color-gw-border);
  margin-bottom: 4px;
}

.resource-context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  border: none;
  color: var(--color-gw-secondary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.resource-context-menu-item:hover {
  background-color: var(--color-gw-chrome3);
  color: var(--color-gw-primary);
}

.resource-context-menu-item-danger {
  color: var(--color-gw-red);
}

.resource-context-menu-item-danger:hover {
  background-color: var(--color-gw-chrome3);
  color: var(--color-gw-red);
}

/* ── RESOURCE PALETTE (command palette) ── */
.resource-palette-panel {
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome2);
  overflow: hidden;
}

.resource-palette-header {
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--color-gw-border);
}

.resource-palette-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-gw-primary);
  font-size: 14px;
  padding: 0;
}

.resource-palette-input::placeholder {
  color: var(--color-gw-secondary);
}

.resource-palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  color: var(--color-gw-secondary);
  font-size: 13px;
  transition: background-color 150ms ease;
}

.resource-palette-item:hover {
  background-color: var(--color-gw-chrome3);
  color: var(--color-gw-primary);
}

/* ── SEARCHBAR ── */
.searchbar-root {
  position: relative;
  display: flex;
  align-items: center;
}

.searchbar-field {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome2);
  padding: 6px 10px;
  transition: border-color 150ms ease;
}

.searchbar-field:focus-within {
  border-color: var(--color-gw-border-md);
  box-shadow: 0 0 0 3px var(--color-gw-focus-ring);
}

.searchbar-icon {
  color: var(--color-gw-secondary);
  flex-shrink: 0;
}

.searchbar-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-gw-primary);
  font-size: 13px;
}

.searchbar-input::placeholder {
  color: var(--color-gw-secondary);
}

.searchbar-shortcut {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
}

.searchbar-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome2);
  overflow: hidden;
  z-index: 40;
}

.searchbar-result-button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  text-align: left;
  color: var(--color-gw-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.searchbar-result-button:hover {
  background-color: var(--color-gw-chrome3);
  color: var(--color-gw-primary);
}

/* ── DRAGLINE ── */
.dragline {
  height: 2px;
  background-color: var(--color-gw-red);
  position: relative;
  pointer-events: none;
}

.dragline::before {
  content: "";
  position: absolute;
  left: -4px;
  top: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-gw-red);
}
```

- [x] **Step 5: Typecheck**

```bash
cd frontend && pnpm typecheck
```

Expected: no errors.

- [x] **Step 6: Visual spot-check**

Load the app. Open a project. Verify:

- Resource tree hover and active states are correct
- No blue anywhere in WorkArea tabs
- Context menu uses brand colors
- Drag indicator (if visible) uses brand red

- [x] **Step 7: Commit**

```bash
git add frontend/styles/getwrite-utilities.css frontend/components/WorkArea/ frontend/components/Tree/ frontend/components/ResourceTree/ frontend/components/SearchBar/
git commit -m "chore(styles): migrate WorkArea and ResourceTree to brand tokens"
```

---

## Task 7: Sidebar and Revision Control

**Files:**

- Modify: `frontend/styles/getwrite-utilities.css`
- Modify: `frontend/components/Sidebar/MetadataSidebar.tsx`
- Modify: `frontend/components/Sidebar/controls/MultiSelectList.tsx`
- Modify: `frontend/components/Sidebar/controls/NotesInput.tsx`
- Modify: `frontend/components/Sidebar/controls/POVAutocomplete.tsx`
- Modify: `frontend/components/Sidebar/controls/StatusSelector.tsx`
- Modify: `frontend/components/Editor/RevisionControl/RevisionControl.tsx`

- [x] **Step 1: Add sidebar CSS to getwrite-utilities.css**

Inside `@layer components`, add:

```css
/* ── METADATA SIDEBAR ── */
.metadata-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-gw-chrome);
  border-left: 0.5px solid var(--color-gw-border);
  overflow-y: auto;
}

.metadata-sidebar-header {
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--color-gw-border);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
}

.metadata-sidebar-section {
  padding: 16px;
  border-bottom: 0.5px solid var(--color-gw-rule);
}

.metadata-sidebar-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
  margin-bottom: 8px;
}

.metadata-sidebar-input {
  width: 100%;
  background-color: var(--color-gw-chrome2);
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-size: 12px;
  color: var(--color-gw-primary);
  outline: none;
  transition: border-color 150ms ease;
}

.metadata-sidebar-input:focus {
  border-color: var(--color-gw-border-md);
  box-shadow: 0 0 0 3px var(--color-gw-focus-ring);
}

.metadata-sidebar-tag {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  color: var(--color-gw-secondary);
  background: transparent;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    color 150ms ease;
}

.metadata-sidebar-tag--active {
  border-color: var(--color-gw-red-border);
  color: var(--color-gw-red);
  opacity: 0.8;
}

/* ── REVISION CONTROL ── */
.revision-control {
  display: flex;
  flex-direction: column;
  background-color: var(--color-gw-chrome);
  border-top: 0.5px solid var(--color-gw-border);
}

.revision-control-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 0.5px solid var(--color-gw-border);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-gw-secondary);
}

.revision-control-list {
  overflow-y: auto;
  flex: 1;
}

.revision-control-item {
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--color-gw-rule);
  background-color: var(--color-gw-chrome);
  transition: background-color 150ms ease;
}

.revision-control-item:hover {
  background-color: var(--color-gw-chrome2);
}

.revision-control-item-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-gw-primary);
}

.revision-control-item-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--color-gw-secondary);
  margin-top: 2px;
}

/* Canonical revision badge — outlined red, never filled (STYLING.md S7) */
.revision-control-badge {
  display: inline-flex;
  align-items: center;
  border: 0.5px solid var(--color-gw-red-border);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-gw-red);
  opacity: 0.8;
  background: transparent;
}

/* Save button — outlined primary, never blue-filled (D20) */
.revision-control-save-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--color-gw-primary);
  border-radius: var(--radius-md);
  color: var(--color-gw-primary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  background-color: transparent;
  padding: 6px 12px;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease;
}

.revision-control-save-button:hover {
  background-color: var(--color-gw-chrome2);
}

.revision-control-save-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [x] **Step 2: Update sidebar JSX**

Read each Sidebar component file. Replace deprecated inline utilities using the substitution table. Ensure metadata input focus rings use `focus:ring-[3px] focus:ring-gw-focus-ring focus:outline-none` pattern.

- [x] **Step 3: Update `RevisionControl.tsx` (D20)**

Read `frontend/components/Editor/RevisionControl/RevisionControl.tsx`. Find any save/confirm buttons with blue fill patterns and replace with the outlined primary pattern. The `revision-control-save-button` class in getwrite-utilities.css now provides the correct styling — ensure the JSX uses this class.

Find and remove any explicit blue background colors from revision control buttons.

- [x] **Step 4: Typecheck**

```bash
cd frontend && pnpm typecheck
```

- [x] **Step 5: Commit**

```bash
git add frontend/styles/getwrite-utilities.css frontend/components/Sidebar/ frontend/components/Editor/RevisionControl/
git commit -m "chore(styles): migrate Sidebar and RevisionControl to brand tokens"
```

---

## Task 8: Help Page

**Files:**

- Modify: `frontend/styles/getwrite-utilities.css`
- Modify: `frontend/components/help/HelpPage.tsx`
- Modify: `frontend/components/help/HelpSectionCard.tsx`

- [x] **Step 1: Add help CSS to getwrite-utilities.css**

Inside `@layer components`, add:

```css
/* ── HELP PAGE ── */
.help-layout {
  display: grid;
  height: 100%;
  overflow: hidden;
}

@media (min-width: 768px) {
  .help-layout {
    grid-template-columns: 200px 1fr;
  }
}

.help-nav {
  border-right: 0.5px solid var(--color-gw-border);
  background-color: var(--color-gw-chrome);
  padding: 16px 0;
  overflow-y: auto;
}

.help-nav-item {
  display: block;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--color-gw-secondary);
  border-left: 2px solid transparent;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.help-nav-item:hover {
  background-color: var(--color-gw-chrome2);
  color: var(--color-gw-primary);
}

/* Active nav item — position marking with red border (D21) */
.help-nav-item--active {
  background-color: var(--color-gw-chrome2);
  border-left-color: var(--color-gw-red);
  color: var(--color-gw-primary);
  padding-left: 14px; /* compensate for 2px border */
}

.help-content {
  overflow-y: auto;
  padding: 24px;
  background-color: var(--color-gw-chrome2);
}

.help-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 0.5px solid var(--color-gw-border);
}

.help-section-card {
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome);
  padding: 16px;
  margin-bottom: 12px;
}

.help-kbd {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  color: var(--color-gw-secondary);
  background-color: var(--color-gw-chrome2);
}
```

- [x] **Step 2: Update help JSX**

Read `HelpPage.tsx` and `HelpSectionCard.tsx`. Replace deprecated inline utilities. Ensure `help-nav-item--active` is used instead of any blue fill active state.

- [x] **Step 3: Typecheck and commit**

```bash
cd frontend && pnpm typecheck
git add frontend/styles/getwrite-utilities.css frontend/components/help/
git commit -m "chore(styles): migrate Help page to brand tokens"
```

---

## Task 9: AppShell — CSS in getwrite-utilities.css

**Files:**

- Modify: `frontend/styles/getwrite-utilities.css`

**Context:** AppShell is the most complex component group. The theme cascade established in Task 1 means no per-component dark mode override blocks are needed — components use semantic tokens that automatically resolve based on the `.appshell-shell` / `.appshell-shell.appshell-theme-dark` cascade.

- [x] **Step 1: Add AppShell CSS to getwrite-utilities.css**

Inside `@layer components`, add:

```css
/* ── APPSHELL ── */
.appshell-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  background-color: var(--color-gw-bg);
  color: var(--color-gw-primary);
}

.appshell-topbar {
  flex-shrink: 0;
  height: var(--height-gw-titlebar); /* 44px */
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 0.5px solid var(--color-gw-border);
  background-color: var(--color-gw-chrome);
}

.appshell-topbar-project {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-gw-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.appshell-topbar-menu {
  position: relative;
  flex-shrink: 0;
}

.appshell-topbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  border: 0.5px solid var(--color-gw-border);
  background: transparent;
  color: var(--color-gw-secondary);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.appshell-topbar-button:hover {
  background-color: var(--color-gw-chrome2);
  border-color: var(--color-gw-border-md);
  color: var(--color-gw-primary);
}

.appshell-topbar-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-gw-focus-ring);
  border-color: var(--color-gw-border-md);
}

.appshell-topbar-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 12rem;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome2);
  padding: 4px;
  z-index: 40;
  /* No box-shadow (D10) */
}

.appshell-topbar-dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  border: 0;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--color-gw-secondary);
  font-size: 13px;
  text-align: left;
  padding: 6px 10px;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.appshell-topbar-dropdown-item:hover {
  background-color: var(--color-gw-chrome3);
  color: var(--color-gw-primary);
}

/* Active pressed state — surface elevation, no blue (D11) */
.appshell-topbar-dropdown-item[aria-pressed="true"] {
  background-color: var(--color-gw-chrome3);
  color: var(--color-gw-primary);
}

.appshell-topbar-dropdown-separator {
  height: 0;
  border: 0;
  border-top: 0.5px solid var(--color-gw-border);
  margin: 4px;
}

.appshell-body {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  overflow: hidden;
}

.appshell-container {
  display: flex;
  height: 100vh;
  max-height: 100vh;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  background-color: var(--color-gw-bg);
  color: var(--color-gw-primary);
}

.appshell-sidebar {
  flex-shrink: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: var(--color-gw-chrome);
  border-color: var(--color-gw-border);
  display: flex;
  flex-direction: column;
}

.appshell-sidebar-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
  border-bottom: 0.5px solid var(--color-gw-border);
}

.appshell-sidebar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.appshell-close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background-color: transparent;
  color: var(--color-gw-secondary);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.appshell-close-button:hover {
  background-color: var(--color-gw-chrome2);
  color: var(--color-gw-primary);
}

.appshell-resize-handle {
  flex-shrink: 0;
  width: 0.5rem;
  height: 100%;
  cursor: col-resize;
  background-color: transparent;
  transition: background-color 150ms ease;
  user-select: none;
}

.appshell-resize-handle:hover {
  background-color: var(--color-gw-border);
}

/* Active resize: subtle, no color signal (D11) */
.appshell-resize-handle:active {
  background-color: var(--color-gw-border-md);
}

.appshell-sidebar-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  height: 2.5rem;
  padding: 0 0.5rem;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: transparent;
  color: var(--color-gw-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.appshell-sidebar-toggle:hover {
  background-color: var(--color-gw-chrome2);
  border-color: var(--color-gw-border-md);
  color: var(--color-gw-primary);
}

.appshell-work-area {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.appshell-work-area-content {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

/* ── MODALS ── */
.appshell-modal-root {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.appshell-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(2, 6, 23, 0.4);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.appshell-modal-panel {
  position: relative;
  z-index: 10;
  width: min(94vw, 820px);
  max-height: 92vh;
  overflow-y: auto;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-lg); /* 8px — STYLING.md S6 */
  background-color: var(--color-gw-chrome);
  /* No box-shadow (D10) */
}

.appshell-modal-panel--help {
  width: min(94vw, 860px);
}

.appshell-modal-panel--project-types {
  width: min(96vw, 1200px);
}

.appshell-modal-message {
  padding: 24px;
  font-size: 13px;
  color: var(--color-gw-secondary);
}

/* Error message: red as signal (D13) */
.appshell-modal-message--error {
  color: var(--color-gw-red);
}

/* ── DENSITY VARIANTS ── */
.gw-density-compact .appshell-topbar {
  height: 3rem;
  padding: 0 12px;
}

.gw-density-compact .appshell-sidebar-header {
  height: 2.5rem;
  padding: 0 12px;
}

.gw-density-compact .appshell-topbar-dropdown-item {
  padding: 5px 8px;
  font-size: 12px;
}

.gw-density-compact .start-page-shell {
  padding-top: 16px;
  padding-bottom: 16px;
}
```

- [x] **Step 2: Typecheck and commit**

```bash
cd frontend && pnpm typecheck
git add frontend/styles/getwrite-utilities.css
git commit -m "chore(styles): add AppShell component classes to getwrite-utilities.css with brand tokens"
```

---

## Task 10: AppShell — JSX Migration

**Files:**

- Modify: `frontend/components/Layout/AppShell.tsx`
- Modify: `frontend/components/Layout/ShellSettingsMenu.tsx`
- Modify: `frontend/components/Layout/ShellModalCoordinator.tsx`
- Modify: `frontend/components/Layout/ShellLayoutController.tsx`
- Modify: `frontend/components/Layout/ShellProjectTypeLoader.tsx`
- Modify: `frontend/components/preferences/UserPreferencesPage.tsx`
- Modify: `frontend/components/preferences/AppearanceRuntime.tsx` (no class changes needed — verify only)

- [x] **Step 1: Update `AppShell.tsx`**

Read the full file. Apply the substitution table to all deprecated inline tokens. Specific items to change:

- Any `bg-white border-r` on the collapsed sidebar toggle div → `bg-gw-chrome border-r border-[0.5px] border-gw-border`
- `text-slate-700` (Resources label) → `text-gw-secondary font-mono text-[9px] uppercase tracking-[0.18em]`
- Any `shadow-*` → delete
- Any `rounded-xl` → `rounded-lg`
- Focus ring patterns → `focus-visible:ring-[3px] focus-visible:ring-gw-focus-ring focus-visible:outline-none`

- [x] **Step 2: Update `ShellSettingsMenu.tsx`, `ShellModalCoordinator.tsx`, and remaining layout files**

Read each file. Apply substitution table. Check for any blue fills on buttons.

- [x] **Step 3: Update `UserPreferencesPage.tsx`**

Read the file. It also wraps content in `appshell-shell` — apply substitution table.

- [x] **Step 4: Typecheck**

```bash
cd frontend && pnpm typecheck
```

- [x] **Step 5: Visual spot-check — full flow**

Start dev server. Test:

- Light mode: clean warm-light chrome, warm editor surface
- Dark mode (toggle): clean warm-dark chrome, darker editor surface
- Modal opens correctly with flat border, no shadow
- Dropdown menu in topbar: brand colors, no blue active state
- Sidebar open/close/resize: no blue indicators

- [x] **Step 6: Commit**

```bash
git add frontend/components/Layout/ frontend/components/preferences/
git commit -m "chore(styles): migrate AppShell JSX to brand tokens — remove blue interactive states, apply theme cascade"
```

---

## Task 11: Editor Toolbar — CSS and JSX

**Files:**

- Modify: `frontend/styles/getwrite-utilities.css`
- Modify: `frontend/components/Editor/MenuBar/MenuBar.tsx`
- Modify: `frontend/components/Editor/MenuBar/EditorMenuIcon.tsx`
- Modify: `frontend/components/Editor/MenuBar/EditorMenuIconGroup.tsx`
- Modify: `frontend/components/Editor/MenuBar/EditorMenuInput.tsx`
- Modify: `frontend/components/Editor/MenuBar/EditorMenuColorSubmenu.tsx`
- Modify: `frontend/components/TipTapEditor.tsx`

- [x] **Step 1: Add editor toolbar CSS to getwrite-utilities.css**

Inside `@layer components`, add:

```css
/* ── EDITOR TOOLBAR ── */
.tiptap-editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-gw-editor);
}

.tiptap-editor-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--padding-gw-editor-y, 32px) var(--padding-gw-editor-x, 40px);
}

.editor-menubar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 0.5px solid var(--color-gw-border);
  background-color: var(--color-gw-chrome);
  flex-wrap: wrap;
}

.editor-menu-group-root {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  border-right: 0.5px solid var(--color-gw-border);
}

.editor-menu-group-root:last-child {
  border-right: none;
}

.editor-menu-group-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
}

.editor-menu-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--color-gw-secondary);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.editor-menu-icon-button:hover {
  background-color: var(--color-gw-chrome2);
  color: var(--color-gw-primary);
}

/* Active (format is on) — surface elevation, no blue (D7) */
.editor-menu-icon-button-active {
  background-color: var(--color-gw-chrome2);
  color: var(--color-gw-primary);
}

.editor-menu-icon-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-gw-focus-ring);
}

.editor-menu-input-root {
  display: flex;
  align-items: center;
  gap: 4px;
}

.editor-menu-input-control {
  width: 48px;
  background-color: var(--color-gw-chrome2);
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-gw-primary);
  outline: none;
  transition: border-color 150ms ease;
}

.editor-menu-input-control:focus {
  border-color: var(--color-gw-border-md);
  box-shadow: 0 0 0 3px var(--color-gw-focus-ring);
}

.editor-menu-color-submenu {
  position: absolute;
  z-index: 50;
  border: 0.5px solid var(--color-gw-border);
  border-radius: var(--radius-md);
  background-color: var(--color-gw-chrome2);
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

.editor-menu-color-option {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 0.5px solid transparent;
  cursor: pointer;
  transition: border-color 150ms ease;
}

.editor-menu-color-option:hover {
  border-color: var(--color-gw-primary);
}

.editor-menu-color-option-active {
  border-color: var(--color-gw-primary);
  outline: 2px solid var(--color-gw-focus-ring);
  outline-offset: 1px;
}
```

- [x] **Step 2: Update editor toolbar JSX files**

Read each file. Replace deprecated inline tokens. Ensure `editor-menu-icon-button-active` is used (not a blue background) for active format states.

- [x] **Step 3: Typecheck**

```bash
cd frontend && pnpm typecheck
```

- [x] **Step 4: Commit**

```bash
git add frontend/styles/getwrite-utilities.css frontend/components/Editor/MenuBar/ frontend/components/TipTapEditor.tsx
git commit -m "chore(styles): migrate editor toolbar to brand tokens — replace blue active state with surface elevation"
```

---

## Task 12: Editor Surface — editor.css

**Files:**

- Modify: `frontend/styles/editor.css`
- Modify: `frontend/app/globals.css` (move .tiptap block)

**Context:** The editor safety constraint applies here. All `.tiptap` rules must use class-based selectors with specificity ≤ (0,1,1). No `!important`. User formatting (inline styles, semantic marks) has specificity (1,0,0) and always wins. Run the manual formatting test after completing this task.

- [x] **Step 1: Write editor.css content**

Replace the placeholder in `frontend/styles/editor.css` with:

```css
/*
 * editor.css
 * Styles scoped exclusively to the .tiptap writing surface.
 * EDITOR SAFETY: All rules here use class-based selectors (0,1,x specificity).
 * User-applied inline styles have (1,0,0) and always win — never use !important.
 */

.tiptap :first-child {
  margin-top: 0;
  margin-bottom: 0;
}

/* Paragraph — editor body */
.tiptap p {
  margin-top: 16px;
  margin-bottom: 16px;
  font-family: var(--font-serif); /* IBM Plex Serif — editor body only */
  font-size: var(--font-size-gw-editor); /* 15px */
  line-height: 1.8; /* --leading-relaxed — non-negotiable */
  color: var(--color-gw-ink);
}

.tiptap p:first-child {
  margin-top: 0;
}

.tiptap p:last-child {
  margin-bottom: 0;
}

/* Headings — structural markers inside editor */
.tiptap h1,
.tiptap h2,
.tiptap h3,
.tiptap h4,
.tiptap h5,
.tiptap h6 {
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: 13px; /* one step below body — structural, not dominant */
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-gw-red); /* chapter headings in red — STYLING.md S7 */
  margin-top: 32px;
  margin-bottom: 16px;
  line-height: 1.3;
}

.tiptap h1:first-child,
.tiptap h2:first-child,
.tiptap h3:first-child {
  margin-top: 0;
}

/* Blockquote — D1 */
.tiptap blockquote {
  border-left: 4px solid var(--color-gw-border);
  padding-left: 16px;
  font-style: italic;
  margin-top: 16px;
  margin-bottom: 16px;
  color: var(--color-gw-secondary);
}

/* Lists */
.tiptap ul {
  list-style-type: disc;
  list-style-position: inside;
  display: inline;
}

.tiptap ol {
  list-style-type: decimal;
  list-style-position: inside;
  display: inline;
}

.tiptap ul li p,
.tiptap ol li p {
  display: inline;
}

/* Inline code — D2 */
.tiptap code {
  background-color: var(--color-gw-chrome2);
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-gw-small); /* 13px */
  font-family: var(--font-mono);
  color: var(--color-gw-primary);
}

/* Code block — D2 */
.tiptap pre {
  background-color: var(--color-gw-chrome2);
  padding: 16px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin-top: 16px;
  margin-bottom: 16px;
  border: 0.5px solid var(--color-gw-border);
}

.tiptap pre code {
  background: inherit;
  font-size: var(--font-size-gw-small);
  padding: 0;
  border-radius: 0;
}

/* Selection highlight */
.tiptap .selection {
  border: 1px solid var(--color-gw-border);
}

/* Math rendering */
.tiptap .tiptap-mathematics-render,
.tiptap .tiptap-mathematics-render--editable {
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 150ms ease;
}

.tiptap .tiptap-mathematics-render:hover,
.tiptap .tiptap-mathematics-render--editable:hover {
  background-color: var(--color-gw-chrome2);
}

/* Named font classes — for dynamic font selection system */
.domine-400 {
  font-family: "Domine", serif;
  font-optical-sizing: auto;
  font-weight: 400;
  font-style: normal;
}
```

- [x] **Step 2: Remove .tiptap block from globals.css**

Edit `frontend/app/globals.css`. Remove the entire `.tiptap { ... }` block. The file should contain only the imports and the `html, body, #__next` rule.

- [x] **Step 3: Run manual editor formatting test**

Start the dev server (`pnpm dev`). Open a project. Navigate to a document.

Verify each of the following:

- [x] Type a paragraph. Confirm it renders in IBM Plex Serif at 15px with 1.8 line height.
- [x] Apply **Bold** (Ctrl/Cmd+B) to selected text. Confirm text is bold. Bold must survive — not be overridden by the `.tiptap p` rule.
- [x] Apply _Italic_ (Ctrl/Cmd+I) to selected text. Confirm text is italic.
- [x] Apply Underline (Ctrl/Cmd+U). Confirm underline appears.
- [x] Apply a highlight color via the toolbar. Confirm the highlight appears.
- [x] Change font family to Domine (or any available font). Confirm the font changes.
- [x] Change font size (increase/decrease). Confirm the size changes.

All 7 checks must pass. If any user formatting is overridden, check editor.css for a rule that might have higher specificity than expected.

- [x] **Step 4: Typecheck**

```bash
cd frontend && pnpm typecheck
```

- [x] **Step 5: Commit**

```bash
git add frontend/styles/editor.css frontend/app/globals.css
git commit -m "chore(styles): populate editor.css with brand-token tiptap styles — complete editor safety test"
```

---

## Task 13: Preferences and Notifications

**Files:**

- Modify: `frontend/components/notifications/Toaster.tsx`
- Modify: `frontend/components/preferences/UserPreferencesPage.tsx` (if not done in Task 10)
- Modify: `frontend/components/Hello.tsx` (if it contains any deprecated classes)

- [x] **Step 1: Read and update remaining components**

Read `Toaster.tsx`, `UserPreferencesPage.tsx`, and `Hello.tsx`. Apply the substitution table. These are small components — replace any deprecated inline utilities.

- [x] **Step 2: Typecheck**

```bash
cd frontend && pnpm typecheck
```

- [x] **Step 3: Commit**

```bash
git add frontend/components/notifications/ frontend/components/preferences/ frontend/components/Hello.tsx
git commit -m "chore(styles): migrate remaining components to brand tokens"
```

---

## Task 14: Cleanup — Delete Deprecated Files

**Files:**

- Modify: `frontend/app/globals.css` (remove deprecated imports)
- Delete: `frontend/styles/tokens.css`
- Delete: `frontend/styles/utilities.css`
- Delete: `frontend/styles/_variables.scss`
- Delete: `frontend/styles/_keyframe-animations.scss`

**Context:** This is the final task. Before running it, confirm every component group in Tasks 2–13 has been migrated. After this task, the app relies entirely on `getwrite-utilities.css` and `editor.css` for custom styles.

- [x] **Step 1: Audit deprecated token references**

Search for any remaining deprecated tokens across all component files:

```bash
cd frontend
grep -r "color-neutral\|color-brand\|color-dark\|color-ink\|color-paper\|shadow-xl\|shadow-md\|shadow-card\|shadow-panel\|shadow-glow\|text-ink-\|text-neutral-\|bg-brand-\|bg-paper-\|rounded-2xl\|text-slate-\|bg-white\b\|bg-gray-\|text-gray-\|border-gray-\|text-blue-\|bg-blue-\|border-blue-\|text-stone-\|bg-stone-\|border-stone-\|text-amber-7" src/ components/ app/ --include="*.tsx" --include="*.ts" --include="*.css" -l
```

Expected: no files listed. If any remain, fix them before proceeding.

- [x] **Step 2: Remove deprecated imports from globals.css**

Edit `frontend/app/globals.css`. Remove these two lines:

```css
@import "../styles/tokens.css";
@import "../styles/utilities.css";
```

The file should now contain exactly:

```css
@import "tailwindcss";
@import "../styles/saboteur-base.css";
@import "../styles/getwrite-theme.css";
@import "../styles/getwrite-utilities.css";
@import "../styles/editor.css";

html,
body,
#__next {
  height: 100%;
}
```

- [x] **Step 3: Build test without deprecated files**

```bash
cd frontend && pnpm build
```

Expected: build succeeds. If there are CSS variable resolution errors, a deprecated token was missed — re-run the audit grep.

- [x] **Step 4: Delete deprecated CSS files**

```bash
git rm frontend/styles/tokens.css frontend/styles/utilities.css frontend/styles/_variables.scss frontend/styles/_keyframe-animations.scss
```

- [x] **Step 5: Verify saboteur-base.css is unchanged**

```bash
git diff HEAD frontend/styles/saboteur-base.css
```

Expected: no diff. If there is a diff, something went wrong — do NOT proceed.

- [x] **Step 6: Full visual regression check**

Start dev server. Test:

- [x] Start page loads, correct brand colors, no shadows, no gradients
- [x] Open a project — AppShell renders with correct chrome/editor surface temperature difference
- [x] Light/dark mode toggle — both modes look correct
- [x] Resource tree hover/active states use brand colors
- [x] Modals (create resource, project types, help) open with flat bordered surfaces
- [x] Editor toolbar — no blue active states
- [x] Type in editor — IBM Plex Serif at 15px, 1.8 line height
- [x] Run manual editor formatting test (from Task 12 Step 3)

- [x] **Step 7: Commit**

```bash
git add frontend/app/globals.css
git commit -m "chore(styles): complete styling migration — remove deprecated CSS files, finalize brand token system"
```

---

## Verification Commands Reference

From `frontend/` with `nvm use 22.16.0`:

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Full build
pnpm build

# Dev server
pnpm dev
```

Grep to audit deprecated tokens:

```bash
grep -r "color-neutral\|color-brand\|color-dark\|color-ink\|color-paper\|shadow-xl\|shadow-md\|shadow-card\|text-ink-\|text-neutral-\|bg-brand-\|bg-paper-\|rounded-2xl\|text-slate-\|bg-white\b\|bg-gray-\|text-gray-\|border-gray-\|text-blue-\|bg-blue-\|border-blue-\|text-stone-\|bg-stone-\|border-stone-" src/ components/ --include="*.tsx" --include="*.ts" -l
```

**Note on `box-shadow` in `getwrite-utilities.css`:** The acceptance criterion "no `box-shadow` values" applies to drop shadows and elevation (Decision D10). Focus ring `box-shadow: 0 0 0 3px var(--color-gw-focus-ring)` declarations inside `:focus-visible` selectors in `@layer components` are the CSS equivalent of Tailwind's `ring-[3px] ring-gw-focus-ring` utility and are explicitly exempt. These should not be flagged as violations.
