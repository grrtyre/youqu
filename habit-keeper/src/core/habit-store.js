// 习惯数据存储引擎 - 读写本地 JSON 文件
// 数据结构：
// {
//   habits: [
//     { id, name, icon, color, target, createdAt, archived, records: ['2026-07-07', ...] }
//   ],
//   version: 1
// }

const fs = require('fs');
const path = require('path');
const { toDateKey } = require('./habit-utils');

class HabitStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { habits: [], version: 1 };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.habits)) {
          this.data = { version: 1, ...parsed };
        }
      }
    } catch (e) {
      // 数据损坏时备份并重置
      if (fs.existsSync(this.filePath)) {
        const bak = this.filePath + '.bak.' + Date.now();
        try { fs.copyFileSync(this.filePath, bak); } catch (_) {}
      }
      this.data = { habits: [], version: 1 };
    }
  }

  _save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  list() {
    return this.data.habits.filter((h) => !h.archived);
  }

  listAll() {
    return this.data.habits;
  }

  get(id) {
    return this.data.habits.find((h) => h.id === id);
  }

  create({ name, icon = '✅', color = '#007aff', target = 1 }) {
    const habit = {
      id: 'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      name: String(name || '').trim() || '新习惯',
      icon,
      color,
      target: Math.max(1, parseInt(target, 10) || 1),
      createdAt: new Date().toISOString(),
      archived: false,
      records: [],
    };
    this.data.habits.push(habit);
    this._save();
    return habit;
  }

  update(id, patch) {
    const h = this.get(id);
    if (!h) return null;
    if (patch.name !== undefined) h.name = String(patch.name).trim() || h.name;
    if (patch.icon !== undefined) h.icon = patch.icon;
    if (patch.color !== undefined) h.color = patch.color;
    if (patch.target !== undefined) h.target = Math.max(1, parseInt(patch.target, 10) || h.target);
    if (patch.archived !== undefined) h.archived = !!patch.archived;
    this._save();
    return h;
  }

  remove(id) {
    const idx = this.data.habits.findIndex((h) => h.id === id);
    if (idx >= 0) {
      const [removed] = this.data.habits.splice(idx, 1);
      this._save();
      return removed;
    }
    return null;
  }

  isDone(id, date = new Date()) {
    const h = this.get(id);
    if (!h) return false;
    return h.records.includes(toDateKey(date));
  }

  toggle(id, date = new Date()) {
    const h = this.get(id);
    if (!h) return null;
    const key = toDateKey(date);
    const i = h.records.indexOf(key);
    if (i >= 0) {
      h.records.splice(i, 1);
    } else {
      h.records.push(key);
      h.records.sort();
    }
    this._save();
    return { done: i < 0, key, records: h.records };
  }

  setDone(id, date = new Date(), done = true) {
    const h = this.get(id);
    if (!h) return null;
    const key = toDateKey(date);
    const has = h.records.includes(key);
    if (done && !has) {
      h.records.push(key);
      h.records.sort();
    } else if (!done && has) {
      h.records.splice(h.records.indexOf(key), 1);
    }
    this._save();
    return { key, records: h.records };
  }

  /** 导出 JSON 字符串 */
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  /** 从 JSON 字符串导入并覆盖 */
  importJSON(json) {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.habits)) throw new Error('无效的导入数据');
    this.data = { version: 1, ...parsed };
    this._save();
    return this.data;
  }
}

module.exports = { HabitStore };
