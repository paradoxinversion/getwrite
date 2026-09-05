"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageCheck } from "lucide-react";
import type { AnyResource } from "../../src/lib/models/types";
import CompileResourceTree from "./CompileResourceTree";
import EntityCompileResourceList, {
  type EntityCompileEntry,
} from "./EntityCompileResourceList";
import {
  buildCompileTree,
  initAllChecked,
  getDescendantLeafIds,
  ROOT_ITEM_ID,
} from "./compileSelection";
import Button from "./UI/Button/Button";
import { Dialog, DialogContent, DialogTitle } from "./UI/Dialog";
import Checkbox from "./UI/Checkbox/Checkbox";
import Select from "./UI/Select/Select";

export type { EntityCompileEntry };

/**
 * Prop-driven entity mode (FR-1/FR-3/FR-11). When present, this modal swaps
 * its user-editable checkbox tree and Select All/None controls for the
 * read-only, pre-ordered `EntityCompileResourceList`, and the Compile
 * button's confirmed id list becomes `orderedResourceIds` directly rather
 * than a tree/checkbox derivation. The output-option controls (format,
 * headers, name) and the `onConfirmCompile` contract are unchanged.
 */
export interface EntityCompileMode {
  entries: EntityCompileEntry[];
  orderedResourceIds: string[];
}

export type CompileFormat = "txt" | "md" | "pdf" | "docx";

export interface CompileOptions {
  includeHeaders: boolean;
  format: CompileFormat;
  compilationName: string;
}

export interface CompilePreviewModalProps {
  isOpen: boolean;
  projectId?: string;
  resources?: AnyResource[];
  preview?: string;
  onClose?: () => void;
  /** Called with tree-ordered selected resource ids and compile options. */
  onConfirmCompile?: (selectedIds: string[], options: CompileOptions) => void;
  /**
   * Whether the source project is encrypted.
   *
   * When it is, this output leaves the project's protection behind: the file
   * written is plaintext, wherever it lands (FR27). The user is told before it
   * happens, not after.
   */
  isSourceEncrypted?: boolean;
  /**
   * When set, swaps the checkbox tree / Select All / Select None controls
   * for the read-only, pre-ordered entity-scoped list (FR-1/FR-3/FR-11).
   * See `EntityCompileMode`.
   */
  entityMode?: EntityCompileMode;
}

export default function CompilePreviewModal(
  props: CompilePreviewModalProps & {
    resource?: AnyResource;
    onConfirm?: () => void;
  },
): JSX.Element {
  const {
    isOpen,
    resources = [],
    onClose,
    onConfirmCompile,
    resource,
    onConfirm,
    entityMode,
  } = props;

  const tree = useMemo(() => buildCompileTree(resources), [resources]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() =>
    initAllChecked(tree),
  );
  const [shouldIncludeHeaders, setShouldIncludeHeaders] = useState(true);
  const [format, setFormat] = useState<CompileFormat>("txt");
  const [compilationName, setCompilationName] = useState("");

  // Reset selection when modal opens or resource list changes.
  useEffect(() => {
    if (isOpen) {
      const t = buildCompileTree(resources);
      setCheckedIds(initAllChecked(t));
      setFormat("txt");
      setCompilationName("");
    }
  }, [isOpen, resources]);

  // Legacy: if a single `resource` prop is passed, pre-select only that resource.
  useEffect(() => {
    if (isOpen && resource) {
      setCheckedIds(new Set([resource.id]));
    }
  }, [isOpen, resource]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <DialogContent
        maxWidth="max-w-[560px]"
        className="p-6"
        data-testid="compile-preview-modal"
        aria-describedby={undefined}
      >
        <DialogTitle asChild>
          <h3 className="compile-modal-title">
            {entityMode ? "Compile Entity Resources" : "Compile Project"}
          </h3>
        </DialogTitle>
        <p className="compile-modal-description">
          {entityMode
            ? // The entity-mode list is read-only (FR-11), so the whole-project
              // copy inviting a selection describes a control that isn't there.
              "Every resource associated with this entity, in resource-tree order."
            : "Select which resources to include in the compiled output."}
        </p>

        {props.isSourceEncrypted ? (
          <p className="mt-2 text-[12px] leading-relaxed text-gw-primary">
            This project is encrypted. The compiled file will not be — it is
            readable by anyone who can open it.
          </p>
        ) : null}

        {entityMode ? (
          <EntityCompileResourceList entries={entityMode.entries} />
        ) : (
          <>
            <div className="flex gap-2 mb-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setCheckedIds(initAllChecked(tree))}
              >
                Select All
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setCheckedIds(new Set())}
              >
                Select None
              </Button>
            </div>

            <CompileResourceTree
              resources={resources}
              checkedIds={checkedIds}
              onChange={setCheckedIds}
            />

            <div className="compile-modal-meta-text mt-2 text-right">
              {checkedIds.size} resource(s) selected
            </div>
          </>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Checkbox
            id="compile-include-headers"
            checked={shouldIncludeHeaders}
            onChange={(e) => setShouldIncludeHeaders(e.target.checked)}
            aria-label="Include section headers"
          />
          <label
            htmlFor="compile-include-headers"
            className="compile-modal-meta-text cursor-pointer select-none"
          >
            Include section headers
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="compile-as" className="compile-modal-label mb-0">
            Compile as
          </label>
          <Select
            id="compile-as"
            value={format}
            onChange={(e) => setFormat(e.target.value as CompileFormat)}
            className="w-auto"
          >
            <option value="txt">txt</option>
            <option value="md">md</option>
            <option value="pdf">pdf</option>
            <option value="docx">docx</option>
          </Select>
        </div>

        <div className="mt-3">
          <input
            id="compile-name"
            type="text"
            value={compilationName}
            onChange={(e) => setCompilationName(e.target.value)}
            placeholder="Enter a name for your compiled output..."
            className="compile-modal-textarea"
            style={{ height: "auto", padding: "8px 12px" }}
          />
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="default"
            onClick={() => {
              const orderedIds = entityMode
                ? entityMode.orderedResourceIds
                : getDescendantLeafIds(ROOT_ITEM_ID, tree).filter((id) =>
                    checkedIds.has(id),
                  );
              onConfirmCompile?.(orderedIds, {
                includeHeaders: shouldIncludeHeaders,
                format,
                compilationName,
              });
              onConfirm?.();
              onClose?.();
            }}
            disabled={
              entityMode
                ? entityMode.orderedResourceIds.length === 0
                : checkedIds.size === 0
            }
          >
            <PackageCheck size={14} aria-hidden="true" />
            Compile (
            {entityMode
              ? entityMode.orderedResourceIds.length
              : checkedIds.size}
            )
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
