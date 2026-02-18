import React from "react";

export interface NotesInputProps {
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
    className?: string;
}

export default function NotesInput({
    value = "",
    placeholder = "Notes...",
    onChange,
    className = "",
}: NotesInputProps) {
    const [text, setText] = React.useState(value);

    React.useEffect(() => setText(value), [value]);

    return (
        <div className={className}>
            <label className="text-sm font-medium">Notes</label>
            <textarea
                aria-label="notes-input"
                className="w-full mt-2 p-2 border rounded resize-y min-h-[80px] text-sm"
                placeholder={placeholder}
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    onChange && onChange(e.target.value);
                }}
            />
        </div>
    );
}
