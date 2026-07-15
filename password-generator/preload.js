// preload.js - 安全桥接渲染进程与主进程
const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('pg', {
  generate: (opts) => ipcRenderer.invoke('pg:generate', opts),
  passphrase: (opts) => ipcRenderer.invoke('pg:passphrase', opts),
  evaluate: (pwd) => ipcRenderer.invoke('pg:evaluate', pwd),
  batch: (opts) => ipcRenderer.invoke('pg:batch', opts),
  evaluateBatch: (pwds) => ipcRenderer.invoke('pg:evaluate-batch', pwds),
  copy: (text) => ipcRenderer.invoke('pg:copy', text),
  openExternal: (url) => shell.openExternal(url)
});
