# Prune Revisions CLI

This document describes the small CLI wrapper included at `frontend/bin/prune-revisions.mjs`.

Purpose

- Run the pruning executor across a project to enforce `maxRevisions` per resource.

Build and usage

- Build the CLI (outputs into `dist-cli/` to avoid colliding with the Next app build):

```bash
cd frontend
pnpm install # if needed
pnpm build:cli
```

- Run the built CLI with Node:

```bash
node ./frontend/dist-cli/bin/prune-revisions.mjs <projectRoot> [maxRevisions]
```

Notes

- The wrapper attempts to import `../src/lib/models/pruneExecutor.js` first (JS build),
  then falls back to `../src/lib/models/pruneExecutor.ts` which requires a TS-aware runtime.
- The CLI returns exit code `0` on success and `2` on error.

Next steps

- This repository exposes a `bin` entry in `frontend/package.json` after building; it maps to `dist-cli/bin/prune-revisions.mjs` so the CLI is installable and runnable without touching the app build output.
