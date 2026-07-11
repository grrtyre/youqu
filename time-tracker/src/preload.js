// 预加载桥接 - 安全暴露 API 给渲染层
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 项目
  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (data) => ipcRenderer.invoke('project:create', data),
  updateProject: (id, patch) => ipcRenderer.invoke('project:update', id, patch),
  removeProject: (id) => ipcRenderer.invoke('project:remove', id),
  // 计时
  startTimer: (projectId) => ipcRenderer.invoke('timer:start', projectId),
  stopTimer: () => ipcRenderer.invoke('timer:stop'),
  cancelTimer: () => ipcRenderer.invoke('timer:cancel'),
  getActive: () => ipcRenderer.invoke('timer:active'),
  onTimerChanged: (cb) => ipcRenderer.on('timer:changed', cb),
  // 记录
  listRecords: () => ipcRenderer.invoke('record:list'),
  removeRecord: (id) => ipcRenderer.invoke('record:remove', id),
  addRecord: (data) => ipcRenderer.invoke('record:add', data),
  updateRecord: (id, patch) => ipcRenderer.invoke('record:update', id, patch),
  // 统计
  overview: () => ipcRenderer.invoke('stats:overview'),
  distribution: (range) => ipcRenderer.invoke('stats:distribution', range),
  trend: (days) => ipcRenderer.invoke('stats:trend', days),
  // 数据
  exportCSV: () => ipcRenderer.invoke('data:exportCSV'),
  exportJSON: () => ipcRenderer.invoke('data:exportJSON'),
  importJSON: () => ipcRenderer.invoke('data:importJSON'),
});
