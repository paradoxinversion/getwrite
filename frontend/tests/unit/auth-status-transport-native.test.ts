// ADR-021 Phase 1 (Task 6, FR6): proves `fetchAuthStatus` is wired through
// `createTransport` and that its native (Capacitor) path resolves to the
// hardcoded fail-safe default without making any HTTP call — and, critically,
// without delegating to the server-only `isHostedAuthActive()` check.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fetchAuthStatus } from "../../src/store/auth-status-transport-service";

const RUNTIME_ENV = "NEXT_PUBLIC_GETWRITE_RUNTIME";
const originalRuntime = process.env[RUNTIME_ENV];

afterEach(() => {
  if (originalRuntime === undefined) delete process.env[RUNTIME_ENV];
  else process.env[RUNTIME_ENV] = originalRuntime;
  vi.restoreAllMocks();
});

describe("fetchAuthStatus — web runtime (regression)", () => {
  beforeEach(() => {
    delete process.env[RUNTIME_ENV];
  });

  it("still calls fetch('/api/auth-status') exactly as before", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({ hostedAuthActive: true }),
      } as Response);

    const result = await fetchAuthStatus();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("/api/auth-status");
    expect(result).toEqual({ hostedAuthActive: true });
  });
});

describe("fetchAuthStatus — native runtime", () => {
  beforeEach(() => {
    process.env[RUNTIME_ENV] = "native";
  });

  it("resolves to { hostedAuthActive: false } without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await fetchAuthStatus();

    expect(result).toEqual({ hostedAuthActive: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("auth-status-transport-service.ts — no server-only auth import", () => {
  it("never imports isHostedAuthActive or lib/auth/auth-config", () => {
    const contents = fs.readFileSync(
      path.resolve(
        __dirname,
        "..",
        "..",
        "src",
        "store",
        "auth-status-transport-service.ts",
      ),
      "utf8",
    );
    // Strip block/line comments so doc-comment prose describing what NOT to
    // do (which legitimately mentions these identifiers) doesn't trip this
    // check — only actual code matters here.
    const codeOnly = contents
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(codeOnly).not.toMatch(/isHostedAuthActive/);
    expect(codeOnly).not.toMatch(/auth-config/);
  });
});
