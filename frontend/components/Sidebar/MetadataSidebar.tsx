"use client";

import React from "react";
import AddFieldForm from "./AddFieldForm";
import SynopsisInput from "./controls/SynopsisInput";
import NotesInput from "./controls/NotesInput";
import Input from "../common/UI/Input/Input";
import StatusSelector from "./controls/StatusSelector";
import POVAutocomplete from "./controls/POVAutocomplete";
import DateTimeInput from "./controls/DateTimeInput";
import DurationInput from "./controls/DurationInput";
import EndDateInput from "./controls/EndDateInput";
import NumberInput from "./controls/NumberInput";
import BooleanToggle from "./controls/BooleanToggle";
import SelectInput from "./controls/SelectInput";
import ResourceRefInput, {
  type ResourceOption,
} from "./controls/ResourceRefInput";
import MultiResourceRefInput from "./controls/MultiResourceRefInput";
import { filterResourceOptionsByScope } from "./folderScope";
import LabeledField from "./controls/LabeledField";
import useSyncedControlledValue from "./controls/useSyncedControlledValue";
import TagsSection from "./TagsSection";
import EntitySection from "./EntitySection";
import EntitiesMentionedSection from "./EntitiesMentionedSection";
import EntityMentionsSection from "./EntityMentionsSection";
import CollapsibleSection from "../common/UI/CollapsibleSection/CollapsibleSection";
import useAppSelector from "../../src/store/hooks";
import { shallowEqual } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";
import { selectResource } from "../../src/store/resourcesSlice";
import {
  selectActiveProjectStatuses,
  selectActiveProjectMetadataSchema,
  selectSelectedProjectId,
  selectSynopsisEnabled,
  selectNotesEnabled,
  selectPovEnabled,
  selectEntitiesEnabled,
  selectTimelineEnabled,
} from "../../src/store/projectsSlice";
import type { RootState } from "../../src/store/store";
import type {
  Folder,
  ImageResource,
  AudioResource,
  MetadataField,
  MetadataValue,
  ResourceRef,
} from "../../src/lib/models/types";

const EMPTY_REF_OPTIONS: ResourceOption[] = [];

function formatAudioDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function ReadOnlyField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}): JSX.Element {
  return (
    <LabeledField label={label} className={className}>
      <p className="mt-1 text-sm font-mono text-gw-primary">{value}</p>
    </LabeledField>
  );
}

function ImageMetadataSection({
  resource,
}: {
  resource: ImageResource;
}): JSX.Element {
  const hasDimensions =
    resource.width !== undefined || resource.height !== undefined;
  const exifEntries = resource.exif ? Object.entries(resource.exif) : [];
  const hasContent = hasDimensions || exifEntries.length > 0;

  return (
    <CollapsibleSection title="Image" variant="sidebar">
      {hasDimensions && (
        <ReadOnlyField
          label="Dimensions"
          value={`${resource.width ?? "?"} × ${resource.height ?? "?"} px`}
          className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
        />
      )}
      {exifEntries.map(([key, value]) => (
        <ReadOnlyField
          key={key}
          label={key}
          value={
            Array.isArray(value) || typeof value === "object"
              ? JSON.stringify(value)
              : String(value)
          }
          className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
        />
      ))}
      {!hasContent && (
        <p className="mt-1 text-sm text-gw-secondary">No metadata available.</p>
      )}
    </CollapsibleSection>
  );
}

function AudioMetadataSection({
  resource,
}: {
  resource: AudioResource;
}): JSX.Element {
  const hasContent =
    resource.format !== undefined || resource.durationSeconds !== undefined;

  return (
    <CollapsibleSection title="Audio" variant="sidebar">
      {resource.format !== undefined && (
        <ReadOnlyField
          label="Format"
          value={resource.format.toUpperCase()}
          className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
        />
      )}
      {resource.durationSeconds !== undefined && (
        <ReadOnlyField
          label="Duration"
          value={formatAudioDuration(resource.durationSeconds)}
          className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
        />
      )}
      {!hasContent && (
        <p className="mt-1 text-sm text-gw-secondary">No metadata available.</p>
      )}
    </CollapsibleSection>
  );
}

/**
 * Validates raw sidecar JSON as a ResourceRef array at the system boundary.
 * Filters out any element missing a string `name` — old or malformed sidecar
 * data can produce such elements, and components assume `name` is always defined.
 */
function toResourceRefArray(raw: unknown): ResourceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is ResourceRef =>
      r !== null &&
      typeof r === "object" &&
      typeof (r as { name?: unknown }).name === "string",
  );
}

type RawResource = { id: string; name: string; folderId?: string | null };
const EMPTY_RAW_RESOURCES: RawResource[] = [];
const EMPTY_FOLDERS: Folder[] = [];

const selectAllResourceOptions = createSelector(
  (state: RootState) =>
    state.resources.resources as { id: string; name: string }[],
  (resources): ResourceOption[] => {
    if (!resources?.length) return EMPTY_REF_OPTIONS;
    return resources.reduce((acc: ResourceOption[], r) => {
      if (r.name) acc.push({ id: r.id, name: r.name });
      return acc;
    }, []);
  },
);

const selectRawResourcesList = (state: RootState): RawResource[] =>
  (state.resources.resources as RawResource[]) ?? EMPTY_RAW_RESOURCES;

const selectFoldersList = (state: RootState): Folder[] =>
  (state.resources.folders as Folder[]) ?? EMPTY_FOLDERS;

export interface MetadataSidebarProps {
  onChangeField?: (key: string, value: MetadataValue) => void;
  className?: string;
}

function GenericTextInput({
  label,
  ariaLabel,
  value,
  onChange,
  className = "",
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}): JSX.Element {
  const [text, setText] = useSyncedControlledValue(value, onChange);
  return (
    <LabeledField label={label} className={className}>
      <Input
        type="text"
        aria-label={ariaLabel}
        className="w-full mt-2"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </LabeledField>
  );
}

export default function MetadataSidebar({
  onChangeField,
  className = "",
}: MetadataSidebarProps): JSX.Element {
  const schema = useAppSelector(selectActiveProjectMetadataSchema);
  const selectedProjectId = useAppSelector(selectSelectedProjectId);
  const isSynopsisEnabled = useAppSelector(selectSynopsisEnabled);
  const isNotesEnabled = useAppSelector(selectNotesEnabled);
  const isPovEnabled = useAppSelector(selectPovEnabled);
  const isEntitiesEnabled = useAppSelector(selectEntitiesEnabled);
  const isTimelineEnabled = useAppSelector(selectTimelineEnabled);

  const selectedResource = useAppSelector((state) =>
    selectResource(state.resources),
  );

  const projectStatuses = useAppSelector(
    (state) => selectActiveProjectStatuses(state),
    shallowEqual,
  );

  const [pendingFocusKey, setPendingFocusKey] = React.useState<string | null>(
    null,
  );
  const [isAddFormVisible, setIsAddFormVisible] = React.useState(false);
  const sidebarRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!pendingFocusKey || !sidebarRef.current) return;
    const input = sidebarRef.current.querySelector<HTMLInputElement>(
      `input[aria-label="${pendingFocusKey}"]`,
    );
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "nearest" });
      input.focus();
      setPendingFocusKey(null);
    }
  }, [schema, pendingFocusKey]);

  function handleAddFormDismissed(fieldKey: string): void {
    setIsAddFormVisible(false);
    setPendingFocusKey(fieldKey);
  }

  const allResourceOptions = useAppSelector(
    selectAllResourceOptions,
    shallowEqual,
  );
  const rawResources = useAppSelector(selectRawResourcesList, shallowEqual);
  const folders = useAppSelector(selectFoldersList, shallowEqual);

  const storyDate = selectedResource?.userMetadata?.storyDate as
    | string
    | undefined;
  const storyDuration = selectedResource?.userMetadata?.storyDuration as
    | number
    | null
    | undefined;

  const computedEndDate = React.useMemo(() => {
    if (!storyDate || storyDuration == null) return undefined;
    return new Date(
      Date.parse(storyDate) + storyDuration * 60000,
    ).toISOString();
  }, [storyDate, storyDuration]);

  /**
   * Whether a field's sidebar control should render. Built-in fields governed by
   * a project feature toggle are hidden when their feature is disabled; the
   * schema entry and any stored sidecar value are left untouched, so toggling the
   * feature back on restores the control with its prior value. Non-gated fields
   * (custom fields and the always-on `status`) always render.
   */
  const isFieldVisible = (field: MetadataField): boolean => {
    switch (field.key) {
      case "synopsis":
        return isSynopsisEnabled;
      case "notes":
        return isNotesEnabled;
      case "pov":
        return isPovEnabled;
      case "storyDate":
      case "storyDuration":
      case "storyEndDate":
        return isTimelineEnabled;
      default:
        return true;
    }
  };

  const renderField = (field: MetadataField): JSX.Element | null => {
    const rawValue = selectedResource?.userMetadata?.[field.key];
    const { key, label, type, options, multiple: isMultiple } = field;

    // Built-in locked fields use their specialized controls
    switch (key) {
      case "synopsis":
        return (
          <SynopsisInput
            ariaLabel="synopsis"
            value={(rawValue as string) ?? ""}
            className="text-brand-mid text-gw-nano tracking-label uppercase mb-4"
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "notes":
        return (
          <NotesInput
            ariaLabel="notes"
            value={(rawValue as string) ?? ""}
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "status":
        return (
          <StatusSelector
            ariaLabel="status"
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            value={(rawValue as string) ?? ""}
            options={projectStatuses.length > 0 ? projectStatuses : undefined}
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "pov":
        return (
          <POVAutocomplete
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            resourceOptions={allResourceOptions}
            value={(rawValue as string | ResourceRef) ?? undefined}
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "storyDate":
        return (
          <DateTimeInput
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            value={(rawValue as string) ?? ""}
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "storyDuration":
        return (
          <DurationInput
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            value={(rawValue as number | null) ?? null}
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "storyEndDate":
        return (
          <EndDateInput
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            computedEndDate={computedEndDate}
            overrideValue={(rawValue as string) ?? undefined}
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
    }

    // Generic controls by field type
    switch (type) {
      case "text":
        return (
          <GenericTextInput
            label={label}
            ariaLabel={key}
            value={(rawValue as string) ?? ""}
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "number":
        return (
          <NumberInput
            label={label}
            ariaLabel={key}
            value={(rawValue as number) ?? undefined}
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "date":
        return (
          <DateTimeInput
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            value={(rawValue as string) ?? ""}
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "boolean":
        return (
          <BooleanToggle
            label={label}
            ariaLabel={key}
            value={(rawValue as boolean) ?? false}
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "select":
        return (
          <SelectInput
            label={label}
            ariaLabel={key}
            options={options ?? []}
            value={(rawValue as string) ?? ""}
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "multiselect":
        return (
          <SelectInput
            label={label}
            ariaLabel={key}
            options={options ?? []}
            value={(rawValue as string[]) ?? []}
            multiple
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "resource-ref":
        return (
          <ResourceRefInput
            label={label}
            ariaLabel={key}
            value={(rawValue as ResourceRef | ResourceRef[] | null) ?? null}
            resourceOptions={allResourceOptions}
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            multiple={isMultiple}
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      case "multi-resource-ref":
        return (
          <MultiResourceRefInput
            label={label}
            resourceOptions={filterResourceOptionsByScope(
              rawResources,
              folders,
              field.refFolder,
              field.includeSubfolders,
            )}
            value={toResourceRefArray(rawValue)}
            maxSelections={field.maxSelections}
            className="text-brand-mid text-gw-label tracking-label uppercase mb-4"
            onChange={(v) => onChangeField?.(key, v)}
          />
        );
      default:
        return null;
    }
  };

  // Text, image, and audio resources all support custom (schema-driven)
  // metadata. Folders and the empty selection show a placeholder instead.
  const editableResource =
    selectedResource &&
    (selectedResource.type === "text" ||
      selectedResource.type === "image" ||
      selectedResource.type === "audio")
      ? selectedResource
      : null;

  return (
    <aside
      ref={sidebarRef}
      className={`metadata-sidebar-root flex flex-col h-full overflow-hidden ${className}`}
      aria-label="metadata-sidebar"
    >
      {editableResource ? (
        <>
          <div className="shrink-0 mb-4">
            <h3 className="text-gw-secondary-light pl-4 text-gw-label tracking-label uppercase">
              {editableResource.name}
            </h3>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4">
            {editableResource.type === "image" && (
              <ImageMetadataSection resource={editableResource} />
            )}
            {editableResource.type === "audio" && (
              <AudioMetadataSection resource={editableResource} />
            )}
            {schema.groups.map((group) => {
              if (
                group.folderId &&
                editableResource.folderId !== group.folderId
              ) {
                return null;
              }
              const visibleFields = group.fields.filter(isFieldVisible);
              if (visibleFields.length === 0) {
                return null;
              }
              return (
                <CollapsibleSection
                  key={group.id}
                  title={group.label}
                  variant="sidebar"
                >
                  {visibleFields.map((field) => (
                    <React.Fragment key={field.key}>
                      {renderField(field)}
                    </React.Fragment>
                  ))}
                </CollapsibleSection>
              );
            })}
            <CollapsibleSection title="Tags" variant="sidebar">
              <TagsSection />
            </CollapsibleSection>
            {isEntitiesEnabled && (
              <>
                <CollapsibleSection title="Entity" variant="sidebar">
                  <EntitySection />
                </CollapsibleSection>
                <CollapsibleSection
                  title="Entities Mentioned"
                  variant="sidebar"
                >
                  <EntitiesMentionedSection />
                </CollapsibleSection>
                <CollapsibleSection title="Entity Mentions" variant="sidebar">
                  <EntityMentionsSection />
                </CollapsibleSection>
              </>
            )}
          </div>
          <div className="shrink-0 mt-2">
            {isAddFormVisible && selectedProjectId ? (
              <AddFieldForm
                schema={schema}
                selectedProjectId={selectedProjectId}
                currentFolderId={editableResource.folderId}
                onCancel={() => setIsAddFormVisible(false)}
                onFieldFocused={handleAddFormDismissed}
                onCreated={handleAddFormDismissed}
              />
            ) : (
              <div className="py-3 pl-4 border-t border-gw-border">
                <button
                  type="button"
                  onClick={() => setIsAddFormVisible(true)}
                  disabled={!selectedProjectId || schema.groups.length === 0}
                  className="flex w-full items-center gap-1.5 py-1 text-gw-label font-mono uppercase tracking-label text-gw-secondary hover:text-gw-primary transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="add-metadata-field"
                >
                  + Add field
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="px-4">
          <h4 className="text-gw-secondary text-gw-label tracking-label mt-4">
            Select a resource to view its metadata.
          </h4>
        </div>
      )}
    </aside>
  );
}
