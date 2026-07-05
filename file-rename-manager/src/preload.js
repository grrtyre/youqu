// preload.js —— 安全的 IPC 桥，暴露受限 API 给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 文件选择
  pickFiles: () => ipcRenderer.invoke('pick-files'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  scanPaths: (paths, recursive, extFilter) => ipcRenderer.invoke('scan-paths', paths, recursive, extFilter),

  // 重命名操作
  generatePreview: (items, rules) => ipcRenderer.invoke('generate-preview', items, rules),
  executeRename: (preview) => ipcRenderer.invoke('execute-rename', preview),
  undoRename: () => ipcRenderer.invoke('undo-rename'),
  hasUndoHistory: () => ipcRenderer.invoke('has-undo-history'),
  applyUndoToFiles: (files, history) => ipcRenderer.invoke('apply-undo-to-files', files, history),

  // 预设管理
  presetList: () => ipcRenderer.invoke('preset-list'),
  presetAdd: (name, rules) => ipcRenderer.invoke('preset-add', name, rules),
  presetDelete: (id) => ipcRenderer.invoke('preset-delete', id),

  // 外部链接 & 爱发电
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getAfdianUrl: () => ipcRenderer.invoke('get-afdian-url'),

  // 窗口控制
  winMinimize: () => ipcRenderer.invoke('win-minimize'),
  winMaximize: () => ipcRenderer.invoke('win-maximize'),
  winClose: () => ipcRenderer.invoke('win-close'),

  // demo 数据（用于截图展示）
  onDemoData: (cb) => {
    const handler = (event, data) => cb(data);
    ipcRenderer.on('demo-data', handler);
    return () => ipcRenderer.removeListener('demo-data', handler);
  }
});
