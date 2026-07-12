'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('cm', {
  // 文件操作
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (data) => ipcRenderer.invoke('file:save', data),
  // 最近文件
  listRecent: () => ipcRenderer.invoke('recent:list'),
  openRecent: (p) => ipcRenderer.invoke('recent:open', p),
  // 剪贴板
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  // 应用信息
  appInfo: () => ipcRenderer.invoke('app:info'),
  // 截图演示模式：设置 CM_DEMO 环境变量时为 true，自动加载示例数据
  demoMode: () => process.env.CM_DEMO === '1' || process.env.CM_DEMO === 'true',
  // 关于弹窗
  onShowAbout: (cb) => ipcRenderer.on('show-about', () => cb()),
  // 窗口控制
  winMinimize: () => ipcRenderer.send('window:minimize'),
  winToggleMaximize: () => ipcRenderer.send('window:maximize'),
  winClose: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (cb) => ipcRenderer.on('window:maximize', (_, v) => cb(v))
});
