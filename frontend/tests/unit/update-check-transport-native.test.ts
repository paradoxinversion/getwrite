// ADR-021 Phase 1 (Task 6, FR7): proves `fetchUpdateCheck` is wired through
// `createTransport` and that its native (Capacitor) path resolves to the
// no-update result without making any HTTP call or invoking the GitHub
// release check.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fetchUpdateCheck } from "../../src/store/update-check-transport-service";

const RUNTIME_ENV = "NEXT_PUBLIC_GETWRITE_RUNTIME";
const originalRuntime = process.env[RUNTIME_ENV];

afterEach(() => {
  if (originalRuntime === undefined) delete process.env[RUNTIME_ENV];
  else process.env[RUNTIME_ENV] = originalRuntime;
  vi.restoreAllMocks();
});

describe("fetchUpdateCheck — web runtime (regression)", () => {
  beforeEach(() => {
    delete process.env[RUNTIME_ENV];
  });

  it("still calls fetch('/api/version-check') exactly as before", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({ updateAvailable: true, latestVersion: "9.9.9" }),
      } as Response);

    const result = await fetchUpdateCheck();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("/api/version-check");
    expect(result).toEqual({ updateAvailable: true, latestVersion: "9.9.9" });
  });

  it("resolves to { updateAvailable: false } on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ updateAvailable: true }),
    } as Response);

    await expect(fetchUpdateCheck()).resolves.toEqual({
      updateAvailable: false,
    });
  });

  it("resolves to { updateAvailable: false } rather than throwing on a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(fetchUpdateCheck()).resolves.toEqual({
      updateAvailable: false,
    });
  });
});

describe("fetchUpdateCheck — native runtime", () => {
  beforeEach(() => {
    process.env[RUNTIME_ENV] = "native";
  });

  it("resolves to { updateAvailable: false } without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await fetchUpdateCheck();

    expect(result).toEqual({ updateAvailable: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("update-check-transport-service.ts — no server-only auth import", () => {
  it("never imports isHostedAuthActive or lib/auth/auth-config", () => {
    const contents = fs.readFileSync(
      path.resolve(
        __dirname,
        "..",
        "..",
        "src",
        "store",
        "update-check-transport-service.ts",
      ),
      "utf8",
    );
    // Strip block/line comments so doc-comment prose doesn't trip this
    // check — only actual code matters here.
    const codeOnly = contents
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(codeOnly).not.toMatch(/isHostedAuthActive/);
    expect(codeOnly).not.toMatch(/auth-config/);
  });
});
