# GetWrite Design System (Final)

> **See Also: [`/STYLING.md`](/STYLING.md)** — the authoritative implementation reference for color token values, typography specs, spacing, component patterns, and Tailwind mapping. This document records design decisions and governance rules; `STYLING.md` records the concrete implementation values. When values conflict, `STYLING.md` takes precedence.

## Document Role

This is the final design bible for GetWrite UI decisions.

- Scope: frontend application UI only (`frontend/`)
- Focus: implemented UI decisions and their rationale
- Intent: library-agnostic design guidance that can be translated across implementation tools
- Status: finalized (phase 2 complete)

## Phase Gate

Phase 2 entry criteria were satisfied on 2026-03-15. All issue entries have recorded user responses.

## Authority and Change Policy

- For AI agents, this document is a strict authority for UI/UX/styling decisions.
- If an addition, change, or deviation appears necessary or beneficial, the agent must ask permission first and provide a thorough proposal.
- This file is now the canonical source for UI/UX/styling decisions across the frontend app.

## Finalization Summary

Phase 2 finalized this document by resolving all phase-1 issues and adding complete guidance for:

- Foundations (theme, color, typography, spacing, elevation, motion, iconography)
- Layout and responsive rules
- Component families and interaction states
- Accessibility and contrast verification workflow
- Governance, change control, and documentation maintenance

---

## Implemented Baseline (Reference)

## 1) Design Intent (Inferred)

The current UI emphasizes:

- Structured writing workflow in a three-pane shell
- High readability for long-form text work
- Stable hierarchy and predictable navigation
- Token-first visual consistency where available
- Practical accessibility (keyboard-first interactions, focus visibility, reduced-motion support)

## 2) App-Wide Foundations

### 2.1 Theme Model

What is implemented:

- A light-first default theme with a scoped dark variant.
- Dark mode is applied at shell scope and then propagated into component surfaces.

Why this likely exists:

- Preserves the default writing-first surface while supporting long-session usage preferences.
- Scoped theme application avoids uncontrolled style inversion.

### 2.2 Color Semantics

What is implemented:

- Semantic color families: brand, neutral, dark-surface, and editorial accent colors.
- Brand colors are used primarily for action emphasis and interactive focus.
- Neutral colors define structural surfaces and text hierarchy.
- Editorial colors appear in presentation-oriented surfaces (notably the start surface).

Why this likely exists:

- Separates product identity accents from functional UI scaffolding.
- Supports both utility and expressive visual moments without collapsing hierarchy.

### 2.3 Typography

What is implemented:

- Sans-serif body/read UI with a serif display accent for branded/editorial tone.
- A tiered text-size scale used across shell and content surfaces.
- Writing/editor surfaces include explicit heading and body styling.

Why this likely exists:

- Balances practical readability with editorial identity.
- Provides role-driven text hierarchy for navigation and content authoring.

### 2.4 Spacing and Density

What is implemented:

- A shared spacing scale is present and widely used.
- Compact density behavior exists for denser information presentation.
- Some spacing remains mixed between semantic tokens, utility values, and one-off values.

Why this likely exists:

- Supports both comfortable and condensed workflows.
- Reflects incremental evolution across different implementation periods.

### 2.5 Elevation and Surfaces

What is implemented:

- Layered shadow styles for subtle surfaces, standard panels, and emphasized overlays.
- Modal and floating surfaces use elevated treatments with backdrop separation.

Why this likely exists:

- Reinforces interaction depth and active-context focus in multi-pane workflows.

### 2.6 Motion and Feedback

What is implemented:

- Hover/focus/enter transitions for controls and cards.
- Decorative ambient motion on non-critical presentation surfaces.
- Reduced-motion behavior exists to suppress animation when needed.

Why this likely exists:

- Keeps interaction feedback visible without over-animating core writing tasks.
- Allows expressive polish where it does not impede productivity.

### 2.7 Iconography

What is implemented:

- A primary icon library is used broadly.
- A secondary custom icon set is used for specific resource-tree semantics.

Why this likely exists:

- Standard icons speed implementation; custom icons encode domain concepts not fully covered by general sets.

## 3) Layout and Information Architecture

### 3.1 Primary App Shell

What is implemented:

- Persistent top bar plus three-pane layout:
- Left: resource navigation tree
- Center: active work area with view switching
- Right: contextual metadata/details panel
- Pane resize/collapse behavior is available with viewport-based adaptation.

Why this likely exists:

- Maintains simultaneous access to structure, content, and metadata.
- Matches authoring workflows that require frequent context switching with minimal navigation friction.

### 3.2 Responsive Behavior

What is implemented:

- Desktop-first full shell
- Progressive sidebar reduction/hiding at smaller breakpoints
- Core work area remains prioritized at reduced viewport sizes

Why this likely exists:

- Preserves functional writing surface under constrained space.
- Minimizes accidental complexity on smaller devices while maintaining critical actions.

### 3.3 Work Area View Model

What is implemented:

- Multiple mode-specific views (editing, organization, data-oriented, comparison, timeline-style contexts).
- Keyboard and semantic tab behavior is present for view switching.

Why this likely exists:

- Supports both creation and analysis tasks without forcing a single-mode editor.

## 4) Component-Level Design

### 4.1 App Shell Surfaces

What is implemented:

- Structural controls with conservative styling.
- Action controls favor clear hit areas and visible state changes.
- Overlay/panel patterns exist for dialogs and context menus.

Why this likely exists:

- Prioritizes usability and predictable interaction over stylistic novelty in high-frequency areas.

### 4.2 Resource Tree

What is implemented:

- Hierarchical rows with indentation depth, drag/reorder affordances, selection states, and context actions.
- Icons communicate resource/folder meaning.

Why this likely exists:

- Reflects a file-tree mental model familiar to technical and writing users.

### 4.3 Work Area Views

What is implemented:

- Distinct visual treatments by view purpose (editing vs organizing vs data interpretation).
- Card/list/grid conventions vary by content type.

Why this likely exists:

- Optimizes each view for the decision type users make there.

### 4.4 Editor Surface

What is implemented:

- Rich text editor styling for headings, paragraph rhythm, blockquote/code treatments, and content spacing.
- Editor has dedicated global style treatment.

Why this likely exists:

- Ensures readable manuscript presentation independent of shell chrome.

### 4.5 Start Experience

What is implemented:

- More expressive visual language (editorial palette, decorative motion, branded typography treatment).
- Project cards use elevated hover and emphasis behaviors.

Why this likely exists:

- Establishes identity and onboarding tone before entering productivity-heavy surfaces.

### 4.6 Notifications and Feedback

What is implemented:

- Toasts and transient notices for action outcomes.
- Feedback states appear through color, border, and emphasis shifts.

Why this likely exists:

- Provides immediate acknowledgment while preserving workflow continuity.

## 5) Interaction and Accessibility

What is implemented:

- Keyboard support in core navigation patterns (notably view switching and tree interactions).
- Visible focus styling and hover/active feedback in major controls.
- Reduced-motion handling exists.
- Semantic roles are used in critical interaction clusters.

Why this likely exists:

- Supports productivity and accessibility requirements for heavy keyboard users.

Known implementation note:

- A formal contrast workflow is now defined in this document. The contrast matrix should be populated and maintained as visual changes ship.

---

## Canonical Design Rules (Final)

This section defines binding design rules to apply after phase-2 finalization.

## 6) Foundations (Canonical)

### 6.1 Theme

- Light theme is the baseline productivity surface.
- Dark theme is a first-class equivalent and must maintain parity for core workflows.
- New UI patterns must define both light and dark behavior before being considered complete.

### 6.2 Color

- Use semantic color roles (brand, neutral, dark-surface, editorial) rather than one-off visual values.
- Editor colors must map to semantic roles, even when users customize editor appearance.
- Expressive/editorial color usage is constrained to approved expressive surfaces.

### 6.3 Typography

- Shell typography follows role-based hierarchy (navigation labels, headings, body, metadata, helper text).
- Editor typography is a dedicated subsystem with user customization support.
- Editor customization is allowed for font family, size scale, line height, and color themes, but base semantic roles must remain intact.

### 6.4 Spacing and Rhythm

- Utility-driven spacing is the canonical strategy.
- Utility spacing values must map to the semantic spacing scale.
- One-off spacing values require explicit justification and must be documented as exceptions.
- Editor content spacing is allowed to be user-customizable while shell spacing remains governed by system rhythm.

### 6.5 Motion

- Motion uses a canonical duration ladder:

1. Fast: 120-160ms
2. Standard: 180-240ms
3. Slow: 260-360ms
4. Ambient: 500-800ms

- Interactive motion must use fast or standard durations.
- Reduced-motion support is mandatory for all newly introduced animations.

### 6.6 Elevation and Overlays

- Modal and overlay behavior follows a single baseline system with explicit variants by use case.
- Backdrop behavior is shared; panel styling may vary by documented intent.
- Elevation tokens must reflect interaction priority consistently.

### 6.7 Iconography

- A single icon system is preferred where feasible.
- Resource-specific icon semantics are governed by documented mappings for type and state.
- New icons must pass semantic clarity and visual consistency checks.

## 7) Layout and Responsive Rules (Canonical)

### 7.1 Shell Structure

- The three-pane shell model is the primary desktop layout contract.
- Center work area is always priority-preserved under viewport constraints.
- Sidebar collapse behavior must preserve access to critical actions.

### 7.2 Breakpoint Intent

- Desktop: full three-pane context.
- Tablet: reduced side context with preserved writing flow.
- Mobile: writing-first with progressive disclosure for secondary panels.

### 7.3 Density

- Compact and comfortable density modes are supported system-wide for shell surfaces.
- Resource-tree hierarchy indentation must be system-governed and user-configurable at project or app level.

## 8) Component Family Standards (Canonical)

### 8.1 App Shell

- Maintain an interaction hierarchy matrix across shell controls:

1. Primary actions
2. Contextual actions
3. Destructive actions
4. Passive actions

- Shell design ownership is separated into frame, navigation controls, and overlay patterns.

### 8.2 Resource Tree

- Indentation, icon semantics, and selection states are governed design primitives.
- Drag/reorder, hover, and selected states must remain visually distinct in both themes.

### 8.3 Work Area Views

- Text and metadata styling must be reusable system patterns, not one-off inline design rules.
- Analytical/organizational views share a common grid rhythm model unless explicitly documented otherwise.

### 8.4 Editor Surface

- Editor typography subsystem is canonical and distinct from shell typography.
- Editor customizability is a product feature and must not break semantic readability roles.
- Blockquote/code and other node colors must remain semantically mapped and accessibility safe.

### 8.5 Start Experience

- Start surface may use expressive styling.
- Expressive styling boundaries are explicit: do not leak expressive patterns into core productivity surfaces unless approved.

### 8.6 Notifications and Feedback

- Notification semantics are standardized:

1. Success
2. Info
3. Warning
4. Error
5. Neutral

- Each severity requires consistent color, icon, and emphasis treatment.

### 8.7 Navigation States

- Disabled states require a clear visual treatment plus assistive explanation pattern (for example, tooltip or supporting text).
- Keyboard behavior for disabled items must be explicit and consistent across view switchers.

## 9) State Model Requirements

For each interactive component family, define and maintain behavior for:

1. Default
2. Hover
3. Focus-visible
4. Active/pressed
5. Selected (where applicable)
6. Disabled
7. Loading (where applicable)
8. Error (where applicable)
9. Empty/no-data (where applicable)

## 10) Accessibility and Quality Requirements

- Keyboard-first operation is required in high-frequency workflows.
- Focus-visible indicators must meet visual prominence standards.
- Motion must respect reduced-motion preferences.
- Contrast conformance target is WCAG 2.1 AA for UI controls and text.

### 10.1 Contrast Verification Workflow

Use this process for each release or significant visual change:

1. Maintain a contrast matrix for key semantic foreground/background pairs.
2. Validate high-risk surfaces first: topbar controls, sidebars, editor content, dialogs, toasts.
3. Record pass/fail evidence and remediation notes.
4. Do not ship unresolved critical contrast failures without explicit waiver.

## 11) Governance and Maintenance Protocol

### 11.1 Change Proposal Requirements

Any proposed UI design-system change must include:

1. Problem statement
2. Current rule impacted
3. Proposed rule change
4. Expected UX impact
5. Migration approach (if implementation already exists)
6. Risks and alternatives considered

### 11.2 Agent Behavior Contract

- AI agents must treat this document as strict authority.
- Agents must proactively ask permission before implementing or suggesting a deviation, including beneficial additions.
- Proposals must be thorough and reference affected design rules.

### 11.3 Decision Recording

When a rule changes, append a concise changelog entry with:

1. Date
2. Rule(s) updated
3. Reason
4. Approval source

## 12) Design and Theme Values (Tailwind Mapping)

This section defines the canonical design values and their Tailwind mapping. It is the migration reference for converting CSS utilities/patterns into Tailwind component patterns.

Notes:

- Tailwind mappings follow the current token source in `frontend/styles/tokens.css`.
- In Tailwind v4 with `@theme`, each token key generates related utility families.
- If a value does not yet have a first-class Tailwind token utility, use an arbitrary value temporarily and propose tokenization.

### 12.1 Color Values

Use these keys for text, background, border, ring, fill, stroke, and divide utilities. See [`/STYLING.md` § 2. Color tokens](/STYLING.md) for full intent and usage rules.

**Base tokens (dark mode defaults)**

| CSS Variable       | Value     | Use                                                |
| ------------------ | --------- | -------------------------------------------------- |
| `--color-black`    | `#0A0A0A` | Primary background, dark UI surfaces               |
| `--color-white`    | `#F5F4F0` | Primary text, light UI background (warm off-white) |
| `--color-red`      | `#D44040` | Signal Red — position/canonical marker only        |
| `--color-mid`      | `#6A6864` | Secondary text, muted labels                       |
| `--color-surface`  | `#111110` | Raised dark surfaces (panels, sidebars)            |
| `--color-surface2` | `#161614` | Deeper surface, nested elements, inputs            |
| `--color-dim`      | `#2E2E2C` | Borders, rules                                     |
| `--color-rule`     | `#1A1A18` | Divider lines                                      |

**GetWrite-specific surface tokens**

| CSS Variable               | Value     | Use                                               |
| -------------------------- | --------- | ------------------------------------------------- |
| `--color-editor-dark`      | `#1C1C1A` | Editor writing surface in dark mode (warmer)      |
| `--color-editor-light`     | `#F0EDE6` | Editor writing surface in light mode (warm paper) |
| `--color-ink`              | `#1A1916` | Text on light editor surface                      |
| `--color-chrome-light`     | `#F5F4F0` | UI chrome in light mode (sidebar, title bar)      |
| `--color-chrome-light-2`   | `#ECEAE3` | Raised surfaces in light mode chrome              |
| `--color-chrome-light-dim` | `#D0CEC8` | Borders in light mode chrome                      |

**Light mode overrides** (applied when light mode is active)

| CSS Variable       | Light Value |
| ------------------ | ----------- |
| `--color-black`    | `#F5F4F0`   |
| `--color-white`    | `#0A0A0A`   |
| `--color-surface`  | `#ECEAE3`   |
| `--color-surface2` | `#E4E1DA`   |
| `--color-dim`      | `#D0CEC8`   |
| `--color-rule`     | `#D8D5CE`   |
| `--color-mid`      | `#7A7870`   |

Red (`#D44040`) is unchanged in both modes.

### 12.2 Spacing Values

Use these keys for margin, padding, gap, inset, size, and translate utilities where applicable.

| Token | Value     | Tailwind Version                                |
| ----- | --------- | ----------------------------------------------- |
| `1`   | `0.25rem` | `p-1`, `m-1`, `gap-1`, `space-x-1`, `space-y-1` |
| `2`   | `0.5rem`  | `p-2`, `m-2`, `gap-2`, `space-x-2`, `space-y-2` |
| `3`   | `0.75rem` | `p-3`, `m-3`, `gap-3`, `space-x-3`, `space-y-3` |
| `4`   | `1rem`    | `p-4`, `m-4`, `gap-4`, `space-x-4`, `space-y-4` |
| `5`   | `1.25rem` | `p-5`, `m-5`, `gap-5`, `space-x-5`, `space-y-5` |
| `6`   | `1.5rem`  | `p-6`, `m-6`, `gap-6`, `space-x-6`, `space-y-6` |
| `8`   | `2rem`    | `p-8`, `m-8`, `gap-8`, `space-x-8`, `space-y-8` |

### 12.3 Typography Size Values

| Token       | Value      | Tailwind Version |
| ----------- | ---------- | ---------------- |
| `text-base` | `1rem`     | `text-base`      |
| `text-lg`   | `1.125rem` | `text-lg`        |
| `text-xl`   | `1.25rem`  | `text-xl`        |
| `text-2xl`  | `1.5rem`   | `text-2xl`       |
| `text-3xl`  | `1.875rem` | `text-3xl`       |
| `text-4xl`  | `2.25rem`  | `text-4xl`       |
| `text-5xl`  | `3rem`     | `text-5xl`       |

### 12.4 Radius Values

| Token        | Value      | Tailwind Version |
| ------------ | ---------- | ---------------- |
| `radius-sm`  | `0.25rem`  | `rounded-sm`     |
| `radius-md`  | `0.375rem` | `rounded-md`     |
| `radius-lg`  | `0.5rem`   | `rounded-lg`     |
| `radius-xl`  | `1rem`     | `rounded-xl`     |
| `radius-2xl` | `1.5rem`   | `rounded-2xl`    |

### 12.5 Shadow Values

| Token          | Value                                 | Tailwind Version |
| -------------- | ------------------------------------- | ---------------- |
| `shadow-sm`    | `0 1px 3px rgba(0, 0, 0, 0.08)`       | `shadow-sm`      |
| `shadow-md`    | `0 4px 6px rgba(0, 0, 0, 0.08)`       | `shadow-md`      |
| `shadow-panel` | `0 28px 80px rgba(20, 32, 51, 0.12)`  | `shadow-panel`   |
| `shadow-glow`  | `0 18px 44px rgba(14, 165, 255, 0.2)` | `shadow-glow`    |

### 12.6 Font Family Values

All type is set in the IBM Plex family. See [`/STYLING.md` § 3. Typography](/STYLING.md) for full type scale and tracking rules.

| Token          | Typeface                | Role                                                             |
| -------------- | ----------------------- | ---------------------------------------------------------------- |
| `font-sans`    | IBM Plex Sans           | UI body, navigation, labels, metadata — primary interface type   |
| `font-mono`    | IBM Plex Mono           | Technical labels, timestamps, revision names, keyboard shortcuts |
| `font-serif`   | IBM Plex Serif          | Editor body text only — never in navigation, sidebars, or chrome |
| `font-display` | IBM Plex Sans Condensed | Display headings, wordmark                                       |

IBM Plex Serif is scoped exclusively to the editor writing surface.

### 12.7 Motion Duration Values

These are canonical design values. Add matching Tailwind tokenized durations during migration.

| Canonical Value   | Target Duration | Tailwind Version                    |
| ----------------- | --------------- | ----------------------------------- |
| `motion-fast`     | `120-160ms`     | `duration-150` (preferred midpoint) |
| `motion-standard` | `180-240ms`     | `duration-200`                      |
| `motion-slow`     | `260-360ms`     | `duration-300`                      |
| `motion-ambient`  | `500-800ms`     | `duration-700`                      |

### 12.8 Size and Layout Value Guidance

Use utility scale values for component dimensions, and avoid one-off values unless documented as exceptions.

| Use Case       | Canonical Approach                                  | Tailwind Version                        |
| -------------- | --------------------------------------------------- | --------------------------------------- |
| Control height | Use shared utility heights by component role        | `h-8`, `h-9`, `h-10`, `h-11`            |
| Icon size      | Use a consistent icon ladder                        | `size-4`, `size-5`, `size-6`            |
| Panel width    | Use responsive width utilities from layout contract | `w-64`, `w-72`, `w-80`, `max-w-*`       |
| Content width  | Use readable measure constraints                    | `max-w-prose`, `max-w-3xl`, `max-w-5xl` |

### 12.9 Migration Rule for Non-Token Values

When converting existing CSS utilities/components:

1. Prefer a documented Tailwind token utility from sections 12.1-12.8.
2. If no mapping exists, use an arbitrary value utility as a temporary bridge (for example, `w-[22rem]`).
3. Propose tokenization in this document before broad reuse.

---

## Design Inconsistencies, UX Issues, and Optimization Opportunities

This section is the decision ledger from phase 1. All issues now include user responses and have been resolved into canonical rules.

### Issue Entry Fields

Each issue includes:

- What is the issue?
- Why is this an issue?
- Potential courses of action
- User response (required)

### Decision Status Legend

- `OPEN`: awaiting user response (not used in current finalized state)
- `RESOLVED`: user response recorded and accepted
- `DEFERRED`: user response recorded, no action now

---

## General Nits (Grouped)

### ISSUE-001: Motion timings are not normalized into a shared duration system

Status: `RESOLVED`

What is the issue?

- Interaction and decorative timing values are mixed and repeated without a single shared duration scale.

Why is this an issue?

- Timing drift weakens perceived coherence and makes future tuning expensive.

Potential courses of action:

1. Define a canonical duration ladder (for example: fast, standard, slow, ambient) and map all motion to it.
2. Keep separate timings, but formally document contexts where divergence is intentional.
3. Hybrid approach: normalize interaction timings first, defer decorative timing normalization.

User response (required):

- Decision: Define a canonical duration ladder (for example: fast, standard, slow, ambient) and map all motion to it.
- Notes:
- Date: 3/15/2026

### ISSUE-002: Modal/dialog visual language is fragmented across multiple patterns

Status: `RESOLVED`

What is the issue?

- Overlay/backdrop/panel treatments vary across modal families without a documented rationale.

Why is this an issue?

- Users receive inconsistent depth and priority cues for similar interaction moments.

Potential courses of action:

1. Consolidate to one modal baseline with explicit variants by use case.
2. Keep multiple families, but document strict conditions for each.
3. Normalize only backdrop behavior now; panel styling can diverge by intent.

User response (required):

- Decision: Consolidate to one modal baseline with explicit variants by use case.
- Notes:
- Date: 3/15/2026

### ISSUE-003: Spacing strategy is mixed across semantic scale, utility usage, and one-off values

Status: `RESOLVED`

What is the issue?

- The design scale exists, but spacing decisions are not consistently expressed through one strategy.

Why is this an issue?

- Global spacing changes become brittle and visual rhythm varies across surfaces.

Potential courses of action:

1. Enforce a semantic spacing strategy everywhere.
2. Enforce utility-driven spacing everywhere, with documented mapping to semantic scale.
3. Keep mixed strategy but define strict rules for when one-off values are allowed.

User response (required):

- Decision: Enforce utility-driven spacing everywhere, with documented mapping to semantic scale
- Notes: The text editor should remain customizable by users
- Date: 3/15/2026

### ISSUE-004: Icon system governance is unclear

Status: `RESOLVED`

What is the issue?

- A general icon set and custom domain-specific icons both exist, but the boundaries are undocumented.

Why is this an issue?

- Increases maintenance and can create stylistic mismatch without clear ownership rules.

Potential courses of action:

1. Consolidate to one icon system where feasible.
2. Keep dual systems with explicit role boundaries.
3. Introduce an icon selection rubric (semantic fit, visual compatibility, maintenance cost).

User response (required):

- Decision: Consolidate to one icon system where feasible.
- Notes:
- Date: 3/15/2026

### ISSUE-005: Contrast verification evidence is missing from the design record

Status: `RESOLVED`

What is the issue?

- Accessibility intent is present, but this document lacks explicit contrast test evidence.

Why is this an issue?

- Compliance confidence is incomplete and future color changes may regress accessibility.

Potential courses of action:

1. Add a formal contrast matrix and verification workflow in phase 2.
2. Add a minimal high-risk-surface contrast checklist first, full matrix later.
3. Defer full matrix but require spot checks for every new/changed component.

User response (required):

- Decision: Add a formal contrast matrix and verification workflow in phase 2.
- Notes:
- Date: 3/15/2026

---

## Component-Level Issues (Grouped by Component)

## App Shell

### ISSUE-006: App-shell overlays and control patterns use inconsistent emphasis rules

Status: `RESOLVED`

What is the issue?

- Similar shell interactions can present differing emphasis/elevation treatment without clear reason.

Why is this an issue?

- Weakens user predictability in high-frequency, high-context areas.

Potential courses of action:

1. Define a shell interaction hierarchy matrix (primary action, contextual action, destructive action, passive action).
2. Keep current visual variety but document intent per pattern.
3. Normalize only destructive and confirmation patterns now.

User response (required):

- Decision: Define a shell interaction hierarchy matrix (primary action, contextual action, destructive action, passive action).
- Notes:
- Date: 3/15/2026

### ISSUE-007: App-shell implementation size suggests design concerns are too centralized

Status: `RESOLVED`

What is the issue?

- The shell currently carries many concerns, which can hide design-rule boundaries.

Why is this an issue?

- Makes visual evolution risky and slows targeted design improvements.

Potential courses of action:

1. Define design ownership slices (shell frame, navigation controls, overlay patterns) and document separately.
2. Keep structure as-is but add explicit internal design boundaries in docs.
3. Defer restructuring and only document hotspots for now.

User response (required):

- Decision: Define design ownership slices (shell frame, navigation controls, overlay patterns) and document separately.
- Notes:
- Date: 3/15/2026

## Resource Tree

### ISSUE-008: Hierarchy indentation is fixed rather than system-governed

Status: `RESOLVED`

What is the issue?

- Tree depth spacing is currently fixed and not tied to a broader density or spacing model.

Why is this an issue?

- Limits adaptability for compact mode and future cross-surface consistency.

Potential courses of action:

1. Promote hierarchy indentation to a governed design value.
2. Keep fixed depth for now and document it as an intentional invariant.
3. Introduce density-aware indentation with only two levels (comfortable/compact).

User response (required):

- Decision: Promote hierarchy indentation to a governed design value.
- Notes: The user should be able to modify this value per-project or app-wide.
- Date: 3/15/2026

### ISSUE-009: Resource icon semantics and visual weight need a formal rule set

Status: `RESOLVED`

What is the issue?

- Domain-specific icons are useful, but semantic/weight consistency rules are not documented.

Why is this an issue?

- Can cause recognition inconsistency as resource types evolve.

Potential courses of action:

1. Define icon semantics by resource type and state.
2. Keep existing set and only document replacement criteria.
3. Add validation checks for new icon additions.

User response (required):

- Decision: Define icon semantics by resource type and state.
- Notes:
- Date: 3/15/2026

## Work Area (Organizer/Data and related views)

### ISSUE-010: View-level text and metadata styling is partially inlined

Status: `RESOLVED`

What is the issue?

- Some text/meta decisions are set in local inline styles rather than reusable system-level rules.

Why is this an issue?

- Weakens theme consistency and increases duplication risk.

Potential courses of action:

1. Move all view-level text/meta styling into governed reusable patterns.
2. Keep local styling but require mapping documentation to system semantics.
3. Prioritize only high-frequency cards/lists for normalization first.

User response (required):

- Decision: Move all view-level text/meta styling into governed reusable patterns.
- Notes:
- Date: 3/15/2026

### ISSUE-011: Grid/list spacing varies by view without explicit rationale

Status: `RESOLVED`

What is the issue?

- Similar content containers use different spacing behavior without documented intent.

Why is this an issue?

- Makes cross-view transitions feel inconsistent and impedes predictable scanning.

Potential courses of action:

1. Define a shared content-grid rhythm model for all analytical/organizational views.
2. Allow divergence by content type, but document criteria.
3. Normalize only row-level rhythm now, defer card-level rhythm.

User response (required):

- Decision: Define a shared content-grid rhythm model for all analytical/organizational views.
- Notes:
- Date: 3/15/2026

## Editor Surface

### ISSUE-012: Editor typographic rules are separated from core design-system governance

Status: `RESOLVED`

What is the issue?

- Editor typography is implemented in a dedicated global context but not fully reflected in system-level governance.

Why is this an issue?

- Risk of divergence between manuscript readability rules and shell typography strategy.

Potential courses of action:

1. Define an editor typography sub-system in this document.
2. Keep separate editor rules but add a strict mapping to global typographic roles.
3. Normalize only heading/body/blockquote roles now; defer edge-node styling.

User response (required):

- Decision: Define an editor typography sub-system in this document.
- Notes: Document Editor typography should remain customizable by the user and the design system must understand that editor typography may change (such as changing fonts, colors, line spacing, etc)
- Date: 3/15/2026

### ISSUE-013: Some editor decorative colors are not fully aligned to semantic color governance

Status: `RESOLVED`

What is the issue?

- Certain editor node styles rely on direct values rather than governed semantic mapping.

Why is this an issue?

- Creates maintenance friction when palette relationships evolve.

Potential courses of action:

1. Align all editor node colors to semantic governance.
2. Keep current values but document them as temporary exceptions.
3. Normalize only accessibility-critical editor colors first.

User response (required):

- Decision: Align all editor node colors to semantic governance.
- Notes:
- Date: 3/15/2026

## Start Experience

### ISSUE-014: Start-surface expressive styling is strong but not formally bounded

Status: `RESOLVED`

What is the issue?

- The start surface intentionally uses a more expressive visual language, but boundary rules are not explicit.

Why is this an issue?

- Design language may leak into productivity surfaces without a clear gate.

Potential courses of action:

1. Define explicit boundaries for expressive vs productivity surfaces.
2. Keep current approach and document start-surface as a deliberate brand exception.
3. Introduce a shared expressive token subset for controlled reuse.

User response (required):

- Decision: Define explicit boundaries for expressive vs productivity surfaces.
- Notes:
- Date: 3/15/2026

## Notifications and Feedback

### ISSUE-015: Notification state semantics need formal severity mapping

Status: `RESOLVED`

What is the issue?

- Feedback visuals exist, but severity/state mapping is not fully standardized in design guidance.

Why is this an issue?

- Can produce inconsistent urgency cues and response expectations.

Potential courses of action:

1. Define success/info/warning/error/neutral notification semantics and visuals.
2. Keep current visuals and document semantic intent retroactively.
3. Standardize only error and destructive feedback first.

User response (required):

- Decision: Define success/info/warning/error/neutral notification semantics and visuals.
- Notes:
- Date: 3/15/2026

## View Switcher and Navigation Semantics

### ISSUE-016: Disabled-state behavior for view switching needs explicit product/design contract

Status: `RESOLVED`

What is the issue?

- Disabled view behavior is implemented as capability but not fully documented as a user-facing contract.

Why is this an issue?

- Ambiguous disabled-state semantics can confuse users and increase implementation drift.

Potential courses of action:

1. Define a disabled-state contract (visual, tooltip/help text, keyboard behavior).
2. Remove/avoid disabled state unless strictly required by product rules.
3. Keep capability and document that disabled states are reserved for policy/permissions cases.

User response (required):

- Decision: Define a disabled-state contract (visual, tooltip/help text, keyboard behavior).
- Notes:
- Date: 3/15/2026

---

## Phase 1 Completion Checklist

- [x] App-wide theme/style/layout decisions documented as currently implemented
- [x] Component-level design patterns documented as currently implemented
- [x] Library-agnostic what/why framing applied
- [x] All detected issues and optimization opportunities captured
- [x] General nits grouped together
- [x] Component-level nits grouped by related components
- [x] Every issue includes user response placeholder
- [x] Phase 2 gate explicitly defined

## Phase 2 Completion Criteria

Phase 2 is complete because all issues (`ISSUE-001` through `ISSUE-016`) include recorded user responses and have been resolved into canonical design rules.

## Phase 2 Completion Checklist

- [x] All issue responses recorded and incorporated
- [x] Canonical foundations documented (theme, color, typography, spacing, motion, elevation, icons)
- [x] Canonical layout and responsive rules documented
- [x] Canonical component-family rules documented
- [x] Interaction-state model documented
- [x] Accessibility and contrast verification workflow documented
- [x] Governance and maintenance protocol documented

## Finalization Record

- Finalized date: 2026-03-15
- Issue status: `ISSUE-001` through `ISSUE-016` are resolved via recorded user decisions.
- Canonical authority: active
