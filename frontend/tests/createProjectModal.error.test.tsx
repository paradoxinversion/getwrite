import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateProjectModal from "../components/Start/CreateProjectModal";

describe("CreateProjectModal - types load error and retry", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("shows an error when /api/project-types fails and retries successfully", async () => {
        const onCreate = vi.fn();
        const onClose = vi.fn();

        // first call: fail
        const fetchSpy = vi
            .spyOn(globalThis as any, "fetch")
            .mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    text: async () => "boom",
                }),
            )
            // second call: succeed
            .mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: async () => [{ id: "novel", name: "Novel" }],
                }),
            );

        render(
            <CreateProjectModal
                isOpen={true}
                onClose={onClose}
                onCreate={onCreate}
                defaultName=""
            />,
        );

        // expect error banner to appear
        await waitFor(() =>
            expect(
                screen.getByText(/Failed to load project types/i),
            ).toBeTruthy(),
        );

        const retryBtn = screen.getByText("Retry");
        fireEvent.click(retryBtn);

        // after retry, the select should contain the loaded option
        await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.getByRole("combobox")).toBeTruthy());
        expect(screen.getByRole("combobox")).toHaveTextContent("Novel");
    });
});
