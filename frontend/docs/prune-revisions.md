# Prune Revisions CLI

This document describes the prune functionality and how to run it using the consolidated CLI.

Summary

- Use the consolidated `getwrite-cli prune` subcommand to run the prune executor.

Purpose

- Run the pruning executor across a project to enforce `maxRevisions` per resource.

Build and usage

- Build the CLI artifacts (outputs into `dist-cli/` to avoid colliding with the Next app build):

```bash
cd frontend
pnpm install # if needed
pnpm run build:cli
```

- Run the new subcommand with Node (built artifact):

```bash
node ./frontend/dist-cli/bin/getwrite-cli.cjs prune <projectRoot> [maxRevisions]
```

- For development (no build) you can run the bin loader with `tsx`:

```bash
pnpm dlx tsx ./frontend/bin/getwrite-cli.mjs prune <projectRoot> [maxRevisions]
```

Notes

- The underlying executor is implemented in `frontend/src/lib/models/pruneExecutor.ts` and returns exit code `0` on success and `2` on error.

Next steps

- The repository exposes a `bin` entry in `frontend/package.json` after building; it maps to `dist-cli/bin/getwrite-cli.cjs` so the CLI is installable and runnable without touching the app build output.
