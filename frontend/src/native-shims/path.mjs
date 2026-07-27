// ADR-021 Phase 0 — on-device harness bundle shim for `node:path` / `path`.
//
// The model/search layer imports `path` as a value in ~40 modules but only
// actually calls `join`, `dirname`, and `posix.{normalize,dirname}` (verified
// by grep across src/lib). Android is POSIX, so only POSIX semantics are
// implemented — a faithful port of Node's own `path.posix` algorithm (join /
// normalize / dirname), plus a few cheap, correct extras for robustness. This
// keeps the harness dependency-free (no path-browserify), matching ADR-021's
// zero-new-shipping-deps discipline; it is build-time-only and never enters the
// frontend/hosted/desktop bundle.

const CHAR_FORWARD_SLASH = 47;
const CHAR_DOT = 46;

function assertPath(path) {
  if (typeof path !== "string") {
    throw new TypeError(`Path must be a string. Received ${typeof path}`);
  }
}

// Port of Node's internal normalizeString for POSIX: resolves `.` and `..`
// segments and collapses redundant separators.
function normalizeString(path, allowAboveRoot) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code = 0;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) code = path.charCodeAt(i);
    else if (code === CHAR_FORWARD_SLASH) break;
    else code = CHAR_FORWARD_SLASH;

    if (code === CHAR_FORWARD_SLASH) {
      if (lastSlash === i - 1 || dots === 1) {
        // empty segment or "." — skip
      } else if (dots === 2) {
        if (
          res.length < 2 ||
          lastSegmentLength !== 2 ||
          res.charCodeAt(res.length - 1) !== CHAR_DOT ||
          res.charCodeAt(res.length - 2) !== CHAR_DOT
        ) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
            }
            lastSlash = i;
            dots = 0;
            continue;
          } else if (res.length !== 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) res += "/" + path.slice(lastSlash + 1, i);
        else res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

export function normalize(path) {
  assertPath(path);
  if (path.length === 0) return ".";
  const isAbs = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
  const trailingSeparator =
    path.charCodeAt(path.length - 1) === CHAR_FORWARD_SLASH;
  path = normalizeString(path, !isAbs);
  if (path.length === 0) {
    if (isAbs) return "/";
    return trailingSeparator ? "./" : ".";
  }
  if (trailingSeparator) path += "/";
  return isAbs ? "/" + path : path;
}

export function join(...args) {
  if (args.length === 0) return ".";
  let joined;
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    assertPath(arg);
    if (arg.length > 0) {
      if (joined === undefined) joined = arg;
      else joined += "/" + arg;
    }
  }
  if (joined === undefined) return ".";
  return normalize(joined);
}

export function dirname(path) {
  assertPath(path);
  if (path.length === 0) return ".";
  const hasRoot = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
  let end = -1;
  let matchedSlash = true;
  for (let i = path.length - 1; i >= 1; --i) {
    if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      matchedSlash = false;
    }
  }
  if (end === -1) return hasRoot ? "/" : ".";
  if (hasRoot && end === 1) return "//";
  return path.slice(0, end);
}

export function basename(path, ext) {
  assertPath(path);
  let start = 0;
  let end = -1;
  let matchedSlash = true;
  for (let i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
      if (!matchedSlash) {
        start = i + 1;
        break;
      }
    } else if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
  }
  if (end === -1) return "";
  const base = path.slice(start, end);
  if (ext && base.endsWith(ext) && base !== ext) {
    return base.slice(0, base.length - ext.length);
  }
  return base;
}

export function extname(path) {
  assertPath(path);
  const b = basename(path);
  const dot = b.lastIndexOf(".");
  if (dot <= 0) return "";
  return b.slice(dot);
}

export function isAbsolute(path) {
  assertPath(path);
  return path.length > 0 && path.charCodeAt(0) === CHAR_FORWARD_SLASH;
}

export function resolve(...args) {
  let resolved = "";
  let resolvedAbsolute = false;
  for (let i = args.length - 1; i >= 0 && !resolvedAbsolute; i--) {
    const p = args[i];
    assertPath(p);
    if (p.length === 0) continue;
    resolved = p + "/" + resolved;
    resolvedAbsolute = p.charCodeAt(0) === CHAR_FORWARD_SLASH;
  }
  resolved = normalizeString(resolved, !resolvedAbsolute);
  if (resolvedAbsolute) return "/" + resolved;
  return resolved.length > 0 ? resolved : ".";
}

export const sep = "/";
export const delimiter = ":";

const posix = {
  normalize,
  join,
  dirname,
  basename,
  extname,
  isAbsolute,
  resolve,
  sep,
  delimiter,
};
// `path.posix.<fn>` is used in a handful of adapters; make it self-referential
// so `import path from "node:path"; path.posix.normalize(...)` resolves here.
posix.posix = posix;

export { posix };
export default posix;
