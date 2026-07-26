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

export default fsPromises;
