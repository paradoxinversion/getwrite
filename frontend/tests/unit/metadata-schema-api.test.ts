/**
 * Unit tests for the metadata-schema API route actions.
 *
 * Tests call the underlying `metadata-schema.ts` model functions directly
 * against a real temporary filesystem project — matching the pattern used
 * by `tags-api.test.ts`. The route-level `describe` block below additionally
 * exercises the actual `POST`/`GET` handlers against a `projectId`-scoped
 * `GETWRITE_PROJECTS_DIR`, per the 29-route tenant enforcement feature
 * (Task 4).
 */
// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { removeDirRetry } from "./helpers/fs-utils";
import { describe, it, expect } from "vitest";
import { createProject } from "../../src/lib/models/project";
import { PROJECT_FILENAME } from "../../src/lib/models/project-config";
import { generateUUID } from "../../src/lib/models/uuid";
import {
  addField,
  removeField,
  reorderFields,
  renameField,
  updateFieldOptions,
  addGroup,
  removeGroup,
  reorderGroups,
  updateRefProperties,
} from "../../src/lib/models/metadata-schema";
import type {
  MetadataField,
  MetadataGroup,
  MetadataSchema,
} from "../../src/lib/models/types";

const SLUG_RE = /^[a-z0-9-]+$/;

async function makeTmpProject(schema?: MetadataSchema) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gw-mschema-api-"));
  const proj = createProject({ name: "api-test" });
  const projWithSchema = schema
    ? { ...proj, config: { ...proj.config, metadataSchema: schema } }
    : proj;
  await fs.writeFile(
    path.join(dir, PROJECT_FILENAME),
    JSON.stringify(projWithSchema, null, 2),
    "utf8",
  );
  return { dir };
}

const GROUP_ID = "g1";
const FIELD: MetadataField = {
  key: "my-field",
  label: "My Field",
  type: "text",
};
const LOCKED_FIELD: MetadataField = {
  key: "locked-field",
  label: "Locked",
  type: "text",
  locked: true,
};

function baseSchema(): MetadataSchema {
  return { groups: [{ id: GROUP_ID, label: "Group One", fields: [FIELD] }] };
}

// ---------------------------------------------------------------------------
// Slug validation (route-level guard for user-created fields)
// ---------------------------------------------------------------------------

describe("slug validation (route-level guard)", () => {
  it("accepts valid lowercase-slug keys", () => {
    expect(SLUG_RE.test("my-field")).toBe(true);
    expect(SLUG_RE.test("abc123")).toBe(true);
    expect(SLUG_RE.test("a-b-c")).toBe(true);
  });

  it("rejects camelCase keys", () => {
    expect(SLUG_RE.test("storyDate")).toBe(false);
    expect(SLUG_RE.test("MyField")).toBe(false);
  });

  it("rejects keys with spaces", () => {
    expect(SLUG_RE.test("bad key")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(SLUG_RE.test("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// add-field action
// ---------------------------------------------------------------------------

describe("add-field action", () => {
  it("appends a new field to a group and returns the updated schema", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    const newField: MetadataField = {
      key: "new-field",
      label: "New",
      type: "number",
    };
    const schema = await addField(dir, GROUP_ID, newField);
    expect(schema.groups[0].fields.map((f) => f.key)).toContain("new-field");
  });

  it("returns the full schema in the response", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    const schema = await addField(dir, GROUP_ID, {
      key: "extra",
      label: "Extra",
      type: "boolean",
    });
    expect(schema.groups).toHaveLength(1);
  });

  it("throws (400) when the field key is a bad slug", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(
      addField(dir, GROUP_ID, { key: "BadSlug", label: "Bad", type: "text" }),
    ).rejects.toThrow(/Invalid field key/);
  });

  it("throws (400) when the field key already exists", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(
      addField(dir, GROUP_ID, { key: "my-field", label: "Dup", type: "text" }),
    ).rejects.toThrow(/already exists/);
  });

  it("throws (400) when the group does not exist", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(
      addField(dir, "ghost-group", { key: "x", label: "X", type: "text" }),
    ).rejects.toThrow(/Group not found/);
  });
});

// ---------------------------------------------------------------------------
// remove-field action
// ---------------------------------------------------------------------------

describe("remove-field action", () => {
  it("removes an unlocked field and returns the updated schema", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    const schema = await removeField(dir, GROUP_ID, "my-field");
    expect(schema.groups[0].fields.map((f) => f.key)).not.toContain("my-field");
  });

  it("throws (400) when removing a locked field", async () => {
    const { dir } = await makeTmpProject({
      groups: [{ id: GROUP_ID, label: "G", fields: [FIELD, LOCKED_FIELD] }],
    });
    await expect(removeField(dir, GROUP_ID, "locked-field")).rejects.toThrow(
      /locked/i,
    );
  });

  it("throws when the field does not exist", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(removeField(dir, GROUP_ID, "ghost")).rejects.toThrow(
      /Field not found/,
    );
  });
});

// ---------------------------------------------------------------------------
// reorder-fields action
// ---------------------------------------------------------------------------

describe("reorder-fields action", () => {
  it("reorders fields in the group", async () => {
    const second: MetadataField = {
      key: "second",
      label: "Second",
      type: "date",
    };
    const { dir } = await makeTmpProject({
      groups: [{ id: GROUP_ID, label: "G", fields: [FIELD, second] }],
    });
    const schema = await reorderFields(dir, GROUP_ID, ["second", "my-field"]);
    expect(schema.groups[0].fields.map((f) => f.key)).toEqual([
      "second",
      "my-field",
    ]);
  });

  it("throws when the new order contains unknown keys", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(reorderFields(dir, GROUP_ID, ["unknown"])).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// rename-field action
// ---------------------------------------------------------------------------

describe("rename-field action", () => {
  it("updates the field label and returns the updated schema", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    const schema = await renameField(
      dir,
      GROUP_ID,
      "my-field",
      "Renamed Label",
    );
    const field = schema.groups[0].fields.find((f) => f.key === "my-field");
    expect(field?.label).toBe("Renamed Label");
  });

  it("allows renaming the label of a locked field", async () => {
    const { dir } = await makeTmpProject({
      groups: [{ id: GROUP_ID, label: "G", fields: [FIELD, LOCKED_FIELD] }],
    });
    const schema = await renameField(
      dir,
      GROUP_ID,
      "locked-field",
      "New Label",
    );
    const field = schema.groups[0].fields.find((f) => f.key === "locked-field");
    expect(field?.label).toBe("New Label");
  });

  it("throws when the field does not exist", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(renameField(dir, GROUP_ID, "ghost", "Ghost")).rejects.toThrow(
      /Field not found/,
    );
  });
});

// ---------------------------------------------------------------------------
// update-field-options action
// ---------------------------------------------------------------------------

describe("update-field-options action", () => {
  it("sets options on a select field and returns the updated schema", async () => {
    const selectField: MetadataField = {
      key: "status",
      label: "Status",
      type: "select",
    };
    const { dir } = await makeTmpProject({
      groups: [{ id: GROUP_ID, label: "G", fields: [selectField] }],
    });
    const schema = await updateFieldOptions(dir, GROUP_ID, "status", [
      "Draft",
      "Final",
    ]);
    const field = schema.groups[0].fields.find((f) => f.key === "status");
    expect(field?.options).toEqual(["Draft", "Final"]);
  });

  it("throws when the field does not exist", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(
      updateFieldOptions(dir, GROUP_ID, "ghost", ["x"]),
    ).rejects.toThrow(/Field not found/);
  });
});

// ---------------------------------------------------------------------------
// add-group action
// ---------------------------------------------------------------------------

describe("add-group action", () => {
  it("appends a new group and returns the updated schema", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    const newGroup: MetadataGroup = {
      id: "new-group",
      label: "New Group",
      fields: [],
    };
    const schema = await addGroup(dir, newGroup);
    expect(schema.groups.map((g) => g.id)).toContain("new-group");
  });

  it("throws when the group ID already exists", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(
      addGroup(dir, { id: GROUP_ID, label: "Dup", fields: [] }),
    ).rejects.toThrow(/already exists/);
  });
});

// ---------------------------------------------------------------------------
// remove-group action
// ---------------------------------------------------------------------------

describe("remove-group action", () => {
  it("removes an existing group and returns the updated schema", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    const schema = await removeGroup(dir, GROUP_ID);
    expect(schema.groups.map((g) => g.id)).not.toContain(GROUP_ID);
  });

  it("throws when the group does not exist", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(removeGroup(dir, "ghost-group")).rejects.toThrow(
      /Group not found/,
    );
  });
});

// ---------------------------------------------------------------------------
// reorder-groups action
// ---------------------------------------------------------------------------

describe("reorder-groups action", () => {
  it("reorders groups into the specified order", async () => {
    const schema: MetadataSchema = {
      groups: [
        { id: "alpha", label: "Alpha", fields: [] },
        { id: "beta", label: "Beta", fields: [] },
      ],
    };
    const { dir } = await makeTmpProject(schema);
    const result = await reorderGroups(dir, ["beta", "alpha"]);
    expect(result.groups.map((g) => g.id)).toEqual(["beta", "alpha"]);
  });

  it("throws when the new order contains unknown group IDs", async () => {
    const { dir } = await makeTmpProject(baseSchema());
    await expect(reorderGroups(dir, ["ghost"])).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Built-in camelCase keys round-trip through schema validation
// ---------------------------------------------------------------------------

describe("camelCase built-in key round-trip", () => {
  it("MetadataFieldSchema accepts camelCase keys without throwing", async () => {
    const { MetadataFieldSchema } =
      await import("../../src/lib/models/schemas");
    const result = MetadataFieldSchema.safeParse({
      key: "storyDate",
      label: "Story Date",
      type: "date",
      locked: true,
    });
    expect(result.success).toBe(true);
  });

  it("MetadataFieldSchema accepts storyDuration and storyEndDate", async () => {
    const { MetadataFieldSchema } =
      await import("../../src/lib/models/schemas");
    for (const key of ["storyDuration", "storyEndDate"]) {
      const result = MetadataFieldSchema.safeParse({
        key,
        label: key,
        type: "text",
        locked: true,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// update-ref-properties action
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Route-level: POST/GET /api/project/metadata-schema (projectId-based)
// ---------------------------------------------------------------------------

describe("POST/GET /api/project/metadata-schema (projectId-based)", () => {
  it("resolves projectId to the on-disk project and returns the updated schema", async () => {
    const projectsDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-mschema-route-"),
    );
    const projectId = generateUUID();
    const projectPath = path.join(projectsDir, projectId);
    await fs.mkdir(projectPath, { recursive: true });
    const proj = createProject({ name: "route-test" });
    const projWithSchema = {
      ...proj,
      config: { ...proj.config, metadataSchema: baseSchema() },
    };
    await fs.writeFile(
      path.join(projectPath, PROJECT_FILENAME),
      JSON.stringify(projWithSchema, null, 2),
      "utf8",
    );

    const originalEnv = process.env.GETWRITE_PROJECTS_DIR;
    process.env.GETWRITE_PROJECTS_DIR = projectsDir;
    try {
      const { POST } =
        await import("../../app/api/project/metadata-schema/route");
      const res = await POST(
        new Request("http://localhost/api/project/metadata-schema", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add-field",
            projectId,
            groupId: GROUP_ID,
            field: { key: "route-field", label: "Route Field", type: "text" },
          }),
        }) as never,
      );
      const json = (await res.json()) as { schema: MetadataSchema };
      expect(res.status).toBe(200);
      expect(json.schema.groups[0].fields.map((f) => f.key)).toContain(
        "route-field",
      );
    } finally {
      process.env.GETWRITE_PROJECTS_DIR = originalEnv;
      await removeDirRetry(projectsDir);
    }
  });

  it("returns the uniform 400 when POST projectId is not a well-formed UUID", async () => {
    const projectsDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-mschema-route-"),
    );
    const originalEnv = process.env.GETWRITE_PROJECTS_DIR;
    process.env.GETWRITE_PROJECTS_DIR = projectsDir;
    try {
      const { POST } =
        await import("../../app/api/project/metadata-schema/route");
      const res = await POST(
        new Request("http://localhost/api/project/metadata-schema", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add-field",
            projectId: "../../etc/passwd",
            groupId: GROUP_ID,
            field: { key: "x", label: "X", type: "text" },
          }),
        }) as never,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    } finally {
      process.env.GETWRITE_PROJECTS_DIR = originalEnv;
      await removeDirRetry(projectsDir);
    }
  });

  it("returns the uniform 400 when GET projectId is not a well-formed UUID", async () => {
    const projectsDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gw-mschema-route-"),
    );
    const originalEnv = process.env.GETWRITE_PROJECTS_DIR;
    process.env.GETWRITE_PROJECTS_DIR = projectsDir;
    try {
      const { GET } =
        await import("../../app/api/project/metadata-schema/route");
      const { NextRequest } = await import("next/server");
      const res = await GET(
        new NextRequest(
          "http://localhost/api/project/metadata-schema?projectId=not-a-uuid&fieldKey=status",
        ),
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid projectId");
    } finally {
      process.env.GETWRITE_PROJECTS_DIR = originalEnv;
      await removeDirRetry(projectsDir);
    }
  });
});

describe("updateRefProperties action", () => {
  const REF_FIELD: MetadataField = {
    key: "characters",
    label: "Characters",
    type: "multi-resource-ref",
  };

  function refSchema(): MetadataSchema {
    return {
      groups: [{ id: GROUP_ID, label: "Group One", fields: [REF_FIELD] }],
    };
  }

  it("sets all three ref properties in one call and returns the updated schema", async () => {
    const { dir } = await makeTmpProject(refSchema());
    const schema = await updateRefProperties(dir, GROUP_ID, "characters", {
      refFolder: "folder-abc",
      includeSubfolders: true,
      maxSelections: 3,
    });
    const field = schema.groups[0].fields.find((f) => f.key === "characters");
    expect(field?.refFolder).toBe("folder-abc");
    expect(field?.includeSubfolders).toBe(true);
    expect(field?.maxSelections).toBe(3);
  });

  it("updates only the supplied property, leaving others unchanged", async () => {
    const { dir } = await makeTmpProject({
      groups: [
        {
          id: GROUP_ID,
          label: "G",
          fields: [
            { ...REF_FIELD, refFolder: "original-folder", maxSelections: 5 },
          ],
        },
      ],
    });
    const schema = await updateRefProperties(dir, GROUP_ID, "characters", {
      includeSubfolders: true,
    });
    const field = schema.groups[0].fields.find((f) => f.key === "characters");
    expect(field?.refFolder).toBe("original-folder");
    expect(field?.includeSubfolders).toBe(true);
    expect(field?.maxSelections).toBe(5);
  });

  it("clears a property when null is passed", async () => {
    const { dir } = await makeTmpProject({
      groups: [
        {
          id: GROUP_ID,
          label: "G",
          fields: [
            { ...REF_FIELD, refFolder: "some-folder", maxSelections: 2 },
          ],
        },
      ],
    });
    const schema = await updateRefProperties(dir, GROUP_ID, "characters", {
      refFolder: null,
    });
    const field = schema.groups[0].fields.find((f) => f.key === "characters");
    expect(field?.refFolder).toBeUndefined();
    expect(field?.maxSelections).toBe(2);
  });

  it("throws when the field is locked", async () => {
    const { dir } = await makeTmpProject({
      groups: [
        { id: GROUP_ID, label: "G", fields: [{ ...REF_FIELD, locked: true }] },
      ],
    });
    await expect(
      updateRefProperties(dir, GROUP_ID, "characters", { refFolder: "x" }),
    ).rejects.toThrow(/locked/i);
  });

  it("throws when the field does not exist", async () => {
    const { dir } = await makeTmpProject(refSchema());
    await expect(
      updateRefProperties(dir, GROUP_ID, "ghost", { refFolder: "x" }),
    ).rejects.toThrow(/Field not found/);
  });
});
