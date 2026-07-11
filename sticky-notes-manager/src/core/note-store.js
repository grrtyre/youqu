// 便签管家 - 核心存储与逻辑层
// 纯 Node.js 模块，零依赖，可被 main.js 和 test.js 共用

'use strict';

const fs = require('fs');
const path = require('path');

// 默认便签数据文件路径（在用户数据目录下）
function defaultDataPath() {
  const home = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(home, 'sticky-notes-manager', 'notes.json');
}

// 生成唯一 ID（时间戳 + 随机串，避免碰撞）
function generateId() {
  return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// 颜色标签枚举（苹果白风格配色）
const COLORS = {
  default: { name: '默认', hex: '#f5f5f7', dot: '#8e8e93' },
  blue:    { name: '蓝色', hex: '#e3f0ff', dot: '#007aff' },
  green:   { name: '绿色', hex: '#e8f8ec', dot: '#34c759' },
  yellow:  { name: '黄色', hex: '#fff9e0', dot: '#ffcc00' },
  orange:  { name: '橙色', hex: '#fff0e0', dot: '#ff9500' },
  pink:    { name: '粉色', hex: '#ffe8ef', dot: '#ff2d55' },
  purple:  { name: '紫色', hex: '#f3e8ff', dot: '#af52de' }
};

// 分类枚举
const CATEGORIES = ['工作', '个人', '灵感', '待办', '其他'];

// 创建便签对象（带默认值）
function createNote(data) {
  const now = Date.now();
  return {
    id: data.id || generateId(),
    title: (data.title || '').trim(),
    content: (data.content || '').trim(),
    color: data.color && COLORS[data.color] ? data.color : 'default',
    category: data.category && CATEGORIES.includes(data.category) ? data.category : '其他',
    pinned: !!data.pinned,
    createdAt: data.createdAt || now,
    updatedAt: now
  };
}

// 读取全部便签
function loadNotes(dataPath) {
  const filePath = dataPath || defaultDataPath();
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.notes)) {
      return [];
    }
    return data.notes.map(n => createNote(n));
  } catch (e) {
    return [];
  }
}

// 保存全部便签
function saveNotes(notes, dataPath) {
  const filePath = dataPath || defaultDataPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: notes
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

// 新增便签
function addNote(notes, data) {
  const note = createNote(data);
  notes.unshift(note);
  return { notes, note };
}

// 更新便签
function updateNote(notes, id, patch) {
  let updated = null;
  const newNotes = notes.map(n => {
    if (n.id === id) {
      updated = createNote({
        ...n,
        ...patch,
        id: n.id,
        createdAt: n.createdAt,
        updatedAt: Date.now()
      });
      return updated;
    }
    return n;
  });
  return { notes: newNotes, note: updated };
}

// 删除便签
function deleteNote(notes, id) {
  return notes.filter(n => n.id !== id);
}

// 切换置顶
function togglePin(notes, id) {
  let updated = null;
  const newNotes = notes.map(n => {
    if (n.id === id) {
      updated = { ...n, pinned: !n.pinned, updatedAt: Date.now() };
      return updated;
    }
    return n;
  });
  return { notes: newNotes, note: updated };
}

// 搜索便签（标题 + 内容，不区分大小写）
function searchNotes(notes, keyword) {
  if (!keyword || !keyword.trim()) {
    return notes;
  }
  const kw = keyword.trim().toLowerCase();
  return notes.filter(n =>
    (n.title || '').toLowerCase().includes(kw) ||
    (n.content || '').toLowerCase().includes(kw)
  );
}

// 按分类筛选
function filterByCategory(notes, category) {
  if (!category || category === '全部') {
    return notes;
  }
  return notes.filter(n => n.category === category);
}

// 排序：置顶优先 → 更新时间倒序
function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return b.pinned - a.pinned;
    }
    return b.updatedAt - a.updatedAt;
  });
}

// 统计信息
function getStats(notes) {
  const stats = {
    total: notes.length,
    pinned: notes.filter(n => n.pinned).length,
    byCategory: {},
    byColor: {},
    totalWords: 0,
    totalChars: 0
  };
  CATEGORIES.forEach(c => { stats.byCategory[c] = 0; });
  Object.keys(COLORS).forEach(c => { stats.byColor[c] = 0; });
  notes.forEach(n => {
    if (stats.byCategory[n.category] !== undefined) {
      stats.byCategory[n.category]++;
    }
    if (stats.byColor[n.color] !== undefined) {
      stats.byColor[n.color]++;
    }
    const text = (n.title + ' ' + n.content).trim();
    stats.totalChars += text.length;
    // 中英文混合字数统计：中文按字计，英文按词计
    const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const english = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
    stats.totalWords += chinese + english;
  });
  return stats;
}

// 导出为 JSON 字符串
function exportNotes(notes) {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: notes
  }, null, 2);
}

// 从 JSON 字符串导入
function importNotes(jsonStr, existingNotes) {
  const data = JSON.parse(jsonStr);
  if (!Array.isArray(data.notes)) {
    throw new Error('无效的便签数据格式');
  }
  // 合并导入：保留已有便签，新增导入便签（重新生成 ID 避免冲突）
  const imported = data.notes.map(n => createNote({
    ...n,
    id: undefined // 重新生成 ID
  }));
  return [...existingNotes, ...imported];
}

module.exports = {
  COLORS,
  CATEGORIES,
  generateId,
  createNote,
  loadNotes,
  saveNotes,
  addNote,
  updateNote,
  deleteNote,
  togglePin,
  searchNotes,
  filterByCategory,
  sortNotes,
  getStats,
  exportNotes,
  importNotes,
  defaultDataPath
};
