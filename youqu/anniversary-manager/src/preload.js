// 预加载脚本：暴露受限 IPC 接口给渲染层
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  list: () => ipcRenderer.invoke('anniv:list'),
  get: (id) => ipcRenderer.invoke('anniv:get', id),
  create: (data) => ipcRenderer.invoke('anniv:create', data),
  update: (id, patch) => ipcRenderer.invoke('anniv:update', id, patch),
  remove: (id) => ipcRenderer.invoke('anniv:remove', id),
  export: () => ipcRenderer.invoke('anniv:export'),
  import: () => ipcRenderer.invoke('anniv:import'),
  today: () => ipcRenderer.invoke('anniv:today'),
});
