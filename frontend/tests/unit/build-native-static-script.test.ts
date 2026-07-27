// ADR-021 Phase 2 (Task 1, FR4): static guards on
// `scripts/build-native-static.mjs` proving the copy-forward-only contract —
// `frontend/app/` is only ever read, never mutated/moved/deleted — without
// actually invoking `next build` (too slow for a unit test; the acceptance
// gate runs `pnpm build:native` directly and diffs `git status` under
// `frontend/app/` for the end-to-end proof).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SCRIPT_PATH = path.join(
  path.resolve(__dirname, "..", ".."),
  "scripts",
  "build-native-static.mjs",
);

describe("build-native-static.mjs copy-forward guarantee", () => {
  const contents = fs.readFileSync(SCRIPT_PATH, "utf8");

  it("never calls a mutating fs operation (rm/write/rename) with appSrc as a target", () => {
    // `appSrc` is only ever passed as the *source* argument to `cpSync` — a
    // read. It must never appear as the destination/target of `rmSync`,
    // `writeFileSync`, `renameSync`, `mkdirSync`, or `symlinkSync`.
    const mutatingCallWithAppSrcAsArg =
      /(rmSync|writeFileSync|renameSync|mkdirSync|symlinkSync)\([^)]*appSrc/;
    expect(contents).not.toMatch(mutatingCallWithAppSrcAsArg);
  });

  it("only reads appSrc via cpSync as the copy source", () => {
    expect(contents).toMatch(/cpSync\(\s*appSrc\s*,\s*appDest/);
  });

  it("computes appSrc as a path under the real frontend/app/, not the shadow build root", () => {
    expect(contents).toMatch(/const appSrc = join\(frontendRoot, "app"\)/);
  });

  it("computes appDest under the shadow build directory, not frontendRoot", () => {
    expect(contents).toMatch(/const appDest = join\(buildDir, "app"\)/);
  });

  it("excludes app/api and the three hosted-auth pages from the copy only", () => {
    expect(contents).toContain('"api"');
    expect(contents).toContain('"login"');
    expect(contents).toContain('"reset-password"');
    expect(contents).toContain('"verify-email"');
    // The removal targets appDest (the copy), never appSrc (the real tree).
    expect(contents).toMatch(/rmSync\(join\(appDest, subpath\)/);
  });

  it("runs next build with GETWRITE_BUILD_TARGET and NEXT_PUBLIC_GETWRITE_RUNTIME set to native", () => {
    expect(contents).toContain('GETWRITE_BUILD_TARGET: "native"');
    expect(contents).toContain('NEXT_PUBLIC_GETWRITE_RUNTIME: "native"');
  });

  it("never sets cwd to frontendRoot for the next build invocation (always the shadow build dir)", () => {
    expect(contents).toMatch(/cwd:\s*buildDir/);
    expect(contents).not.toMatch(/cwd:\s*frontendRoot/);
  });
});
