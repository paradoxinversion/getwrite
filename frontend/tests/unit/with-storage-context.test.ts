/**
 * Unit tests for `withStorageContext` — the tenant-route wrapper's 401/CSRF
 * enforcement added in Slice 6 (FR9, FR10, FR18,
 * `specs/features/auth-provider.md`).
 *
 * `resolveTenant` and `isHostedAuthActive` are mocked so each test can drive
 * the exact `{ userId }` / hosted-auth-active combination it needs without a
 * real database or a real `IdentitySource` resolution chain. `server-only`
 * is mocked because `auth-config.ts` (transitively reachable via the module
 * under test) imports it, and this suite runs outside Next.js's bundler
 * "react-server" condition that normally makes the real package inert on
 * the server.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { resolveTenantMock, isHostedAuthActiveMock } = vi.hoisted(() => ({
  resolveTenantMock: vi.fn(),
  isHostedAuthActiveMock: vi.fn(),
}));
vi.mock("../../app/api/_tenant/resolve-tenant", () => ({
  resolveTenant: resolveTenantMock,
}));
vi.mock("../../src/lib/auth/auth-config", () => ({
  isHostedAuthActive: isHostedAuthActiveMock,
}));

import { withStorageContext } from "../../app/api/_tenant/with-storage-context";
import { getStorageContext } from "../../src/lib/models/storage-context";
import type { StorageAdapter } from "../../src/lib/models/io";

const fakeAdapter = {} as StorageAdapter;

describe("withStorageContext", () => {
  let savedBetterAuthUrl: string | undefined;

  beforeEach(() => {
    savedBetterAuthUrl = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = "https://app.getwrite.example";
    resolveTenantMock.mockReset();
    isHostedAuthActiveMock.mockReset();
  });

  afterEach(() => {
    if (savedBetterAuthUrl === undefined) {
      delete process.env.BETTER_AUTH_URL;
    } else {
      process.env.BETTER_AUTH_URL = savedBetterAuthUrl;
    }
  });

  /** Builds a mock request handler that records whether it was invoked and the active storage context it observed. */
  function buildHandler() {
    const calls: Array<ReturnType<typeof getStorageContext>> = [];
    const handler = vi.fn(async (_request: Request) => {
      calls.push(getStorageContext());
      return new Response("ok", { status: 200 });
    });
    return { handler, calls };
  }

  it("hosted-auth-inactive + null userId: handler runs normally (regression, byte-for-byte)", async () => {
    isHostedAuthActiveMock.mockReturnValue(false);
    resolveTenantMock.mockResolvedValue({
      userId: null,
      dataRoot: "/legacy/projects",
      adapter: fakeAdapter,
    });
    const { handler } = buildHandler();
    const wrapped = withStorageContext(handler);

    const response = await wrapped(new Request("http://localhost/api/x"));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("hosted-auth-active + null userId: returns 401, handler never called", async () => {
    isHostedAuthActiveMock.mockReturnValue(true);
    resolveTenantMock.mockResolvedValue({
      userId: null,
      dataRoot: "/tenants/some-user",
      adapter: fakeAdapter,
    });
    const { handler } = buildHandler();
    const wrapped = withStorageContext(handler);

    const response = await wrapped(new Request("http://localhost/api/x"));

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("hosted-auth-active + non-null userId: handler runs normally", async () => {
    isHostedAuthActiveMock.mockReturnValue(true);
    resolveTenantMock.mockResolvedValue({
      userId: "u-1",
      dataRoot: "/tenants/u-1",
      adapter: fakeAdapter,
    });
    const { handler } = buildHandler();
    const wrapped = withStorageContext(handler);

    const response = await wrapped(new Request("http://localhost/api/x"));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "hosted-auth-active + %s + same-origin Origin: passes, handler runs",
    async (method) => {
      isHostedAuthActiveMock.mockReturnValue(true);
      resolveTenantMock.mockResolvedValue({
        userId: "u-1",
        dataRoot: "/tenants/u-1",
        adapter: fakeAdapter,
      });
      const { handler } = buildHandler();
      const wrapped = withStorageContext(handler);

      const response = await wrapped(
        new Request("http://localhost/api/x", {
          method,
          headers: { origin: "https://app.getwrite.example" },
        }),
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(200);
    },
  );

  it("hosted-auth-active + state-changing method + cross-origin Origin: returns 403, handler never called", async () => {
    isHostedAuthActiveMock.mockReturnValue(true);
    resolveTenantMock.mockResolvedValue({
      userId: "u-1",
      dataRoot: "/tenants/u-1",
      adapter: fakeAdapter,
    });
    const { handler } = buildHandler();
    const wrapped = withStorageContext(handler);

    const response = await wrapped(
      new Request("http://localhost/api/x", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("hosted-auth-active + state-changing method + no Origin/Referer at all: returns 403 (fail-closed)", async () => {
    isHostedAuthActiveMock.mockReturnValue(true);
    resolveTenantMock.mockResolvedValue({
      userId: "u-1",
      dataRoot: "/tenants/u-1",
      adapter: fakeAdapter,
    });
    const { handler } = buildHandler();
    const wrapped = withStorageContext(handler);

    const response = await wrapped(
      new Request("http://localhost/api/x", { method: "DELETE" }),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("hosted-auth-active + GET + cross-origin Origin: passes (CSRF check doesn't apply to safe methods)", async () => {
    isHostedAuthActiveMock.mockReturnValue(true);
    resolveTenantMock.mockResolvedValue({
      userId: "u-1",
      dataRoot: "/tenants/u-1",
      adapter: fakeAdapter,
    });
    const { handler } = buildHandler();
    const wrapped = withStorageContext(handler);

    const response = await wrapped(
      new Request("http://localhost/api/x", {
        method: "GET",
        headers: { origin: "https://evil.example" },
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("hosted-auth-inactive + state-changing method + cross-origin Origin: passes (CSRF check doesn't run when inactive)", async () => {
    isHostedAuthActiveMock.mockReturnValue(false);
    resolveTenantMock.mockResolvedValue({
      userId: null,
      dataRoot: "/legacy/projects",
      adapter: fakeAdapter,
    });
    const { handler } = buildHandler();
    const wrapped = withStorageContext(handler);

    const response = await wrapped(
      new Request("http://localhost/api/x", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("falls back to Referer when Origin is absent and it matches the allowed host", async () => {
    isHostedAuthActiveMock.mockReturnValue(true);
    resolveTenantMock.mockResolvedValue({
      userId: "u-1",
      dataRoot: "/tenants/u-1",
      adapter: fakeAdapter,
    });
    const { handler } = buildHandler();
    const wrapped = withStorageContext(handler);

    const response = await wrapped(
      new Request("http://localhost/api/x", {
        method: "POST",
        headers: { referer: "https://app.getwrite.example/some/page" },
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("rejects a same-host Origin on a different port (FR26/L2: port is part of the origin)", async () => {
    isHostedAuthActiveMock.mockReturnValue(true);
    resolveTenantMock.mockResolvedValue({
      userId: "u-1",
      dataRoot: "/tenants/u-1",
      adapter: fakeAdapter,
    });
    const { handler } = buildHandler();
    const wrapped = withStorageContext(handler);

    // Allowed origin is https://app.getwrite.example (default :443); a different
    // port is a distinct browser origin and must not pass the CSRF check.
    const response = await wrapped(
      new Request("http://localhost/api/x", {
        method: "POST",
        headers: { origin: "https://app.getwrite.example:8443" },
      }),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });
});
