// store.js - 本地数据存储管理
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.env.APPDATA || process.env.HOME || '.', 'subscription-manager');
const DATA_FILE = path.join(DATA_DIR, 'subscriptions.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.subscriptions)) {
        return data;
      }
    } catch (e) {
      // 数据损坏，返回默认
    }
  }
  return { subscriptions: [], settings: { currency: 'CNY', reminderDays: 3 } };
}

function saveData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { loadData, saveData, DATA_FILE };
