// preload.js - 预加载脚本（安全桥接）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('subAPI', {
  getAll: () => ipcRenderer.invoke('subscriptions:getAll'),
  save: (data) => ipcRenderer.invoke('subscriptions:save', data),
  getStats: () => ipcRenderer.invoke('subscriptions:stats'),
  notify: (title, body) => ipcRenderer.invoke('notifications:show', title, body),
  exportJSON: () => ipcRenderer.invoke('subscriptions:exportJSON'),
  exportCSV: () => ipcRenderer.invoke('subscriptions:exportCSV'),
  importData: () => ipcRenderer.invoke('subscriptions:import')
});
