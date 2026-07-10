// 预加载桥接 - 安全暴露 API 给渲染层
const { contextBridge, ipcRenderer } = require('electron');
const { filterConnections, summarize } = require('./core/port-scanner');

contextBridge.exposeInMainWorld('api', {
  // 工具函数（纯函数，安全暴露）
  filterConnections,
  summarize,
  // 扫描端口
  scan: () => ipcRenderer.invoke('port:scan'),
  // 结束进程
  killProcess: (pid) => ipcRenderer.invoke('port:kill', pid),
  // 获取进程路径
  getProcessPath: (pid) => ipcRenderer.invoke('port:processPath', pid),
  // 收藏端口管理
  getFavorites: () => ipcRenderer.invoke('fav:list'),
  toggleFavorite: (port) => ipcRenderer.invoke('fav:toggle', port),
  // 导出
  exportCSV: () => ipcRenderer.invoke('data:exportCSV'),
  exportJSON: () => ipcRenderer.invoke('data:exportJSON'),
  // 导入导出收藏
  exportFavorites: () => ipcRenderer.invoke('fav:export'),
  importFavorites: (json) => ipcRenderer.invoke('fav:import', json),
});
