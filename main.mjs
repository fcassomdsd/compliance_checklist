import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron/main';
import { setupIpcHandles } from './ipcHandles.js';


const fileName = fileURLToPath(import.meta.url);
const dirName = dirname(fileName);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(dirName, 'preload.js')
    },
  });
  win.loadFile('dist/index.html');
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandles(ipcMain);
});
