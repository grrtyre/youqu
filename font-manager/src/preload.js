// src/preload.js — 上下文隔离桥接
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fontMgr', {
  listFonts: () => ipcRenderer.invoke('list-fonts'),
  getTags: () => ipcRenderer.invoke('get-tags'),
  setTags: (t) => ipcRenderer.invoke('set-tags', t),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  setFavorites: (l) => ipcRenderer.invoke('set-favorites', l),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (s) => ipcRenderer.invoke('set-settings', s)
});
