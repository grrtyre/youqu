'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('tm', {
  // 文件操作
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (data) => ipcRenderer.invoke('file:save', data),
  // 剪贴板
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  // 应用信息
  appInfo: () => ipcRenderer.invoke('app:info'),
  // 关于弹窗事件
  onShowAbout: (cb) => ipcRenderer.on('show-about', () => cb()),
  // 窗口控制
  winMinimize: () => ipcRenderer.send('window:minimize'),
  winToggleMaximize: () => ipcRenderer.send('window:maximize'),
  winClose: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (cb) => ipcRenderer.on('window:maximize', (_, v) => cb(v))
});
