import React from "react";

export interface POVAutocompleteProps {
    options?: string[];
    value?: string;
    onChange?: (value: string) => void;
    className?: string;
}

export default function POVAutocomplete({
    options = [],
    value = "",
    onChange,
    className = "",
}: POVAutocompleteProps) {
    const [val, setVal] = React.useState(value);
    React.useEffect(() => setVal(value), [value]);

    return (
        <div className={className}>
            <label className="text-sm font-medium">POV</label>
            <input
                list="pov-options"
                aria-label="pov-input"
                className="w-full mt-2 p-2 border rounded text-sm"
                value={val}
                onChange={(e) => {
                    setVal(e.target.value);
                    onChange && onChange(e.target.value);
                }}
            />
            <datalist id="pov-options">
                {options.map((o) => (
                    <option key={o} value={o} />
                ))}
            </datalist>
        </div>
    );
}
