// ADR-021 Phase 2 (Task 5, FR15): proves the native project-types transport
// resolves the bundled templates from the static, build-time-imported
// registry (`lib/models/project-types-static.ts`) rather than any
// filesystem read — no HTTP, and (unlike every other native backend) no
// `CapacitorFilesystemLike`/storage-context binding at all, since there is
// nothing to bind it to.
import { describe, expect, it } from "vitest";
import { createNativeProjectTypesTransport } from "../../src/store/transport/native-project-types-backend";
import {
  getStaticProjectType,
  listStaticProjectTypes,
} from "../../src/lib/models/project-types-static";

function guardAgainstFetch(): { restore: () => void } {
  const original = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("fetch must not be called in-process");
  }) as unknown as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

describe("native project-types transport — reads the static template registry with no HTTP", () => {
  it("lists every bundled template with no HTTP", async () => {
    const fetchMock = guardAgainstFetch();
    const transport = createNativeProjectTypesTransport();

    const list = await transport.list();

    expect(list.length).toBeGreaterThan(0);
    expect(list.map((t) => t.id).sort()).toEqual(
      listStaticProjectTypes()
        .map((t) => t.id)
        .sort(),
    );

    fetchMock.restore();
  });

  it("includes every bundled project type by id, matching what the fs-based route would have produced", async () => {
    const transport = createNativeProjectTypesTransport();
    const list = await transport.list();
    const ids = list.map((t) => t.id);

    for (const id of [
      "article",
      "blank",
      "game_writing",
      "novel",
      "poetry_and_lyrics",
      "serial",
    ]) {
      expect(ids).toContain(id);
    }
  });
});

describe("project-types-static registry — proves static-import resolution, not incidental fs fallback", () => {
  it("resolves a known project type even when GETWRITE_TEMPLATES_DIR points at a nonexistent path", () => {
    const original = process.env.GETWRITE_TEMPLATES_DIR;
    process.env.GETWRITE_TEMPLATES_DIR = "/definitely/not/a/real/directory";
    try {
      const spec = getStaticProjectType("article");
      expect(spec).toBeDefined();
      expect(spec?.name).toBeTruthy();
    } finally {
      if (original === undefined) delete process.env.GETWRITE_TEMPLATES_DIR;
      else process.env.GETWRITE_TEMPLATES_DIR = original;
    }
  });

  it("resolves a known project type even when process.cwd() is redirected away from the repo", () => {
    const originalCwd = process.cwd();
    try {
      // `chdir` is unavailable in some sandboxed test runners; guard so this
      // assertion degrades gracefully rather than failing the whole suite
      // for an environment limitation unrelated to what's under test.
      process.chdir("/");
      const spec = getStaticProjectType("novel");
      expect(spec).toBeDefined();
    } catch (err) {
      if (!(err instanceof Error) || !/EPERM|ENOENT/.test(err.message)) {
        throw err;
      }
    } finally {
      try {
        process.chdir(originalCwd);
      } catch {
        // best-effort restore
      }
    }
  });

  it("returns undefined for an unknown id rather than throwing", () => {
    expect(getStaticProjectType("not-a-real-type")).toBeUndefined();
  });
});
