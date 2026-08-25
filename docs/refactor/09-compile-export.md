# Slice 09 — Compile & Export

**Risk:** 🟢 low — self-contained. **Recommended first slice** to calibrate agents.
**~1.2k lines.** Layer: lib + api + UI.

## Scope

- **Lib:** `lib/export/markdown-serializer.ts` (185), `lib/export/CompileDocxDocument.ts` (84),
  `lib/export/compile-markdown.ts` (52), `lib/api/compile.ts` (112), `lib/api/export.ts` (70).
- **API:** `app/api/compile/*` (pdf, markdown, docx, text), `app/api/export/*` (markdown, text).
- **UI:** `components/common/CompilePreviewModal.tsx` (195),
  `components/common/CompileResourceTree.tsx` (166).

## Goal

Unify the per-format compile/export routes (pdf/markdown/docx/text share a shape).
Clarify the markdown serializer.

## Watch out for

- Serialized output is user-facing artifact — markdown/text/docx bytes must match.
  `markdown-serializer` and `compileSelection` tests guard this.

## Gate (from `frontend/`)

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run \
  unit/markdown-serializer unit/compileSelection unit/export-text-route \
  compilePreviewModal exportPreviewModal
```

Then `pnpm knip` at repo root.
