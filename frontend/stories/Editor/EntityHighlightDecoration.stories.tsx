import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import EntityHighlightDecoration from "../../components/Editor/Extensions/EntityHighlightDecorationExtension";
import type { EntityAliasTable } from "../../src/lib/models/entity-alias-table";

/**
 * `specs/features/entity-highlighting.md`, Task 10.
 *
 * Renders a real TipTap `Editor` (unlike this feature's unit tests, which
 * deliberately avoid mounting one — see
 * `tests/unit/entity-highlight-decoration-extension.test.ts`'s module
 * comment) so the two `entity-highlight` visual states can be inspected and
 * a11y-checked as actual rendered DOM, the way a Storybook story is meant
 * to be used.
 *
 * The sample alias table declares three entities so the document exercises
 * both FR-10 states in one view:
 *  - "Kaelith Dawnbringer" — an unambiguous name, renders `--plain`.
 *  - "Sam" — flagged by `entity-alias-warnings.ts` as a short/common word,
 *    renders `--needs-attention`.
 *  - "Aria", declared by two different entities (`claimedBy`-ambiguous),
 *    renders `--needs-attention` for the opposite reason.
 */

const SAMPLE_ALIAS_TABLE: EntityAliasTable = {
  entities: {
    "entity-kaelith": {
      entityId: "entity-kaelith",
      entityKind: "character",
      name: "Kaelith Dawnbringer",
      aliases: [],
      terms: ["Kaelith Dawnbringer"],
    },
    "entity-sam": {
      entityId: "entity-sam",
      entityKind: "character",
      name: "Sam",
      aliases: [],
      terms: ["Sam"],
    },
    "entity-aria-1": {
      entityId: "entity-aria-1",
      entityKind: "character",
      name: "Aria",
      aliases: [],
      terms: ["Aria"],
    },
    "entity-aria-2": {
      entityId: "entity-aria-2",
      entityKind: "place",
      name: "Aria",
      aliases: [],
      terms: ["Aria"],
    },
  },
  claimedBy: { aria: ["entity-aria-1", "entity-aria-2"] },
};

const SAMPLE_DOCUMENT = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Kaelith Dawnbringer crossed the bridge at dawn, thinking of Sam and of Aria in the same breath.",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Kaelith's resolve steadied when Sam finally spoke, though no one was sure which Aria he meant.",
        },
      ],
    },
  ],
};

interface EntityHighlightDemoProps {
  /** Whether the highlighting plugin should run at all — mirrors the
   * `selectEntityHighlightingEnabled && selectEntitiesEnabled` gate
   * `TipTapEditor.tsx` threads in via `.configure({ isEnabled })`. */
  isEnabled: boolean;
}

function EntityHighlightDemo({ isEnabled }: EntityHighlightDemoProps) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      editorProps: {
        // Mirrors `TipTapEditor.tsx`'s `EDITOR_SURFACE_ATTRIBUTES` — a
        // contenteditable surface needs an accessible name, which the real
        // editor already supplies.
        attributes: {
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "Document body",
        },
      },
      extensions: [
        StarterKit,
        EntityHighlightDecoration.configure({
          isEnabled: () => isEnabled,
          getAliasTable: () => SAMPLE_ALIAS_TABLE,
        }),
      ],
      content: SAMPLE_DOCUMENT,
    },
    [isEnabled],
  );

  return (
    <div className="tiptap" style={{ maxWidth: 640, padding: 24 }}>
      <EditorContent editor={editor} />
    </div>
  );
}

const meta = {
  title: "Editor/EntityHighlightDecoration",
  component: EntityHighlightDemo,
  parameters: {
    docs: {
      description: {
        component:
          "The two entity-highlight visual states (`entity-highlight--plain` " +
          "and `entity-highlight--needs-attention`) rendered by " +
          "`EntityHighlightDecorationExtension` inside a live TipTap editor. " +
          "Neither state uses the reserved red token, and neither changes " +
          "the editor's line-height.",
      },
    },
  },
  argTypes: { isEnabled: { control: "boolean" } },
} satisfies Meta<typeof EntityHighlightDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Both highlighting flags are effectively "on" (`isEnabled` true): a plain
 * unambiguous match ("Kaelith Dawnbringer") and two "needs attention"
 * matches — one short/common-word-flagged ("Sam"), one ambiguously claimed
 * ("Aria") — render side by side.
 */
export const BothStates: Story = { args: { isEnabled: true } };

/**
 * With highlighting disabled (mirrors either `selectEntityHighlightingEnabled`
 * or `selectEntitiesEnabled` being false), the same document renders with no
 * highlight decorations at all — per FR-9, the plugin does no matching work.
 */
export const Disabled: Story = { args: { isEnabled: false } };
