'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('lm', {
  // 文件操作
  openFile: () => ipcRenderer.invoke('log:open'),
  openPath: (p) => ipcRenderer.invoke('log:openPath', p),
  watch: (p) => ipcRenderer.invoke('log:watch', p),
  unwatch: (p) => ipcRenderer.invoke('log:unwatch', p),
  getRecent: () => ipcRenderer.invoke('log:recent'),
  clearRecent: () => ipcRenderer.invoke('log:clearRecent'),
  exportFile: (data) => ipcRenderer.invoke('log:export', data),
  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  // 应用信息
  appInfo: () => ipcRenderer.invoke('app:info'),
  // 文件监听事件
  onAppended: (cb) => ipcRenderer.on('file:appended', (_, v) => cb(v)),
  onRotated: (cb) => ipcRenderer.on('file:rotated', (_, v) => cb(v)),
  onRemoved: (cb) => ipcRenderer.on('file:removed', (_, v) => cb(v)),
  // 菜单事件
  onMenuOpen: (cb) => ipcRenderer.on('menu:open', () => cb()),
  onMenuSearch: (cb) => ipcRenderer.on('menu:search', () => cb()),
  // 演示自动加载
  onDemoLoad: (cb) => ipcRenderer.on('demo:load', (_, v) => cb(v)),
  // 关于弹窗
  onShowAbout: (cb) => ipcRenderer.on('show-about', () => cb()),
  // 窗口控制
  winMinimize: () => ipcRenderer.send('window:minimize'),
  winToggleMaximize: () => ipcRenderer.send('window:maximize'),
  winClose: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (cb) => ipcRenderer.on('window:maximize', (_, v) => cb(v))
});
