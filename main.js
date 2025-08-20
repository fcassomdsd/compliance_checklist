const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { loadChecklist } = require('./utils/checklist');
const { loadSession, saveSession } = require('./utils/session');
const { saveEvidenceFile, deleteFile, validateEvidence, checkFileExists, readDir } = require('./utils/fileOps');

let defaultSavePath = path.join(app.getPath('documents'), 'Current_inspection');
let currentSavePath = defaultSavePath;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('dist/index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('check-file', (event, fileName, ruta) => {
  const checkFilePath = path.join(defaultSavePath, ruta, fileName);
  return checkFileExists(checkFilePath);
});

ipcMain.handle('read-evidence', () => {
  return readDir(currentSavePath);
});

ipcMain.handle('get-full-path', (event, fileName) => {
  return path.join(currentSavePath, fileName);
});

ipcMain.handle('set-save-path', (event, specialty) => {
  currentSavePath = path.join(defaultSavePath, specialty, "Evidence");
  return currentSavePath;
});

ipcMain.handle('choose-save-path', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths.length > 0) {
    defaultSavePath = result.filePaths[0];
  }
  return defaultSavePath;
});

ipcMain.handle('load-checklist', async (event, specialty) => {
  try {
    const contenido = (specialty.match(/^[A-Za-z0-9]+$/) ? path.join(defaultSavePath, specialty, 'checklist.json') : specialty );
    const checklist = loadChecklist(contenido);
    return checklist;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('load-session', async (event, specialty) => {
  try {
    const filePath = path.join(defaultSavePath, specialty, 'session.json');
    return loadSession(filePath);
  } catch(err) {
    return { error: err.message}
  }
});

ipcMain.handle('save-session', (event, session) => {
  const filePath = path.join(path.dirname(currentSavePath), 'session.json');
  saveSession(filePath, session);
});

ipcMain.handle('save-evidence', async (event, bufferArray, fileName) => {
  const toFilePath = path.join(currentSavePath, fileName);
  return saveEvidenceFile(Buffer.from(bufferArray), toFilePath);
});

ipcMain.handle('save-file', async (event, bufferArray, ruta, fileName) => {
  const toFilePath = (ruta ? path.join(defaultSavePath, ruta, fileName) : path.join(defaultSavePath, fileName));
  console.log(toFilePath);
  return saveEvidenceFile(Buffer.from(bufferArray), toFilePath);
});

ipcMain.handle('delete-evidence', async (event, fileName) => {
  const ruta = path.join(currentSavePath, fileName);
  return deleteFile(ruta);
});

ipcMain.handle('validate-evidence', async (event, archivo) => {
  return validateEvidence(currentSavePath, archivo);
});
