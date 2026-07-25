# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GetWrite** is a local-first, file-system backed writing workspace. There is no database—projects, resources, and metadata persist as JSON files and directory structures under `/projects` at the repo root. The stack is Next.js (App Router), React 19, Redux Toolkit, TipTap editor, and Zod for validation. It ships both as a hosted Next.js app and as a desktop Electron app that bundles the Next.js standalone server.

## Workspace Layout

This is a pnpm workspace (pnpm@10.28.0, pinned). `pnpm-workspace.yaml` lists four packages:

- `frontend/` — `getwrite-frontend`. The Next.js app, Redux store, Zod models, Storybook, and all UI tests.
- `electron/` — `getwrite-electron`. Desktop shell that spawns the Next.js standalone server and opens a `BrowserWindow`.
- `cli/` — `getwrite-cli`. Standalone CLI tools bundled separately with esbuild.
- `android/` — `getwrite-android`. Capacitor Android sibling shell (ADR-021, Phase 0 walking skeleton); `pnpm --filter getwrite-android build` is currently a scaffold placeholder, not a real Gradle build.

Additional repo-root directories that are **not** workspace packages but are referenced at runtime:

- `projects/` — On-disk project store (one folder per project; UUID-named).
- `getwrite-config/templates/project-types/` — JSON specs for the built-in project types (`article`, `blank`, `game_documentation`, `novel`, `poetry_and_lyrics`, `serial`) plus `project-type.schema.json`.
- `specs/` — Numbered feature specs (`001-…` through `005-…`) that drive larger work; per the authority hierarchy, specs win conflicts.
- `docs/standards/` — Coding/testing standards (see below).
- `scripts/` — Repo-level scripts (currently `showcase`).
- `electron/electron-builder.yml` — Packaging config for the desktop build.

Repo-root scripts (run from the repo root):

```bash
pnpm start            # alias for: pnpm --filter getwrite-frontend dev
pnpm electron:dev     # tsc + electron dist/main.js (electron workspace)
pnpm electron:build   # build frontend + electron
pnpm electron:package # electron-builder
pnpm storybook        # frontend storybook
pnpm knip             # dead-code / unused export check
```

**Next.js DevTools MCP**: when a task involves running, debugging, or modifying the Next.js app itself (dev server, App Router routing, server components, build config, caching), call the `init` tool from `next-devtools` first. Skip it for tasks that only touch unrelated files (CLI, models, Electron, docs).

## Development Commands

Run from `frontend/` unless noted. Node version managed by Volta.

```bash
pnpm dev        # Dev server
pnpm typecheck  # tsc --noEmit
pnpm lint       # ESLint
pnpm build      # next build
pnpm test       # Vitest (watch)
pnpm test:ci    # Vitest (single pass)
pnpm test:e2e   # Playwright — requires pnpm storybook on :6006
```

From the repo root: `pnpm --filter getwrite-frontend exec vitest` runs frontend tests via the workspace.

## Architecture

### Data Layer (No Database)

- **Storage**: `projects/` at the repo root contains one UUID-named folder per project. Each project directory contains:
  - `project.json` — top-level project manifest
  - `resources/<uuid>/` — one folder per text resource with `content.txt` + `content.tiptap.json`
  - `folders/` — folder-tree state for the resource tree
  - `meta/resource-<uuid>.meta.json` — per-resource sidecar metadata
  - `meta/index/` — materialized indexes (inverted index, backlinks, field values)
  - `meta/queries/` — saved queries used by smart folders
  - `meta/templates/` — resource template scaffolds
  - `revisions/<uuid>/v-<N>/` — versioned snapshots per resource
  - `.trash/{resources,meta}/` — soft-deleted content (see [Glossary: Trash](#glossary))
- **API routes** (`frontend/app/api/`): Read/write the filesystem directly. Top-level groups: `projects`, `project/*` (id, delete, rename, tags, preferences, editor-config, metadata-schema, revision-settings, query, features), `project-resources`, `project-types`, `resource/*` (id, revision, upload), `compile`, `export`, `version-check` (Electron update check), `auth/[...all]` (better-auth catch-all — sign-up/in/out, session, verification, password reset; hosted-auth-only, 404s when inactive), `auth-status` (client-facing `isHostedAuthActive()` signal, presentational only). Project-scoped routes resolve their project root as `path.join(resolveProjectsDir(), projectId)` from a server-validated `projectId` (`frontend/src/lib/models/project-path.ts`) — they do not accept a client-supplied `projectRoot`/`projectPath`. See `docs/standards/storage-context.md`.
- **Schemas** (`frontend/src/lib/models/schemas.ts`): Zod validators gate all persisted data crossing the filesystem boundary
- **File locking**: `frontend/src/lib/models/locks.ts` is a generic per-key async mutex; `meta-locks.ts` serializes metadata-affecting operations keyed by project root

### State Management

Redux Toolkit slices mirror filesystem state into the UI:

- `projectsSlice` — active project selection and metadata
- `resourcesSlice` — resources and folder hierarchy
- `revisionsSlice` — revision/version history
- `editorConfigSlice` — per-project editor configuration
- `querySlice` — saved queries and query execution state
- `searchSlice` — cross-resource search state

State is loaded on mount via `GET /api/projects` and updated explicitly via API calls. There is no optimistic or auto-sync layer.

### Frontend Structure

```
frontend/
  app/                   # Next.js App Router (pages + API routes)
  components/            # Feature-organized React components
    Layout/              # AppShell + shell controllers
    Auth/                # Login/signup/verify/reset UI (hosted auth only)
    Editor/              # TipTap rich text editor (+ TipTapEditor.tsx entry)
    ResourceTree/        # Tree, context menu, create/rename modals, SmartFolders
    WorkArea/            # EditView / DataView / DiffView + Views/{Organizer,Timeline}
    SearchBar/ Sidebar/ Start/ Timeline/ QueryBuilder/ SchemaManager/
    common/              # Shared modals & dialogs
    help/ notifications/ preferences/ project-types/
  src/
    lib/models/          # Filesystem-backed data layer (see Code Map)
    store/               # Redux store and slices
  tests/                 # Vitest unit + integration tests
  e2e/                   # Playwright tests (run against Storybook)
```

### Code Map

All paths relative to `frontend/src/`. Use these as orientation; open the files directly for details.

**Models (`lib/models/`)** — boundary between filesystem and the rest of the app.

- *Validation & types*: `schemas.ts`, `types.ts`
- *Projects*: `project.ts` (create/validate/normalize), `project-creator.ts`, `project-loader.ts`, `project-config.ts`, `project-features.ts` (per-project feature flags), `projects-dir.ts`, `project-path.ts` (`validateProjectId`/`respondInvalidProjectId` — UUID-validated, fail-closed guard API routes use to derive a project's on-disk directory from a client-supplied `projectId`), `project-view.ts`, `project-view-adapter.ts`
- *Resources & templates*: `resource.ts`, `resource-factory.ts`, `resource-persistence.ts`, `resource-revision.ts` (initial canonical revision), `resource-templates.ts`, `template-service.ts`, `sidecar.ts`, `trash.ts`, `folder-utils.ts`
- *Media*: `media-metadata.ts` (image/audio metadata at ingest), `media-validation.ts` (type + size-cap checks)
- *Revisions*: `revision.ts`, `revision-manager.ts`, `revision-settings.ts`, `pruneExecutor.ts`
- *Metadata & tags*: `metadata-schema.ts`, `default-metadata-schema.ts`, `tags.ts`
- *Query pipeline*: `query-ast.ts`, `query-evaluator.ts`, `query-cache.ts`, `query-intrinsics.ts`, `saved-queries.ts`
- *Index & search*: `indexer-queue.ts`, `inverted-index.ts`, `backlinks.ts`, `backlinks-watcher.ts`, `field-values.ts`, `field-value-keys.ts`, `field-dedup.ts`, `previews.ts`, `search-scoring.ts`, `search-snippet.ts`
- *I/O*: `io.ts` (StorageAdapter over `fs/promises`), `memoryAdapter.ts` (in-memory adapter for tests), `object-store.ts` + `objectStoreAdapter.ts` (flat object-store backend selectable per request via `app/api/_tenant/storage-backend.ts`; ADR-019), `storage-context.ts` (`AsyncLocalStorage`-backed request/task-scoped `{ tenantRoot, adapter }`, plus a module-scoped default fallback for the native build; see `docs/standards/storage-context.md`)
- *Update check*: `update-check.ts` (compares running version to latest GitHub release)
- *Concurrency*: `locks.ts`, `meta-locks.ts`
- *Native (Android, ADR-021 Phase 0)*: `capacitor-filesystem.ts` (in-memory fake `CapacitorFilesystemLike`), `capacitor-filesystem-real.ts` (real `@capacitor/filesystem` bridge to the same contract; native-only, dynamic-import-only), `capacitorFsAdapter.ts` (`StorageAdapter` over either), `native-bootstrap.ts` (`bootstrapNativeStorageContext()` — one-time app-startup binding of the real bridge as the default `StorageContext`), `native-device-harness.ts` (manual, code-only on-device verification harness; not wired into any UI)

**Auth (`lib/auth/`)** — server-only hosted-authentication path (better-auth + PostgreSQL; opt-in, hosted-only; see [ADR-020](docs/architecture/ADRs/adr-020-hybrid-auth-postgres-better-auth.md)). `auth-config.ts` (`isHostedAuthActive()` — single source of truth for whether `DATABASE_URL` + `BETTER_AUTH_SECRET` are both set), `auth-server.ts` (lazily-built, memoized `betterAuth(...)` instance), `email.ts` (`nodemailer` SMTP transport wired into verification/reset callbacks), `signup-allowlist.ts` (`AUTH_SIGNUP_ALLOWLIST` gate consulted by a `databaseHooks.user.create.before` hook, not `disableSignUp`), `session-guard.ts` (`shouldRedirectToLogin` — the decision core behind the `(app)` route-group layout's page redirect), `verify-email-core.ts` (server-side `/verify-email` token consumption). `auth-client.ts` (client-side `better-auth/react` wrapper) and `use-auth-session.ts` (`useAuthSession()` — the combined hosted-active + authenticated signal UI components read) are the client-safe counterparts in the same directory. Desktop/local never configures the hosted-auth env, so none of this runs and no Postgres connection is ever attempted (`GETWRITE_ENABLE_DEV_IDENTITY` remains the mechanism for exercising tenant resolution locally without hosted auth — see the Store's `auth-status-transport-service` note and `docs/standards/storage-context.md`).

**Store (`store/`)** — Redux Toolkit. Pattern per feature: `<feature>Slice.ts` + `*-transport-service.ts` (HTTP) + `*-guards.ts` (invariants).

- *Slices*: `projectsSlice`, `resourcesSlice`, `revisionsSlice`, `editorConfigSlice`, `querySlice`, `searchSlice`
- *Transports*: `revision-transport-service`, `query-transport-service`, `search-transport-service`, `metadata-schema-transport-service`, `feature-config-transport-service` (per-project feature flags), `update-check-transport-service` (Electron update notice), `auth-status-transport-service` (fetches `GET /api/auth-status`; fail-safe `{ hostedAuthActive: false }` on any error)
- *Guards & normalizers*: `revision-canonical-guards` (single-canonical invariant), `queries-guards`, `revision-normalization`
- *Controllers*: `project-actions-controller` (multi-step project ops)
- *Plumbing*: `store.ts`, `ClientProvider.tsx`, `hooks.ts` (typed `useAppDispatch`/`useAppSelector`)

### Electron Shell (`electron/`)

- Entry: `electron/src/main.ts` + `electron/src/preload.ts`; compiled to `electron/dist/` via `tsc`.
- On launch, resolves repo root (or `process.resourcesPath` when packaged) and spawns the frontend's Next.js **standalone** server (`frontend/.next/standalone`) as a child process on port 3000, then opens a `BrowserWindow` pointed at it.
- Injects `GETWRITE_PROJECTS_DIR` into the spawned server's environment, which `frontend/src/lib/models/projects-dir.ts` honors — this is how the desktop build can store projects somewhere other than `cwd/../projects`.
- Build flow: `pnpm electron:build` (frontend `next build` → electron `tsc`); package with `pnpm electron:package` (electron-builder).
- Logs go to `app.getPath("logs")/getwrite.log` in production.

### CLI (`cli/`)

Bundled to `cli/dist/bin/getwrite-cli.cjs` via `pnpm cli:build` (esbuild, Node target). Built on `commander`. Commands:

- `getwrite-cli project create [projectRoot] --spec <specPath> [-n <name>]` — Scaffold a new project from a project-type JSON spec (delegates to `project-creator.ts`).
- `getwrite-cli prune [projectRoot] [--max <n>]` — Delete oldest non-canonical revisions until at most `--max` (default 50) remain per resource. Logic in `pruneExecutor.ts`.
- `getwrite-cli reindex [projectRoot]` — Rebuild inverted index + backlinks from scratch by re-scanning all resources. Use after bulk filesystem changes that bypassed the save path.
- `getwrite-cli templates save|create|duplicate|list <projectRoot> …` — Manage resource templates under `<projectRoot>/meta/templates/`.
- `getwrite-cli screenshots capture [-b <storybook-url>] [-o <out-dir>] [-l <limit>]` — Playwright-driven full-page screenshots of every Storybook story.
- `getwrite-cli doctor [projectRoot]` — Check a project for broken folder associations (orphaned resources/folders). Logic in `cli/src/commands/doctor.ts`.

Set `GETWRITE_CLI_TESTING=1` to suppress `process.exit` when invoking commands from tests.

### Android Shell (`android/`) — ADR-021, Phase 0

Capacitor Android sibling to `electron/`, currently a walking-skeleton scaffold — see [ADR-021](docs/architecture/ADRs/adr-021-native-android-via-capacitor-in-process.md).

- `capacitor.config.ts` points `webDir` at a placeholder (`android/www/`); the real Next.js standalone build output isn't wired in yet (full WebView wiring is a later phase).
- `pnpm --filter getwrite-android build` currently just logs a placeholder message — there is no real Gradle build wired up yet.
- CI: `.github/workflows/build-android.yml` runs that placeholder build on every push/PR to `main` as a non-launch build-health check.
- On the frontend side, the native runtime path (`NEXT_PUBLIC_GETWRITE_RUNTIME === "native"`) is served by `frontend/src/lib/models/native-bootstrap.ts` + `capacitor-filesystem-real.ts` (see Code Map above); `frontend/next.config.mjs`'s `turbopack.resolveAlias` substitutes a `node:*`-free stub for the native search transport so it never enters the web/desktop build.

## Glossary

Domain terms that recur across code, skills, and specs:

- **Resource** — A user-authored unit (text document, image, link, etc.). Stored as `projects/<projectId>/resources/<resourceId>/` with `content.txt` + `content.tiptap.json`.
- **Sidecar** — A resource's metadata file at `projects/<projectId>/meta/resource-<resourceId>.meta.json`. Read/written via `sidecar.ts`.
- **Canonical revision** — The single revision per resource with `isCanonical: true` (enforced by `revision-canonical-guards.ts`). It's the one the editor loads and autosaves to.
- **Revision** — A snapshot under `projects/<projectId>/revisions/<resourceId>/v-<N>/`. `pruneRevisions` deletes oldest non-canonical revisions, keeping at most `--max` per resource (default 50 via the `prune` CLI).
- **Project type** — A JSON spec under `getwrite-config/templates/project-types/` describing folder layout, default metadata fields, and resource templates for a new project (e.g. `novel_project_type.json`).
- **Metadata schema** — Per-project field definitions (custom user-defined fields plus built-ins from `default-metadata-schema.ts`).
- **Smart folder** — A saved query (from `querySlice` / `saved-queries.ts`) rendered as a folder-like row in the resource tree.
- **Stub resource** — A resource the UI flags as "Needs content" (zero word count). Rendered with `isStub` in lists like `StubResourcesSection`.
- **Backlinks** — Reverse links between resources, computed by `backlinks.ts` and persisted to `meta/index/`.
- **Trash** — Soft-delete area at `projects/<projectId>/.trash/` with `resources/` and `meta/` subtrees. `softDeleteResource` moves a resource's content directory and sidecar there, preserving IDs.
- **Hosted auth** — GetWrite's opt-in, hosted-only identity layer (better-auth + PostgreSQL, `lib/auth/`; see [ADR-020](docs/architecture/ADRs/adr-020-hybrid-auth-postgres-better-auth.md)). Active only when `DATABASE_URL` and `BETTER_AUTH_SECRET` are both set (`isHostedAuthActive()`); plugs into the `IdentitySource` seam (`betterAuthIdentitySource`) that resolves a request's `userId` for tenant storage isolation. Desktop/local never configures it and stays account-free and database-free.

## Standards & Authority Hierarchy

When resolving conflicts, precedence is: **specs (`specs/`) → existing code → `docs/standards/*` → explicit instructions → conventions**

Key standards (read these before making significant changes):

- `docs/standards/typescript-implementation.md` — No `any`, explicit types, pure functions, single responsibility
- `docs/standards/testing.md` — Test structure and node version requirements
- `docs/standards/template-integrity.md` — Minimal patch-style edits to template-derived files
- `docs/standards/storybook-implementation.md` — Component documentation requirements
- `docs/standards/code-documentation.md` — Code documentation conventions
- `docs/standards/package-selection.md` — Guidance on adding dependencies
- `docs/standards/storage-context.md` — Request-scoped `StorageContext` seam: when routes/CLI/background jobs must establish it

## Styling

Brand name: **GetWrite** (one word, camelCase). Parent brand: **Saboteur LLC**.

- **Color tokens**: `black`, `white`, `red` (#D44040), `mid`, and `surface` variants
- **Red is reserved** for position/canonical state indicators only — never for actions or alerts
- **Typography**: IBM Plex Sans (UI), IBM Plex Mono (code), IBM Plex Serif (editor body only)
- **Editor line height**: 1.8+ minimum — this is essential for writers
- Dark/light mode support via CSS tokens defined in `styles/`
- Tailwind CSS 4 with brand tokens extended in theme config

Detailed styling guidance exists in STYLING.md

## Testing & Storybook

- Unit / integration / component / a11y tests live in `tests/`; prefer TDD and add to an existing test file before creating a new one.
- E2E tests (`e2e/`, Playwright, Chromium only) run against Storybook — start `pnpm storybook` (port 6006) first. Screenshots/video/trace are captured on failure. A11y tests use `@storybook/addon-a11y`.
- **Never hallucinate component props.** Before using any prop on an in-project component, open its source under `frontend/components/...` and matching `*.stories.tsx` to confirm it exists. Story names may not match prop names — verify against the TypeScript props or a story's args. If undocumented, ask rather than guess.
