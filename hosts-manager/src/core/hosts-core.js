'use strict';
// Hosts管家 - 核心逻辑
// 解析/序列化 hosts 文件，方案管理，模板库

const path = require('path');

// ==================== hosts 文件解析 ====================

/**
 * 解析 hosts 文本为结构化条目数组
 * 条目类型：
 *   - entry: { type:'entry', ip, hostnames:[], comment, enabled, raw }
 *   - comment: { type:'comment', text, raw }
 *   - blank: { type:'blank', raw:'' }
 * @param {string} text - hosts 文件原始内容
 * @returns {Array} 条目数组
 */
function parseHosts(text) {
  const lines = String(text || '').split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    // 空行
    if (trimmed === '') {
      items.push({ type: 'blank', raw: '' });
      continue;
    }
    // 纯注释行（不以 # 开头但后面紧跟 IP 模式的视为被注释的条目）
    if (trimmed.startsWith('#')) {
      // 尝试判断是否是被注释掉的条目（# 127.0.0.1 localhost）
      const afterHash = trimmed.substring(1).trim();
      const entryMatch = matchEntry(afterHash);
      if (entryMatch) {
        // 被注释的条目 —— enabled: false
        items.push({
          type: 'entry',
          ip: entryMatch.ip,
          hostnames: entryMatch.hostnames,
          comment: entryMatch.comment,
          enabled: false,
          raw: raw
        });
      } else {
        items.push({ type: 'comment', text: trimmed.substring(1).trim(), raw: raw });
      }
      continue;
    }
    // 正常条目
    const entryMatch = matchEntry(trimmed);
    if (entryMatch) {
      items.push({
        type: 'entry',
        ip: entryMatch.ip,
        hostnames: entryMatch.hostnames,
        comment: entryMatch.comment,
        enabled: true,
        raw: raw
      });
    } else {
      // 无法识别的行，当作注释保留
      items.push({ type: 'comment', text: trimmed, raw: raw });
    }
  }
  return items;
}

/**
 * 从一行文本中匹配 IP + 主机名 + 注释
 * @param {string} line - 不含前导 # 的行
 * @returns {{ip:string, hostnames:string[], comment:string}|null}
 */
function matchEntry(line) {
  // IPv4 / IPv6 / 主机名通配
  // 格式: IP  hostname1 hostname2 ...  # comment
  const match = line.match(/^(\S+)\s+(.+?)(?:\s*#\s*(.*))?$/);
  if (!match) return null;
  const ip = match[1].trim();
  // 剩余部分可能包含主机名和注释
  let rest = match[2] || '';
  let comment = match[3] || '';
  // 如果 rest 中包含 #，需要分离
  if (!match[3] && rest.includes('#')) {
    const idx = rest.indexOf('#');
    comment = rest.substring(idx + 1).trim();
    rest = rest.substring(0, idx);
  }
  const hostnames = rest.trim().split(/\s+/).filter(Boolean);
  if (hostnames.length === 0) return null;
  // 简单校验 IP 格式（IPv4 / IPv6 / ::1 等）
  if (!isValidAddress(ip)) return null;
  return { ip, hostnames, comment: comment.trim() };
}

/**
 * 校验是否为合法的 IP 地址或主机名别名
 * 支持 IPv4、IPv6、::1、localhost 等
 */
function isValidAddress(str) {
  if (!str) return false;
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(str)) return true;
  // IPv6（简化判断：含冒号且字符合法）
  if (/^[0-9a-fA-F:]+$/.test(str) && str.includes(':')) return true;
  // 广播地址 / 通配
  if (str === '255.255.255.255' || str === '0.0.0.0') return true;
  return false;
}

// ==================== 序列化 ====================

/**
 * 将条目数组序列化为 hosts 文件文本
 * @param {Array} items - 条目数组
 * @returns {string}
 */
function serializeHosts(items) {
  return items.map(item => serializeLine(item)).join('\n');
}

function serializeLine(item) {
  if (item.type === 'blank') return '';
  if (item.type === 'comment') return '# ' + (item.text || '');
  if (item.type === 'entry') {
    const prefix = item.enabled ? '' : '# ';
    const hostPart = [item.ip, ...item.hostnames].join(' ');
    const commentPart = item.comment ? '  # ' + item.comment : '';
    return prefix + hostPart + commentPart;
  }
  return item.raw || '';
}

// ==================== 条目操作 ====================

/**
 * 切换条目的启用/禁用状态
 */
function toggleEntry(items, index) {
  if (items[index] && items[index].type === 'entry') {
    items[index] = { ...items[index], enabled: !items[index].enabled };
    items[index].raw = serializeLine(items[index]);
    return items;
  }
  return items;
}

/**
 * 添加新条目
 */
function addEntry(items, ip, hostnames, comment, enabled) {
  const hostArr = Array.isArray(hostnames) ? hostnames : String(hostnames).split(/\s+/).filter(Boolean);
  const entry = {
    type: 'entry',
    ip: ip.trim(),
    hostnames: hostArr,
    comment: (comment || '').trim(),
    enabled: enabled !== false,
    raw: ''
  };
  entry.raw = serializeLine(entry);
  return [...items, entry];
}

/**
 * 删除指定索引的条目
 */
function removeEntry(items, index) {
  return items.filter((_, i) => i !== index);
}

/**
 * 更新指定索引的条目
 */
function updateEntry(items, index, updates) {
  if (!items[index] || items[index].type !== 'entry') return items;
  const updated = { ...items[index], ...updates };
  updated.raw = serializeLine(updated);
  return items.map((item, i) => (i === index ? updated : item));
}

// ==================== 方案管理 ====================

/**
 * 默认方案模板库
 */
const TEMPLATES = [
  {
    name: 'GitHub 加速',
    description: 'GitHub IP 指向，加速访问',
    content: '# GitHub 加速\n140.82.112.3 github.com\n140.82.114.5 api.github.com\n185.199.108.133 raw.githubusercontent.com\n185.199.109.133 raw.githubusercontent.com\n185.199.110.133 raw.githubusercontent.com\n185.199.111.133 raw.githubusercontent.com\n140.82.112.6 live.github.com\n140.82.113.6 gist.github.com\n199.232.96.133 cloud.githubusercontent.com\n199.232.96.133 camo.githubusercontent.com\n199.232.96.133 avatars.githubusercontent.com\n199.232.96.133 avatars0.githubusercontent.com\n# 0.0.0.0 ads.github.com\n'
  },
  {
    name: '本地开发',
    description: '常用本地域名映射',
    content: '# 本地开发环境\n127.0.0.1 localhost\n::1 localhost\n127.0.0.1 dev.local\n127.0.0.1 api.local\n127.0.0.1 admin.local\n127.0.0.1 static.local\n# 127.0.0.1 staging.local\n'
  },
  {
    name: '广告屏蔽',
    description: '屏蔽常见广告域名',
    content: '# 广告屏蔽\n0.0.0.0 ad.example.com\n0.0.0.0 track.example.com\n0.0.0.0 analytics.example.com\n0.0.0.0 ads.example.com\n0.0.0.0 metrics.example.com\n0.0.0.0 telemetry.example.com\n'
  },
  {
    name: '空白模板',
    description: '从零开始编辑',
    content: '# My Hosts\n127.0.0.1 localhost\n'
  }
];

/**
 * 从条目数组提取为方案内容文本
 */
function itemsToContent(items) {
  return serializeHosts(items);
}

/**
 * 将方案内容文本转为条目数组
 */
function contentToItems(content) {
  return parseHosts(content);
}

// ==================== 差异对比 ====================

/**
 * 对比两段 hosts 内容，返回差异行列表
 * 基于 LCS（最长公共子序列）算法，正确处理中间插入/删除
 * @returns {Array<{type:'add'|'del'|'same', line:string}>}
 */
function diffContent(oldText, newText) {
  const oldLines = String(oldText || '').split(/\r?\n/);
  const newLines = String(newText || '').split(/\r?\n/);
  const m = oldLines.length;
  const n = newLines.length;

  // 构建 LCS 动态规划表
  // dp[i][j] = oldLines[0..i-1] 与 newLines[0..j-1] 的 LCS 长度
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1).fill(0);
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯生成 diff 序列
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'same', line: oldLines[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      result.unshift({ type: 'del', line: oldLines[i - 1] });
      i--;
    } else {
      result.unshift({ type: 'add', line: newLines[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    result.unshift({ type: 'del', line: oldLines[i - 1] });
    i--;
  }
  while (j > 0) {
    result.unshift({ type: 'add', line: newLines[j - 1] });
    j--;
  }
  return result;
}

// ==================== 统计 ====================

/**
 * 统计条目信息
 */
function getStats(items) {
  let enabled = 0, disabled = 0, comments = 0;
  for (const item of items) {
    if (item.type === 'entry') {
      if (item.enabled) enabled++;
      else disabled++;
    } else if (item.type === 'comment') {
      comments++;
    }
  }
  return { enabled, disabled, comments, total: enabled + disabled };
}

module.exports = {
  parseHosts,
  serializeHosts,
  serializeLine,
  toggleEntry,
  addEntry,
  removeEntry,
  updateEntry,
  TEMPLATES,
  itemsToContent,
  contentToItems,
  diffContent,
  getStats,
  isValidAddress,
  matchEntry
};
