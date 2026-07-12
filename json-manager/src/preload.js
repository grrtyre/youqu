'use strict';
// JSON管家 - preload 桥接
// 通过 contextBridge 暴露：文件/历史 IPC + core 算法（避免 IPC 延迟）

const { contextBridge, ipcRenderer } = require('electron');
const ops = require('./core/json-ops');
const jq = require('./core/jq-lite');
const conv = require('./core/converters');

contextBridge.exposeInMainWorld('api', {
  // 文件与历史（走 IPC）
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName, text) => ipcRenderer.invoke('dialog:saveFile', defaultName, text),
  history: {
    load: () => ipcRenderer.invoke('history:load'),
    add: (item) => ipcRenderer.invoke('history:add', item),
    clear: () => ipcRenderer.invoke('history:clear')
  },
  // 核心算法（直接调用，无 IPC 延迟）
  core: {
    parse: ops.parse,
    beautify: ops.beautify,
    minify: ops.minify,
    escapeHtml: ops.escapeHtml,
    stats: ops.stats,
    typeOf: ops.typeOf,
    pathToString: ops.pathToString,
    jqQuery: jq.query,
    toCSV: conv.toCSV,
    toYAML: conv.toYAML,
    toXML: conv.toXML,
    toProperties: conv.toProperties,
    diff: conv.diff,
    validateSchema: conv.validateSchema
  }
});
