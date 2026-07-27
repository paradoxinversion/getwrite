// ADR-021 Phase 2 (Task 3): guards the same web-bundle exclusion established
// for resources (`native-resource-backend-web-exclusion.test.ts`) for the
// resource-excerpts transport — `native-resource-excerpts-backend.ts` and
// everything transitively under it (`resource-excerpts-core.ts` ->
// `resource-persistence.ts`/`io.ts`, which import `node:path`) must never
// enter the web/desktop `next build` output.
//
// Two things have to hold simultaneously for that exclusion to work, and this
// file checks both:
//
// 1. Nothing statically or dynamically imports
//    `native-resource-excerpts-backend.ts` except
//    `lib/api/resource-excerpts.ts`'s single dynamic `import()`.
// 2. `next.config.mjs` carries the `turbopack.resolveAlias` entry that
//    substitutes a `node:*`-free stub for that exact import specifier at
//    build time.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const NATIVE_BACKEND_RELATIVE_PATH = path.join(
  "src",
  "store",
  "transport",
  "native-resource-excerpts-backend.ts",
);
const EXCERPTS_TRANSPORT_SERVICE_RELATIVE_PATH = path.join(
  "src",
  "lib",
  "api",
  "resource-excerpts.ts",
);
const WEB_STUB_RELATIVE_PATH = path.join(
  "src",
  "store",
  "transport",
  "native-resource-excerpts-backend.web-stub.ts",
);

/** Recursively collects every `.ts`/`.tsx` file under `dir`. */
function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("native-resource-excerpts-backend web-bundle exclusion", () => {
  const frontendRoot = path.resolve(__dirname, "..", "..");

  it("is referenced (statically or dynamically) only from lib/api/resource-excerpts.ts", () => {
    const dirsToScan = ["src", "app"].map((d) => path.join(frontendRoot, d));
    const importRe = /native-resource-excerpts-backend(?!\.web-stub)["']/;

    const offenders: string[] = [];
    for (const dir of dirsToScan) {
      if (!fs.existsSync(dir)) continue;
      for (const file of collectSourceFiles(dir)) {
        const relative = path.relative(frontendRoot, file);
        if (relative === EXCERPTS_TRANSPORT_SERVICE_RELATIVE_PATH) continue;
        if (relative === NATIVE_BACKEND_RELATIVE_PATH) continue;
        if (relative === WEB_STUB_RELATIVE_PATH) continue;
        const contents = fs.readFileSync(file, "utf8");
        if (importRe.test(contents)) {
          offenders.push(relative);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("lib/api/resource-excerpts.ts's native loader thunk carries the literal dynamic import specifier", () => {
    const contents = fs.readFileSync(
      path.join(frontendRoot, EXCERPTS_TRANSPORT_SERVICE_RELATIVE_PATH),
      "utf8",
    );

    expect(contents).toContain(
      'import("../../store/transport/native-resource-excerpts-backend")',
    );
  });

  it("next.config.mjs aliases the native backend specifier to a node:*-free stub for Turbopack builds", () => {
    const configContents = fs.readFileSync(
      path.join(frontendRoot, "next.config.mjs"),
      "utf8",
    );

    expect(configContents).toContain("resolveAlias");
    expect(configContents).toContain(
      '"../../store/transport/native-resource-excerpts-backend"',
    );
    expect(configContents).toContain(
      "native-resource-excerpts-backend.web-stub",
    );
  });

  it("the web-stub module contains no reference to node:* built-ins", () => {
    const stubContents = fs.readFileSync(
      path.join(frontendRoot, WEB_STUB_RELATIVE_PATH),
      "utf8",
    );

    expect(stubContents).not.toMatch(/from\s+["']node:/);
    expect(stubContents).not.toMatch(/require\(\s*["']node:/);
  });
});
