import React from "react";

export interface StatusSelectorProps {
    value?: string;
    onChange?: (value: string) => void;
    className?: string;
}

export default function StatusSelector({
    value = "draft",
    onChange,
    className = "",
}: StatusSelectorProps) {
    const [status, setStatus] = React.useState(value);
    React.useEffect(() => setStatus(value), [value]);

    return (
        <div className={className}>
            <label className="text-sm font-medium">Status</label>
            <select
                aria-label="status-select"
                className="w-full mt-2 p-2 border rounded text-sm"
                value={status}
                onChange={(e) => {
                    setStatus(e.target.value);
                    onChange && onChange(e.target.value);
                }}
            >
                <option value="draft">Draft</option>
                <option value="review">In review</option>
                <option value="published">Published</option>
            </select>
        </div>
    );
}
