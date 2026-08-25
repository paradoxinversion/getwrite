# Versioning and Releases

GetWrite uses [release-please](https://github.com/googleapis/release-please) to automate versioning, changelog generation, and GitHub Releases. Versioning follows [Semantic Versioning](https://semver.org/) and is driven entirely by commit message conventions.

## How it works

Release Please watches the `main` branch. Each push triggers it to inspect new commits since the last release and decide whether a version bump is warranted. If it is, it opens (or updates) a **Release PR**.

The Release PR:

- bumps the version in `package.json`
- updates `CHANGELOG.md` with an entry for each qualifying commit
- stays open and accumulates further changes until you merge it

When you merge the Release PR:

- the updated `package.json` and `CHANGELOG.md` are committed
- a git tag is created (e.g. `v0.2.0`)
- a GitHub Release is published from that tag
- a follow-up workflow syncs the version into `frontend/package.json` (see [Post-release: frontend version sync](#post-release-frontend-version-sync))

## Configuration

Release Please is configured via two files at the repo root:

- **`.release-please-config.json`** — release strategy and bump rules
- **`.release-please-manifest.json`** — the current tracked version (`"." : "0.2.0"`)

The config uses `release-type: node` (manages `package.json`) with a single package at `"."` and a `CHANGELOG.md` at the root.

## Pre-major version behavior

While the version is `0.x.x`, two flags in `.release-please-config.json` adjust bump sizes to avoid inflating the minor version prematurely:

```json
"bump-minor-pre-major": true,
"bump-patch-for-minor-pre-major": true
```

The combined effect while `major === 0`:

| Commit type                                    | Normal bump | Pre-major bump |
| ---------------------------------------------- | ----------- | -------------- |
| `fix:`                                         | patch       | patch          |
| `feat:`                                        | minor       | **patch**      |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` footer | major       | **minor**      |

Once the version reaches `1.0.0` these flags have no effect and standard semver rules apply.

## Commit message conventions

Release Please uses [Conventional Commits](https://www.conventionalcommits.org/). The prefix determines whether a bump is triggered and what kind.

| Prefix                                         | Changelog section | Version bump (≥1.0) |
| ---------------------------------------------- | ----------------- | ------------------- |
| `feat:`                                        | Features          | minor               |
| `fix:`                                         | Bug Fixes         | patch               |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` footer | Breaking Changes  | major               |
| `docs:`                                        | —                 | none                |
| `test:`                                        | —                 | none                |
| `chore:`                                       | —                 | none                |
| `refactor:`                                    | —                 | none                |

Only `feat:` and `fix:` commits (and breaking changes) appear in the changelog and trigger releases. Everything else is ignored by release-please.

### Breaking changes

Two equivalent ways to signal a major bump (or minor bump while `<1.0.0`):

```
feat!: drop support for Node 16
```

```
feat: redesign CLI output format

BREAKING CHANGE: --json output shape has changed; old consumers will break
```

Both produce a `BREAKING CHANGE` section in the changelog.

## Post-release: frontend version sync

After a release is created, a second job (`sync-frontend-version`) runs automatically. It reads the new version from the root `package.json` and writes it into `frontend/package.json`, then commits the change as:

```
chore: sync frontend version to getwrite-vX.Y.Z
```

This keeps the frontend package version in lockstep with the root without requiring a manual step.

## Required repository permissions

The workflow (`release-please.yml`) declares explicit permissions:

```yaml
permissions:
  contents: write
  pull-requests: write
```

This is sufficient for the default `GITHUB_TOKEN` to open Release PRs and push the post-release sync commit. No additional repository settings are required.
