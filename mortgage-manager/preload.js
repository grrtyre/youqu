// preload.js - 安全的上下文桥接
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  exportCsv: (content, defaultName) => ipcRenderer.invoke('export-csv', content, defaultName),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
