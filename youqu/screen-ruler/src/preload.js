const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ruler', {
  openOverlay: () => ipcRenderer.invoke('app:open-overlay'),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  capture: () => ipcRenderer.invoke('overlay:capture'),
  quit: () => ipcRenderer.invoke('app:quit'),
  getDisplays: () => ipcRenderer.invoke('app:get-displays'),
  onScreenshot: (cb) => {
    ipcRenderer.on('overlay:screenshot', (_e, b64) => cb(b64));
  }
});
