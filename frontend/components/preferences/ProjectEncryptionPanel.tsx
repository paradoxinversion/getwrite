"use client";

import React from "react";
import useAppSelector, { useAppDispatch } from "../../src/store/hooks";
import {
  selectActiveProjectDirectoryId,
  selectSelectedProjectId,
} from "../../src/store/projectsSlice";
import {
  encryptProject,
  exportPlaintextCopy,
  lockWorkspace,
} from "../../src/store/cryptoSlice";
import EncryptionSettings from "./EncryptionSettings";

/**
 * Connects {@link EncryptionSettings} to the store and the encryption API.
 *
 * Kept separate from the presentational panel so that component stays
 * prop-driven and testable. This is the only place the encryption UI is mounted,
 * which is what makes "encryption is reachable by one explicit action and
 * nothing else" (FR2) checkable by inspection.
 *
 * Renders nothing until lock state is known, when the deployment cannot offer
 * encryption (FR23), or when no project is open — there is nothing to encrypt in
 * any of those cases.
 */
export default function ProjectEncryptionPanel(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const projectId = useAppSelector(selectSelectedProjectId);
  // The on-disk directory basename, which is what the model layer keys on.
  const directoryId = useAppSelector(selectActiveProjectDirectoryId);
  const projectName = useAppSelector((state) =>
    projectId ? (state.projects.projects[projectId]?.name ?? "") : "",
  );

  // Tolerates a store without this slice: the panel is a leaf mounted inside a
  // shared settings surface, and must never break the screen hosting it.
  const lockStatus = useAppSelector(
    (state) => state.crypto?.status ?? "unknown",
  );
  const encryptedProjectIds = useAppSelector(
    (state) => state.crypto?.encryptedProjectIds,
  );
  const isConverting = useAppSelector(
    (state) => state.crypto?.isConverting ?? false,
  );
  const isExporting = useAppSelector(
    (state) => state.crypto?.isExporting ?? false,
  );
  const errorMessage = useAppSelector((state) => state.crypto?.errorMessage);

  // Deliberately does not fetch: the page bootstraps lock state once on mount.
  // A second fetch here would fire on every settings render, and would make this
  // panel a network dependency of every screen that hosts it.
  if (
    lockStatus === "unknown" ||
    lockStatus === "unavailable" ||
    !directoryId
  ) {
    return null;
  }

  return (
    <EncryptionSettings
      projectName={projectName || "this project"}
      isEncrypted={(encryptedProjectIds ?? []).includes(directoryId)}
      // A passphrase is created only for the first encrypted project; after
      // that one workspace passphrase covers them all.
      needsPassphrase={lockStatus === "absent"}
      isBusy={isConverting}
      isExporting={isExporting}
      onExportPlaintextCopy={
        lockStatus === "unlocked"
          ? () => void dispatch(exportPlaintextCopy(directoryId))
          : undefined
      }
      onLockWorkspace={
        lockStatus === "unlocked"
          ? () => void dispatch(lockWorkspace())
          : undefined
      }
      errorMessage={errorMessage}
      onEnableEncryption={(passphrase) => {
        void dispatch(
          encryptProject({
            projectId: directoryId,
            projectName: projectName || directoryId,
            passphrase,
          }),
        );
      }}
    />
  );
}
