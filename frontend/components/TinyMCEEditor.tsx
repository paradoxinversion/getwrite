import React from "react";
import { Editor } from "@tinymce/tinymce-react";

export interface TinyMCEEditorProps {
    value?: string;
    onChange?: (content: string) => void;
    apiKey?: string;
    id?: string;
    readonly?: boolean;
}

/**
 * Thin wrapper around TinyMCE for placeholder editing in the UI.
 * - forwards `value` and calls `onChange(content)` on editor changes
 * - configures a small plugin/toolset suitable for placeholder editing
 * - disables branding and uses autoresize plugin
 *
 * Note: `apiKey` is forwarded to TinyMCE if provided.
 */
export default function TinyMCEEditor({
    value = "",
    onChange,
    apiKey,
    id,
    readonly = false,
}: TinyMCEEditorProps) {
    const handleChange = (content: string) => {
        if (onChange) onChange(content);
    };

    return (
        <div className="prose max-w-none">
            <Editor
                id={id}
                apiKey={apiKey}
                value={value}
                init={{
                    menubar: false,
                    statusbar: true,
                    plugins: ["lists", "link", "paste", "autoresize"],
                    toolbar:
                        "undo redo | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | link",
                    autoresize_bottom_margin: 16,
                    branding: false,
                }}
                onEditorChange={handleChange}
                readonly={readonly}
            />
        </div>
    );
}
