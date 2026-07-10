// src/preload.js — 上下文隔离桥接
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ocr', {
  // OCR 识别
  recognize: (payload) => ipcRenderer.invoke('ocr-recognize', payload),
  cancel: () => ipcRenderer.invoke('ocr-cancel'),
  onProgress: (cb) => {
    const h = (_e, m) => cb(m);
    ipcRenderer.on('ocr-progress', h);
    return () => ipcRenderer.removeListener('ocr-progress', h);
  },
  // 截图识别触发
  onTriggerScreenshot: (cb) => {
    const h = () => cb();
    ipcRenderer.on('trigger-screenshot-ocr', h);
    return () => ipcRenderer.removeListener('trigger-screenshot-ocr', h);
  },
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  // 遮罩窗口用：发送选择/取消
  sendSelected: (rect) => ipcRenderer.send('capture-selected', rect),
  sendCancelled: () => ipcRenderer.send('capture-cancelled'),
  onCaptureBg: (cb) => {
    const h = (_e, data) => cb(data);
    ipcRenderer.on('capture-bg', h);
    return () => ipcRenderer.removeListener('capture-bg', h);
  },
  // 剪贴板
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  writeClipboardText: (text) => ipcRenderer.invoke('write-clipboard-text', text),
  // 历史
  getHistory: () => ipcRenderer.invoke('get-history'),
  setHistory: (list) => ipcRenderer.invoke('set-history', list),
  // 设置
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (s) => ipcRenderer.invoke('set-settings', s),
  // 导出
  exportText: (payload) => ipcRenderer.invoke('export-text', payload),
  // 窗口控制
  minimize: () => ipcRenderer.invoke('window-min'),
  close: () => ipcRenderer.invoke('window-close')
});
