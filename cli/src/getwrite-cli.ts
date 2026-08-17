import { Command } from "commander";
import registerPrune from "./commands/prune";
import registerTemplates from "./commands/templates";
import registerScreenshots from "./commands/screenshots";
import registerProject from "./commands/project";
import registerReindex from "./commands/reindex";
import registerDoctor from "./commands/doctor";
import registerQa from "./commands/qa";

const program = new Command("getwrite-cli");

program.version("0.1.0");

// Register subcommands
registerPrune(program);
registerTemplates(program);
registerScreenshots(program);
registerProject(program);
registerReindex(program);
registerDoctor(program);
registerQa(program);

export async function main(argv: string[]): Promise<number> {
  // commander expects process.argv-like array
  await program.parseAsync(argv);
  return 0;
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main(process.argv).then((code) => process.exit(code ?? 0));
}

export default program;
