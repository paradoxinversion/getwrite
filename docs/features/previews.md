# Resource Previews

Overview

This module generates lightweight preview metadata for resources and persists the artifacts under `meta/previews/<resourceId>.json`.

Supported previews

- Images: thumbnail metadata (width, height, optional base64 thumbnail string)
- Audio: duration and lightweight waveform summary (array of numeric peaks)
- Text: excerpt and word count

APIs

- `generatePreview(projectRoot, resource, generators?)`
    - Generates preview metadata for `resource` and persists it under `meta/previews/<id>.json`.
    - `generators` is an optional object with keys `image`, `audio`, and `text` allowing callers to provide platform-specific generation logic (e.g., native image scaling, ffmpeg waveform extraction).

- `savePreview(projectRoot, resourceId, preview)` — persists a `Preview` object to `meta/previews/<resourceId>.json`.
- `loadPreview(projectRoot, resourceId)` — reads and parses a preview JSON if present.

Storage

- Preview files live under `<projectRoot>/meta/previews/<resourceId>.json`.
- Writes are serialized via `withMetaLock(projectRoot, fn)` to avoid concurrent meta mutations.

Testing

- The `generatePreview` API accepts injected generators which are useful for unit tests. Use small deterministic generators for CI.

Examples

- Generate with default text preview:

```ts
import previews from "../lib/models/previews";
await previews.generatePreview(projectRoot, {
    id: "txt-1",
    type: "text",
    plainText: "Hello world",
});
```

- Generate an image preview using an external thumbnailer:

```ts
import previews from "../lib/models/previews";
await previews.generatePreview(projectRoot, imgResource, {
    image: async (r) => {
        const thumbnail = await nativeThumb(r.filePath, { width: 160 });
        return { type: "image", width: 160, height: 90, thumbnail };
    },
});
```

Notes & future work

- For production-grade previews (especially waveform extraction), integrate native libraries (`sharp`, `ffmpeg`) and ensure workers or off-main-thread processing are used to avoid blocking the app.
- Consider caching strategies and TTL for previews so they can be invalidated and regenerated when source content changes.

---
