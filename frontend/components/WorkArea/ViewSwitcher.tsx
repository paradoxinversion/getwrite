import React from "react";
import { ViewName } from "../../lib/types";

export interface ViewSwitcherProps {
    /** Currently selected view */
    view: ViewName;
    /** Callback when the user selects a different view */
    onChange: (view: ViewName) => void;
    /** Optional className to allow styling from parent */
    className?: string;
}

const VIEW_OPTIONS: { key: ViewName; label: string }[] = [
    { key: "edit", label: "Edit" },
    { key: "organizer", label: "Organizer" },
    { key: "data", label: "Data" },
    { key: "diff", label: "Diff" },
    { key: "timeline", label: "Timeline" },
];

/**
 * `ViewSwitcher` renders a compact set of buttons allowing the user to switch
 * between work-area views. It is intentionally presentational and purely
 * controlled: the parent owns the selected `view` state.
 *
 * Example:
 *
 * ```tsx
 * <ViewSwitcher view={view} onChange={setView} />
 * ```
 */
export default function ViewSwitcher({
    view,
    onChange,
    className = "",
}: ViewSwitcherProps): JSX.Element {
    return (
        <div
            className={`flex items-center gap-2 ${className}`}
            role="tablist"
            aria-label="Work area views"
        >
            {VIEW_OPTIONS.map((opt) => {
                const active = opt.key === view;
                return (
                    <button
                        key={opt.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-pressed={active}
                        data-view={opt.key}
                        onClick={() => onChange(opt.key)}
                        onKeyDown={(e) => {
                            const container =
                                (e.currentTarget
                                    .parentElement as HTMLElement) || null;
                            const tabs = container
                                ? (Array.from(
                                      container.querySelectorAll(
                                          '[role="tab"]',
                                      ),
                                  ) as HTMLElement[])
                                : [];
                            const idx = tabs.indexOf(
                                e.currentTarget as HTMLElement,
                            );
                            if (e.key === "ArrowRight") {
                                const next = tabs[(idx + 1) % tabs.length];
                                next?.focus();
                                onChange(
                                    (next?.dataset.view as ViewName) ?? view,
                                );
                                e.preventDefault();
                            } else if (e.key === "ArrowLeft") {
                                const prev =
                                    tabs[(idx - 1 + tabs.length) % tabs.length];
                                prev?.focus();
                                onChange(
                                    (prev?.dataset.view as ViewName) ?? view,
                                );
                                e.preventDefault();
                            } else if (e.key === "Home") {
                                tabs[0]?.focus();
                                onChange(
                                    (tabs[0]?.dataset.view as ViewName) ?? view,
                                );
                                e.preventDefault();
                            } else if (e.key === "End") {
                                tabs[tabs.length - 1]?.focus();
                                onChange(
                                    (tabs[tabs.length - 1]?.dataset
                                        .view as ViewName) ?? view,
                                );
                                e.preventDefault();
                            } else if (e.key === "Enter" || e.key === " ") {
                                onChange(opt.key);
                                e.preventDefault();
                            }
                        }}
                        className={`px-3 py-1 rounded-md text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400
              ${active ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
