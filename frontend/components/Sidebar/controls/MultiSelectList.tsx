import React from "react";

export interface MultiSelectListProps {
    items: string[];
    selected?: string[];
    onChange?: (selected: string[]) => void;
    className?: string;
    label?: string;
}

export default function MultiSelectList({
    items,
    selected = [],
    onChange,
    className = "",
    label = "Items",
}: MultiSelectListProps) {
    const [sel, setSel] = React.useState<string[]>(selected);
    React.useEffect(() => setSel(selected), [selected]);

    const toggle = (item: string) => {
        const next = sel.includes(item)
            ? sel.filter((s) => s !== item)
            : [...sel, item];
        setSel(next);
        onChange && onChange(next);
    };

    return (
        <div className={className}>
            <label className="text-sm font-medium">{label}</label>
            <div className="mt-2 space-y-2">
                {items.map((it) => (
                    <label key={it} className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            aria-label={it}
                            checked={sel.includes(it)}
                            onChange={() => toggle(it)}
                        />
                        <span>{it}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}
