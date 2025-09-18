import path from 'node:path';
import url from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron/main';
import { setupIpcHandles } from './ipcHandles.js';


const metaurl = import.meta.URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: '/home/fernando/git/compliance_app/preload.js'
    },
  });
  win.loadFile('dist/index.html');
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandles(ipcMain);
});
