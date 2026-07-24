/**
 * Unit tests for `getAuthServer()` — the lazily-built, memoized
 * `betterAuth(...)` instance for GetWrite's hosted authentication path
 * (FR1/FR3/FR5/FR6/FR16/FR17, `specs/features/auth-provider.md`).
 *
 * `better-auth` and `pg` are mocked: no real Postgres is available in this
 * test environment, and the point of these tests is to assert (a) that
 * hosted-auth-inactive callers never reach either library at all, and (b)
 * the exact options `betterAuth(...)` is called with when active.
 * `server-only` is mocked for the same reason as in `auth-config.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const {
  betterAuthMock,
  poolMock,
  sendResetPasswordMock,
  sendVerificationEmailMock,
} = vi.hoisted(() => {
  const poolMock = vi.fn(function (this: unknown, options: unknown) {
    Object.assign(this as object, { __poolOptions: options });
  });
  return {
    betterAuthMock: vi.fn((options: unknown) => ({ __options: options })),
    poolMock,
    sendResetPasswordMock: vi.fn(),
    sendVerificationEmailMock: vi.fn(),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("better-auth", () => ({ betterAuth: betterAuthMock }));
vi.mock("pg", () => ({ Pool: poolMock }));
vi.mock("../../src/lib/auth/email", () => ({
  sendResetPassword: sendResetPasswordMock,
  sendVerificationEmail: sendVerificationEmailMock,
}));

import {
  getAuthServer,
  __resetAuthServerForTests,
  AuthServerNotActiveError,
} from "../../src/lib/auth/auth-server";

describe("getAuthServer", () => {
  const ENV_KEYS = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "AUTH_TRUSTED_PROXIES",
    "AUTH_IP_ADDRESS_HEADERS",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    betterAuthMock.mockClear();
    poolMock.mockClear();
    __resetAuthServerForTests();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    __resetAuthServerForTests();
  });

  it("throws AuthServerNotActiveError and never constructs Pool/betterAuth when hosted auth is inactive", () => {
    // No DATABASE_URL/BETTER_AUTH_SECRET set at all — not even a
    // syntactically invalid connection string reaches pg.Pool.
    expect(() => getAuthServer()).toThrow(AuthServerNotActiveError);
    expect(poolMock).not.toHaveBeenCalled();
    expect(betterAuthMock).not.toHaveBeenCalled();
  });

  it("throws the same typed error even when only one of the two required vars is set", () => {
    process.env.DATABASE_URL =
      "postgres://user:pass@localhost:5432/getwrite_dev";
    // BETTER_AUTH_SECRET intentionally left unset.
    expect(() => getAuthServer()).toThrow(AuthServerNotActiveError);
    expect(poolMock).not.toHaveBeenCalled();
    expect(betterAuthMock).not.toHaveBeenCalled();
  });

  describe("when hosted auth is active", () => {
    beforeEach(() => {
      process.env.DATABASE_URL =
        "postgres://user:pass@localhost:5432/getwrite_dev";
      process.env.BETTER_AUTH_SECRET = "test-secret";
    });

    it("constructs the instance without throwing", () => {
      expect(() => getAuthServer()).not.toThrow();
      expect(betterAuthMock).toHaveBeenCalledOnce();
      expect(poolMock).toHaveBeenCalledOnce();
    });

    it("memoizes: returns the same instance on a second call", () => {
      const first = getAuthServer();
      const second = getAuthServer();
      expect(second).toBe(first);
      expect(betterAuthMock).toHaveBeenCalledOnce();
      expect(poolMock).toHaveBeenCalledOnce();
    });

    it("passes advanced.database.generateId: 'uuid' and rateLimit.storage: 'database' to betterAuth()", () => {
      getAuthServer();
      expect(betterAuthMock).toHaveBeenCalledOnce();
      const options = betterAuthMock.mock.calls[0]![0] as {
        advanced: { database: { generateId: unknown } };
        rateLimit: { storage: unknown };
        session: { cookieCache: { enabled: unknown } };
        secret: unknown;
        baseURL: unknown;
      };
      expect(options.advanced.database.generateId).toBe("uuid");
      expect(options.rateLimit.storage).toBe("database");
      expect(options.session.cookieCache.enabled).toBe(true);
      expect(options.secret).toBe("test-secret");
    });

    it("pins a short session cookie-cache maxAge so revocation isn't masked (FR17/M1)", () => {
      getAuthServer();
      const options = betterAuthMock.mock.calls[0]![0] as {
        session: { cookieCache: { maxAge?: number } };
      };
      // Must be well under better-auth's 5-minute (300s) default, or "log out
      // everywhere" is delayed by the stale cookie snapshot (FR26 finding M1).
      const maxAge = options.session.cookieCache.maxAge;
      expect(typeof maxAge).toBe("number");
      expect(maxAge).toBeGreaterThan(0);
      expect(maxAge).toBeLessThanOrEqual(30);
    });

    it("warns and omits advanced.ipAddress when no IP-trust env is set (FR16/H2)", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        getAuthServer();
        const options = betterAuthMock.mock.calls[0]![0] as {
          advanced: { ipAddress?: unknown };
        };
        expect(options.advanced.ipAddress).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("AUTH_TRUSTED_PROXIES"),
        );
      } finally {
        warn.mockRestore();
      }
    });

    it("configures advanced.ipAddress.trustedProxies from AUTH_TRUSTED_PROXIES and does not warn (FR16/H2)", () => {
      process.env.AUTH_TRUSTED_PROXIES = "10.0.0.1, 192.168.0.0/16";
      // https base URL so the M2 insecure-cookie warning doesn't fire either.
      process.env.BETTER_AUTH_URL = "https://getwrite.example.com";
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        getAuthServer();
        const options = betterAuthMock.mock.calls[0]![0] as {
          advanced: {
            ipAddress?: {
              trustedProxies?: string[];
              ipAddressHeaders?: string[];
            };
          };
        };
        expect(options.advanced.ipAddress?.trustedProxies).toEqual([
          "10.0.0.1",
          "192.168.0.0/16",
        ]);
        expect(options.advanced.ipAddress?.ipAddressHeaders).toBeUndefined();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it("configures advanced.ipAddress.ipAddressHeaders from AUTH_IP_ADDRESS_HEADERS (FR16/H2)", () => {
      process.env.AUTH_IP_ADDRESS_HEADERS = "cf-connecting-ip";
      process.env.BETTER_AUTH_URL = "https://getwrite.example.com";
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        getAuthServer();
        const options = betterAuthMock.mock.calls[0]![0] as {
          advanced: { ipAddress?: { ipAddressHeaders?: string[] } };
        };
        expect(options.advanced.ipAddress?.ipAddressHeaders).toEqual([
          "cf-connecting-ip",
        ]);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it("pins an explicit password-length policy (FR26/L3)", () => {
      getAuthServer();
      const options = betterAuthMock.mock.calls[0]![0] as {
        emailAndPassword: {
          minPasswordLength?: number;
          maxPasswordLength?: number;
        };
      };
      expect(options.emailAndPassword.minPasswordLength).toBeGreaterThanOrEqual(
        12,
      );
      expect(options.emailAndPassword.maxPasswordLength).toBeGreaterThan(
        options.emailAndPassword.minPasswordLength ?? 0,
      );
    });

    it("warns when BETTER_AUTH_URL is not https (FR26/M2)", () => {
      process.env.BETTER_AUTH_URL = "http://getwrite.example.com";
      process.env.AUTH_TRUSTED_PROXIES = "10.0.0.1"; // silence the H2 warning
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        getAuthServer();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("is not https"),
        );
      } finally {
        warn.mockRestore();
      }
    });

    it("does not warn about the base URL when BETTER_AUTH_URL is https (FR26/M2)", () => {
      process.env.BETTER_AUTH_URL = "https://getwrite.example.com";
      process.env.AUTH_TRUSTED_PROXIES = "10.0.0.1";
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        getAuthServer();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it("wires the real nodemailer-backed email.ts callbacks (FR14), not a placeholder", () => {
      getAuthServer();
      const options = betterAuthMock.mock.calls[0]![0] as {
        emailAndPassword: { sendResetPassword: unknown };
        emailVerification: { sendVerificationEmail: unknown };
      };
      expect(options.emailAndPassword.sendResetPassword).toBe(
        sendResetPasswordMock,
      );
      expect(options.emailVerification.sendVerificationEmail).toBe(
        sendVerificationEmailMock,
      );
    });

    it("builds the Pool from DATABASE_URL", () => {
      getAuthServer();
      expect(poolMock).toHaveBeenCalledWith({
        connectionString: "postgres://user:pass@localhost:5432/getwrite_dev",
      });
    });

    it("defaults baseURL when BETTER_AUTH_URL is unset", () => {
      getAuthServer();
      const options = betterAuthMock.mock.calls[0]![0] as { baseURL: string };
      expect(options.baseURL).toBe("http://localhost:3000");
    });

    it("uses BETTER_AUTH_URL when configured", () => {
      process.env.BETTER_AUTH_URL = "https://getwrite.example.com";
      getAuthServer();
      const options = betterAuthMock.mock.calls[0]![0] as { baseURL: string };
      expect(options.baseURL).toBe("https://getwrite.example.com");
    });

    it("sets disableSignUp: false and requireEmailVerification: true (FR12/FR15)", () => {
      getAuthServer();
      const options = betterAuthMock.mock.calls[0]![0] as {
        emailAndPassword: {
          disableSignUp: unknown;
          requireEmailVerification: unknown;
        };
      };
      // disableSignUp must stay false: it's an unconditional kill switch
      // that runs before any databaseHooks — true here would make the
      // gate below unreachable (see the module doc's Finding 1 rationale).
      expect(options.emailAndPassword.disableSignUp).toBe(false);
      // requireEmailVerification stays true: this is what makes
      // better-auth's own signup endpoint return a generic synthetic
      // success response (rather than a distinguishing error) for an
      // existing-email signup attempt — satisfying FR15 for signup without
      // any additional custom handling. See auth-server.ts's module doc.
      expect(options.emailAndPassword.requireEmailVerification).toBe(true);
    });

    it("wires databaseHooks.user.create.before as the signup allowlist gate", () => {
      getAuthServer();
      const options = betterAuthMock.mock.calls[0]![0] as {
        databaseHooks: { user: { create: { before: unknown } } };
      };
      expect(typeof options.databaseHooks.user.create.before).toBe("function");
    });

    describe("databaseHooks.user.create.before (signup allowlist gate)", () => {
      let savedAllowlist: string | undefined;

      beforeEach(() => {
        savedAllowlist = process.env.AUTH_SIGNUP_ALLOWLIST;
        delete process.env.AUTH_SIGNUP_ALLOWLIST;
      });

      afterEach(() => {
        if (savedAllowlist === undefined) {
          delete process.env.AUTH_SIGNUP_ALLOWLIST;
        } else {
          process.env.AUTH_SIGNUP_ALLOWLIST = savedAllowlist;
        }
      });

      function getBeforeHook(): (user: {
        email: string;
      }) => Promise<boolean | void> {
        // Reset the memoized instance so a per-test env change (e.g. a
        // different AUTH_SIGNUP_ALLOWLIST value) is observed on this call
        // rather than returning a stale, already-memoized instance.
        __resetAuthServerForTests();
        getAuthServer();
        const lastCallIndex = betterAuthMock.mock.calls.length - 1;
        const options = betterAuthMock.mock.calls[lastCallIndex]![0] as {
          databaseHooks: {
            user: {
              create: {
                before: (user: { email: string }) => Promise<boolean | void>;
              };
            };
          };
        };
        return options.databaseHooks.user.create.before;
      }

      it("allows any email when no allowlist is configured (open signup default)", async () => {
        const before = getBeforeHook();
        await expect(
          before({ email: "anyone@example.com" }),
        ).resolves.toBeUndefined();
      });

      it("allows an exact-match email and rejects a non-matching one", async () => {
        process.env.AUTH_SIGNUP_ALLOWLIST = "founder@getwrite.dev";
        const before = getBeforeHook();
        await expect(
          before({ email: "founder@getwrite.dev" }),
        ).resolves.toBeUndefined();
        await expect(before({ email: "stranger@example.com" })).resolves.toBe(
          false,
        );
      });

      it("allows any email at an allowlisted domain wildcard and rejects others", async () => {
        process.env.AUTH_SIGNUP_ALLOWLIST = "@saboteur.dev";
        const before = getBeforeHook();
        await expect(
          before({ email: "anyone@saboteur.dev" }),
        ).resolves.toBeUndefined();
        await expect(before({ email: "anyone@other.dev" })).resolves.toBe(
          false,
        );
      });

      it("matches case-insensitively in both directions", async () => {
        process.env.AUTH_SIGNUP_ALLOWLIST = "Founder@GetWrite.dev";
        const before = getBeforeHook();
        await expect(
          before({ email: "founder@getwrite.dev" }),
        ).resolves.toBeUndefined();

        process.env.AUTH_SIGNUP_ALLOWLIST = "@Saboteur.dev";
        const before2 = getBeforeHook();
        await expect(
          before2({ email: "SOMEONE@saboteur.dev" }),
        ).resolves.toBeUndefined();
      });
    });
  });
});
