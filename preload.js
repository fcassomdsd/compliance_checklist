const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkDefaultPath: () => ipcRenderer.invoke('check-default-path'),
  createPath: (filePath) => ipcRenderer.invoke('create-path', filePath),
  loadChecklist: (specialty) => ipcRenderer.invoke('load-checklist', specialty),
  loadSession: (specialty) => ipcRenderer.invoke('load-session', specialty),
  readEvidence: () => ipcRenderer.invoke('read-evidence'),
  saveSession: (session) => ipcRenderer.invoke('save-session', session),
  saveEvidence: (fileObj) => {
    if (typeof fileObj.name !== 'string' || fileObj.name.includes('..')) {
      throw new Error('Invalid file name');
    }
    return ipcRenderer.invoke('save-evidence', fileObj);
  },
  saveFile: (bufferArray, ruta, fileName) => {
    if (typeof fileName !== 'string' || fileName.includes('..') || typeof ruta !== 'string' || ruta.includes('..')) {
      throw new Error('Invalid file name or path');
    }
    return ipcRenderer.invoke('save-file', bufferArray, ruta, fileName);
  },
  setSavePath: (specialty) => ipcRenderer.invoke('set-save-path', specialty),
  deleteEvidence: (fileName) => {
    if (typeof fileName !== 'string' || fileName.includes('..')) {
      throw new Error('Invalid file name');
    }
    return ipcRenderer.invoke('delete-evidence', fileName);
  } 
});