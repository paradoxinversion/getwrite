// Last Updated: 2026-08-03

/**
 * @module store/cryptoSlice
 *
 * UI-facing lock state for the workspace: absent, locked, or unlocked.
 *
 * **No key material is in here, and none ever should be.** `CryptoKey` handles
 * are not serialisable, and anything in the store is visible to devtools, to
 * state snapshots, and to any persistence middleware added later. The unlocked
 * keyring lives in `lib/models/crypto/keyring-session.ts`, which is a plain
 * module for exactly that reason; this slice mirrors only what a component needs
 * in order to render.
 *
 * The thunks go through `lib/api/encryption.ts` rather than calling the session
 * module directly: on web and desktop the keyring is server-side, because the
 * model layer needs `node:fs`. Only lock state crosses back.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  enableProjectEncryptionRequest,
  exportPlaintextCopyRequest,
  fetchEncryptionStatus,
  lockWorkspaceRequest,
  resumeConversionsRequest,
  unlockWorkspaceRequest,
  type EncryptionStatus,
} from "../lib/api/encryption";

/**
 * Whether the workspace has encryption set up, and whether it is open.
 *
 * - `unknown` — not yet checked this session.
 * - `unavailable` — this deployment cannot offer encryption at all (FR23).
 * - `absent` — no keyring; the user has never enabled encryption (FR4: never
 *   prompt in this state).
 * - `locked` — a keyring exists and the passphrase has not been supplied.
 * - `unlocked` — project keys are available for this session.
 */
type WorkspaceLockStatus =
  | "unknown"
  | "unavailable"
  | "absent"
  | "locked"
  | "unlocked";

interface CryptoState {
  status: WorkspaceLockStatus;
  /** Ids of projects that have a data key — knowable while still locked. */
  encryptedProjectIds: string[];
  /** Whether an unlock attempt is in flight. */
  isUnlocking: boolean;
  /** Whether a project conversion is in flight. */
  isConverting: boolean;
  /** Whether a plaintext export is in flight. */
  isExporting: boolean;
  /** User-facing failure text; never contains key material. */
  errorMessage: string;
}

const initialState: CryptoState = {
  status: "unknown",
  encryptedProjectIds: [],
  isUnlocking: false,
  isConverting: false,
  isExporting: false,
  errorMessage: "",
};

/**
 * Extracts a user-facing message from a thrown value.
 *
 * @param error - The thrown value.
 * @param fallback - Message to use when nothing better is available.
 * @returns A message safe to display.
 */
function getErrorMessage(error: unknown, fallback: string): string {
  // Redux Toolkit hands reducers a *serialised* error, not an `Error` instance,
  // so an `instanceof` check here would discard every message the server sent
  // and always show the generic fallback.
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0)
      return message;
  }
  return fallback;
}

/** Determines whether this workspace has a keyring, and which projects use it. */
export const checkWorkspaceLock = createAsyncThunk(
  "crypto/checkWorkspaceLock",
  fetchEncryptionStatus,
);

/** Opens the workspace for this session. */
export const unlockWorkspace = createAsyncThunk(
  "crypto/unlockWorkspace",
  (passphrase: string) => unlockWorkspaceRequest(passphrase),
);

/** Discards every key held for this session. */
export const lockWorkspace = createAsyncThunk(
  "crypto/lockWorkspace",
  lockWorkspaceRequest,
);

/** Encrypts a project, creating the workspace keyring on the first one. */
export const encryptProject = createAsyncThunk(
  "crypto/encryptProject",
  (args: {
    projectId: string;
    projectName: string;
    passphrase: string | null;
  }) =>
    enableProjectEncryptionRequest(
      args.projectId,
      args.projectName,
      args.passphrase,
    ),
);

/** Writes an unencrypted copy of a project, as its own project (FR24). */
export const exportPlaintextCopy = createAsyncThunk(
  "crypto/exportPlaintextCopy",
  (projectId: string) => exportPlaintextCopyRequest(projectId),
);

/** Finishes any conversion a crash left half-done. */
export const resumeConversions = createAsyncThunk(
  "crypto/resumeConversions",
  resumeConversionsRequest,
);

/**
 * Folds a server status payload into slice state.
 *
 * @param state - The slice state to update.
 * @param status - The status the server reported.
 */
function applyStatus(state: CryptoState, status: EncryptionStatus): void {
  state.encryptedProjectIds = status.encryptedProjectIds;
  state.status = !status.isAvailable
    ? "unavailable"
    : !status.hasKeyring
      ? "absent"
      : status.isUnlocked
        ? "unlocked"
        : "locked";
}

const cryptoSlice = createSlice({
  name: "crypto",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkWorkspaceLock.fulfilled, (state, action) => {
        applyStatus(state, action.payload);
      })
      .addCase(lockWorkspace.fulfilled, (state, action) => {
        applyStatus(state, action.payload);
      })
      .addCase(resumeConversions.fulfilled, (state, action) => {
        applyStatus(state, action.payload);
      })
      .addCase(exportPlaintextCopy.pending, (state) => {
        state.isExporting = true;
        state.errorMessage = "";
      })
      .addCase(exportPlaintextCopy.fulfilled, (state, action) => {
        state.isExporting = false;
        applyStatus(state, action.payload);
      })
      .addCase(exportPlaintextCopy.rejected, (state, action) => {
        state.isExporting = false;
        state.errorMessage = getErrorMessage(
          action.error,
          "Could not export an unencrypted copy.",
        );
      })
      .addCase(encryptProject.pending, (state) => {
        state.isConverting = true;
        state.errorMessage = "";
      })
      .addCase(encryptProject.fulfilled, (state, action) => {
        state.isConverting = false;
        applyStatus(state, action.payload);
      })
      .addCase(encryptProject.rejected, (state, action) => {
        state.isConverting = false;
        state.errorMessage = getErrorMessage(
          action.error,
          "Could not encrypt this project.",
        );
      })
      .addCase(unlockWorkspace.pending, (state) => {
        state.isUnlocking = true;
        state.errorMessage = "";
      })
      .addCase(unlockWorkspace.fulfilled, (state, action) => {
        state.isUnlocking = false;
        applyStatus(state, action.payload);
      })
      .addCase(unlockWorkspace.rejected, (state, action) => {
        state.isUnlocking = false;
        state.status = "locked";
        state.errorMessage = getErrorMessage(
          action.error,
          "Could not unlock this workspace.",
        );
      });
  },
});

export default cryptoSlice.reducer;
