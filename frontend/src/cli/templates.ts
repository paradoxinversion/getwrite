import path from "node:path";
import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import {
    saveResourceTemplate,
    loadResourceTemplate,
    createResourceFromTemplate,
    duplicateResource,
    scaffoldResourcesFromTemplate,
    applyMultipleFromTemplate,
    previewResourceTemplate,
} from "../lib/models/resource-templates";

type Argv = string[];

function usage(): string {
    return `Usage:
    pnpm ts-node src/cli/templates.ts save-from-resource <projectRoot> <resourceId> <templateId> [--name <name>]
    pnpm ts-node src/cli/templates.ts save <projectRoot> <templateId> <name>
    pnpm ts-node src/cli/templates.ts create <projectRoot> <templateId> [name] [--vars '{}'] [--dry-run]
    pnpm ts-node src/cli/templates.ts duplicate <projectRoot> <resourceId>
    pnpm ts-node src/cli/templates.ts list <projectRoot> [--query <text>]
    pnpm ts-node src/cli/templates.ts inspect <projectRoot> <templateId>
    pnpm ts-node src/cli/templates.ts parametrize <projectRoot> <templateId> --placeholder "{{NAME}}"
    pnpm ts-node src/cli/templates.ts export <projectRoot> <templateId> <out.zip>
    pnpm ts-node src/cli/templates.ts import <projectRoot> <pack.zip>
    pnpm ts-node src/cli/templates.ts validate <projectRoot> <templateId>
    pnpm ts-node src/cli/templates.ts preview <projectRoot> <templateId> [--vars '{}'] [--out <file>]
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
            // supports: create <projectRoot> <templateId> [name] [--vars '{}'] [--dry-run]
            const nameIndex = args.indexOf("--vars");
            const dryIndex = args.indexOf("--dry-run");
            let vars: string | undefined;
            if (nameIndex !== -1) {
                vars = args[nameIndex + 1];
                args.splice(nameIndex, 2);
            }
            const [_, projectRoot, templateId, name] = args;
            if (!projectRoot || !templateId) {
                console.error(usage());
                return 1;
            }
            const dry = dryIndex !== -1;
            const result = await createResourceFromTemplate(
                projectRoot,
                templateId,
                {
                    name,
                    vars: vars ? JSON.parse(vars) : undefined,
                    dryRun: dry,
                },
            );
            if (dry && (result as any).plannedWrites) {
                console.log("Dry-run planned writes:");
                for (const p of (result as any).plannedWrites) {
                    console.log(
                        `${p.path}` +
                            (p.content === null ? " (no content)" : ""),
                    );
                }
                return 0;
            }

            console.log(`Created resource ${(result as any).id}`);
            return 0;
        }

        // top-level export/import commands
        if (cmd === "export") {
            // export <projectRoot> <templateId> <out.zip>
            const [_, projectRoot, templateId, outPath] = args;
            if (!projectRoot || !templateId || !outPath) {
                console.error(usage());
                return 1;
            }
            // ensure output directory exists and is writable
            const dir = path.dirname(outPath);
            try {
                await fs.mkdir(dir, { recursive: true });
                await fs.access(dir, fsConstants.W_OK);
            } catch (err) {
                console.error(`Cannot write to output directory: ${dir}`);
                return 2;
            }

            const { exportResourceTemplate } =
                await import("../lib/models/resource-templates");
            await exportResourceTemplate(projectRoot, templateId, outPath);
            console.log(`Exported template ${templateId} -> ${outPath}`);
            return 0;
        }

        if (cmd === "import") {
            // import <projectRoot> <pack.zip>
            const [_, projectRoot, packPath] = args;
            if (!projectRoot || !packPath) {
                console.error(usage());
                return 1;
            }
            const { importResourceTemplates } =
                await import("../lib/models/resource-templates");
            const imported = await importResourceTemplates(
                projectRoot,
                packPath,
            );
            console.log(`Imported templates: ${imported.join(", ")}`);
            return 0;
        }

        if (cmd === "scaffold") {
            const [_, projectRoot, templateId, countStr] = args;
            const count = countStr ? parseInt(countStr, 10) : 1;
            if (!projectRoot || !templateId) {
                console.error(usage());
                return 1;
            }
            const created = await scaffoldResourcesFromTemplate(
                projectRoot,
                templateId,
                count,
            );
            console.log(`Created ${created.length} resources`);
            return 0;
        }

        if (cmd === "apply-multiple") {
            const [_, projectRoot, templateId, inputPath] = args;
            if (!projectRoot || !templateId || !inputPath) {
                console.error(usage());
                return 1;
            }
            const created = await applyMultipleFromTemplate(
                projectRoot,
                templateId,
                inputPath,
            );
            console.log(`Created ${created.length} resources`);
            return 0;
        }

        if (cmd === "preview") {
            // preview <projectRoot> <templateId> [--vars '{}'] [--out <file>]
            const varsIndex = args.indexOf("--vars");
            const outIndex = args.indexOf("--out");
            let vars: string | undefined;
            let outPath: string | undefined;
            if (varsIndex !== -1) vars = args[varsIndex + 1];
            if (outIndex !== -1) outPath = args[outIndex + 1];

            const projectRoot = args[1];
            const templateId = args[2];
            if (!projectRoot || !templateId) {
                console.error(usage());
                return 1;
            }
            const out = await previewResourceTemplate(projectRoot, templateId, {
                vars: vars ? JSON.parse(vars) : undefined,
                outPath,
            });
            if (!outPath) console.log(out);
            else console.log(`Wrote preview -> ${out}`);
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
            const qIndex = args.indexOf("--query");
            let query: string | undefined;
            if (qIndex !== -1) {
                query = args[qIndex + 1];
                args.splice(qIndex, 2);
            }
            const [_, projectRoot] = args;
            if (!projectRoot) {
                console.error(usage());
                return 1;
            }
            const { listResourceTemplates } =
                await import("../lib/models/resource-templates");
            const list = await listResourceTemplates(projectRoot, query);
            for (const t of list) console.log(`${t.id}\t${t.name}\t${t.type}`);
            return 0;
        }

        if (cmd === "inspect") {
            const [_, projectRoot, templateId] = args;
            if (!projectRoot || !templateId) {
                console.error(usage());
                return 1;
            }
            const { inspectResourceTemplate } =
                await import("../lib/models/resource-templates");
            try {
                const info = await inspectResourceTemplate(
                    projectRoot,
                    templateId,
                );
                console.log(`id: ${info.id}`);
                console.log(`name: ${info.name}`);
                console.log(`type: ${info.type}`);
                console.log(`placeholders: ${info.placeholders.join(", ")}`);
                console.log(`metadataKeys: ${info.metadataKeys.join(", ")}`);
                return 0;
            } catch (err) {
                console.error(
                    `Error inspecting template: ${err instanceof Error ? err.message : String(err)}`,
                );
                return 2;
            }
        }

        if (cmd === "validate") {
            const [_, projectRoot, templateId] = args;
            if (!projectRoot || !templateId) {
                console.error(usage());
                return 1;
            }
            const { validateResourceTemplate } =
                await import("../lib/models/resource-templates");
            try {
                const r = await validateResourceTemplate(
                    projectRoot,
                    templateId,
                );
                if (r.valid) {
                    console.log(`Template ${templateId} is valid`);
                    return 0;
                }
                console.error(`Template ${templateId} is invalid:`);
                for (const e of r.errors) console.error(`  - ${e}`);
                return 2;
            } catch (err) {
                console.error(
                    `Error validating template: ${err instanceof Error ? err.message : String(err)}`,
                );
                return 2;
            }
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
