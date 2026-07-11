// 便签管家 - 预加载脚本
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notesAPI', {
  load: () => ipcRenderer.invoke('notes:load'),
  save: (notes, trash) => ipcRenderer.invoke('notes:save', notes, trash),
  exportNotes: (notes) => ipcRenderer.invoke('notes:export', notes),
  importNotes: () => ipcRenderer.invoke('notes:import'),
  onAction: (callback) => ipcRenderer.on('action', (event, action) => callback(action)),
  // 回收站
  restoreFromTrash: (id) => ipcRenderer.invoke('trash:restore', id),
  deleteFromTrash: (id) => ipcRenderer.invoke('trash:delete', id),
  emptyTrash: () => ipcRenderer.invoke('trash:empty')
});
