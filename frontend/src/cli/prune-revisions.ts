import { runCli } from "../lib/models/pruneExecutor";

// Small TypeScript entry that forwards process.argv to the executor.
export async function main(argv: string[]): Promise<number> {
    return runCli(argv);
}

if (require.main === module) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    main(process.argv).then((code) => process.exit(code ?? 0));
}
