/**
 * Unit tests for `/api/auth/[...all]` — the better-auth catch-all route
 * handler (FR1, `specs/features/auth-provider.md`).
 *
 * `isHostedAuthActive`, `getAuthServer`, and `toNextJsHandler` are all
 * mocked: no real Postgres or better-auth instance is involved. The tests
 * assert (a) the inactive path never reaches `getAuthServer`/
 * `toNextJsHandler` and responds 404, and (b) the active path delegates to
 * `toNextJsHandler(getAuthServer())`'s corresponding method.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  isHostedAuthActiveMock,
  getAuthServerMock,
  toNextJsHandlerMock,
  mountedHandlers,
} = vi.hoisted(() => {
  const mountedHandlers = {
    GET: vi.fn(async () => new Response("get-ok")),
    POST: vi.fn(async () => new Response("post-ok")),
    PATCH: vi.fn(async () => new Response("patch-ok")),
    PUT: vi.fn(async () => new Response("put-ok")),
    DELETE: vi.fn(async () => new Response("delete-ok")),
  };
  return {
    isHostedAuthActiveMock: vi.fn(),
    getAuthServerMock: vi.fn(() => ({ __fakeAuthInstance: true })),
    toNextJsHandlerMock: vi.fn(() => mountedHandlers),
    mountedHandlers,
  };
});

vi.mock("../../src/lib/auth/auth-config", () => ({
  isHostedAuthActive: isHostedAuthActiveMock,
}));
vi.mock("../../src/lib/auth/auth-server", () => ({
  getAuthServer: getAuthServerMock,
}));
vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: toNextJsHandlerMock,
}));

import {
  GET,
  POST,
  PATCH,
  PUT,
  DELETE,
} from "../../app/api/auth/[...all]/route";

function req(method: string) {
  return new Request("https://getwrite.example.com/api/auth/sign-in", {
    method,
  });
}

function signupReq(body: Record<string, unknown>) {
  return new Request("https://getwrite.example.com/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  isHostedAuthActiveMock.mockReset();
  getAuthServerMock.mockClear();
  toNextJsHandlerMock.mockClear();
  for (const fn of Object.values(mountedHandlers)) fn.mockClear();
});

describe("when hosted auth is inactive", () => {
  beforeEach(() => {
    isHostedAuthActiveMock.mockReturnValue(false);
  });

  it("GET returns 404 without calling getAuthServer/toNextJsHandler", async () => {
    const res = await GET(req("GET"));
    expect(res.status).toBe(404);
    expect(getAuthServerMock).not.toHaveBeenCalled();
    expect(toNextJsHandlerMock).not.toHaveBeenCalled();
  });

  it("POST returns 404 without calling getAuthServer/toNextJsHandler", async () => {
    const res = await POST(req("POST"));
    expect(res.status).toBe(404);
    expect(getAuthServerMock).not.toHaveBeenCalled();
    expect(toNextJsHandlerMock).not.toHaveBeenCalled();
  });

  it("PATCH/PUT/DELETE all return 404 without touching better-auth machinery", async () => {
    for (const [method, handler] of [
      ["PATCH", PATCH],
      ["PUT", PUT],
      ["DELETE", DELETE],
    ] as const) {
      const res = await handler(req(method));
      expect(res.status).toBe(404);
    }
    expect(getAuthServerMock).not.toHaveBeenCalled();
    expect(toNextJsHandlerMock).not.toHaveBeenCalled();
  });
});

describe("when hosted auth is active", () => {
  beforeEach(() => {
    isHostedAuthActiveMock.mockReturnValue(true);
  });

  it("GET delegates to toNextJsHandler(getAuthServer()).GET", async () => {
    const res = await GET(req("GET"));
    expect(getAuthServerMock).toHaveBeenCalledOnce();
    expect(toNextJsHandlerMock).toHaveBeenCalledWith({
      __fakeAuthInstance: true,
    });
    expect(mountedHandlers.GET).toHaveBeenCalledOnce();
    await expect(res.text()).resolves.toBe("get-ok");
  });

  it("POST delegates to toNextJsHandler(getAuthServer()).POST", async () => {
    const res = await POST(req("POST"));
    expect(mountedHandlers.POST).toHaveBeenCalledOnce();
    await expect(res.text()).resolves.toBe("post-ok");
  });

  it("PATCH/PUT/DELETE each delegate to the corresponding mounted method", async () => {
    await PATCH(req("PATCH"));
    await PUT(req("PUT"));
    await DELETE(req("DELETE"));
    expect(mountedHandlers.PATCH).toHaveBeenCalledOnce();
    expect(mountedHandlers.PUT).toHaveBeenCalledOnce();
    expect(mountedHandlers.DELETE).toHaveBeenCalledOnce();
  });

  describe("signup anti-enumeration (FR26/L1)", () => {
    it("masks a non-allowlisted rejection (400 FAILED_TO_CREATE_USER) as a generic 200", async () => {
      mountedHandlers.POST.mockResolvedValueOnce(
        Response.json(
          { code: "FAILED_TO_CREATE_USER", message: "failed" },
          { status: 400 },
        ),
      );
      const res = await POST(
        signupReq({
          email: "NOPE@Blocked.test",
          name: "N",
          password: "x".repeat(12),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        token: unknown;
        user: Record<string, unknown>;
      };
      expect(body.token).toBeNull();
      // Same shape better-auth returns for an already-registered email, so the
      // two are indistinguishable; email is normalized like a real signup.
      expect(body.user.email).toBe("nope@blocked.test");
      expect(body.user.emailVerified).toBe(false);
      expect(Object.keys(body.user).sort()).toEqual([
        "createdAt",
        "email",
        "emailVerified",
        "id",
        "image",
        "name",
        "updatedAt",
      ]);
    });

    it("does NOT mask other signup 400s (e.g. password too short)", async () => {
      mountedHandlers.POST.mockResolvedValueOnce(
        Response.json({ code: "PASSWORD_TOO_SHORT" }, { status: 400 }),
      );
      const res = await POST(
        signupReq({ email: "a@allowed.test", password: "short" }),
      );
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe(
        "PASSWORD_TOO_SHORT",
      );
    });

    it("passes a successful signup through unchanged", async () => {
      mountedHandlers.POST.mockResolvedValueOnce(
        Response.json(
          { token: null, user: { id: "real-user" } },
          { status: 200 },
        ),
      );
      const res = await POST(
        signupReq({ email: "a@allowed.test", password: "x".repeat(12) }),
      );
      expect(res.status).toBe(200);
      expect(((await res.json()) as { user: { id: string } }).user.id).toBe(
        "real-user",
      );
    });

    it("only masks the signup path — a 400 FAILED_TO_CREATE_USER elsewhere is untouched", async () => {
      mountedHandlers.POST.mockResolvedValueOnce(
        Response.json({ code: "FAILED_TO_CREATE_USER" }, { status: 400 }),
      );
      const res = await POST(req("POST")); // sign-in path, not sign-up
      expect(res.status).toBe(400);
    });
  });
});
