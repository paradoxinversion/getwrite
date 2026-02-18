import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DiffView from "../components/WorkArea/DiffView";

describe("DiffView", () => {
    test("renders left and right panes and revisions", () => {
        const left = "<p>left</p>";
        const right = "<p>right</p>";
        const revisions = [
            { id: "1", label: "v1", timestamp: "t1" },
            { id: "2", label: "v2", timestamp: "t2" },
        ];

        render(
            <DiffView
                leftContent={left}
                rightContent={right}
                revisions={revisions}
            />,
        );

        expect(screen.getByLabelText("left-pane")).toBeInTheDocument();
        expect(screen.getByLabelText("right-pane")).toBeInTheDocument();
        expect(screen.getByText("v1")).toBeInTheDocument();
        expect(screen.getByText("v2")).toBeInTheDocument();
    });

    test("calls onSelectRevision when a revision is clicked", () => {
        const onSelect = vi.fn();
        const revisions = [{ id: "1", label: "v1" }];

        render(<DiffView revisions={revisions} onSelectRevision={onSelect} />);

        fireEvent.click(screen.getByText("v1"));

        expect(onSelect).toHaveBeenCalledWith("1");
    });
});
