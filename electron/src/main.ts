import { app, BrowserWindow, shell, utilityProcess } from "electron";
import type { UtilityProcess } from "electron";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import http from "http";
import fs from "fs";
import {
  legacyProjectsDir,
  migrateLegacyProjectsDir,
  resolveProjectsDir,
  type ProjectsDirEnvironment,
} from "./projects-dir";

const PORT = 3000;
let serverProcess: ChildProcess | UtilityProcess | null = null;
let logStream: fs.WriteStream | null = null;

function initLog() {
  const logPath = path.join(app.getPath("logs"), "getwrite.log");
  logStream = fs.createWriteStream(logPath, { flags: "a" });
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  logStream?.write(line);
}

function resolveAppVersion(): string {
  // Read the app's own package.json so the version is correct in dev too
  // (app.getVersion() falls back to Electron's framework version when running
  // unpackaged via `electron dist/main.js`). __dirname is electron/dist, so the
  // package.json sits one level up — and inside the asar in packaged builds.
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    if (typeof pkg.version === "string") {
      return pkg.version;
    }
  } catch {
    // fall through to app.getVersion()
  }
  return app.getVersion();
}

function getRepoRoot(): string {
  // __dirname is electron/dist/ — two levels up reaches the repo root
  return app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, "..", "..");
}

/**
 * Describes this build's environment for `projects-dir.ts`.
 *
 * @returns The paths that decide where projects live.
 */
function projectsDirEnvironment(): ProjectsDirEnvironment {
  return {
    isPackaged: app.isPackaged,
    userDataDir: app.isPackaged ? app.getPath("userData") : "",
    resourcesPath: app.isPackaged ? process.resourcesPath : "",
    repoRoot: getRepoRoot(),
  };
}

function resolveDirectories() {
  const root = getRepoRoot();
  return {
    // Packaged builds keep projects under userData, never inside the app
    // bundle — see `projects-dir.ts` for why that distinction matters.
    // Templates and the standalone server stay under `root`: they are read-only
    // build output that *should* be replaced wholesale by an update.
    projectsDir: resolveProjectsDir(projectsDirEnvironment()),
    templatesDir: path.join(
      root,
      "getwrite-config",
      "templates",
      "project-types",
    ),
    standaloneDir: path.join(root, "frontend", ".next", "standalone"),
  };
}

function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            retry();
          }
        })
        .on("error", retry);
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error("Server did not start in time"));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

function startServer(
  dirs: ReturnType<typeof resolveDirectories>,
): ChildProcess | UtilityProcess {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    GETWRITE_PROJECTS_DIR: dirs.projectsDir,
    GETWRITE_TEMPLATES_DIR: dirs.templatesDir,
    // Marks this server as the Electron desktop build so the frontend can gate
    // the update notice to desktop only. The repo slug and running version feed
    // the version check against the latest GitHub Release.
    GETWRITE_DESKTOP: "1",
    GETWRITE_REPO: "saboteur-works/getwrite",
    GETWRITE_APP_VERSION: resolveAppVersion(),
  };

  log(`standaloneDir: ${dirs.standaloneDir}`);
  log(`projectsDir:   ${dirs.projectsDir}`);
  log(`templatesDir:  ${dirs.templatesDir}`);

  if (app.isPackaged) {
    fs.mkdirSync(dirs.projectsDir, { recursive: true });
    // Rescue anything an earlier build left inside the bundle. A no-op once
    // there is nothing there, so it can run on every launch.
    migrateLegacyProjectsDir(
      legacyProjectsDir(projectsDirEnvironment()),
      dirs.projectsDir,
      log,
    );
    // pnpm monorepo: Next.js standalone mirrors the workspace layout,
    // so server.js lands at standalone/frontend/server.js (not standalone/server.js).
    const serverCwd = path.join(dirs.standaloneDir, "frontend");
    const serverScript = path.join(serverCwd, "server.js");
    log(`Forking packaged server: ${serverScript}`);
    // Run the Next server via Electron's utilityProcess rather than
    // child_process.spawn(process.execPath, …, ELECTRON_RUN_AS_NODE). Spawning the
    // app's own bundle executable as Node still gets a bouncing Dock tile on macOS
    // (the generic "exec" icon named GetWrite). A utilityProcess runs headless as a
    // managed Node child — like the other Helper processes — with no Dock presence.
    // stdio pipes stdout/stderr back so we can keep logging them.
    return utilityProcess.fork(serverScript, [], {
      cwd: serverCwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  log(`Spawning dev server in: ${path.join(getRepoRoot(), "frontend")}`);
  return spawn("pnpm", ["dev"], {
    cwd: path.join(getRepoRoot(), "frontend"),
    env,
    shell: true,
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    // Brand chrome color so the window doesn't flash white before the app paints.
    backgroundColor: "#1C1C1A",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Open external links (e.g. update-notice "View release notes" / "Download")
  // in the user's default browser rather than a chrome-less in-app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Keep the window pinned to the local app origin. In-page <a href> clicks to
  // external sites are handed to the default browser instead of navigating the
  // window away from localhost (setWindowOpenHandler only covers window.open).
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) {
        void shell.openExternal(url);
      }
    }
  });

  // Cmd/Ctrl+Shift+I toggles DevTools — scoped to this window's input rather
  // than a process-global hotkey that would be captured system-wide.
  win.webContents.on("before-input-event", (event, input) => {
    const mod = process.platform === "darwin" ? input.meta : input.control;
    if (mod && input.shift && input.key.toLowerCase() === "i") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  return win;
}

function loadWhenReady(win: BrowserWindow): { abort: (msg: string) => void } {
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const abort = (msg: string) => {
    if (stopped) return;
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (!win.isDestroyed()) {
      const logDir = app.getPath("logs");
      win
        .loadURL(
          `data:text/html,<pre style="font-family:monospace;padding:2rem">${msg}\n\nLog: ${logDir}/getwrite.log</pre>`,
        )
        .catch(() => {});
    }
  };

  win.on("closed", () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
  });

  win.webContents.on("did-fail-load", (_e, code, desc) => {
    if (stopped) return;
    log(`did-fail-load ${code} ${desc} — retrying in 1s`);
    retryTimer = setTimeout(() => {
      if (!stopped && !win.isDestroyed()) {
        win.loadURL(`http://localhost:${PORT}`).catch(() => {});
      }
    }, 1000);
  });

  waitForServer(`http://localhost:${PORT}`)
    .then(() => {
      log("server ready");
      if (!stopped && !win.isDestroyed()) {
        win.loadURL(`http://localhost:${PORT}`).catch(() => {});
      }
    })
    .catch((err) => abort(`Server failed to start: ${err}`));

  return { abort };
}

// Tracks the active window's abort handler so a server crash can surface the
// error screen regardless of which window opened it (e.g. after a macOS reopen).
let currentAbort: ((msg: string) => void) | null = null;

function openMainWindow(): void {
  const win = createWindow();
  currentAbort = loadWhenReady(win).abort;
}

// Single-instance lock: a second launch would collide on the fixed server port,
// so hand focus back to the running window and quit the duplicate.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    initLog();
    log(`app ready — isPackaged: ${app.isPackaged}`);
    log(`resourcesPath: ${process.resourcesPath}`);

    const dirs = resolveDirectories();
    serverProcess = startServer(dirs);

    serverProcess.stdout?.on("data", (d) => log(d.toString().trim()));
    serverProcess.stderr?.on("data", (d) =>
      log(`[stderr] ${d.toString().trim()}`),
    );

    openMainWindow();

    // ChildProcess and UtilityProcess both extend EventEmitter and emit "exit"
    // with the code first; subscribe via the common base so the union typechecks.
    (serverProcess as NodeJS.EventEmitter).on("exit", (code: number | null) => {
      log(`server exited with code ${code}`);
      if (code !== 0) {
        currentAbort?.(`Server exited unexpectedly (code ${code})`);
      }
    });
  });

  // macOS: the app stays alive after its window closes (window-all-closed below
  // only quits on other platforms). Recreate the window when the dock icon is
  // clicked — the spawned server is still running, so it reloads immediately.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
}

app.on("before-quit", () => {
  serverProcess?.kill();
  logStream?.end();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
