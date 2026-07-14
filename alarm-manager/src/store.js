// 闹钟管家 - 本地存储模块（纯 Node API，可在主进程和测试中复用）
// 数据存储路径：app.getPath('userData')/alarms.json
// 设计目标：原子写入、UTF-8 编码、自动备份、导入导出

const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(
  process.env.APPDATA || process.env.HOME || __dirname,
  'alarm-manager',
  'alarms.json'
);

// 默认数据结构
function defaultData() {
  return {
    version: 1,
    alarms: [],          // 闹钟列表
    settings: {
      defaultSound: 'chime',         // 默认铃声 key
      defaultSnoozeMinutes: 5,       // 默认贪睡分钟
      maxSnoozeCount: 3,             // 默认最大贪睡次数
      volumeFadeIn: true,            // 渐强
      volumeFadeInDuration: 15,      // 渐强秒数
      maxVolume: 0.9,                // 最大音量 0..1
      notificationEnabled: true,     // 系统通知
      bringToFront: true,            // 触发时窗口置顶
      autoStartAtLogin: false        // 开机自启
    },
    logs: []              // 触发历史（最近 200 条）
  };
}

// 合并默认值与读取值（避免新字段缺失）
function mergeWithDefaults(raw) {
  const base = defaultData();
  if (!raw || typeof raw !== 'object') return base;
  return {
    version: raw.version || base.version,
    alarms: Array.isArray(raw.alarms) ? raw.alarms : [],
    settings: Object.assign({}, base.settings, raw.settings || {}),
    logs: Array.isArray(raw.logs) ? raw.logs.slice(-200) : []
  };
}

function ensureDir(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 读取数据，失败返回默认值
function load(file) {
  file = file || DEFAULT_FILE;
  try {
    if (!fs.existsSync(file)) return defaultData();
    const buf = fs.readFileSync(file);
    const text = buf.toString('utf8');
    const parsed = JSON.parse(text);
    return mergeWithDefaults(parsed);
  } catch (err) {
    return defaultData();
  }
}

// 原子写入：写到 .tmp，再重命名
function save(data, file) {
  file = file || DEFAULT_FILE;
  ensureDir(file);
  const text = JSON.stringify(data, null, 2);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  // 备份上一版
  try {
    if (fs.existsSync(file)) {
      const bak = file + '.bak';
      fs.copyFileSync(file, bak);
    }
  } catch (e) { /* 备份失败不影响保存 */ }
  fs.renameSync(tmp, file);
  return true;
}

// 添加日志，保留最近 200 条
function appendLog(data, entry) {
  data.logs = Array.isArray(data.logs) ? data.logs : [];
  data.logs.push(Object.assign({ time: Date.now() }, entry));
  if (data.logs.length > 200) {
    data.logs = data.logs.slice(-200);
  }
}

// 导出 JSON（备份用）
function exportJson(data) {
  return JSON.stringify(data, null, 2);
}

// 导入 JSON（合并校验）
function importJson(text) {
  const parsed = JSON.parse(text);
  return mergeWithDefaults(parsed);
}

// 生成新闹钟 ID（短而唯一）
function newId() {
  return 'a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

module.exports = {
  DEFAULT_FILE,
  defaultData,
  mergeWithDefaults,
  load,
  save,
  appendLog,
  exportJson,
  importJson,
  newId
};
