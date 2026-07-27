// ADR-021 Phase 2 — ensures Node globals the model layer relies on (`Buffer`,
// `setImmediate`/`clearImmediate`) exist in the native WebView.
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
  static alloc(size, fill) {
    const b = new BufferPolyfill(size);
    if (fill !== undefined) b.fill(fill);
    return b;
  }
  // Node's allocUnsafe returns uninitialized memory; a zero-filled buffer is a
  // safe, correct substitute for every caller (jszip / @react-pdf) that uses it.
  static allocUnsafe(size) {
    return new BufferPolyfill(size);
  }
  static allocUnsafeSlow(size) {
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
  // Concatenates a list of Uint8Array/Buffer chunks — used heavily by jszip
  // (DOCX) and the docx template export path.
  static concat(list, totalLength) {
    if (totalLength === undefined) {
      totalLength = 0;
      for (const b of list) totalLength += b.length;
    }
    const out = new BufferPolyfill(totalLength);
    let pos = 0;
    for (const b of list) {
      if (pos >= totalLength) break;
      const take = Math.min(b.length, totalLength - pos);
      out.set(b.subarray(0, take), pos);
      pos += take;
    }
    return out;
  }
  static byteLength(input, encoding) {
    if (typeof input !== "string") return input.byteLength ?? input.length;
    if (encoding === "base64") return base64ToBytes(input).length;
    return new TextEncoder().encode(input).length;
  }

  _dv() {
    return new DataView(this.buffer, this.byteOffset, this.byteLength);
  }

  toString(encoding, start, end) {
    const slice =
      start === undefined && end === undefined
        ? this
        : this.subarray(start ?? 0, end);
    if (encoding === "base64") return bytesToBase64(slice);
    if (encoding === "hex") {
      let s = "";
      for (const b of slice) s += b.toString(16).padStart(2, "0");
      return s;
    }
    return new TextDecoder().decode(slice);
  }

  // Node's Buffer.slice is a VIEW sharing memory (unlike Uint8Array.slice,
  // which copies); fontkit/jszip rely on the view semantics.
  slice(start = 0, end = this.length) {
    const s = start < 0 ? Math.max(this.length + start, 0) : Math.min(start, this.length);
    const e = end < 0 ? Math.max(this.length + end, 0) : Math.min(end, this.length);
    return new BufferPolyfill(this.buffer, this.byteOffset + s, Math.max(e - s, 0));
  }

  copy(target, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
    const sub = this.subarray(sourceStart, sourceEnd);
    const room = target.length - targetStart;
    const n = Math.min(sub.length, room < 0 ? 0 : room);
    target.set(sub.subarray(0, n), targetStart);
    return n;
  }

  write(string, offset = 0, length, encoding) {
    void encoding;
    const enc = new TextEncoder().encode(string);
    const n = Math.min(length ?? enc.length, this.length - offset, enc.length);
    this.set(enc.subarray(0, n), offset);
    return n;
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

  readUInt8(o = 0) {
    return this[o];
  }
  writeUInt8(v, o = 0) {
    this[o] = v & 0xff;
    return o + 1;
  }
  readUInt16LE(o = 0) {
    return this._dv().getUint16(o, true);
  }
  readUInt16BE(o = 0) {
    return this._dv().getUint16(o, false);
  }
  writeUInt16LE(v, o = 0) {
    this._dv().setUint16(o, v, true);
    return o + 2;
  }
  writeUInt16BE(v, o = 0) {
    this._dv().setUint16(o, v, false);
    return o + 2;
  }
  readUInt32LE(o = 0) {
    return this._dv().getUint32(o, true);
  }
  readUInt32BE(o = 0) {
    return this._dv().getUint32(o, false);
  }
  writeUInt32LE(v, o = 0) {
    this._dv().setUint32(o, v, true);
    return o + 4;
  }
  writeUInt32BE(v, o = 0) {
    this._dv().setUint32(o, v, false);
    return o + 4;
  }
  readInt8(o = 0) {
    return this._dv().getInt8(o);
  }
  writeInt8(v, o = 0) {
    this._dv().setInt8(o, v);
    return o + 1;
  }
  readInt16LE(o = 0) {
    return this._dv().getInt16(o, true);
  }
  readInt16BE(o = 0) {
    return this._dv().getInt16(o, false);
  }
  writeInt16LE(v, o = 0) {
    this._dv().setInt16(o, v, true);
    return o + 2;
  }
  writeInt16BE(v, o = 0) {
    this._dv().setInt16(o, v, false);
    return o + 2;
  }
  readInt32LE(o = 0) {
    return this._dv().getInt32(o, true);
  }
  readInt32BE(o = 0) {
    return this._dv().getInt32(o, false);
  }
  writeInt32LE(v, o = 0) {
    this._dv().setInt32(o, v, true);
    return o + 4;
  }
  writeInt32BE(v, o = 0) {
    this._dv().setInt32(o, v, false);
    return o + 4;
  }
  readFloatLE(o = 0) {
    return this._dv().getFloat32(o, true);
  }
  readFloatBE(o = 0) {
    return this._dv().getFloat32(o, false);
  }
  writeFloatLE(v, o = 0) {
    this._dv().setFloat32(o, v, true);
    return o + 4;
  }
  readDoubleLE(o = 0) {
    return this._dv().getFloat64(o, true);
  }
  readDoubleBE(o = 0) {
    return this._dv().getFloat64(o, false);
  }
  writeDoubleLE(v, o = 0) {
    this._dv().setFloat64(o, v, true);
    return o + 8;
  }
}

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = BufferPolyfill;
}

// `setImmediate`/`clearImmediate` are Node globals (used by sidecar.ts and
// tiptap-utils.ts to defer a write to the next tick) that a WebView lacks.
// Polyfill via setTimeout(…, 0). Guarded so Node (tests/build) is untouched.
if (typeof globalThis.setImmediate === "undefined") {
  globalThis.setImmediate = (fn, ...args) => setTimeout(() => fn(...args), 0);
  globalThis.clearImmediate = (id) => clearTimeout(id);
}
