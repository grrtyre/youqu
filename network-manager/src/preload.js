// 预加载桥接 - 安全暴露 API 给渲染层
const { contextBridge, ipcRenderer } = require('electron');
const {
  parseHostPort,
  isValidHost,
  isValidPort,
  isValidDomain,
  parseUrl,
  latencyColor,
  latencyRating,
  formatBytes,
  timeAgo,
} = require('./core/net-core');

contextBridge.exposeInMainWorld('api', {
  // 工具函数（纯函数，安全暴露）
  parseHostPort,
  isValidHost,
  isValidPort,
  isValidDomain,
  parseUrl,
  latencyColor,
  latencyRating,
  formatBytes,
  timeAgo,
  // 网络诊断
  ping: (host, count) => ipcRenderer.invoke('net:ping', host, count),
  tracert: (host, maxHops) => ipcRenderer.invoke('net:tracert', host, maxHops),
  dns: (domain, type) => ipcRenderer.invoke('net:dns', domain, type),
  portCheck: (host, port, timeout) => ipcRenderer.invoke('net:portCheck', host, port, timeout),
  httpHeaders: (url) => ipcRenderer.invoke('net:httpHeaders', url),
  whois: (domain) => ipcRenderer.invoke('net:whois', domain),
  ipInfo: (query) => ipcRenderer.invoke('net:ipInfo', query),
  localInfo: () => ipcRenderer.invoke('net:localInfo'),
  // 历史
  getHistory: () => ipcRenderer.invoke('hist:list'),
  clearHistory: () => ipcRenderer.invoke('hist:clear'),
  removeHistory: (index) => ipcRenderer.invoke('hist:remove', index),
  // 演示模式（同时支持 env 和命令行参数）
  isDemo: () => {
    if (process.env.NM_DEMO === '1') return true;
    try { return process.argv.includes('--demo'); } catch (e) {}
    try { return new URLSearchParams(location.search).get('demo') === '1'; } catch (e) { return false; }
  },
});
