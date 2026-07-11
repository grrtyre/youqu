// 预加载脚本 - 通过 contextBridge 暴露安全 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kt', {
  stats: {
    get: () => ipcRenderer.invoke('stats:get'),
    pressKey: (code) => ipcRenderer.invoke('stats:pressKey', code),
    clickMouse: (button) => ipcRenderer.invoke('stats:clickMouse', button),
    wheel: (direction) => ipcRenderer.invoke('stats:wheel', direction),
    move: (dx, dy) => ipcRenderer.invoke('stats:move', dx, dy),
    save: (snapshot) => ipcRenderer.invoke('stats:save', snapshot),
    reset: () => ipcRenderer.invoke('stats:reset'),
  },
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    add: (record) => ipcRenderer.invoke('history:add', record),
    clear: () => ipcRenderer.invoke('history:clear'),
  },
  data: {
    clearAll: () => ipcRenderer.invoke('data:clearAll'),
    export: () => ipcRenderer.invoke('data:export'),
  },
});
