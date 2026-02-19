"use client";
import React from "react";
import AppShell from "../components/Layout/AppShell";
import StartPage from "../components/Start/StartPage";

/** Root page: render the application's start page inside the main shell. */
export default function Home() {
    return (
        <AppShell>
            <StartPage />
        </AppShell>
    );
}
