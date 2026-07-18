// Preload 桥接 - 安全暴露 API 给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectMusicFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  selectMusicFolder: () => ipcRenderer.invoke('dialog:openFolder')
});
