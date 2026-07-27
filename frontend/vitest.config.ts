import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal, static vitest config to avoid loading ESM-only dependencies at
// config-evaluation time (resolves an ERR_REQUIRE_ESM startup issue).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "frontend", "@") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "**/e2e/**",
      "playwright-report/**",
      "node_modules/**",
      ".next/**",
      // ADR-021 Phase 2: build-native-static.mjs's generated shadow build
      // root symlinks node_modules/ in (and copies app/, next.config.mjs,
      // etc.) so `next build` can run against it — none of that is source,
      // and its own `node_modules` symlink would otherwise pull vendored
      // packages' own test suites (e.g. zod's) into this run.
      ".native-build/**",
      "out/**",
    ],
  },
});
