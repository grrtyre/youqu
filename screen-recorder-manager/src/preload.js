// 录屏管家 - preload
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 源列表
  getSources: () => ipcRenderer.invoke('get-sources'),
  // demo 模式查询（主进程通过 .demo 信号文件检测）
  getDemoMode: () => ipcRenderer.invoke('get-demo-mode'),
  // 录制状态同步
  setRecordingState: (recording) => ipcRenderer.invoke('set-recording-state', { recording }),
  // 保存录制
  saveRecording: (args) => ipcRenderer.invoke('save-recording', args),
  // 历史
  getHistory: () => ipcRenderer.invoke('get-history'),
  deleteHistory: (id) => ipcRenderer.invoke('delete-history', { id }),
  showInFolder: (p) => ipcRenderer.invoke('show-in-folder', { path: p }),
  readVideo: (p) => ipcRenderer.invoke('read-video', { path: p }),
  saveAs: (p) => ipcRenderer.invoke('save-as', { path: p }),
  // 窗口控制
  winClose: () => ipcRenderer.invoke('win-close'),
  winMinimize: () => ipcRenderer.invoke('win-minimize'),
  winMaximize: () => ipcRenderer.invoke('win-maximize'),
  // 外部链接（爱发电等）
  openExternal: (url) => ipcRenderer.invoke('open-external', { url }),
  // 事件
  onHistoryUpdated: (cb) => ipcRenderer.on('history-updated', (e, args) => cb(args)),
  onToggleRecording: (cb) => ipcRenderer.on('toggle-recording', () => cb())
});
