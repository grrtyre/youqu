// 预加载脚本：安全暴露 API 给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diaryAPI', {
  read: (dateStr) => ipcRenderer.invoke('diary:read', dateStr),
  save: (payload) => ipcRenderer.invoke('diary:save', payload),
  list: () => ipcRenderer.invoke('diary:list'),
  delete: (dateStr) => ipcRenderer.invoke('diary:delete', dateStr),
  export: (dateStr) => ipcRenderer.invoke('diary:export', dateStr)
});
