/**
 * @module entity-highlight-decoration-extension.test
 *
 * Task 9 (entity-highlighting): tests for the TipTap `Extension` wrapper in
 * `components/Editor/Extensions/EntityHighlightDecorationExtension.ts`, which
 * wires Task 8's pure `computeEntityHighlightRanges` core into a ProseMirror
 * `Plugin`/`DecorationSet`, gated on both feature flags.
 *
 * Follows this repo's established convention (see `EditView.test.tsx`'s "Mock
 * the TipTapEditor to avoid loading the real Editor in jsdom" comment and
 * `wiki-link-decoration.test.ts`'s direct-function testing style) of never
 * mounting a real TipTap `Editor`/`EditorView` in a jsdom test. Instead this
 * exercises the actual `Plugin` object the extension builds — via
 * `EntityHighlightDecorationExtension.configure(...)`'s real
 * `addProseMirrorPlugins()` — against a plain `@tiptap/pm/state`
 * `EditorState`, which needs no DOM.
 *
 * Covers this task's `done_when` list:
 *  1. Either flag off => zero decorations AND `computeEntityHighlightRanges`
 *     is never invoked (spied via `vi.mock`).
 *  2. Both flags on => matches from Task 8's core render as decorations at
 *     the correct ProseMirror positions in the live, unsaved document.
 *  3. No persistence/write call occurs from gating: the plugin's own
 *     recompute-signal transaction (dispatched by `TipTapEditor.tsx` on a
 *     flag/alias-table change) never sets `tr.docChanged`, which is the
 *     exact condition TipTap's `Editor` requires before it emits `"update"`
 *     (and therefore before `onChange`/any downstream save fires) — see
 *     `@tiptap/core`'s `dispatchTransaction`,
 *     `!transactions.some((tr) => tr.docChanged)` gate.
 *
 * Task 12 (FR-5, "Highlighting MUST update to reflect edits to the document
 * … and edits to entity declarations … without requiring a manual refresh")
 * adds two more, exercising both live-update triggers explicitly and
 * end-to-end at the decoration-set level:
 *  4. A plain document-editing transaction (`tr.docChanged`, no meta signal)
 *     changes the rendered decoration set to reflect newly-typed text.
 *  5. A meta-signal transaction (`tr.docChanged === false`, mirroring the
 *     transaction `TipTapEditor.tsx`'s `useEffect` dispatches whenever
 *     `entityAliasTable` changes) changes the rendered decoration set to
 *     reflect a changed alias table, with the document itself untouched —
 *     i.e. no full resource reload occurs in between.
 *
 * `TipTapEditor.tsx` renders a lightweight mock (never a real
 * `Editor`/`EditorView`) in `isTestEnv`, per this repo's established jsdom
 * convention (see this file's own header above) — so there is no meaningful
 * `TipTapEditor`-level jsdom integration point beyond what is already
 * asserted here against the real `Plugin` the component configures.
 */
import { describe, expect, it, vi } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { EditorState } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import type { EntityAliasTable } from "../../src/lib/models/entity-alias-table";

vi.mock(
  "../../components/Editor/Extensions/entityHighlightDecoration",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../components/Editor/Extensions/entityHighlightDecoration")
      >();
    return {
      ...actual,
      computeEntityHighlightRanges: vi.fn(actual.computeEntityHighlightRanges),
    };
  },
);

import { computeEntityHighlightRanges } from "../../components/Editor/Extensions/entityHighlightDecoration";
import EntityHighlightDecorationExtension, {
  buildEntityHighlightDecorations,
  ENTITY_HIGHLIGHT_DECORATION_KEY,
  type EntityHighlightDecorationOptions,
} from "../../components/Editor/Extensions/EntityHighlightDecorationExtension";

const schema = getSchema([StarterKit]);

/** Builds a one-paragraph document whose single text node is `text`. */
function docFromText(text: string) {
  return schema.nodeFromJSON({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

/** Builds a minimal `EntityAliasTable` from a flat list of declarations. */
function buildAliasTable(
  entities: Array<{ entityId: string; name: string; aliases?: string[] }>,
): EntityAliasTable {
  const table: EntityAliasTable = { entities: {}, claimedBy: {} };
  for (const e of entities) {
    const aliases = e.aliases ?? [];
    table.entities[e.entityId] = {
      entityId: e.entityId,
      entityKind: "character",
      name: e.name,
      aliases,
      terms: [e.name, ...aliases],
    };
  }
  return table;
}

function decorationRanges(
  set: DecorationSet,
): Array<{ from: number; to: number; class?: string }> {
  return set
    .find()
    .map((d) => ({
      from: d.from,
      to: d.to,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      class: (d as any).type?.attrs?.class as string | undefined,
    }))
    .sort((a, b) => a.from - b.from);
}

function decorationTitles(
  set: DecorationSet,
): Array<{ from: number; to: number; title?: string }> {
  return set
    .find()
    .map((d) => ({
      from: d.from,
      to: d.to,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      title: (d as any).type?.attrs?.title as string | undefined,
    }))
    .sort((a, b) => a.from - b.from);
}

/**
 * Builds the real `Plugin` array the extension registers, without
 * constructing a TipTap `Editor`/`EditorView` — `configure(...)` returns an
 * `Extendable` instance whose `.config.addProseMirrorPlugins` is the exact
 * function `Editor` would call, bound so `this.options` resolves through the
 * same getter TipTap itself uses.
 */
function buildPlugins(options: EntityHighlightDecorationOptions) {
  const configured = EntityHighlightDecorationExtension.configure(options);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (configured as any).config.addProseMirrorPlugins.call(configured);
}

describe("buildEntityHighlightDecorations — gating (FR-1/FR-8/FR-9)", () => {
  it("produces zero decorations and never calls computeEntityHighlightRanges when isEnabled is false", () => {
    const mockedCompute = vi.mocked(computeEntityHighlightRanges);
    mockedCompute.mockClear();

    const doc = docFromText("Aria walked into the harbor.");
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);

    const decorations = buildEntityHighlightDecorations(doc, {
      isEnabled: () => false,
      getAliasTable: () => table,
    });

    expect(decorationRanges(decorations)).toEqual([]);
    expect(mockedCompute).not.toHaveBeenCalled();
  });

  it("produces zero decorations when isEnabled is false even with a non-empty alias table read lazily", () => {
    // getAliasTable itself must not even be invoked when disabled.
    const getAliasTable = vi.fn(() =>
      buildAliasTable([{ entityId: "e1", name: "Aria" }]),
    );
    const doc = docFromText("Aria walked into the harbor.");

    buildEntityHighlightDecorations(doc, {
      isEnabled: () => false,
      getAliasTable,
    });

    expect(getAliasTable).not.toHaveBeenCalled();
  });
});

describe("buildEntityHighlightDecorations — matches render at correct live-document positions (FR-2/FR-3/FR-4)", () => {
  it("decorates a declared entity name found in the live, unsaved document", () => {
    const mockedCompute = vi.mocked(computeEntityHighlightRanges);
    mockedCompute.mockClear();

    const doc = docFromText("Aria walked into the harbor.");
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);

    const decorations = buildEntityHighlightDecorations(doc, {
      isEnabled: () => true,
      getAliasTable: () => table,
    });

    const ranges = decorationRanges(decorations);
    expect(ranges).toHaveLength(1);
    // doc starts at 0, paragraph opens at 0, text begins at 1 — "Aria" is the
    // first 4 characters of the text node.
    expect(ranges[0]).toEqual({
      from: 1,
      to: 5,
      class: expect.stringContaining("entity-highlight"),
    });
    expect(mockedCompute).toHaveBeenCalledWith(doc, table);
  });

  it("distinguishes plain-match and needs-attention via CSS class", () => {
    const doc = docFromText("May opened the letter slowly.");
    // "May" is on entity-alias-warnings.ts's common-word list.
    const table = buildAliasTable([
      { entityId: "e1", name: "Maylene", aliases: ["May"] },
    ]);

    const decorations = buildEntityHighlightDecorations(doc, {
      isEnabled: () => true,
      getAliasTable: () => table,
    });

    const ranges = decorationRanges(decorations);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].class).toContain("entity-highlight--needs-attention");
  });
});

describe("buildEntityHighlightDecorations — hover/title disclosure (FR-11)", () => {
  it("names 'short or common word' wording when only the short/common-word condition applies", () => {
    const doc = docFromText("May opened the letter slowly.");
    // "May" is on entity-alias-warnings.ts's common-word list and is
    // declared by exactly one entity — no ambiguous claim.
    const table = buildAliasTable([
      { entityId: "e1", name: "Maylene", aliases: ["May"] },
    ]);

    const decorations = buildEntityHighlightDecorations(doc, {
      isEnabled: () => true,
      getAliasTable: () => table,
    });

    const titles = decorationTitles(decorations);
    expect(titles).toHaveLength(1);
    expect(titles[0].title).toContain("short or common word");
    expect(titles[0].title).not.toContain("more than one entity");
  });

  it("names 'ambiguous'/'more than one entity' wording when only the ambiguous-claim condition applies", () => {
    const doc = docFromText("Kaelith walked into the harbor.");
    // "Kaelith" is not on the common-word list, but is claimed by two
    // distinct entities.
    const table = buildAliasTable([
      { entityId: "e1", name: "Kaelith" },
      { entityId: "e2", name: "Kaelith" },
    ]);

    const decorations = buildEntityHighlightDecorations(doc, {
      isEnabled: () => true,
      getAliasTable: () => table,
    });

    const titles = decorationTitles(decorations);
    expect(titles).toHaveLength(1);
    expect(titles[0].title).toContain("more than one entity");
    expect(titles[0].title).not.toContain("short or common word");
  });

  it("names BOTH conditions when a term is both short/common-word-flagged and ambiguous", () => {
    const doc = docFromText("May opened the letter slowly.");
    // "May" is both a common word/name and claimed by two distinct entities.
    const table = buildAliasTable([
      { entityId: "e1", name: "May" },
      { entityId: "e2", name: "May" },
    ]);

    const decorations = buildEntityHighlightDecorations(doc, {
      isEnabled: () => true,
      getAliasTable: () => table,
    });

    const titles = decorationTitles(decorations);
    expect(titles).toHaveLength(1);
    expect(titles[0].title).toContain("short or common word");
    expect(titles[0].title).toContain("more than one entity");
  });

  it("has no title attribute for a plain match (no needs-attention condition applies)", () => {
    const doc = docFromText("Aria walked into the harbor.");
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);

    const decorations = buildEntityHighlightDecorations(doc, {
      isEnabled: () => true,
      getAliasTable: () => table,
    });

    const titles = decorationTitles(decorations);
    expect(titles).toHaveLength(1);
    expect(titles[0].title).toBeUndefined();
  });
});

describe("EntityHighlightDecorationExtension — real Plugin, no DOM required", () => {
  it("the configured plugin's initial state has no decorations when disabled", () => {
    const doc = docFromText("Aria walked into the harbor.");
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);

    const plugins = buildPlugins({
      isEnabled: () => false,
      getAliasTable: () => table,
    });
    const state = EditorState.create({ doc, schema, plugins });

    const pluginState = ENTITY_HIGHLIGHT_DECORATION_KEY.getState(
      state,
    ) as DecorationSet;
    expect(decorationRanges(pluginState)).toEqual([]);
  });

  it("the configured plugin's initial state decorates matches when enabled", () => {
    const doc = docFromText("Aria walked into the harbor.");
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);

    const plugins = buildPlugins({
      isEnabled: () => true,
      getAliasTable: () => table,
    });
    const state = EditorState.create({ doc, schema, plugins });

    const pluginState = ENTITY_HIGHLIGHT_DECORATION_KEY.getState(
      state,
    ) as DecorationSet;
    expect(decorationRanges(pluginState)).toHaveLength(1);
  });

  it("a recompute-signal transaction (flag toggle) never sets docChanged, so it can never trigger a persistence-boundary update", () => {
    // TipTapEditor.tsx dispatches exactly this transaction shape whenever the
    // combined gating flag or the cached alias table changes without the
    // document itself changing. `@tiptap/core`'s Editor only emits "update"
    // (the event onChange/save flows are wired to) when at least one
    // transaction in the batch has docChanged === true — asserting that
    // directly here proves this signal can never reach that boundary.
    const doc = docFromText("Aria walked into the harbor.");
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);
    const plugins = buildPlugins({
      isEnabled: () => true,
      getAliasTable: () => table,
    });
    const state = EditorState.create({ doc, schema, plugins });

    const tr = state.tr.setMeta(ENTITY_HIGHLIGHT_DECORATION_KEY, true);
    expect(tr.docChanged).toBe(false);

    const nextState = state.apply(tr);
    const pluginState = ENTITY_HIGHLIGHT_DECORATION_KEY.getState(
      nextState,
    ) as DecorationSet;
    // The recompute signal still refreshes decorations even though the doc
    // did not change (e.g. the alias table itself was refetched).
    expect(decorationRanges(pluginState)).toHaveLength(1);
  });

  it("a document-editing transaction (tr.docChanged) recomputes decorations to reflect the new text, with no meta signal needed (FR-5 trigger 1)", () => {
    // Starts with a document containing no entity mentions.
    const doc = docFromText("The rain fell all afternoon.");
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);
    const plugins = buildPlugins({
      isEnabled: () => true,
      getAliasTable: () => table,
    });
    let state = EditorState.create({ doc, schema, plugins });
    expect(
      decorationRanges(
        ENTITY_HIGHLIGHT_DECORATION_KEY.getState(state) as DecorationSet,
      ),
    ).toEqual([]);

    // Type "Aria " at the start of the paragraph's text — a plain document
    // edit, not a meta-flagged transaction.
    const insertAt = 1; // just inside the paragraph, before "The"
    const tr = state.tr.insertText("Aria ", insertAt);
    expect(tr.docChanged).toBe(true);
    expect(tr.getMeta(ENTITY_HIGHLIGHT_DECORATION_KEY)).toBeUndefined();

    state = state.apply(tr);
    const pluginState = ENTITY_HIGHLIGHT_DECORATION_KEY.getState(
      state,
    ) as DecorationSet;
    const ranges = decorationRanges(pluginState);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({
      from: insertAt,
      to: insertAt + 4,
      class: expect.stringContaining("entity-highlight"),
    });
  });

  it("a meta-signal transaction picks up a changed alias table (e.g. a newly declared alias) with no document mutation (FR-5 trigger 2)", () => {
    // Mirrors TipTapEditor.tsx's useEffect: on an alias-table change it
    // re-reads getAliasTable() and dispatches the plugin's own recompute
    // signal — never touching the document. This proves that flow actually
    // changes the rendered decoration set end to end, not just that the
    // plugin recomputes *something*.
    const doc = docFromText("Reeve walked into the harbor.");
    let table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);
    const plugins = buildPlugins({
      isEnabled: () => true,
      getAliasTable: () => table,
    });
    let state = EditorState.create({ doc, schema, plugins });
    expect(
      decorationRanges(
        ENTITY_HIGHLIGHT_DECORATION_KEY.getState(state) as DecorationSet,
      ),
    ).toEqual([]);

    // Entity declaration changes: "Aria" gains "Reeve" as a new alias — the
    // same kind of update `entityAliasTableSlice.ts` would push down after a
    // sidecar edit.
    table = buildAliasTable([
      { entityId: "e1", name: "Aria", aliases: ["Reeve"] },
    ]);

    const tr = state.tr.setMeta(ENTITY_HIGHLIGHT_DECORATION_KEY, true);
    expect(tr.docChanged).toBe(false);
    state = state.apply(tr);

    expect(state.doc.eq(doc)).toBe(true);
    const ranges = decorationRanges(
      ENTITY_HIGHLIGHT_DECORATION_KEY.getState(state) as DecorationSet,
    );
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({
      from: 1,
      to: 6,
      class: expect.stringContaining("entity-highlight"),
    });
  });

  it("toggling isEnabled off and recomputing via the meta signal clears decorations without any document mutation", () => {
    const doc = docFromText("Aria walked into the harbor.");
    const table = buildAliasTable([{ entityId: "e1", name: "Aria" }]);
    let isHighlightingEnabled = true;
    const plugins = buildPlugins({
      isEnabled: () => isHighlightingEnabled,
      getAliasTable: () => table,
    });
    let state = EditorState.create({ doc, schema, plugins });
    expect(
      decorationRanges(
        ENTITY_HIGHLIGHT_DECORATION_KEY.getState(state) as DecorationSet,
      ),
    ).toHaveLength(1);

    isHighlightingEnabled = false;
    const tr = state.tr.setMeta(ENTITY_HIGHLIGHT_DECORATION_KEY, true);
    state = state.apply(tr);

    expect(tr.docChanged).toBe(false);
    expect(state.doc.eq(doc)).toBe(true);
    expect(
      decorationRanges(
        ENTITY_HIGHLIGHT_DECORATION_KEY.getState(state) as DecorationSet,
      ),
    ).toEqual([]);
  });
});
