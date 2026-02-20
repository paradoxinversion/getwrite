import React, { useEffect } from "react";
import { useEditor, EditorContent, EditorContext } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { HeadingDropdownMenu } from "../@/components/tiptap-ui/heading-dropdown-menu";
// import { UndoRedoButton } from "./tiptap-ui/undo-redo-button";
// import { TextAlignButton } from "./tiptap-ui/text-align-button";
import { TextAlign } from "@tiptap/extension-text-align";

export interface TipTapEditorProps {
    value?: string;
    onChange?: (content: string) => void;
    id?: string;
    readonly?: boolean;
}

export default function TipTapEditor({
    value = "",
    onChange,
    id,
    readonly = false,
}: TipTapEditorProps) {
    const isClient = typeof window !== "undefined";

    const editor = useEditor({
        extensions: [
            StarterKit,
            TextAlign.configure({ types: ["heading", "paragraph"] }),
        ],
        content: value || "",
        editable: !readonly,
        onUpdate: ({ editor }) => {
            if (onChange) onChange(editor.getHTML());
        },
        // avoid SSR hydration mismatches by explicitly opting out of
        // immediate render on the server
        immediatelyRender: false,
    });

    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (value !== current) {
            editor.commands.setContent(value || "", false);
        }
    }, [value, editor]);

    if (!isClient) return <div>Loading editor...</div>;

    if (!editor) return <div>Loading editor...</div>;

    return (
        <EditorContext.Provider value={{ editor }}>
            <div className="prose max-w-none">
                <div className="flex">
                    {/* <HeadingDropdownMenu editor={editor} />
                    <UndoRedoButton
                        editor={editor}
                        action="undo"
                        // text="Undo"
                        hideWhenUnavailable={false}
                        // showShortcut={true}
                        onExecuted={() => console.log("Action executed!")}
                    />
                    <UndoRedoButton
                        editor={editor}
                        action="redo"
                        // text="Redo"
                        hideWhenUnavailable={false}
                        // showShortcut={true}
                        onExecuted={() => console.log("Action executed!")}
                    />
                    <TextAlignButton editor={editor} align="left" />
                    <TextAlignButton editor={editor} align="center" />
                    <TextAlignButton editor={editor} align="right" />
                    <TextAlignButton editor={editor} align="justify" /> */}
                </div>
                <EditorContent editor={editor} id={id} />
            </div>
        </EditorContext.Provider>
    );
}
