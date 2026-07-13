// 抽签转盘管家 - 核心逻辑（纯函数，便于测试与主进程复用）
// 所有函数均不涉及文件 IO，仅操作数据对象

// 生成简易唯一 ID（不依赖 crypto，便于纯函数测试）
function genId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// 创建空数据结构
function createEmptyState() {
  return {
    lists: [],
    activeListId: null,
    history: [],
    settings: {
      spinDuration: 4500,       // 转动时长（毫秒）
      soundEnabled: true,       // 音效开关
      excludeWinner: false      // 抽中后自动剔除（不重复抽奖）
    }
  };
}

// 创建新名单
function createList(state, name) {
  const list = {
    id: genId(),
    name: String(name || '未命名名单').trim() || '未命名名单',
    entries: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  state.lists.push(list);
  if (!state.activeListId) state.activeListId = list.id;
  return list;
}

// 获取当前激活名单
function getActiveList(state) {
  if (!state.activeListId) return null;
  return state.lists.find(l => l.id === state.activeListId) || null;
}

// 切换激活名单
function setActiveList(state, listId) {
  if (!state.lists.some(l => l.id === listId)) return false;
  state.activeListId = listId;
  return true;
}

// 重命名名单
function renameList(state, listId, newName) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return false;
  list.name = String(newName || '').trim() || list.name;
  list.updatedAt = Date.now();
  return true;
}

// 删除名单
function deleteList(state, listId) {
  const idx = state.lists.findIndex(l => l.id === listId);
  if (idx < 0) return false;
  state.lists.splice(idx, 1);
  if (state.activeListId === listId) {
    state.activeListId = state.lists.length ? state.lists[0].id : null;
  }
  return true;
}

// 添加条目
function addEntry(state, listId, text, weight) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return null;
  const entry = {
    id: genId(),
    text: String(text || '').trim(),
    weight: Math.max(1, Number(weight) || 1),
    enabled: true
  };
  if (!entry.text) return null;
  list.entries.push(entry);
  list.updatedAt = Date.now();
  return entry;
}

// 批量添加条目（一行一个，自动去空白行）
function addEntriesBulk(state, listId, text) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return [];
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const added = [];
  for (const line of lines) {
    const entry = { id: genId(), text: line, weight: 1, enabled: true };
    list.entries.push(entry);
    added.push(entry);
  }
  list.updatedAt = Date.now();
  return added;
}

// 更新条目
function updateEntry(state, listId, entryId, patch) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return false;
  const entry = list.entries.find(e => e.id === entryId);
  if (!entry) return false;
  if (patch.text !== undefined) entry.text = String(patch.text).trim();
  if (patch.weight !== undefined) entry.weight = Math.max(1, Number(patch.weight) || 1);
  if (patch.enabled !== undefined) entry.enabled = !!patch.enabled;
  list.updatedAt = Date.now();
  return true;
}

// 删除条目
function deleteEntry(state, listId, entryId) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return false;
  const idx = list.entries.findIndex(e => e.id === entryId);
  if (idx < 0) return false;
  list.entries.splice(idx, 1);
  list.updatedAt = Date.now();
  return true;
}

// 清空名单条目
function clearEntries(state, listId) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return false;
  list.entries = [];
  list.updatedAt = Date.now();
  return true;
}

// 加权随机抽取一个有效条目
// 返回 { entry, index } 或 null（无有效条目时）
function pickWeighted(state, listId) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return null;
  const pool = list.entries.filter(e => e.enabled && e.text);
  if (!pool.length) return null;
  const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
  if (totalWeight <= 0) return null;
  let r = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i].weight;
    if (r < 0) {
      const idx = list.entries.indexOf(pool[i]);
      return { entry: pool[i], index: idx };
    }
  }
  const last = pool[pool.length - 1];
  return { entry: last, index: list.entries.indexOf(last) };
}

// 计算每个条目在转盘上所占的角度区间（弧度）
// 返回 [{ entry, start, end, mid }]，按 entries 顺序
function computeSegments(state, listId) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return [];
  const pool = list.entries.filter(e => e.enabled && e.text);
  if (!pool.length) return [];
  const totalWeight = pool.reduce((s, e) => s + Math.max(1, e.weight), 0);
  let acc = 0;
  const segs = [];
  for (const e of pool) {
    const w = Math.max(1, e.weight);
    const span = (w / totalWeight) * Math.PI * 2;
    segs.push({ entry: e, start: acc, end: acc + span, mid: acc + span / 2 });
    acc += span;
  }
  return segs;
}

// 记录一次抽签结果到历史
function recordHistory(state, listId, winnerText, mode) {
  const list = state.lists.find(l => l.id === listId);
  const record = {
    id: genId(),
    listId: listId,
    listName: list ? list.name : '(已删除)',
    winner: winnerText,
    timestamp: Date.now(),
    mode: mode || 'normal'
  };
  state.history.unshift(record);
  // 仅保留最近 100 条
  if (state.history.length > 100) state.history.length = 100;
  return record;
}

// 清空历史
function clearHistory(state) {
  state.history = [];
  return true;
}

// 删除单条历史
function deleteHistory(state, recordId) {
  const idx = state.history.findIndex(r => r.id === recordId);
  if (idx < 0) return false;
  state.history.splice(idx, 1);
  return true;
}

// 更新设置
function updateSettings(state, patch) {
  if (!patch || typeof patch !== 'object') return false;
  if (patch.spinDuration !== undefined) {
    state.settings.spinDuration = Math.max(2000, Math.min(10000, Number(patch.spinDuration) || 4500));
  }
  if (patch.soundEnabled !== undefined) state.settings.soundEnabled = !!patch.soundEnabled;
  if (patch.excludeWinner !== undefined) state.settings.excludeWinner = !!patch.excludeWinner;
  return true;
}

module.exports = {
  genId,
  createEmptyState,
  createList,
  getActiveList,
  setActiveList,
  renameList,
  deleteList,
  addEntry,
  addEntriesBulk,
  updateEntry,
  deleteEntry,
  clearEntries,
  pickWeighted,
  computeSegments,
  recordHistory,
  clearHistory,
  deleteHistory,
  updateSettings
};
