# GetWrite

GetWrite is a local-first writing workspace for structured, long-form projects — novels, serials, articles, game docs, and more. There is no database and no cloud: every project, resource, and piece of metadata is a plain file or folder on your own machine, so your work stays inspectable, backup-friendly, and yours.

## Highlights

- **Local-first, no database.** Projects persist as JSON and directory trees under `projects/` — no server, no account, no lock-in. The filesystem _is_ the data model.
- **Structured projects.** Reproducible scaffolding from project-type specs (novel, article, serial, poetry, game documentation, …), each with its own folder layout, metadata fields, and resource templates.
- **Metadata & smart folders.** Per-resource sidecar metadata, a typed query language, and saved queries rendered as smart folders in the resource tree.
- **Revisions built in.** Every resource keeps a versioned snapshot history with a single canonical revision the editor autosaves to.
- **Backlinks & search.** A materialized inverted index and backlinks graph computed on save, powering cross-resource search and reference previews.
- **Desktop app.** Ships as a signed-soon Electron desktop build that bundles the Next.js server — see [why desktop, not web](docs/user/installing.md#why-desktop-not-web).

## Install (desktop app)

GetWrite ships as a desktop app for macOS, Windows, and Linux. Download the
latest build from the [Releases page](https://github.com/saboteur-works/getwrite/releases/latest).

The current builds are **not yet signed by Apple/Microsoft**, so the OS will warn
before the first launch — see **[docs/user/installing.md](docs/user/installing.md)**
for the one-time steps to open it (and a note on [why GetWrite is desktop, not web](docs/user/installing.md#why-desktop-not-web)).

The rest of this README is for developing GetWrite from source.

## Quick links

- Docs: `docs/features` (project types, sidecars, data types)
- Specs examples: `specs/002-define-data-models/project-types/`
- Runtime templates: `getwrite-config/templates/project-types/`
- Frontend source: `frontend/src`

## Requirements

- Node.js >= 24 (we use Volta in CI/dev). If using nvm:

- pnpm (preferred package manager). Install with npm if needed:

```bash
npm install -g pnpm
```

## Setup

1. Install dependencies (repo root):

```bash
pnpm install
```

2. Install frontend workspace dependencies (if working in `frontend` alone):

```bash
cd frontend
pnpm install
```

## Development

- Run frontend unit tests:

```bash
cd frontend
pnpm exec vitest
```

- Run the repo test task (runs frontend tests used by CI):

```bash
pnpm run test
```

- Start a local frontend dev server (when implemented / for app development):

```bash
cd frontend
pnpm run dev
```

## Environment variables

GetWrite reads a small set of environment variables. None are required for the
default local/desktop experience — the app resolves sensible defaults when they
are unset.

| Variable | Purpose |
| --- | --- |
| `GETWRITE_PROJECTS_DIR` | Absolute path to the single-tenant projects directory (the local/desktop store). Injected by the Electron main process; falls back to `<cwd>/../projects` when unset. |
| `GETWRITE_DATA_ROOT` | Hosted multi-tenant only. Base directory under which each signed-in user's isolated data root lives at `<data-root>/<userId>/`. Distinct from `GETWRITE_PROJECTS_DIR` and has **no fallback** — if a request resolves to a signed-in user while this is unset, resolution fails closed rather than leaking into the shared directory. See [ADR-018](docs/architecture/ADRs/adr-018-tenant-resolution-per-user-data-root.md). |
| `GETWRITE_ENABLE_DEV_IDENTITY` | Hosted/dev only. Opt-in flag that activates the **interim** development identity source, which reads a `userId` from the `x-getwrite-dev-user` request header. Inert (no identity asserted) unless set. This is a scaffold for exercising the tenant-resolution path — **not production authentication** — and logs a loud warning when active. |
| `GETWRITE_CLI_TESTING` | Set to `1` to suppress `process.exit` when invoking `getwrite-cli` commands from tests. |

### Hosted authentication (optional)

GetWrite's identity layer is a hybrid: tenant *content* (projects, resources, revisions) always stays on the filesystem/object store, exactly as it does for local/desktop use; *accounts* — credentials, sessions, email verification, password reset — are handled by [better-auth](https://www.better-auth.com/) backed by PostgreSQL, entirely opt-in. See [ADR-020](docs/architecture/ADRs/adr-020-hybrid-auth-postgres-better-auth.md) for the full rationale.

Omitting `DATABASE_URL`/`BETTER_AUTH_SECRET` keeps the instance in **account-free local-first mode**: no Postgres connection is attempted, no login screen is shown, and every route behaves exactly as it does today. Set both to enable hosted auth, both for Saboteur's primary hosted instance and for third-party self-hosters who want multi-user accounts.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Hard prerequisite for hosted auth, alongside `BETTER_AUTH_SECRET` — without both, `isHostedAuthActive()` is `false` and no Postgres connection is attempted. Also backs better-auth's rate-limit *storage* (`rateLimit.storage: "database"`). Note this only stores the counters — for the counters to key on a trustworthy client IP (rather than a spoofable one), you must also set `AUTH_TRUSTED_PROXIES` or `AUTH_IP_ADDRESS_HEADERS` below. |
| `BETTER_AUTH_SECRET` | Secret better-auth uses to sign sessions/tokens. Required alongside `DATABASE_URL` to activate hosted auth. A plain shared environment variable, injected identically into every instance of the hosted service; rotation is a coordinated redeploy with the new value, not a runtime feature. |
| `BETTER_AUTH_URL` | better-auth's `baseURL` — this deployment's own canonical URL. Falls back to `http://localhost:3000` for local development, but real deployments (hosted and self-host) **must set it explicitly, and to an `https://` URL**: better-auth derives the session cookie's `Secure` flag from this protocol, so an `http://` value ships session cookies without `Secure`. Also the source of the allowed `Origin`/`Referer` for the CSRF check on state-changing tenant routes. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | `nodemailer` SMTP transport config for the email-verification and password-reset emails. Any SMTP-compatible provider works. `SMTP_PORT: 465` implies implicit TLS (`secure: true`); other ports use STARTTLS. |
| `AUTH_SIGNUP_ALLOWLIST` | Optional. Gates who may sign up: a comma- and/or newline-separated list of exact emails and/or `@domain.com` wildcards, matched case-insensitively. Unset means open signup. Saboteur's primary hosted instance sets this; self-hosters may leave it open or configure their own policy. |
| `AUTH_TRUSTED_PROXIES` | **Set one of this or `AUTH_IP_ADDRESS_HEADERS` on any internet-facing deployment**, or login rate limiting (FR16) is bypassable by rotating the `x-forwarded-for` header. Comma/newline list of your proxy/load-balancer IPs or CIDR ranges; better-auth strips the forwarded chain to the first hop that isn't one of these to find the real client IP. Unset ⇒ better-auth trusts `x-forwarded-for` verbatim (spoofable) and logs a startup warning. |
| `AUTH_IP_ADDRESS_HEADERS` | Alternative to `AUTH_TRUSTED_PROXIES`. Comma/newline list of headers to read the client IP from instead of `x-forwarded-for` — e.g. a platform's dedicated, client-unforgeable client-IP header (`cf-connecting-ip`, `fly-client-ip`, `true-client-ip`, …). Prefer this when your platform sets such a header. |

## Project structure (high level)

- `frontend/` — Next.js frontend, components, tests, and runtime models
- `getwrite-config/` — example runtime configuration and templates shipped alongside the app
- `specs/` — specification artifacts and example project-type definitions used for docs and tests
- `docs/` — user- and developer-facing documentation (see `docs/features`)
- `cli/` — `getwrite-cli` workspace package; bundled to `cli/dist/bin/getwrite-cli.cjs`

## Runtime models & validation

Key model files live under `frontend/src/lib/models/`:

- `schemas.ts` — Zod runtime schemas and helpers (use `validateProjectType()` / `validateProjectTypeFile()`)
- `project-creator.ts` — scaffolding helper `createProjectFromType()` which validates specs and creates folders/resources
- `sidecar.ts` — read/write helpers for sidecar metadata

See `docs/features` for more detailed docs on project types, sidecars, and data types.

## Adding project-types and templates

- Examples and tests reference `specs/002-define-data-models/project-types/`.
- Runtime-discoverable templates belong in `getwrite-config/templates/project-types/`.
- When adding or changing project-type schemas, update `frontend/src/lib/models/schemas.ts` and add unit tests under `frontend/tests/unit`.

## Tests

- Unit & integration tests run with Vitest in the `frontend` workspace.
- The repository `pnpm run test` target executes the CI test runner for the frontend workspace.

## Contributing

- Open issues and PRs against the `002-define-data-models` branch for data model changes.
- Follow repository standards found under `standards/` (TypeScript implementation, package selection, template integrity).
- Run and update unit tests for any model/schema changes.

## Troubleshooting

- If tests fail due to Node version mismatch, ensure you are running Node v24+.
- Validation errors for project types include Zod error messages — use `validateProjectTypeFile()` locally to inspect problems.

## Where to look next

- `docs/features/project-types.md` — project-type spec guidance
- `docs/features/sidecars.md` — sidecar metadata guidance
- `docs/features/data/data-types.md` — data type reference

## Known Issues

### Resource Tree

- ResourceTree selected item does not update when resource is set from outside of the component
