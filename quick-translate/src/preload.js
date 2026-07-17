// 预加载脚本：在隔离上下文中向渲染进程暴露受限 API

'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qtAPI', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (store) => ipcRenderer.invoke('store:save', store),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  setWatch: (on) => ipcRenderer.invoke('watch:set', on),
  onTranslateClipboard: (cb) => ipcRenderer.on('translate-clipboard', (e, text) => cb(text)),
  onWindowShown: (cb) => ipcRenderer.on('window-shown', () => cb()),
  onWindowHidden: (cb) => ipcRenderer.on('window-hidden', () => cb())
});
