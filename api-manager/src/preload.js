'use strict';

// API管家 · preload 安全桥接

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 存储
  storeAll: () => ipcRenderer.invoke('store:all'),
  collectionAdd: (name) => ipcRenderer.invoke('collection:add', name),
  collectionRename: (id, name) => ipcRenderer.invoke('collection:rename', id, name),
  collectionDelete: (id) => ipcRenderer.invoke('collection:delete', id),
  folderAdd: (colId, name) => ipcRenderer.invoke('folder:add', colId, name),
  itemAdd: (colId, parentId, item) => ipcRenderer.invoke('item:add', colId, parentId, item),
  itemUpdate: (colId, itemId, patch) => ipcRenderer.invoke('item:update', colId, itemId, patch),
  itemDelete: (colId, itemId) => ipcRenderer.invoke('item:delete', colId, itemId),
  // 历史
  historyAdd: (entry) => ipcRenderer.invoke('history:add', entry),
  historyClear: () => ipcRenderer.invoke('history:clear'),
  // 环境
  envGet: () => ipcRenderer.invoke('env:get'),
  envSetActive: (envId) => ipcRenderer.invoke('env:setActive', envId),
  envSave: (env) => ipcRenderer.invoke('env:save', env),
  envDelete: (envId) => ipcRenderer.invoke('env:delete', envId),
  envActiveVars: () => ipcRenderer.invoke('env:activeVars'),
  // 请求
  requestSend: (reqDef) => ipcRenderer.invoke('request:send', reqDef),
  // 通用
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  appInfo: () => ipcRenderer.invoke('app:info'),
  onShowAbout: (cb) => ipcRenderer.on('show-about', () => cb()),
  // 窗口
  winMinimize: () => ipcRenderer.send('window:minimize'),
  winToggleMaximize: () => ipcRenderer.send('window:maximize'),
  winClose: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (cb) => ipcRenderer.on('window:maximize', (_, v) => cb(v))
});
