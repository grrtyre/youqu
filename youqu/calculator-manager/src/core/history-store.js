// 历史与变量本地持久化存储
// 使用用户数据目录的 JSON 文件存储，纯本地隐私优先

'use strict';

const fs = require('fs');
const path = require('path');

function getStorageDir() {
  // 优先用 Electron 的 userData，回退到 os.homedir
  let base;
  try {
    const { app } = require('electron');
    base = app.getPath('userData');
  } catch (_) {
    const os = require('os');
    base = path.join(os.homedir(), '.calculator-manager');
  }
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
}

function getHistoryFile() {
  return path.join(getStorageDir(), 'history.json');
}

function getVariablesFile() {
  return path.join(getStorageDir(), 'variables.json');
}

function loadJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const text = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(text);
    return data;
  } catch (err) {
    return fallback;
  }
}

function saveJSON(filePath, data) {
  try {
    const text = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, text, 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

// ============ 历史记录 ============

const MAX_HISTORY = 200;

function loadHistory() {
  const data = loadJSON(getHistoryFile(), []);
  if (!Array.isArray(data)) return [];
  return data.slice(-MAX_HISTORY);
}

function saveHistoryItem(item) {
  const list = loadHistory();
  list.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    expr: String(item.expr || ''),
    result: String(item.result || ''),
    mode: String(item.mode || 'scientific'),
    createdAt: Date.now(),
  });
  const trimmed = list.slice(-MAX_HISTORY);
  saveJSON(getHistoryFile(), trimmed);
  return trimmed;
}

function clearHistory() {
  return saveJSON(getHistoryFile(), []);
}

function deleteHistoryItem(id) {
  const list = loadHistory();
  const filtered = list.filter(item => item.id !== id);
  saveJSON(getHistoryFile(), filtered);
  return filtered;
}

// ============ 变量 ============

function loadVariables() {
  const data = loadJSON(getVariablesFile(), {});
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
  return data;
}

function saveVariable(name, value) {
  const vars = loadVariables();
  vars[name] = value;
  saveJSON(getVariablesFile(), vars);
  return vars;
}

function deleteVariable(name) {
  const vars = loadVariables();
  delete vars[name];
  saveJSON(getVariablesFile(), vars);
  return vars;
}

function clearVariables() {
  return saveJSON(getVariablesFile(), {});
}

module.exports = {
  getStorageDir,
  loadHistory,
  saveHistoryItem,
  clearHistory,
  deleteHistoryItem,
  loadVariables,
  saveVariable,
  deleteVariable,
  clearVariables,
  MAX_HISTORY,
};
