/**
 * Drift guard between the CLI-only better-auth config (`frontend/better-auth.config.ts`,
 * used solely by `@better-auth/cli` to generate/apply the Postgres schema) and the
 * runtime server config (`getAuthServer()` in `src/lib/auth/auth-server.ts`).
 *
 * The two files must construct the same *schema-relevant* better-auth options,
 * because the CLI config decides what tables/columns exist and the runtime config
 * decides what the running server reads and writes. If they disagree, migration
 * produces a database whose shape the server does not match — the exact failure
 * this test exists to prevent (e.g. `rateLimit.storage: "database"` present in one
 * but not the other yields a server that queries a `rateLimit` table migration
 * never created). See `better-auth.config.ts`'s module doc.
 *
 * `better-auth`/`pg`/`server-only` are mocked for the same reasons as
 * `auth-server.test.ts`: no real Postgres here, and we only want the options
 * objects each side hands to `betterAuth(...)`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { betterAuthMock, poolMock } = vi.hoisted(() => ({
  betterAuthMock: vi.fn((options: unknown) => ({ __options: options })),
  poolMock: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("better-auth", () => ({ betterAuth: betterAuthMock }));
vi.mock("pg", () => ({ Pool: poolMock }));
vi.mock("../../src/lib/auth/email", () => ({
  sendResetPassword: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

interface CapturedOptions {
  emailAndPassword?: { enabled?: boolean; requireEmailVerification?: boolean };
  emailVerification?: unknown;
  advanced?: { database?: { generateId?: unknown } };
  rateLimit?: { storage?: unknown };
  session?: { cookieCache?: { enabled?: boolean } };
}

/** The subset of options that determines the generated schema. */
function schemaRelevant(options: CapturedOptions) {
  return {
    emailEnabled: options.emailAndPassword?.enabled,
    requireEmailVerification:
      options.emailAndPassword?.requireEmailVerification,
    hasEmailVerification: options.emailVerification !== undefined,
    generateId: options.advanced?.database?.generateId,
    rateLimitStorage: options.rateLimit?.storage,
    cookieCacheEnabled: options.session?.cookieCache?.enabled,
  };
}

describe("better-auth CLI config vs runtime server config", () => {
  const saved: Record<string, string | undefined> = {};
  const KEYS = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];

  beforeEach(() => {
    for (const key of KEYS) saved[key] = process.env[key];
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/db";
    process.env.BETTER_AUTH_SECRET = "test-secret-value-0123456789";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    betterAuthMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  async function cliConfigOptions(): Promise<CapturedOptions> {
    const mod = (await import("../../better-auth.config")) as unknown as {
      auth: { __options: CapturedOptions };
    };
    return mod.auth.__options;
  }

  async function serverConfigOptions(): Promise<CapturedOptions> {
    const mod = await import("../../src/lib/auth/auth-server");
    mod.__resetAuthServerForTests();
    const instance = mod.getAuthServer() as unknown as {
      __options: CapturedOptions;
    };
    return instance.__options;
  }

  it("constructs identical schema-relevant options on both sides", async () => {
    const cli = schemaRelevant(await cliConfigOptions());
    const server = schemaRelevant(await serverConfigOptions());
    expect(cli).toEqual(server);
  });

  it("declares database-backed rate limiting so the rateLimit table is emitted", async () => {
    // Load-bearing: without this the CLI omits the rateLimit table and FR16
    // rate limiting queries a table migration never created.
    const cli = await cliConfigOptions();
    expect(cli.rateLimit?.storage).toBe("database");
  });

  it("mints uuid user ids to satisfy the tenant-path allowlist (FR6)", async () => {
    const cli = await cliConfigOptions();
    expect(cli.advanced?.database?.generateId).toBe("uuid");
  });

  it("throws when the required env is absent (CLI cannot run without it)", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;
    vi.resetModules();
    await expect(import("../../better-auth.config")).rejects.toThrow(
      /DATABASE_URL and BETTER_AUTH_SECRET/,
    );
  });
});
