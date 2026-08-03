// Last Updated: 2026-08-03

/**
 * @module crypto/keyring
 *
 * Custody of GetWrite's encryption keys: one workspace key derived from the
 * user's passphrase, and one independent data key per encrypted project.
 *
 * ```
 *   passphrase ──Argon2id──▶ workspace key
 *                              ├── wraps ──▶ project A data key ──▶ A's files
 *                              └── wraps ──▶ project B data key ──▶ B's files
 * ```
 *
 * The indirection is deliberate and buys three properties:
 *
 * - **One unlock opens everything** (FR7) — the user types one passphrase, and
 *   every encrypted project in the workspace becomes readable.
 * - **Changing the passphrase is a rewrap, not a migration** (FR8) — only the
 *   wrapped keys are re-sealed; not one byte of project data is rewritten.
 * - **Projects stay cryptographically independent** (FR6) — each data key is
 *   separately random, so one project's key cannot open another's files.
 *
 * Unwrapped keys live only in memory, as non-extractable `CryptoKey` handles, and
 * are dropped on {@link Keyring.lock} (FR7). What persists is
 * {@link WrappedKeyring}: the KDF parameters and salt in plaintext, plus sealed
 * key material. Nothing in that structure is secret.
 *
 * The wrapped keyring is written by `keyring-store.ts` at the *workspace* root,
 * never inside a project — it must be readable before any project can be
 * decrypted, so it can never itself sit behind the encrypting adapter.
 */
import { z } from "zod";
import { EnvelopeIntegrityError, open, seal } from "./envelope";
import {
  DEFAULT_ARGON2_PARAMS,
  type Argon2Params,
  deriveWorkspaceKey,
  generateDataKeyBytes,
  generateSalt,
  importAesKey,
} from "./primitives";

/** Current wrapped-keyring format version. */
const KEYRING_VERSION = 1;

/**
 * Known plaintext sealed under the workspace key so a wrong passphrase can be
 * detected directly, rather than surfacing later as an unopenable project.
 *
 * This does let an attacker with the file test passphrase guesses offline — but
 * so would any wrapped data key, so it concedes nothing. Argon2id's cost is the
 * defense, not the absence of a verifier.
 */
const VERIFIER_PLAINTEXT = "getwrite-keyring-v1";

/** Zod schema for the persisted KDF descriptor. */
const KdfDescriptorSchema = z.object({
  algorithm: z.literal("argon2id"),
  memoryKiB: z.number().int().positive(),
  iterations: z.number().int().positive(),
  parallelism: z.number().int().positive(),
  salt: z.string().nonempty(),
});

/** Zod schema gating every wrapped keyring crossing the filesystem boundary. */
const WrappedKeyringSchema = z.object({
  version: z.number().int().positive(),
  kdf: KdfDescriptorSchema,
  verifier: z.string().nonempty(),
  projects: z.record(z.string(), z.string()),
});

/** How the workspace key is derived, recorded in plaintext beside the keys. */
type KdfDescriptor = z.infer<typeof KdfDescriptorSchema>;

/** The persisted, non-secret form of a keyring. */
export type WrappedKeyring = z.infer<typeof WrappedKeyringSchema>;

/** Raised when a keyring is structurally invalid or of an unknown version. */
export class KeyringFormatError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KeyringFormatError";
  }
}

/** Raised when the supplied passphrase does not open the keyring. */
export class WrongPassphraseError extends Error {
  constructor() {
    super("Incorrect passphrase.");
    this.name = "WrongPassphraseError";
  }
}

/** Raised when an operation needs keys that a locked keyring no longer holds. */
export class KeyringLockedError extends Error {
  constructor() {
    super("The keyring is locked; unlock it before using project keys.");
    this.name = "KeyringLockedError";
  }
}

/** Raised when a project has no data key in this keyring. */
export class UnknownProjectError extends Error {
  constructor(projectId: string) {
    super(`No data key registered for project "${projectId}".`);
    this.name = "UnknownProjectError";
  }
}

/**
 * An unlocked keyring.
 *
 * Mutating operations return the updated {@link WrappedKeyring} so the caller
 * can persist it; they never write to disk themselves.
 */
export interface Keyring {
  /** Whether the in-memory keys have been discarded. */
  isLocked(): boolean;
  /** Discards every unwrapped key. Irreversible without the passphrase. */
  lock(): void;
  /** Whether a data key is registered for `projectId`. */
  hasProject(projectId: string): boolean;
  /** Every registered project id. */
  projectIds(): string[];
  /**
   * The data key for a project.
   *
   * @throws {KeyringLockedError} When the keyring is locked.
   * @throws {UnknownProjectError} When the project is not registered.
   */
  projectKey(projectId: string): CryptoKey;
  /**
   * Generates and wraps a fresh data key for a project.
   *
   * @throws {KeyringLockedError} When the keyring is locked.
   * @throws {Error} When the project is already registered.
   */
  addProject(projectId: string): Promise<WrappedKeyring>;
  /** Forgets a project's data key. Its files become permanently unreadable. */
  removeProject(projectId: string): WrappedKeyring;
  /**
   * Re-derives the workspace key from a new passphrase and re-seals every
   * wrapped key. Project data is untouched.
   *
   * @throws {KeyringLockedError} When the keyring is locked.
   */
  changePassphrase(
    newPassphrase: string,
    params?: Argon2Params,
  ): Promise<WrappedKeyring>;
  /** The persistable form. Safe to call while locked — nothing here is secret. */
  snapshot(): WrappedKeyring;
}

/**
 * Creates a brand-new keyring for a workspace.
 *
 * @param passphrase - The user's chosen passphrase.
 * @param params - Argon2id cost parameters; defaults to the OWASP minimum.
 * @returns An unlocked keyring with no projects registered.
 */
export async function createKeyring(
  passphrase: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<Keyring> {
  const salt = generateSalt();
  const workspaceKey = await deriveWorkspaceKey(passphrase, salt, params);
  const verifier = await seal(workspaceKey, encodeText(VERIFIER_PLAINTEXT));

  return buildKeyring(
    {
      version: KEYRING_VERSION,
      kdf: describeKdf(params, salt),
      verifier: toBase64(verifier),
      projects: {},
    },
    workspaceKey,
    new Map(),
  );
}

/**
 * Unlocks a persisted keyring.
 *
 * @param wrapped - The persisted keyring.
 * @param passphrase - The passphrase to try.
 * @returns An unlocked keyring with every project key available.
 * @throws {KeyringFormatError} When the structure or version is unusable.
 * @throws {WrongPassphraseError} When the passphrase does not open it.
 */
export async function unlockKeyring(
  wrapped: WrappedKeyring,
  passphrase: string,
): Promise<Keyring> {
  const validated = parseWrappedKeyring(wrapped);
  const workspaceKey = await deriveWorkspaceKey(
    passphrase,
    fromBase64(validated.kdf.salt),
    toParams(validated.kdf),
  );

  try {
    await open(workspaceKey, fromBase64(validated.verifier));
  } catch (error) {
    if (error instanceof EnvelopeIntegrityError)
      throw new WrongPassphraseError();
    throw error;
  }

  const keys = new Map<string, CryptoKey>();
  for (const [projectId, wrappedKey] of Object.entries(validated.projects)) {
    const raw = await open(workspaceKey, fromBase64(wrappedKey));
    keys.set(projectId, await importAesKey(raw));
  }

  return buildKeyring(validated, workspaceKey, keys);
}

/**
 * Validates a candidate keyring structure and version.
 *
 * @param candidate - Untrusted keyring data.
 * @returns The validated keyring.
 * @throws {KeyringFormatError} When invalid or of an unsupported version.
 */
export function parseWrappedKeyring(candidate: unknown): WrappedKeyring {
  const result = WrappedKeyringSchema.safeParse(candidate);
  if (!result.success) {
    throw new KeyringFormatError(
      `Keyring is not valid: ${result.error.issues.map((i) => i.message).join("; ")}`,
      { cause: result.error },
    );
  }
  if (result.data.version !== KEYRING_VERSION) {
    throw new KeyringFormatError(
      `Unsupported keyring version ${result.data.version}; this build supports version ${KEYRING_VERSION}.`,
    );
  }
  return result.data;
}

/**
 * Assembles a {@link Keyring} over its wrapped state and unwrapped keys.
 *
 * @param initial - The wrapped keyring this instance starts from.
 * @param initialWorkspaceKey - The unwrapped workspace key.
 * @param initialKeys - Unwrapped per-project data keys.
 * @returns The unlocked keyring.
 */
function buildKeyring(
  initial: WrappedKeyring,
  initialWorkspaceKey: CryptoKey,
  initialKeys: Map<string, CryptoKey>,
): Keyring {
  let wrapped: WrappedKeyring = initial;
  let workspaceKey: CryptoKey | null = initialWorkspaceKey;
  let keys: Map<string, CryptoKey> | null = initialKeys;

  /**
   * Returns the live key material, or fails if the keyring has been locked.
   *
   * @returns The workspace key and the project-key map.
   * @throws {KeyringLockedError} When locked.
   */
  function requireUnlocked(): {
    workspaceKey: CryptoKey;
    keys: Map<string, CryptoKey>;
  } {
    if (!workspaceKey || !keys) throw new KeyringLockedError();
    return { workspaceKey, keys };
  }

  return {
    isLocked: () => workspaceKey === null,

    lock: () => {
      workspaceKey = null;
      keys = null;
    },

    hasProject: (projectId) => projectId in wrapped.projects,

    projectIds: () => Object.keys(wrapped.projects),

    projectKey: (projectId) => {
      const live = requireUnlocked();
      const key = live.keys.get(projectId);
      if (!key) throw new UnknownProjectError(projectId);
      return key;
    },

    addProject: async (projectId) => {
      const live = requireUnlocked();
      if (projectId in wrapped.projects) {
        throw new Error(`Project "${projectId}" already has a data key.`);
      }
      const raw = generateDataKeyBytes();
      const sealed = await seal(live.workspaceKey, raw);
      live.keys.set(projectId, await importAesKey(raw));
      wrapped = {
        ...wrapped,
        projects: { ...wrapped.projects, [projectId]: toBase64(sealed) },
      };
      return wrapped;
    },

    removeProject: (projectId) => {
      const projects = { ...wrapped.projects };
      delete projects[projectId];
      keys?.delete(projectId);
      wrapped = { ...wrapped, projects };
      return wrapped;
    },

    changePassphrase: async (newPassphrase, params = DEFAULT_ARGON2_PARAMS) => {
      const live = requireUnlocked();
      const salt = generateSalt();
      const nextKey = await deriveWorkspaceKey(newPassphrase, salt, params);

      // Re-seal from the *wrapped* material rather than from the in-memory
      // handles: `CryptoKey`s are non-extractable by design, so their raw bytes
      // are recovered by opening what is already on disk under the old key.
      const projects: Record<string, string> = {};
      for (const [projectId, oldWrapped] of Object.entries(wrapped.projects)) {
        const raw = await open(live.workspaceKey, fromBase64(oldWrapped));
        projects[projectId] = toBase64(await seal(nextKey, raw));
      }

      wrapped = {
        version: KEYRING_VERSION,
        kdf: describeKdf(params, salt),
        verifier: toBase64(await seal(nextKey, encodeText(VERIFIER_PLAINTEXT))),
        projects,
      };
      workspaceKey = nextKey;
      return wrapped;
    },

    snapshot: () => wrapped,
  };
}

/**
 * Builds the persisted KDF descriptor.
 *
 * @param params - Argon2id cost parameters.
 * @param salt - The workspace salt.
 * @returns The descriptor to persist in plaintext.
 */
function describeKdf(params: Argon2Params, salt: Uint8Array): KdfDescriptor {
  return {
    algorithm: "argon2id",
    memoryKiB: params.memoryKiB,
    iterations: params.iterations,
    parallelism: params.parallelism,
    salt: toBase64(salt),
  };
}

/**
 * Extracts the cost parameters from a persisted descriptor.
 *
 * @param kdf - The persisted descriptor.
 * @returns The Argon2id parameters it records.
 */
function toParams(kdf: KdfDescriptor): Argon2Params {
  return {
    memoryKiB: kdf.memoryKiB,
    iterations: kdf.iterations,
    parallelism: kdf.parallelism,
  };
}

/**
 * Encodes text as UTF-8 bytes.
 *
 * @param value - The text to encode.
 * @returns The encoded bytes.
 */
function encodeText(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/**
 * Encodes bytes as base64.
 *
 * Uses `btoa`, which exists in Node and in browsers alike — unlike `Buffer`,
 * which is absent from the native/static-export build.
 *
 * @param data - Bytes to encode.
 * @returns The base64 form.
 */
function toBase64(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Decodes base64 back to bytes.
 *
 * @param value - The base64 text.
 * @returns The decoded bytes.
 * @throws {KeyringFormatError} When the text is not valid base64.
 */
function fromBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch (error) {
    throw new KeyringFormatError("Keyring contains malformed base64.", {
      cause: error,
    });
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
