# research.md — Phase 0 Research for UI - GetWrite polished skeleton

Decisions (resolved during planning):

- Decision: Frontend framework — Next.js 16.1.6 with TypeScript 5.9.3
  Rationale: User-specified in plan prompt; Next.js provides a solid app structure, routing, and developer experience.
  Alternatives considered: Create React App / Vite alone — rejected for integrated SSR/route support.

- Decision: Styling — TailwindCSS 4.1
  Rationale: User-specified; utility-first system speeds UI prototyping and enforces consistent spacing/typography tokens.

- Decision: Editor — TipTap v3
  Rationale: Replace TinyMCE with TipTap v3 (headless, modern ProseMirror-based editor) for
  better integration with React/Next.js, improved SSR handling, and simpler bundling and
  customization for the UI-focused skeleton.

- Decision: Component dev + docs — Storybook
  Rationale: User-specified; isolates components for visual QA and designer sign-off.

- Decision: Testing — Testing Library (components) + Vitest (unit/integration)
  Rationale: User-specified; matches modern TS frontend stacks and integrates with Vite.

- Decision: Accessibility target — WCAG 2.1 AA
  Rationale: Chosen by stakeholder during clarification step.

- Decision: Responsiveness approach — Desktop-first responsive (>=768px support)
  Rationale: Chosen by stakeholder during clarification step.

Notes: No unresolved NEEDS CLARIFICATION items remain. All technical choices for this UI-only milestone were provided by the user and confirmed.
