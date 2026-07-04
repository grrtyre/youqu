// 拾色管家 - 预加载脚本
// 通过 contextBridge 暴露安全的 API 给渲染进程

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  store: {
    get: () => ipcRenderer.invoke('store:get'),
    save: (data) => ipcRenderer.invoke('store:save', data),
  },
  history: {
    add: (hex, rgb) => ipcRenderer.invoke('history:add', hex, rgb),
  },
  palette: {
    addColor: (paletteId, hex) => ipcRenderer.invoke('palette:addColor', paletteId, hex),
    removeColor: (paletteId, hex) => ipcRenderer.invoke('palette:removeColor', paletteId, hex),
    create: (name) => ipcRenderer.invoke('palette:create', name),
    delete: (id) => ipcRenderer.invoke('palette:delete', id),
    rename: (id, name) => ipcRenderer.invoke('palette:rename', id, name),
  },
  clipboard: {
    write: (text) => ipcRenderer.invoke('clipboard:write', text),
  },
  picker: {
    start: () => ipcRenderer.invoke('picker:start'),
    sample: (x, y) => ipcRenderer.invoke('picker:sample', x, y),
    done: (color) => ipcRenderer.invoke('picker:done', color),
    cancel: () => ipcRenderer.invoke('picker:cancel'),
    onResult: (cb) => {
      const handler = (e, color) => cb(color);
      ipcRenderer.on('picker:result', handler);
      return () => ipcRenderer.removeListener('picker:result', handler);
    },
    onReady: (cb) => {
      const handler = (e, info) => cb(info);
      ipcRenderer.on('picker:ready', handler);
      return () => ipcRenderer.removeListener('picker:ready', handler);
    },
  },
});
