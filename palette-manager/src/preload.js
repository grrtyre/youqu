// preload.js
// 安全地暴露受限 API 给渲染进程

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('paletteAPI', {
  // 复制文本到系统剪贴板
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  // 读取系统剪贴板文本
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  // 监听托盘菜单事件
  onMenuRandom: (callback) => ipcRenderer.on('menu-random', () => callback()),
  onMenuImportClipboard: (callback) => ipcRenderer.on('menu-import-clipboard', () => callback()),
});
