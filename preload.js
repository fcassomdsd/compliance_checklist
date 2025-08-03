const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chooseSavePath: () => ipcRenderer.invoke('choose-save-path'),
  loadChecklist: (specialty) => ipcRenderer.invoke('load-checklist', specialty),
  loadSession: (specialty) => ipcRenderer.invoke('load-session', specialty),
  saveSession: (session) => ipcRenderer.invoke('save-session', session),
  saveEvidence: (bufferArray, fileName) => ipcRenderer.invoke('save-evidence', bufferArray, fileName),
  setSavePath: (specialty) => ipcRenderer.invoke('set-save-path', specialty),
  validateEvidence: (archivo) => ipcRenderer.invoke('validate-evidence', archivo),
  deleteEvidence: (fileName) => ipcRenderer.invoke('delete-evidence', fileName)
});