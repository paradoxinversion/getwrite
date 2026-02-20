import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StartPage from "../components/Start/StartPage";
import ResourceTree from "../components/Tree/ResourceTree";
import EditView from "../components/WorkArea/EditView";
import { sampleProjects } from "../lib/placeholders";

// Integration-style flow test: Start -> Open Project -> Open Resource -> Edit
describe("Core flow: Start → Open Project → Open Resource → Edit", () => {
    it("navigates from Start to Edit view and shows word count for selected resource", async () => {
        const projects = sampleProjects(1);
        const project = projects[0];

        // Test harness component that renders StartPage then ResourceTree+EditView
        function TestApp() {
            const [currentProject, setCurrentProject] = React.useState<
                typeof project | null
            >(null);
            const [currentResourceId, setCurrentResourceId] = React.useState<
                string | null
            >(null);

            const handleOpen = (id: string) => {
                const p = projects.find((x) => x.id === id) ?? null;
                setCurrentProject(p);
                setCurrentResourceId(null);
            };

            const handleSelect = (id: string) => {
                setCurrentResourceId(id);
            };

            const currentResource =
                currentProject?.resources.find(
                    (r) => r.id === currentResourceId,
                ) ?? null;

            return (
                <div>
                    {!currentProject ? (
                        <StartPage projects={projects} onOpen={handleOpen} />
                    ) : (
                        <div>
                            <h2>Project: {currentProject.name}</h2>
                            <ResourceTree
                                resources={currentProject.resources}
                                onSelect={handleSelect}
                            />

                            <div data-testid="editor-area">
                                {currentResource ? (
                                    <EditView
                                        initialContent={
                                            currentResource.content ?? ""
                                        }
                                    />
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        render(<TestApp />);

        // Start page should show the project title
        expect(screen.getByText(project.name)).toBeTruthy();

        // Click the first 'Open' button
        const openButtons = screen.getAllByRole("button", { name: /Open/i });
        expect(openButtons.length).toBeGreaterThan(0);
        fireEvent.click(openButtons[0]);

        // Resource tree should appear
        await waitFor(() => {
            expect(screen.getByLabelText("Resource tree")).toBeTruthy();
        });

        // Click the first resource title
        const firstResource = project.resources[0];
        const resTitle = screen.getByText(firstResource.title);
        fireEvent.click(resTitle);

        // The editor area should show word count matching the resource content
        // Compute expected word count using same logic as EditView
        const text = firstResource.content
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const expectedCount = text ? text.split(" ").length : 0;

        await waitFor(() => {
            expect(screen.getByTestId("editor-area")).toBeTruthy();
            // word count is rendered inside a <strong> element
            expect(
                screen.getByText(String(expectedCount), { selector: "strong" }),
            ).toBeTruthy();
        });
    });
});
