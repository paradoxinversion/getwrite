import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CreateProjectModal, {
    CreateProjectModalProps,
    CreateProjectPayload,
} from "../../../frontend/components/Start/CreateProjectModal";

const meta: Meta<typeof CreateProjectModal> = {
    title: "Start/CreateProjectModal",
    component: CreateProjectModal,
};

export default meta;

type Story = StoryObj<typeof CreateProjectModal>;

export const Open: Story = {
    args: {
        isOpen: true,
        defaultName: "My Project",
        defaultType: "novel",
        onClose: () => console.log("close"),
        onCreate: (payload: CreateProjectPayload) =>
            console.log("create", payload),
    },
    render: (args: CreateProjectModalProps) => {
        // Install a lightweight fetch mock synchronously so the modal's
        // `loadTypes` effect sees mocked responses immediately when it runs.
        if (
            typeof window !== "undefined" &&
            !(window as any).__storybookFetchMockInstalled
        ) {
            (window as any).__storybookFetchMockInstalled = true;
            const origFetch = window.fetch;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            window.fetch = async (input: RequestInfo, init?: RequestInit) => {
                const url = typeof input === "string" ? input : input.url;
                if (url.endsWith("/api/project-types")) {
                    return new Response(
                        JSON.stringify([
                            {
                                id: "novel",
                                name: "Novel (default)",
                                description: "Short form",
                            },
                            {
                                id: "short",
                                name: "Short Story",
                                description: "Short form",
                            },
                        ]),
                        {
                            status: 200,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }
                if (url.endsWith("/api/projects") && init?.method === "POST") {
                    try {
                        const body = init.body
                            ? JSON.parse(String(init.body))
                            : {};
                        const project = {
                            id: `proj_${Date.now()}`,
                            name: body.name,
                        };
                        return new Response(JSON.stringify({ project }), {
                            status: 200,
                            headers: { "Content-Type": "application/json" },
                        });
                    } catch (e) {
                        return new Response(null, { status: 500 });
                    }
                }
                return origFetch(input, init);
            };
        }

        const Wrapper = () => {
            const [open, setOpen] = React.useState(true);
            const [created, setCreated] =
                React.useState<CreateProjectPayload | null>(null);
            return (
                <div>
                    <CreateProjectModal
                        {...args}
                        isOpen={open}
                        onClose={() => setOpen(false)}
                        onCreate={(p) => {
                            setCreated(p);
                            args.onCreate?.(p);
                        }}
                    />
                    <div
                        data-testid="created-payload"
                        aria-hidden
                        style={{ display: "none" }}
                    >
                        {created ? JSON.stringify(created) : ""}
                    </div>
                </div>
            );
        };

        return <Wrapper />;
    },
};
