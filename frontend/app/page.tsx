"use client";
import React, { useState } from "react";
import AppShell from "../components/Layout/AppShell";
import StartPage from "../components/Start/StartPage";

/** Root page: render the application's start page inside the main shell. */
export default function Home() {
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
        null,
    );

    const handleOpen = (id: string) => {
        setSelectedProjectId(id);
    };

    return (
        <AppShell showSidebars={Boolean(selectedProjectId)}>
            <StartPage onOpen={handleOpen} />
        </AppShell>
    );
}
