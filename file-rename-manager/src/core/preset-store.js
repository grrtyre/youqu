// preset-store.js
// 预设管理 —— 保存/加载/删除常用规则组合，持久化到 userData
// 纯逻辑模块，文件路径由调用方注入

const fs = require('fs');
const path = require('path');

/**
 * 加载所有预设
 * @param {string} presetFile - 预设文件完整路径
 * @returns {Array<{id,name,rules,createdAt}>}
 */
function loadPresets(presetFile) {
  try {
    if (!fs.existsSync(presetFile)) return [];
    let raw = fs.readFileSync(presetFile, 'utf-8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // 去 BOM
    const data = JSON.parse(raw);
    return Array.isArray(data.presets) ? data.presets : [];
  } catch (e) {
    console.error('加载预设失败:', e.message);
    return [];
  }
}

/**
 * 保存预设列表
 */
function savePresets(presetFile, presets) {
  try {
    const dir = path.dirname(presetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(presetFile, JSON.stringify({ presets }, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('保存预设失败:', e.message);
    return false;
  }
}

/**
 * 添加预设
 * @returns {object} 新预设对象（含 id）
 */
function addPreset(presetFile, name, rules) {
  const presets = loadPresets(presetFile);
  const preset = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(name || '未命名预设'),
    rules: rules || [],
    createdAt: new Date().toISOString()
  };
  presets.push(preset);
  savePresets(presetFile, presets);
  return preset;
}

/**
 * 删除预设
 */
function deletePreset(presetFile, id) {
  const presets = loadPresets(presetFile);
  const idx = presets.findIndex(p => p.id === id);
  if (idx !== -1) {
    presets.splice(idx, 1);
    savePresets(presetFile, presets);
    return true;
  }
  return false;
}

module.exports = { loadPresets, savePresets, addPreset, deletePreset };
