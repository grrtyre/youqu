'use strict';
// 本地存储层：卡组/卡片持久化（JSON 文件，userData 目录）
// 数据结构：
// { decks: { [deckId]: { id, name, createdAt, cards: { [cardId]: card } } }, order: [deckId] }
// card: { id, front, back, note, tags:[], createdAt, ef, interval, reps, due, lastReview }

const fs = require('fs');
const path = require('path');

let DATA_FILE = null;

function setDataFile(p) { DATA_FILE = p; }
function getDataFile() {
  if (!DATA_FILE) throw new Error('data file not initialized');
  return DATA_FILE;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyState() {
  return { decks: {}, order: [] };
}

function load() {
  try {
    const raw = fs.readFileSync(getDataFile(), 'utf8');
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return emptyState();
    if (!s.decks || typeof s.decks !== 'object') s.decks = {};
    if (!Array.isArray(s.order)) s.order = [];
    return s;
  } catch (_) {
    return emptyState();
  }
}

function save(state) {
  try {
    const dir = path.dirname(getDataFile());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getDataFile(), JSON.stringify(state, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

// ---- 卡组操作 ----
function listDecks(state) {
  return state.order
    .filter((id) => state.decks[id])
    .map((id) => {
      const d = state.decks[id];
      const cards = Object.keys(d.cards || {});
      return {
        id: d.id,
        name: d.name,
        createdAt: d.createdAt,
        cardCount: cards.length
      };
    });
}

function createDeck(state, name) {
  name = (name || '').trim();
  if (!name) throw new Error('卡组名称不能为空');
  const id = uid();
  state.decks[id] = { id, name, createdAt: Date.now(), cards: {} };
  state.order.push(id);
  return state.decks[id];
}

function renameDeck(state, deckId, name) {
  name = (name || '').trim();
  if (!name) throw new Error('卡组名称不能为空');
  const d = state.decks[deckId];
  if (!d) throw new Error('卡组不存在');
  d.name = name;
  return d;
}

function deleteDeck(state, deckId) {
  if (!state.decks[deckId]) return false;
  delete state.decks[deckId];
  state.order = state.order.filter((id) => id !== deckId);
  return true;
}

// ---- 卡片操作 ----
function listCards(state, deckId) {
  const d = state.decks[deckId];
  if (!d) throw new Error('卡组不存在');
  return Object.keys(d.cards || {})
    .map((id) => d.cards[id])
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function getCard(state, deckId, cardId) {
  const d = state.decks[deckId];
  if (!d) return null;
  return (d.cards || {})[cardId] || null;
}

function addCard(state, deckId, fields) {
  const d = state.decks[deckId];
  if (!d) throw new Error('卡组不存在');
  const id = uid();
  const now = Date.now();
  const card = {
    id,
    front: (fields.front || '').toString(),
    back: (fields.back || '').toString(),
    note: (fields.note || '').toString(),
    tags: Array.isArray(fields.tags) ? fields.tags.slice(0, 20) : [],
    createdAt: now,
    ef: 2.5,
    interval: 0,
    reps: 0,
    due: now,
    lastReview: 0
  };
  d.cards[id] = card;
  return card;
}

function updateCard(state, deckId, cardId, fields) {
  const d = state.decks[deckId];
  if (!d) throw new Error('卡组不存在');
  const c = (d.cards || {})[cardId];
  if (!c) throw new Error('卡片不存在');
  if (typeof fields.front === 'string') c.front = fields.front;
  if (typeof fields.back === 'string') c.back = fields.back;
  if (typeof fields.note === 'string') c.note = fields.note;
  if (Array.isArray(fields.tags)) c.tags = fields.tags.slice(0, 20);
  return c;
}

function deleteCard(state, deckId, cardId) {
  const d = state.decks[deckId];
  if (!d) return false;
  if (!d.cards || !d.cards[cardId]) return false;
  delete d.cards[cardId];
  return true;
}

// 更新卡片调度字段（复习后调用）
function setCardSchedule(state, deckId, cardId, sched) {
  const d = state.decks[deckId];
  if (!d) throw new Error('卡组不存在');
  const c = (d.cards || {})[cardId];
  if (!c) throw new Error('卡片不存在');
  c.ef = sched.ef;
  c.interval = sched.interval;
  c.reps = sched.reps;
  c.due = sched.due;
  c.lastReview = sched.lastReview;
  return c;
}

// 导出/导入（整库）
function exportAll(state) {
  return JSON.parse(JSON.stringify(state));
}

function importAll(_oldState, incoming) {
  if (!incoming || typeof incoming !== 'object') throw new Error('导入数据格式无效');
  if (!incoming.decks || typeof incoming.decks !== 'object') throw new Error('缺少 decks 字段');
  if (!Array.isArray(incoming.order)) incoming.order = [];
  // 校验每个卡组/卡片基本字段，缺失则补默认
  Object.keys(incoming.decks).forEach((did) => {
    const d = incoming.decks[did];
    if (!d.cards) d.cards = {};
    Object.keys(d.cards).forEach((cid) => {
      const c = d.cards[cid];
      if (typeof c.ef !== 'number') c.ef = 2.5;
      if (typeof c.interval !== 'number') c.interval = 0;
      if (typeof c.reps !== 'number') c.reps = 0;
      if (typeof c.due !== 'number') c.due = Date.now();
      if (typeof c.lastReview !== 'number') c.lastReview = 0;
    });
  });
  return incoming;
}

module.exports = {
  setDataFile,
  getDataFile,
  emptyState,
  load,
  save,
  listDecks,
  createDeck,
  renameDeck,
  deleteDeck,
  listCards,
  getCard,
  addCard,
  updateCard,
  deleteCard,
  setCardSchedule,
  exportAll,
  importAll,
  uid
};
