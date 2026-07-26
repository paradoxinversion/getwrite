// ADR-021 Phase 0 — on-device harness bundle: dependency-free Buffer polyfill.
//
// capacitorFsAdapter.ts and native-device-harness.ts use Node's global `Buffer`
// (base64 encode/decode of every read/write, and Buffer.alloc for the
// throughput payload). `Buffer` does not exist in a WebView, so without this the
// adapter throws `ReferenceError: Buffer is not defined` on the first write.
//
// esbuild's `inject` wires this module's `Buffer` export in as the free `Buffer`
// identifier across every bundled module. This is a minimal, self-contained
// polyfill (no `buffer` npm dependency — matching ADR-021's zero-new-deps
// discipline) built on the WebView's own TextEncoder/TextDecoder and atob/btoa.
// It implements exactly the surface the reachable code uses: from(string,
// "utf8"|"base64"), from(bytes), isBuffer, alloc, and toString("base64"|"utf8").
//
// FINDING (Phase 0): the storage adapter's dependency on Node `Buffer` is
// invisible under Vitest (Node has Buffer) but breaks in a WebView. The real
// native build must ship a Buffer polyfill like this, or the adapter must be
// reworked to Uint8Array + browser base64. The FR7a throughput numbers reflect
// this JS base64 path — which is realistic, since a real native build also runs
// the adapter in the WebView with a JS Buffer.

const CHUNK = 0x8000;

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    // Chunked to avoid exceeding the argument-count limit on large payloads.
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export class Buffer extends Uint8Array {
  static isBuffer(value) {
    return value instanceof Buffer;
  }

  // Uint8Array initializes to zeros, matching Buffer.alloc's contract.
  static alloc(size) {
    return new Buffer(size);
  }

  static from(value, encoding) {
    if (typeof value === "string") {
      if (encoding === "base64") return new Buffer(base64ToBytes(value));
      // utf8 / "utf-8" / default
      return new Buffer(new TextEncoder().encode(value));
    }
    if (value instanceof ArrayBuffer) return new Buffer(new Uint8Array(value));
    if (value instanceof Uint8Array || Array.isArray(value)) {
      return new Buffer(value);
    }
    throw new TypeError(
      `Buffer.from: unsupported input type ${typeof value} in harness shim`,
    );
  }

  toString(encoding) {
    if (encoding === "base64") return bytesToBase64(this);
    // utf8 / "utf-8" / default
    return new TextDecoder().decode(this);
  }

  // native-device-harness.ts's FR7a integrity check calls readBack.equals(payload).
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

export default { Buffer };
