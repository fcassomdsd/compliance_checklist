import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, systemPreferences } from 'electron/main';
import { setupIpcHandles } from './ipcHandles.js';

const isMac = os.platform() === "darwin";
const isWindows = os.platform() === "win32";
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
      preload: join(dirName, 'preload.js')
    },
  });
  win.loadFile('dist/index.html');
}

async function requestCamera() {
  const status = await systemPreferences.getMediaAccessStatus('camera');
  if (!status) throw new Error('Camera access denied');
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandles(ipcMain);

});
if (!isLinux) {
  await requestCamera();
}