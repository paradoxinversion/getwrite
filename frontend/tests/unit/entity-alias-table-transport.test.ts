// entity-highlighting Task 4: proves `getEntityAliasTable` is wired through
// `createTransport` and resolves to the HTTP transport in a web/desktop
// runtime, hitting the Task 3 route with the expected degrade-gracefully
// behavior — mirrors `tests/unit/mentions-transport.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEntityAliasTable,
  httpEntityAliasTableTransport,
} from "../../src/lib/api/entity-alias-table";

const RUNTIME_ENV = "NEXT_PUBLIC_GETWRITE_RUNTIME";
const originalRuntime = process.env[RUNTIME_ENV];

afterEach(() => {
  if (originalRuntime === undefined) delete process.env[RUNTIME_ENV];
  else process.env[RUNTIME_ENV] = originalRuntime;
  vi.restoreAllMocks();
});

describe("entity alias table transport — web runtime", () => {
  beforeEach(() => {
    delete process.env[RUNTIME_ENV];
  });

  it("getEntityAliasTable calls fetch('/api/project/:id/entity-alias-table') and returns the parsed table", async () => {
    const table = {
      entities: {
        "entity-1": {
          entityId: "entity-1",
          entityKind: "character",
          name: "Elowen",
          aliases: ["El"],
          terms: ["Elowen", "El"],
        },
      },
      claimedBy: {},
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, json: async () => table } as Response);

    const result = await getEntityAliasTable("project-1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/project/project-1/entity-alias-table",
    );
    expect(result).toEqual(table);
  });

  it("getEntityAliasTable resolves to the empty table on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ entities: { ignored: true }, claimedBy: {} }),
    } as Response);

    await expect(getEntityAliasTable("project-1")).resolves.toEqual({
      entities: {},
      claimedBy: {},
    });
  });

  it("getEntityAliasTable resolves to the empty table rather than throwing on a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(getEntityAliasTable("project-1")).resolves.toEqual({
      entities: {},
      claimedBy: {},
    });
  });
});

describe("httpEntityAliasTableTransport", () => {
  it("is the transport object used directly by the resolver in web runtime", () => {
    expect(typeof httpEntityAliasTableTransport.getEntityAliasTable).toBe(
      "function",
    );
  });
});
