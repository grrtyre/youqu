// 换算管家 - 预加载脚本
const { contextBridge, ipcRenderer } = require('electron');
const conv = require('./core/converter');
const Store = require('./core/store');

// 暴露换算核心给渲染层
contextBridge.exposeInMainWorld('core', {
  categories: conv.categories,
  convertAll: conv.convertAll,
  convert: conv.convert,
  parseInput: conv.parseInput,
  formatValue: conv.formatValue
});

contextBridge.exposeInMainWorld('store', {
  createState: Store.createState,
  isFavorite: Store.isFavorite
});

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: (s) => ipcRenderer.invoke('state:save', s),
  addHistory: (entry) => ipcRenderer.invoke('history:add', entry),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  toggleFavorite: (fav) => ipcRenderer.invoke('favorite:toggle', fav),
  setLast: (last) => ipcRenderer.invoke('last:set', last),
  getCategories: () => ipcRenderer.invoke('categories:get')
});
