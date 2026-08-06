"use client";

import React from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, X } from "lucide-react";
import Button from "../common/UI/Button/Button";
import Card from "../common/UI/Card/Card";
import useAppSelector, { useAppDispatch } from "../../src/store/hooks";
import {
  selectActiveProjectMetadataSchema,
  selectSelectedProjectId,
  selectActiveProjectDirectoryId,
  addMetadataField,
  deprecateMetadataField,
  clearMetadataField,
  reorderMetadataFields,
  renameMetadataField,
  updateMetadataFieldOptions,
  addMetadataGroup,
  removeMetadataGroup,
  reorderMetadataGroups,
  renameMetadataFieldKey,
  updateMetadataRefProperties,
} from "../../src/store/projectsSlice";
import FolderTreePicker from "../ResourceTree/FolderTreePicker";
import MigrationPreview from "./MigrationPreview";
import OptionsRemovalPreview from "./OptionsRemovalPreview";
import DeprecateOrClearDialog from "./DeprecateOrClearDialog";
import type { Folder, MetadataFieldType } from "../../src/lib/models/types";
import { slugifyName, deriveLabel } from "../../src/lib/models/field-dedup";
import ConfirmDialog from "../common/ConfirmDialog";
import EditContextMenu from "../common/UI/ContextMenu/EditContextMenu";
import ProjectFeatureToggles from "../preferences/ProjectFeatureToggles";
import ProjectEncryptionPanel from "../preferences/ProjectEncryptionPanel";

const SLUG_RE = /^[a-z0-9-]+$/;

const FIELD_TYPE_LABELS: Record<MetadataFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Boolean",
  select: "Select",
  multiselect: "Multi",
  "resource-ref": "Ref",
  "multi-resource-ref": "Multi Ref",
};

type DeleteTarget = { type: "group"; groupId: string; label: string };

interface FieldRemoveTarget {
  groupId: string;
  fieldKey: string;
  label: string;
}

interface EditTarget {
  groupId: string;
  fieldKey: string;
}

interface KeyEditTarget {
  groupId: string;
  fieldKey: string;
  fieldLabel: string;
}

interface TypeChangeRequest {
  groupId: string;
  fieldKey: string;
  fieldLabel: string;
  oldType: MetadataFieldType;
  newType: MetadataFieldType;
}

interface OptionsRemovalRequest {
  groupId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: MetadataFieldType;
  orphanedOptions: string[];
  newOptions: string[];
}

interface KeyRenameConfirm {
  groupId: string;
  oldKey: string;
  newKey: string;
  fieldLabel: string;
}

/** Pre-populated values for the "Create field" form, supplied by the chip UI. */
export interface SchemaManagerPrefill {
  /** The name the user typed in the field picker (e.g. "tension"). */
  name: string;
  /** Auto-derived display label (e.g. "Tension"). */
  label: string;
  /** When the chip query has a folder predicate, default to this group. */
  preferredGroupId?: string;
}

export interface SchemaManagerProps {
  /**
   * Optional close handler. The consolidated Project Settings dialog owns the
   * single Close affordance, so this panel no longer renders its own; the prop
   * is retained for standalone callers (stories/tests) that still supply one.
   */
  onClose?: () => void;
  /** When supplied, opens with a pre-populated "Create field" form at the top. */
  prefill?: SchemaManagerPrefill;
  /** Called with the new field's key after a prefilled creation completes. */
  onCreated?: (fieldKey: string) => void;
}

export default function SchemaManager({
  prefill,
  onCreated,
}: SchemaManagerProps): JSX.Element {
  const dispatch = useAppDispatch();
  const schema = useAppSelector(selectActiveProjectMetadataSchema);
  const projectId = useAppSelector(selectSelectedProjectId);
  // Directory basename (per FR12, distinct from `projectId`/`project.json`'s
  // internal `id` above) — the value the metadata-schema field-values GET
  // route actually expects. See selectActiveProjectDirectoryId's doc comment.
  const directoryId = useAppSelector(selectActiveProjectDirectoryId);
  const folders = useAppSelector(
    (state) => (state.resources as unknown as { folders: Folder[] }).folders,
  );

  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(
    null,
  );
  const [fieldRemoveTarget, setFieldRemoveTarget] =
    React.useState<FieldRemoveTarget | null>(null);
  const [editTarget, setEditTarget] = React.useState<EditTarget | null>(null);
  const [typeChangeRequest, setTypeChangeRequest] =
    React.useState<TypeChangeRequest | null>(null);
  const [optionsRemovalRequest, setOptionsRemovalRequest] =
    React.useState<OptionsRemovalRequest | null>(null);
  const [editValue, setEditValue] = React.useState<string>("");
  const [optionsEdits, setOptionsEdits] = React.useState<
    Record<string, string>
  >({});
  const [keyEditTarget, setKeyEditTarget] =
    React.useState<KeyEditTarget | null>(null);
  const [keyEditValue, setKeyEditValue] = React.useState<string>("");
  const [keyEditError, setKeyEditError] = React.useState<string>("");
  const [keyRenameConfirm, setKeyRenameConfirm] =
    React.useState<KeyRenameConfirm | null>(null);

  // ── Prefill "Create field" form ──────────────────────────────────────────

  function defaultGroupForPrefill(): string {
    if (prefill?.preferredGroupId) {
      const found = schema.groups.find(
        (g) => g.id === prefill.preferredGroupId,
      );
      if (found) return found.id;
    }
    const projectGroup = schema.groups.find(
      (g) => !g.id.startsWith("builtin-"),
    );
    return projectGroup?.id ?? schema.groups[0]?.id ?? "";
  }

  const [isPrefillVisible, setIsPrefillVisible] = React.useState(
    Boolean(prefill),
  );
  const [prefillKey, setPrefillKey] = React.useState(() =>
    prefill ? slugifyName(prefill.name) : "",
  );
  const [prefillLabel, setPrefillLabel] = React.useState(() =>
    prefill ? prefill.label : "",
  );
  const [prefillType, setPrefillType] =
    React.useState<MetadataFieldType>("text");
  const [prefillGroupId, setPrefillGroupId] = React.useState(() =>
    prefill ? defaultGroupForPrefill() : "",
  );
  const [prefillError, setPrefillError] = React.useState("");
  const [isPrefillSubmitting, setIsPrefillSubmitting] = React.useState(false);

  async function handlePrefillCreate(): Promise<void> {
    if (!projectId) return;
    const key = prefillKey.trim();
    if (!key) {
      setPrefillError("Key is required.");
      return;
    }
    if (!SLUG_RE.test(key)) {
      setPrefillError("Key must match /^[a-z0-9-]+$/.");
      return;
    }
    const allKeys = schema.groups.flatMap((g) => g.fields.map((f) => f.key));
    if (allKeys.includes(key)) {
      setPrefillError(`Field key "${key}" already exists.`);
      return;
    }
    const groupId = prefillGroupId || defaultGroupForPrefill();
    if (!groupId) {
      setPrefillError("No group available. Add a group first.");
      return;
    }
    setIsPrefillSubmitting(true);
    try {
      await dispatch(
        addMetadataField({
          projectId,
          groupId,
          field: {
            key,
            label: prefillLabel.trim() || deriveLabel(key),
            type: prefillType,
          },
        }),
      ).unwrap();
      setIsPrefillVisible(false);
      onCreated?.(key);
    } catch (error) {
      setPrefillError(
        typeof error === "string" ? error : "Failed to create field.",
      );
    } finally {
      setIsPrefillSubmitting(false);
    }
  }

  // ── Label / key edit machinery ──────────────────────────────────────────

  // Tracks whether the in-progress label edit was cancelled via Escape.
  // Using a ref prevents the stale-closure issue between onKeyDown (cancel)
  // and the onBlur handler that fires when the input unmounts.
  const editCancelledRef = React.useRef(false);
  // Same pattern for key edit.
  const keyEditCancelledRef = React.useRef(false);

  // Radix's useEscapeKeydown registers on document in capture phase, so
  // e.stopPropagation() in React's onKeyDown is too late. We register our
  // own capture listener and call preventDefault() when an inline edit is in
  // progress, which prevents Radix from closing the outer SchemaManager dialog.
  const inlineEditActiveRef = React.useRef(false);
  React.useLayoutEffect(() => {
    inlineEditActiveRef.current = keyEditTarget !== null || editTarget !== null;
  }, [keyEditTarget, editTarget]);
  React.useEffect(() => {
    // Radix's useEscapeKeydown registers on document in capture phase and
    // calls onDismiss unless e.defaultPrevented. By calling preventDefault()
    // here (which fires first, since children's effects run before parents'),
    // we block Radix from closing the outer dialog while an inline edit is
    // active. The event still propagates to the input so onKeyDown fires.
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && inlineEditActiveRef.current) {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () =>
      document.removeEventListener("keydown", handler, { capture: true });
  }, []);

  function beginLabelEdit(
    groupId: string,
    fieldKey: string,
    currentLabel: string,
  ): void {
    editCancelledRef.current = false;
    setEditTarget({ groupId, fieldKey });
    setEditValue(currentLabel);
  }

  function commitLabelEdit(): void {
    if (editCancelledRef.current) {
      setEditTarget(null);
      return;
    }
    if (!editTarget || !projectId) {
      setEditTarget(null);
      return;
    }
    const trimmed = editValue.trim();
    if (trimmed) {
      void dispatch(
        renameMetadataField({
          projectId,
          groupId: editTarget.groupId,
          fieldKey: editTarget.fieldKey,
          newLabel: trimmed,
        }),
      );
    }
    setEditTarget(null);
  }

  function cancelLabelEdit(): void {
    editCancelledRef.current = true;
    setEditTarget(null);
  }

  function beginKeyEdit(
    groupId: string,
    fieldKey: string,
    fieldLabel: string,
  ): void {
    keyEditCancelledRef.current = false;
    setKeyEditTarget({ groupId, fieldKey, fieldLabel });
    setKeyEditValue(fieldKey);
    setKeyEditError("");
  }

  function commitKeyEdit(): void {
    if (keyEditCancelledRef.current) {
      setKeyEditTarget(null);
      return;
    }
    if (!keyEditTarget || !projectId) {
      setKeyEditTarget(null);
      return;
    }
    const trimmed = keyEditValue.trim();
    if (!trimmed || trimmed === keyEditTarget.fieldKey) {
      setKeyEditTarget(null);
      return;
    }
    if (!SLUG_RE.test(trimmed)) {
      setKeyEditError("Must be lowercase letters, numbers, and hyphens only.");
      return;
    }
    setKeyRenameConfirm({
      groupId: keyEditTarget.groupId,
      oldKey: keyEditTarget.fieldKey,
      newKey: trimmed,
      fieldLabel: keyEditTarget.fieldLabel,
    });
    setKeyEditTarget(null);
  }

  function cancelKeyEdit(): void {
    keyEditCancelledRef.current = true;
    setKeyEditTarget(null);
    setKeyEditError("");
  }

  function confirmKeyRename(): void {
    if (!keyRenameConfirm || !projectId) {
      setKeyRenameConfirm(null);
      return;
    }
    void dispatch(
      renameMetadataFieldKey({
        projectId,
        groupId: keyRenameConfirm.groupId,
        fieldKey: keyRenameConfirm.oldKey,
        newKey: keyRenameConfirm.newKey,
      }),
    );
    setKeyRenameConfirm(null);
  }

  function confirmDeleteTarget(): void {
    if (!deleteTarget || !projectId) {
      setDeleteTarget(null);
      return;
    }
    void dispatch(
      removeMetadataGroup({ projectId, groupId: deleteTarget.groupId }),
    );
    setDeleteTarget(null);
  }

  function handleFieldDeprecate(): void {
    if (!fieldRemoveTarget || !projectId) {
      setFieldRemoveTarget(null);
      return;
    }
    void dispatch(
      deprecateMetadataField({
        projectId,
        groupId: fieldRemoveTarget.groupId,
        fieldKey: fieldRemoveTarget.fieldKey,
      }),
    );
    setFieldRemoveTarget(null);
  }

  function handleFieldClear(): void {
    if (!fieldRemoveTarget || !projectId) {
      setFieldRemoveTarget(null);
      return;
    }
    void dispatch(
      clearMetadataField({
        projectId,
        groupId: fieldRemoveTarget.groupId,
        fieldKey: fieldRemoveTarget.fieldKey,
      }),
    );
    setFieldRemoveTarget(null);
  }

  function moveField(
    groupId: string,
    fieldKey: string,
    direction: "up" | "down",
  ): void {
    if (!projectId) return;
    const group = schema.groups.find((g) => g.id === groupId);
    if (!group) return;
    const keys = group.fields.map((f) => f.key);
    const idx = keys.indexOf(fieldKey);
    if (idx < 0) return;
    const nextIdx = direction === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= keys.length) return;
    const newOrder = [...keys];
    [newOrder[idx], newOrder[nextIdx]] = [newOrder[nextIdx], newOrder[idx]];
    void dispatch(
      reorderMetadataFields({ projectId, groupId, newKeyOrder: newOrder }),
    );
  }

  function moveGroup(groupId: string, direction: "up" | "down"): void {
    if (!projectId) return;
    const ids = schema.groups.map((g) => g.id);
    const idx = ids.indexOf(groupId);
    if (idx < 0) return;
    const nextIdx = direction === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= ids.length) return;
    const newOrder = [...ids];
    [newOrder[idx], newOrder[nextIdx]] = [newOrder[nextIdx], newOrder[idx]];
    void dispatch(
      reorderMetadataGroups({ projectId, newGroupIdOrder: newOrder }),
    );
  }

  function handleAddGroup(): void {
    if (!projectId) return;
    void dispatch(
      addMetadataGroup({
        projectId,
        group: { id: `group-${Date.now()}`, label: "New Group", fields: [] },
      }),
    );
  }

  function handleAddFieldInGroup(groupId: string): void {
    if (!projectId) return;
    void dispatch(
      addMetadataField({
        projectId,
        groupId,
        field: { key: `field-${Date.now()}`, label: "New Field", type: "text" },
      }),
    );
  }

  function getOptionsKey(groupId: string, fieldKey: string): string {
    return `${groupId}::${fieldKey}`;
  }

  function commitOptions(groupId: string, fieldKey: string): void {
    if (!projectId) return;
    const key = getOptionsKey(groupId, fieldKey);
    const raw = optionsEdits[key];
    if (raw === undefined) return;
    const newOptions = raw
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);

    const group = schema.groups.find((g) => g.id === groupId);
    const field = group?.fields.find((f) => f.key === fieldKey);
    const oldOptions = field?.options ?? [];
    const orphanedOptions = oldOptions.filter((o) => !newOptions.includes(o));

    setOptionsEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (orphanedOptions.length > 0 && field) {
      setOptionsRemovalRequest({
        groupId,
        fieldKey,
        fieldLabel: field.label,
        fieldType: field.type,
        orphanedOptions,
        newOptions,
      });
    } else {
      void dispatch(
        updateMetadataFieldOptions({
          projectId,
          groupId,
          fieldKey,
          options: newOptions,
        }),
      );
    }
  }

  return (
    <>
      <div className="flex w-full flex-col gap-6">
        <header className="flex flex-col gap-1 border-b border-gw-border pb-4">
          <h2 className="text-lg font-semibold text-gw-primary">
            Metadata Fields
          </h2>
          <p className="max-w-2xl text-sm text-gw-secondary">
            Add, remove, and reorder fields shown in the metadata sidebar.
          </p>
        </header>

        {/* ── Built-in feature toggles (co-located with the fields they govern) ── */}
        <ProjectFeatureToggles />

        {/* ── Encryption: the one route into encrypting this project (FR2) ── */}
        <ProjectEncryptionPanel />

        {/* ── Prefill "Create field" form ── */}
        {isPrefillVisible && (
          <div className="rounded border border-gw-border bg-gw-chrome2 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-gw-secondary">
                Create a new field
              </span>
              <Button
                variant="ghost"
                onClick={() => setIsPrefillVisible(false)}
                aria-label="Dismiss create field form"
              >
                <X size={13} aria-hidden="true" />
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {/* Key */}
              <div className="flex items-center gap-2">
                <label className="w-12 shrink-0 font-mono text-[10px] text-gw-secondary">
                  Key
                </label>
                <EditContextMenu>
                  <input
                    type="text"
                    value={prefillKey}
                    onChange={(e) => {
                      setPrefillKey(e.target.value);
                      setPrefillError("");
                    }}
                    className="flex-1 rounded border border-gw-border bg-transparent px-2 py-1 font-mono text-[11px] text-gw-primary focus:outline-none focus:ring-1 focus:ring-gw-border"
                    aria-label="New field key"
                    autoFocus
                  />
                </EditContextMenu>
              </div>

              {/* Label */}
              <div className="flex items-center gap-2">
                <label className="w-12 shrink-0 font-mono text-[10px] text-gw-secondary">
                  Label
                </label>
                <EditContextMenu>
                  <input
                    type="text"
                    value={prefillLabel}
                    onChange={(e) => setPrefillLabel(e.target.value)}
                    className="flex-1 rounded border border-gw-border bg-transparent px-2 py-1 font-mono text-[11px] text-gw-primary focus:outline-none focus:ring-1 focus:ring-gw-border"
                    aria-label="New field label"
                  />
                </EditContextMenu>
              </div>

              {/* Type */}
              <div className="flex items-center gap-2">
                <label className="w-12 shrink-0 font-mono text-[10px] text-gw-secondary">
                  Type
                </label>
                <select
                  value={prefillType}
                  onChange={(e) =>
                    setPrefillType(e.target.value as MetadataFieldType)
                  }
                  className="rounded border border-gw-border bg-transparent px-1.5 py-1 font-mono text-[11px] text-gw-primary focus:outline-none focus:ring-1 focus:ring-gw-border"
                  aria-label="New field type"
                >
                  {(
                    Object.entries(FIELD_TYPE_LABELS) as [
                      MetadataFieldType,
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Group */}
              {schema.groups.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="w-12 shrink-0 font-mono text-[10px] text-gw-secondary">
                    Group
                  </label>
                  <select
                    value={prefillGroupId}
                    onChange={(e) => setPrefillGroupId(e.target.value)}
                    className="rounded border border-gw-border bg-transparent px-1.5 py-1 font-mono text-[11px] text-gw-primary focus:outline-none focus:ring-1 focus:ring-gw-border"
                    aria-label="New field group"
                  >
                    {schema.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {prefillError && (
                <p
                  className="font-mono text-[10px] text-gw-secondary"
                  role="alert"
                >
                  {prefillError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsPrefillVisible(false)}
                  disabled={isPrefillSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    void handlePrefillCreate();
                  }}
                  disabled={isPrefillSubmitting || !projectId}
                >
                  {isPrefillSubmitting ? "Creating…" : "Create field"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {schema.groups.length === 0 ? (
            <p className="text-sm text-gw-secondary">
              No groups yet. Add one below.
            </p>
          ) : null}

          {schema.groups.map((group, groupIndex) => {
            const isFirstGroup = groupIndex === 0;
            const isLastGroup = groupIndex === schema.groups.length - 1;
            const hasGroupLockedFields = group.fields.some((f) => f.locked);

            return (
              <Card key={group.id} padding="none">
                {/* Group header */}
                <div className="flex items-center gap-1 border-b border-gw-border px-4 py-3">
                  <span className="flex-1 font-mono text-[11px] uppercase tracking-[0.12em] text-gw-secondary">
                    {group.label}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => moveGroup(group.id, "up")}
                    disabled={isFirstGroup}
                    aria-label={`Move ${group.label} group up`}
                  >
                    <ChevronUp size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => moveGroup(group.id, "down")}
                    disabled={isLastGroup}
                    aria-label={`Move ${group.label} group down`}
                  >
                    <ChevronDown size={14} aria-hidden="true" />
                  </Button>
                  {!hasGroupLockedFields ? (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setDeleteTarget({
                          type: "group",
                          groupId: group.id,
                          label: group.label,
                        })
                      }
                      aria-label={`Delete ${group.label} group`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>

                {/* Field list */}
                <div className="px-4 py-1">
                  {group.fields.length === 0 ? (
                    <p className="py-2 text-sm text-gw-secondary">
                      No fields yet.
                    </p>
                  ) : null}
                  {group.fields.map((field, fieldIndex) => {
                    const isFirstField = fieldIndex === 0;
                    const isLastField = fieldIndex === group.fields.length - 1;
                    const isEditing =
                      editTarget?.groupId === group.id &&
                      editTarget?.fieldKey === field.key;
                    const isKeyEditing =
                      keyEditTarget?.groupId === group.id &&
                      keyEditTarget?.fieldKey === field.key;
                    const optionsKey = getOptionsKey(group.id, field.key);
                    const hasOptions =
                      field.type === "select" || field.type === "multiselect";
                    const isMultiRef = field.type === "multi-resource-ref";

                    return (
                      <div
                        key={field.key}
                        className="flex flex-col gap-1 border-b border-gw-border py-2 last:border-b-0"
                      >
                        <div className="flex items-center gap-1">
                          {/* Label — inline editable for non-locked fields */}
                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              <EditContextMenu>
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={commitLabelEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitLabelEdit();
                                    if (e.key === "Escape") cancelLabelEdit();
                                  }}
                                  autoFocus
                                  className="w-full rounded border border-gw-border bg-transparent px-2 py-0.5 text-sm text-gw-primary focus:outline-none focus:ring-1 focus:ring-gw-border"
                                  aria-label={`Edit label for ${field.key}`}
                                />
                              </EditContextMenu>
                            ) : (
                              <button
                                type="button"
                                disabled={field.locked}
                                onClick={() =>
                                  beginLabelEdit(
                                    group.id,
                                    field.key,
                                    field.label,
                                  )
                                }
                                className="w-full truncate text-left text-sm text-gw-primary disabled:cursor-default"
                                aria-label={
                                  field.locked
                                    ? field.label
                                    : `Rename ${field.label}`
                                }
                              >
                                {field.label}
                              </button>
                            )}
                          </div>

                          {/* Type badge / selector */}
                          {field.locked ? (
                            <span className="shrink-0 rounded border border-gw-border px-1.5 py-0.5 font-mono text-[10px] text-gw-secondary">
                              {FIELD_TYPE_LABELS[field.type]}
                            </span>
                          ) : (
                            <select
                              value={field.type}
                              onChange={(e) => {
                                if (!projectId) return;
                                const newType = e.target
                                  .value as MetadataFieldType;
                                if (newType === field.type) return;
                                setTypeChangeRequest({
                                  groupId: group.id,
                                  fieldKey: field.key,
                                  fieldLabel: field.label,
                                  oldType: field.type,
                                  newType,
                                });
                              }}
                              className="shrink-0 rounded border border-gw-border bg-transparent px-1.5 py-0.5 font-mono text-[10px] text-gw-secondary focus:outline-none focus:ring-1 focus:ring-gw-border"
                              aria-label={`Field type for ${field.label}`}
                            >
                              {(
                                Object.entries(FIELD_TYPE_LABELS) as [
                                  MetadataFieldType,
                                  string,
                                ][]
                              ).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          )}

                          {/* Locked badge */}
                          {field.locked ? (
                            <span className="shrink-0 font-mono text-[10px] text-gw-secondary opacity-60">
                              built-in
                            </span>
                          ) : null}

                          {/* Deprecated badge */}
                          {field.deprecated ? (
                            <span className="shrink-0 rounded border border-gw-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.10em] text-gw-dim opacity-70">
                              deprecated
                            </span>
                          ) : null}

                          {/* Move up */}
                          <Button
                            variant="ghost"
                            className="shrink-0"
                            onClick={() => moveField(group.id, field.key, "up")}
                            disabled={isFirstField}
                            aria-label={`Move ${field.label} up`}
                          >
                            <ChevronUp size={13} aria-hidden="true" />
                          </Button>

                          {/* Move down */}
                          <Button
                            variant="ghost"
                            className="shrink-0"
                            onClick={() =>
                              moveField(group.id, field.key, "down")
                            }
                            disabled={isLastField}
                            aria-label={`Move ${field.label} down`}
                          >
                            <ChevronDown size={13} aria-hidden="true" />
                          </Button>

                          {/* Remove — only for non-locked fields */}
                          {!field.locked ? (
                            <Button
                              variant="ghost"
                              className="shrink-0"
                              onClick={() =>
                                setFieldRemoveTarget({
                                  groupId: group.id,
                                  fieldKey: field.key,
                                  label: field.label,
                                })
                              }
                              aria-label={`Remove ${field.label}`}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>

                        {/* Key display / edit row */}
                        <div className="flex items-center gap-1.5 pl-1">
                          {isKeyEditing ? (
                            <div className="flex flex-1 flex-col gap-0.5">
                              <EditContextMenu>
                                <input
                                  type="text"
                                  value={keyEditValue}
                                  onChange={(e) => {
                                    setKeyEditValue(e.target.value);
                                    setKeyEditError("");
                                  }}
                                  onBlur={commitKeyEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      // Prevent the browser from activating the
                                      // ConfirmDialog's Cancel button as Enter's
                                      // default action after focus moves into the
                                      // just-mounted dialog.
                                      e.preventDefault();
                                      commitKeyEdit();
                                    }
                                    if (e.key === "Escape") cancelKeyEdit();
                                  }}
                                  autoFocus
                                  className="rounded border border-gw-border bg-transparent px-2 py-0.5 font-mono text-[11px] text-gw-primary focus:outline-none focus:ring-1 focus:ring-gw-border"
                                  aria-label={`Edit key for ${field.key}`}
                                />
                              </EditContextMenu>
                              {keyEditError ? (
                                <span className="font-mono text-[10px] text-gw-secondary">
                                  {keyEditError}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <span className="font-mono text-[10px] text-gw-secondary opacity-50">
                                {field.key}
                              </span>
                              {!field.locked ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    beginKeyEdit(
                                      group.id,
                                      field.key,
                                      field.label,
                                    )
                                  }
                                  className="font-mono text-[10px] text-gw-secondary transition-colors duration-150 hover:text-gw-primary"
                                  aria-label={`Rename key of ${field.label}`}
                                >
                                  rename key
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>

                        {/* Options editor for select / multiselect */}
                        {hasOptions ? (
                          <div className="ml-1 mt-1">
                            <label className="mb-1 block text-[11px] text-gw-secondary">
                              Options (one per line)
                            </label>
                            <EditContextMenu>
                              <textarea
                                rows={3}
                                className="w-full resize-none rounded border border-gw-border bg-transparent px-2 py-1 font-mono text-xs text-gw-primary focus:outline-none focus:ring-1 focus:ring-gw-border"
                                aria-label={`Options for ${field.label}`}
                                value={
                                  optionsEdits[optionsKey] !== undefined
                                    ? optionsEdits[optionsKey]
                                    : (field.options ?? []).join("\n")
                                }
                                onChange={(e) =>
                                  setOptionsEdits((prev) => ({
                                    ...prev,
                                    [optionsKey]: e.target.value,
                                  }))
                                }
                                onBlur={() =>
                                  commitOptions(group.id, field.key)
                                }
                              />
                            </EditContextMenu>
                          </div>
                        ) : null}

                        {/* Folder picker + Include Subfolders for multi-resource-ref */}
                        {isMultiRef ? (
                          <div className="ml-1 mt-1 flex flex-col gap-1">
                            <label className="text-[11px] text-gw-secondary">
                              Folder scope
                            </label>
                            <FolderTreePicker
                              folders={folders}
                              value={field.refFolder ?? undefined}
                              onChange={(val) => {
                                if (!projectId) return;
                                void dispatch(
                                  updateMetadataRefProperties({
                                    projectId,
                                    groupId: group.id,
                                    fieldKey: field.key,
                                    updates: val
                                      ? { refFolder: val }
                                      : {
                                          refFolder: null,
                                          includeSubfolders: null,
                                        },
                                  }),
                                );
                              }}
                              rootLabel="Any folder"
                              className="font-mono text-[10px]"
                              aria-label={`Ref folder for ${field.label}`}
                            />
                            {field.refFolder ? (
                              <label className="flex items-center gap-1.5 font-mono text-[10px] text-gw-secondary">
                                <input
                                  type="checkbox"
                                  checked={field.includeSubfolders ?? false}
                                  onChange={(e) => {
                                    if (!projectId) return;
                                    void dispatch(
                                      updateMetadataRefProperties({
                                        projectId,
                                        groupId: group.id,
                                        fieldKey: field.key,
                                        updates: {
                                          includeSubfolders: e.target.checked,
                                        },
                                      }),
                                    );
                                  }}
                                  aria-label={`Include subfolders for ${field.label}`}
                                />
                                Include subfolders
                              </label>
                            ) : null}
                            <label className="text-[11px] text-gw-secondary">
                              Max selections
                            </label>
                            <EditContextMenu>
                              <input
                                key={field.maxSelections ?? "none"}
                                type="number"
                                min={1}
                                defaultValue={field.maxSelections ?? ""}
                                onBlur={(e) => {
                                  if (!projectId) return;
                                  const raw = e.target.value;
                                  const parsed = parseInt(raw, 10);
                                  if (raw === "") {
                                    void dispatch(
                                      updateMetadataRefProperties({
                                        projectId,
                                        groupId: group.id,
                                        fieldKey: field.key,
                                        updates: { maxSelections: null },
                                      }),
                                    );
                                  } else if (!isNaN(parsed) && parsed >= 1) {
                                    void dispatch(
                                      updateMetadataRefProperties({
                                        projectId,
                                        groupId: group.id,
                                        fieldKey: field.key,
                                        updates: { maxSelections: parsed },
                                      }),
                                    );
                                  }
                                }}
                                className="rounded border border-gw-border bg-transparent px-2 py-0.5 font-mono text-[11px] text-gw-primary focus:outline-none focus:ring-1 focus:ring-gw-border"
                                aria-label={`Max selections for ${field.label}`}
                              />
                            </EditContextMenu>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Add field within group */}
                <div className="border-t border-gw-border px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddFieldInGroup(group.id)}
                    disabled={!projectId}
                    aria-label={`Add field to ${group.label}`}
                  >
                    <Plus size={12} aria-hidden="true" />
                    Add field
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Add Group footer */}
        <div className="border-t border-gw-border pt-4">
          <Button
            variant="secondary"
            onClick={handleAddGroup}
            disabled={!projectId}
            aria-label="Add schema group"
          >
            <Plus size={13} aria-hidden="true" />
            Add Group
          </Button>
        </div>
      </div>

      {/* Type change migration preview */}
      {typeChangeRequest !== null &&
        directoryId !== null &&
        projectId !== null && (
          <MigrationPreview
            fieldKey={typeChangeRequest.fieldKey}
            fieldLabel={typeChangeRequest.fieldLabel}
            oldType={typeChangeRequest.oldType}
            newType={typeChangeRequest.newType}
            directoryId={directoryId}
            projectId={projectId}
            groupId={typeChangeRequest.groupId}
            onCancel={() => setTypeChangeRequest(null)}
            onApplied={() => setTypeChangeRequest(null)}
          />
        )}

      {/* Options removal migration preview */}
      {optionsRemovalRequest !== null &&
        directoryId !== null &&
        projectId !== null && (
          <OptionsRemovalPreview
            fieldKey={optionsRemovalRequest.fieldKey}
            fieldLabel={optionsRemovalRequest.fieldLabel}
            fieldType={optionsRemovalRequest.fieldType}
            orphanedOptions={optionsRemovalRequest.orphanedOptions}
            newOptions={optionsRemovalRequest.newOptions}
            directoryId={directoryId}
            projectId={projectId}
            groupId={optionsRemovalRequest.groupId}
            onCancel={() => setOptionsRemovalRequest(null)}
            onApplied={() => setOptionsRemovalRequest(null)}
          />
        )}

      {/* Field remove dialog — Deprecate or Clear */}
      <DeprecateOrClearDialog
        isOpen={fieldRemoveTarget !== null}
        fieldLabel={fieldRemoveTarget?.label ?? ""}
        onDeprecate={handleFieldDeprecate}
        onClear={handleFieldClear}
        onCancel={() => setFieldRemoveTarget(null)}
      />

      {/* Group deletion confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={`Delete group "${deleteTarget?.label}"?`}
        description="All fields in this group will be removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteTarget}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Key rename confirmation */}
      <ConfirmDialog
        isOpen={keyRenameConfirm !== null}
        title={`Rename key "${keyRenameConfirm?.oldKey}" to "${keyRenameConfirm?.newKey}"?`}
        description={`All sidecar values stored under "${keyRenameConfirm?.oldKey}" will be migrated to "${keyRenameConfirm?.newKey}" project-wide. Any values that cannot be migrated will become orphaned.`}
        confirmLabel="Rename"
        cancelLabel="Cancel"
        onConfirm={confirmKeyRename}
        onCancel={() => setKeyRenameConfirm(null)}
      />
    </>
  );
}
