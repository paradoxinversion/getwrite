// ADR-021 Phase 0 (Task 2.5): guards the fix that keeps
// `native-search-backend.ts` — and everything transitively under it
// (`execute-search.ts` -> `inverted-index.ts`/`indexer-queue.ts`/
// `storage-context.ts`, which import `node:path`/`node:fs`/`node:async_hooks`)
// — out of the web/desktop `next build` output.
//
// Two things have to hold simultaneously for that exclusion to work, and this
// file checks both:
//
// 1. Nothing statically or dynamically imports `native-search-backend.ts`
//    except `search-transport.ts`'s single dynamic `import()` (mirrors the
//    dynamic-import-only discipline guard in `capacitor-filesystem-real.test.ts`).
// 2. `next.config.mjs` carries the `turbopack.resolveAlias` entry that
//    substitutes a `node:*`-free stub for that exact import specifier at
//    build time — because Turbopack resolves dynamic `import()` targets into
//    the module graph regardless of whether the surrounding runtime
//    condition is reachable, so the guard in `search-transport.ts` alone is
//    not sufficient (see that file's `resolveSearchTransport` doc comment).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const NATIVE_BACKEND_RELATIVE_PATH = path.join(
  "src",
  "store",
  "transport",
  "native-search-backend.ts",
);
const SEARCH_TRANSPORT_RELATIVE_PATH = path.join(
  "src",
  "store",
  "transport",
  "search-transport.ts",
);
const WEB_STUB_RELATIVE_PATH = path.join(
  "src",
  "store",
  "transport",
  "native-search-backend.web-stub.ts",
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

describe("native-search-backend web-bundle exclusion", () => {
  const frontendRoot = path.resolve(__dirname, "..", "..");

  it("is referenced (statically or dynamically) only from search-transport.ts", () => {
    const dirsToScan = ["src", "app"].map((d) => path.join(frontendRoot, d));
    const importRe = /native-search-backend(?!\.web-stub)["']/;

    const offenders: string[] = [];
    for (const dir of dirsToScan) {
      if (!fs.existsSync(dir)) continue;
      for (const file of collectSourceFiles(dir)) {
        const relative = path.relative(frontendRoot, file);
        if (relative === SEARCH_TRANSPORT_RELATIVE_PATH) continue;
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

  it("search-transport.ts gates the dynamic import with the raw, directly-inlinable env comparison (not an indirected function call)", () => {
    const contents = fs.readFileSync(
      path.join(frontendRoot, SEARCH_TRANSPORT_RELATIVE_PATH),
      "utf8",
    );

    // The gate immediately preceding the dynamic import must be the literal
    // `process.env.NEXT_PUBLIC_GETWRITE_RUNTIME === "native"` comparison,
    // not `resolveRuntime() === "native"`. Regression here would reintroduce
    // an indirection that (empirically, per this task's investigation)
    // doesn't change Turbopack's bundling behavior on its own, but keeping
    // the literal form documents the intended, most-inlinable shape of the
    // guard and keeps `resolveRuntime()` decoupled from this call site.
    expect(contents).toMatch(
      /if\s*\(\s*process\.env\.NEXT_PUBLIC_GETWRITE_RUNTIME\s*===\s*"native"\s*\)/,
    );
    expect(contents).not.toMatch(/resolveRuntime\(\)\s*===\s*"native"/);
    expect(contents).toContain('await import("./native-search-backend")');
  });

  it("next.config.mjs aliases the native backend specifier to a node:*-free stub for Turbopack builds", () => {
    const configContents = fs.readFileSync(
      path.join(frontendRoot, "next.config.mjs"),
      "utf8",
    );

    expect(configContents).toContain("resolveAlias");
    expect(configContents).toContain('"./native-search-backend"');
    expect(configContents).toContain("native-search-backend.web-stub");
  });

  it("the web-stub module contains no reference to node:* built-ins", () => {
    const stubContents = fs.readFileSync(
      path.join(
        frontendRoot,
        "src",
        "store",
        "transport",
        "native-search-backend.web-stub.ts",
      ),
      "utf8",
    );

    expect(stubContents).not.toMatch(/from\s+["']node:/);
    expect(stubContents).not.toMatch(/require\(\s*["']node:/);
  });
});
