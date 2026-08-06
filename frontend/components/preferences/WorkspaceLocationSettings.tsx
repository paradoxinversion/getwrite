"use client";

import React from "react";
import Button from "../common/UI/Button/Button";
import {
  getDesktopBridge,
  type WorkspaceChangeResult,
} from "../../src/lib/desktop-bridge";

/**
 * Lets a desktop user see and change where GetWrite keeps their projects.
 *
 * Renders nothing at all off the desktop app: the hosted and Android builds
 * have no filesystem for a user to point at, so an inert control there would
 * only raise a question it cannot answer.
 *
 * Changing the location needs a restart. The Next server is given
 * `GETWRITE_PROJECTS_DIR` when it is forked, so the running server stays bound
 * to the old directory — this says so plainly rather than appearing to have
 * switched and then serving the previous workspace.
 */
export default function WorkspaceLocationSettings(): JSX.Element | null {
  const bridge = React.useMemo(() => getDesktopBridge(), []);
  const [currentDir, setCurrentDir] = React.useState<string | null>(null);
  const [pendingDir, setPendingDir] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isChoosing, setIsChoosing] = React.useState(false);

  React.useEffect(() => {
    if (!bridge) return;
    let isActive = true;
    void bridge
      .getWorkspaceDir()
      .then((dir) => {
        if (isActive) setCurrentDir(dir);
      })
      .catch(() => {
        if (isActive) setCurrentDir(null);
      });
    return () => {
      isActive = false;
    };
  }, [bridge]);

  if (!bridge) return null;

  async function handleChoose(): Promise<void> {
    if (!bridge) return;
    setIsChoosing(true);
    setErrorMessage(null);
    try {
      const result: WorkspaceChangeResult = await bridge.chooseWorkspaceDir();
      // Backing out of the picker is not a failure and must not leave an error
      // sitting on screen.
      if (result.cancelled) return;
      if (!result.ok) {
        setErrorMessage(result.message ?? "That folder cannot be used.");
        return;
      }
      setPendingDir(result.projectsDir ?? null);
    } catch {
      setErrorMessage("The folder could not be changed.");
    } finally {
      setIsChoosing(false);
    }
  }

  return (
    <section className="rounded-lg border-[0.5px] border-gw-border bg-gw-chrome p-5">
      <h2 className="text-sm font-semibold text-gw-primary">
        Where your projects are stored
      </h2>
      <p className="mt-1 text-sm text-gw-secondary">
        GetWrite keeps every project as ordinary files and folders in this
        location. You can open it, copy it, or include it in a backup.
      </p>

      <p className="mt-4 break-all font-mono text-[11px] text-gw-primary">
        {currentDir ?? "Locating…"}
      </p>

      <div className="mt-4 flex flex-col items-start gap-2">
        <Button
          variant="secondary"
          onClick={handleChoose}
          disabled={isChoosing}
        >
          {isChoosing ? "Choosing…" : "Change folder…"}
        </Button>
        <p className="text-[11px] leading-relaxed text-gw-dim">
          Choosing a new folder points GetWrite at it. Your existing projects
          are not moved, so move them yourself if you want them to come along.
        </p>
      </div>

      {pendingDir ? (
        <div className="mt-4 border border-gw-border bg-gw-chrome2 p-4">
          <p className="text-[12px] leading-relaxed text-gw-primary">
            GetWrite will use{" "}
            <span className="font-mono break-all">{pendingDir}</span> after a
            restart.
          </p>
          <div className="mt-3">
            <Button variant="outline" onClick={() => void bridge.restart()}>
              Restart now
            </Button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 font-mono text-[10px] text-gw-secondary">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
