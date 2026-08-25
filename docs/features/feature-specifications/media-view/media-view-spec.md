# Feature Spec: Media View

## Overview

GetWrite can create and store image and audio resources, but selecting one in the work area currently shows only a "not a text resource" placeholder — there is no way to view an image or listen to audio inside the app. The Media View renders an image resource as a fit-to-window, zoomable/pannable image, and an audio resource as a branded, scrubbable player. This lets writers review their media assets in the workspace without exporting them or opening external tools.

## Goals

- Selecting an image resource displays the image in the work area.
- Selecting an audio resource displays a playable, scrubbable audio player.
- Media is served from the existing file-serving route, with no base64 embedding or duplication.
- The view integrates with the existing work area and view switcher without disrupting text-resource flows.
- The resource's metadata (already shown in the sidebar) remains visible alongside the view.

## Non-goals

- Editing, cropping, or transforming media.
- Replacing or re-uploading a resource's binary from this view.
- Galleries, playlists, or multi-track/multi-image browsing.
- Video resources.

## User stories

- As a writer, I want to view an image resource in the work area so that I can reference visual assets while writing.
- As a writer, I want to zoom and pan a large image so that I can inspect detail.
- As a writer, I want to play and scrub an audio resource so that I can review recordings or music.

## Functional requirements

**Surfacing**

1. When the selected resource is an image or audio resource, the work area's `edit` view MUST render the Media View instead of the text editor or the "not a text resource" placeholder.
2. While an image or audio resource is selected, the view switcher's "Edit" tab label MUST read "Media"; for text resources it MUST read "Edit".
3. View tabs not applicable to media (e.g. Diff) SHOULD be disabled while a media resource is selected.

**Image** 4. Image resources MUST be displayed scaled to fit the work area while preserving aspect ratio. 5. The image viewer MUST provide zoom (in, out, reset-to-fit) and panning of the zoomed image. 6. The image MUST be loaded from `GET /api/resource/[id]/file`.

**Audio** 7. Audio resources MUST render in a custom GetWrite-styled player providing play/pause, a draggable seek/scrub bar, and current-time / total-duration display. 8. The player MUST load audio from `GET /api/resource/[id]/file`. 9. The scrub bar MUST allow seeking to any position, and current time MUST update during playback. 10. The player SHOULD show the resource's known duration (from sidecar metadata) before the audio finishes loading, when available.

**General** 11. The Media View MUST show a clear error state for a missing or unreadable binary rather than a broken element. 12. The Media View MUST be keyboard-accessible (play/pause, seek, zoom) with appropriate ARIA labels.

## Open questions

- None identified. Resolved: reuse the Edit view with a dynamic "Media" tab label; custom-styled audio player; image fit plus zoom/pan.

## Out of scope (deferred)

- Video playback.
- Image annotations or inline markup.
- Audio waveform visualization.
- Fullscreen / lightbox mode and slideshow across multiple images.
- Download or reveal-in-finder actions from the view.
