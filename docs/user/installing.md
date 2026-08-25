# Installing GetWrite

GetWrite ships as a **desktop app**. This is a deliberate design choice, not a
limitation — see [Why desktop, not web](#why-desktop-not-web) below.

Download the latest build for your platform from the
[Releases page](https://github.com/saboteur-works/getwrite/releases/latest).

| Platform                            | File to download               |
| ----------------------------------- | ------------------------------ |
| macOS — Apple Silicon (M1/M2/M3/M4) | `GetWrite-<version>-arm64.dmg` |
| macOS — Intel                       | `GetWrite-<version>-x64.dmg`   |
| Windows                             | `GetWrite-<version>.exe`       |
| Linux                               | `GetWrite-<version>.AppImage`  |

> **Which Mac do I have?** Click the Apple menu → **About This Mac**. "Apple M…"
> means Apple Silicon (`arm64`); "Intel" means `x64`. If you grab the wrong one,
> the app either won't launch or will run slowly under Rosetta — so pick
> deliberately.

## macOS: opening an unsigned build

GetWrite is **not yet signed or notarized by Apple** (code-signing certification
is in progress). Until then, macOS Gatekeeper will warn that the app "cannot be
opened because the developer cannot be verified" or is "damaged." This is
expected for an unsigned build — the app is safe; macOS simply can't verify the
signature yet. Use one of the methods below to open it.

1. Open the downloaded `.dmg` and drag **GetWrite** into your **Applications**
   folder.

2. Open it for the first time using **one** of these:

   **Option A — Right-click → Open (simplest)**
   - In Applications, **right-click** (or Control-click) **GetWrite** → **Open**.
   - In the dialog that appears, click **Open** again.
   - macOS remembers this choice; afterwards you can launch it normally.

   **Option B — Privacy & Security setting**
   - Double-click GetWrite once and dismiss the warning.
   - Open **System Settings → Privacy & Security**, scroll to the **Security**
     section, and click **Open Anyway** next to the GetWrite message.
   - Confirm with **Open**.

   **Option C — Clear the quarantine flag (Terminal)**

   If macOS reports the app is "damaged" (common on newer macOS for unsigned
   apps), remove the quarantine attribute, then open normally:

   ```bash
   xattr -dr com.apple.quarantine /Applications/GetWrite.app
   ```

You only need to do this once. After the first successful open, GetWrite
launches like any other app.

## Windows

The installer is not yet signed, so **Windows SmartScreen** may show a "Windows
protected your PC" dialog. Click **More info → Run anyway** to proceed.

## Linux

Mark the AppImage as executable and run it:

```bash
chmod +x GetWrite-<version>.AppImage
./GetWrite-<version>.AppImage
```

## Where your work is stored

GetWrite is **local-first**: your projects live as plain files and folders on
your own machine, not in any cloud or database. The desktop app keeps them in a
`projects/` directory alongside the app's data, and the first launch starts with
an empty workspace. Because everything is on disk, you can back it up, sync it,
or inspect it with ordinary file tools.

## Why desktop, not web

GetWrite has no database. Every project, resource, and piece of metadata is read
and written directly to the filesystem. That model is what makes the app
local-first and inspectable — but it also means there's no per-user data
isolation to host safely on a shared web server: a single hosted instance would
put every visitor in the same projects directory. Shipping as a desktop app
gives each user their own private, on-disk workspace, which is exactly the point.

Apple code-signing/notarization and automatic updates are planned for a future
release; until then the manual steps above are all that's required.
