"use client";
import React, { useState, useRef, useEffect } from "react";
import type { Resource, ViewName } from "../../lib/types";
import ResourceTree from "../Tree/ResourceTree";
import ConfirmDialog from "../common/ConfirmDialog";
import CreateResourceModal from "../Tree/CreateResourceModal";
import ExportPreviewModal from "../common/ExportPreviewModal";
import CompilePreviewModal from "../common/CompilePreviewModal";
import type { ResourceContextAction } from "../Tree/ResourceContextMenu";
import ViewSwitcher from "../WorkArea/ViewSwitcher";
import EditView from "../WorkArea/EditView";
import DiffView from "../WorkArea/DiffView";
import OrganizerView from "../WorkArea/OrganizerView";
import DataView from "../WorkArea/DataView";
import TimelineView from "../WorkArea/TimelineView";
import MetadataSidebar from "../Sidebar/MetadataSidebar";

/**
 * Simple three-column shell used in the app and Storybook:
 * - Left: Projects/Resource tree placeholder
 * - Center: Work area for views and editor
 * - Right: Metadata sidebar placeholder
 *
 * Designed for visual layout only; integrate `ResourceTree` and `MetadataSidebar` in later tasks.
 */
export default function AppShell({
    children,
    showSidebars = true,
    resources,
    onResourceSelect,
    selectedResourceId,
    onChangeNotes,
    onChangeStatus,
    onChangeCharacters,
    onChangeLocations,
    onChangeItems,
    onChangePOV,
}: {
    children?: React.ReactNode;
    showSidebars?: boolean;
    resources?: Resource[];
    onResourceSelect?: (id: string) => void;
    selectedResourceId?: string | null;
    onChangeNotes?: (text: string, resourceId: string) => void;
    onChangeStatus?: (
        status: "draft" | "in-review" | "published",
        resourceId: string,
    ) => void;
    onChangeCharacters?: (chars: string[], resourceId: string) => void;
    onChangeLocations?: (locs: string[], resourceId: string) => void;
    onChangeItems?: (items: string[], resourceId: string) => void;
    onChangePOV?: (pov: string | null, resourceId: string) => void;
    onResourceAction?: (
        action: ResourceContextAction,
        resourceId?: string,
    ) => void;
}): JSX.Element {
    const [view, setView] = useState<ViewName>("edit");
    const [leftWidth, setLeftWidth] = useState<number>(280);
    const [rightWidth, setRightWidth] = useState<number>(320);

    const draggingRef = useRef<null | {
        side: "left" | "right";
        startX: number;
        startWidth: number;
    }>(null);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            const d = draggingRef.current;
            if (!d) return;
            const deltaX = e.clientX - d.startX;
            const min = 160;
            const max = 800;
            if (d.side === "left") {
                const next = Math.min(
                    max,
                    Math.max(min, d.startWidth + deltaX),
                );
                setLeftWidth(next);
            } else {
                const next = Math.min(
                    max,
                    Math.max(min, d.startWidth - deltaX),
                );
                setRightWidth(next);
            }
            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";
        };

        const onMouseUp = () => {
            draggingRef.current = null;
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
    }, []);
    const selectedResource =
        selectedResourceId && resources
            ? resources.find((r) => r.id === selectedResourceId)
            : undefined;

    const [contextAction, setContextAction] = useState<{
        open: boolean;
        action?: ResourceContextAction;
        resourceId?: string;
        resourceTitle?: string;
    }>({ open: false });

    const handleResourceAction = (
        action: ResourceContextAction,
        resourceId?: string,
        resourceTitle?: string,
    ) => {
        // For destructive actions show a confirmation dialog.
        if (action === "delete") {
            setContextAction({ open: true, action, resourceId, resourceTitle });
            return;
        }

        // For create/copy/duplicate/show modals locally and confirm before forwarding
        if (action === "create") {
            setCreateModal({
                open: true,
                parentId: resourceId,
                initialTitle: "",
            });
            return;
        }

        if (action === "copy" || action === "duplicate") {
            setCreateModal({
                open: true,
                parentId: resourceId,
                initialTitle: `${resourceTitle ?? "Resource"} (copy)`,
            });
            return;
        }

        if (action === "export") {
            setExportModal({
                open: true,
                resourceId,
                resourceTitle,
                preview: "Export preview (placeholder)",
            });
            return;
        }

        // Fallback forward
        onResourceAction?.(action, resourceId);
    };

    const [createModal, setCreateModal] = useState<{
        open: boolean;
        parentId?: string;
        initialTitle?: string;
    }>({ open: false });
    const [exportModal, setExportModal] = useState<{
        open: boolean;
        resourceId?: string;
        resourceTitle?: string;
        preview?: string;
    }>({ open: false });
    const [compileModal, setCompileModal] = useState<{
        open: boolean;
        resourceId?: string;
        preview?: string;
    }>({ open: false });

    const handleCreateConfirmed = (
        payload: {
            title: string;
            type: import("../../lib/types").ResourceType;
        },
        parentId?: string,
    ) => {
        // forward to page-level handler to mutate project resources
        onResourceAction?.("create", parentId);
        setCreateModal({ open: false });
    };

    const handleExportConfirmed = (resourceId?: string) => {
        onResourceAction?.("export", resourceId);
        setExportModal({ open: false });
    };

    return (
        <div className="min-h-screen flex bg-slate-50 text-slate-900">
            {showSidebars ? (
                <aside
                    className="hidden sm:block bg-white border-r p-4"
                    style={{ width: leftWidth }}
                >
                    <div className="mt-0">
                        {resources ? (
                            <ResourceTree
                                resources={resources}
                                selectedId={selectedResourceId ?? undefined}
                                onSelect={onResourceSelect}
                                onResourceAction={handleResourceAction}
                            />
                        ) : (
                            <div className="space-y-2">
                                <div className="px-3 py-2 rounded-md hover:bg-slate-100">
                                    Project A
                                </div>
                                <div className="px-3 py-2 rounded-md hover:bg-slate-100">
                                    Project B
                                </div>
                                <div className="px-3 py-2 rounded-md hover:bg-slate-100">
                                    Project C
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            ) : null}

            <ConfirmDialog
                isOpen={contextAction.open && contextAction.action === "delete"}
                title={
                    contextAction.resourceTitle
                        ? `Delete ${contextAction.resourceTitle}`
                        : "Delete resource"
                }
                description={
                    "This will remove the resource from the project UI (placeholder). Proceed?"
                }
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={() => {
                    if (contextAction.resourceId) {
                        onResourceAction?.("delete", contextAction.resourceId);
                    }
                    setContextAction({ open: false });
                }}
                onCancel={() => setContextAction({ open: false })}
            />

            <CreateResourceModal
                isOpen={createModal.open}
                initialTitle={createModal.initialTitle}
                parentId={createModal.parentId}
                onClose={() => setCreateModal({ open: false })}
                onCreate={(payload, parentId) =>
                    handleCreateConfirmed(payload, parentId)
                }
                parents={resources ?? []}
            />

            <ExportPreviewModal
                isOpen={exportModal.open}
                resourceTitle={exportModal.resourceTitle}
                preview={exportModal.preview}
                onClose={() => setExportModal({ open: false })}
                onConfirmExport={() =>
                    handleExportConfirmed(exportModal.resourceId)
                }
                onShowCompile={() => {
                    // generate a simple compiled preview from resources
                    const r = exportModal.resourceId
                        ? resources?.find(
                              (x) => x.id === exportModal.resourceId,
                          )
                        : undefined;
                    const preview = r
                        ? `Compiled package for ${r.title}\n\n` +
                          JSON.stringify(r, null, 2)
                        : `Compiled project bundle\n\n` +
                          JSON.stringify(resources ?? [], null, 2);
                    setCompileModal({
                        open: true,
                        resourceId: exportModal.resourceId,
                        preview,
                    });
                }}
            />

            <CompilePreviewModal
                isOpen={compileModal.open}
                resource={
                    compileModal.resourceId
                        ? resources?.find(
                              (r) => r.id === compileModal.resourceId,
                          )
                        : undefined
                }
                resources={resources}
                preview={compileModal.preview}
                onClose={() => setCompileModal({ open: false })}
                onConfirm={() => {
                    // forward as export confirm action for now
                    if (compileModal.resourceId)
                        onResourceAction?.("export", compileModal.resourceId);
                    setCompileModal({ open: false });
                }}
            />

            {/* Left resize handle */}
            {showSidebars ? (
                <div
                    className="hidden sm:flex items-stretch"
                    style={{ alignSelf: "stretch" }}
                >
                    <div
                        role="separator"
                        aria-orientation="vertical"
                        onMouseDown={(e) => {
                            draggingRef.current = {
                                side: "left",
                                startX: e.clientX,
                                startWidth: leftWidth,
                            };
                        }}
                        className="w-2 -ml-2 cursor-col-resize hover:bg-slate-200"
                    />
                </div>
            ) : null}

            <main className="flex-1 p-4 md:p-6">
                {resources ? (
                    <div className="w-full mb-4">
                        <ViewSwitcher
                            view={view}
                            onChange={setView}
                            disabledViews={
                                selectedResourceId ? [] : ["edit", "diff"]
                            }
                        />
                    </div>
                ) : null}
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm p-6 min-h-[400px]">
                        {/* If a resource is selected, render the chosen view; otherwise render children (StartPage or prompt) */}
                        {selectedResourceId && resources
                            ? (() => {
                                  const selected = resources.find(
                                      (r) => r.id === selectedResourceId,
                                  );
                                  if (!selected)
                                      return (
                                          <div>
                                              <h2 className="text-2xl font-semibold">
                                                  Work Area
                                              </h2>
                                              <p className="mt-2 text-sm text-slate-600">
                                                  Resource not found.
                                              </p>
                                          </div>
                                      );

                                  switch (view) {
                                      case "edit":
                                          return (
                                              <EditView
                                                  initialContent={
                                                      selected.content
                                                  }
                                              />
                                          );
                                      case "diff":
                                          return (
                                              <DiffView
                                                  leftContent=""
                                                  rightContent={
                                                      selected.content
                                                  }
                                              />
                                          );
                                      case "organizer":
                                          return (
                                              <OrganizerView
                                                  resources={resources}
                                              />
                                          );
                                      case "data":
                                          return (
                                              <DataView resources={resources} />
                                          );
                                      case "timeline":
                                          return (
                                              <TimelineView
                                                  project={undefined}
                                              />
                                          );
                                      default:
                                          return (
                                              <div>
                                                  <h2 className="text-2xl font-semibold">
                                                      Work Area
                                                  </h2>
                                              </div>
                                          );
                                  }
                              })()
                            : (children ?? (
                                  <div>
                                      <h2 className="text-2xl font-semibold">
                                          Work Area
                                      </h2>
                                      <p className="mt-2 text-sm text-slate-600">
                                          Placeholder editor and views go here.
                                      </p>
                                  </div>
                              ))}
                    </div>
                </div>
            </main>

            {showSidebars ? (
                <>
                    {/* Right resize handle */}
                    <div
                        className="hidden lg:flex items-stretch"
                        style={{ alignSelf: "stretch" }}
                    >
                        <div
                            role="separator"
                            aria-orientation="vertical"
                            onMouseDown={(e) => {
                                draggingRef.current = {
                                    side: "right",
                                    startX: e.clientX,
                                    startWidth: rightWidth,
                                };
                            }}
                            className="w-2 -mr-2 cursor-col-resize hover:bg-slate-200"
                        />
                    </div>

                    <aside
                        className="hidden lg:block bg-white border-l p-4"
                        style={{ width: rightWidth }}
                    >
                        <MetadataSidebar
                            resource={selectedResource}
                            onChangeNotes={(text) =>
                                selectedResource &&
                                onChangeNotes?.(text, selectedResource.id)
                            }
                            onChangeStatus={(status) =>
                                selectedResource &&
                                onChangeStatus?.(status, selectedResource.id)
                            }
                            onChangeCharacters={(chars) =>
                                selectedResource &&
                                onChangeCharacters?.(chars, selectedResource.id)
                            }
                            onChangeLocations={(locs) =>
                                selectedResource &&
                                onChangeLocations?.(locs, selectedResource.id)
                            }
                            onChangeItems={(items) =>
                                selectedResource &&
                                onChangeItems?.(items, selectedResource.id)
                            }
                            onChangePOV={(pov) =>
                                selectedResource &&
                                onChangePOV?.(pov, selectedResource.id)
                            }
                        />
                    </aside>
                </>
            ) : null}
        </div>
    );
}
