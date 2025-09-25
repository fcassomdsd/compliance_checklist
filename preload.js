const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkPath: (filePath, ...pathLegs) => ipcRenderer.invoke('check-path', filePath, pathLegs),
  createDir: (filePath, ...pathLegs) => ipcRenderer.invoke('create-dir', filePath, pathLegs),
  deleteFile: (filePath, ...pathLegs) => ipcRenderer.invoke('delete-file', filePath, pathLegs),
  getPath: (filePath, ...pathLegs) => ipcRenderer.invoke('get-path', filePath, pathLegs),
  getStats: (filePath, ...pathLegs) => ipcRenderer.invoke('get-stats', filePath, pathLegs),
  listPath: (filePath, ...pathLegs) => ipcRenderer.invoke('list-path', filePath, pathLegs),
  readFile: (filePath, ...pathLegs) => ipcRenderer.invoke('read-file', filePath, pathLegs),
  saveFile: (fileData, filePath, ...pathLegs) => ipcRenderer.invoke('save-file', fileData, filePath, pathLegs)
});
