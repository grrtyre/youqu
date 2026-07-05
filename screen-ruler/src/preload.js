const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ruler', {
  // 覆盖层
  openOverlay: () => ipcRenderer.invoke('app:open-overlay'),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  capture: () => ipcRenderer.invoke('overlay:capture'),
  onScreenshot: (cb) => {
    ipcRenderer.on('overlay:screenshot', (_e, b64) => cb(b64));
  },
  // 应用
  quit: () => ipcRenderer.invoke('app:quit'),
  getDisplays: () => ipcRenderer.invoke('app:get-displays'),
  // 自定义标题栏窗口控制
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximizeToggle: () => ipcRenderer.invoke('win:maximize-toggle'),
  close: () => ipcRenderer.invoke('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
  onMaximizeChange: (cb) => {
    ipcRenderer.on('win:maximize-change', (_e, isMax) => cb(isMax));
  }
});
