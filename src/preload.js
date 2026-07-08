// Preload: 安全桥接主进程 API
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diskAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
  getDiskInfo: (fp) => ipcRenderer.invoke('disk:get-info', fp),
  startScan: (fp) => ipcRenderer.invoke('scan:start', fp),
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  showInFolder: (fp) => ipcRenderer.invoke('shell:show-in-folder', fp),
  trashItem: (fp) => ipcRenderer.invoke('shell:trash', fp),
  onScanProgress: (cb) => {
    const handler = (e, data) => cb(data);
    ipcRenderer.on('scan:progress', handler);
    return () => ipcRenderer.removeListener('scan:progress', handler);
  },
  onInitPath: (cb) => {
    const handler = (e, data) => cb(data);
    ipcRenderer.on('app:init-path', handler);
  },
});
