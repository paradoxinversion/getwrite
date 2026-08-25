# Timeline View

## Purpose and User Interaction

The Timeline View gives writers a horizontal, time-based picture of their story. Each scene is represented as a chip placed along a date axis according to its Story Date — the in-story date and time the scene takes place, not the date the writer worked on it. The view answers the question: _in what order do things actually happen in the world of this story?_

The Timeline View is enabled per project. Turn it on from **User Preferences → Timeline view**; because the view reads the story-date fields, enabling it also turns those fields on (and turning the date fields off turns the view off). Once enabled, writers open the Timeline by switching to the Timeline tab in the Work Area, where it reflects whatever story dates have been entered in the metadata sidebar for individual scenes. While the view is disabled, its tab is greyed out with a tooltip pointing to the preference.

### Setting story dates

A scene appears on the timeline only after a Story Date has been set in its metadata. The date can be as coarse as a calendar day or as precise as a date and time. Writers who also set a Story Duration or Story End Date will see their scenes rendered as spans rather than point events.

### Navigating the timeline

The axis spans from the earliest dated scene to the latest, with a small margin on each side. Writers can zoom in and out using the +/− controls in the toolbar, or with Ctrl+scroll (Cmd+scroll on Mac). At higher zoom levels the axis labels grow more precise — switching from month/day to hour:minute as needed — and chips that were previously too dense to read become individually legible.

Clicking a chip navigates directly to that scene in the editor. Hovering over any chip opens a tooltip showing the scene's full name, in-story date and time, duration (if set), point of view, workflow status, folder or act, and any notes attached to the scene.

### Point-of-view color coding

When scenes have a POV character assigned, each distinct POV is given its own color. A legend appears above the timeline whenever two or more POVs are present, pairing each color swatch with the POV name so the writer can read the color coding at a glance.

### Groups and acts

Scenes assigned to a folder (typically an act or chapter) are rendered in a labeled row for that folder. The row label appears to the left of the track. Scenes with no folder fall into an ungrouped row at the bottom. A writer can therefore see how acts interleave in story time — useful for multi-POV or non-linear structures.

---

## Behavior

### What scenes appear

Only scenes with a Story Date set are shown. Scenes without a date are silently omitted; the empty-state message prompts the writer to set dates via the metadata sidebar. The scene count shown in the toolbar reflects only the dated scenes.

### Axis bounds and zoom

The axis start and end are computed automatically from the earliest and latest dated scenes, padded by 5% on each side. Zooming multiplies the track width; the number of axis tick labels scales with the zoom level, up to a maximum of 24 ticks. Ctrl+scroll and the toolbar buttons adjust zoom in 0.5× increments between 1× and 10×.

### Gap labels

When two adjacent scenes (within the same row) have a large gap between them — more than 5% of the total axis span — a small label appears between them showing how much story time separates them (e.g., _3d_, _2h_, _6mo_). This helps writers spot unintentional jumps or confirm deliberate time skips.

### Row height and lane stacking

Scenes in the same group can end up positioned so close together on the axis that their chips would physically overlap. When this occurs, the timeline automatically stacks overlapping chips into parallel lanes within the same row. Each additional lane increases the row height proportionally. The writer does not need to do anything to trigger this — it happens whenever two chips in the same row would collide at the current zoom level.

---

## Appearance

### Layout

The Timeline View follows the standard Work Area layout: a title bar showing _Timeline — Project Name_, an optional POV legend, and the timeline track below. The track area is horizontally scrollable when the content is wider than the viewport.

### POV legend

When two or more distinct POV characters are present, a row of color swatches and labels appears between the title and the track. Each entry is a small filled circle in the POV's color followed by the POV name in subdued mono text. The legend is omitted when all scenes share a single POV or when no POV is set.

### Toolbar

A slim bar sits above the track. On the left it shows the count of dated scenes (_N scenes_). On the right are the zoom-out (−), zoom percentage, and zoom-in (+) buttons. Zoom buttons dim when the minimum or maximum zoom level is reached.

### Axis

A row of evenly spaced tick marks runs above the scene rows. Each tick has a short vertical line and a date label below it. The label format adapts automatically to the current zoom level:

- At wide spans: _Jan 12_ or _2024 Jan_
- At narrow spans: _Jan 12 14:30_

### Scene chips

Each chip is a colored, rounded rectangle placed on the track according to the scene's story date. The chip's left edge corresponds to the scene's start time; its width represents the scene's duration. Three visual variants are chosen dynamically based on how much horizontal space the chip has at the current zoom level:

**Bar** — the default chip. Displays the full scene name, truncated with an ellipsis if it runs long. Used when the chip has enough room for a readable label.

**Pill** — a narrower chip used when the scene's duration is short relative to the axis span. Displays only the first word of the scene name. Has a smaller minimum width than the bar so it occupies less space and reduces crowding.

**Pin** — a thin vertical bar used for scenes with no duration (a single point in story time). Carries no label; its color and position are the only signals. Spans the full height of the track row so it reads as a bookmark or marker rather than a content block.

Chips are fully opaque. A chip's background color reflects its POV assignment; chips with no POV use a neutral default color. Hovering a chip brightens it slightly. Focusing a chip via keyboard shows a focus ring.

### Tooltip

Hovering any chip opens a styled tooltip above it. The tooltip always shows the scene name in bold and the in-story date (and time, if set). Below that it shows, when available: the POV character, the workflow status, the folder or act the scene belongs to, and a short excerpt from the scene's notes. The tooltip is fully opaque and renders above all other UI elements.

### Row separators

A subtle horizontal rule separates each group row from the next, making it easy to scan across acts or chapters as distinct bands.
