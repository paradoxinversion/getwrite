import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ResourceContextMenu from "../../components/Tree/ResourceContextMenu";
import { within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// `expect` is provided by the test runner (Vitest) in the test environment

const meta: Meta<typeof ResourceContextMenu> = {
    title: "Tree/ResourceContextMenu",
    component: ResourceContextMenu,
};

export default meta;

type Story = StoryObj<typeof ResourceContextMenu>;

export const Default: Story = {
    args: {
        open: false,
        x: 100,
        y: 100,
        resourceId: "res_123",
        resourceTitle: "Sample Resource",
        onClose: () => undefined,
        onAction: (action: string) => console.log("action", action),
    },
};

export const Open: Story = {
    args: {
        open: true,
        x: 120,
        y: 80,
        resourceId: "res_123",
        resourceTitle: "Sample Resource",
        onClose: () => console.log("closed"),
        onAction: (action: string) => console.log("action", action),
    },
};

export const Interactive: Story = {
    render: (args) => {
        const Wrapper = () => {
            const [open, setOpen] = React.useState(true);
            return (
                <div>
                    <div data-testid="outside" style={{ padding: 40 }}>
                        Outside area (click here to close)
                    </div>
                    <ResourceContextMenu
                        {...args}
                        open={open}
                        onClose={() => setOpen(false)}
                    />
                </div>
            );
        };

        return <Wrapper />;
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const menu = await canvas.getByRole("menu");
        expect(menu).toBeTruthy();

        const outside = canvas.getByTestId("outside");
        await userEvent.click(outside);

        // assert the specific menu element we captured is removed from the DOM
        await waitFor(() => {
            expect(menu).not.toBeInTheDocument();
        });
    },
    args: {
        x: 140,
        y: 60,
        resourceId: "res_123",
        resourceTitle: "Sample Resource",
        onAction: (action: string) => console.log("action", action),
    },
};
