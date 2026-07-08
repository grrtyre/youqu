// 预加载脚本 - 通过 contextBridge 暴露安全的 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snippetAPI', {
  list: () => ipcRenderer.invoke('snippet:list'),
  get: (id) => ipcRenderer.invoke('snippet:get', id),
  create: (data) => ipcRenderer.invoke('snippet:create', data),
  update: (id, patch) => ipcRenderer.invoke('snippet:update', id, patch),
  remove: (id) => ipcRenderer.invoke('snippet:remove', id),
  toggleFav: (id) => ipcRenderer.invoke('snippet:toggleFav', id),
  togglePin: (id) => ipcRenderer.invoke('snippet:togglePin', id),
  search: (q) => ipcRenderer.invoke('snippet:search', q),
  languages: () => ipcRenderer.invoke('snippet:languages'),
  tags: () => ipcRenderer.invoke('snippet:tags'),
  favorites: () => ipcRenderer.invoke('snippet:favorites'),
  count: () => ipcRenderer.invoke('snippet:count'),
  exportJSON: () => ipcRenderer.invoke('snippet:export'),
  importJSON: (json, mode) => ipcRenderer.invoke('snippet:import', json, mode),
  saveExport: () => ipcRenderer.invoke('dialog:saveExport'),
  pickImport: () => ipcRenderer.invoke('dialog:pickImport'),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  onMenuNew: (cb) => ipcRenderer.on('menu:new', cb),
});
