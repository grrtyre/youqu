// 时间记录存储 - 本地 JSON 文件持久化
'use strict';
const fs = require('fs');
const path = require('path');
const { genId, dateKey } = require('./time-utils');

class TimeStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { projects: [], records: [], active: null };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          projects: parsed.projects || [],
          records: parsed.records || [],
          active: parsed.active || null,
        };
      }
    } catch (e) {
      this.data = { projects: [], records: [], active: null };
    }
  }

  save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  // 确保有默认项目
  ensureDefault() {
    if (this.data.projects.length === 0) {
      this.createProject({ name: '工作', color: '#007aff' });
      this.createProject({ name: '学习', color: '#34c759' });
      this.createProject({ name: '其他', color: '#ff9500' });
    }
  }

  // ===== 项目 =====
  listProjects() {
    return this.data.projects.slice();
  }

  createProject({ name, color }) {
    const p = {
      id: genId(),
      name: name || '未命名项目',
      color: color || '#007aff',
      createdAt: Date.now(),
    };
    this.data.projects.push(p);
    this.save();
    return p;
  }

  updateProject(id, patch) {
    const p = this.data.projects.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch);
    this.save();
    return p;
  }

  removeProject(id) {
    this.data.projects = this.data.projects.filter((x) => x.id !== id);
    // 同时移除相关记录
    this.data.records = this.data.records.filter((r) => r.projectId !== id);
    if (this.data.active && this.data.active.projectId === id) {
      this.data.active = null;
    }
    this.save();
  }

  // ===== 计时 =====
  startTimer(projectId) {
    if (!this.data.projects.find((p) => p.id === projectId)) return null;
    // 若已在计时，先停止生成记录
    if (this.data.active) {
      this.stopTimer();
    }
    this.data.active = { projectId, start: Date.now() };
    this.save();
    return this.data.active;
  }

  stopTimer() {
    if (!this.data.active) return null;
    const { projectId, start } = this.data.active;
    const end = Date.now();
    const duration = end - start;
    const record = {
      id: genId(),
      projectId,
      start,
      end,
      duration,
      dateKey: dateKey(start),
      note: '',
    };
    this.data.records.push(record);
    this.data.active = null;
    this.save();
    return record;
  }

  cancelTimer() {
    this.data.active = null;
    this.save();
  }

  getActive() {
    return this.data.active;
  }

  // ===== 记录 =====
  listRecords() {
    return this.data.records.slice().sort((a, b) => b.start - a.start);
  }

  removeRecord(id) {
    this.data.records = this.data.records.filter((r) => r.id !== id);
    this.save();
  }

  updateRecord(id, patch) {
    const r = this.data.records.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, patch);
    this.save();
    return r;
  }

  // 手动添加记录
  addRecord({ projectId, start, end, note }) {
    const duration = end - start;
    if (duration <= 0) return null;
    const record = {
      id: genId(),
      projectId,
      start,
      end,
      duration,
      dateKey: dateKey(start),
      note: note || '',
    };
    this.data.records.push(record);
    this.save();
    return record;
  }

  // ===== 导出 =====
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  exportCSV() {
    // 按 RFC 4180 转义：所有字段用双引号包裹，字段内的双引号用两个双引号转义
    // 修复：项目名/备注含逗号、换行、双引号时不再破坏 CSV 结构
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const header = ['日期', '项目', '开始时间', '结束时间', '时长(分钟)', '备注'].map(esc).join(',');
    const rows = this.data.records
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((r) => {
        const proj = this.data.projects.find((p) => p.id === r.projectId);
        const name = proj ? proj.name : '已删除';
        const d = new Date(r.start);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const startStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const de = new Date(r.end);
        const endStr = `${String(de.getHours()).padStart(2, '0')}:${String(de.getMinutes()).padStart(2, '0')}`;
        const mins = Math.round(r.duration / 60000);
        return [dateStr, name, startStr, endStr, mins, r.note || ''].map(esc).join(',');
      });
    return '\uFEFF' + header + '\n' + rows.join('\n');
  }

  importJSON(str) {
    const parsed = JSON.parse(str);
    // 校验基本结构，避免坏文件覆盖已有数据
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('无效的数据格式：不是合法的 JSON 对象');
    }
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.records)) {
      throw new Error('无效的数据格式：缺少 projects 或 records 数组');
    }
    this.data = {
      projects: parsed.projects,
      records: parsed.records,
      active: parsed.active || null,
    };
    this.save();
    return this.data;
  }

  // 清空所有数据
  clearAll() {
    this.data = { projects: [], records: [], active: null };
    this.save();
  }
}

module.exports = { TimeStore };
