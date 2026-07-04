// 截图管家 - preload
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 截图流程
  cropScreenshot: (args) => ipcRenderer.invoke('crop-screenshot', args),
  openEditor: (args) => ipcRenderer.invoke('open-editor', args),
  pickerCancel: () => ipcRenderer.invoke('picker-cancel'),
  // 编辑器
  saveScreenshot: (args) => ipcRenderer.invoke('save-screenshot', args),
  copyToClipboard: (args) => ipcRenderer.invoke('copy-to-clipboard', args),
  pinScreenshot: (args) => ipcRenderer.invoke('pin-screenshot', args),
  saveAs: (args) => ipcRenderer.invoke('save-as', args),
  readImage: (p) => ipcRenderer.invoke('read-image', p),
  // 历史
  getHistory: () => ipcRenderer.invoke('get-history'),
  deleteHistory: (id) => ipcRenderer.invoke('delete-history', id),
  showInFolder: (p) => ipcRenderer.invoke('show-in-folder', p),
  editFromHistory: (id) => ipcRenderer.invoke('edit-from-history', id),
  // 窗口控制
  winClose: () => ipcRenderer.invoke('win-close'),
  winMinimize: () => ipcRenderer.invoke('win-minimize'),
  winMaximize: () => ipcRenderer.invoke('win-maximize'),
  // 事件
  onPickerInit: (cb) => ipcRenderer.on('picker-init', (e, args) => cb(args)),
  onEditorInit: (cb) => ipcRenderer.on('editor-init', (e, args) => cb(args)),
  onPinInit: (cb) => ipcRenderer.on('pin-init', (e, args) => cb(args)),
  onHistoryUpdated: (cb) => ipcRenderer.on('history-updated', (e, args) => cb(args))
});
