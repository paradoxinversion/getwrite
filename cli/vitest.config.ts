import { defineConfig } from "vitest/config";
import path from "node:path";

// The CLI consumes the model layer through the single `@gw/core` barrel. Mirror
// the tsconfig path alias here so tests resolve it the same way esbuild does at
// build time.
export default defineConfig({
  resolve: {
    alias: {
      "@gw/core": path.resolve(__dirname, "../frontend/src/lib/core.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    // tests/qa/server.test.ts spawns a real Next.js dev server and polls it
    // over HTTP. Running it concurrently with the rest of the suite (Vitest's
    // default file-level parallelism runs files across separate
    // processes/threads) creates enough resource pressure — competing
    // workers, plus Turbopack's own compile work — that the dev server can
    // serve an interim/error page instead of valid JSON for the whole retry
    // budget, failing deterministically even though the same test passes
    // reliably in isolation. Disabling file parallelism runs all suite files
    // sequentially in one worker, removing that contention; the suite is
    // small (17 files, mostly fast unit tests) so this doesn't meaningfully
    // change CI wall-clock time.
    fileParallelism: false,
  },
});
