// 预加载桥接 - 安全暴露 API 给渲染层
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 窗口列表
  listWindows: () => ipcRenderer.invoke('win:list'),
  // 切换某窗口置顶
  setTopmost: (hwnd, on) => ipcRenderer.invoke('win:top', hwnd, on),
  // 设置某窗口透明度
  setAlpha: (hwnd, percent) => ipcRenderer.invoke('win:alpha', hwnd, percent),
  // 切换前台窗口置顶
  toggleForeground: () => ipcRenderer.invoke('win:topfg'),
  // 规则管理
  getRules: () => ipcRenderer.invoke('rules:get'),
  addRule: (proc) => ipcRenderer.invoke('rules:add', proc),
  removeRule: (proc) => ipcRenderer.invoke('rules:remove', proc),
  toggleRule: (proc, enabled) => ipcRenderer.invoke('rules:toggle', proc, enabled),
  setAutoPin: (on) => ipcRenderer.invoke('rules:autoPin', on),
  // 提示
  showToast: (body) => ipcRenderer.invoke('app:showToast', body),
  // 桥接就绪事件
  onBridgeReady: (cb) => ipcRenderer.on('bridge:ready', (e, ok) => cb(ok)),
});
