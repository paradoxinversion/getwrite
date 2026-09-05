"use client";

import { useEffect, useMemo, useState } from "react";
import useAppSelector, { useAppDispatch } from "../../src/store/hooks";
import {
  selectResource,
  selectResources,
  setSelectedResourceId,
} from "../../src/store/resourcesSlice";
import {
  selectActiveProjectDirectoryId,
  selectProject,
  selectSelectedProjectId,
} from "../../src/store/projectsSlice";
import { getEntityMentionedIn } from "../../src/lib/api/mentions";
import type { EntityMentionedIn } from "../../src/lib/models/mentions-core";
import { orderResourceIdsByTreePosition } from "../common/compileSelection";
import CompilePreviewModal, {
  type EntityCompileEntry,
  type CompileOptions,
} from "../common/CompilePreviewModal";
import { runCompileAndDownload } from "../../src/lib/compile/run-compile-and-download";
import type { CompileBody } from "../../src/lib/api/compile";
import { toastService } from "../../src/lib/toast-service";
import Button from "../common/UI/Button/Button";

/**
 * Read-only sidebar section for an entity's own view: every resource
 * associated with the selected entity, merging two sources into one list
 * (Task 15, FR-10/FR-12/FR-14):
 *
 * - Explicit links (the entity's `linkedFrom` backlinks) — labeled "Linked".
 * - Detected prose mentions, one snippet per occurrence — labeled
 *   "Mentioned".
 *
 * The merge itself happens server-side in `mentions-core.ts`'s
 * `getEntityMentionedIn` (see that module's doc comment for the full
 * rationale): a resource that is both linked and mentioned is returned once
 * with both flags set, so this component never needs to dedup two
 * differently-shaped responses itself — it only renders the flags it's
 * given.
 *
 * Only renders (and only fetches) when the selected resource has
 * `entityKind` set — this section is the *entity's* view, distinct from
 * `EntitiesMentionedSection.tsx`, which is the read-only "entities detected
 * in *this* resource" section shown on every resource (FR-9).
 *
 * Follows the same loading/empty-state and navigation conventions as
 * `EntitiesMentionedSection.tsx`: a visible loading placeholder, no static
 * "nothing here" state, and navigation via
 * `dispatch(setSelectedResourceId(resourceId))` rather than a route.
 *
 * **Task 5 addition — entity-scoped compile trigger (FR-1/FR-2/FR-3/FR-6/
 * FR-7/FR-9 of `specs/features/entity-scoped-compile.md`).** Once `rows` has
 * loaded, this component also offers a "Compile this entity's resources"
 * button that opens the entity-mode `CompilePreviewModal` pre-populated with
 * every row from the merged `rows` set (both `isLinked` and `isMentioned`
 * resources, exactly as returned — no additional filtering, per FR-2),
 * ordered by `orderResourceIdsByTreePosition` against the project's full
 * resource list (FR-3). Confirming the modal calls `runCompileAndDownload`
 * with a `CompileBody` built the same way `AppShell.tsx` already builds one
 * for the whole-project compile flow. This is a read-only feature end to
 * end (FR-8): it only reads `rows` (already fetched via
 * `getEntityMentionedIn`) and the project's resource list, and invokes the
 * existing compile client functions — it never writes to a revision,
 * sidecar, or the mention index.
 */
export default function EntityMentionsSection(): JSX.Element | null {
  const projectId = useAppSelector(selectActiveProjectDirectoryId);
  const resource = useAppSelector((state) => selectResource(state.resources));
  const projectResources = useAppSelector((state) =>
    selectResources(state.resources),
  );
  const selectedProjectId = useAppSelector(selectSelectedProjectId);
  const project = useAppSelector((state) =>
    selectedProjectId ? selectProject(state, selectedProjectId) : null,
  );
  const dispatch = useAppDispatch();

  const [rows, setRows] = useState<EntityMentionedIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompileModalOpen, setIsCompileModalOpen] = useState(false);

  const resourceId = resource?.id;
  const entityKind = resource?.entityKind;

  useEffect(() => {
    if (!projectId || !resourceId || !entityKind) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    void getEntityMentionedIn(projectId, resourceId).then((result) => {
      if (isCancelled) return;
      setRows(result);
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [projectId, resourceId, entityKind]);

  // FR-2: the merged resource set is every row this component already
  // fetched, both `isLinked` and `isMentioned`, exactly as returned — no
  // additional filtering here.
  const mergedResourceIds = useMemo(
    () => rows.map((row) => row.resourceId),
    [rows],
  );

  // FR-3: ordered against the project's full resource tree. Ids not present
  // in the tree (e.g. a stale backlink to a deleted resource) are dropped by
  // `orderResourceIdsByTreePosition` itself.
  const orderedResourceIds = useMemo(
    () => orderResourceIdsByTreePosition(projectResources, mergedResourceIds),
    [projectResources, mergedResourceIds],
  );

  const compileEntries: EntityCompileEntry[] = useMemo(
    () =>
      orderedResourceIds.map((id) => {
        const full = projectResources.find((r) => r.id === id);
        return {
          resourceId: id,
          name: full?.name ?? id,
          resourceType: full?.type ?? "text",
        };
      }),
    [orderedResourceIds, projectResources],
  );

  if (!projectId || !resourceId || !entityKind) return null;

  if (isLoading) {
    return (
      <p className="text-gw-nano text-gw-secondary" role="status">
        Loading mentions&hellip;
      </p>
    );
  }

  const hasCompilableResources = orderedResourceIds.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="entity-mentions-list">
          {rows.map((row) => (
            <li key={row.resourceId} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="text-left text-gw-label text-gw-primary hover:text-gw-secondary transition-colors duration-150"
                  onClick={() =>
                    dispatch(setSelectedResourceId(row.resourceId))
                  }
                >
                  {row.name}
                </button>
                {row.isLinked && (
                  <span
                    className="text-gw-nano uppercase tracking-label px-1.5 py-0.5 rounded border border-gw-border text-gw-secondary"
                    aria-label={`${row.name}-linked-badge`}
                  >
                    Linked
                  </span>
                )}
                {row.isMentioned && (
                  <span
                    className="text-gw-nano uppercase tracking-label px-1.5 py-0.5 rounded border border-gw-border text-gw-secondary"
                    aria-label={`${row.name}-mentioned-badge`}
                  >
                    Mentioned
                  </span>
                )}
              </div>

              {row.snippets.length > 0 && (
                <ul
                  className="flex flex-col gap-1 pl-2"
                  aria-label={`${row.name}-snippets`}
                >
                  {row.snippets.map((snippet, index) => {
                    const ambiguousWith = row.ambiguousWith[index] ?? [];
                    return (
                      <li key={index}>
                        <p className="text-gw-nano text-gw-secondary">
                          {snippet}
                        </p>
                        {ambiguousWith.length > 0 && (
                          <p className="text-gw-nano text-gw-secondary italic">
                            Ambiguous &mdash; also matches{" "}
                            {ambiguousWith.join(", ")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={() => setIsCompileModalOpen(true)}
          disabled={!hasCompilableResources}
          aria-disabled={!hasCompilableResources}
        >
          Compile this entity&apos;s resources
        </Button>
        {!hasCompilableResources && (
          <p className="text-gw-nano text-gw-secondary">
            No associated resources to compile.
          </p>
        )}
      </div>

      {projectId && (
        <CompilePreviewModal
          isOpen={isCompileModalOpen}
          projectId={projectId}
          resources={projectResources}
          onClose={() => setIsCompileModalOpen(false)}
          entityMode={{ entries: compileEntries, orderedResourceIds }}
          onConfirmCompile={async (
            selectedIds: string[],
            options: CompileOptions,
          ) => {
            const compileBody: CompileBody = {
              projectId,
              resourceIds: selectedIds,
              resources: projectResources.map((r) => ({
                id: r.id,
                name: r.name,
                type: r.type,
              })),
              includeHeaders: options.includeHeaders,
              projectName: project?.name ?? "project",
            };
            try {
              await runCompileAndDownload(compileBody, {
                format: options.format,
                compilationName: options.compilationName,
              });
            } catch (err) {
              toastService.error(
                "Compile failed",
                err instanceof Error ? err.message : String(err),
              );
            }
          }}
        />
      )}
    </div>
  );
}
