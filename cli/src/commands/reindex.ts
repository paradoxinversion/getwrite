/**
 * @module reindex
 *
 * Registers the `reindex` sub-command on the Commander program.
 *
 * Rebuilds the inverted index, backlinks, and entity mention index from
 * scratch by scanning all resources in a project root. Useful for recovering
 * from index corruption or after bulk filesystem changes that bypass the
 * normal save flow.
 *
 * Usage:
 * ```
 * getwrite reindex [projectRoot]
 * ```
 *
 * Exit codes:
 * - `0`  — reindex completed successfully.
 * - `2`  — unexpected error during reindex (details logged to stderr).
 *
 * When the environment variable `GETWRITE_CLI_TESTING` is set, `process.exit`
 * is suppressed so the command can be exercised in tests without terminating
 * the process.
 */
import { Command } from "commander";
import {
  listResourceIds,
  computeBacklinks,
  persistBacklinks,
  indexResource,
  readSidecar,
  loadResourceContent,
  runForTenant,
  buildEntityAliasTable,
  findMentionOffsets,
  persistMentionIndex,
  type TextResource,
  type MentionRecord,
  type MentionIndex,
} from "@gw/core";

export function registerReindex(program: Command) {
  program
    .command("reindex [projectRoot]")
    .description(
      "Rebuild the inverted index and backlinks for a project from scratch",
    )
    .action(async (projectRoot: string | undefined): Promise<void> => {
      const root = projectRoot ?? process.cwd();
      try {
        let mentionCount = 0;
        const ids = await runForTenant(root, async () => {
          const resourceIds = await listResourceIds(root);
          const now = new Date().toISOString();
          // Captured from the loop below so the mention-detection pass
          // doesn't have to re-read each resource's content off disk.
          const plainTextById = new Map<string, string | undefined>();

          for (const id of resourceIds) {
            let name = id;
            try {
              const side = await readSidecar(root, id);
              if (side && (side as Record<string, unknown>).name) {
                name = String((side as Record<string, unknown>).name);
              }
            } catch (_) {
              // no sidecar — use id as name
            }

            let plainText: string | undefined;
            try {
              const loaded = await loadResourceContent(root, id);
              plainText = loaded.plainText ?? undefined;
            } catch (_) {
              // no content — index will be empty for this resource
            }
            plainTextById.set(id, plainText);

            const minimal: TextResource = {
              id,
              name,
              type: "text",
              folderId: undefined,
              createdAt: now,
              plainText,
              tiptap: undefined,
            } as unknown as TextResource;

            await indexResource(root, minimal);
          }

          const backlinks = await computeBacklinks(root);
          await persistBacklinks(root, backlinks);

          // Rebuild the entity mention index from scratch, mirroring the
          // per-resource aggregation `indexer-queue.ts`'s `runTask` performs
          // (one MentionRecord per entity per resource, offsets aggregated
          // across all of that entity's terms) — but persisted once at the
          // end rather than once per resource, since this command already
          // has every resource's plain text in hand.
          const aliasTable = await buildEntityAliasTable(root);
          const mentionIndex: MentionIndex = {};

          for (const id of resourceIds) {
            const plainText = plainTextById.get(id);
            const records: MentionRecord[] = [];

            for (const entity of Object.values(aliasTable.entities)) {
              const offsets: number[] = [];
              for (const term of entity.terms) {
                offsets.push(...findMentionOffsets(plainText ?? "", term));
              }
              if (offsets.length > 0) {
                offsets.sort((a, b) => a - b);
                records.push({
                  entityId: entity.entityId,
                  resourceId: id,
                  count: offsets.length,
                  offsets,
                });
              }
            }

            if (records.length > 0) {
              mentionIndex[id] = records;
              mentionCount += records.length;
            }
          }

          // Persisted from scratch (not merged with any prior contents) so
          // it reflects only resources currently on disk — the same
          // "rebuild from scratch" contract as the inverted index and
          // backlinks above.
          await persistMentionIndex(root, mentionIndex);

          return resourceIds;
        });

        console.log(
          `[reindex] Done — indexed ${ids.length} resource(s), ${mentionCount} mention(s) in ${root}`,
        );

        if (!process.env.GETWRITE_CLI_TESTING) process.exit(0);
      } catch (err) {
        console.error("Reindex command failed:", err);
        if (!process.env.GETWRITE_CLI_TESTING) process.exit(2);
      }
    });
}

export default registerReindex;
