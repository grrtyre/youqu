// preload.js - 安全的 IPC 桥接
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  search: (query) => ipcRenderer.invoke('search-apps', query),
  launch: (appPath) => ipcRenderer.invoke('launch-app', appPath),
  hide: () => ipcRenderer.invoke('hide-window'),
  getAppCount: () => ipcRenderer.invoke('get-app-count'),
  onWindowShown: (cb) => {
    ipcRenderer.on('window-shown', () => cb());
  }
});
