// preload.js — 安全的 IPC 桥，暴露受限 API 给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getItems: () => ipcRenderer.invoke('get-items'),
  searchItems: (q) => ipcRenderer.invoke('search-items', q),
  copyItem: (id) => ipcRenderer.invoke('copy-item', id),
  toggleFavorite: (id) => ipcRenderer.invoke('toggle-favorite', id),
  togglePin: (id) => ipcRenderer.invoke('toggle-pin', id),
  deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
  // 撤销删除：恢复最近被删的条目
  restoreItem: (item) => ipcRenderer.invoke('restore-item', item),
  clearAll: () => ipcRenderer.invoke('clear-all'),
  pasteToFront: () => ipcRenderer.invoke('paste-to-front'),
  // 编辑条目内容（仅文本类条目）
  editItem: (id, content) => ipcRenderer.invoke('edit-item', id, content),
  // 新增：打开外部链接（爱发电等）
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // 新增：获取数据存储路径
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  // 新增：在资源管理器中打开数据所在文件夹
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  // 新增：获取爱发电链接
  getAfdianUrl: () => ipcRenderer.invoke('get-afdian-url'),
  // 新增：首次启动状态 / 标记欢迎已展示
  getFirstRun: () => ipcRenderer.invoke('get-first-run'),
  markWelcomeShown: () => ipcRenderer.invoke('mark-welcome-shown'),
  onHistoryUpdated: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('history-updated', handler);
    return () => ipcRenderer.removeListener('history-updated', handler);
  }
});
