import React from "react";
import type { Resource } from "../../lib/types";

export interface MetadataSidebarProps {
    resource?: Resource;
    onChangeNotes?: (text: string) => void;
    onChangeStatus?: (status: string) => void;
    className?: string;
}

export default function MetadataSidebar({
    resource,
    onChangeNotes,
    onChangeStatus,
    className = "",
}: MetadataSidebarProps): JSX.Element {
    const [notes, setNotes] = React.useState(resource?.metadata?.notes ?? "");
    const [status, setStatus] = React.useState(
        resource?.metadata?.status ?? "draft",
    );

    React.useEffect(() => {
        setNotes(resource?.metadata?.notes ?? "");
        setStatus(resource?.metadata?.status ?? "draft");
    }, [resource]);

    return (
        <aside
            className={`p-4 bg-slate-50 border-l ${className}`}
            aria-label="metadata-sidebar"
        >
            <div className="mb-4">
                <h3 className="text-sm font-semibold">Notes</h3>
                <textarea
                    aria-label="notes"
                    className="w-full mt-2 p-2 border rounded resize-y min-h-[96px] text-sm"
                    value={notes}
                    onChange={(e) => {
                        setNotes(e.target.value);
                        onChangeNotes && onChangeNotes(e.target.value);
                    }}
                />
            </div>

            <div className="mb-4">
                <h3 className="text-sm font-semibold">Status</h3>
                <select
                    aria-label="status"
                    className="w-full mt-2 p-2 border rounded text-sm"
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value);
                        onChangeStatus && onChangeStatus(e.target.value);
                    }}
                >
                    <option value="draft">Draft</option>
                    <option value="review">In review</option>
                    <option value="published">Published</option>
                </select>
            </div>

            <div className="mb-4">
                <h3 className="text-sm font-semibold">Characters</h3>
                <div className="mt-2 text-sm text-slate-600">
                    (placeholder list)
                </div>
            </div>

            <div className="mb-4">
                <h3 className="text-sm font-semibold">Locations</h3>
                <div className="mt-2 text-sm text-slate-600">
                    (placeholder list)
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold">Items</h3>
                <div className="mt-2 text-sm text-slate-600">
                    (placeholder list)
                </div>
            </div>
        </aside>
    );
}
