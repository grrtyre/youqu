// preload 脚本 - 安全暴露接口
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('app', {
  version: '1.0.0',
  platform: process.platform
});
