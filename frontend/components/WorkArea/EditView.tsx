import React from "react";
import TipTapEditor from "../TipTapEditor";

export interface EditViewProps {
    /** Initial editor content (HTML or plain text) */
    initialContent?: string;
    /** Called when content changes */
    onChange?: (content: string) => void;
}

/**
 * `EditView` provides a simple editing surface using `TipTapEditor` and a
 * footer that displays lightweight stats such as word count and a last-saved
 * timestamp (placeholder only).
 *
 * It is intentionally presentational — saving is not implemented.
 */
export default function EditView({
    initialContent = "",
    apiKey,
    onChange,
}: EditViewProps): JSX.Element {
    const [content, setContent] = React.useState<string>(initialContent);

    const handleChange = (next: string) => {
        setContent(next);
        if (onChange) onChange(next);
    };

    const wordCount = React.useMemo(() => {
        if (!content) return 0;
        // strip HTML tags if present, then count words
        const text = content
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return text ? text.split(" ").length : 0;
    }, [content]);

    const lastSaved = React.useMemo(() => new Date().toLocaleString(), []);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto p-4">
                <TipTapEditor
                    id="editview-editor"
                    value={content}
                    onChange={handleChange}
                    readonly={false}
                />
            </div>

            <div className="border-t px-4 py-2 bg-white text-sm flex items-center justify-between">
                <div className="text-slate-600">
                    Words: <strong>{wordCount}</strong>
                </div>
                <div className="text-slate-500">
                    Last saved: <span>{lastSaved}</span>
                </div>
            </div>
        </div>
    );
}
