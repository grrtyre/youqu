// 速览管家 - preload
// 暴露受限的 IPC API 给渲染进程

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  preview: {
    load: (p) => ipcRenderer.invoke('preview:load', p),
    readBinaryDataUrl: (p) => ipcRenderer.invoke('preview:read-binary-data-url', p),
    onAction: (cb) => {
      const handler1 = (_, p) => cb('preview', p);
      const handler2 = () => cb('show-welcome', null);
      ipcRenderer.on('action:preview', handler1);
      ipcRenderer.on('action:show-welcome', handler2);
      return () => {
        ipcRenderer.removeListener('action:preview', handler1);
        ipcRenderer.removeListener('action:show-welcome', handler2);
      };
    },
  },
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    clear: () => ipcRenderer.invoke('history:clear'),
  },
  shell: {
    open: (p) => ipcRenderer.invoke('shell:open', p),
    showInFolder: (p) => ipcRenderer.invoke('shell:show-in-folder', p),
  },
  clipboard: {
    copyText: (t) => ipcRenderer.invoke('clipboard:copy-text', t),
  },
  dialog: {
    pickFile: () => ipcRenderer.invoke('dialog:pick-file'),
  },
  window: {
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMax: () => ipcRenderer.invoke('window:toggle-max'),
  },
  blurControl: {
    // 修复 S2/S3：拖拽或外部应用打开期间禁用 blur 自动隐藏
    suspend: (ms) => ipcRenderer.invoke('blur-control:suspend', ms),
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (partial) => ipcRenderer.invoke('config:set', partial),
  },
});
