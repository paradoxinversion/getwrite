// Last Updated: 2026-08-03

import { describe, it, expect, afterEach } from "vitest";
import {
  EncryptionUnavailableError,
  assertEncryptionAvailable,
  isEncryptionAvailable,
} from "../../src/lib/models/crypto/encryption-availability";
import { enableProjectEncryption } from "../../src/lib/models/crypto/enable-encryption";

const HOSTED_ENV = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;

function activateHostedAuth(): void {
  process.env.DATABASE_URL = "postgres://localhost/getwrite";
  process.env.BETTER_AUTH_SECRET = "a-secret";
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
