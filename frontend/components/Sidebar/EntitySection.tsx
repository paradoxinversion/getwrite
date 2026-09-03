"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import useAppSelector, { useAppDispatch } from "../../src/store/hooks";
import { selectResource, updateResource } from "../../src/store/resourcesSlice";
import { selectActiveProjectDirectoryId } from "../../src/store/projectsSlice";
import { fetchEntityAliasTable } from "../../src/store/entityAliasTableSlice";
import { updateSidecar } from "../../src/lib/api/resources";
import { getAliasWarning } from "../../src/lib/models/entity-alias-warnings";
import type { AnyResource } from "../../src/lib/models/types";
import LabeledField from "./controls/LabeledField";
import useSyncedControlledValue from "./controls/useSyncedControlledValue";
import Input from "../common/UI/Input/Input";
import Button from "../common/UI/Button/Button";

/** Non-binding suggestions offered via a `<datalist>` — `entityKind` remains
 * an open, free-text value (Task 1); any non-empty string is accepted and
 * persisted verbatim. */
const ENTITY_KIND_SUGGESTIONS = ["character", "place", "object"];

const ENTITY_KIND_DATALIST_ID = "entity-kind-suggestions";

/**
 * Returns a copy of `resource` with `entityKind` set to `kind`, or explicitly
 * cleared to `undefined` when `kind` is blank (clearing entity status).
 *
 * The cleared value must be an explicit `entityKind: undefined` key on the
 * returned object rather than an omitted key: `updateResource`'s reducer
 * (`store/resourcesSlice.ts`) merges partial updates with a shallow
 * `{ ...previous, ...update }` spread, which only overwrites keys that are
 * *present* on `update` — an omitted key leaves the previous value in place.
 * `JSON.stringify` drops `undefined`-valued keys on its own, so the persisted
 * sidecar payload still omits `entityKind` entirely.
 *
 * Clearing never touches `aliases` — they stay dormant on the resource until
 * `entityKind` is set again (Task 1 schema allows aliases on a non-entity
 * resource).
 */
function withEntityKind(resource: AnyResource, kind: string): AnyResource {
  const trimmed = kind.trim();
  return {
    ...resource,
    entityKind: trimmed.length === 0 ? undefined : trimmed,
  };
}

/**
 * Sidebar section for declaring a resource as an entity (`entityKind`) and
 * editing its ordered `aliases` list (FR-1, FR-2, FR-15).
 *
 * Reads the active project's directory id and the selected resource from
 * Redux — no external props needed, mirroring `TagsSection`. Persists edits
 * via the existing `updateSidecar` sidecar write path used elsewhere in the
 * app (see `app/(app)/page.tsx`'s `updateResource` helper), optimistically
 * updating the Redux store first.
 */
export default function EntitySection(): JSX.Element | null {
  const projectId = useAppSelector(selectActiveProjectDirectoryId);
  const resource = useAppSelector((state) => selectResource(state.resources));
  const dispatch = useAppDispatch();

  const [newAlias, setNewAlias] = useState("");

  const persist = (updated: AnyResource): void => {
    dispatch(updateResource(updated));
    if (!projectId) return;
    // FR-12 trigger 3: refetch the alias table once this entity sidecar
    // write resolves, so open editors pick up the new/changed name or
    // aliases without a manual refresh. Only fires on success — a failed
    // write left the sidecar (and thus the alias table) unchanged.
    void updateSidecar(updated.id, projectId, updated)
      .then(() => {
        dispatch(fetchEntityAliasTable(projectId));
      })
      .catch(() => {
        // Best-effort persistence, consistent with other sidebar controls
        // (e.g. `app/(app)/page.tsx`'s `updateResource`, which logs and does
        // not roll back the optimistic update on failure).
      });
  };

  const [entityKindText, setEntityKindText] = useSyncedControlledValue(
    resource?.entityKind ?? "",
    (nextKind: string) => {
      if (!resource) return;
      persist(withEntityKind(resource, nextKind));
    },
  );

  if (!projectId || !resource) return null;

  const aliases = resource.aliases ?? [];
  const isEntity = (resource.entityKind ?? "").trim().length > 0;

  const commitAliases = (nextAliases: string[]): void => {
    persist({ ...resource, aliases: nextAliases });
  };

  const handleAddAlias = (): void => {
    const trimmed = newAlias.trim();
    if (trimmed.length === 0) return;
    commitAliases([...aliases, trimmed]);
    setNewAlias("");
  };

  const handleRemoveAlias = (index: number): void => {
    commitAliases(aliases.filter((_, i) => i !== index));
  };

  const handleMoveAlias = (index: number, direction: "up" | "down"): void => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= aliases.length) return;
    const next = [...aliases];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    commitAliases(next);
  };

  // An empty draft field is not yet an alias, so it gets no warning: without
  // this guard `getAliasWarning("")` correctly reports a zero-length string as
  // too short, and every entity opens showing a "very short" warning before
  // the writer has typed anything.
  const newAliasWarning = newAlias.trim() ? getAliasWarning(newAlias) : null;

  return (
    <div className="mt-0">
      <LabeledField label="Entity Kind" className="mb-4">
        <Input
          type="text"
          list={ENTITY_KIND_DATALIST_ID}
          aria-label="entity-kind-input"
          placeholder="e.g. character"
          className="w-full mt-2"
          value={entityKindText}
          onChange={(e) => setEntityKindText(e.target.value)}
        />
        <datalist id={ENTITY_KIND_DATALIST_ID}>
          {ENTITY_KIND_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </LabeledField>

      {isEntity && (
        <div>
          <label className="text-gw-micro font-medium font-mono">Aliases</label>

          {aliases.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {aliases.map((alias, index) => {
                const warning = getAliasWarning(alias);
                return (
                  <li key={`${alias}-${index}`} className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="flex-1 text-gw-label text-gw-primary">
                        {alias}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => handleMoveAlias(index, "up")}
                        disabled={index === 0}
                        aria-label={`Move ${alias} up`}
                      >
                        <ChevronUp size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleMoveAlias(index, "down")}
                        disabled={index === aliases.length - 1}
                        aria-label={`Move ${alias} down`}
                      >
                        <ChevronDown size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleRemoveAlias(index)}
                        aria-label={`Remove ${alias}`}
                      >
                        <X size={14} aria-hidden="true" />
                      </Button>
                    </div>
                    {warning && (
                      <p className="text-gw-nano text-gw-secondary mt-1">
                        {warning}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-start gap-1 mt-2">
            <div className="flex-1">
              <Input
                type="text"
                aria-label="new-alias-input"
                placeholder="Add alias"
                className="w-full"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAlias();
                  }
                }}
              />
              {newAliasWarning && (
                <p className="text-gw-nano text-gw-secondary mt-1">
                  {newAliasWarning}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={handleAddAlias}
              aria-label="add-alias"
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
