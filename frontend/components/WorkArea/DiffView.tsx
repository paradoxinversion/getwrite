import React from "react";

export interface Revision {
    id: string;
    label: string;
    timestamp?: string;
    summary?: string;
}

export interface DiffViewProps {
    /** Left-hand content (read-only HTML or plain text) */
    leftContent?: string;
    /** Right-hand content (read-only HTML or plain text) */
    rightContent?: string;
    /** Revisions available to select */
    revisions?: Revision[];
    /** Called when a revision is selected from the list */
    onSelectRevision?: (revId: string) => void;
    className?: string;
}

/**
 * `DiffView` presents two read-only panes side-by-side for comparing
 * content and a revision list allowing selection. It is intentionally
 * presentational and controlled via props.
 */
export default function DiffView({
    leftContent = "",
    rightContent = "",
    revisions = [],
    onSelectRevision,
    className = "",
}: DiffViewProps): JSX.Element {
    return (
        <div className={`p-4 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Diff</h2>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                    <section className="flex-1 p-3 bg-white rounded-md border">
                        <h3 className="text-sm font-medium mb-2">Left</h3>
                        <div
                            className="prose max-w-none text-sm"
                            aria-label="left-pane"
                            dangerouslySetInnerHTML={{
                                __html: String(leftContent),
                            }}
                        />
                    </section>

                    <section className="flex-1 p-3 bg-white rounded-md border">
                        <h3 className="text-sm font-medium mb-2">Right</h3>
                        <div
                            className="prose max-w-none text-sm"
                            aria-label="right-pane"
                            dangerouslySetInnerHTML={{
                                __html: String(rightContent),
                            }}
                        />
                    </section>
                </div>

                <aside className="w-full p-3 bg-white rounded-md border">
                    <h4 className="text-sm font-medium mb-2">Revisions</h4>
                    <ul className="space-y-2">
                        {revisions.map((r) => (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onSelectRevision &&
                                        onSelectRevision(r.id)
                                    }
                                    className="w-full text-left p-2 rounded hover:bg-slate-50 text-sm"
                                >
                                    <div className="font-medium">{r.label}</div>
                                    <div className="text-xs text-slate-500">
                                        {r.timestamp ?? ""}
                                    </div>
                                    {r.summary && (
                                        <div className="text-xs text-slate-400">
                                            {r.summary}
                                        </div>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>
        </div>
    );
}
