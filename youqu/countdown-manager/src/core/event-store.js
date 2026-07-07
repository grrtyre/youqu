// event-store.js — 事件存储与 CRUD
// 职责：加载/保存 JSON 文件、增删改查、排序、导出导入

const fs = require('fs');
const path = require('path');
const { nextOccurrence } = require('./recurrence');
const { daysBetween, formatDate, solarToLunar } = require('./date-utils');

const DEFAULT_FILE = 'events.json';

// 创建带默认值的事件对象
function normalizeEvent(raw) {
  const now = Date.now();
  return {
    id: raw.id || ('evt_' + now.toString(36) + Math.random().toString(36).slice(2, 7)),
    title: String(raw.title || '未命名事件').slice(0, 60),
    date: raw.date || formatDate(new Date()),       // YYYY-MM-DD 公历
    calendar: raw.calendar === 'lunar' ? 'lunar' : 'solar',
    repeat: ['none', 'yearly', 'monthly'].includes(raw.repeat) ? raw.repeat : 'none',
    category: raw.category || 'life',               // life/work/study/anniversary/festival/other
    color: raw.color || '#007aff',
    note: String(raw.note || '').slice(0, 200),
    pinned: !!raw.pinned,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now
  };
}

// 加载事件列表
function load(filePath) {
  filePath = filePath || DEFAULT_FILE;
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(data)) return [];
    return data.map(normalizeEvent);
  } catch (e) {
    return [];
  }
}

// 保存
function save(events, filePath) {
  filePath = filePath || DEFAULT_FILE;
  fs.mkdirSync(path.dirname(filePath) || '.', { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf-8');
  return true;
}

// 新增
function add(events, raw) {
  const evt = normalizeEvent(raw);
  events.push(evt);
  return evt;
}

// 更新
function update(events, id, patch) {
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return null;
  events[idx] = normalizeEvent({ ...events[idx], ...patch, id, updatedAt: Date.now() });
  return events[idx];
}

// 删除
function remove(events, id) {
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return false;
  events.splice(idx, 1);
  return true;
}

// 计算事件的下一次发生日期与剩余天数
function computeStatus(event, from) {
  const base = from || new Date();
  const next = nextOccurrence(event, base);
  if (!next) {
    return { nextDate: null, days: 0, past: false, isToday: false };
  }
  const days = daysBetween(next, base); // 正数=未来
  return {
    nextDate: next,
    nextDateStr: formatDate(next),
    days,
    past: days < 0,
    isToday: days === 0,
    lunarInfo: event.calendar === 'lunar' ? solarToLunar(next) : null
  };
}

// 排序：置顶优先 → 未来事件按天数升序 → 过去事件按天数降序
function sortEvents(events, from) {
  const base = from || new Date();
  const withStatus = events.map(e => ({ event: e, status: computeStatus(e, base) }));
  withStatus.sort((a, b) => {
    if (a.event.pinned !== b.event.pinned) return a.event.pinned ? -1 : 1;
    const aFuture = a.status.days >= 0;
    const bFuture = b.status.days >= 0;
    if (aFuture && bFuture) return a.status.days - b.status.days;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return b.status.days - a.status.days; // 都过去：最近的在前
  });
  return withStatus;
}

// 导出 JSON 字符串
function exportJSON(events) {
  return JSON.stringify(events, null, 2);
}

// 导入 JSON（合并，去重按 id）
function importJSON(events, jsonStr) {
  const imported = JSON.parse(jsonStr);
  if (!Array.isArray(imported)) throw new Error('导入文件格式错误');
  const map = new Map(events.map(e => [e.id, e]));
  for (const raw of imported) {
    const evt = normalizeEvent(raw);
    map.set(evt.id, evt);
  }
  return Array.from(map.values());
}

module.exports = {
  DEFAULT_FILE,
  normalizeEvent,
  load, save, add, update, remove,
  computeStatus, sortEvents,
  exportJSON, importJSON
};
