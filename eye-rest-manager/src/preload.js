// preload.js — 安全的 IPC 桥
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 设置
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (patch) => ipcRenderer.invoke('save-settings', patch),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('set-launch-at-login', enabled),

  // 状态与调度
  getState: () => ipcRenderer.invoke('get-state'),
  pause: (minutes) => ipcRenderer.invoke('pause', minutes),
  resume: () => ipcRenderer.invoke('resume'),
  triggerBreak: (type) => ipcRenderer.invoke('trigger-break', type),

  // 休息覆盖层
  breakFinished: (payload) => ipcRenderer.invoke('break-finished', payload),

  // 统计
  getStats: () => ipcRenderer.invoke('get-stats'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // 备份
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),

  // 通用
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getAfdianUrl: () => ipcRenderer.invoke('get-afdian-url'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // 事件订阅
  onCountdown: (cb) => ipcRenderer.on('countdown', (e, p) => cb(p)),
  onStateChanged: (cb) => ipcRenderer.on('state-changed', (e, p) => cb(p)),
  onStatsUpdated: (cb) => ipcRenderer.on('stats-updated', (e, p) => cb(p)),
  onBreakStart: (cb) => ipcRenderer.on('break-start', (e, p) => cb(p))
});
