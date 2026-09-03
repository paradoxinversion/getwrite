# Project Configuration (user)

This guide explains how to configure a GetWrite project by editing the `project.json` file at the root of your project folder.

Where to find it

- Open the project directory and edit `project.json` with your editor.

Common fields

- `name` (required): The visible name of the project.
- `description` (optional): Short description shown in project lists.
- `maxRevisions` (optional, default 50): How many historical revisions to keep per resource. Set higher if you want longer history, but note disk usage will increase.
- `autoPrune` (optional, default true): When true, the app will automatically delete oldest non-preserved revisions once `maxRevisions` is exceeded.
- `config.statuses` (optional): Array of status strings available as options for all resources in the project. Customize this to match your workflow stages.
- `config.features` (optional): Per-project toggles for the optional built-in metadata fields and views — `timeline`, `pov`, `synopsis`, `notes`, `timelineView`, `entities`, and `entityHighlighting` (each a boolean; an absent flag means off). These are normally set through the app — the **Built-in features** section of the Metadata Fields manager and **User Preferences → Timeline view** — which keep the linked flags consistent (the Timeline view requires `timeline`, so `timelineView: true` forces `timeline: true`; `entityHighlighting`'s toggle is only shown once `entities` is on, and highlighting has no effect without it). Edit by hand only with that invariant in mind.
- `config.organizerCardBody` (optional): What the Organizer view renders beneath each card's title. `{ "source": "none" }`, `{ "source": "text-excerpt", "excerptLength": 200 }`, or `{ "source": "field", "fieldKey": "<metadata key>" }`. Set this from **User Preferences → Organizer Card Body**.

Example with custom statuses:

```json
{
  "name": "My Novel",
  "maxRevisions": 100,
  "config": { "statuses": ["Outline", "First Draft", "Revised", "Final"] }
}
```

Example

Minimal:

```json
{ "name": "My Novel", "maxRevisions": 50 }
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
- **Tags**: Project-scoped tags (`config.tags` and `config.tagAssignments`) are managed through the Tags UI in the app. Editing them directly in `project.json` is possible but not recommended — use the app UI to avoid consistency issues with tag assignments.

Help

- For CLI or scripting, treat `project.json` as a plain JSON file. Use `jq` or your editor to modify values.
- If you need to bulk-change `maxRevisions` across projects, a simple script that parses JSON and rewrites files is sufficient.
