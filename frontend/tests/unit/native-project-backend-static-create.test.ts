// ADR-021 Phase 2 (Task 5, FR15): proves `native-project-backend.ts`'s
// `create` operation resolves `projectType` from the static template
// registry (`lib/models/project-types-static.ts`), not `getProjectType`'s
// `node:fs` scan of a repo-relative directory — the fix for the latent bug
// where native project creation silently depended on a filesystem path that
// does not exist on-device (see `createProjectCoreNative`'s doc comment in
// `project-crud-core.ts`). Additive: does not modify
// `native-project-backend.test.ts`.
import { afterEach, describe, expect, it } from "vitest";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";
import { createNativeProjectsTransport } from "../../src/store/transport/native-project-backend";

const PROJECTS_DIR = "/projects";

describe("native project create — proves static-import resolution, not incidental fs fallback", () => {
  const originalTemplatesDir = process.env.GETWRITE_TEMPLATES_DIR;
  const originalProjectTypesDir = process.env.GETWRITE_PROJECT_TYPES_DIR;

  afterEach(() => {
    if (originalTemplatesDir === undefined) {
      delete process.env.GETWRITE_TEMPLATES_DIR;
    } else {
      process.env.GETWRITE_TEMPLATES_DIR = originalTemplatesDir;
    }
    if (originalProjectTypesDir === undefined) {
      delete process.env.GETWRITE_PROJECT_TYPES_DIR;
    } else {
      process.env.GETWRITE_PROJECT_TYPES_DIR = originalProjectTypesDir;
    }
  });

  it("creates a project from a bundled type even when every fs-based template env override points nowhere real", async () => {
    process.env.GETWRITE_TEMPLATES_DIR = "/definitely/not/a/real/directory";
    process.env.GETWRITE_PROJECT_TYPES_DIR = "/also/not/a/real/directory";

    const fs = createFakeCapacitorFilesystem();
    const transport = createNativeProjectsTransport({
      fs,
      projectsDir: PROJECTS_DIR,
    });

    const created = await transport.create("My Blank Project", "blank");

    expect(created.project.name).toBe("My Blank Project");
  });
});
