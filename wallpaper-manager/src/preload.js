// Preload - 通过 contextBridge 暴露安全 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  addSource: () => ipcRenderer.invoke('sources:add'),
  removeSource: (dir) => ipcRenderer.invoke('sources:remove', dir),
  listWallpapers: () => ipcRenderer.invoke('wallpapers:list'),
  setWallpaper: (p) => ipcRenderer.invoke('wallpaper:set', p),
  toggleFavorite: (p) => ipcRenderer.invoke('favorite:toggle', p),
  fetchBing: () => ipcRenderer.invoke('bing:fetch'),
  openInFolder: (p) => ipcRenderer.invoke('wallpaper:open-folder', p),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  onBingUpdated: (cb) => ipcRenderer.on('bing-updated', (_, p) => cb(p))
});
