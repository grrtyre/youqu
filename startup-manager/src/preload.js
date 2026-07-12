'use strict';
// 启动项管家 - 预加载脚本
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  list: () => ipcRenderer.invoke('startup:list'),
  toggle: (entry, disable) => ipcRenderer.invoke('startup:toggle', entry, disable),
  delete: (entry) => ipcRenderer.invoke('startup:delete', entry),
  add: (input) => ipcRenderer.invoke('startup:add', input),
  openLocation: (entry) => ipcRenderer.invoke('startup:openLocation', entry),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
});
