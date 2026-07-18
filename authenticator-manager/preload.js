// authenticator-manager 预加载脚本
// 通过 contextBridge 暴露最小化 API 给渲染进程
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    add: (a) => ipcRenderer.invoke('accounts:add', a),
    update: (id, patch) => ipcRenderer.invoke('accounts:update', id, patch),
    delete: (id) => ipcRenderer.invoke('accounts:delete', id),
    reorder: (ids) => ipcRenderer.invoke('accounts:reorder', ids)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: (path) => ipcRenderer.invoke('backup:import', path)
  },
  window: {
    hide: () => ipcRenderer.send('window:hide'),
    minimize: () => ipcRenderer.send('window:minimize'),
    quit: () => ipcRenderer.send('window:quit')
  }
});
