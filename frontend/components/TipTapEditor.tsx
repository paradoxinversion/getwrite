/**
 * @module TipTapEditor
 *
 * Rich-text editor wrapper around TipTap with project-specific extension setup,
 * math node migration, toolbar integration, and test-environment fallbacks.
 *
 * Key responsibilities:
 * - Configure a consistent extension stack (text style, lists, alignment,
 *   placeholders, IDs, typography, math).
 * - Emit both HTML and TipTap JSON document snapshots on updates.
 * - Keep editor content synchronized when external `value` changes.
 * - Provide deterministic lightweight rendering in test environments.
 */
import "katex/dist/katex.min.css";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useEditor,
  EditorContent,
  EditorContext,
  Content,
} from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import debounce from "lodash/debounce";
import { TipTapDocument } from "../src/lib/models";
import { MenuBar } from "./Editor/MenuBar/MenuBar";
import MarkdownSourceView from "./Editor/MarkdownSourceView";
import MarkdownSwitchWarningModal from "./Editor/MarkdownSwitchWarningModal";
import {
  documentToMarkdown,
  markdownToDocument,
  collectMarkdownWarnings,
} from "../src/lib/export/markdown-serializer";
import type { MarkdownConstructWarning } from "../src/lib/export/types";
import Math, { migrateMathStrings } from "@tiptap/extension-mathematics";
import CustomHeading from "./Editor/Extensions/CustomHeading";
import NormalizePastedText from "./Editor/Extensions/NormalizePastedText";
import MediaDropExtension from "./Editor/Extensions/MediaDropExtension";
import GetWriteImage from "./Editor/Extensions/GetWriteImage";
import EntityHighlightDecoration, {
  ENTITY_HIGHLIGHT_DECORATION_KEY,
} from "./Editor/Extensions/EntityHighlightDecorationExtension";
import { baseSchemaExtensions } from "./Editor/editorExtensions";
import { useSelector } from "react-redux";
import { selectResolvedEditorConfig } from "../src/store/editorConfigSlice";
import {
  selectActiveProjectDirectoryId,
  selectEntityHighlightingEnabled,
  selectEntitiesEnabled,
} from "../src/store/projectsSlice";
import { selectEntityAliasTable } from "../src/store/entityAliasTableSlice";
import type { EntityAliasTable } from "../src/lib/models/entity-alias-table";
import { deriveSelectionNodeLabels } from "../src/lib/node-display-selection";

/**
 * Attributes applied to TipTap's `.ProseMirror` contenteditable — the app's
 * primary editing surface.
 *
 * `role`/`aria-multiline` are not decoration. A bare `contenteditable="true"`
 * div carries no role, so the editor did not appear in the accessibility tree
 * at all: assistive technology could not announce it as an editable field, and
 * accessibility-tree-driven automation had to fall back to the `.ProseMirror`
 * CSS selector because there was no role to query by.
 *
 * Exported so the contract can be asserted directly — the component renders a
 * simplified mock under test, so the real editor view never mounts there.
 */
export const EDITOR_SURFACE_ATTRIBUTES = {
  // Use focus:outline-none to remove the default browser outline
  // and optionally focus:ring-0 to remove the ring added by
  // the Tailwind CSS forms plugin (if used)
  class: "focus:outline-none focus:ring-0 h-full min-h-full px-4 py-4",
  role: "textbox",
  "aria-multiline": "true",
  "aria-label": "Document body",
} as const;

/**
 * Props accepted by {@link TipTapEditor}.
 */
export interface TipTapEditorProps {
  /**
   * Initial/controlled content provided to TipTap.
   *
   * Accepts any TipTap `Content` shape; when omitted, defaults to empty text.
   */
  value?: Content;
  /**
   * Called whenever editor content changes.
   *
   * @param content - Current editor content serialized as HTML.
   * @param doc - Current TipTap document serialized as JSON.
   */
  onChange?: (content: string, doc: TipTapDocument) => void;
  /** Optional DOM id applied to the `EditorContent` element. */
  id?: string;
  /** When true, disables editing interactions. */
  readonly?: boolean;
  /**
   * Called with the node-type label(s) at the current selection whenever they
   * change (e.g. `["Heading 2"]`, or `["Heading 2", "Body"]` for a selection
   * spanning multiple node types). Fires on creation, selection moves, and
   * content updates, but only when the resulting label list actually changes.
   */
  onNodeTypesChange?: (labels: string[]) => void;
}

/**
 * Shared base extension list for all runtime editor instances.
 *
 * Re-exported from the server-safe {@link baseSchemaExtensions} module so the
 * editor and the headless Markdown serializer share a single document-schema
 * definition.
 */
export const extensions = baseSchemaExtensions;

/**
 * Debounce window (ms) for source-mode autosave. Edits to the raw Markdown
 * buffer are re-parsed and pushed through `onChange` at most this often; the
 * canonical-revision write is debounced again downstream by the autosave queue.
 */
const SOURCE_AUTOSAVE_DEBOUNCE_MS = 400;

/**
 * Renders the TipTap editor with toolbar and project-specific behavior.
 *
 * Runtime behavior:
 * - Client-only editor initialization.
 * - Lightweight HTML mock in test environments.
 * - Debounced content synchronization handled by parent consumers.
 * - Math extension click handlers prompt for formula updates.
 *
 * @param props - {@link TipTapEditorProps}.
 * @returns Editor shell, loading placeholders, or test mock depending on
 *   environment and initialization state.
 *
 * @example
 * <TipTapEditor
 *   value={initialHtml}
 *   onChange={(html, doc) => saveDraft(html, doc)}
 *   readonly={false}
 * />
 */
export default function TipTapEditor({
  value = "",
  onChange,
  id,
  readonly = false,
  onNodeTypesChange,
}: TipTapEditorProps) {
  const editorProjectConfig = useSelector(selectResolvedEditorConfig);
  // The active project's on-disk directory basename — the `projectId`
  // every tenant-scoped resource route (ADR-017/018) expects. Threaded
  // through a ref (rather than a plain variable) so `MediaDropExtension`,
  // a non-React TipTap extension configured once at editor init, can read
  // the latest value without the editor being re-created on every project
  // switch. See `selectActiveProjectDirectoryId`'s doc comment in
  // `projectsSlice.ts` for the FR12 distinction from `project.id`.
  const activeProjectDirectoryId = useSelector(selectActiveProjectDirectoryId);
  const projectIdRef = useRef<string | null>(null);
  projectIdRef.current = activeProjectDirectoryId;

  // Entity highlighting (specs/features/entity-highlighting.md) only takes
  // effect when both flags are on (FR-1/FR-8). Threaded through refs, same
  // pattern as `projectIdRef` above, so `EntityHighlightDecoration` — a
  // non-React TipTap extension configured once at editor init — can read the
  // latest gating/alias-table state without the editor being re-created on
  // every flag toggle or alias-table refetch.
  const isEntityHighlightingEnabled = useSelector(
    selectEntityHighlightingEnabled,
  );
  const isEntitiesEnabled = useSelector(selectEntitiesEnabled);
  const entityHighlightingActiveRef = useRef(false);
  entityHighlightingActiveRef.current =
    isEntityHighlightingEnabled && isEntitiesEnabled;
  const entityAliasTable = useSelector(selectEntityAliasTable);
  const entityAliasTableRef = useRef<EntityAliasTable>(entityAliasTable);
  entityAliasTableRef.current = entityAliasTable;

  // Keep the latest callback in a ref so the editor's (init-time) handlers can
  // call it without being re-created when the prop identity changes.
  const onNodeTypesChangeRef = useRef(onNodeTypesChange);
  onNodeTypesChangeRef.current = onNodeTypesChange;
  // Keep the latest onChange in a ref so the debounced source-mode autosave can
  // emit through the current handler without re-creating the debounced function
  // (which would drop pending edits) on every parent re-render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Last emitted label list, joined, so repeat emits for the same node context
  // are suppressed (avoids churn on every keystroke / selection nudge).
  const lastNodeLabelsKeyRef = useRef<string | null>(null);

  /**
   * Compute the node-type labels at the editor's current selection and notify
   * the consumer only when they differ from the previous emission.
   */
  const emitNodeTypes = useCallback((editorInstance: Editor) => {
    const notify = onNodeTypesChangeRef.current;
    if (!notify) return;
    const labels = deriveSelectionNodeLabels(editorInstance.state);
    const key = labels.join("\u0000");
    if (key === lastNodeLabelsKeyRef.current) return;
    lastNodeLabelsKeyRef.current = key;
    notify(labels);
  }, []);

  /** True when executing in browser context (guards SSR/hydration paths). */
  const isClient = typeof window !== "undefined";

  /**
   * Test-environment guard used to bypass full ProseMirror lifecycle in jsdom.
   */
  const isTestEnv =
    typeof process !== "undefined" &&
    (process.env?.VITEST === "true" || process.env?.NODE_ENV === "test");

  // Tracks the TipTapDocument object most recently emitted by onUpdate so that
  // the content-sync useEffect can skip setContent when value was produced by
  // the editor itself (same object reference). Without this guard, every edit
  // triggers setContent → cursor reset because an object value never equals
  // the string returned by editor.getHTML().
  const lastEmittedDocRef = useRef<unknown>(null);

  // Editing mode for the current resource. "rich" shows the TipTap editor;
  // "source" shows raw GFM in a textarea. Conversion happens only at the
  // toggle boundary (non-goal: per-keystroke sync). The editor instance stays
  // mounted across the toggle so its document survives the round trip.
  const [mode, setMode] = useState<"rich" | "source">("rich");
  const [sourceText, setSourceText] = useState<string>("");

  // Pending "Edit as Markdown" confirmation. Non-null means the warning modal
  // is open; the value is the set of lossy constructs detected in the live
  // document, shown so the user knows exactly what the switch will affect.
  // Null means no confirmation is in progress.
  const [pendingSourceWarnings, setPendingSourceWarnings] = useState<
    MarkdownConstructWarning[] | null
  >(null);

  // During unit tests we avoid initializing TipTap (ProseMirror) because the
  // full editor lifecycle and extension loading can be brittle in jsdom.
  // Return a lightweight mock rendering instead and keep EditView's local
  // state consistent via the `initialContent` prop.
  // Serialized so that string value equality is used for comparison — TipTap
  // uses Object.is on each dep, and object references change on every Redux
  // dispatch even when the heading config is unchanged.
  const headingsConfigKey = JSON.stringify(editorProjectConfig.headings);

  const editor = useEditor(
    {
      shouldRerenderOnTransaction: true,
      extensions: [
        // Swap the bare GetWriteImage (used by the markdown serializer with no
        // project context) for one wired to the live directory id, so stored
        // image srcs are rebuilt from resourceId + projectId on render and a
        // stale `?projectPath=` URL self-heals. Identity filter avoids a
        // duplicate "image" node.
        ...extensions.filter((extension) => extension !== GetWriteImage),
        GetWriteImage.configure({ getProjectId: () => projectIdRef.current }),
        CustomHeading.configure({
          customStyles: editorProjectConfig.headings || {},
        }),
        NormalizePastedText.configure({
          bodyFontSize: editorProjectConfig.body?.fontSize,
        }),
        MediaDropExtension.configure({
          getProjectId: () => projectIdRef.current,
        }),
        EntityHighlightDecoration.configure({
          isEnabled: () => entityHighlightingActiveRef.current,
          getAliasTable: () => entityAliasTableRef.current,
        }),
        Math.configure({
          blockOptions: {
            /**
             * Handles block-math click edits by prompting and updating
             * the selected node in-place.
             */
            onClick: (node, pos) => {
              const newCalculation = prompt(
                "Enter new calculation:",
                node.attrs.latex,
              );
              if (newCalculation && editor) {
                editor
                  .chain()
                  .setNodeSelection(pos)
                  .updateBlockMath({ latex: newCalculation })
                  .focus()
                  .run();
              }
            },
          },
          inlineOptions: {
            /**
             * Handles inline-math click edits by prompting and updating
             * the selected inline node.
             */
            onClick: (node) => {
              const newCalculation = prompt(
                "Enter new calculation:",
                node.attrs.latex,
              );
              if (newCalculation && editor) {
                editor
                  .chain()
                  .updateInlineMath({ latex: newCalculation })
                  .focus()
                  .run();
              }
            },
          },
        }),
      ],
      content: value || "",
      editable: !readonly,
      /**
       * Emits both HTML and JSON representations for parent persistence flows.
       */
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        const doc = editor.getJSON() as TipTapDocument;
        lastEmittedDocRef.current = doc;
        if (onChange) onChange(html, doc);
        // Content edits can change a node's type (e.g. a heading downgraded to
        // body), even without the selection moving.
        emitNodeTypes(editor);
      },
      /**
       * Reports the node type(s) at the new selection as the cursor moves.
       */
      onSelectionUpdate: ({ editor }) => {
        emitNodeTypes(editor);
      },
      /**
       * Migrates legacy math string representations to node-based format.
       */
      onCreate: ({ editor }) => {
        migrateMathStrings(editor);
        editor
          .chain()
          .selectAll()
          .setParagraphLeading("1.5")
          .setTextSelection(0) // collapse cursor to start, or wherever you want
          .run();
        // Populate the initial node-type indicator for the starting cursor.
        emitNodeTypes(editor);
      },
      // avoid SSR hydration mismatches by explicitly opting out of
      // immediate render on the server
      immediatelyRender: false,
      editorProps: { attributes: EDITOR_SURFACE_ATTRIBUTES },
    },
    [headingsConfigKey],
  );

  /**
   * Commit the current Markdown source buffer through the normal persistence
   * path: parse GFM → document, load it into the (hidden) editor without
   * emitting an update, then push HTML + JSON to the consumer's `onChange` so
   * the canonical-revision autosave records it. Shared by the debounced
   * source-mode autosave below and by {@link switchToRich}. Reads `onChange`
   * from a ref so the debounced scheduler stays stable across parent renders.
   */
  const commitSourceMarkdown = useCallback(
    (markdown: string) => {
      if (!editor) return;
      const doc = markdownToDocument(markdown) as Content;
      editor.commands.setContent(doc, { emitUpdate: false });
      const html = editor.getHTML();
      const json = editor.getJSON() as TipTapDocument;
      lastEmittedDocRef.current = json;
      onChangeRef.current?.(html, json);
    },
    [editor],
  );

  /**
   * Debounced source-mode autosave. While editing raw Markdown there is no live
   * editor `onUpdate`, so without this a resource/revision switch would silently
   * drop the buffer. It is cancelled on toggle-back, on external `value` swaps,
   * and on unmount so a late fire can never write the old buffer into a
   * newly-selected resource (the consumer's `onChange` is rebound on switch).
   */
  const scheduleSourceCommit = useMemo(
    () => debounce(commitSourceMarkdown, SOURCE_AUTOSAVE_DEBOUNCE_MS),
    [commitSourceMarkdown],
  );

  /**
   * Forces `EntityHighlightDecoration`'s plugin state to recompute when a
   * gating input changes without the document itself changing — a feature
   * flag toggle or a freshly fetched alias table. The plugin only rebuilds on
   * `tr.docChanged` by default (matching `WikiLinkDecoration`'s cadence for
   * FR-9 performance), so this dispatches a no-op transaction carrying the
   * plugin's own meta flag to signal "recompute anyway". Decoration-only:
   * this transaction never changes document content and triggers no
   * `onUpdate`/persistence call.
   */
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(ENTITY_HIGHLIGHT_DECORATION_KEY, true),
    );
  }, [
    editor,
    isEntityHighlightingEnabled,
    isEntitiesEnabled,
    entityAliasTable,
  ]);

  useEffect(() => {
    return () => {
      scheduleSourceCommit.cancel();
    };
  }, [scheduleSourceCommit]);

  /**
   * Source textarea change handler: keep the buffer in local state and schedule
   * a debounced autosave so source-mode edits survive a resource switch.
   */
  const handleSourceChange = useCallback(
    (next: string) => {
      setSourceText(next);
      scheduleSourceCommit(next);
    },
    [scheduleSourceCommit],
  );

  /**
   * Synchronizes externally provided `value` into TipTap when it diverges
   * from the editor's current content.
   *
   * Skip when `value` is the exact object most recently emitted by `onUpdate`
   * — the editor already has that content, and calling setContent would reset
   * the cursor. Only call setContent for external changes (loading a revision,
   * switching resources) where `value` is a different object reference.
   */
  useEffect(() => {
    if (!editor) return;
    // If value is the same reference we just emitted, the editor already
    // has this content. Calling setContent would reset the cursor position.
    if (value === lastEmittedDocRef.current) return;
    const current = editor.getHTML();
    if (value !== current) {
      // Use a minimal, explicit cast to satisfy the Tiptap typing
      // while preserving the previous behaviour (no-emitted update).
      // TODO: refine to the precise options type when migrating tiptap types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.commands.setContent(value || "", false as any);
      // The content swap resets the selection; refresh the node-type indicator
      // so it reflects the newly loaded document (resource/revision switch)
      // rather than a stale value carried over from the previous one.
      lastNodeLabelsKeyRef.current = null;
      emitNodeTypes(editor);
      // Cancel any pending source-mode autosave first: a late fire after the
      // swap would push the previous buffer into the now-selected resource.
      scheduleSourceCommit.cancel();
      // An external content swap (resource/revision switch) invalidates any
      // in-progress source edit; return to the rich view so the user sees the
      // newly loaded document rather than stale Markdown.
      setMode("rich");
    }
  }, [value, editor, emitNodeTypes, scheduleSourceCommit]);

  /**
   * Handle the "Edit as Markdown" toolbar action: inspect the live document for
   * formatting GFM cannot represent and open the confirmation modal. The actual
   * switch is deferred to {@link switchToSource}, run only if the user confirms,
   * so no conversion happens behind their back.
   */
  const requestSwitchToSource = useCallback(() => {
    if (!editor) return;
    setPendingSourceWarnings(collectMarkdownWarnings(editor.getJSON()));
  }, [editor]);

  /**
   * Enter Markdown source mode: serialize the live document to GFM and show it
   * in the textarea. Conversion happens here, at the toggle boundary. Invoked
   * only after the user confirms the warning modal.
   */
  const switchToSource = useCallback(() => {
    if (!editor) return;
    setSourceText(documentToMarkdown(editor.getJSON()));
    setPendingSourceWarnings(null);
    setMode("source");
  }, [editor]);

  /**
   * Return to rich mode: flush the source buffer through the shared commit path
   * (parse GFM → document, load it, emit for autosave), then swap the view back.
   * Cancels the pending debounced autosave first so it can't double-fire after
   * we have already committed synchronously here.
   */
  const switchToRich = useCallback(() => {
    if (!editor) return;
    scheduleSourceCommit.cancel();
    commitSourceMarkdown(sourceText);
    lastNodeLabelsKeyRef.current = null;
    emitNodeTypes(editor);
    setMode("rich");
  }, [
    editor,
    sourceText,
    emitNodeTypes,
    commitSourceMarkdown,
    scheduleSourceCommit,
  ]);

  if (!isClient) return <div>Loading editor...</div>;

  if (isTestEnv) {
    // Minimal mock for tests: render content as plain HTML so components
    // that read initial content (like EditView) behave deterministically.
    return (
      <div data-testid="tiptap-mock" className="tiptap-editor-shell">
        <div dangerouslySetInnerHTML={{ __html: value || "" }} />
      </div>
    );
  }

  if (!editor) return <div>Loading editor...</div>;

  const bodyStyle = {
    "--gw-body-font-family": editorProjectConfig.body?.fontFamily,
    "--gw-body-font-size": editorProjectConfig.body?.fontSize,
    "--gw-body-line-height": editorProjectConfig.body?.lineHeight,
    "--gw-paragraph-spacing": editorProjectConfig.body?.paragraphSpacing,
  } as React.CSSProperties;

  return (
    <EditorContext.Provider value={{ editor }}>
      <div className="tiptap-editor-shell" style={bodyStyle}>
        {mode === "source" ? (
          <MarkdownSourceView
            id={id}
            value={sourceText}
            onChange={handleSourceChange}
            onExitToRichText={switchToRich}
          />
        ) : (
          <>
            <MenuBar
              editor={editor}
              onToggleSource={readonly ? undefined : requestSwitchToSource}
            />
            <EditorContent
              editor={editor}
              id={id}
              className="tiptap tiptap-editor-content"
            />
          </>
        )}
        <MarkdownSwitchWarningModal
          isOpen={pendingSourceWarnings !== null}
          warnings={pendingSourceWarnings ?? []}
          onConfirm={switchToSource}
          onCancel={() => setPendingSourceWarnings(null)}
        />
      </div>
    </EditorContext.Provider>
  );
}
