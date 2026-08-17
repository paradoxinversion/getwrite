// Last Updated: 2026-08-17

/**
 * @module qa
 *
 * Registers the `qa` sub-command group on the Commander program.
 *
 * `qa` is a developer-facing harness intended to let a Claude Code session
 * driving Playwright MCP tools spin up a disposable dev-server workspace,
 * verify filesystem state, and write a report. This module currently only
 * scaffolds the command skeleton — `start`, `verify`, `report`, and `finish`
 * each print a "not yet implemented" message and exit cleanly. Later tasks
 * fill in real behavior (and the sibling `cli/src/qa/` module directory).
 *
 * ### Sub-commands
 *
 * | Command | Description |
 * |---------|-------------|
 * | `qa start` | Spin up a disposable QA workspace (not yet implemented) |
 * | `qa verify` | Verify filesystem state against expectations (not yet implemented) |
 * | `qa report` | Write a QA run report (not yet implemented) |
 * | `qa finish` | Tear down a QA workspace (not yet implemented) |
 *
 * ### Examples
 * ```sh
 * getwrite-cli qa start
 * getwrite-cli qa verify
 * getwrite-cli qa report
 * getwrite-cli qa finish
 * ```
 */
import { Command } from "commander";

/**
 * Registers the `qa` sub-command group on the provided Commander `program`.
 *
 * Attaches four child commands — `start`, `verify`, `report`, and `finish` —
 * each of which currently only prints a "not yet implemented" message and
 * exits cleanly (code `0`). Later tasks implement their real behavior.
 *
 * @param program - The root Commander `Command` instance to attach the
 *   sub-command group to.
 *
 * @example
 * ```ts
 * import { Command } from "commander";
 * import registerQa from "./commands/qa";
 *
 * const program = new Command();
 * registerQa(program);
 * program.parse(process.argv);
 * ```
 */
export function registerQa(program: Command) {
  const qa = program
    .command("qa")
    .description("Agentic QA harness for driving disposable QA workspaces");

  /**
   * `qa start`
   *
   * Will spin up a disposable dev-server workspace for a QA run. Not yet
   * implemented.
   */
  qa.command("start")
    .description("Start a disposable QA workspace (not yet implemented)")
    .action((): void => {
      console.log("[qa start] Not yet implemented.");
    });

  /**
   * `qa verify`
   *
   * Will verify on-disk project state against expectations recorded during
   * a QA run. Not yet implemented.
   */
  qa.command("verify")
    .description("Verify filesystem state for a QA run (not yet implemented)")
    .action((): void => {
      console.log("[qa verify] Not yet implemented.");
    });

  /**
   * `qa report`
   *
   * Will write a report summarizing a QA run's findings. Not yet
   * implemented.
   */
  qa.command("report")
    .description("Write a QA run report (not yet implemented)")
    .action((): void => {
      console.log("[qa report] Not yet implemented.");
    });

  /**
   * `qa finish`
   *
   * Will tear down a disposable QA workspace. Not yet implemented.
   */
  qa.command("finish")
    .description("Tear down a disposable QA workspace (not yet implemented)")
    .action((): void => {
      console.log("[qa finish] Not yet implemented.");
    });
}

export default registerQa;
