import React from "react";
import AppShell from "../components/Layout/AppShell";

export default function Home() {
    return (
        <AppShell>
            <div>
                <h1 className="text-3xl font-semibold">
                    GetWrite — UI (placeholder)
                </h1>
                <p className="mt-4 text-slate-600">
                    This is a UI-only scaffold. Use Storybook and the components
                    directory to build features.
                </p>
            </div>
        </AppShell>
    );
}
