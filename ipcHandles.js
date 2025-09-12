const { app, ipcMain } = require('electron');
const path = require('path');
const { fileExists, safeJoin, safePath, ensureDir, listDir, readFile, saveFile, deleteFile, getFileStats } = require('./utils/fileOps');
const logger = require('./utils/wlogger');

const defaultSavePath = safeJoin(app.getPath('documents'), 'Current_inspection');

function makePath(fileDir, pathArray = []) {
  const dirPath = (fileDir === null ? defaultSavePath : filePath);
  if (pathArray.length == 0) {
     return(dirPath);
  }
  else { 
    return safeJoin(dirPath, pathArray.reduce( (prev,x) => path.join(prev, x)));
  }
}

/**
  filePath : the directory or file to check; if null, then fallback to defaultSavePath
  pathLegs : any additional components of the path, existing under the previous filePath
  
*/
ipcMain.handle('check-path', async (event, filePath, pathLegs) => {
  try {
    const toFilePath = makePath(filePath, pathLegs);
    return await fileExists(toFilePath);
  } catch (err) {
    logger.error("check-path: could not assess presence of file " + toFilePath);
    throw err;
  }
});

ipcMain.handle('get-path', async (event, filePath, pathLegs) => {
  try {
    return makePath(filePath, pathLegs);
  } catch (err) {
    logger.error("create-dir: could not create directory " + makePath(filePath, fileLegs));
    throw err;
  }
});

ipcMain.handle('get-stats', async (event, filePath, pathLegs) => {
  try {
    const fileStats = await getFileStats(makePath(filePath, pathLegs));
    return fileStats;
  } catch (err) {
    logger.error("get-stats: could not stat file " + makePath(filePath, fileLegs));
    throw err;
  }
});

ipcMain.handle('create-dir', async (event, filePath, pathLegs) => {
  try {
      await ensureDir(makePath(filePath, pathLegs));
  } catch (err) {
    logger.error("create-dir: could not create directory " + makePath(filePath, fileLegs));
    throw err;
  }
});

ipcMain.handle('list-path', async (event, filePath, pathLegs) => {
  try {
    const dirList = await listDir(makePath(filePath, pathLegs));
    return dirList;
  } catch (err) {
    logger.error("list-path: could not read directory " + makePath(filePath, pathLegs));
    throw err;
  }
  
});

ipcMain.handle('read-file', async (event, filePath, pathLegs) => {
  try {
    const fileContent = await readFile(makePath(filePath, pathLegs));
    return fileContent;
  } catch (err) {
    logger.error('read-file: could not read file ' + filePath);
    throw err;
  }
  
});

ipcMain.handle('save-file', async (event, data, filePath, pathLegs) => {
   try {
    const toFilePath = makePath(filePath, pathLegs);
    console.log(toFilePath);
    const dataToSave = (typeof data === "string" ? data : Buffer.from(data));
    const saved = await saveFile(toFilePath, data);
    return saved;
  } catch (error) {
    logger.error("save-file: Could not save file " + toFilePath);
    throw error;
  }
});

ipcMain.handle('delete-file', async (event, filePath, pathLegs) => {
  try {
    const toFilePath = makePath(filePath, pathLegs);
    const deleted = await deleteFile(toFilePath);
    return deleted;
  } catch (err) {
    logger.error("delete-file: Could not delete file " + toFilePath);
    throw err;
  }
});

module.exports = { ipcMain };