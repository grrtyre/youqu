// topmost-store.js - 自动置顶规则与窗口状态持久化（纯函数，便于单测）
const fs = require('fs');

// 规则文件结构：{ rules: [ { proc: 'notepad', enabled: true } ], autoPin: true }

function defaultData() {
  return { rules: [], autoPin: false };
}

function load(filePath) {
  try {
    if (!fs.existsSync(filePath)) return defaultData();
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return defaultData();
    if (!Array.isArray(data.rules)) data.rules = [];
    if (typeof data.autoPin !== 'boolean') data.autoPin = false;
    // 规整每条规则
    data.rules = data.rules
      .filter((r) => r && typeof r.proc === 'string' && r.proc.trim() !== '')
      .map((r) => ({ proc: r.proc.toLowerCase(), enabled: r.enabled !== false }));
    return data;
  } catch (e) {
    return defaultData();
  }
}

function save(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function addRule(data, proc) {
  const p = (proc || '').trim().toLowerCase();
  if (!p) return data;
  if (data.rules.some((r) => r.proc === p)) return data;
  data.rules.push({ proc: p, enabled: true });
  return data;
}

function removeRule(data, proc) {
  const p = (proc || '').trim().toLowerCase();
  data.rules = data.rules.filter((r) => r.proc !== p);
  return data;
}

function toggleRule(data, proc, enabled) {
  const p = (proc || '').trim().toLowerCase();
  const r = data.rules.find((x) => x.proc === p);
  if (r) r.enabled = !!enabled;
  return data;
}

// 判断某进程名是否命中"启用中"的自动置顶规则
function matchesRule(data, proc) {
  const p = (proc || '').trim().toLowerCase();
  if (!p) return false;
  return data.rules.some((r) => r.proc === p && r.enabled);
}

module.exports = {
  defaultData,
  load,
  save,
  addRule,
  removeRule,
  toggleRule,
  matchesRule,
};
