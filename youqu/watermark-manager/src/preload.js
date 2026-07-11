'use strict';
// 水印管家 - preload
// 通过 contextBridge 暴露受限 API 给渲染进程

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waterAPI', {
  // 配置管理
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  // 水印开关
  toggleWatermark: (enabled) => ipcRenderer.invoke('watermark:toggle', enabled),
  // 模板
  getTemplates: () => ipcRenderer.invoke('templates:list'),
  applyTemplate: (id) => ipcRenderer.invoke('templates:apply', id),
  // 系统信息
  getSystemVars: () => ipcRenderer.invoke('system:vars'),
  getPreview: () => ipcRenderer.invoke('watermark:preview'),
  // 退出
  quit: () => ipcRenderer.invoke('app:quit'),
  // 监听配置更新（托盘操作同步到界面）
  onConfigUpdated: (callback) => {
    ipcRenderer.on('config:updated', (_e, config) => callback(config));
  },
  // 监听水印层配置更新
  onOverlayUpdate: (callback) => {
    ipcRenderer.on('overlay:update', (_e, payload) => callback(payload));
  },
  // 通知主进程渲染层已就绪（供截图脚本使用）
  ready: () => ipcRenderer.send('app:ready')
});
