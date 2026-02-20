# Backlinks Watcher Integration Decision

Decision recorded: wire the backlinks background watcher into application startup and optionally expose a CLI/daemon entrypoint in a follow-up branch.

Rationale

- Backlinks are inexpensive to compute for small projects but benefit from near-real-time updates in larger projects; a background watcher provides best UX (instant backlink updates) without requiring users to run manual reindex commands.

Scope for follow-up branch

- Add lifecycle hook to app bootstrap to call `startBacklinkWatcher(projectRoot, { verbose: false })` when a project is opened.
- Expose a CLI command `gw backlinks watch <projectRoot>` for headless environments or devops use.
- Provide opt-out: project config flag `config.disableBacklinkWatcher` and an environment variable `GW_DISABLE_BACKLINK_WATCHER` for CI.
- Add graceful shutdown: ensure watcher.stop() is called on app/CLI exit and handle errors.

Testing & Validation

- Add unit tests for watcher start/stop and debounce behavior (mock FS events).
- Add an integration test ensuring backlinks persist after edits triggered by watcher.

Notes

- This file documents the plan; implementation will be done in a dedicated branch (e.g., `feature/backlinks-watcher-integration`).
