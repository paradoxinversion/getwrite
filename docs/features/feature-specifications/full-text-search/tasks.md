# Full-Text Search — Implementation Tasks

Derived from: [full-text-search-spec.md](./full-text-search-spec.md)

---

### Task 1: Snippet extractor utility

**What:** A pure function `extractSnippet(text, query, maxLen)` that returns ≤ 160 characters of content centered on the first match of any query term.
**Files:**

- `frontend/src/lib/models/search-snippet.ts` (create)
- `frontend/tests/unit/search-snippet.test.ts` (create)

**Done when:** Unit tests pass for: match centered in body, match at start/end of text, multi-word query, query with no match (returns `""`), result never exceeds `maxLen` characters.
**Depends on:** none
**Estimate:** 2 SP
**Done:** [x]

---

### Task 2: Extend `ProjectUserPreferences` with `searchResultLimit`

**What:** Adds an optional `searchResultLimit` field to the project-scoped user preferences type and updates the parse/merge helpers to round-trip it correctly.
**Files:**

- `frontend/src/lib/user-preferences.ts` (modify)

**Done when:** `typecheck` passes; calling `mergeUserPreferencesIntoProjectMetadata` with `{ searchResultLimit: 25 }` and reading back via `getUserPreferencesFromProjectMetadata` returns `25`; non-numeric or missing values return `undefined`.
**Depends on:** none
**Estimate:** 1 SP
**Done:** [x]

---

### Task 3: Search API route

**What:** A `GET /api/project/[project-id]/search` route that queries the inverted index, loads sidecar metadata and canonical revision content per result, extracts snippets, applies filters, enforces the result limit, and returns a typed `SearchResult[]`.
**Files:**

- `frontend/app/api/project/[project-id]/search/route.ts` (create)
- `frontend/tests/unit/search-route.test.ts` (create)

**Done when:**

- `GET ?q=hello` returns `{ resourceId, title, snippet, status, folderId, tags }[]` ranked by `search()` from `inverted-index.ts`.
- `GET ?q=hello&folder=<id>&status=Draft&tags=tagA` returns only matching resources (all three filters combinable).
- Result count is capped at 50 by default; `searchResultLimit` from project preferences overrides the cap.
- Snippet text is sourced from the canonical revision (via `getCanonicalRevision`).
- Missing or empty `q` returns HTTP 400.
- No matching resources returns `[]` with HTTP 200.
- Unknown project ID returns HTTP 404.
- All above conditions verified by integration tests using a real temp project directory.

**Depends on:** Task 1, Task 2
**Estimate:** 5 SP
**Notes:** Use the `findProjectRoot` helper pattern from `app/api/projects/[projectId]/reorder/route.ts` to resolve `rootPath` from the project ID. Loading canonical revision content for every result is the most likely performance bottleneck — load only the canonical revision path from `listRevisions`, read the file once, and pass the already-loaded text to `extractSnippet` rather than calling `loadResourceContent` per result.
**Done:** [x]

---

### Task 4: Wire `SearchBar` to the search API

**What:** Replaces the `SearchBar`'s client-side fuzzy title logic with a debounced fetch to the search API, and updates the result rows to show title and snippet.
**Files:**

- `frontend/components/SearchBar/SearchBar.tsx` (modify)
- `frontend/tests/searchBar.test.tsx` (modify)

**Done when:**

- Typing 2+ characters into the `SearchBar` fires a debounced (200 ms) `GET /api/project/[id]/search?q=…` using the active project's ID from Redux (`selectSelectedProjectId`).
- Fewer than 2 characters produces no API call and an empty results list.
- Each result row renders the resource `title` and the `snippet` returned by the API.
- Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape) functions identically to the current behavior.
- Selecting a result dispatches `setSelectedResourceId` with the resource ID.
- When no active project is selected, the search input is disabled or produces no API call.
- Existing `searchBar.test.tsx` tests updated to mock the API response; all pass.

**Depends on:** Task 3
**Estimate:** 5 SP
**Notes:** The active project's `rootPath` is on `StoredProject.rootPath` in the Redux store — read `selectedProjectId` from `projectsSlice` and pass only the project ID in the URL (the route resolves the path server-side). Remove the `fuzzyMatch` function and related state entirely; the `renderHighlighted` helper can be removed or repurposed for snippet display.
**Done:** [x]

---

### Task 5: Search filter panel

**What:** An expandable `SearchFilterPanel` component that renders folder, status, and tag filter controls and appends active selections as query parameters to the search request.
**Files:**

- `frontend/components/SearchBar/SearchFilterPanel.tsx` (create)
- `frontend/components/SearchBar/SearchBar.tsx` (modify — integrate panel toggle and pass active filters to fetch)
- `frontend/tests/searchBar.test.tsx` (modify — add filter interaction tests)

**Done when:**

- A toggle button adjacent to the search input opens and closes the filter panel.
- The panel contains: a folder selector (populated from Redux resource folders for the active project), status chips (from `StoredProject.statuses`), and tag chips (from `StoredProject.metadata.tags`).
- Selecting any filter re-fires the search with the corresponding `folder`, `status`, or `tags` query parameters appended.
- Multiple filters combine in a single request (e.g., `?q=hello&status=Draft&tags=tagA`).
- Clearing all filters re-fires the search without filter parameters.
- Tests cover: panel open/close, single filter applied, multiple filters combined, filter cleared.

**Depends on:** Task 3, Task 4
**Estimate:** 3 SP
**Done:** [x]

---

## Summary

- **Total tasks:** 5
- **Total estimated effort:** 16 SP
- **Critical path:** Task 1 → Task 3 → Task 4 → Task 5 (Task 2 can run in parallel with Task 1; both must complete before Task 3 starts)
- **Risks:**
  - **Task 3 — performance:** Reading canonical revision content for every ranked result is sequential I/O. If projects have many resources, the 300 ms goal could be missed. Mitigate by reading only the revision file path from `listRevisions` and a single `readFile`, avoiding the full `loadResourceContent` pipeline.
  - **Task 4 — SearchBar rewrite scope:** Removing `fuzzyMatch` and `renderHighlighted` touches most of the component. The existing test suite will need substantial updates and is the most likely source of regressions.
