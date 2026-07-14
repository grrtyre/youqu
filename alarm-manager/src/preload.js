// 闹钟管家 - 预加载脚本
// 通过 contextBridge 暴露安全的 IPC 接口给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('alarmAPI', {
  // 数据加载与保存
  loadData: () => ipcRenderer.invoke('store:load'),
  saveData: (data) => ipcRenderer.invoke('store:save', data),

  // 闹钟增删改
  upsertAlarm: (alarm) => ipcRenderer.invoke('alarm:upsert', alarm),
  deleteAlarm: (id) => ipcRenderer.invoke('alarm:delete', id),
  toggleAlarm: (id, enabled) => ipcRenderer.invoke('alarm:toggle', id, enabled),

  // 触发与贪睡
  snoozeAlarm: (id) => ipcRenderer.invoke('alarm:snooze', id),
  dismissAlarm: (id) => ipcRenderer.invoke('alarm:dismiss', id),
  testAlarm: (id) => ipcRenderer.invoke('alarm:test', id),
  closeTrigger: () => ipcRenderer.invoke('trigger:close'),

  // 设置
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  // 导入导出
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: (text) => ipcRenderer.invoke('data:import', text),

  // 事件监听
  onAlarmFired: (callback) => ipcRenderer.on('alarm:fired', (e, alarm) => callback(alarm)),
  onTick: (callback) => ipcRenderer.on('tick', (e, payload) => callback(payload)),
  onTrigger: (callback) => ipcRenderer.on('trigger:show', () => callback()),
  onTriggerFire: (callback) => ipcRenderer.on('trigger:fire', (e, data) => callback(data)),

  // 平台信息
  platform: process.platform,
  versions: process.versions
});
