import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchBar from "../components/Layout/SearchBar";
import type { Resource } from "../lib/types";

describe("SearchBar", () => {
    it("shows matches and calls onSelect when clicked", () => {
        const now = new Date().toISOString();
        const resources: Resource[] = [
            {
                id: "r1",
                projectId: "p",
                title: "Alpha",
                type: "document",
                createdAt: now,
                updatedAt: now,
                metadata: {},
            },
            {
                id: "r2",
                projectId: "p",
                title: "Beta",
                type: "note",
                createdAt: now,
                updatedAt: now,
                metadata: {},
            },
            {
                id: "r3",
                projectId: "p",
                title: "Gamma",
                type: "scene",
                createdAt: now,
                updatedAt: now,
                metadata: {},
            },
        ];

        const onSelect = vi.fn();
        render(<SearchBar resources={resources} onSelect={onSelect} />);

        const input = screen.getByLabelText(
            "resource-search",
        ) as HTMLInputElement;
        fireEvent.change(input, { target: { value: "a" } });

        // Alpha and Gamma contain 'a' (case-insensitive). Because matches are
        // highlighted and split across spans, query by accessible name instead.
        expect(
            screen.getByRole("button", { name: /Alpha/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /Gamma/i }),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Alpha/i }));
        expect(onSelect).toHaveBeenCalledWith("r1");
    });
});
