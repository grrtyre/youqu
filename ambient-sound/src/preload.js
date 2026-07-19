// preload.js - 安全的 Electron 预加载脚本
// 通过 contextBridge 暴露最小化 IPC 接口给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ambient', {
  // 隐藏窗口到系统托盘（Esc 快捷键调用）
  hideWindow: () => ipcRenderer.send('window-hide'),
});
