'use strict';
// 闪卡记忆管家 - preload 桥接
// 通过 contextBridge 暴露卡组/卡片/复习/数据 IPC

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  deck: {
    list: () => ipcRenderer.invoke('deck:list'),
    create: (name) => ipcRenderer.invoke('deck:create', name),
    rename: (deckId, name) => ipcRenderer.invoke('deck:rename', deckId, name),
    remove: (deckId) => ipcRenderer.invoke('deck:delete', deckId)
  },
  card: {
    list: (deckId) => ipcRenderer.invoke('card:list', deckId),
    add: (deckId, fields) => ipcRenderer.invoke('card:add', deckId, fields),
    update: (deckId, cardId, fields) => ipcRenderer.invoke('card:update', deckId, cardId, fields),
    remove: (deckId, cardId) => ipcRenderer.invoke('card:delete', deckId, cardId)
  },
  review: {
    queue: (deckId, opts) => ipcRenderer.invoke('review:queue', deckId, opts),
    grade: (deckId, cardId, q) => ipcRenderer.invoke('review:grade', deckId, cardId, q),
    stats: (deckId) => ipcRenderer.invoke('review:stats', deckId)
  },
  data: {
    exportFile: () => ipcRenderer.invoke('data:exportFile'),
    importFile: () => ipcRenderer.invoke('data:importFile')
  }
});
