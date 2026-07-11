// store.js — 设置与历史记录的本地持久化
// 职责：读写 userData 目录下的 JSON 文件，提供原子化保存、历史归档、数据迁移

'use strict';
const fs = require('fs');
const path = require('path');
const engine = require('./break-engine');

const SETTINGS_FILE = 'settings.json';
const HISTORY_FILE = 'history-v1.json';
const HISTORY_MAX = 5000; // 历史最多保留 5000 条，超出滚动淘汰

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf-8');
    const obj = JSON.parse(raw);
    return obj != null ? obj : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(file, obj) {
  ensureDir(file);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

// === 设置 ===

function loadSettings(file) {
  const raw = readJSON(file, {});
  return engine.normalizeSettings(raw);
}

function saveSettings(file, settings) {
  const normalized = engine.normalizeSettings(settings);
  writeJSON(file, normalized);
  return normalized;
}

// === 历史 ===

// 历史条目：{ ts: ISO 字符串, type: 'micro'|'short'|'long', action: 'completed'|'skipped'|'snoozed', durationSec: number }
function loadHistory(file) {
  const arr = readJSON(file, []);
  return Array.isArray(arr) ? arr : [];
}

function appendHistory(file, entry) {
  const list = loadHistory(file);
  const item = {
    ts: new Date().toISOString(),
    type: entry.type,
    action: entry.action,
    durationSec: Number(entry.durationSec) || 0
  };
  list.push(item);
  // 滚动淘汰
  while (list.length > HISTORY_MAX) list.shift();
  writeJSON(file, list);
  return item;
}

function saveHistory(file, list) {
  const arr = Array.isArray(list) ? list : [];
  while (arr.length > HISTORY_MAX) arr.shift();
  writeJSON(file, arr);
}

// 导出全部数据为单个 JSON（备份用）
function exportAll(settingsFile, historyFile) {
  return {
    exportedAt: new Date().toISOString(),
    settings: readJSON(settingsFile, {}),
    history: loadHistory(historyFile)
  };
}

// 从备份导入（覆盖）
function importAll(payload, settingsFile, historyFile) {
  if (!payload || typeof payload !== 'object') throw new Error('备份文件格式无效');
  if (payload.settings) saveSettings(settingsFile, payload.settings);
  if (Array.isArray(payload.history)) saveHistory(historyFile, payload.history);
  return {
    settingsCount: payload.settings ? 1 : 0,
    historyCount: Array.isArray(payload.history) ? payload.history.length : 0
  };
}

module.exports = {
  SETTINGS_FILE,
  HISTORY_FILE,
  loadSettings,
  saveSettings,
  loadHistory,
  appendHistory,
  saveHistory,
  exportAll,
  importAll
};
