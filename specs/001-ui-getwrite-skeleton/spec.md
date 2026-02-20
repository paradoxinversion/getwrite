# Feature Specification: UI - GetWrite polished skeleton

**Feature Branch**: `001-ui-getwrite-skeleton`  
**Created**: 2026-02-16  
**Status**: Draft  
**Input**: User description: "For this feature, we will be building only the UI for the app supplied as context. We will be focusing on making this UI well-designed, sleek, and professional. We will not yet be concerned with reading or writing any data to/from the app. We will be using placeholders instead of real data."

## Clarifications

### Session 2026-02-16

- Q: Target device support/responsiveness approach → A: Desktop-first responsive (adapt layouts for tablet/narrow viewports, minimal mobile adjustments)
- Q: Accessibility target → A: WCAG 2.1 AA

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Start & Project Management (Priority: P1)

As a writer, I can open the app, create a new project, open an existing project, and manage projects (copy, rename, delete, package) using placeholder data so I can begin working on a project.

**Why this priority**: Enables the primary entry point into the product and validates project-level UI flows.

**Independent Test**: Using placeholder projects, perform create/open/rename/delete/package operations through the Start page UI and verify the expected modal and confirmation flows render.

**Acceptance Scenarios**:

1. **Given** the Start page, **When** I click "Create Project" and submit a name and type, **Then** a new placeholder project appears in the UI and the Create Interface opens.
2. **Given** the Start page with existing projects, **When** I select "Manage" on a project and choose "Rename" or "Delete", **Then** the appropriate confirmation modal appears and the project list updates in the UI (placeholder-only).

---

### User Story 2 - Create Interface: Resource Tree & Navigation (Priority: P1)

As a writer, I can navigate the Resource Tree on the left to open folders and resources, reorder items visually (drag placeholder items), and use the right-click context menu to access create/copy/duplicate/delete/export actions (placeholder behavior), so I can validate navigation and layout.

**Why this priority**: Core navigation and structural affordances are essential for all other UI flows.

**Independent Test**: Using placeholder project content, expand/collapse folders, select files and folders, and trigger the context menu actions; ensure UI responses and modals are displayed as designed.

**Acceptance Scenarios**:

1. **Given** the Create Interface, **When** I click a resource in the tree, **Then** it opens in the Work Area and the metadata sidebar appears (if applicable).
2. **Given** a resource, **When** I right-click it, **Then** a context menu with Copy/Duplicate/Delete/Export options appears.

---

### User Story 3 - Work Area Views (Priority: P1)

As a writer, I can view and switch between the Edit, Organizer, Data, Diff, and Timeline views in the Work Area using placeholder content so I can validate layout, transitions, and component behavior.

**Why this priority**: The Work Area is the primary interaction surface for users editing and reviewing content.

**Independent Test**: With a placeholder resource selected, switch between views and verify the visual structure, toolbar, footer stats (placeholder values), and view-specific controls render and respond.

**Acceptance Scenarios**:

1. **Given** a text resource, **When** I open Edit View, **Then** a text editor mock appears with placeholder text and a footer showing placeholder word/character counts.
2. **Given** a folder of images, **When** I open Organizer View, **Then** image cards render correctly and filter UI is visible.

---

### User Story 4 - Metadata Sidebar & Edit Interactions (Priority: P2)

As a writer, I can view and edit metadata in the right sidebar (notes, status, characters, locations, items, POV, timeframe) using placeholder selectors and inputs so the metadata UI and interactions can be validated without persistence.

**Why this priority**: Metadata drives many UI views (filters, Data view) and must be present for realistic UX testing.

**Independent Test**: Open the metadata sidebar for a text resource, interact with each control (type notes, change statuses, select characters/locations from placeholder lists), and observe UI updates.

**Acceptance Scenarios**:

1. **Given** a text resource, **When** I open the metadata sidebar, **Then** Notes, Status, Characters, Locations, Items, POV, and Timeframe controls are present and accept input.

### Edge Cases

- Opening a project with zero resources: Start page and Create Interface show empty-state affordances.
- Selecting folders with mixed content: Organizer view switches to Organizer View and shows appropriate empty-state messaging for unsupported inline render.
- Triggering delete on a resource shows confirmation modal; cancellation returns to prior state.
- Very long resource names should truncate gracefully in the tree and card UIs.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-UI-001**: The Start page UI MUST allow creation, opening, and management (copy/rename/delete/package) of placeholder projects and display confirmation and error modals for destructive actions.
- **FR-UI-002**: The Create Interface MUST render a left Resource Tree that supports selecting resources and folders, expanding/collapsing, and showing contextual actions via a right-click menu.
- **FR-UI-003**: The Work Area MUST support at minimum these views: Edit View, Organizer View, Data View, Diff View, Timeline View, and provide a visible control to switch between them.
- **FR-UI-004**: Edit View (placeholder) MUST show a text editing surface for text resources with a footer displaying placeholder word/character/paragraph counts and autosave indicator (visual only; no persistence required).
- **FR-UI-005**: Organizer View MUST present resources as cards with selectable actions and a body toggle (content or notes) and support filtering controls for Status, Characters, Locations, and Word Count ranges (filters operate on placeholder data).
- **FR-UI-006**: Data View MUST display Overall Stats and Resources lists (Characters, Locations, Items) with expandable rows and click-to-open behavior (placeholder navigation).
- **FR-UI-007**: Diff View MUST display two read-only panes and a revision list; selecting a revision highlights the diff between canonical and selected revision (placeholder diff highlighting is acceptable).
- **FR-UI-008**: Timeline View MUST render items sorted by timeframe metadata, include a separate section for undated items, and support scrolling and basic interactions (hover, click to open).
- **FR-UI-009**: The right metadata sidebar MUST present Notes, Status, Characters, Locations, Items, POV (with autocomplete placeholder), and Timeframe inputs and reflect changes immediately in the UI (no persistence).
- **FR-UI-010**: Search UI MUST allow entering search text and choosing scope (all resources, folder, revisions) and show results with click-to-open behavior and highlighting of the first match (placeholder-only indexing).
- **FR-UI-011**: Compile UI MUST present a selection modal for choosing folders/files to include and show a preview of the compile order and content (preview-only, no file output).
- **FR-UI-012**: All interactive controls MUST be accessible via keyboard and meet basic accessibility targets (tab order, focus states, readable contrast) per the Success Criteria.

Each functional requirement above is testable via UI interactions using placeholder data and visual verification; none require backend persistence for this feature.

### Key Entities \_(UI-focused, display-only)

- **Project (placeholder)**: Represents a project object used to populate the Start page and Create Interface lists; attributes presented in the UI: name, type, created date, resource counts.
- **Resource (placeholder)**: Represents files and folders in the Resource Tree; UI attributes: display name, type icon, size, status, and order.
- **Revision (placeholder)**: Represents a revision label used by Diff View and revision lists; UI attributes: revision name, created date, and last-saved timestamp.
- **Special Folders (Characters/Locations/Items/FrontMatter/BackMatter)**: Displayed in the Resource Tree and used to populate selection lists in metadata controls.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Primary UI flows implemented (Start page, Create Interface, Resource Tree navigation, Edit/Organizer/Data/Diff/Timeline views, Metadata Sidebar, Search, Compile preview). Acceptance: each primary flow can be reached and completed with placeholder data in under 5 clicks.
- **SC-002**: Navigation accuracy: 100% of click-to-open actions open the expected view for the placeholder content during manual QA.
- **SC-003**: Accessibility: 95% of interactive elements are reachable and operable via keyboard navigation (tab/shift-tab and Enter/Space) during accessibility QA.
- **SC-004**: Visual quality: Designer sign-off achieved—visual review of UI passes with no high-severity visual defects (contrast, spacing, alignment) for the specified screens.
- **SC-005**: Responsiveness: Primary screens render and respond to interactions on typical development hardware such that common actions feel instantaneous (qualitative verification during manual QA).

## Non-Functional Requirements (web-specific guidance)

For this UI-only milestone the following non-functional guidance applies (implementation details omitted):

- **Performance**: Interactions should feel responsive on a typical development machine; perceived latency should be low during manual QA.
- **Accessibility**: Aim for keyboard operability and readable contrast; target WCAG 2.1 AA for key screens (designer and QA to verify).
- **Responsiveness & Device Support**: Layouts should adapt between a typical desktop width and narrower windows; primary screens targeted at desktop-first UX for this milestone.
- **Reliability**: The UI must handle placeholder datasets including empty states and large lists without layout breakage.
- **Responsiveness & Device Support**: Layouts should adapt between a typical desktop width and narrower windows; primary screens targeted at desktop-first UX for this milestone.
- **Device Support Decision**: Desktop-first responsive — primary design and QA focus on desktop widths; adapt layouts for tablet and narrow viewports (>= 768px). Minimal mobile-specific adjustments only; full mobile patterns and mobile-specific interaction patterns are out of scope for this milestone.
- **Reliability**: The UI must handle placeholder datasets including empty states and large lists without layout breakage.

## Assumptions

- This feature is UI-only: no persistence, no file I/O, and no backend integrations. All data is placeholder and stored only in-memory for the session.
- Single-user flows only; multi-user sync and conflict handling are out of scope.
- Autosave indicators and revision flows are visual-only; no underlying revision files are created.
- Visual design tokens (colors, typography, spacing) will be provided or iterated with the designer; defaults will be used until sign-off.

## Out Of Scope

- Any file-system read/write operations, project packaging exports, or actual compile/exporting of files.
- Backend APIs, authentication, persistence, and multi-user collaboration.

## Acceptance Criteria (tests)

- AC-1: Start page allows creating and opening placeholder projects and navigating to Create Interface.
- AC-2: Resource Tree selection opens resources in the Work Area and shows corresponding metadata sidebar.
- AC-3: Edit View, Organizer View, Data View, Diff View, and Timeline View render and switch correctly with placeholder data.
- AC-4: Metadata sidebar inputs accept input and reflect changes immediately in UI (no persistence required).
- AC-5: Search UI returns placeholder results and clicking a result opens the expected view; revision-search opens Diff View.

## Deliverables

- High-fidelity UI screens for Start page and Create Interface flows using placeholder data.
- Interactive prototypes or a working static UI repository branch demonstrating the flows above.
- A checklist file documenting spec quality and validation results (created at `specs/001-ui-getwrite-skeleton/checklists/requirements.md`).

## Notes

- This spec is written for stakeholders and designers; implementation details (frameworks, libraries, storage) are intentionally omitted.
