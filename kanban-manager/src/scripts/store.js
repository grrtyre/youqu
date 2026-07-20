// 看板数据核心逻辑（纯函数，可独立测试）
// 数据结构：
// state = { boards: [{ id, name, lists: [{ id, name, cards: [card] }], createdAt }], settings }
// card = { id, title, desc, labels: [string], due: ISO|null, priority: 'none|low|med|high', createdAt, completed }

function uid(prefix = 'c') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function nowISO() { return new Date().toISOString(); }

// 创建空看板
function createBoard(name = '新看板') {
  return {
    id: uid('b'),
    name,
    lists: [
      { id: uid('l'), name: '待办', cards: [] },
      { id: uid('l'), name: '进行中', cards: [] },
      { id: uid('l'), name: '已完成', cards: [] }
    ],
    createdAt: Date.now()
  };
}

// 创建卡片
function createCard(title, opts = {}) {
  return {
    id: uid('c'),
    title: String(title || '').trim(),
    desc: opts.desc || '',
    labels: Array.isArray(opts.labels) ? opts.labels.slice() : [],
    due: opts.due || null,
    priority: opts.priority || 'none',
    createdAt: Date.now(),
    completed: !!opts.completed
  };
}

// 在指定列表末尾添加卡片
function addCardToList(board, listId, card) {
  const list = board.lists.find(l => l.id === listId);
  if (!list) return false;
  list.cards.push(card);
  return true;
}

// 更新卡片字段
function updateCard(board, cardId, patch) {
  for (const list of board.lists) {
    const card = list.cards.find(c => c.id === cardId);
    if (card) {
      Object.assign(card, patch);
      return true;
    }
  }
  return false;
}

// 删除卡片
function deleteCard(board, cardId) {
  for (const list of board.lists) {
    const idx = list.cards.findIndex(c => c.id === cardId);
    if (idx >= 0) {
      list.cards.splice(idx, 1);
      return true;
    }
  }
  return false;
}

// 在列表间移动卡片（拖拽核心）
function moveCard(board, cardId, toListId, toIndex = -1) {
  let cardRef = null;
  for (const list of board.lists) {
    const idx = list.cards.findIndex(c => c.id === cardId);
    if (idx >= 0) {
      cardRef = list.cards.splice(idx, 1)[0];
      break;
    }
  }
  if (!cardRef) return false;
  const targetList = board.lists.find(l => l.id === toListId);
  if (!targetList) return false;
  if (toIndex < 0 || toIndex > targetList.cards.length) {
    targetList.cards.push(cardRef);
  } else {
    targetList.cards.splice(toIndex, 0, cardRef);
  }
  // 移到"已完成"列表自动标记完成
  if (/完成|done|done$/i.test(targetList.name)) {
    cardRef.completed = true;
  } else if (!/完成/.test(targetList.name) && cardRef.completed && targetList.name !== '已完成') {
    // 离开完成列保持原状态
  }
  return true;
}

// 在同列表内重排序
function reorderCard(board, cardId, toIndex) {
  for (const list of board.lists) {
    const idx = list.cards.findIndex(c => c.id === cardId);
    if (idx >= 0) {
      if (toIndex === idx) return true;
      const [card] = list.cards.splice(idx, 1);
      list.cards.splice(toIndex, 0, card);
      return true;
    }
  }
  return false;
}

// 创建列表
function addList(board, name = '新列表') {
  const list = { id: uid('l'), name, cards: [] };
  board.lists.push(list);
  return list;
}

// 重命名列表
function renameList(board, listId, name) {
  const list = board.lists.find(l => l.id === listId);
  if (!list) return false;
  list.name = name;
  return true;
}

// 删除列表
function deleteList(board, listId) {
  const idx = board.lists.findIndex(l => l.id === listId);
  if (idx < 0) return false;
  board.lists.splice(idx, 1);
  return true;
}

// 统计
function stats(board) {
  let total = 0, completed = 0, overdue = 0;
  const now = Date.now();
  for (const list of board.lists) {
    for (const c of list.cards) {
      total++;
      if (c.completed) completed++;
      if (c.due && new Date(c.due).getTime() < now && !c.completed) overdue++;
    }
  }
  return { total, completed, overdue, pending: total - completed };
}

// 过滤搜索
function searchCards(board, keyword) {
  const kw = String(keyword || '').toLowerCase().trim();
  if (!kw) return [];
  const results = [];
  for (const list of board.lists) {
    for (const c of list.cards) {
      if (c.title.toLowerCase().includes(kw) ||
          (c.desc || '').toLowerCase().includes(kw) ||
          (c.labels || []).some(l => String(l).toLowerCase().includes(kw))) {
        results.push({ card: c, listId: list.id, listName: list.name });
      }
    }
  }
  return results;
}

// 归档已完成（移除已完成卡片，保留计数）
function archiveCompleted(board) {
  let archived = 0;
  for (const list of board.lists) {
    const before = list.cards.length;
    list.cards = list.cards.filter(c => !c.completed);
    archived += before - list.cards.length;
  }
  return archived;
}

// 校验数据完整性
function validate(state) {
  const errors = [];
  if (!state || typeof state !== 'object') return ['state 非对象'];
  if (!Array.isArray(state.boards)) errors.push('boards 必须是数组');
  if (!state.settings || typeof state.settings !== 'object') errors.push('settings 缺失');
  for (const b of state.boards || []) {
    if (!b.id) errors.push('看板缺少 id');
    if (!Array.isArray(b.lists)) errors.push(`看板 ${b.id} 的 lists 非数组`);
    for (const l of b.lists || []) {
      if (!l.id) errors.push(`列表缺少 id`);
      if (!Array.isArray(l.cards)) errors.push(`列表 ${l.id} 的 cards 非数组`);
      for (const c of l.cards || []) {
        if (!c.id) errors.push('卡片缺少 id');
        if (typeof c.title !== 'string') errors.push(`卡片 ${c.id} title 非字符串`);
      }
    }
  }
  return errors;
}

// UMD：兼容 Node.js CommonJS 与浏览器全局
const __exports = {
  uid, nowISO,
  createBoard, createCard,
  addCardToList, updateCard, deleteCard,
  moveCard, reorderCard,
  addList, renameList, deleteList,
  stats, searchCards, archiveCompleted, validate
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = __exports;
}
if (typeof window !== 'undefined') {
  window.KanbanStore = __exports;
}
