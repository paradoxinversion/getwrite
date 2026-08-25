# Demo video pipeline

Automated, repeatable promo/demo assets for GetWrite. Everything is
script-driven — Playwright drives the live app and records it, ffmpeg finishes
it. No manual screen recording or video editing.

## Outputs (`out/`)

| File                          | What it is                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `getwrite-demo-landscape.mp4` | **Primary.** ~48s scripted walkthrough of the live app with baked-in captions + end card. 1440×900, H.264, silent audio track, faststart. |
| `getwrite-demo-montage.mp4`   | **Fallback.** ~24s Ken Burns crossfade slideshow of clean full-app screenshots.                                                           |
| `getwrite-demo-poster.png`    | Poster/thumbnail frame from the walkthrough.                                                                                              |

## Prerequisites

- Dev server running on :3000 (`pnpm start` from repo root). The Playwright
  config will start one if absent.
- `ffmpeg` on PATH (`brew install ffmpeg`).
- Network access (the editor lazy-loads webfonts from Google Fonts; the
  typography beat waits for the font before capturing).

## Regenerate from scratch

The walkthrough types into Chapter One, which mutates the document **and its
canonical revision** (the editor loads from the revision, not `content.txt`).
So the rule is: **always record on a freshly seeded project, and capture the
screenshots _before_ the walkthrough.**

```bash
# 1. (If a previous "The Lighthouse Keeper" demo project exists, delete it from
#    the Start page first — otherwise the project name collides in the UI.)

# 2. Seed a clean, interconnected demo project. Prints the project's rootPath.
node demo/seed.mjs

# 3. Capture clean screenshots FIRST (non-mutating). They land in
#    frontend/out/shots relative to the run cwd; move them into demo/out.
cd frontend
pnpm exec playwright test screens.spec.ts --config ../demo/playwright.demo.config.ts
rm -rf ../demo/out/shots && mv out/shots ../demo/out/ && rmdir out

# 4. Record the walkthrough LAST (mutates the project). Writes out/raw/.../video.webm.
pnpm exec playwright test demo.spec.ts --config ../demo/playwright.demo.config.ts

# 5. Encode (see commands below), run from demo/out.
```

### Encode: landscape walkthrough

```bash
cd demo/out
RAW=raw/demo-getwrite-demo-walkthrough/video.webm
DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$RAW")
OUT_FADE=$(echo "$DUR - 0.8" | bc)
ffmpeg -y -i "$RAW" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
  -vf "fade=t=in:st=0:d=0.6,fade=t=out:st=${OUT_FADE}:d=0.8,format=yuv420p" \
  -c:v libx264 -profile:v high -crf 20 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 128k -shortest -movflags +faststart getwrite-demo-landscape.mp4
```

The montage build (zoompan Ken Burns + xfade chain over `out/shots/*.png`) is a
short bash loop; see the project chat history for the exact script.

## Files

- `seed.mjs` — builds the demo project via the app API, then reindexes:
  chapters/characters with wiki-links, status + POV + **custom Arc & Tension
  fields**, and two saved smart-folder queries (one simple, one complex
  multi-condition). It also enables the built-in **POV & Synopsis** feature
  toggles (`POST /api/project/features`) — since #128 those fields are opt-in
  per project (absent flag = disabled), so without this the metadata sidebar
  would hide them. Creates a _new_ project each run — delete the old one first.
- `screens.spec.ts` — captures caption-free stills for the montage.
- `demo.spec.ts` — the paced walkthrough; injects an on-screen caption banner.
- `playwright.demo.config.ts` — drives :3000 (not Storybook), video on, 1440×900.

## Notes

- Walkthrough beats: start → open project → editor (TipTap) → autosave →
  **structured metadata (built-in + custom Arc/Tension)** → wiki-links/backlinks
  → full-text search → **complex query** (the `High-Tension Scenes` smart folder
  reveals a `Tension ≥ 6 AND Arc is Confrontation` query with a live match count)
  → end card.
- The query beat relies on server-side evaluation: opening a saved smart folder
  shows real results. Note the intrinsic `wordCount` field reads null at query
  time, so queries are built on `tension`/`arc`/`status` rather than word count.
- Captions and the end card are baked into the walkthrough video, so it reads
  fine muted.
- The end card URL lives in the `titleCard(...)` call in `demo.spec.ts`
  (currently `github.com/saboteur-works/getwrite`).
