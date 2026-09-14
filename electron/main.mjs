import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, systemPreferences,  } from 'electron/main';
import * as fs from 'node:fs/promises';
import { setupIpcHandles } from './ipc/ipcHandles.js';
import { bundledAppConfigPath, writableAppConfigPath } from './utils/appConfig.js';

const isMac = os.platform() === "darwin";
const isLinux = os.platform() === "linux";

const fileName = fileURLToPath(import.meta.url);
const dirName = dirname(fileName);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(dirName, 'preload.cjs')
    },
  });
  // Use absolute path for packaged app compatibility
  // Go up one level from electron/ to root, then into dist/
  const indexPath = join(dirName, '..', 'dist', 'index.html');
  win.loadFile(indexPath);
}

async function requestCamera() {
  const status = await systemPreferences.getMediaAccessStatus('camera');
  if (!status) throw new Error('Camera access denied');
}

async function initializeAppConfig() {
  const writablePath = writableAppConfigPath();

  try {
    await fs.access(writablePath);
    return;
  } catch {
    // Not present yet: seed it below.
  }

  try {
    await fs.mkdir(dirname(writablePath), { recursive: true });

    // Prefer the config shipped with the app (extraResources), so a packaged
    // build keeps its real API hosts instead of falling back to localhost.
    try {
      await fs.copyFile(bundledAppConfigPath(), writablePath);
      return;
    } catch {
      // No bundled copy available: write a minimal default.
    }

    const defaultConfig = {
      app: { name: 'Compliance Checklist', version: '1.0.0' },
      api: {
        host: 'http://localhost:1880',
        importHost: 'http://localhost:1880',
        uploadHost: 'http://localhost:8000',
        importCanonicalDelay: 3000,
        importCanonicalRetries: 3,
        serviceStatusTimeoutMs: 2500,
      },
      fallback: { specialties: [], locations: [] },
    };

    await fs.writeFile(writablePath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Warning: Could not initialize app.config.json:', err.message);
  }
}

app.whenReady().then(async () => {
  // The renderer reads the config on mount, so it must exist before the window
  // is created (this used to run after createWindow and race the first render).
  await initializeAppConfig();
  createWindow();
  setupIpcHandles(ipcMain);
  // Request camera access after app is ready (but not on Linux)
  if (!isLinux) {
    try {
      await requestCamera();
    } catch (err) {
      console.warn('Camera access warning:', err.message);
    }
  }
});

// Quit app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

// Re-create window when app is activated (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
