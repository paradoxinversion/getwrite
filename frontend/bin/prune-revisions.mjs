#!/usr/bin/env node
/*
  Lightweight CLI wrapper that calls `runCli` from the prune executor.

  Note: `pruneExecutor` is authored in TypeScript under `src/lib/models`.
  Running this file directly with plain `node` requires a build step or a
  runtime that supports executing TypeScript (e.g. `ts-node`/`tsx`).

  Examples:
    - Using `tsx` (recommended for local dev):
        pnpm dlx tsx ./frontend/bin/prune-revisions.mjs <projectRoot> [maxRevisions]

    - Using Node after a build step that emits JS to `dist/`:
        node ./frontend/dist/bin/prune-revisions.mjs <projectRoot> [maxRevisions]
*/

async function main() {
    try {
        // Try to import the runtime module. Prefer the JS build if present.
        let mod;
        try {
            mod = await import("../src/lib/models/pruneExecutor.js");
        } catch (e) {
            // Fallback to TS source (may require ts-node/tsx to run)
            mod = await import("../src/lib/models/pruneExecutor.ts");
        }

        const runCli = mod.runCli ?? mod.default?.runCli ?? mod.default ?? mod;
        if (typeof runCli !== "function") {
            console.error("Unable to locate `runCli` in pruneExecutor module.");
            process.exit(2);
        }

        const code = await runCli(process.argv);
        process.exit(code ?? 0);
    } catch (err) {
        console.error("Prune CLI failed:", err);
        process.exit(2);
    }
}

main();
