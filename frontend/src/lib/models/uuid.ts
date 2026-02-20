/**
 * UUID utilities.
 *
 * Follow RFC 4122 v4 generation rules where possible. Uses `crypto.randomUUID`
 * when available (browsers / modern Node). Falls back to a secure RNG where
 * available, or a Math.random fallback as a last resort.
 */
import type { UUID } from "./types";

/** Generate a UUID v4 string. */
export function generateUUID(): UUID {
    if (
        typeof globalThis !== "undefined" &&
        typeof (globalThis as any).crypto?.randomUUID === "function"
    ) {
        return (globalThis as any).crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);

    if (typeof (globalThis as any).crypto?.getRandomValues === "function") {
        (globalThis as any).crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }

    // Per RFC 4122 section 4.4, set bits for version and `clock_seq_hi_and_reserved`
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
        "",
    );
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

/** Validate that a string is a UUID v1-v5 (simple regex check). */
export function isValidUUID(value: string): value is UUID {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
    );
}

export default { generateUUID, isValidUUID };
