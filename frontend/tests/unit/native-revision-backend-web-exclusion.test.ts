// ADR-021 Phase 1 (Task 2): guards the same web-bundle exclusion established
// for search (`native-search-backend-web-exclusion.test.ts`) for the revision
// transport — `native-revision-backend.ts` and everything transitively under
// it (`revision-core.ts` -> `revision.ts`/`sidecar.ts`/`io.ts`, which import
// `node:path`) must never enter the web/desktop `next build` output.
//
// Two things have to hold simultaneously for that exclusion to work, and this
// file checks both:
//
// 1. Nothing statically or dynamically imports `native-revision-backend.ts`
//    except `revision-transport-service.ts`'s single dynamic `import()`.
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
  "native-revision-backend.ts",
);
const REVISION_TRANSPORT_SERVICE_RELATIVE_PATH = path.join(
  "src",
  "store",
  "revision-transport-service.ts",
);
const WEB_STUB_RELATIVE_PATH = path.join(
  "src",
  "store",
  "transport",
  "native-revision-backend.web-stub.ts",
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

describe("native-revision-backend web-bundle exclusion", () => {
  const frontendRoot = path.resolve(__dirname, "..", "..");

  it("is referenced (statically or dynamically) only from revision-transport-service.ts", () => {
    const dirsToScan = ["src", "app"].map((d) => path.join(frontendRoot, d));
    const importRe = /native-revision-backend(?!\.web-stub)["']/;

    const offenders: string[] = [];
    for (const dir of dirsToScan) {
      if (!fs.existsSync(dir)) continue;
      for (const file of collectSourceFiles(dir)) {
        const relative = path.relative(frontendRoot, file);
        if (relative === REVISION_TRANSPORT_SERVICE_RELATIVE_PATH) continue;
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

  it("revision-transport-service.ts's native loader thunk carries the literal dynamic import specifier", () => {
    const contents = fs.readFileSync(
      path.join(frontendRoot, REVISION_TRANSPORT_SERVICE_RELATIVE_PATH),
      "utf8",
    );

    expect(contents).toContain('import("./transport/native-revision-backend")');
  });

  it("next.config.mjs aliases the native backend specifier to a node:*-free stub for Turbopack builds", () => {
    const configContents = fs.readFileSync(
      path.join(frontendRoot, "next.config.mjs"),
      "utf8",
    );

    expect(configContents).toContain("resolveAlias");
    expect(configContents).toContain('"./transport/native-revision-backend"');
    expect(configContents).toContain("native-revision-backend.web-stub");
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
