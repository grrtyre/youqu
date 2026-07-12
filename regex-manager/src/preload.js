// 正则管家 - 预加载脚本
// 通过 contextBridge 安全暴露 API 给渲染层

'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { executeRegex, executeReplace, buildHighlightSegments, escapeHtml, escapeRegExp } = require('./core/regex-engine');
const { PATTERNS } = require('./core/pattern-library');
const { explainRegex, explainFlags } = require('./core/regex-explainer');

contextBridge.exposeInMainWorld('regexApi', {
  executeRegex,
  executeReplace,
  buildHighlightSegments,
  escapeHtml,
  escapeRegExp
});

contextBridge.exposeInMainWorld('patternApi', {
  getPatterns: () => PATTERNS
});

contextBridge.exposeInMainWorld('explainerApi', {
  explain: explainRegex,
  explainFlags: explainFlags
});

contextBridge.exposeInMainWorld('storeApi', {
  load: () => ipcRenderer.invoke('history:load'),
  save: (data) => ipcRenderer.invoke('history:save', data),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text)
});

contextBridge.exposeInMainWorld('envApi', {
  regexTab: process.env.REGEX_TAB || ''
});
