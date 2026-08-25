# Follow-up Work: Remove Workspace Requirement

Deferred items discovered while implementing the spec. Each entry notes why it
was deferred and any context for a future pass.

---

## 2026-06-11 — Project Types manager has no validation feedback after guardrail removal

**Context:** Task 4 removed the "Workspace guardrail warning" banner from
`frontend/components/project-types/ProjectTypesManagerPage.tsx`. That banner was
rendered from `validateDraft(selectedItem.definition)` and, despite its title,
surfaced _all_ schema errors (e.g. invalid `id` pattern, empty `folders`), not
just the Workspace requirement.

**Why deferred:** FR7 explicitly requires removing the Workspace guardrail
warning, and the spec is scoped to removing the Workspace requirement — not to
designing a replacement validation-feedback UI. The manager page currently has
no explicit "Save"/commit action, so nothing depended on the banner to gate a
write.

**Follow-up:** If/when the manager gains an explicit save/commit action,
re-introduce schema-validation feedback (using `validateDraft`, which still
exists and still reports schema errors) as a generic "Invalid project type"
surface — not tied to any required folder name.

---

## 2026-06-11 — Pre-existing environment / test-stability observations (not caused by this feature)

**`commander` was missing from `node_modules`.** The CLI tests
(`tests/cli/*.ts`) failed to resolve the `commander` import even though it is a
declared dependency (`commander@^14.0.3`) present in `pnpm-lock.yaml`. Resolved
during Task 7 with `pnpm install --frozen-lockfile` (no lockfile change). If it
recurs, the local `node_modules` is out of sync with the lockfile — re-run a
frozen install.

**`tests/unit/media-file-route.test.ts` is flaky.** Under the full parallel
`vitest run` it intermittently fails on temp-directory teardown
(`ENOTEMPTY: directory not empty, rmdir …/meta` and an
`EnvironmentTeardownError` closing rpc), with a _different_ test failing each
run. It passes 5/5 in isolation. This is a temp-dir cleanup race unrelated to
the Workspace-requirement work — worth a separate hardening pass (e.g. retrying
the rmdir or isolating the temp roots) but out of scope here.
