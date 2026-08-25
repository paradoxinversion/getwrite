# Follow-up Work: Update Notice

## 2026-06-15 — deferred items from initial implementation

The Update Notice feature (Tasks 1–8) is implemented and all tests pass.

1. **Open banner links in the OS browser from Electron.** ✅ Done 2026-06-15.
   `createWindow()` in `electron/src/main.ts` now registers
   `webContents.setWindowOpenHandler`, routing `https?:` URLs through
   `shell.openExternal` and denying in-app navigation, so the banner's "View
   release notes" / "Download" links open in the user's default browser.

2. **Verify Task 1 env injection in a _packaged_ build.** ✅ Done 2026-06-15.
   `pnpm electron:package` produced `dist-electron/GetWrite-0.2.49-arm64.dmg`.
   Launching the packaged app (log confirms `isPackaged: true`, standalone
   spawn path under `GetWrite.app/Contents/Resources`) and querying
   `/api/version-check` returned
   `{ updateAvailable: false, currentVersion: "0.2.49", latestVersion: "0.2.49" }`
   — confirming `GETWRITE_DESKTOP`/`GETWRITE_APP_VERSION` reach the standalone
   server and the `getwrite-v` tag normalization is in the bundle.

3. **Manual end-to-end check against a real newer release.** Still open.
   The version comparison and GitHub fetch are covered by unit tests with mocked
   payloads. A live check (current version < latest GitHub Release) would
   confirm the banner appears with the correct release-notes and installer-asset
   URLs for the running platform. Deferred until there is a published release
   newer than the installed build to test against.

### Notes for future implementation

- The platform→asset matching in `update-check.ts` (`PLATFORM_ASSET_PATTERNS`)
  assumes installer file names contain `.dmg`/`mac` (darwin), `.exe`/`.msi`/`win`
  (win32), or `.AppImage`/`.deb`/`.rpm`/`linux`. If `electron-builder.yml`
  output names diverge from this, update the patterns; the code already falls
  back to the release page URL when no asset matches.
