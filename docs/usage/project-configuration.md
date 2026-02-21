# Project Configuration (user)

This guide explains how to configure a GetWrite project by editing the `project.json` file at the root of your project folder.

Where to find it

- Open the project directory and edit `project.json` with your editor.

Common fields

- `name` (required): The visible name of the project.
- `description` (optional): Short description shown in project lists.
- `maxRevisions` (optional, default 50): How many historical revisions to keep per resource. Set higher if you want longer history, but note disk usage will increase.
- `autoPrune` (optional, default true): When true, the app will automatically delete oldest non-preserved revisions once `maxRevisions` is exceeded.

Example

Minimal:

```json
{
    "name": "My Novel",
    "maxRevisions": 50
}
```

Recommended for writers:

```json
{
    "name": "Novel Draft",
    "description": "Work-in-progress novel",
    "maxRevisions": 200,
    "autoPrune": true
}
```

Notes and tips

- After changing `project.json`, re-open the project in the app or restart the app so the loader picks up changes.
- Increasing `maxRevisions` will retain more history but increases disk usage.
- If you run into unexpected behavior after editing `project.json`, check the app logs for schema validation errors; the loader validates configuration at runtime.

Advanced

- Some advanced features (indexing, previews) have additional toggle flags under `meta` in `project.json`. These are primarily used by developers; consult your development team or the developer docs at `docs/features/project-configuration.md` for details.

Help

- For CLI or scripting, treat `project.json` as a plain JSON file. Use `jq` or your editor to modify values.
- If you need to bulk-change `maxRevisions` across projects, a simple script that parses JSON and rewrites files is sufficient.
