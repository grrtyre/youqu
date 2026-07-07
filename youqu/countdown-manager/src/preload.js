// preload.js — 安全的 IPC 桥
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadEvents: () => ipcRenderer.invoke('load-events'),
  saveEvents: (events) => ipcRenderer.invoke('save-events', events),
  addEvent: (raw) => ipcRenderer.invoke('add-event', raw),
  updateEvent: (id, patch) => ipcRenderer.invoke('update-event', id, patch),
  deleteEvent: (id) => ipcRenderer.invoke('delete-event', id),
  exportEvents: () => ipcRenderer.invoke('export-events'),
  importEvents: () => ipcRenderer.invoke('import-events'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getAfdianUrl: () => ipcRenderer.invoke('get-afdian-url'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  quitApp: () => ipcRenderer.invoke('quit-app')
});
