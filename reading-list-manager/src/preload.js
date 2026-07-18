// Preload 脚本 - 通过 contextBridge 安全暴露 API 给渲染进程

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 文章列表
  list: () => ipcRenderer.invoke('articles:list'),

  // 添加
  add: (data) => ipcRenderer.invoke('articles:add', data),

  // 更新
  update: (id, data) => ipcRenderer.invoke('articles:update', id, data),

  // 删除
  remove: (id) => ipcRenderer.invoke('articles:delete', id),

  // 统计
  stats: () => ipcRenderer.invoke('articles:stats'),

  // 标签
  tags: () => ipcRenderer.invoke('articles:tags'),

  // 导出
  exportData: () => ipcRenderer.invoke('articles:export'),

  // 导入
  importData: (jsonString) => ipcRenderer.invoke('articles:import', jsonString),

  // 在浏览器打开
  openExternal: (url) => ipcRenderer.invoke('open:external', url),

  // 监听主进程事件
  onArticleAddedFromClipboard: (callback) => {
    const handler = (_e, article) => callback(article);
    ipcRenderer.on('article:added-from-clipboard', handler);
    return () => ipcRenderer.removeListener('article:added-from-clipboard', handler);
  },
  onArticleAlreadyExists: (callback) => {
    const handler = (_e, url) => callback(url);
    ipcRenderer.on('article:already-exists', handler);
    return () => ipcRenderer.removeListener('article:already-exists', handler);
  },
  onClipboardNotUrl: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('clipboard:not-url', handler);
    return () => ipcRenderer.removeListener('clipboard:not-url', handler);
  }
});

// 暴露状态常量到渲染进程
contextBridge.exposeInMainWorld('STATUS', {
  UNREAD: 'unread',
  READING: 'reading',
  READ: 'read',
  ARCHIVED: 'archived'
});

contextBridge.exposeInMainWorld('STATUS_LABELS', {
  unread: '未读',
  reading: '阅读中',
  read: '已读',
  archived: '已归档'
});
