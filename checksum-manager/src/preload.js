'use strict';
// 校验管家 - preload
// 通过 contextBridge 暴露受限 API 给渲染进程

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('checksumAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  statFile: (p) => ipcRenderer.invoke('file:stat', p),
  computeHash: (p) => ipcRenderer.invoke('hash:compute', p),
  loadHistory: () => ipcRenderer.invoke('history:load'),
  saveHistory: (list) => ipcRenderer.invoke('history:save', list),
  onProgress: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('hash:progress', handler);
    return () => ipcRenderer.removeListener('hash:progress', handler);
  }
});
