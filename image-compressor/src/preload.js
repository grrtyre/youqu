const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectImages: () => ipcRenderer.invoke('dialog:selectImages'),
  getImageInfo: (filePath) => ipcRenderer.invoke('image:getInfo', filePath),
  compressBatch: (payload) => ipcRenderer.invoke('image:compressBatch', payload),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  onProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('compress:progress', handler);
    return () => ipcRenderer.removeListener('compress:progress', handler);
  }
});
