'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  start: () => ipcRenderer.invoke('timer:start'),
  pause: () => ipcRenderer.invoke('timer:pause'),
  resume: () => ipcRenderer.invoke('timer:resume'),
  reset: () => ipcRenderer.invoke('timer:reset'),
  skip: () => ipcRenderer.invoke('timer:skip'),
  switchPhase: (phase) => ipcRenderer.invoke('timer:switch', phase),
  addTask: (title, estimate) => ipcRenderer.invoke('task:add', title, estimate),
  setCurrentTask: (id) => ipcRenderer.invoke('task:current', id),
  completeTask: (id) => ipcRenderer.invoke('task:complete', id),
  deleteTask: (id) => ipcRenderer.invoke('task:delete', id),
  addTaskRaw: (task) => ipcRenderer.invoke('task:addRaw', task),
  updateTask: (id, updates) => ipcRenderer.invoke('task:update', id, updates),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: (json) => ipcRenderer.invoke('data:import', json),
  onTick: (cb) => ipcRenderer.on('tick', (e, data) => cb(data)),
  onPhase: (cb) => ipcRenderer.on('phase', (e, data) => cb(data)),
  onNotify: (cb) => ipcRenderer.on('notify', (e, data) => cb(data))
});
