"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Button from "../common/UI/Button/Button";
import EditContextMenu from "../common/UI/ContextMenu/EditContextMenu";
import { useAppDispatch } from "../../src/store/hooks";
import { changeMetadataFieldTypeWithMigration } from "../../src/store/projectsSlice";
import { fetchFieldValues } from "../../src/store/metadata-schema-transport-service";
import {
  NULL_VALUE_KEY,
  MISSING_VALUE_KEY,
} from "../../src/lib/models/field-value-keys";
import type { MetadataFieldType } from "../../src/lib/models/types";
import type { TypeMigrationEntry } from "../../src/lib/models/metadata-schema";
import type { FieldValueEntry } from "../../src/lib/models/metadata-schema-dispatch-core";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MigrationPreviewProps {
  fieldKey: string;
  fieldLabel: string;
  oldType: MetadataFieldType;
  newType: MetadataFieldType;
  /**
   * Project's on-disk directory basename — used to fetch field values.
   * Per FR12, distinct from `projectId` below (which mirrors
   * `project.json`'s internal `id`); see
   * `selectActiveProjectDirectoryId`'s doc comment in `projectsSlice.ts`.
   */
  directoryId: string;
  projectId: string;
  groupId: string;
  onCancel: () => void;
  /** Called after the migration thunk succeeds. */
  onApplied: () => void;
}

type ActionChoice = "keep" | "clear" | "normalize";

interface RowState {
  canonicalKey: string;
  count: number;
  display: string;
  action: ActionChoice;
  normalizedTo: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<MetadataFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Boolean",
  select: "Select",
  multiselect: "Multi",
  "resource-ref": "Ref",
  "multi-resource-ref": "Multi Ref",
};

function displayValue(entry: FieldValueEntry): string {
  if (entry.canonicalKey === MISSING_VALUE_KEY) return "(missing)";
  if (entry.canonicalKey === NULL_VALUE_KEY) return "(null)";
  if (entry.canonicalKey === "") return "(empty string)";
  if (typeof entry.sample === "object" && entry.sample !== null) {
    return JSON.stringify(entry.sample);
  }
  return String(entry.sample ?? entry.canonicalKey);
}

function defaultAction(): ActionChoice {
  return "keep";
}

function isSkippedEntry(canonicalKey: string): boolean {
  return (
    canonicalKey === NULL_VALUE_KEY ||
    canonicalKey === MISSING_VALUE_KEY ||
    canonicalKey === ""
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MigrationPreview({
  fieldKey,
  fieldLabel,
  oldType,
  newType,
  directoryId,
  projectId,
  groupId,
  onCancel,
  onApplied,
}: MigrationPreviewProps): JSX.Element {
  const dispatch = useAppDispatch();

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setFetchError(null);
    fetchFieldValues(directoryId, fieldKey)
      .then((entries) => {
        if (isCancelled) return;
        const initialRows: RowState[] = entries.map((e) => ({
          canonicalKey: e.canonicalKey,
          count: e.count,
          display: displayValue(e),
          action: defaultAction(),
          normalizedTo: "",
        }));
        setRows(initialRows);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        setFetchError(
          err instanceof Error ? err.message : "Failed to load values.",
        );
        setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [directoryId, fieldKey, newType]);

  function setRowAction(canonicalKey: string, action: ActionChoice): void {
    setRows((prev) =>
      prev.map((r) => (r.canonicalKey === canonicalKey ? { ...r, action } : r)),
    );
  }

  function setRowNormalizedTo(
    canonicalKey: string,
    normalizedTo: string,
  ): void {
    setRows((prev) =>
      prev.map((r) =>
        r.canonicalKey === canonicalKey ? { ...r, normalizedTo } : r,
      ),
    );
  }

  const activeRows = rows.filter((r) => !isSkippedEntry(r.canonicalKey));
  const skippedCount = rows
    .filter((r) => isSkippedEntry(r.canonicalKey))
    .reduce((sum, r) => sum + r.count, 0);
  const keptCount = activeRows
    .filter((r) => r.action === "keep" || r.action === "normalize")
    .reduce((sum, r) => sum + r.count, 0);

  const isSelectTarget = newType === "select" || newType === "multiselect";

  const newOptions = useMemo<string[]>(() => {
    if (!isSelectTarget) return [];
    const opts: string[] = [];
    for (const row of activeRows) {
      if (
        row.action === "keep" &&
        typeof row.canonicalKey === "string" &&
        row.canonicalKey.length > 0
      ) {
        opts.push(row.canonicalKey);
      } else if (row.action === "normalize" && row.normalizedTo.trim()) {
        const norm = row.normalizedTo.trim();
        if (!opts.includes(norm)) opts.push(norm);
      }
    }
    return opts;
  }, [activeRows, isSelectTarget]);

  async function handleApply(): Promise<void> {
    setIsApplying(true);
    setApplyError(null);

    const migrations: Record<string, TypeMigrationEntry> = {};
    for (const row of activeRows) {
      if (row.action === "keep") {
        migrations[row.canonicalKey] = { action: "keep" };
      } else if (row.action === "clear") {
        migrations[row.canonicalKey] = { action: "clear" };
      } else if (row.action === "normalize") {
        migrations[row.canonicalKey] = {
          action: "normalize",
          normalizedTo: row.normalizedTo.trim(),
        };
      }
    }

    try {
      await dispatch(
        changeMetadataFieldTypeWithMigration({
          projectId,
          groupId,
          fieldKey,
          newType,
          newOptions,
          migrations,
        }),
      ).unwrap();
      onApplied();
    } catch (err) {
      setApplyError(typeof err === "string" ? err : "Migration failed.");
      setIsApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-gw-chrome2 border border-gw-border-md rounded-sm w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-baseline gap-2 px-5 pt-5 pb-3 border-b border-gw-border flex-shrink-0">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-gw-secondary">
            Change type:
          </span>
          <span className="font-mono text-[11px] text-gw-primary">
            {fieldLabel}
          </span>
          <span className="font-mono text-[10px] text-gw-dim">
            ({TYPE_LABELS[oldType]} → {TYPE_LABELS[newType]})
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {isLoading && (
            <p className="font-mono text-[10px] text-gw-dim text-center py-6">
              Scanning values…
            </p>
          )}

          {fetchError && (
            <p className="font-mono text-[10px] text-gw-red py-4">
              {fetchError}
            </p>
          )}

          {!isLoading && !fetchError && rows.length === 0 && (
            <p className="font-mono text-[10px] text-gw-dim py-4 text-center">
              No values found — nothing to migrate.
            </p>
          )}

          {!isLoading && !fetchError && activeRows.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-center">
                {/* Column headers */}
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-gw-dim pb-1">
                  Value
                </span>
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-gw-dim pb-1 text-right">
                  Count
                </span>
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-gw-dim pb-1">
                  Action
                </span>

                {activeRows.map((row) => (
                  <Fragment key={row.canonicalKey}>
                    <span
                      className="font-mono text-[10px] text-gw-primary truncate"
                      title={row.display}
                    >
                      {row.display}
                    </span>
                    <span className="font-mono text-[10px] text-gw-dim text-right tabular-nums">
                      ×{row.count}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <select
                        className="bg-transparent border border-gw-border text-[10px] font-mono text-gw-secondary px-1 py-0.5 rounded-sm outline-none focus:border-gw-border-md transition-colors duration-150"
                        value={row.action}
                        onChange={(e) =>
                          setRowAction(
                            row.canonicalKey,
                            e.target.value as ActionChoice,
                          )
                        }
                        aria-label={`Action for ${row.display}`}
                      >
                        <option value="keep">Keep</option>
                        <option value="clear">Clear</option>
                        <option value="normalize">Normalize →</option>
                      </select>
                      {row.action === "normalize" && (
                        <EditContextMenu>
                          <input
                            type="text"
                            className="bg-transparent border-b border-gw-border text-[10px] font-mono text-gw-primary outline-none focus:border-gw-border-md w-20 py-0.5 transition-colors duration-150"
                            placeholder="new value"
                            value={row.normalizedTo}
                            onChange={(e) =>
                              setRowNormalizedTo(
                                row.canonicalKey,
                                e.target.value,
                              )
                            }
                            aria-label={`Normalize ${row.display} to`}
                          />
                        </EditContextMenu>
                      )}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {!isLoading && !fetchError && (
            <div className="border-t border-gw-border pt-3 space-y-1">
              {isSelectTarget && (
                <p className="font-mono text-[9px] text-gw-secondary">
                  New options:{" "}
                  {newOptions.length > 0 ? newOptions.join(", ") : "(none)"}
                </p>
              )}
              <p className="font-mono text-[9px] text-gw-dim">
                {keptCount} resource{keptCount !== 1 ? "s" : ""} retain a value
                · {skippedCount} are empty or missing
              </p>
            </div>
          )}

          {applyError && (
            <p className="font-mono text-[9px] text-gw-red mt-2">
              {applyError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gw-border flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void handleApply();
            }}
            disabled={isApplying || isLoading || Boolean(fetchError)}
          >
            {isApplying ? "Applying…" : "Apply migration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
