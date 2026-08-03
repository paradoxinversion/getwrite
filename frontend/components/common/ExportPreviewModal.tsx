import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

/** Output formats offered by the single-resource export flow. */
export type ExportFormat = "txt" | "md";

export interface ExportPreviewModalProps {
  isOpen: boolean;
  resourceTitle?: string;
  /** Pre-resolved display names of the resources that will be exported. */
  resourceNames?: string[];
  onClose?: () => void;
  onConfirmExport?: (format: ExportFormat) => void;
  onShowCompile?: () => void;
  /**
   * Whether the source project is encrypted.
   *
   * When it is, this output leaves the project's protection behind: the file
   * written is plaintext, wherever it lands (FR27). The user is told before it
   * happens, not after.
   */
  isSourceEncrypted?: boolean;
}

/** Lead summary line for the export dialog (kept newline-free for HTML). */
function buildDescription(names: string[]): string {
  if (names.length === 0) {
    return "No resources selected for export.";
  }
  const label = names.length === 1 ? "resource" : "resources";
  return `Exporting ${names.length} ${label}:`;
}

export default function ExportPreviewModal({
  isOpen,
  resourceTitle,
  resourceNames,
  onClose,
  onConfirmExport,
  onShowCompile,
  isSourceEncrypted = false,
}: ExportPreviewModalProps): JSX.Element | null {
  const [format, setFormat] = useState<ExportFormat>("txt");

  if (!isOpen) return null;

  const names = resourceNames ?? [];

  // The resource list and the format picker render in the dialog's details
  // slot as real markup. (A newline-joined string in `description` collapses to
  // a single run-on line because the dialog body has no `white-space` styling.)
  const details = (
    <div className="space-y-3 text-sm text-gw-secondary">
      {isSourceEncrypted ? (
        <p className="text-gw-primary">
          This project is encrypted. The file this produces will not be — it is
          readable by anyone who can open it.
        </p>
      ) : null}
      {names.length > 0 ? (
        <ul
          className="list-disc space-y-1 pl-5"
          aria-label="Resources to export"
        >
          {names.map((name, index) => (
            <li key={`${name}-${index}`}>{name}</li>
          ))}
        </ul>
      ) : null}
      <label className="flex items-center gap-2">
        <span>Format</span>
        <select
          className="rounded border border-gw-chrome2 bg-transparent px-2 py-1"
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
          aria-label="Export format"
        >
          <option value="txt">Plain text (.txt)</option>
          <option value="md">Markdown (.md)</option>
        </select>
      </label>
    </div>
  );

  return (
    <>
      <ConfirmDialog
        isOpen={isOpen}
        title={resourceTitle ? `Export ${resourceTitle}` : "Export"}
        description={buildDescription(names)}
        details={details}
        confirmLabel="Export"
        cancelLabel="Cancel"
        onConfirm={() => {
          onConfirmExport?.(format);
          onClose?.();
        }}
        onCancel={onClose ?? (() => {})}
      />

      {onShowCompile ? (
        <div className="fixed bottom-6 right-6 z-[60]">
          <button
            type="button"
            className="px-3 py-2 rounded-md border border-gw-primary text-gw-primary bg-transparent hover:bg-gw-chrome2 transition-colors duration-150"
            onClick={() => onShowCompile()}
          >
            View compiled
          </button>
        </div>
      ) : null}
    </>
  );
}
