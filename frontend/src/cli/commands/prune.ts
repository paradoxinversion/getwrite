import { Command } from "commander";
import { runCli } from "../../lib/models/pruneExecutor";

export function registerPrune(program: Command) {
    program
        .command("prune [projectRoot]")
        .description("Prune old revisions under a project root")
        .option("-m, --max <number>", "maximum revisions to keep", "50")
        .action(
            async (
                projectRoot: string | undefined,
                options: { max: string },
            ) => {
                const root = projectRoot ?? process.cwd();
                const max = Number(options.max ?? 50);
                try {
                    const code = await runCli([
                        process.execPath,
                        "getwrite-cli",
                        root,
                        String(max),
                    ]);
                    // When running as a real CLI, exit with the returned code. When used
                    // programmatically (tests) set env GETWRITE_CLI_TESTING to avoid exit.
                    if (!process.env.GETWRITE_CLI_TESTING)
                        process.exit(code ?? 0);
                    return code ?? 0;
                } catch (err) {
                    console.error("Prune command failed:", err);
                    if (!process.env.GETWRITE_CLI_TESTING) process.exit(2);
                    return 2;
                }
            },
        );
}

export default registerPrune;
