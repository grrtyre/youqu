// 抽签转盘管家 - 预加载脚本
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  state: {
    get: () => ipcRenderer.invoke('state:get')
  },
  list: {
    create: (name) => ipcRenderer.invoke('list:create', name),
    setActive: (id) => ipcRenderer.invoke('list:setActive', id),
    rename: (id, name) => ipcRenderer.invoke('list:rename', id, name),
    delete: (id) => ipcRenderer.invoke('list:delete', id)
  },
  entry: {
    add: (listId, text, weight) => ipcRenderer.invoke('entry:add', listId, text, weight),
    addBulk: (listId, text) => ipcRenderer.invoke('entry:addBulk', listId, text),
    update: (listId, entryId, patch) => ipcRenderer.invoke('entry:update', listId, entryId, patch),
    delete: (listId, entryId) => ipcRenderer.invoke('entry:delete', listId, entryId),
    clear: (listId) => ipcRenderer.invoke('entry:clear', listId),
    removeWinner: (listId, entryId) => ipcRenderer.invoke('entry:removeWinner', listId, entryId)
  },
  wheel: {
    draw: (listId) => ipcRenderer.invoke('wheel:draw', listId)
  },
  history: {
    record: (listId, winnerText, mode) => ipcRenderer.invoke('history:record', listId, winnerText, mode),
    clear: () => ipcRenderer.invoke('history:clear'),
    delete: (id) => ipcRenderer.invoke('history:delete', id)
  },
  settings: {
    update: (patch) => ipcRenderer.invoke('settings:update', patch)
  }
});
