'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('mm', {
  // 文档管理
  listDocs: () => ipcRenderer.invoke('doc:list'),
  loadDoc: (id) => ipcRenderer.invoke('doc:load', id),
  saveDoc: (data) => ipcRenderer.invoke('doc:save', data),
  deleteDoc: (id) => ipcRenderer.invoke('doc:delete', id),
  exportDoc: (payload) => ipcRenderer.invoke('doc:export', payload),
  importDoc: () => ipcRenderer.invoke('doc:import'),
  // 剪贴板
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  // 应用信息
  appInfo: () => ipcRenderer.invoke('app:info'),
  // 关于弹窗
  onShowAbout: (cb) => ipcRenderer.on('show-about', () => cb()),
  // 窗口控制
  winMinimize: () => ipcRenderer.send('window:minimize'),
  winToggleMaximize: () => ipcRenderer.send('window:maximize'),
  winClose: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (cb) => ipcRenderer.on('window:maximize', (_, v) => cb(v))
});
