// src/preload.js - 上下文隔离桥接

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('envAPI', {
  read: (scope) => ipcRenderer.invoke('env:read', scope),
  set: (args) => ipcRenderer.invoke('env:set', args),
  delete: (args) => ipcRenderer.invoke('env:delete', args),
  isAdmin: () => ipcRenderer.invoke('env:isAdmin'),
  relaunchAsAdmin: () => ipcRenderer.invoke('env:relaunchAsAdmin'),
  exportBackup: (args) => ipcRenderer.invoke('env:exportBackup', args),
  importBackup: () => ipcRenderer.invoke('env:importBackup'),
  copy: (text) => ipcRenderer.invoke('env:copy', text),
  openExternal: (url) => ipcRenderer.invoke('env:openExternal', url)
});
