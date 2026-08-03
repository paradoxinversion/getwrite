// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as io from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { listProjectsCore } from "../../src/lib/models/project-crud-core";
import { KEYRING_FILENAME } from "../../src/lib/models/crypto/keyring-store";

const WORKSPACE = "/ws";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

async function seedProject(id: string): Promise<void> {
  await io.mkdir(`${WORKSPACE}/${id}`, { recursive: true });
  await io.writeFile(
    `${WORKSPACE}/${id}/project.json`,
    JSON.stringify({
      id,
      name: "A Project",
      createdAt: "2026-01-01T00:00:00Z",
    }),
  );
}

describe("listProjectsCore — workspace-root dotfiles", () => {
  const original = io.getStorageAdapter();

  beforeEach(async () => {
    io.setStorageAdapter(createMemoryAdapter());
    await seedProject(PROJECT_ID);
  });

  afterEach(() => {
    io.setStorageAdapter(original);
    vi.restoreAllMocks();
  });

  it("ignores the workspace keyring instead of probing it as a project", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await io.writeFile(
      `${WORKSPACE}/${KEYRING_FILENAME}`,
      JSON.stringify({ version: 1 }),
    );

    const entries = await io.runForTenant(`${WORKSPACE}/${PROJECT_ID}`, () =>
      listProjectsCore(),
    );

    expect(entries).toHaveLength(1);
    // The keyring must not surface as a skipped-project warning on every listing.
    expect(warn).not.toHaveBeenCalled();
  });

  it("still ignores .DS_Store", async () => {
    await io.writeFile(`${WORKSPACE}/.DS_Store`, "");
    const entries = await io.runForTenant(`${WORKSPACE}/${PROJECT_ID}`, () =>
      listProjectsCore(),
    );
    expect(entries).toHaveLength(1);
  });
});
