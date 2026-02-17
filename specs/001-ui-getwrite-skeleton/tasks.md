# Tasks: UI - GetWrite polished skeleton

Phase 1: Setup

- [x] T001 [P] Initialize Next.js + TypeScript app in `frontend/` using Next.js 16.1.6 and TypeScript 5.9.3 (`frontend/`)
- [x] T002 [P] Add TailwindCSS 4.1 and create `frontend/styles/tailwind.config.js` and base styles (`frontend/styles/tailwind.config.js`)
- [x] T003 [P] Install TinyMCE and add a placeholder editor wrapper component at `frontend/components/TinyMCEEditor.tsx` (`frontend/components/TinyMCEEditor.tsx`)
- [x] T004 [P] Install Storybook and create initial Storybook config; add `stories/` and `storybook/main.js` (`stories/`, `.storybook/`)
- [x] T005 [P] Install Testing Library + Vitest and add basic test setup at `frontend/tests/setup.ts` (`frontend/tests/setup.ts`)
- [x] T006 Create project-level README and developer quickstart at `specs/001-ui-getwrite-skeleton/quickstart.md` (`specs/001-ui-getwrite-skeleton/quickstart.md`)

Phase 2: Foundational (blocking prerequisites)

- [x] T007 [P] Add Tailwind design tokens and base theme file `frontend/styles/tokens.css` (`frontend/styles/tokens.css`)
- [ ] T008 [P] Add global layout and app shell including left Resource Tree area, Work Area, and right Metadata sidebar shell at `frontend/components/Layout/AppShell.tsx` (`frontend/components/Layout/AppShell.tsx`)
- [ ] T009 Create placeholder data generator and types at `frontend/lib/placeholders.ts` and `frontend/lib/types.ts` (`frontend/lib/placeholders.ts`, `frontend/lib/types.ts`)
- [ ] T010 [P] Create Storybook entrypoint stories for AppShell at `stories/AppShell.stories.tsx` (`stories/AppShell.stories.tsx`)
- [ ] T011 [P] Add Tailwind utilities and global CSS import in `frontend/app/layout.tsx` or `frontend/pages/_app.tsx` depending on Next structure (`frontend/app/layout.tsx`)

Phase 3: [US1] Start & Project Management (Priority: P1)

- [ ] T012 [US1] Implement `StartPage` UI shell and project list view at `frontend/components/Start/StartPage.tsx` using placeholder projects (`frontend/components/Start/StartPage.tsx`)
- [ ] T013 [US1] Implement `CreateProjectModal` UI with name/type inputs and submit callback (placeholder) at `frontend/components/Start/CreateProjectModal.tsx` (`frontend/components/Start/CreateProjectModal.tsx`)
- [ ] T014 [US1] Implement `ManageProjectMenu` with Rename/Delete/Package actions and confirmation modal at `frontend/components/Start/ManageProjectMenu.tsx` (`frontend/components/Start/ManageProjectMenu.tsx`)
- [ ] T015 [US1] Add Storybook stories and tests for StartPage and modals at `stories/Start/*.stories.tsx` and `frontend/tests/start.test.tsx` (`stories/Start/`, `frontend/tests/start.test.tsx`)

Phase 4: [US2] Resource Tree & Navigation (Priority: P1)

- [ ] T016 [US2] Implement `ResourceTree` component (expand/collapse, selection) at `frontend/components/Tree/ResourceTree.tsx` (`frontend/components/Tree/ResourceTree.tsx`)
- [ ] T017 [US2] Implement drag-and-drop placeholder reorder UI (visual only) at `frontend/components/Tree/ResourceDragLayer.tsx` or integrate DnD within `ResourceTree.tsx` (`frontend/components/Tree/`)
- [ ] T018 [US2] Implement right-click context menu UI on resources (Create/Copy/Duplicate/Delete/Export) at `frontend/components/Tree/ResourceContextMenu.tsx` (`frontend/components/Tree/ResourceContextMenu.tsx`)
- [ ] T019 [US2] Add Storybook stories and component tests for ResourceTree and context menu at `stories/Tree/*.stories.tsx` and `frontend/tests/tree.test.tsx` (`stories/Tree/`, `frontend/tests/tree.test.tsx`)

Phase 5: [US3] Work Area Views (Priority: P1)

- [ ] T020 [US3] Implement view switcher control that toggles Edit/Organizer/Data/Diff/Timeline at `frontend/components/WorkArea/ViewSwitcher.tsx` (`frontend/components/WorkArea/ViewSwitcher.tsx`)
- [ ] T021 [US3] Implement `EditView` with TinyMCE placeholder content and footer stats UI at `frontend/components/WorkArea/EditView.tsx` (`frontend/components/WorkArea/EditView.tsx`)
- [ ] T022 [US3] Implement `OrganizerView` rendering resource cards and body toggle at `frontend/components/WorkArea/OrganizerView.tsx` (`frontend/components/WorkArea/OrganizerView.tsx`)
- [ ] T023 [US3] Implement `DataView` showing Overall Stats and Resources lists at `frontend/components/WorkArea/DataView.tsx` (`frontend/components/WorkArea/DataView.tsx`)
- [ ] T024 [US3] Implement `DiffView` with two read-only panes and revision list UI at `frontend/components/WorkArea/DiffView.tsx` (`frontend/components/WorkArea/DiffView.tsx`)
- [ ] T025 [US3] Implement `TimelineView` rendering items by timeframe and undated section at `frontend/components/WorkArea/TimelineView.tsx` (`frontend/components/WorkArea/TimelineView.tsx`)
- [ ] T026 [US3] Add Storybook stories and tests for each Work Area view at `stories/WorkArea/*.stories.tsx` and `frontend/tests/workarea/*.test.tsx` (`stories/WorkArea/`, `frontend/tests/workarea/`)

Phase 6: [US4] Metadata Sidebar & Edit Interactions (Priority: P2)

- [ ] T027 [US4] Implement `MetadataSidebar` layout and panels at `frontend/components/Sidebar/MetadataSidebar.tsx` (`frontend/components/Sidebar/MetadataSidebar.tsx`)
- [ ] T028 [US4] Implement controls: Notes input, Status selector, Characters/Locations/Items multi-select, POV autocomplete (placeholder) at `frontend/components/Sidebar/controls/*` (`frontend/components/Sidebar/controls/`)
- [ ] T029 [US4] Add Storybook stories and tests for MetadataSidebar and controls at `stories/Sidebar/*.stories.tsx` and `frontend/tests/sidebar.test.tsx` (`stories/Sidebar/`, `frontend/tests/sidebar.test.tsx`)

Phase 7: Polish, Accessibility, and Cross-Cutting Concerns

- [ ] T030 [P] Add keyboard navigation, focus management, and aria attributes to critical components (ResourceTree, ViewSwitcher, Modals, MetadataSidebar) and perform WCAG 2.1 AA checks; update files in place (`frontend/components/**`)
- [ ] T031 [P] Add Storybook accessibility addon and run visual checks for components (`.storybook/`)
- [ ] T032 [P] Implement unit/component tests for core flows (Start -> Open Project -> Open Resource -> Edit) in `frontend/tests/flows.test.tsx` (`frontend/tests/flows.test.tsx`)
- [ ] T033 [P] Create README for frontend scaffold with run/test/storybook commands at `frontend/README.md` (`frontend/README.md`)
- [ ] T034 Final polish: visual tweaks, spacing, tokens, and designer sign-off; update affected component files (`frontend/components/**`)

Final Phase: Delivery

- [ ] T035 Create a demo branch PR checklist and draft PR description in `specs/001-ui-getwrite-skeleton/tasks.md` including screenshots and Storybook links (`specs/001-ui-getwrite-skeleton/tasks.md`)
- [ ] T036 Commit and push scaffolded frontend changes to feature branch (`git push origin 001-ui-getwrite-skeleton`)

Dependencies

- Must complete Phase 1 & 2 tasks (T001-T011) before starting Phase 3-6 implementation tasks.
- Within each user-story phase, tests and Storybook stories (the `stories/` and `frontend/tests/` entries) should be added immediately after each component implementation task to keep work verifiable.

Parallel execution examples

- While T008 (AppShell) is in progress, designers can work on Storybook tokens (T007) and TinyMCE wrapper (T003) in parallel — mark these as [P].
- Multiple component authors can implement separate Work Area views (T021-T025) concurrently since they operate on different files — mark these as [P].

Implementation strategy

- MVP-first: implement smallest working slices for each user story (visual-only) and ship incrementally. Start with StartPage + AppShell (T012 + T008) to enable navigation quickly.
- Storybook-driven development: build components in isolation, obtain designer sign-off, then integrate into pages.
- Tests: write component tests as components are created; keep tests focused and fast (Vitest + Testing Library).
