# Editor: Headings (developer reference)

The text editor supports user-defined heading styles, configurable per project. For the writer-facing guide to customizing headings in the app, see [docs/user/editor/headings.md](../../user/editor/headings.md).

## Heading Levels

By default, three heading levels are available (H1–H3). Up to six levels (H1–H6) can be enabled. H4–H6 are optional and can be added or removed individually.

## Configuration

Heading style configuration is stored in each project's `project.json` under `config.editorConfig.headings`.

### Heading Attributes

| Attribute       | Type                  | Required | Example           |
| --------------- | --------------------- | -------- | ----------------- |
| `fontSize`      | Pixel size string     | No       | `"20px"`          |
| `fontFamily`    | Font family name      | No       | `"IBM Plex Sans"` |
| `fontWeight`    | Numeric weight string | No       | `"700"`           |
| `letterSpacing` | Em unit string        | No       | `"0.05em"`        |
| `color`         | Hex color string      | No       | `"#D44040"`       |

All attributes are optional. Empty or whitespace-only values are stripped before persisting.

#### Example

```json
{
  "editorConfig": {
    "headings": {
      "h1": {
        "fontSize": "32px",
        "fontFamily": "IBM Plex Serif",
        "fontWeight": "700"
      },
      "h2": { "fontSize": "24px", "letterSpacing": "0.05em" },
      "h3": { "fontSize": "18px", "color": "#555555" }
    }
  }
}
```

## Heading Level Selection

Headings are selected in the Editor via MenuBar buttons.

## Heading Style Customization

Heading styles are configured through the **Heading Styles** tab of the **Project Settings** dialog (gear menu); changes are project-scoped and take effect immediately. The tab stages edits locally and commits on **Save**. For the full UI walkthrough, see the [user guide](../../user/editor/headings.md). Implementation notes follow.

### API

`POST /api/project/editor-config` accepts `{ projectPath, headings }` and writes the sanitized heading map to `config.editorConfig` in the project's `project.json`. The endpoint returns the updated `editorConfig` on success.

Heading styles are also refreshed in Redux state immediately after a successful save so the editor reflects the new config without requiring a page reload.
