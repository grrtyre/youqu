// 便签管家 - 预加载脚本
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notesAPI', {
  load: () => ipcRenderer.invoke('notes:load'),
  save: (notes) => ipcRenderer.invoke('notes:save', notes),
  exportNotes: (notes) => ipcRenderer.invoke('notes:export', notes),
  importNotes: () => ipcRenderer.invoke('notes:import'),
  onAction: (callback) => ipcRenderer.on('action', (event, action) => callback(action))
});
