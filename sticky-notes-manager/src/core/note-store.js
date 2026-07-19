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
    // 保留导入/恢复数据中的原始 updatedAt；新建便签使用 now
    updatedAt: typeof data.updatedAt === 'number' && data.updatedAt > 0 ? data.updatedAt : now
  };
}

// 创建回收站便签对象（在普通便签基础上增加 deletedAt）
function createTrashNote(data) {
  const note = createNote(data);
  note.deletedAt = data.deletedAt || Date.now();
  return note;
}

// 读取全部便签
function loadNotes(dataPath) {
  return loadAll(dataPath).notes;
}

// 读取便签 + 回收站（统一入口，向后兼容 v1 数据）
function loadAll(dataPath) {
  const filePath = dataPath || defaultDataPath();
  try {
    if (!fs.existsSync(filePath)) {
      return { notes: [], trash: [] };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const notes = Array.isArray(data.notes) ? data.notes.map(n => createNote(n)) : [];
    // v2 新增 trash 字段；v1 旧文件没有 trash，默认空数组
    const trash = Array.isArray(data.trash) ? data.trash.map(n => createTrashNote(n)) : [];
    return { notes, trash };
  } catch (e) {
    return { notes: [], trash: [] };
  }
}

// 保存全部便签
function saveNotes(notes, dataPath) {
  // 兼容旧调用：保留已有回收站数据
  const existing = loadAll(dataPath);
  return saveAll(notes, existing.trash, dataPath);
}

// 保存便签 + 回收站（v2 数据格式）
function saveAll(notes, trash, dataPath) {
  const filePath = dataPath || defaultDataPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    notes: notes,
    trash: trash
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

// === 回收站操作 ===
// 回收站最长保留天数
const TRASH_MAX_DAYS = 30;

// 移入回收站：从 notes 移除并加入 trash（带 deletedAt 时间戳）
function moveToTrash(notes, trash, id) {
  const note = notes.find(n => n.id === id);
  if (!note) {
    return { notes, trash, note: null };
  }
  const trashed = createTrashNote({ ...note, deletedAt: Date.now() });
  const newNotes = notes.filter(n => n.id !== id);
  // 回收站按删除时间倒序（最新删除的在前面）
  const newTrash = [trashed, ...trash];
  return { notes: newNotes, trash: newTrash, note: trashed };
}

// 从回收站恢复：从 trash 移除并加回 notes（清除 deletedAt，取消置顶避免位置混乱）
function restoreNote(trash, notes, id) {
  const trashed = trash.find(n => n.id === id);
  if (!trashed) {
    return { notes, trash, note: null };
  }
  const restored = createNote({
    ...trashed,
    deletedAt: undefined,
    pinned: false, // 恢复后取消置顶，避免突兀置顶
    updatedAt: Date.now()
  });
  delete restored.deletedAt;
  const newTrash = trash.filter(n => n.id !== id);
  const newNotes = [restored, ...notes];
  return { notes: newNotes, trash: newTrash, note: restored };
}

// 从回收站彻底删除单条
function deleteFromTrash(trash, id) {
  return trash.filter(n => n.id !== id);
}

// 清空回收站
function emptyTrash(trash) {
  return [];
}

// 自动清理过期回收站（超过 TRASH_MAX_DAYS 天）
function autoCleanTrash(trash, now) {
  const nowTs = now || Date.now();
  const maxAgeMs = TRASH_MAX_DAYS * 24 * 60 * 60 * 1000;
  return trash.filter(n => {
    if (!n.deletedAt) return true;
    return (nowTs - n.deletedAt) < maxAgeMs;
  });
}

// 计算回收站便签的剩余保留天数
function getTrashDaysLeft(note, now) {
  const nowTs = now || Date.now();
  if (!note.deletedAt) return TRASH_MAX_DAYS;
  const maxAgeMs = TRASH_MAX_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = nowTs - note.deletedAt;
  const left = Math.ceil((maxAgeMs - elapsed) / (24 * 60 * 60 * 1000));
  return left < 0 ? 0 : left;
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
  // 合并导入：保留已有便签，新增导入便签（重新生成 ID 避免冲突，保留原 updatedAt 时间戳）
  const imported = data.notes.map(n => createNote({
    ...n,
    id: undefined, // 重新生成 ID
    // 保留原 createdAt / updatedAt，避免导入后所有便签显示「刚刚」
    createdAt: n.createdAt,
    updatedAt: n.updatedAt
  }));
  return [...existingNotes, ...imported];
}

module.exports = {
  COLORS,
  CATEGORIES,
  TRASH_MAX_DAYS,
  generateId,
  createNote,
  createTrashNote,
  loadNotes,
  loadAll,
  saveNotes,
  saveAll,
  addNote,
  updateNote,
  deleteNote,
  moveToTrash,
  restoreNote,
  deleteFromTrash,
  emptyTrash,
  autoCleanTrash,
  getTrashDaysLeft,
  togglePin,
  searchNotes,
  filterByCategory,
  sortNotes,
  getStats,
  exportNotes,
  importNotes,
  defaultDataPath
};
