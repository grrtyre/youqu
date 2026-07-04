// 调色板与历史的本地存储管理（Electron 主进程使用）
// 数据持久化到 userData/color-picker-data.json

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_HISTORY = 50;

function dataFilePath(app) {
  return path.join(app.getPath('userData'), 'color-picker-data.json');
}

function defaultData() {
  return {
    history: [],     // [{ hex, r, g, b, ts }]
    palettes: [
      {
        id: 'default',
        name: '我的调色板',
        colors: ['#007AFF', '#34C759', '#FF3B30', '#FF9500', '#AF52DE'],
        createdAt: Date.now(),
      },
    ],
    settings: {
      copyFormat: 'hex', // hex | hexUpper | rgb | hsl
      shortcut: 'CommandOrControl+Shift+C',
      magnifierSize: 11,
    },
  };
}

function load(app) {
  const file = dataFilePath(app);
  try {
    if (!fs.existsSync(file)) return defaultData();
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    // 容错合并
    const base = defaultData();
    return {
      history: Array.isArray(parsed.history) ? parsed.history : base.history,
      palettes: Array.isArray(parsed.palettes) && parsed.palettes.length > 0
        ? parsed.palettes : base.palettes,
      settings: Object.assign(base.settings, parsed.settings || {}),
    };
  } catch (e) {
    return defaultData();
  }
}

function save(app, data) {
  const file = dataFilePath(app);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

/** 添加到历史（去重，最新在前） */
function pushHistory(data, hex, rgb) {
  const entry = { hex, r: rgb.r, g: rgb.g, b: rgb.b, ts: Date.now() };
  data.history = data.history.filter((c) => c.hex.toLowerCase() !== hex.toLowerCase());
  data.history.unshift(entry);
  if (data.history.length > MAX_HISTORY) data.history = data.history.slice(0, MAX_HISTORY);
  return data;
}

/** 新建调色板 */
function createPalette(data, name) {
  const id = `p_${Date.now()}`;
  const palette = {
    id,
    name: name || '未命名调色板',
    colors: [],
    createdAt: Date.now(),
  };
  data.palettes.push(palette);
  return palette;
}

/** 删除调色板（至少保留一个） */
function deletePalette(data, id) {
  if (data.palettes.length <= 1) return false;
  data.palettes = data.palettes.filter((p) => p.id !== id);
  return true;
}

/** 向指定调色板添加颜色（去重） */
function addColorToPalette(data, paletteId, hex) {
  const p = data.palettes.find((x) => x.id === paletteId);
  if (!p) return false;
  const lower = hex.toLowerCase();
  if (p.colors.some((c) => c.toLowerCase() === lower)) return false;
  p.colors.push(hex);
  return true;
}

/** 从指定调色板移除颜色 */
function removeColorFromPalette(data, paletteId, hex) {
  const p = data.palettes.find((x) => x.id === paletteId);
  if (!p) return false;
  const lower = hex.toLowerCase();
  p.colors = p.colors.filter((c) => c.toLowerCase() !== lower);
  return true;
}

module.exports = {
  MAX_HISTORY,
  dataFilePath,
  defaultData,
  load,
  save,
  pushHistory,
  createPalette,
  deletePalette,
  addColorToPalette,
  removeColorFromPalette,
};
