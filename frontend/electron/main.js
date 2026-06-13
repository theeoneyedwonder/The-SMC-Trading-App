import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { spawn }              from 'node:child_process';
import path                   from 'node:path';
import fs                     from 'node:fs';
import { fileURLToPath }      from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Use a consistent app name so %AppData%\SMC Bot is predictable
app.setName('SMC Bot');

const isDev = !app.isPackaged;

// Credentials are stored in %AppData%\SMC Bot\settings.json
const userDataDir  = app.getPath('userData');
const configPath   = path.join(userDataDir, 'settings.json');

let backend = null;
let mainWin  = null;
let splash   = null;

// ── Splash ───────────────────────────────────────────────────
function createSplash() {
  splash = new BrowserWindow({
    width: 380, height: 240,
    frame: false, resizable: false, center: true,
    backgroundColor: '#09090f',
    webPreferences: { contextIsolation: true },
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
}

// ── Backend ──────────────────────────────────────────────────
function startBackend() {
  if (isDev) {
    console.log('[App] Dev mode — start the backend manually: python main.py');
    return;
  }

  const exePath = path.join(process.resourcesPath, 'backend', 'smc-bot-backend.exe');
  if (!fs.existsSync(exePath)) {
    console.error('[App] Backend not found:', exePath);
    return;
  }

  // Ensure the AppData directory exists before the backend writes to it
  fs.mkdirSync(userDataDir, { recursive: true });

  backend = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    windowsHide: true,
    stdio: 'pipe',
    env: {
      ...process.env,
      SMC_CONFIG_PATH: configPath,   // backend reads/writes credentials here
    },
  });

  backend.stdout?.on('data', d => console.log('[Backend]', d.toString().trim()));
  backend.stderr?.on('data', d => console.error('[Backend]', d.toString().trim()));
  backend.on('exit', code => { console.log('[Backend] exit:', code); backend = null; });

  console.log('[App] Backend PID:', backend.pid);
  console.log('[App] Config path:', configPath);
}

// Poll /health until the backend is responsive
async function waitForBackend(ms = 35_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch('http://127.0.0.1:8000/health');
      if (r.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// ── Main window ──────────────────────────────────────────────
function createMain() {
  mainWin = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1024, minHeight: 640,
    backgroundColor: '#09090f',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration:  false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    mainWin.loadURL('http://localhost:5173');
    mainWin.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWin.once('ready-to-show', () => {
    splash?.close();
    splash = null;
    mainWin.show();
    mainWin.focus();
  });

  mainWin.on('closed', () => { mainWin = null; });
}

// Open URLs in the system browser (used by the setup wizard's "Download MT5" button)
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

// ── Lifecycle ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();
  startBackend();

  if (!isDev) {
    const ok = await waitForBackend();
    if (!ok) console.warn('[App] Backend slow to start — opening UI anyway');
  }

  createMain();
  initUpdater();
});

// ── Auto-updater ──────────────────────────────────────────────
async function initUpdater() {
  if (isDev) return; // only runs in packaged app
  try {
    const { autoUpdater } = await import('electron-updater');

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', info => {
      console.log('[Updater] Update available:', info.version);
    });

    autoUpdater.on('update-downloaded', async info => {
      const { response } = await dialog.showMessageBox({
        type:      'info',
        title:     'Update Ready — SMC Bot',
        message:   `Version ${info.version} has been downloaded.\nRestart now to install the update?`,
        buttons:   ['Restart Now', 'Later'],
        defaultId: 0,
      });
      if (response === 0) autoUpdater.quitAndInstall();
    });

    autoUpdater.on('error', e => {
      console.error('[Updater] Error:', e.message);
    });

    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.log('[Updater] Not available:', e.message);
  }
}

app.on('window-all-closed', () => {
  if (backend && !backend.killed) {
    backend.kill('SIGTERM');
    setTimeout(() => {
      try { if (backend && !backend.killed) backend.kill('SIGKILL'); } catch {}
    }, 3000);
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMain();
});
