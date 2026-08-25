"use client";

import { useEffect, useState } from "react";
import useAppSelector, { useAppDispatch } from "../../src/store/hooks";
import {
  selectResource,
  setSelectedResourceId,
} from "../../src/store/resourcesSlice";
import { selectActiveProjectDirectoryId } from "../../src/store/projectsSlice";
import { getResourceMentions } from "../../src/lib/api/mentions";
import type { ResourceMention } from "../../src/lib/models/mentions-core";

/**
 * Read-only sidebar section listing the entities detected as mentioned
 * within the currently selected resource (FR-9). Read-only counterpart to
 * `EntitySection.tsx`'s editable entityKind/aliases editor — this section
 * never mutates the resource, it only surfaces `getResourceMentions`
 * results as navigable rows.
 *
 * Follows `StubResourcesSection.tsx`'s loading/empty-state convention:
 * loading renders a distinct, visible placeholder message; an empty result
 * (or no resource/project selected) renders nothing at all, so the section
 * never occupies space with a static "no mentions" state.
 *
 * Navigation reuses the app's established mechanism for jumping to a
 * resource from the sidebar (see `MultiResourceRefInput.tsx`'s ref chips
 * and `SearchBar.tsx`'s result rows): dispatching
 * `setSelectedResourceId(entityId)` rather than a Next.js `<Link>`, since
 * resource selection is Redux state, not a route.
 */
export default function EntitiesMentionedSection(): JSX.Element | null {
  const projectId = useAppSelector(selectActiveProjectDirectoryId);
  const resource = useAppSelector((state) => selectResource(state.resources));
  const dispatch = useAppDispatch();

  const [mentions, setMentions] = useState<ResourceMention[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const resourceId = resource?.id;

  useEffect(() => {
    if (!projectId || !resourceId) {
      setMentions([]);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    void getResourceMentions(projectId, resourceId).then((result) => {
      if (isCancelled) return;
      setMentions(result);
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [projectId, resourceId]);

  if (!projectId || !resourceId) return null;

  if (isLoading) {
    return (
      <p className="text-gw-nano text-gw-secondary" role="status">
        Loading mentions&hellip;
      </p>
    );
  }

  if (mentions.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2" aria-label="entities-mentioned-list">
      {mentions.map((mention) => (
        <li key={mention.entityId}>
          <button
            type="button"
            className="w-full text-left text-gw-label text-gw-primary hover:text-gw-secondary transition-colors duration-150"
            onClick={() => dispatch(setSelectedResourceId(mention.entityId))}
          >
            {mention.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
