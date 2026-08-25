# Component Architecture Overview

This document describes how the GetWrite frontend components are organized and how they compose into the application.

---

## Component Directory Structure

```
frontend/components/
├── Layout/             # Application shell
├── Editor/             # TipTap rich text editor
├── Tree/               # Resource tree (primary implementation)
├── ResourceTree/       # Legacy resource tree (icons only — see note below)
├── SearchBar/          # Cross-resource search UI
├── Sidebar/            # Metadata panel
├── Start/              # Project selection / onboarding
├── WorkArea/           # Primary editing surface and views
├── common/             # Shared modals and dialogs
├── help/               # Help overlay
├── notifications/      # Toast system
├── preferences/        # User preferences UI
└── project-types/      # Project type management UI
```

---

## Application Shell (`Layout/`)

`AppShell.tsx` is the root component for the main workspace. It composes the three-panel layout by orchestrating:

- **`ShellLayoutController.tsx`** — Manages panel visibility, sidebar collapse state, and responsive layout. Reads user preferences from Redux and writes collapse-state changes back.
- **`ShellModalCoordinator.tsx`** — Renders project-level overlays (create-resource modal, confirm dialog, preferences pages) that need to sit above the three-panel layout. Acts as a single mounting point for modal state managed in Redux or local context.
- **`ShellProjectTypeLoader.tsx`** — Handles the project-type selection step when no project is loaded (or when creating a new project). Bridges the Start surface to the main workspace.
- **`ShellSettingsMenu.tsx`** — Dropdown settings menu in the top bar; links to preferences, help, and project-type management.

The shell does not contain routing logic — it is always rendered once a project is active. Before project selection, `StartPage.tsx` is shown instead.

---

## Resource Tree — `Tree/` vs `ResourceTree/`

There are two directories related to the resource tree:

| Directory       | Contents                                                                 | Role                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tree/`         | `ResourceTree.tsx`, `ResourceContextMenu.tsx`, `CreateResourceModal.tsx` | **Current implementation** — the full hierarchical resource navigator with context menus and resource creation                                            |
| `ResourceTree/` | `ResourceTree.tsx` (icons only), `ResourceTreeIcons.tsx`                 | **Legacy residue** — contains only icon mappings used by the old tree. `ResourceTree.tsx` here is the older implementation; the active one is in `Tree/`. |

Use `Tree/ResourceTree.tsx` for all current development. The `ResourceTree/` directory exists for reference only.

---

## WorkArea Views (`WorkArea/`)

The WorkArea renders one active view at a time, switched via `ViewSwitcher.tsx`. Available views:

| Component                         | Description                                               |
| --------------------------------- | --------------------------------------------------------- |
| `EditView.tsx`                    | TipTap rich text editor — the primary writing surface     |
| `OrganizerView/OrganizerView.tsx` | Card/grid view for reordering resources via drag-and-drop |
| `DataView.tsx`                    | Tabular metadata view across resources                    |
| `DiffView.tsx`                    | Side-by-side diff of two revision versions                |
| `TimelineView.tsx`                | Timeline visualization using `timeframe` userMetadata     |

`ViewSwitcher.tsx` renders the tab bar and manages which view is active. It dispatches Redux actions to set the selected view and guards unavailable views (e.g., Diff requires a revision to be selected).

---

## Editor (`Editor/`)

`TipTapEditor.tsx` is the main editor component. It initializes the TipTap instance, applies the GetWrite extension set, and connects to Redux for autosave and revision control.

Supporting components:

- `MenuBar/MenuBar.tsx` — Floating/attached formatting toolbar
- `MenuBar/EditorMenuIconGroup.tsx`, `EditorMenuIcon.tsx`, `EditorMenuInput.tsx`, `EditorMenuColorSubmenu.tsx` — Toolbar UI primitives
- `RevisionControl/RevisionControl.tsx` — Sidebar panel for viewing, saving, and restoring revisions

---

## Sidebar / Metadata Panel (`Sidebar/`)

`MetadataSidebar.tsx` renders the right-hand metadata panel. It shows and edits `userMetadata` fields for the selected resource:

- `controls/NotesInput.tsx` — Free-text notes field
- `controls/StatusSelector.tsx` — Dropdown backed by `project.config.statuses`
- `controls/MultiSelectList.tsx` — Characters, locations, items fields
- `controls/POVAutocomplete.tsx` — Point-of-view autocomplete

All edits dispatch to `POST /api/resource/[id]/sidecar` and update `resourcesSlice` via `updateResource`.

---

## Start Experience (`Start/`)

Shown before a project is loaded:

- `StartPage.tsx` — Project list and creation entry point
- `CreateProjectModal.tsx` — New project wizard (name + project type selection)
- `RenameProjectModal.tsx` — Inline project rename
- `ManageProjectMenu.tsx` — Context menu for project-level actions (rename, delete)

---

## Shared / Common Components (`common/`)

Reusable overlays and dialogs used across multiple features:

| Component                    | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `CompilePreviewModal.tsx`    | Preview compiled/exported manuscript output           |
| `ExportPreviewModal.tsx`     | Preview export options before exporting               |
| `ConfirmDialog.tsx`          | Generic confirmation prompt (used for delete flows)   |
| `ResourceCommandPalette.tsx` | Keyboard-driven resource quick-open / command palette |
| `ToastProvider.tsx`          | React context provider for toast notifications        |

---

## Notifications (`notifications/`)

- `Toaster.tsx` — Renders active toast notifications. Connected to the toast context from `ToastProvider.tsx`.

---

## Preferences (`preferences/`)

- `UserPreferencesPage.tsx` — Full preferences page (editor settings, appearance)
- `AppearanceRuntime.tsx` — Applies appearance settings (theme, font size) at runtime without a full page reload

---

## Help (`help/`)

- `HelpPage.tsx` — Overlay page with documentation sections
- `HelpSectionCard.tsx` — Individual help section card component

---

## Project Types (`project-types/`)

- `ProjectTypesManagerPage.tsx` — Lists and manages project-type templates
- `ProjectTypeListPane.tsx` — Scrollable list of available types
- `ProjectTypeEditorForm.tsx` — Form for editing a project-type spec

---

## Source Files Quick Reference

| Path                                                    | Role                                    |
| ------------------------------------------------------- | --------------------------------------- |
| `components/Layout/AppShell.tsx`                        | Root workspace shell                    |
| `components/Layout/ShellLayoutController.tsx`           | Panel layout and collapse logic         |
| `components/Layout/ShellModalCoordinator.tsx`           | Project-level overlay mounting point    |
| `components/Tree/ResourceTree.tsx`                      | Current resource tree (use this)        |
| `components/WorkArea/ViewSwitcher.tsx`                  | View tab bar and active view management |
| `components/WorkArea/EditView.tsx`                      | Writing surface                         |
| `components/WorkArea/OrganizerView/OrganizerView.tsx`   | Drag-and-drop organizer                 |
| `components/WorkArea/DiffView.tsx`                      | Revision diff view                      |
| `components/WorkArea/TimelineView.tsx`                  | Timeframe timeline                      |
| `components/Sidebar/MetadataSidebar.tsx`                | Metadata editing panel                  |
| `components/Editor/RevisionControl/RevisionControl.tsx` | Revision history panel                  |
| `components/common/ConfirmDialog.tsx`                   | Generic confirm prompt                  |
| `components/common/ResourceCommandPalette.tsx`          | Command palette                         |
