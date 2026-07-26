// ADR-021 Phase 2 (Task 1, FR6/FR13): guards the fix that keeps
// `native-bootstrap.ts` — and everything transitively under it
// (`capacitor-filesystem-real.ts`, `storage-context.ts`, which import
// `node:async_hooks`) — out of the web/desktop `next build` output, mirroring
// `native-search-backend-web-exclusion.test.ts`'s Phase 0 guard for the same
// pattern.
//
// Two things have to hold simultaneously for that exclusion to work, and
// this file checks both:
//
// 1. Nothing statically or dynamically imports `native-bootstrap.ts` except
//    `components/native/NativeBootstrap.tsx`'s single dynamic `import()`.
// 2. `next.config.mjs` carries the `turbopack.resolveAlias` entry that
//    substitutes a `node:*`-free stub for that exact import specifier at
//    build time — because Turbopack resolves dynamic `import()` targets into
//    the module graph regardless of whether the surrounding runtime
//    condition is reachable.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const NATIVE_BOOTSTRAP_RELATIVE_PATH = path.join(
  "src",
  "lib",
  "models",
  "native-bootstrap.ts",
);
const NATIVE_BOOTSTRAP_CALL_SITE_RELATIVE_PATH = path.join(
  "components",
  "native",
  "NativeBootstrap.tsx",
);
const WEB_STUB_RELATIVE_PATH = path.join(
  "src",
  "lib",
  "models",
  "native-bootstrap.web-stub.ts",
);
const CALL_SITE_IMPORT_SPECIFIER = "../../src/lib/models/native-bootstrap";

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

describe("native-bootstrap web-bundle exclusion", () => {
  const frontendRoot = path.resolve(__dirname, "..", "..");

  it("is referenced (statically or dynamically) only from NativeBootstrap.tsx", () => {
    const dirsToScan = ["src", "app", "components"].map((d) =>
      path.join(frontendRoot, d),
    );
    const importRe = /native-bootstrap(?!\.web-stub)["']/;

    const offenders: string[] = [];
    for (const dir of dirsToScan) {
      if (!fs.existsSync(dir)) continue;
      for (const file of collectSourceFiles(dir)) {
        const relative = path.relative(frontendRoot, file);
        if (relative === NATIVE_BOOTSTRAP_CALL_SITE_RELATIVE_PATH) continue;
        if (relative === NATIVE_BOOTSTRAP_RELATIVE_PATH) continue;
        if (relative === WEB_STUB_RELATIVE_PATH) continue;
        const contents = fs.readFileSync(file, "utf8");
        if (importRe.test(contents)) {
          offenders.push(relative);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("NativeBootstrap.tsx guards the dynamic import with the raw, directly-inlinable env comparison", () => {
    const contents = fs.readFileSync(
      path.join(frontendRoot, NATIVE_BOOTSTRAP_CALL_SITE_RELATIVE_PATH),
      "utf8",
    );

    expect(contents).toMatch(
      /process\.env\.NEXT_PUBLIC_GETWRITE_RUNTIME\s*!==\s*"native"/,
    );
  });

  it("NativeBootstrap.tsx's native loader still carries the literal dynamic import specifier", () => {
    const contents = fs.readFileSync(
      path.join(frontendRoot, NATIVE_BOOTSTRAP_CALL_SITE_RELATIVE_PATH),
      "utf8",
    );

    expect(contents).toContain(`import("${CALL_SITE_IMPORT_SPECIFIER}")`);
  });

  it("next.config.mjs aliases the native bootstrap specifier to a node:*-free stub for Turbopack builds", () => {
    const configContents = fs.readFileSync(
      path.join(frontendRoot, "next.config.mjs"),
      "utf8",
    );

    expect(configContents).toContain("resolveAlias");
    expect(configContents).toContain(`"${CALL_SITE_IMPORT_SPECIFIER}"`);
    expect(configContents).toContain("native-bootstrap.web-stub");
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
