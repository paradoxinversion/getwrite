import path from "node:path";
import fs from "node:fs/promises";
import {
    saveResourceTemplate,
    loadResourceTemplate,
    createResourceFromTemplate,
    duplicateResource,
} from "../lib/models/resource-templates";

type Argv = string[];

function usage(): string {
    return `Usage:
  pnpm ts-node src/cli/templates.ts save <projectRoot> <templateId> <name>
  pnpm ts-node src/cli/templates.ts create <projectRoot> <templateId> [name]
  pnpm ts-node src/cli/templates.ts duplicate <projectRoot> <resourceId>
  pnpm ts-node src/cli/templates.ts list <projectRoot>
`;
}

async function listTemplates(projectRoot: string): Promise<void> {
    const dir = path.join(projectRoot, "meta", "templates");
    try {
        const entries = await fs.readdir(dir);
        for (const e of entries) {
            if (e.endsWith(".json")) {
                const raw = await fs.readFile(path.join(dir, e), "utf8");
                const parsed = JSON.parse(raw);
                console.log(
                    parsed.id + "\t" + parsed.name + "\t" + parsed.type,
                );
            }
        }
    } catch (err) {
        console.error("No templates found or cannot read templates directory.");
    }
}

async function main(argv: Argv): Promise<number> {
    const args = argv.slice(2);
    const cmd = args[0];
    if (!cmd) {
        console.error(usage());
        return 1;
    }

    try {
        // support a convenience command to capture an existing resource as a template
        if (cmd === "save-from-resource") {
            // args can include optional --name <name>
            const nameIndex = args.indexOf("--name");
            let name: string | undefined;
            if (nameIndex !== -1) {
                name = args[nameIndex + 1];
                // remove the name flag so positional parsing works below
                args.splice(nameIndex, 2);
            }
            const [_, projectRoot, resourceId, templateId] = args;
            if (!projectRoot || !resourceId || !templateId) {
                console.error(usage());
                return 1;
            }
            const { saveResourceTemplateFromResource } =
                await import("../lib/models/resource-templates");
            await saveResourceTemplateFromResource(
                projectRoot,
                resourceId,
                templateId,
                { name },
            );
            console.log(
                `Saved template ${templateId} from resource ${resourceId}`,
            );
            return 0;
        }

        if (cmd === "parametrize") {
            // expects: parametrize <projectRoot> <templateId> --placeholder "{{NAME}}"
            const phIndex = args.indexOf("--placeholder");
            if (phIndex === -1) {
                console.error("--placeholder is required");
                return 1;
            }
            const placeholder = args[phIndex + 1];
            // remove placeholder args so positional parsing works
            args.splice(phIndex, 2);
            const [_, projectRoot, templateId] = args;
            if (!projectRoot || !templateId) {
                console.error(usage());
                return 1;
            }
            const { parametrizeResourceTemplate } =
                await import("../lib/models/resource-templates");
            const vars = await parametrizeResourceTemplate(
                projectRoot,
                templateId,
                placeholder,
            );
            console.log(`Parametrized template ${templateId}`);
            console.log(`Variables: ${vars.join(", ")}`);
            return 0;
        }

        if (cmd === "save") {
            const [_, projectRoot, templateId, name] = args;
            if (!projectRoot || !templateId || !name) {
                console.error(usage());
                return 1;
            }
            const tpl = {
                id: templateId,
                name,
                type: "text",
                plainText: "",
            } as const;
            await saveResourceTemplate(projectRoot, tpl as any); // minimal CLI helper; template shape enforced at runtime
            console.log(`Saved template ${templateId}`);
            return 0;
        }

        if (cmd === "create") {
            const [_, projectRoot, templateId, name] = args;
            if (!projectRoot || !templateId) {
                console.error(usage());
                return 1;
            }
            const created = await createResourceFromTemplate(
                projectRoot,
                templateId,
                { name },
            );
            console.log(`Created resource ${created.id}`);
            return 0;
        }

        if (cmd === "duplicate") {
            const [_, projectRoot, resourceId] = args;
            if (!projectRoot || !resourceId) {
                console.error(usage());
                return 1;
            }
            const res = await duplicateResource(projectRoot, resourceId);
            console.log(`Duplicated resource -> ${res.newId}`);
            return 0;
        }

        if (cmd === "list") {
            const [_, projectRoot] = args;
            if (!projectRoot) {
                console.error(usage());
                return 1;
            }
            await listTemplates(projectRoot);
            return 0;
        }

        console.error(usage());
        return 1;
    } catch (err) {
        console.error("Error:", (err as Error).message);
        return 2;
    }
}

if (require.main === module) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    main(process.argv).then((c) => process.exit(c ?? 0));
}

export { main };
