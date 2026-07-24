// Last Updated: 2026-07-23

import { betterAuth } from "better-auth";
import { Pool } from "pg";

/**
 * @module better-auth.config
 *
 * The CLI-only better-auth config, used **exclusively** by the better-auth CLI
 * to generate and apply the Postgres schema (ADR-020, FR3):
 *
 * ```bash
 * # From frontend/, with DATABASE_URL and BETTER_AUTH_SECRET set:
 * npx @better-auth/cli generate --config better-auth.config.ts
 * npx @better-auth/cli migrate  --config better-auth.config.ts
 * ```
 *
 * **Why this file exists at all.** The CLI cannot use `src/lib/auth/auth-server.ts`,
 * for two independent reasons documented in that module's README:
 *
 * 1. It must statically resolve an exported `betterAuth(...)` *value*.
 *    `auth-server.ts` deliberately exports a lazy `getAuthServer()` **function**
 *    so that no `pg.Pool` is ever constructed when hosted auth is inactive
 *    (FR5/FR10 — the desktop build must never attempt a Postgres connection).
 *    The CLI cannot call that function to find the config.
 * 2. `auth-server.ts` imports `server-only`, whose unconditional throw stops the
 *    CLI dead — the CLI runs the config file directly under Node, not through
 *    Next.js's bundler, so the guard fires.
 *
 * So this file constructs the same `betterAuth(...)` eagerly, without the
 * `server-only` guard and without the lazy wrapper. It is never imported by
 * application code — importing it would defeat the lazy-construction guarantee
 * above — and nothing in `app/` or `src/` may reference it.
 *
 * **Only schema-relevant options belong here.** Schema generation reads the
 * options that determine tables and columns; it does not care about runtime
 * behavior. Concretely:
 *
 * - `database` — required; the CLI introspects the live database through it.
 * - `emailAndPassword.enabled` — drives the `account` table's credential columns.
 * - `emailVerification` — the `verification` table.
 * - `rateLimit.storage: "database"` — **this one is load-bearing.** It is what
 *   makes the CLI emit the `rateLimit` table. Omitting it here would produce a
 *   schema that looks complete but silently breaks FR16 rate limiting at
 *   runtime, because `auth-server.ts` sets it and would query a table that
 *   migration never created.
 * - `advanced.database.generateId: "uuid"` — FR6: user ids must be lowercase
 *   UUIDs to satisfy `tenant-path.ts`'s `^[a-z0-9_-]{1,64}$` allowlist.
 *
 * Deliberately **absent**, because they are runtime-only and cannot be imported
 * here anyway (both pull in `server-only`): the `sendVerificationEmail` /
 * `sendResetPassword` SMTP callbacks (`src/lib/auth/email.ts`) and the
 * `databaseHooks.user.create.before` signup allowlist gate
 * (`src/lib/auth/signup-allowlist.ts`). Neither affects the generated schema.
 *
 * **Drift between this file and `auth-server.ts` is the failure mode to fear** —
 * it yields a database whose shape disagrees with the running server. That is
 * why `tests/unit/better-auth-cli-config.test.ts` asserts the schema-relevant
 * options here match the ones `getAuthServer()` builds; if you change either
 * side, that test tells you about the other.
 */

const databaseUrl = process.env.DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET;

if (!databaseUrl || !secret) {
  throw new Error(
    "DATABASE_URL and BETTER_AUTH_SECRET must both be set to run the " +
      "better-auth CLI. This config is for schema generation/migration only; " +
      "see scripts/hosted-smoke/README.md.",
  );
}

export const auth = betterAuth({
  database: new Pool({ connectionString: databaseUrl }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    disableSignUp: false,
  },
  emailVerification: {},
  advanced: { database: { generateId: "uuid" as const } },
  rateLimit: { storage: "database" as const },
  session: { cookieCache: { enabled: true } },
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});
