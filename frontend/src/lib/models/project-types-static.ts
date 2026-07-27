// Last Updated: 2026-07-26

/**
 * @module project-types-static
 *
 * **ADR-021 Phase 2 (Task 5) — FR15: native-safe project-type template
 * registry.** `app/api/project-types/route.ts` and `lib/projectTypes.ts`
 * (`getProjectType`, used by `project-crud-core.ts`'s `createProjectCore`)
 * both resolve project-type templates by reading
 * `getwrite-config/templates/project-types/*.json` off the real filesystem
 * at a repo-relative path (`process.cwd()/../getwrite-config/...` or an
 * equivalent). That path does not exist on a native (Capacitor/Android)
 * device — there is no repo checkout on-device, and `node:fs` reads of an
 * arbitrary host path are meaningless there regardless.
 *
 * This module sidesteps that by statically `import`-ing each template JSON
 * file at build time instead of reading a directory at runtime.
 * `"resolveJsonModule": true` (`frontend/tsconfig.json`) makes a plain
 * `import x from "*.json"` work under both TypeScript and the Next.js
 * bundler, and the bundler inlines the JSON content directly into whatever
 * chunk imports this module — no `node:fs`, no `node:path`, no runtime
 * directory read, at all.
 *
 * **Accepted tradeoff (spec-mandated, not a regression to "fix" later):**
 * because the import list below is hand-written, adding a new project-type
 * template now requires *two* changes instead of one — the JSON file under
 * `getwrite-config/templates/project-types/`, **and** a new `import` line
 * (plus registry entry) here. The HTTP/desktop path
 * (`lib/projectTypes.ts` / `app/api/project-types/route.ts`) is unaffected
 * and keeps its original "drop a JSON file, no code change" contract — this
 * divergence only applies to the native build's template resolution.
 *
 * Each imported template is validated the same way
 * `app/api/project-types/route.ts` validates its directory scan today
 * (`validateProjectType` from `./schemas`): entries that fail validation are
 * silently skipped, exactly like that route's `try { ... } catch { continue; }`
 * loop.
 *
 * **Import path mechanics.** The imports below go through
 * `frontend/getwrite-config` — a tracked symlink to the repo-root
 * `getwrite-config/` (see `.claude/skills/shadcn` for prior art tracking a
 * symlink in this repo) — rather than a longer `"../../../../getwrite-config"`
 * relative path straight to the repo root. This matters specifically for the
 * native build: `scripts/build-native-static.mjs` builds against a *shadow*
 * project root (`frontend/.native-build/`) that symlinks every top-level
 * `frontend/` entry (including this new `getwrite-config` symlink) into
 * itself, but nests `src/` one directory level deeper than the real
 * `frontend/`. A relative import computed for the real `frontend/src/lib/
 * models/` depth would therefore resolve to the wrong directory when
 * compiled from `frontend/.native-build/src/lib/models/` instead. Routing
 * through a `getwrite-config` symlink that exists at the top level of
 * *both* `frontend/` and the shadow root keeps the relative depth
 * (`"../../../getwrite-config"`, three levels up to whichever project root
 * is currently building) identical in both cases.
 */
import { validateProjectType, type ProjectTypeSpec } from "./schemas";
import articleProjectType from "../../../getwrite-config/templates/project-types/article_project_type.json";
import blankProjectType from "../../../getwrite-config/templates/project-types/blank_project_type.json";
import gameDocumentationProjectType from "../../../getwrite-config/templates/project-types/game_documentation.json";
import novelProjectType from "../../../getwrite-config/templates/project-types/novel_project_type.json";
import poetryAndLyricsProjectType from "../../../getwrite-config/templates/project-types/poetry_and_lyrics_type.json";
import serialProjectType from "../../../getwrite-config/templates/project-types/serial_project_type.json";

/**
 * Every bundled project-type template, as raw (unvalidated) JSON. Add new
 * templates here — see this module's doc comment for why a static import
 * line is required in addition to the JSON file itself.
 */
const RAW_PROJECT_TYPE_TEMPLATES: readonly unknown[] = [
  articleProjectType,
  blankProjectType,
  gameDocumentationProjectType,
  novelProjectType,
  poetryAndLyricsProjectType,
  serialProjectType,
];

/**
 * Validated project-type specs, computed once at module load. Invalid
 * entries (would only happen if a bundled template regressed its own schema
 * compliance) are skipped, mirroring the HTTP route's per-file
 * try/catch-and-skip behavior.
 */
const STATIC_PROJECT_TYPES: ProjectTypeSpec[] =
  RAW_PROJECT_TYPE_TEMPLATES.reduce<ProjectTypeSpec[]>((acc, raw) => {
    const result = validateProjectType(raw);
    if (result.success && "value" in result && result.value) {
      acc.push(result.value);
    }
    return acc;
  }, []);

/**
 * Lists every bundled, validated project-type spec. Pure, static data — no
 * filesystem access of any kind.
 */
export function listStaticProjectTypes(): ProjectTypeSpec[] {
  return STATIC_PROJECT_TYPES;
}

/**
 * Finds a single bundled project-type spec by its `id` field (e.g.
 * `"article"`, `"blank"`, `"novel"` — see each template's own `"id"` value).
 *
 * @param id - Project-type identifier to find.
 * @returns The matching spec, or `undefined` when no bundled template has
 *   that `id`.
 */
export function getStaticProjectType(id: string): ProjectTypeSpec | undefined {
  return STATIC_PROJECT_TYPES.find((spec) => spec.id === id);
}
