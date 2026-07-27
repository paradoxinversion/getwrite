// ADR-021 Phase 0 — on-device harness bundle shim for `node:fs/promises`.
//
// `io.ts` and `schemas.ts` default-import `fs/promises` for the Node fs
// StorageAdapter and project-type-file validation — neither of which runs on
// the native path (the native app uses capacitorFsAdapter over
// @capacitor/filesystem). This throwing default-export stub lets esbuild
// resolve the import; any actual call fails loudly so a wrong assumption
// surfaces during the device run rather than silently corrupting a result.

function unavailable(member) {
  return () => {
    throw new Error(
      `node:fs/promises.${member}() is not available in the on-device harness ` +
        `bundle. The native path must use @capacitor/filesystem ` +
        `(capacitorFsAdapter), not node:fs/promises.`,
    );
  };
}

const fsPromises = new Proxy(
  {},
  {
    get(_target, prop) {
      return unavailable(String(prop));
    },
  },
);

// Named exports some model modules import directly (e.g. lib/projectTypes.ts's
// `import { readdir, readFile } from "node:fs/promises"`). These are only on the
// HTTP/desktop project-type resolution path — never invoked on native, which
// uses the static-import registry (project-types-static.ts) — but the import
// specifiers are still bundled, so they must resolve. They throw loudly if ever
// actually called on device.
export const readdir = unavailable("readdir");
export const readFile = unavailable("readFile");
export const writeFile = unavailable("writeFile");
export const mkdir = unavailable("mkdir");
export const rm = unavailable("rm");
export const stat = unavailable("stat");
// `open` is imported by the media-metadata dependency (music-metadata/strtok3)
// for streaming reads. On native, media metadata extraction is deferred (FR9)
// and this throws if reached; it's here so the specifier resolves at build time.
export const open = unavailable("open");
export const access = unavailable("access");
export const unlink = unavailable("unlink");
export const rename = unavailable("rename");
export const copyFile = unavailable("copyFile");

export default fsPromises;
