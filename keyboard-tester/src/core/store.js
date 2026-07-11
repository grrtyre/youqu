// 本地数据持久化 - 累计统计 + 打字测试历史
// 存储在 Electron userData 目录下的 keyboard-tester.json

const fs = require('fs');
const path = require('path');
const { StatsEngine } = require('./stats-engine');

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.stats = new StatsEngine();
    this.history = []; // 打字测试历史
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      this.stats = StatsEngine.fromJSON(data.stats);
      this.history = Array.isArray(data.history) ? data.history : [];
    } catch (e) {
      // 文件损坏则重置
      this.stats = new StatsEngine();
      this.history = [];
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = { stats: this.stats.toJSON(), history: this.history };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      // 静默失败，不阻塞 UI
    }
  }

  // 添加一条打字测试历史
  addHistory(record) {
    this.history.push({
      ts: Date.now(),
      wpm: record.wpm || 0,
      accuracy: record.accuracy || 0,
      durationSec: record.durationSec || 0,
      errors: record.errors || 0,
      length: record.length || 0,
    });
    // 只保留最近 50 条
    if (this.history.length > 50) this.history = this.history.slice(-50);
    this.save();
  }

  clearAll() {
    this.stats.reset();
    this.history = [];
    this.save();
  }

  clearHistory() {
    this.history = [];
    this.save();
  }
}

module.exports = { Store };
