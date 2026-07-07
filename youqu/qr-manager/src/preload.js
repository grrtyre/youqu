// src/preload.js — 预加载脚本，通过 contextBridge 安全暴露 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 生成
  generate: (text, opts) => ipcRenderer.invoke('qr-generate', { text, opts }),
  generateSVG: (text, opts) => ipcRenderer.invoke('qr-generate-svg', { text, opts }),
  // 识别
  decodeFile: (p) => ipcRenderer.invoke('qr-decode-file', p),
  decodeNative: (source) => ipcRenderer.invoke('qr-decode-native', { source }),
  decodeScreen: () => ipcRenderer.invoke('qr-decode-screen'),
  pickImage: () => ipcRenderer.invoke('qr-pick-image'),
  // 保存
  savePNG: (dataURL, defaultName) => ipcRenderer.invoke('qr-save-png', { dataURL, defaultName }),
  saveSVG: (svg, defaultName) => ipcRenderer.invoke('qr-save-svg', { svg, defaultName }),
  // 历史
  historyGet: () => ipcRenderer.invoke('history-get'),
  historyAdd: (item) => ipcRenderer.invoke('history-add', item),
  historyClear: () => ipcRenderer.invoke('history-clear'),
  // 收藏
  favGet: () => ipcRenderer.invoke('fav-get'),
  favAdd: (item) => ipcRenderer.invoke('fav-add', item),
  favRemove: (id) => ipcRenderer.invoke('fav-remove', id),
  favClear: () => ipcRenderer.invoke('fav-clear'),
  // 窗口
  winMin: () => ipcRenderer.invoke('window-min'),
  winClose: () => ipcRenderer.invoke('window-close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // 剪贴板
  copyImage: (dataURL) => ipcRenderer.invoke('clipboard-write-image', dataURL),
  copyText: (text) => ipcRenderer.invoke('clipboard-write-text', text)
});
