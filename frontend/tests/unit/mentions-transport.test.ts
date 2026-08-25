// ADR-021 Phase 2 (Task 11): proves `getResourceMentions`/`getEntityMentionedIn`
// are wired through `createTransport` and resolve to the HTTP transport in a
// web/desktop runtime, hitting the exact Task 10 routes with the expected
// degrade-gracefully behavior.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getResourceMentions,
  getEntityMentionedIn,
  httpMentionsTransport,
} from "../../src/lib/api/mentions";

const RUNTIME_ENV = "NEXT_PUBLIC_GETWRITE_RUNTIME";
const originalRuntime = process.env[RUNTIME_ENV];

afterEach(() => {
  if (originalRuntime === undefined) delete process.env[RUNTIME_ENV];
  else process.env[RUNTIME_ENV] = originalRuntime;
  vi.restoreAllMocks();
});

describe("mentions transport — web runtime", () => {
  beforeEach(() => {
    delete process.env[RUNTIME_ENV];
  });

  it("getResourceMentions calls fetch('/api/resource/:id/mentions?projectId=...')", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({ mentions: [{ entityId: "e1", name: "Elowen" }] }),
      } as Response);

    const result = await getResourceMentions("project-1", "resource-1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/resource/resource-1/mentions?projectId=project-1",
    );
    expect(result).toEqual([{ entityId: "e1", name: "Elowen" }]);
  });

  it("getResourceMentions resolves to [] on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ mentions: [{ entityId: "e1", name: "Elowen" }] }),
    } as Response);

    await expect(
      getResourceMentions("project-1", "resource-1"),
    ).resolves.toEqual([]);
  });

  it("getResourceMentions resolves to [] rather than throwing on a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(
      getResourceMentions("project-1", "resource-1"),
    ).resolves.toEqual([]);
  });

  it("getEntityMentionedIn calls fetch('/api/resource/:id/mentioned-in?projectId=...')", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          mentionedIn: [
            { resourceId: "r1", name: "Chapter 1", snippets: ["...Elowen..."] },
          ],
        }),
      } as Response);

    const result = await getEntityMentionedIn("project-1", "entity-1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/resource/entity-1/mentioned-in?projectId=project-1",
    );
    expect(result).toEqual([
      { resourceId: "r1", name: "Chapter 1", snippets: ["...Elowen..."] },
    ]);
  });

  it("getEntityMentionedIn resolves to [] on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ mentionedIn: [] }),
    } as Response);

    await expect(
      getEntityMentionedIn("project-1", "entity-1"),
    ).resolves.toEqual([]);
  });

  it("getEntityMentionedIn resolves to [] rather than throwing on a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(
      getEntityMentionedIn("project-1", "entity-1"),
    ).resolves.toEqual([]);
  });
});

describe("httpMentionsTransport", () => {
  it("is the transport object used directly by the resolver in web runtime", () => {
    expect(typeof httpMentionsTransport.getResourceMentions).toBe("function");
    expect(typeof httpMentionsTransport.getEntityMentionedIn).toBe("function");
  });
});
