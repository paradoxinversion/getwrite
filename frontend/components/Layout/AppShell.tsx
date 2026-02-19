"use client";
import React, { useState, useRef, useEffect } from "react";
import type { Resource, ViewName } from "../../lib/types";
import ResourceTree from "../Tree/ResourceTree";
import ViewSwitcher from "../WorkArea/ViewSwitcher";
import EditView from "../WorkArea/EditView";
import DiffView from "../WorkArea/DiffView";
import OrganizerView from "../WorkArea/OrganizerView";
import DataView from "../WorkArea/DataView";
import TimelineView from "../WorkArea/TimelineView";

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
}: {
    children?: React.ReactNode;
    showSidebars?: boolean;
    resources?: Resource[];
    onResourceSelect?: (id: string) => void;
    selectedResourceId?: string | null;
}) {
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
    return (
        <div className="min-h-screen flex bg-slate-50 text-slate-900">
            {showSidebars ? (
                <aside
                    className="hidden sm:block bg-white border-r p-4"
                    style={{ width: leftWidth }}
                >
                    <div className="text-sm font-medium text-slate-700 mb-4">
                        Contents
                    </div>
                    <div className="mt-2">
                        {resources ? (
                            <ResourceTree
                                resources={resources}
                                selectedId={selectedResourceId ?? undefined}
                                onSelect={onResourceSelect}
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
                        <div className="text-sm font-medium text-slate-700 mb-4">
                            Metadata
                        </div>
                        <div className="text-sm text-slate-600">
                            Select a resource to view metadata.
                        </div>
                    </aside>
                </>
            ) : null}
        </div>
    );
}
