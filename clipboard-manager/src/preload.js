// preload.js — 安全的 IPC 桥，暴露受限 API 给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getItems: () => ipcRenderer.invoke('get-items'),
  searchItems: (q) => ipcRenderer.invoke('search-items', q),
  copyItem: (id) => ipcRenderer.invoke('copy-item', id),
  toggleFavorite: (id) => ipcRenderer.invoke('toggle-favorite', id),
  togglePin: (id) => ipcRenderer.invoke('toggle-pin', id),
  deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
  clearAll: () => ipcRenderer.invoke('clear-all'),
  pasteToFront: () => ipcRenderer.invoke('paste-to-front'),
  onHistoryUpdated: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('history-updated', handler);
    return () => ipcRenderer.removeListener('history-updated', handler);
  }
});
