import React from "react";

/**
 * Simple three-column shell used in the app and Storybook:
 * - Left: Projects/Resource tree placeholder
 * - Center: Work area for views and editor
 * - Right: Metadata sidebar placeholder
 *
 * Designed for visual layout only; integrate `ResourceTree` and `MetadataSidebar` in later tasks.
 */
export default function AppShell({ children }: { children?: React.ReactNode }) {
    return (
        <div className="min-h-screen flex bg-slate-50 text-slate-900">
            <aside className="w-72 bg-white border-r p-4">
                <div className="text-sm font-medium text-slate-700 mb-4">
                    Projects
                </div>
                <div className="space-y-2">
                    <div className="px-3 py-2 rounded hover:bg-slate-100">
                        Project A
                    </div>
                    <div className="px-3 py-2 rounded hover:bg-slate-100">
                        Project B
                    </div>
                    <div className="px-3 py-2 rounded hover:bg-slate-100">
                        Project C
                    </div>
                </div>
            </aside>

            <main className="flex-1 p-6">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-white rounded shadow-sm p-6">
                        {children ?? (
                            <div>
                                <h2 className="text-2xl font-semibold">
                                    Work Area
                                </h2>
                                <p className="mt-2 text-sm text-slate-600">
                                    Placeholder editor and views go here.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <aside className="w-80 bg-white border-l p-4">
                <div className="text-sm font-medium text-slate-700 mb-4">
                    Metadata
                </div>
                <div className="text-sm text-slate-600">
                    Select a resource to view metadata.
                </div>
            </aside>
        </div>
    );
}
