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
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  createWorkspaceKeyring,
  encryptedProjectIds,
  isSessionUnlocked,
  lockSession,
  unlockSession,
  workspaceHasKeyring,
} from "../lib/models/crypto/keyring-session";

/**
 * Whether the workspace has encryption set up, and whether it is open.
 *
 * - `unknown` — not yet checked this session.
 * - `absent` — no keyring; the user has never enabled encryption (FR4: never
 *   prompt in this state).
 * - `locked` — a keyring exists and the passphrase has not been supplied.
 * - `unlocked` — project keys are available for this session.
 */
type WorkspaceLockStatus = "unknown" | "absent" | "locked" | "unlocked";

interface CryptoState {
  status: WorkspaceLockStatus;
  /** Ids of projects that have a data key — knowable while still locked. */
  encryptedProjectIds: string[];
  /** Whether an unlock attempt is in flight. */
  isUnlocking: boolean;
  /** User-facing failure text; never contains key material. */
  errorMessage: string;
}

const initialState: CryptoState = {
  status: "unknown",
  encryptedProjectIds: [],
  isUnlocking: false,
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
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

/** Determines whether this workspace has a keyring, and which projects use it. */
export const checkWorkspaceLock = createAsyncThunk(
  "crypto/checkWorkspaceLock",
  async () => ({
    hasKeyring: await workspaceHasKeyring(),
    projectIds: await encryptedProjectIds(),
    isUnlocked: isSessionUnlocked(),
  }),
);

/** Opens the workspace for this session. */
export const unlockWorkspace = createAsyncThunk(
  "crypto/unlockWorkspace",
  async (passphrase: string) => {
    await unlockSession(passphrase);
    return { projectIds: await encryptedProjectIds() };
  },
);

/** Sets up encryption for a workspace that has never had it. */
export const createWorkspaceLock = createAsyncThunk(
  "crypto/createWorkspaceLock",
  async (passphrase: string) => {
    await createWorkspaceKeyring(passphrase);
  },
);

const cryptoSlice = createSlice({
  name: "crypto",
  initialState,
  reducers: {
    /** Discards every key held for this session. */
    workspaceLocked(state) {
      lockSession();
      state.status = state.encryptedProjectIds.length > 0 ? "locked" : "absent";
      state.errorMessage = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkWorkspaceLock.fulfilled, (state, action) => {
        const { hasKeyring, projectIds, isUnlocked } = action.payload;
        state.encryptedProjectIds = projectIds;
        state.status = !hasKeyring
          ? "absent"
          : isUnlocked
            ? "unlocked"
            : "locked";
      })
      .addCase(unlockWorkspace.pending, (state) => {
        state.isUnlocking = true;
        state.errorMessage = "";
      })
      .addCase(unlockWorkspace.fulfilled, (state, action) => {
        state.isUnlocking = false;
        state.status = "unlocked";
        state.encryptedProjectIds = action.payload.projectIds;
      })
      .addCase(unlockWorkspace.rejected, (state, action) => {
        state.isUnlocking = false;
        state.status = "locked";
        state.errorMessage = getErrorMessage(
          action.error,
          "Could not unlock this workspace.",
        );
      })
      .addCase(createWorkspaceLock.fulfilled, (state) => {
        state.status = "unlocked";
      })
      .addCase(createWorkspaceLock.rejected, (state, action) => {
        state.errorMessage = getErrorMessage(
          action.error,
          "Could not set up encryption for this workspace.",
        );
      });
  },
});

export const { workspaceLocked } = cryptoSlice.actions;

export default cryptoSlice.reducer;
