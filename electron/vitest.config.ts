import { defineConfig } from "vitest/config";

// `src/main.ts` cannot be imported outside an Electron runtime, so the logic
// worth testing lives in plain modules beside it (see `src/projects-dir.ts`).
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
