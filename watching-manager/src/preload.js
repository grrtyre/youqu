// src/preload.js — 预加载脚本，通过 contextBridge 安全暴露 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 剧集 CRUD
  showsGet: () => ipcRenderer.invoke('shows-get'),
  // demo 模式
  isDemo: () => ipcRenderer.invoke('is-demo'),
  demoShows: () => ipcRenderer.invoke('demo-shows'),
  showsAdd: (input) => ipcRenderer.invoke('shows-add', input),
  showsUpdate: (id, patch) => ipcRenderer.invoke('shows-update', { id, patch }),
  showsAdvance: (id, step) => ipcRenderer.invoke('shows-advance', { id, step }),
  showsReset: (id) => ipcRenderer.invoke('shows-reset', { id }),
  showsRemove: (id) => ipcRenderer.invoke('shows-remove', { id }),
  showsClear: () => ipcRenderer.invoke('shows-clear'),
  // 统计/筛选/排序
  showsStats: () => ipcRenderer.invoke('shows-stats'),
  showsQuery: (opts) => ipcRenderer.invoke('shows-query', opts),
  // 导入导出
  showsExport: () => ipcRenderer.invoke('shows-export'),
  showsImport: (filePath) => ipcRenderer.invoke('shows-import', filePath),
  // 提醒
  remindersCheck: () => ipcRenderer.invoke('reminders-check'),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  // 海报
  pickPoster: () => ipcRenderer.invoke('pick-poster'),
  // 窗口
  winMin: () => ipcRenderer.invoke('window-min'),
  winMax: () => ipcRenderer.invoke('window-max'),
  winClose: () => ipcRenderer.invoke('window-close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
