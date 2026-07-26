"use client";

import React, { useEffect, useMemo, useState } from "react";
import Button from "../common/UI/Button/Button";
import { useAppDispatch } from "../../src/store/hooks";
import { updateMetadataFieldOptionsWithMigration } from "../../src/store/projectsSlice";
import { fetchFieldValues } from "../../src/store/metadata-schema-transport-service";
import {
  NULL_VALUE_KEY,
  MISSING_VALUE_KEY,
} from "../../src/lib/models/field-value-keys";
import type { MetadataFieldType } from "../../src/lib/models/types";
import type { OptionsMigrationEntry } from "../../src/lib/models/metadata-schema";
import type { FieldValueEntry } from "../../src/lib/models/metadata-schema-dispatch-core";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OptionsRemovalPreviewProps {
  fieldKey: string;
  fieldLabel: string;
  fieldType: MetadataFieldType;
  /** Options being removed (old options that are not in newOptions). */
  orphanedOptions: string[];
  /** The replacement options list the user typed (before add-to-options). */
  newOptions: string[];
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
  onApplied: () => void;
}

type ActionChoice = "clear" | "normalize" | "add-to-options";

interface RowState {
  option: string;
  count: number;
  action: ActionChoice;
  normalizedTo: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countOrphanedOption(
  entries: FieldValueEntry[],
  orphanedOption: string,
  fieldType: MetadataFieldType,
): number {
  if (fieldType === "multiselect") {
    return entries
      .filter((e) => {
        if (
          e.canonicalKey === NULL_VALUE_KEY ||
          e.canonicalKey === MISSING_VALUE_KEY
        )
          return false;
        return (
          Array.isArray(e.sample) &&
          (e.sample as unknown[]).includes(orphanedOption)
        );
      })
      .reduce((sum, e) => sum + e.count, 0);
  }
  const entry = entries.find((e) => e.canonicalKey === orphanedOption);
  return entry?.count ?? 0;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OptionsRemovalPreview({
  fieldKey,
  fieldLabel,
  fieldType,
  orphanedOptions,
  newOptions,
  directoryId,
  projectId,
  groupId,
  onCancel,
  onApplied,
}: OptionsRemovalPreviewProps): JSX.Element {
  const dispatch = useAppDispatch();

  const [isLoading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [isApplying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setFetchError(null);
    fetchFieldValues(directoryId, fieldKey)
      .then((entries) => {
        if (isCancelled) return;
        setRows(
          orphanedOptions.map((opt) => ({
            option: opt,
            count: countOrphanedOption(entries, opt, fieldType),
            action: "add-to-options" as ActionChoice,
            normalizedTo: "",
          })),
        );
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        setFetchError(
          err instanceof Error ? err.message : "Failed to load values.",
        );
        setLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [directoryId, fieldKey, fieldType, orphanedOptions]);

  function setRowAction(option: string, action: ActionChoice): void {
    setRows((prev) =>
      prev.map((r) => (r.option === option ? { ...r, action } : r)),
    );
  }

  function setRowNormalizedTo(option: string, normalizedTo: string): void {
    setRows((prev) =>
      prev.map((r) => (r.option === option ? { ...r, normalizedTo } : r)),
    );
  }

  const affectedCount = rows.reduce((sum, r) => sum + r.count, 0);

  const finalOptions = useMemo<string[]>(() => {
    const addBack = rows
      .filter((r) => r.action === "add-to-options")
      .map((r) => r.option);
    return [...newOptions, ...addBack];
  }, [rows, newOptions]);

  async function handleApply(): Promise<void> {
    setApplying(true);
    setApplyError(null);

    const migrations: Record<string, OptionsMigrationEntry> = {};
    for (const row of rows) {
      if (row.action === "add-to-options") {
        migrations[row.option] = { action: "add-to-options" };
      } else if (row.action === "clear") {
        migrations[row.option] = { action: "clear" };
      } else if (row.action === "normalize") {
        migrations[row.option] = {
          action: "normalize",
          normalizedTo: row.normalizedTo.trim(),
        };
      }
    }

    try {
      await dispatch(
        updateMetadataFieldOptionsWithMigration({
          projectId,
          groupId,
          fieldKey,
          newOptions,
          migrations,
        }),
      ).unwrap();
      onApplied();
    } catch (err) {
      setApplyError(typeof err === "string" ? err : "Migration failed.");
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-gw-chrome2 border border-gw-border-md rounded-sm w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-baseline gap-2 px-5 pt-5 pb-3 border-b border-gw-border flex-shrink-0">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-gw-secondary">
            Remove options:
          </span>
          <span className="font-mono text-[11px] text-gw-primary">
            {fieldLabel}
          </span>
          <span className="font-mono text-[10px] text-gw-dim">
            ({orphanedOptions.length} removed)
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

          {!isLoading && !fetchError && rows.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-center">
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-gw-dim pb-1">
                  Removed option
                </span>
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-gw-dim pb-1 text-right">
                  Used by
                </span>
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-gw-dim pb-1">
                  Action
                </span>

                {rows.map((row) => (
                  <React.Fragment key={row.option}>
                    <span
                      className="font-mono text-[10px] text-gw-primary truncate"
                      title={row.option}
                    >
                      {row.option}
                    </span>
                    <span className="font-mono text-[10px] text-gw-dim text-right tabular-nums">
                      {row.count > 0 ? `×${row.count}` : "—"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <select
                        className="bg-transparent border border-gw-border text-[10px] font-mono text-gw-secondary px-1 py-0.5 rounded-sm outline-none focus:border-gw-border-md transition-colors duration-150"
                        value={row.action}
                        onChange={(e) =>
                          setRowAction(
                            row.option,
                            e.target.value as ActionChoice,
                          )
                        }
                        aria-label={`Action for option ${row.option}`}
                      >
                        <option value="add-to-options">Keep option</option>
                        <option value="normalize">Remap →</option>
                        <option value="clear">Remove value</option>
                      </select>
                      {row.action === "normalize" && (
                        <select
                          className="bg-transparent border border-gw-border text-[10px] font-mono text-gw-secondary px-1 py-0.5 rounded-sm outline-none focus:border-gw-border-md transition-colors duration-150"
                          value={row.normalizedTo}
                          onChange={(e) =>
                            setRowNormalizedTo(row.option, e.target.value)
                          }
                          aria-label={`Remap ${row.option} to`}
                        >
                          <option value="">— pick target —</option>
                          {newOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {!isLoading && !fetchError && (
            <div className="border-t border-gw-border pt-3 space-y-1">
              <p className="font-mono text-[9px] text-gw-secondary">
                Final options:{" "}
                {finalOptions.length > 0 ? finalOptions.join(", ") : "(none)"}
              </p>
              <p className="font-mono text-[9px] text-gw-dim">
                {affectedCount > 0
                  ? `${affectedCount} resource${affectedCount !== 1 ? "s" : ""} use removed options`
                  : "No resources use these options — safe to remove."}
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
            {isApplying ? "Applying…" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
