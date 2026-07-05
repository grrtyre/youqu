// preload.js — 安全的 IPC 桥
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  scanDirectory: (dir, opts) => ipcRenderer.invoke('scan-directory', dir, opts),
  scanCancel: () => ipcRenderer.invoke('scan-cancel'),
  revealFile: (p) => ipcRenderer.invoke('reveal-file', p),
  openFile: (p) => ipcRenderer.invoke('open-file', p),
  readImageDataUrl: (p) => ipcRenderer.invoke('read-image-dataurl', p),
  readTextPreview: (p, maxBytes) => ipcRenderer.invoke('read-text-preview', p, maxBytes),
  trashFiles: (paths) => ipcRenderer.invoke('trash-files', paths),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getAfdianUrl: () => ipcRenderer.invoke('get-afdian-url'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  onScanProgress: (cb) => {
    const handler = (e, p) => cb(p);
    ipcRenderer.on('scan-progress', handler);
    return () => ipcRenderer.removeListener('scan-progress', handler);
  },
  // demo 模式：主进程推送自动扫描结果
  onDemoResult: (cb) => {
    const handler = (e, data) => cb(data);
    ipcRenderer.on('demo-result', handler);
    return () => ipcRenderer.removeListener('demo-result', handler);
  }
});
