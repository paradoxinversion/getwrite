import React from "react";
import type { ResourceType } from "../../src/lib/models/types";
import {
  FileTextIcon,
  ImageIcon,
  AudioIcon,
} from "../ResourceTree/ResourceTreeIcons";

/**
 * One entry in the read-only entity-scoped compile list.
 *
 * This prop shape (`{ resourceId, name, resourceType }[]`) is an agreed
 * contract with the entity-mode `CompilePreviewModal.tsx` integration and
 * the `EntityMentionsSection.tsx` trigger wiring — do not rename these
 * fields without updating both.
 */
export interface EntityCompileEntry {
  resourceId: string;
  name: string;
  resourceType: string;
}

export interface EntityCompileResourceListProps {
  entries: EntityCompileEntry[];
}

function isCompilableTextResource(resourceType: string): boolean {
  return resourceType === ("text" satisfies ResourceType);
}

function renderEntryIcon(resourceType: string): React.ReactNode {
  switch (resourceType) {
    case "image":
      return <ImageIcon className="compile-tree-icon" />;
    case "audio":
      return <AudioIcon className="compile-tree-icon" />;
    default:
      return <FileTextIcon className="compile-tree-icon" />;
  }
}

/**
 * Read-only, ordered list of resources an entity-scoped compile will
 * include. Unlike `CompileResourceTree`, this list has no selection or
 * toggle affordance — the resource set is computed (FR-2/FR-3), not
 * user-picked. Per FR-11, any entry whose `resourceType` is not `"text"`
 * is visually marked as excluded, since `loadTextSections` silently drops
 * non-text resources from the compiled output.
 */
export default function EntityCompileResourceList({
  entries,
}: EntityCompileResourceListProps): JSX.Element {
  return (
    <div>
      <div className="compile-modal-meta-text mb-1">
        {entries.length} resource{entries.length === 1 ? "" : "s"} to compile
      </div>
      <ul
        className="border-hairline border-gw-border bg-gw-chrome2 max-h-80 overflow-y-auto py-2 list-none m-0 p-0"
        aria-label="Resources to compile"
        data-testid="entity-compile-resource-list"
      >
        {entries.map((entry) => {
          const isExcluded = !isCompilableTextResource(entry.resourceType);
          return (
            <li
              key={entry.resourceId}
              className="compile-tree-item entity-compile-list-item"
              data-testid="entity-compile-resource-list-item"
              data-excluded={isExcluded}
              style={{ paddingLeft: "8px" }}
            >
              <span className="compile-tree-label entity-compile-list-label">
                {renderEntryIcon(entry.resourceType)}
                <span
                  className={
                    isExcluded
                      ? "compile-tree-name entity-compile-list-name-excluded"
                      : "compile-tree-name"
                  }
                >
                  {entry.name}
                </span>
                {isExcluded ? (
                  <span className="entity-compile-list-excluded-label">
                    excluded — not a text resource
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
