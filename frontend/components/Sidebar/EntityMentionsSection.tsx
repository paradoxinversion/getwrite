"use client";

import { useEffect, useState } from "react";
import useAppSelector, { useAppDispatch } from "../../src/store/hooks";
import {
  selectResource,
  setSelectedResourceId,
} from "../../src/store/resourcesSlice";
import { selectActiveProjectDirectoryId } from "../../src/store/projectsSlice";
import { getEntityMentionedIn } from "../../src/lib/api/mentions";
import type { EntityMentionedIn } from "../../src/lib/models/mentions-core";

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
 */
export default function EntityMentionsSection(): JSX.Element | null {
  const projectId = useAppSelector(selectActiveProjectDirectoryId);
  const resource = useAppSelector((state) => selectResource(state.resources));
  const dispatch = useAppDispatch();

  const [rows, setRows] = useState<EntityMentionedIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  if (!projectId || !resourceId || !entityKind) return null;

  if (isLoading) {
    return (
      <p className="text-gw-nano text-gw-secondary" role="status">
        Loading mentions&hellip;
      </p>
    );
  }

  if (rows.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3" aria-label="entity-mentions-list">
      {rows.map((row) => (
        <li key={row.resourceId} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="text-left text-gw-label text-gw-primary hover:text-gw-secondary transition-colors duration-150"
              onClick={() => dispatch(setSelectedResourceId(row.resourceId))}
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
                    <p className="text-gw-nano text-gw-secondary">{snippet}</p>
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
  );
}
