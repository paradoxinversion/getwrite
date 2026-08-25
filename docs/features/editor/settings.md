# Editor Settings (developer reference)

This document covers all editor settings that affect the writing surface — what each setting controls, what values it accepts, its default, and whether it is configurable through the UI or project type templates. For the writer-facing overview of what can be changed in the app, see [docs/user/editor/settings.md](../../user/editor/settings.md).

Settings fall into two categories:

- **Config-controlled** — stored in `project.json` under `config.editorConfig`, editable through the Heading Styles tab of the Project Settings dialog or the project type template.
- **CSS-only** — defined as hard values or theme tokens in `editor.css` / `getwrite-utilities.css`. Not currently exposed as user-configurable options.

---

## Body Text

Applies to all `<p>` elements in the editor. Settings are stored under `config.editorConfig.body`.

### Font Family

What it does: Sets the typeface for body text paragraphs.

|                       |                                                 |
| --------------------- | ----------------------------------------------- |
| Type                  | CSS `font-family` string                        |
| Example values        | `"IBM Plex Serif"`, `"Georgia, serif"`          |
| Default               | `IBM Plex Serif` (resolved from `--font-serif`) |
| Config key            | `config.editorConfig.body.fontFamily`           |
| User config           | Not currently exposed in the UI                 |
| Project type template | Yes — `editorConfig.body.fontFamily`            |

### Font Size

What it does: Sets the base font size for body text. Also used by the `NormalizePastedText` extension to normalize pasted content to match the body size.

|                       |                                           |
| --------------------- | ----------------------------------------- |
| Type                  | CSS `font-size` string                    |
| Recommended unit      | `px`                                      |
| Example values        | `"15px"`, `"16px"`                        |
| Default               | `15px` (resolved from `--text-gw-editor`) |
| Config key            | `config.editorConfig.body.fontSize`       |
| User config           | Not currently exposed in the UI           |
| Project type template | Yes — `editorConfig.body.fontSize`        |

### Line Height

What it does: Controls the vertical space between lines in body text. Also applied to list items and table cells.

|                       |                                                                              |
| --------------------- | ---------------------------------------------------------------------------- |
| Type                  | CSS `line-height` string                                                     |
| Recommended unit      | Unitless multiplier                                                          |
| Example values        | `"1.8"`, `"2.0"`                                                             |
| Default               | `1.8`                                                                        |
| Minimum               | `1.8` — this is a brand requirement; writing surfaces must use 1.8 or higher |
| Config key            | `config.editorConfig.body.lineHeight`                                        |
| User config           | Not currently exposed in the UI                                              |
| Project type template | Yes — `editorConfig.body.lineHeight`                                         |

### Paragraph Spacing

What it does: Sets the top and bottom margin of each paragraph (the gap between paragraphs). The first paragraph in a block has its top margin zeroed out.

|                       |                                             |
| --------------------- | ------------------------------------------- |
| Type                  | CSS `margin` string                         |
| Recommended unit      | `px` or `em`                                |
| Example values        | `"16px"`, `"1em"`                           |
| Default               | `16px`                                      |
| Config key            | `config.editorConfig.body.paragraphSpacing` |
| User config           | Not currently exposed in the UI             |
| Project type template | Yes — `editorConfig.body.paragraphSpacing`  |

### Text Color — CSS-only, not currently configurable

What it does: Controls the color of all body text in the editor.

|                       |                                                                          |
| --------------------- | ------------------------------------------------------------------------ |
| Default               | `var(--color-gw-ink)`                                                    |
| Resolved value        | `#1a1916` (light mode) / `#f5f4f0` (dark mode, via `--color-gw-primary`) |
| Config key            | None — no `color` field exists on `EditorBodyConfig`                     |
| User config           | No                                                                       |
| Project type template | No                                                                       |

Text color is theme-aware and cannot currently be set via editor config. Adding a `color` field to `EditorBodyConfig` is required before it can be exposed. Hard-coding a hex here would break dark mode support, which is why this is intentionally deferred.

---

## Headings

Applies to `<h1>` through `<h6>` elements. Each heading level is independently configurable. Settings are stored under `config.editorConfig.headings.<level>` (e.g. `headings.h1`).

H1–H3 are always visible in the editor toolbar. H4–H6 are hidden until a value is set for them.

The heading style is applied as an inline `style` attribute by the `CustomHeading` extension at render time. Only the fields present in the config are emitted — unset fields inherit from browser defaults or CSS.

### Canonical defaults

These are the baseline heading values used across all project type templates. They form the editor's visual type scale against the 15px body text.

| Level  | Font Size | Font Family    | Font Weight | Letter Spacing |
| ------ | --------- | -------------- | ----------- | -------------- |
| **H1** | `40px`    | IBM Plex Serif | `700`       | `0.01em`       |
| **H2** | `28px`    | IBM Plex Serif | `700`       | —              |
| **H3** | `20px`    | IBM Plex Serif | `500`       | —              |

**Scale rationale:** The steps run at roughly 1.40× per level (40→28→20→15px body), forming a consistent descending scale. H1 carries `0.01em` tracking to open the letterforms at display size. H3 drops to medium weight (`500`) to create clear weight differentiation from the bold section headings above it.

---

### Font Size

What it does: Sets the rendered size of the heading.

|                       |                                                               |
| --------------------- | ------------------------------------------------------------- |
| Type                  | CSS `font-size` string                                        |
| Recommended unit      | `px`                                                          |
| Defaults              | H1: `40px`, H2: `28px`, H3: `20px`                            |
| Config key            | `config.editorConfig.headings.<level>.fontSize`               |
| User config           | Yes — integer input in the Heading Styles tab, stored as `px` |
| Project type template | Yes — `editorConfig.headings.<level>.fontSize`                |

### Font Family

What it does: Sets the typeface for the heading.

|                       |                                                   |
| --------------------- | ------------------------------------------------- |
| Type                  | CSS `font-family` string                          |
| Example values        | `"IBM Plex Serif"`, `"IBM Plex Sans"`             |
| Default               | `IBM Plex Serif` (all levels)                     |
| Config key            | `config.editorConfig.headings.<level>.fontFamily` |
| User config           | Yes — free-text input in the Heading Styles tab   |
| Project type template | Yes — `editorConfig.headings.<level>.fontFamily`  |

### Font Weight

What it does: Sets the weight of the heading text.

|                       |                                                        |
| --------------------- | ------------------------------------------------------ |
| Type                  | CSS `font-weight` string                               |
| Accepted values       | `"400"` (Normal), `"500"` (Medium), `"700"` (Bold)     |
| Defaults              | H1: `700`, H2: `700`, H3: `500`                        |
| Config key            | `config.editorConfig.headings.<level>.fontWeight`      |
| User config           | Yes — select in the Heading Styles tab (Normal / Bold) |
| Project type template | Yes — `editorConfig.headings.<level>.fontWeight`       |

Note: The Heading Styles tab currently offers Normal (`400`) and Bold (`700`) only. Medium (`500`) is settable via project type template or direct config edit but is not currently selectable in the UI.

### Letter Spacing

What it does: Sets horizontal spacing between characters in the heading.

|                       |                                                                      |
| --------------------- | -------------------------------------------------------------------- |
| Type                  | CSS `letter-spacing` string                                          |
| Recommended unit      | `em`                                                                 |
| Example values        | `"0.05em"`, `"0.1em"`, `"-0.02em"`                                   |
| Defaults              | H1: `0.01em`, H2: unset (normal), H3: unset (normal)                 |
| Config key            | `config.editorConfig.headings.<level>.letterSpacing`                 |
| User config           | Yes — decimal number input in the Heading Styles tab, stored as `em` |
| Project type template | Yes — `editorConfig.headings.<level>.letterSpacing`                  |

### Color

What it does: Sets the text color for the heading, overriding the CSS default.

|                       |                                                                                  |
| --------------------- | -------------------------------------------------------------------------------- |
| Type                  | CSS color string                                                                 |
| Accepted values       | Hex color strings (e.g. `"#444444"`)                                             |
| Default               | `var(--color-gw-ink)` applied by `editor.css` — `#1a1916` light / `#f5f4f0` dark |
| Config key            | `config.editorConfig.headings.<level>.color`                                     |
| User config           | Yes — color picker in the Heading Styles tab                                     |
| Project type template | Yes — `editorConfig.headings.<level>.color`                                      |

**Note:** Setting a hard-coded hex color here overrides the theme-aware `--color-gw-ink` token and will not respond to light/dark mode switching. This field is intended for custom accent headings (e.g. chapter headers in a specific brand color), not for setting the default text color. Project type templates should leave this unset so theme CSS controls heading color.

---

## Heading Line Height — CSS-only, not currently configurable

What it does: Controls vertical line spacing within heading elements.

|                       |                                                        |
| --------------------- | ------------------------------------------------------ |
| Default               | `1.3` (set in `editor.css`)                            |
| Config key            | None — no `lineHeight` field exists on `EditorHeading` |
| User config           | No                                                     |
| Project type template | No                                                     |

Adding a `lineHeight` field to `EditorHeading` is required before this can be exposed as a configurable setting.

---

## Heading Margin — CSS-only, not currently configurable

What it does: Controls the space above and below headings.

|                       |                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Default               | `margin-top: 32px`, `margin-bottom: 16px` (set in `editor.css`). First heading in a block has `margin-top: 0`. |
| Config key            | None                                                                                                           |
| User config           | No                                                                                                             |
| Project type template | No                                                                                                             |
