import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { computeEntityHighlightRanges } from "./entityHighlightDecoration";
import type { EntityAliasTable } from "../../../src/lib/models/entity-alias-table";

/**
 * @module EntityHighlightDecorationExtension
 *
 * TipTap `Extension` wrapper (Task 9, `specs/features/entity-highlighting.md`)
 * around Task 8's pure `computeEntityHighlightRanges` core
 * (`./entityHighlightDecoration.ts`). Mirrors `./WikiLinkDecoration.ts`'s
 * `Plugin`/`PluginKey`/`DecorationSet` shape: a ProseMirror plugin whose
 * state is a `DecorationSet` rebuilt from the live, unsaved document on each
 * document-changing transaction.
 *
 * Named `EntityHighlightDecorationExtension` (rather than the task's
 * suggested `EntityHighlightDecoration.ts`) because this repo's checkout is
 * on a case-insensitive filesystem (macOS/APFS default) where that name
 * collides with Task 8's `entityHighlightDecoration.ts` — the two would be
 * the same file on disk despite differing only in the first letter's case,
 * so writing one silently clobbered the other.
 *
 * ## Gating (FR-1/FR-8/FR-9)
 *
 * Highlighting only takes effect when both `selectEntityHighlightingEnabled`
 * and `selectEntitiesEnabled` (`projectsSlice.ts`) are true. The caller
 * (`TipTapEditor.tsx`) resolves that combined boolean from Redux and threads
 * it in via `configure({ isEnabled })`, the same "live value via ref, read
 * through a getter passed at `.configure()` time" pattern already used by
 * `MediaDropExtension`/`GetWriteImage` (`getProjectId: () => ref.current`) —
 * this keeps the TipTap editor instance stable across flag toggles instead of
 * being re-created.
 *
 * `buildEntityHighlightDecorations` checks `isEnabled()` *before* calling
 * `getAliasTable()` or `computeEntityHighlightRanges` at all — per FR-9, the
 * scan must not run, not merely "run and produce nothing", when either flag
 * is off.
 *
 * This extension only ever produces `Decoration.inline` markers; it never
 * dispatches a transaction that changes document content and never reads or
 * writes `content.txt`, `content.tiptap.json`, the sidecar, or any index
 * file (per FR-2/FR-3/FR-4, matching + rendering both run purely in-memory
 * against the live ProseMirror `doc` passed to it).
 */

/** Options accepted by {@link EntityHighlightDecorationExtension}'s `.configure(...)`. */
export interface EntityHighlightDecorationOptions {
  /**
   * Returns whether highlighting should currently take effect — i.e. the
   * conjunction of `selectEntityHighlightingEnabled` and
   * `selectEntitiesEnabled`. Read on every transaction via a ref-backed
   * getter so toggling either flag does not require recreating the editor.
   */
  isEnabled: () => boolean;
  /**
   * Returns the active project's current `EntityAliasTable`
   * (`entityAliasTableSlice.ts`'s `selectEntityAliasTable`). Read via a
   * ref-backed getter for the same reason as `isEnabled`.
   */
  getAliasTable: () => EntityAliasTable;
}

/** The empty alias table, used only as an `addOptions` default. */
const EMPTY_ALIAS_TABLE: EntityAliasTable = { entities: {}, claimedBy: {} };

/** CSS class applied to a match that needs no user attention. */
const PLAIN_MATCH_CLASS = "entity-highlight entity-highlight--plain";

/** CSS class applied to a match flagged ambiguous and/or short/common. */
const NEEDS_ATTENTION_CLASS =
  "entity-highlight entity-highlight--needs-attention";

/**
 * Builds the `DecorationSet` for `doc` given the current gating/alias-table
 * inputs. Exported (mirroring `buildWikiLinkDecorations`) so it can be unit
 * tested directly without going through TipTap's `Editor`/`Extension`
 * machinery.
 *
 * When `options.isEnabled()` is false, returns `DecorationSet.empty`
 * *without* calling `options.getAliasTable()` or
 * `computeEntityHighlightRanges` — the hard FR-9 requirement that a disabled
 * highlighter does zero matching work, not just "matches and discards".
 */
export function buildEntityHighlightDecorations(
  doc: ProseMirrorNode,
  options: EntityHighlightDecorationOptions,
): DecorationSet {
  if (!options.isEnabled()) return DecorationSet.empty;

  const aliasTable = options.getAliasTable();
  const ranges = computeEntityHighlightRanges(doc, aliasTable);
  if (ranges.length === 0) return DecorationSet.empty;

  const decorations = ranges.map((range) =>
    Decoration.inline(range.from, range.to, {
      class:
        range.state === "needs-attention"
          ? NEEDS_ATTENTION_CLASS
          : PLAIN_MATCH_CLASS,
      ...(range.reason
        ? {
            title: range.reason.ambiguousClaim
              ? `"${range.matchedText}" could refer to more than one entity`
              : `"${range.matchedText}" is a short or common word`,
          }
        : {}),
    }),
  );

  return DecorationSet.create(doc, decorations);
}

/**
 * Plugin key exported so a host component can dispatch a meta transaction
 * (e.g. `tr.setMeta(ENTITY_HIGHLIGHT_DECORATION_KEY, true)`) to force a
 * recompute when the gating inputs change without the document itself
 * changing (a feature-flag toggle or a freshly fetched alias table).
 */
export const ENTITY_HIGHLIGHT_DECORATION_KEY = new PluginKey(
  "entityHighlightDecoration",
);

/**
 * Decorates declared entity names/aliases found in the live document with an
 * `entity-highlight` CSS class (FR-10's two visual states), gated on both
 * `selectEntityHighlightingEnabled` and `selectEntitiesEnabled`. Does not
 * modify the underlying document — purely a visual decoration, rebuilt on
 * each document-changing transaction or on an explicit recompute signal.
 */
const EntityHighlightDecorationExtension =
  Extension.create<EntityHighlightDecorationOptions>({
    name: "entityHighlightDecoration",

    addOptions(): EntityHighlightDecorationOptions {
      return { isEnabled: () => false, getAliasTable: () => EMPTY_ALIAS_TABLE };
    },

    addProseMirrorPlugins() {
      const { isEnabled, getAliasTable } = this.options;

      return [
        new Plugin({
          key: ENTITY_HIGHLIGHT_DECORATION_KEY,
          state: {
            init: (_, { doc }) =>
              buildEntityHighlightDecorations(doc, {
                isEnabled,
                getAliasTable,
              }),
            apply: (tr, old) => {
              if (
                tr.docChanged ||
                tr.getMeta(ENTITY_HIGHLIGHT_DECORATION_KEY)
              ) {
                return buildEntityHighlightDecorations(tr.doc, {
                  isEnabled,
                  getAliasTable,
                });
              }
              return old;
            },
          },
          props: {
            decorations(state) {
              return this.getState(state);
            },
          },
        }),
      ];
    },
  });

export default EntityHighlightDecorationExtension;
