'use strict';

/**
 * 日志管家 · 核心逻辑模块
 * 提供日志级别识别、行解析、过滤、搜索、统计等纯函数能力
 * 所有函数均为纯函数，无副作用，便于单元测试
 */

// 日志级别枚举（顺序即权重，越往后越严重）
const LEVELS = {
  TRACE: { name: 'TRACE', weight: 0, color: '#8e8e93' },
  DEBUG: { name: 'DEBUG', weight: 1, color: '#5856d6' },
  INFO:  { name: 'INFO',  weight: 2, color: '#007aff' },
  WARN:  { name: 'WARN',  weight: 3, color: '#ff9500' },
  ERROR: { name: 'ERROR', weight: 4, color: '#ff3b30' },
  FATAL: { name: 'FATAL', weight: 5, color: '#af52de' }
};

// 级别识别正则：覆盖常见日志格式
// 1) [INFO] / [ERROR]   2) 2024-01-01 12:00:00 INFO  3) INFO -  4) level=info  5) "level":"info"
const LEVEL_PATTERNS = [
  /\[(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\]/i,
  /\b(?:TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\b/i,
  /level[=:]\s*["']?(trace|debug|info|warn(?:ing)?|error|fatal)["']?/i,
  /"level"\s*:\s*["'](trace|debug|info|warn(?:ing)?|error|fatal)["']/i
];

// 时间戳识别（常见格式）
const TS_PATTERNS = [
  // 2024-01-01 12:00:00.123
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/,
  // [2024-01-01 12:00:00]
  /\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?\]/,
  // 01/Jan/2024:12:00:00
  /\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}/,
  // 12:00:00.123
  /^\d{2}:\d{2}:\d{2}(?:\.\d+)?/
];

/**
 * 规范化级别名称：WARNIGN -> WARN，warning -> WARN
 */
function normalizeLevel(raw) {
  if (!raw) return null;
  const up = String(raw).toUpperCase().replace('ING', '');
  if (up === 'WARNING') return 'WARN';
  if (LEVELS[up]) return up;
  return null;
}

/**
 * 从单行日志文本中识别级别
 * @param {string} line
 * @returns {string|null} 级别名称（TRACE/DEBUG/INFO/WARN/ERROR/FATAL）或 null
 */
function detectLevel(line) {
  if (!line) return null;
  for (const pattern of LEVEL_PATTERNS) {
    const m = line.match(pattern);
    if (m) {
      // 取最后一个捕获组或第一个匹配
      const raw = m[1] || m[0];
      const lvl = normalizeLevel(raw);
      if (lvl) return lvl;
    }
  }
  return null;
}

/**
 * 尝试识别行首时间戳
 * @param {string} line
 * @returns {string|null} 时间戳字符串或 null
 */
function detectTimestamp(line) {
  if (!line) return null;
  for (const pattern of TS_PATTERNS) {
    const m = line.match(pattern);
    if (m) return m[0].replace(/^\[|\]$/g, '');
  }
  return null;
}

/**
 * 解析单行日志为结构化对象
 * @param {string} text 原始行文本
 * @param {number} lineNo 行号（从 1 开始）
 * @returns {{lineNo:number, raw:string, level:string|null, timestamp:string|null, message:string}}
 */
function parseLine(text, lineNo) {
  const raw = text || '';
  const level = detectLevel(raw);
  const timestamp = detectTimestamp(raw);
  let message = raw;
  // 尝试剥离时间戳和级别，得到纯净消息
  if (timestamp) {
    message = message.replace(timestamp, '').trim();
  }
  if (level) {
    // 移除首次出现的级别标记（中括号或裸词）
    message = message.replace(new RegExp('\\[?' + level + '\\]?', 'i'), '').trim();
  }
  // 清理多余的分隔符
  message = message.replace(/^[-:=\s|]+/, '').trim();
  return { lineNo, raw, level, timestamp, message: message || raw };
}

/**
 * 将整段日志文本解析为行数组
 * @param {string} content
 * @param {number} startLineNo 起始行号（默认 1）
 * @returns {Array} 解析后的行对象数组
 */
function parseContent(content, startLineNo = 1) {
  if (!content) return [];
  // 统一换行符
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  // 若末尾有空行（最后有换行），保留但不计入展示用空行
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    // 跳过文件末尾因结尾换行产生的空行
    if (i === lines.length - 1 && text === '') break;
    result.push(parseLine(text, startLineNo + i));
  }
  return result;
}

/**
 * 按级别过滤行
 * @param {Array} lines 解析后的行数组
 * @param {Object} levelFilter { TRACE:true, DEBUG:false, ... } 启用/禁用映射
 * @returns {Array} 过滤后的行数组（保留原行对象引用）
 */
function filterByLevel(lines, levelFilter) {
  if (!levelFilter) return lines;
  // 若全部启用，直接返回
  const allEnabled = Object.keys(LEVELS).every(l => levelFilter[l] !== false);
  if (allEnabled) return lines;
  return lines.filter(line => {
    const lvl = line.level || 'INFO'; // 无级别行视为 INFO，默认显示
    return levelFilter[lvl] !== false;
  });
}

/**
 * 关键词搜索
 * @param {Array} lines 解析后的行数组
 * @param {string} query 搜索词
 * @param {Object} opts { useRegex, caseSensitive, wholeWord }
 * @returns {{matches:Array, regex:RegExp|null}} 匹配的行索引数组及编译后的正则
 */
function searchLines(lines, query, opts = {}) {
  const { useRegex = false, caseSensitive = false, wholeWord = false } = opts;
  if (!query) return { matches: [], regex: null };
  let regex;
  try {
    let pattern = useRegex ? query : escapeRegex(query);
    if (wholeWord && !useRegex) pattern = '\\b' + pattern + '\\b';
    const flags = caseSensitive ? 'g' : 'gi';
    regex = new RegExp(pattern, flags);
  } catch (e) {
    // 正则非法，退化为字面量搜索
    regex = new RegExp(escapeRegex(query), caseSensitive ? 'g' : 'gi');
  }
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i].raw)) {
      matches.push(i);
    }
    // 重置 lastIndex（因为用了 g 标志）
    regex.lastIndex = 0;
  }
  return { matches, regex };
}

/**
 * 转义正则元字符
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 统计各级别行数
 * @param {Array} lines
 * @returns {Object} { TRACE:n, DEBUG:n, INFO:n, WARN:n, ERROR:n, FATAL:n, UNKNOWN:n, total:n }
 */
function countByLevel(lines) {
  const counts = {
    TRACE: 0, DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0, UNKNOWN: 0
  };
  for (const line of lines) {
    const lvl = line.level || 'UNKNOWN';
    if (counts[lvl] !== undefined) counts[lvl]++;
    else counts.UNKNOWN++;
  }
  counts.total = lines.length;
  return counts;
}

/**
 * 简易编码检测：根据 BOM 与字节特征判断 UTF-8 或 GBK
 * @param {Buffer} buf
 * @returns {string} 编码名称（utf-8 / utf-8-bom / gbk / binary）
 */
function detectEncoding(buf) {
  if (!buf || buf.length === 0) return 'utf-8';
  // BOM 检测
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return 'utf-8-bom';
  }
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) return 'utf-16le';
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) return 'utf-16be';
  // UTF-8 校验：若无非法字节序列则视为 UTF-8
  if (isValidUtf8(buf)) return 'utf-8';
  // 否则按 GBK 处理（中文 Windows 常见）
  return 'gbk';
}

/**
 * 校验 Buffer 是否为合法 UTF-8
 */
function isValidUtf8(buf) {
  let i = 0;
  let nonAscii = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b <= 0x7F) { i++; continue; }
    nonAscii++;
    if (nonAscii > 4) return true; // 已确认有非 ASCII，快速通过
    let need;
    if ((b & 0xE0) === 0xC0) need = 1;
    else if ((b & 0xF0) === 0xE0) need = 2;
    else if ((b & 0xF8) === 0xF0) need = 3;
    else return false; // 非法首字节
    for (let j = 1; j <= need; j++) {
      if (i + j >= buf.length) return false;
      if ((buf[i + j] & 0xC0) !== 0x80) return false;
    }
    i += 1 + need;
  }
  return true;
}

/**
 * 生成高亮 HTML：将行内匹配项用 <mark> 包裹
 * @param {string} text 原始文本
 * @param {RegExp|null} regex
 * @returns {string} HTML 转义后并含 <mark> 的安全字符串
 */
function highlightMatches(text, regex) {
  const safe = escapeHtml(text || '');
  if (!regex) return safe;
  // 重置正则状态
  regex.lastIndex = 0;
  // 在已转义文本上匹配需要处理 & < > 等实体，这里简化：对原文匹配后转义片段
  const parts = [];
  let last = 0;
  let m;
  const src = text || '';
  // 用一个新的非 g 正则做单次匹配循环
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const re = new RegExp(regex.source, flags);
  while ((m = re.exec(src)) !== null) {
    parts.push(escapeHtml(src.slice(last, m.index)));
    parts.push('<mark>' + escapeHtml(m[0]) + '</mark>');
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // 防止零宽匹配死循环
  }
  parts.push(escapeHtml(src.slice(last)));
  return parts.join('');
}

/**
 * HTML 转义
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 格式化字节数为人类可读
 */
function formatBytes(bytes) {
  if (bytes === 0 || bytes == null) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  const v = bytes / Math.pow(1024, i);
  return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + ' ' + units[i];
}

/**
 * 根据级别返回颜色
 */
function levelColor(level) {
  return (LEVELS[level] && LEVELS[level].color) || '#8e8e93';
}

/**
 * 获取所有级别名称（有序）
 */
function levelNames() {
  return ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
}

const _exports = {
  LEVELS,
  detectLevel,
  detectTimestamp,
  parseLine,
  parseContent,
  filterByLevel,
  searchLines,
  countByLevel,
  detectEncoding,
  isValidUtf8,
  highlightMatches,
  escapeHtml,
  escapeRegex,
  formatBytes,
  levelColor,
  levelNames,
  normalizeLevel
};

// 兼容 Node 与浏览器环境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
}
if (typeof window !== 'undefined') {
  window.LogCore = _exports;
}
