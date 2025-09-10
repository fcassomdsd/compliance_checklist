const { app, ipcMain } = require('electron');
const path = require('path');
const { loadChecklist } = require('./utils/checklist');
const { loadSession, saveSession } = require('./utils/session');
const { saveEvidenceFile, deleteFile, readDir, safeJoin, safePath, fileExists, ensureDir } = require('./utils/fileOps');


let defaultSavePath = safeJoin(app.getPath('documents'), 'Current_inspection');
let currentSavePath = defaultSavePath;

ipcMain.handle('check-default-path', async () => {
  try {
    return await fileExists(defaultSavePath);
  } catch (err) {
    throw err;
  }
});

ipcMain.handle('create-default-path', () => {
    try {
    ensureDir(defaultSavePath);
  } catch (err) {
    throw err;
  }
  
});

ipcMain.handle('read-evidence', () => {
  return readDir(safePath(currentSavePath));
});

ipcMain.handle('set-save-path', (event, specialty) => {
  currentSavePath = safeJoin(defaultSavePath, path.join(specialty, "Evidence"));
  return currentSavePath;
});

ipcMain.handle('load-checklist', async (event, specialty) => {
  try {
    const filePath = safeJoin(defaultSavePath, path.join(specialty, 'checklist.json'));
    return await loadChecklist(filePath);
  } catch (err) {
    throw err;
  }
});

ipcMain.handle('load-session', async (event, specialty) => {
  try {
    const filePath = safeJoin(defaultSavePath, path.join(specialty, 'session.json'));
    return await loadSession(filePath);
  } catch(err) {
     throw err;
  }
});

ipcMain.handle('save-session', (event, session) => {
  try {  
    const filePath = safeJoin(path.dirname(currentSavePath), 'session.json');
    saveSession(filePath, session);
  } catch (error) {
     throw error;
  }
  
});

ipcMain.handle('save-evidence', async (event, fileObj) => {
   
  try {

    const newFileObj =  {
       "name" : fileObj.name,
       "size" : fileObj.size,
       "buffer" : Buffer.from(fileObj.bufferArray)
    }
    const filePath = await saveEvidenceFile(safePath(currentSavePath), newFileObj);
    return filePath;
  } catch (error) {
    console.log("Handle 'save-evidence' failed" + error);
    throw error;
  }
});

ipcMain.handle('save-file', async (event, bufferArray, ruta, fileName) => {
   try {
    const toFilePath = (ruta ? safeJoin(defaultSavePath, ruta, fileName) : safeJoin(defaultSavePath, fileName));
    console.log(toFilePath);
    return saveEvidenceFile(Buffer.from(bufferArray), toFilePath);
  } catch (error) {
    console.log("Could not save evidence file " + fileName);
    throw error;
  }
});

ipcMain.handle('delete-evidence', async (event, fileName) => {
  const ruta = safeJoin(currentSavePath, fileName);
  return deleteFile(ruta);
});

module.exports = { ipcMain };