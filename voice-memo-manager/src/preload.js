// preload.js - 安全的 IPC 桥接层
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveRecording: (data) => ipcRenderer.invoke('recording:save', data),
  updateDuration: (data) => ipcRenderer.invoke('recording:updateDuration', data),
  list: () => ipcRenderer.invoke('recording:list'),
  read: (id) => ipcRenderer.invoke('recording:read', id),
  rename: (data) => ipcRenderer.invoke('recording:rename', data),
  delete: (id) => ipcRenderer.invoke('recording:delete', id),
  reveal: (id) => ipcRenderer.invoke('recording:reveal', id),
  openDir: () => ipcRenderer.invoke('recording:openDir'),
  isCaptureMode: process.env.MIMO_CAPTURE === '1'
});
