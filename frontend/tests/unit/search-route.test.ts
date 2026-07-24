/**
 * Integration tests for the search route (Task 3).
 *
 * Tests call executeSearch directly against a real temporary filesystem
 * project, and exercise the GET handler for HTTP-level validation cases.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { removeDirRetry } from "./helpers/fs-utils";
import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createProject } from "../../src/lib/models/project";
import { PROJECT_FILENAME } from "../../src/lib/models/project-config";
import { writeSidecar } from "../../src/lib/models/sidecar";
import {
  writeRevision,
  setCanonicalRevision,
} from "../../src/lib/models/revision";
import { indexResource } from "../../src/lib/models/inverted-index";
import { assignTagToResource, createTag } from "../../src/lib/models/tags";
import { generateUUID } from "../../src/lib/models/uuid";
import {
  executeSearch,
  GET,
} from "../../app/api/project/[project-id]/search/route";
import type { Project } from "../../src/lib/models/types";

// ---- Test project helpers -----------------------------------------------

const tmpDirs: string[] = [];

async function makeTmpProjectsDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gw-search-"));
  tmpDirs.push(dir);
  return dir;
}

/** Creates a project directory inside projectsDir and returns its root path. */
async function createTestProject(
  projectsDir: string,
  opts: { searchResultLimit?: number } = {},
): Promise<{ projectRoot: string; projectId: string }> {
  const projectId = generateUUID();
  const projectRoot = path.join(projectsDir, `project-${projectId}`);
  await fs.mkdir(projectRoot, { recursive: true });

  const metadata =
    opts.searchResultLimit !== undefined
      ? { userPreferences: { searchResultLimit: opts.searchResultLimit } }
      : undefined;

  const proj = createProject({ name: "test-project", metadata });
  // Overwrite the generated ID with our deterministic one so findProjectRoot can match it
  const withId: Project = { ...proj, id: projectId };

  await fs.writeFile(
    path.join(projectRoot, PROJECT_FILENAME),
    JSON.stringify(withId, null, 2),
    "utf8",
  );

  return { projectRoot, projectId };
}

/** Adds a text resource to a project: sidecar + canonical revision + index entry. */
async function addTestResource(
  projectRoot: string,
  opts: {
    id?: string;
    name: string;
    content: string;
    folderId?: string;
    status?: string;
  },
): Promise<string> {
  const resourceId = opts.id ?? generateUUID();

  // Write sidecar
  await writeSidecar(projectRoot, resourceId, {
    id: resourceId,
    name: opts.name,
    type: "text",
    folderId: opts.folderId ?? null,
    orderIndex: 0,
    createdAt: new Date().toISOString(),
    slug: opts.name.toLowerCase().replace(/\s+/g, "-"),
    ...(opts.status !== undefined && { userMetadata: { status: opts.status } }),
  });

  // Write canonical revision
  const revision = await writeRevision(
    projectRoot,
    resourceId,
    1,
    opts.content,
    { isCanonical: true },
  );
  await setCanonicalRevision(projectRoot, resourceId, revision.versionNumber);

  // Index the resource
  await indexResource(projectRoot, {
    id: resourceId,
    name: opts.name,
    type: "text",
    slug: opts.name,
    orderIndex: 0,
    createdAt: new Date().toISOString(),
    plainText: opts.content,
  });

  return resourceId;
}

afterEach(async () => {
  for (const dir of tmpDirs.splice(0)) {
    await removeDirRetry(dir);
  }
});

// ---- executeSearch tests -------------------------------------------------

describe("executeSearch — happy path", () => {
  it("returns a result with correct shape for a matching resource", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    const resourceId = await addTestResource(projectRoot, {
      name: "Chapter One",
      content: "The hero crossed the dark forest alone.",
      folderId: "folder-abc",
      status: "Draft",
    });

    const results = await executeSearch(projectRoot, "hero", {}, 50);

    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result.resourceId).toBe(resourceId);
    expect(result.title).toBe("Chapter One");
    expect(result.snippet).toContain("hero");
    expect(result.status).toBe("Draft");
    expect(result.folderId).toBe("folder-abc");
    expect(result.tags).toEqual([]);
  });

  it("returns [] when no resources match the query", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    await addTestResource(projectRoot, {
      name: "Chapter One",
      content: "Apple banana cherry",
    });

    const results = await executeSearch(projectRoot, "elephant", {}, 50);
    expect(results).toHaveLength(0);
  });

  it("returns results ranked by term frequency", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    const idA = await addTestResource(projectRoot, {
      name: "A",
      content: "dragon dragon dragon fights",
    });
    const idB = await addTestResource(projectRoot, {
      name: "B",
      content: "dragon fights",
    });

    const results = await executeSearch(projectRoot, "dragon", {}, 50);
    expect(results[0]!.resourceId).toBe(idA);
    expect(results[1]!.resourceId).toBe(idB);
  });
});

describe("executeSearch — proximity scoring", () => {
  it("ranks phrase matches above scattered term matches for multi-term queries", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    // "tall one" appear adjacent — high proximity score
    const idPhrase = await addTestResource(projectRoot, {
      name: "Phrase",
      content: "The tall one stood by the door.",
    });

    // "tall" and "one" appear in the same document but far apart — low proximity score
    const idScattered = await addTestResource(projectRoot, {
      name: "Scattered",
      content:
        "The tall shadow loomed over the crowd. " +
        "word ".repeat(30) +
        "Every one of them turned.",
    });

    const results = await executeSearch(projectRoot, "tall one", {}, 50);

    expect(results).toHaveLength(2);
    expect(results[0]!.resourceId).toBe(idPhrase);
    expect(results[1]!.resourceId).toBe(idScattered);
  });

  it("ranks a title match above a body-only match", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    // Named after the query — title boost pushes it above body-only matches
    const idTitle = await addTestResource(projectRoot, {
      name: "Dragon Knight",
      content: "A brief chapter.",
    });

    // Body contains the terms repeatedly, but the title is unrelated
    const idBody = await addTestResource(projectRoot, {
      name: "Battle Scene",
      content: "dragon knight dragon knight dragon knight",
    });

    const results = await executeSearch(projectRoot, "dragon knight", {}, 50);
    expect(results).toHaveLength(2);
    expect(results[0]!.resourceId).toBe(idTitle);
  });

  it("falls back to term-freq order when proximity scores are equal", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    // Both have "dragon knight" adjacent, but A has more occurrences
    const idA = await addTestResource(projectRoot, {
      name: "A",
      content: "dragon knight dragon knight dragon knight",
    });
    const idB = await addTestResource(projectRoot, {
      name: "B",
      content: "dragon knight",
    });

    const results = await executeSearch(projectRoot, "dragon knight", {}, 50);
    expect(results[0]!.resourceId).toBe(idA);
    expect(results[1]!.resourceId).toBe(idB);
  });
});

describe("executeSearch — snippet extraction", () => {
  it("snippet comes from the canonical revision content", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    await addTestResource(projectRoot, {
      name: "Preface",
      content: "This book is about courage and the meaning of valor.",
    });

    const results = await executeSearch(projectRoot, "courage", {}, 50);
    expect(results[0]!.snippet).toContain("courage");
  });

  it("snippet is at most 160 characters", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    const longContent = "word ".repeat(100) + "needle " + "word ".repeat(100);
    await addTestResource(projectRoot, {
      name: "Long Doc",
      content: longContent,
    });

    const results = await executeSearch(projectRoot, "needle", {}, 50);
    expect(results[0]!.snippet.length).toBeLessThanOrEqual(160);
  });
});

describe("executeSearch — filters", () => {
  it("filters results by folderId", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    await addTestResource(projectRoot, {
      name: "In Folder",
      content: "the quick brown fox",
      folderId: "folder-1",
    });
    await addTestResource(projectRoot, {
      name: "Root Level",
      content: "the quick brown fox",
      folderId: undefined,
    });

    const results = await executeSearch(
      projectRoot,
      "quick",
      { folder: "folder-1" },
      50,
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("In Folder");
  });

  it("filters results by status", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    await addTestResource(projectRoot, {
      name: "Draft Doc",
      content: "the quick brown fox",
      status: "Draft",
    });
    await addTestResource(projectRoot, {
      name: "Done Doc",
      content: "the quick brown fox",
      status: "Complete",
    });

    const results = await executeSearch(
      projectRoot,
      "quick",
      { status: "Draft" },
      50,
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Draft Doc");
  });

  it("filters results by tag ID", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    const idA = await addTestResource(projectRoot, {
      name: "Tagged",
      content: "the quick brown fox",
    });
    await addTestResource(projectRoot, {
      name: "Untagged",
      content: "the quick brown fox",
    });

    const tag = await createTag(projectRoot, "Scene");
    await assignTagToResource(projectRoot, idA, tag.id);

    const results = await executeSearch(
      projectRoot,
      "quick",
      { tags: [tag.id] },
      50,
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.resourceId).toBe(idA);
    expect(results[0]!.tags).toContain(tag.id);
  });

  it("combines folder, status, and tag filters (all must match)", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    const idMatch = await addTestResource(projectRoot, {
      name: "Match",
      content: "starlight",
      folderId: "f1",
      status: "Draft",
    });
    // Matches folder + status but not tag
    const idNoTag = await addTestResource(projectRoot, {
      name: "No Tag",
      content: "starlight",
      folderId: "f1",
      status: "Draft",
    });
    // Matches tag but not folder
    const idWrongFolder = await addTestResource(projectRoot, {
      name: "Wrong Folder",
      content: "starlight",
      folderId: "f2",
      status: "Draft",
    });

    const tag = await createTag(projectRoot, "Key");
    await assignTagToResource(projectRoot, idMatch, tag.id);
    await assignTagToResource(projectRoot, idWrongFolder, tag.id);

    const results = await executeSearch(
      projectRoot,
      "starlight",
      { folder: "f1", status: "Draft", tags: [tag.id] },
      50,
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.resourceId).toBe(idMatch);

    // Confirm the others were excluded
    const returnedIds = results.map((r) => r.resourceId);
    expect(returnedIds).not.toContain(idNoTag);
    expect(returnedIds).not.toContain(idWrongFolder);
  });
});

describe("executeSearch — result limit", () => {
  it("caps results at the provided limit", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    // Create 3 matching resources
    for (let i = 0; i < 3; i++) {
      await addTestResource(projectRoot, {
        name: `Resource ${i}`,
        content: "common keyword for all",
      });
    }

    const results = await executeSearch(projectRoot, "common", {}, 2);
    expect(results).toHaveLength(2);
  });

  it("returns all results when count is below the limit", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot } = await createTestProject(projectsDir);

    await addTestResource(projectRoot, {
      name: "Only One",
      content: "unique phrase here",
    });

    const results = await executeSearch(projectRoot, "unique", {}, 50);
    expect(results).toHaveLength(1);
  });
});

// ---- GET handler HTTP-level tests ----------------------------------------

describe("GET handler — validation", () => {
  it("returns 400 when q query param is absent", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectId } = await createTestProject(projectsDir);

    const originalEnv = process.env.GETWRITE_PROJECTS_DIR;
    process.env.GETWRITE_PROJECTS_DIR = projectsDir;

    try {
      const req = new NextRequest(
        `http://localhost/api/project/${projectId}/search`,
      );
      const res = await GET(req, {
        params: Promise.resolve({ "project-id": projectId }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/q/i);
    } finally {
      process.env.GETWRITE_PROJECTS_DIR = originalEnv;
    }
  });

  it("returns 400 when q is an empty string", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectId } = await createTestProject(projectsDir);

    const originalEnv = process.env.GETWRITE_PROJECTS_DIR;
    process.env.GETWRITE_PROJECTS_DIR = projectsDir;

    try {
      const req = new NextRequest(
        `http://localhost/api/project/${projectId}/search?q=`,
      );
      const res = await GET(req, {
        params: Promise.resolve({ "project-id": projectId }),
      });
      expect(res.status).toBe(400);
    } finally {
      process.env.GETWRITE_PROJECTS_DIR = originalEnv;
    }
  });

  it("returns 404 when the project ID is unknown", async () => {
    const projectsDir = await makeTmpProjectsDir();

    const originalEnv = process.env.GETWRITE_PROJECTS_DIR;
    process.env.GETWRITE_PROJECTS_DIR = projectsDir;

    try {
      const unknownId = generateUUID();
      const req = new NextRequest(
        `http://localhost/api/project/${unknownId}/search?q=hello`,
      );
      const res = await GET(req, {
        params: Promise.resolve({ "project-id": unknownId }),
      });
      expect(res.status).toBe(404);
    } finally {
      process.env.GETWRITE_PROJECTS_DIR = originalEnv;
    }
  });

  it("respects searchResultLimit from project user preferences via GET", async () => {
    const projectsDir = await makeTmpProjectsDir();
    const { projectRoot, projectId } = await createTestProject(projectsDir, {
      searchResultLimit: 1,
    });

    for (let i = 0; i < 3; i++) {
      await addTestResource(projectRoot, {
        name: `Item ${i}`,
        content: "shared content word",
      });
    }

    const originalEnv = process.env.GETWRITE_PROJECTS_DIR;
    process.env.GETWRITE_PROJECTS_DIR = projectsDir;

    try {
      const req = new NextRequest(
        `http://localhost/api/project/${projectId}/search?q=shared`,
      );
      const res = await GET(req, {
        params: Promise.resolve({ "project-id": projectId }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as unknown[];
      expect(body).toHaveLength(1);
    } finally {
      process.env.GETWRITE_PROJECTS_DIR = originalEnv;
    }
  });
});
