'use strict';
// Hosts管家 - preload
// 通过 contextBridge 暴露受限 API 给渲染进程

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hostsAPI', {
  // hosts 文件操作
  readHosts: () => ipcRenderer.invoke('hosts:read'),
  writeHosts: (content) => ipcRenderer.invoke('hosts:write', content),
  canWrite: () => ipcRenderer.invoke('hosts:canWrite'),
  openHostsLocation: () => ipcRenderer.invoke('hosts:openLocation'),
  // 模板
  getTemplates: () => ipcRenderer.invoke('templates:list'),
  // 方案管理
  loadProfiles: () => ipcRenderer.invoke('profiles:load'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profiles:save', profiles),
  // 备份
  listBackups: () => ipcRenderer.invoke('backup:list'),
  readBackup: (name) => ipcRenderer.invoke('backup:read', name),
  openBackupDir: () => ipcRenderer.invoke('backup:openDir')
});
