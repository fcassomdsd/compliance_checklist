import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, systemPreferences,  } from 'electron/main';
import * as fs from 'node:fs/promises';
import { setupIpcHandles } from './ipc/ipcHandles.js';

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
  try {
    const appDir = dirname(fileURLToPath(import.meta.url));
    const configPath = join(appDir, '..', 'app.config.json');
    
    // Check if app.config.json already exists
    try {
      await fs.access(configPath);
    } catch {
      // File doesn't exist, create it with default values
      const defaultConfig = {
        "app": {
          "name": "Compliance Checklist",
          "version": "1.0.0"
        },
        "api": {
          "host": "http://localhost:1880",
          "importHost": "http://localhost:1880",
          "uploadHost": "http://localhost:8000",
          "importCanonicalDelay": 3000,
          "importCanonicalRetries": 3,
          "serviceStatusTimeoutMs": 2500
        },
        "fallback": {
          "specialties": [],
          "locations": []
        }
      };
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Warning: Could not initialize app.config.json:', err.message);
  }
}

app.whenReady().then(async () => {
  createWindow();
  await initializeAppConfig();
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
