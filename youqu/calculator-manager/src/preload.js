// 科学计算器管家 · 预加载脚本
// 通过 contextBridge 暴露受限 API 给渲染进程

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('calcAPI', {
  evaluate: (expr) => ipcRenderer.invoke('calc:evaluate', { expr }),
  assign: (expr) => ipcRenderer.invoke('calc:assign', { expr }),
  convertBase: (num) => ipcRenderer.invoke('calc:convertBase', { num }),

  historyList: () => ipcRenderer.invoke('history:list'),
  historyAppend: (item) => ipcRenderer.invoke('history:append', item),
  historyClear: () => ipcRenderer.invoke('history:clear'),
  historyDelete: (id) => ipcRenderer.invoke('history:delete', { id }),

  varsList: () => ipcRenderer.invoke('vars:list'),
  varsDelete: (name) => ipcRenderer.invoke('vars:delete', { name }),
  varsClear: () => ipcRenderer.invoke('vars:clear'),

  storagePath: () => ipcRenderer.invoke('storage:path'),
});
