import { Command } from "commander";
import path from "node:path";
import fs from "node:fs/promises";
import {
    saveResourceTemplate,
    loadResourceTemplate,
    createResourceFromTemplate,
    duplicateResource,
} from "../../lib/models/resource-templates";

export function registerTemplates(program: Command) {
    const tpl = program
        .command("templates")
        .description("Manage resource templates");

    tpl.command("save <projectRoot> <templateId> <name>")
        .description("Save an empty template with id and name")
        .action(
            async (projectRoot: string, templateId: string, name: string) => {
                try {
                    const template = {
                        id: templateId,
                        name,
                        type: "text",
                        plainText: "",
                    } as const;
                    await saveResourceTemplate(projectRoot, template as any);
                    console.log(`Saved template ${templateId}`);
                    return 0;
                } catch (err) {
                    console.error("Error:", (err as Error).message);
                    return 2;
                }
            },
        );

    tpl.command("create <projectRoot> <templateId> [name]")
        .description("Create a resource from a template")
        .action(
            async (projectRoot: string, templateId: string, name?: string) => {
                try {
                    const created = await createResourceFromTemplate(
                        projectRoot,
                        templateId,
                        { name },
                    );
                    console.log(`Created resource ${created.id}`);
                    return 0;
                } catch (err) {
                    console.error("Error:", (err as Error).message);
                    return 2;
                }
            },
        );

    tpl.command("duplicate <projectRoot> <resourceId>")
        .description("Duplicate an existing resource")
        .action(async (projectRoot: string, resourceId: string) => {
            try {
                const res = await duplicateResource(projectRoot, resourceId);
                console.log(`Duplicated resource -> ${res.newId}`);
                return 0;
            } catch (err) {
                console.error("Error:", (err as Error).message);
                return 2;
            }
        });

    tpl.command("list <projectRoot>")
        .description("List templates in a project")
        .action(async (projectRoot: string) => {
            const dir = path.join(projectRoot, "meta", "templates");
            try {
                const entries = await fs.readdir(dir);
                for (const e of entries) {
                    if (e.endsWith(".json")) {
                        const raw = await fs.readFile(
                            path.join(dir, e),
                            "utf8",
                        );
                        const parsed = JSON.parse(raw);
                        console.log(
                            parsed.id + "\t" + parsed.name + "\t" + parsed.type,
                        );
                    }
                }
                return 0;
            } catch (err) {
                console.error(
                    "No templates found or cannot read templates directory.",
                );
                return 2;
            }
        });
}

export default registerTemplates;
