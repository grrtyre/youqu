const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  vault: {
    status: () => ipcRenderer.invoke('vault:status'),
    setup: (pwd) => ipcRenderer.invoke('vault:setup', pwd),
    unlock: (pwd) => ipcRenderer.invoke('vault:unlock', pwd),
    lock: () => ipcRenderer.invoke('vault:lock'),
    changePassword: (oldPwd, newPwd) => ipcRenderer.invoke('vault:changePassword', oldPwd, newPwd),
    exportBackup: () => ipcRenderer.invoke('vault:export'),
    importBackup: (pwd) => ipcRenderer.invoke('vault:import', pwd)
  },
  licenses: {
    list: () => ipcRenderer.invoke('licenses:list'),
    save: (list) => ipcRenderer.invoke('licenses:save', list)
  },
  app: {
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    resetActivity: () => ipcRenderer.invoke('app:resetActivity'),
    onAutoLocked: (cb) => {
      ipcRenderer.on('auto-locked', () => cb());
    },
    onDemoReady: (cb) => {
      ipcRenderer.on('demo-ready', () => cb());
    }
  }
});
