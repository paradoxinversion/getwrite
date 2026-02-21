import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import registerPrune from "../commands/prune";
import registerTemplates from "../commands/templates";
import registerScreenshots from "../commands/screenshots";
import os from "node:os";
import path from "node:path";

describe("getwrite-cli registration", () => {
    it("registers prune, templates, and screenshots commands", () => {
        const program = new Command();
        registerPrune(program);
        registerTemplates(program);
        registerScreenshots(program);

        const names = program.commands.map((c) => c.name());
        expect(names).toContain("prune");
        expect(names).toContain("templates");
        expect(names).toContain("screenshots");
    });
});

describe("templates:list error handling", () => {
    let errSpy: any;

    beforeEach(() => {
        errSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined as any);
    });

    afterEach(() => {
        errSpy.mockRestore();
    });

    it("logs error when templates dir missing", async () => {
        const program = new Command();
        registerTemplates(program);
        const fakePath = path.join(os.tmpdir(), `no-templates-${Date.now()}`);
        await program.parseAsync([
            "node",
            "test",
            "templates",
            "list",
            fakePath,
        ]);
        expect(errSpy).toHaveBeenCalled();
    });
});

describe("screenshots:capture error handling", () => {
    let errSpy: any;

    beforeEach(() => {
        errSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined as any);
    });

    afterEach(() => {
        errSpy.mockRestore();
    });

    it("reports fetch failures gracefully", async () => {
        const program = new Command();
        registerScreenshots(program);
        // Use an obviously invalid port to make fetch fail quickly
        await program.parseAsync([
            "node",
            "test",
            "screenshots",
            "capture",
            "--storybook",
            "http://127.0.0.1:0",
            "--out",
            "./tmp-screens",
        ]);
        expect(errSpy).toHaveBeenCalled();
    });
});
