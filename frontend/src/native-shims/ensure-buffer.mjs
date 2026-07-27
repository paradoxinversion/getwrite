// ADR-021 Phase 2 — ensures a global `Buffer` exists in the native WebView.
//
// The storage adapter (capacitorFsAdapter) uses Node's global `Buffer` for all
// base64 encode/decode. A WebView has no `Buffer`, so without this the first
// read/write throws `ReferenceError: Buffer is not defined`. This is a
// dependency-free polyfill (the same one the Phase 0 esbuild harness proved
// on-device), installed as a side effect on import.
//
// Guarded by `typeof Buffer === "undefined"`: a no-op under Node (tests, the
// build-time static export/prerender, desktop/hosted) where Buffer already
// exists, so it only ever activates inside the WebView. Imported for its side
// effect at the top of capacitorFsAdapter.ts — a native-only module (excluded
// from the web bundle via next.config.mjs's resolveAlias web-stubs), so this
// polyfill never enters the hosted/desktop build.

const CHUNK = 0x8000;

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

class BufferPolyfill extends Uint8Array {
  static isBuffer(value) {
    return value instanceof BufferPolyfill;
  }
  static alloc(size) {
    return new BufferPolyfill(size);
  }
  static from(value, encoding) {
    if (typeof value === "string") {
      if (encoding === "base64") return new BufferPolyfill(base64ToBytes(value));
      return new BufferPolyfill(new TextEncoder().encode(value));
    }
    if (value instanceof ArrayBuffer) {
      return new BufferPolyfill(new Uint8Array(value));
    }
    if (value instanceof Uint8Array || Array.isArray(value)) {
      return new BufferPolyfill(value);
    }
    throw new TypeError(`Buffer.from: unsupported input ${typeof value}`);
  }
  toString(encoding) {
    if (encoding === "base64") return bytesToBase64(this);
    return new TextDecoder().decode(this);
  }
  equals(other) {
    if (!(other instanceof Uint8Array) || other.length !== this.length) {
      return false;
    }
    for (let i = 0; i < this.length; i++) {
      if (this[i] !== other[i]) return false;
    }
    return true;
  }
}

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = BufferPolyfill;
}
