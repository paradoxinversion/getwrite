import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock the project creator before importing the CLI so the CLI uses the mock.
vi.mock("../../lib/models/project-creator", () => {
    return { createProjectFromType: vi.fn() };
});

import * as creator from "../../lib/models/project-creator";
import { main } from "../getwrite-cli";

describe("getwrite-cli project:create", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        (creator as any).createProjectFromType.mockReset();
        exitSpy = vi
            .spyOn(process, "exit")
            .mockImplementation(((code?: number) => undefined) as any);
        logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        exitSpy.mockRestore();
        logSpy.mockRestore();
    });

    it("calls createProjectFromType and exits successfully", async () => {
        (creator as any).createProjectFromType.mockResolvedValue({
            project: {},
            folders: [{ id: "f1" }],
            resources: [{ id: "r1" }],
        });

        const argv = [
            "node",
            "getwrite-cli",
            "project",
            "create",
            "./my/new-project",
            "--spec",
            "spec.json",
            "--name",
            "My Project",
        ];

        await main(argv as unknown as string[]);

        expect((creator as any).createProjectFromType).toHaveBeenCalled();
        expect((creator as any).createProjectFromType).toHaveBeenCalledWith(
            expect.objectContaining({
                projectRoot: "./my/new-project",
                spec: "spec.json",
                name: "My Project",
            }),
        );

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("Created project at"),
        );
        expect(exitSpy).toHaveBeenCalledWith(0);
    });
});
