import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

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
        extensions: [StarterKit],
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
        <div className="prose max-w-none">
            <EditorContent editor={editor} id={id} />
        </div>
    );
}
