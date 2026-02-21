import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StartPage from "../components/Start/StartPage";

describe("Create project flow (integration) - modal calls API and adds project", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("loads project types, posts creation, and shows new project in the list", async () => {
        // Mock fetch: first call => GET /api/project-types, second => POST /api/projects
        const fetchSpy = vi
            .spyOn(globalThis as any, "fetch")
            .mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: async () => [{ id: "novel", name: "Novel" }],
                }),
            )
            .mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: async () => ({
                        project: {
                            id: "proj_new",
                            name: "My Novel",
                            resources: [],
                        },
                    }),
                }),
            );

        render(<StartPage />);

        // Open modal
        const newBtn = screen.getByRole("button", { name: /New Project/i });
        fireEvent.click(newBtn);

        // Wait for types to load (modal select present)
        await waitFor(() => expect(screen.getByRole("combobox")).toBeTruthy());

        // Fill name and select type
        const nameInput = screen.getByLabelText(/Name/i);
        fireEvent.change(nameInput, { target: { value: "My Novel" } });
        const select = screen.getByRole("combobox");
        fireEvent.change(select, { target: { value: "novel" } });

        // Submit
        const createBtn = screen.getByRole("button", { name: /Create/i });
        fireEvent.click(createBtn);

        // Ensure fetch was called for GET and POST
        await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

        // Assert POST called with expected payload
        const postCall = fetchSpy.mock.calls[1];
        expect(postCall[0]).toBe("/api/projects");
        expect(postCall[1]).toMatchObject({
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        expect(postCall[1].body).toBe(
            JSON.stringify({ name: "My Novel", projectType: "novel" }),
        );

        // Modal should close and StartPage should show the created project (placeholder created by StartPage onCreate)
        await waitFor(() => expect(screen.getByText("My Novel")).toBeTruthy());
    });
});
