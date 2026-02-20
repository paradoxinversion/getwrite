# Prune Revisions CLI

This document describes the small CLI wrapper included at `frontend/bin/prune-revisions.mjs`.

Purpose

- Run the pruning executor across a project to enforce `maxRevisions` per resource.

Basic usage

- Local dev with `tsx` (no build required):

```bash
pnpm dlx tsx ./frontend/bin/prune-revisions.mjs <projectRoot> [maxRevisions]
```

- If you have a JS build output, run with Node directly:

```bash
node ./frontend/dist/bin/prune-revisions.mjs <projectRoot> [maxRevisions]
```

Notes

- The wrapper attempts to import `../src/lib/models/pruneExecutor.js` first (JS build),
  then falls back to `../src/lib/models/pruneExecutor.ts` which requires a TS-aware runtime.
- The CLI returns exit code `0` on success and `2` on error.

Next steps

- Optionally add a `bin` entry in `frontend/package.json` or add a `pnpm` script to simplify invocation.
