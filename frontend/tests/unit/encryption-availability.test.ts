// Last Updated: 2026-08-03

import { describe, it, expect, afterEach, vi } from "vitest";

// A signed-in hosted user, so the request reaches the handler rather than
// stopping at the wrapper's 401.
vi.mock("../../app/api/_tenant/resolve-tenant", async (importOriginal) => {
  const { createMemoryAdapter } =
    await import("../../src/lib/models/memoryAdapter");
  return {
    ...(await importOriginal<
      typeof import("../../app/api/_tenant/resolve-tenant")
    >()),
    resolveTenant: vi.fn(async () => ({
      userId: "user-1",
      dataRoot: "/ws",
      adapter: createMemoryAdapter(),
    })),
  };
});
import {
  EncryptionUnavailableError,
  assertEncryptionAvailable,
  isEncryptionAvailable,
} from "../../src/lib/models/crypto/encryption-availability";
import { enableProjectEncryption } from "../../src/lib/models/crypto/enable-encryption";

const HOSTED_ENV = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
] as const;

function activateHostedAuth(): void {
  process.env.DATABASE_URL = "postgres://localhost/getwrite";
  process.env.BETTER_AUTH_SECRET = "a-secret";
  // The route's CSRF gate compares a request's Origin against this. Without it
  // a state-changing request is rejected as cross-site, and the encryption
  // guard below it would never be reached.
  process.env.BETTER_AUTH_URL = "http://localhost";
}

afterEach(() => {
  for (const key of HOSTED_ENV) delete process.env[key];
});

describe("encryption availability", () => {
  it("is available on desktop and native, where hosted auth is absent", () => {
    expect(isEncryptionAvailable()).toBe(true);
    expect(() => assertEncryptionAvailable()).not.toThrow();
  });

  it("is unavailable once hosted auth is active", () => {
    activateHostedAuth();
    // FR23: offering it here would mean a padlock whose key the server holds.
    expect(isEncryptionAvailable()).toBe(false);
    expect(() => assertEncryptionAvailable()).toThrow(
      EncryptionUnavailableError,
    );
  });

  it("needs both hosted-auth variables before it disables anything", () => {
    process.env.DATABASE_URL = "postgres://localhost/getwrite";
    expect(isEncryptionAvailable()).toBe(true);
  });

  it("refuses to enable encryption on a hosted deployment", async () => {
    activateHostedAuth();
    // Server-side, not a hidden button: the code path itself is closed.
    await expect(
      enableProjectEncryption({
        projectId: "11111111-1111-4111-8111-111111111111",
        projectName: "The Whistleblower",
        passphrase: "correct horse battery staple",
      }),
    ).rejects.toBeInstanceOf(EncryptionUnavailableError);
  });
});

describe("POST /api/encryption fails closed on hosted", () => {
  /**
   * Posts an action to the encryption route as a *signed-in* hosted user.
   *
   * The identity matters. `withStorageContext` rejects an anonymous hosted
   * request with a 401 before any handler runs, so a test that skipped this
   * would pass whether or not the route guards itself — it would only be
   * observing the auth gate. Mocking the tenant, and satisfying the CSRF check,
   * is what puts the request *inside* the handler where the guard has to hold.
   *
   * @param body - The action payload.
   * @returns The route's response.
   */
  async function post(body: unknown): Promise<Response> {
    const { POST } = await import("../../app/api/encryption/route");
    return POST(
      new Request("http://localhost/api/encryption", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
      }),
    );
  }

  // `enable` guarded itself, so only it was ever closed. The rest ran happily:
  // `unlock` derives a workspace key and opens server-side session state, and
  // `export` writes an entire plaintext project — on a deployment whose own
  // GET reports the feature unavailable (FR23).
  for (const action of ["unlock", "lock", "resume", "export"]) {
    it(`refuses "${action}"`, async () => {
      activateHostedAuth();
      const response = await post({
        action,
        passphrase: "correct horse battery staple",
        projectId: "11111111-1111-4111-8111-111111111111",
      });

      expect(response.status).toBe(403);
      expect((await response.json()).error).toMatch(/not available/i);
    });
  }
});
