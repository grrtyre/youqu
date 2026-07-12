// src/preload.js — 预加载桥接
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('emojiAPI', {
  getCategories: () => ipcRenderer.invoke('emoji-get-categories'),
  getAll: () => ipcRenderer.invoke('emoji-get-all'),
  search: (kw) => ipcRenderer.invoke('emoji-search', kw),
  copy: (char) => ipcRenderer.invoke('emoji-copy', char),
  getFavorites: () => ipcRenderer.invoke('emoji-get-favorites'),
  toggleFavorite: (item) => ipcRenderer.invoke('emoji-toggle-favorite', item),
  isFavorite: (char) => ipcRenderer.invoke('emoji-is-favorite', char),
  getHistory: () => ipcRenderer.invoke('emoji-get-history'),
  addHistory: (item) => ipcRenderer.invoke('emoji-add-history', item),
  clearHistory: () => ipcRenderer.invoke('emoji-clear-history'),
  // 窗口控制
  winMin: () => ipcRenderer.invoke('window-min'),
  winMax: () => ipcRenderer.invoke('window-max'),
  winClose: () => ipcRenderer.invoke('window-close')
});
