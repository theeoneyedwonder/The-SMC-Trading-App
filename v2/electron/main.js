import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reportCrash } from './crash-reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.setName('The SMC Trading App');

const isDev = !app.isPackaged;
const userDataDir = app.getPath('userData');
const configPath = path.join(userDataDir, 'settings.json');

let backend = null;
let mainWin = null;
let splash = null;
let crashWin = null;
let pendingCrash = null;

const THEME_VARS = {
  'Light Classic': { bg: '#eef0f7', text: '#0d1117', text2: '#2e3554', accent: '#4f46e5' },
  'Light Warm': { bg: '#f5f0e8', text: '#1a1209', text2: '#5a4a30', accent: '#d97706' },
};

const DARK_DEFAULTS = {
  bg: '#060611',
  text: '#e8ecf8',
  text2: '#a0a8c8',
  accent: '#818cf8',
};

function getSavedThemeVars() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const preset = cfg?.theme?.preset;
    if (preset && THEME_VARS[preset]) return THEME_VARS[preset];

    const overrides = cfg?.theme?.overrides ?? {};
    return {
      bg: overrides['--bg'] ?? DARK_DEFAULTS.bg,
      text: overrides['--text'] ?? DARK_DEFAULTS.text,
      text2: overrides['--text2'] ?? DARK_DEFAULTS.text2,
      accent: overrides['--indigo'] ?? DARK_DEFAULTS.accent,
    };
  } catch {
    return DARK_DEFAULTS;
  }
}

function createSplash() {
  const vars = getSavedThemeVars();

  splash = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: vars.bg,
    webPreferences: { contextIsolation: true },
  });

  splash.loadFile(path.join(__dirname, 'splash.html'));

  splash.webContents.once('did-finish-load', () => {
    const js = `
      document.documentElement.style.setProperty('--bg', ${JSON.stringify(vars.bg)});
      document.documentElement.style.setProperty('--text', ${JSON.stringify(vars.text)});
      document.documentElement.style.setProperty('--text2', ${JSON.stringify(vars.text2)});
      document.documentElement.style.setProperty('--accent', ${JSON.stringify(vars.accent)});
    `;
    splash?.webContents.executeJavaScript(js).catch(() => {});
  });
}

function startBackend() {
  fs.mkdirSync(userDataDir, { recursive: true });

  if (!isDev) {
    const exePath = path.join(process.resourcesPath, 'backend', 'smc-bot-backend.exe');
    if (!fs.existsSync(exePath)) {
      console.error('[App] Backend exe not found:', exePath);
      return;
    }

    backend = spawn(exePath, [], {
      cwd: path.dirname(exePath),
      windowsHide: true,
      stdio: 'pipe',
      env: { ...process.env, SMC_CONFIG_PATH: configPath, PYTHONIOENCODING: 'utf-8' },
    });
  } else {
    const candidates = [
      process.env.PYTHON,
      `${process.env.LOCALAPPDATA}\\Python\\bin\\python.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python314\\python.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python313\\python.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python312\\python.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python311\\python.exe`,
    ].filter(Boolean);

    const pythonExe = candidates.find(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });

    if (!pythonExe) {
      console.warn('[App] Dev: Python not found. Start backend manually.');
      return;
    }

    const backendDir = path.resolve(__dirname, '..', '..', 'backend');
    backend = spawn(pythonExe, ['main.py'], {
      cwd: backendDir,
      windowsHide: false,
      stdio: 'pipe',
      env: { ...process.env, SMC_CONFIG_PATH: configPath, PYTHONIOENCODING: 'utf-8' },
    });
  }

  backend.stdout?.on('data', d => console.log('[Backend]', d.toString().trim()));
  backend.stderr?.on('data', d => console.error('[Backend]', d.toString().trim()));
  backend.on('exit', code => { console.log('[Backend] exit', code); backend = null; });
  console.log('[App] Backend PID:', backend.pid, '| Config:', configPath);
}

async function waitForBackend(ms = 40_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch('http://127.0.0.1:8000/health')).ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 600));
  }
  return false;
}

function createMain() {
  const vars = getSavedThemeVars();

  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: vars.bg,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    mainWin.loadURL('http://localhost:5175');
  } else {
    mainWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWin.once('ready-to-show', () => {
    splash?.close();
    splash = null;
    mainWin.show();
    mainWin.focus();
  });

  mainWin.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') {
      createCrashWindow(new Error(`Renderer crashed: ${details.reason}`));
    }
  });

  mainWin.on('closed', () => { mainWin = null; });
}

function createCrashWindow(error) {
  if (crashWin) return;

  pendingCrash = {
    name: error?.name ?? 'Error',
    message: error?.message ?? 'An unexpected error occurred',
    stack: error?.stack ?? '',
    version: app.getVersion(),
    platform: process.platform,
  };

  crashWin = new BrowserWindow({
    width: 520,
    height: 400,
    resizable: false,
    center: true,
    title: 'The SMC Trading App - Error Report',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'crash-preload.cjs'),
    },
  });

  crashWin.setMenu(null);
  crashWin.loadFile(path.join(__dirname, 'crash-report.html'));
  crashWin.on('closed', () => { crashWin = null; });
}

ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
ipcMain.handle('crash:get-data', () => pendingCrash);
ipcMain.handle('crash:dismiss', () => crashWin?.close());
ipcMain.handle('crash:submit', async (_event, description) => {
  if (!pendingCrash) return { ok: false };
  return reportCrash({ ...pendingCrash, description });
});

async function initUpdater() {
  if (isDev) return;
  try {
    const { autoUpdater } = await import('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-downloaded', async info => {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready - The SMC Trading App',
        message: `Version ${info.version} downloaded.\nRestart to install?`,
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      });
      if (response === 0) autoUpdater.quitAndInstall();
    });

    autoUpdater.on('error', e => console.error('[Updater]', e.message));
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.log('[Updater] Not available:', e.message);
  }
}

if (!isDev) {
  process.on('uncaughtException', error => {
    console.error('[App] Uncaught exception:', error);
    createCrashWindow(error);
  });

  process.on('unhandledRejection', reason => {
    console.error('[App] Unhandled rejection:', reason);
    const error = reason instanceof Error ? reason : new Error(String(reason));
    createCrashWindow(error);
  });
}

app.whenReady().then(async () => {
  createSplash();
  startBackend();
  const ok = await waitForBackend();
  if (!ok) console.warn('[App] Backend slow to start. Opening UI anyway.');
  createMain();
  initUpdater();
});

app.on('window-all-closed', () => {
  if (backend && !backend.killed) {
    backend.kill('SIGTERM');
    setTimeout(() => {
      try {
        if (backend && !backend.killed) backend.kill('SIGKILL');
      } catch {}
    }, 3000);
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMain();
});
