const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkFile: (fileName, ruta) => ipcRenderer.invoke('check-file', fileName, ruta),  
  chooseSavePath: () => ipcRenderer.invoke('choose-save-path'),
  getFullPath: (fileName) => ipcRenderer.invoke('get-full-path', fileName),
  loadChecklist: (specialty) => ipcRenderer.invoke('load-checklist', specialty),
  loadSession: (specialty) => ipcRenderer.invoke('load-session', specialty),
  readEvidence: () => ipcRenderer.invoke('read-evidence'),
  saveSession: (session) => ipcRenderer.invoke('save-session', session),
  saveEvidence: (bufferArray, fileName) => ipcRenderer.invoke('save-evidence', bufferArray, fileName),
  saveFile: (bufferArray, ruta, fileName) => ipcRenderer.invoke('save-file', bufferArray, ruta, fileName),
  setSavePath: (specialty) => ipcRenderer.invoke('set-save-path', specialty),
  validateEvidence: (archivo) => ipcRenderer.invoke('validate-evidence', archivo),
  deleteEvidence: (fileName) => ipcRenderer.invoke('delete-evidence', fileName)
});