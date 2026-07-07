// 预加载脚本 - 通过 contextBridge 暴露安全的 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('habitAPI', {
  list: () => ipcRenderer.invoke('habit:list'),
  get: (id) => ipcRenderer.invoke('habit:get', id),
  create: (data) => ipcRenderer.invoke('habit:create', data),
  update: (id, patch) => ipcRenderer.invoke('habit:update', id, patch),
  remove: (id) => ipcRenderer.invoke('habit:remove', id),
  toggle: (id, dateKey) => ipcRenderer.invoke('habit:toggle', id, dateKey),
  exportJSON: () => ipcRenderer.invoke('habit:export'),
  importJSON: (json) => ipcRenderer.invoke('habit:import', json),
  saveExport: () => ipcRenderer.invoke('dialog:saveExport'),
  pickImport: () => ipcRenderer.invoke('dialog:pickImport'),
});
