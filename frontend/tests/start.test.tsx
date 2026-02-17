import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StartPage from "../components/Start/StartPage";
import { sampleProjects } from "../lib/placeholders";

test("StartPage renders projects and opens CreateProjectModal", async () => {
    const user = userEvent.setup();
    render(<StartPage projects={sampleProjects(2)} />);

    // heading
    expect(
        screen.getByRole("heading", { name: /Projects/i }),
    ).toBeInTheDocument();

    // project cards render
    const cards = screen.getAllByRole("article");
    expect(cards.length).toBeGreaterThanOrEqual(1);

    // open modal
    const newButton = screen.getByRole("button", { name: /New Project/i });
    await user.click(newButton);

    // modal should be visible
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Create Project/i)).toBeInTheDocument();
});
