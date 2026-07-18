// preload.js - 安全的 IPC 桥接
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  search: (query) => ipcRenderer.invoke('search-apps', query),
  launch: (appPath) => ipcRenderer.invoke('launch-app', appPath),
  hide: () => ipcRenderer.invoke('hide-window'),
  getAppCount: () => ipcRenderer.invoke('get-app-count'),
  getIndexingState: () => ipcRenderer.invoke('get-indexing-state'),
  onWindowShown: (cb) => {
    ipcRenderer.on('window-shown', () => cb());
  },
  onIndexingState: (cb) => {
    // 索引状态变化通知（用于状态栏显示"正在索引..."）
    ipcRenderer.on('indexing-state', (event, state) => cb(state));
  }
});
