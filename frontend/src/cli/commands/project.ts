import type { Command } from "commander";
import { createProjectFromType } from "../../lib/models/project-creator";

export default function registerProject(program: Command): void {
    const cmd = program
        .command("project")
        .description("Project related commands");

    cmd.command("create [projectRoot]")
        .description(
            "Create a new getwrite project from a project-type spec or JSON file",
        )
        .option(
            "-s, --spec <specPath>",
            "Path to project-type JSON spec (or object not supported on CLI)",
        )
        .option("-n, --name <name>", "Optional project name")
        .action(async (projectRoot = ".", options) => {
            try {
                if (!options?.spec) {
                    console.error(
                        "--spec <path> is required to create a project from a spec file",
                    );
                    process.exit(2);
                }

                const specPath = String(options.spec);

                const result = await createProjectFromType({
                    projectRoot: projectRoot as string,
                    spec: specPath,
                    name: options.name,
                });

                console.log(`Created project at: ${projectRoot}`);
                console.log(
                    `Folders: ${result.folders.length}, Resources: ${result.resources.length}`,
                );
                process.exit(0);
            } catch (err) {
                console.error("Failed to create project:", err);
                process.exit(2);
            }
        });
}
