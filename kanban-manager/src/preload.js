// preload - 安全暴露 IPC 给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kanbanAPI', {
  readData: () => ipcRenderer.invoke('data:read'),
  writeData: (data) => ipcRenderer.invoke('data:write', data),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  onMenuExport: (cb) => ipcRenderer.on('menu:export', () => cb()),
  onMenuImport: (cb) => ipcRenderer.on('menu:import', () => cb()),
  onMenuAbout: (cb) => ipcRenderer.on('menu:about', () => cb())
});
