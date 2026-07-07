// 预加载脚本 - 通过 contextBridge 暴露安全的 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('accountAPI', {
  // 交易
  listTx: (filter) => ipcRenderer.invoke('tx:list', filter),
  getTx: (id) => ipcRenderer.invoke('tx:get', id),
  createTx: (data) => ipcRenderer.invoke('tx:create', data),
  updateTx: (id, patch) => ipcRenderer.invoke('tx:update', id, patch),
  removeTx: (id) => ipcRenderer.invoke('tx:remove', id),
  // 分类
  listCategories: (type) => ipcRenderer.invoke('cat:list', type),
  addCategory: (type, data) => ipcRenderer.invoke('cat:add', type, data),
  removeCategory: (id) => ipcRenderer.invoke('cat:remove', id),
  // 账户
  listAccounts: () => ipcRenderer.invoke('acc:list'),
  // 预算
  getBudget: (mk) => ipcRenderer.invoke('budget:get', mk),
  setBudget: (mk, amt) => ipcRenderer.invoke('budget:set', mk, amt),
  listBudgets: () => ipcRenderer.invoke('budget:list'),
  // 数据
  exportJSON: () => ipcRenderer.invoke('data:exportJSON'),
  exportCSV: () => ipcRenderer.invoke('data:exportCSV'),
  importJSON: (json) => ipcRenderer.invoke('data:importJSON', json),
  clearAll: () => ipcRenderer.invoke('data:clearAll'),
  saveExport: (format) => ipcRenderer.invoke('dialog:saveExport', format),
  pickImport: () => ipcRenderer.invoke('dialog:pickImport'),
});
