'use strict';

/**
 * 文本管家核心文本处理模块
 * 纯函数实现，不依赖任何外部库，可在 Node 和浏览器环境运行
 * 所有函数对非法输入做容错处理，不会抛出异常打断用户操作
 */

// ---------- 工具函数 ----------

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeLines(text) {
  if (text === null || text === undefined) return [];
  // 统一换行符为 \n 再 split
  return String(text).replace(/\r\n?/g, '\n').split('\n');
}

function joinLines(lines) {
  return lines.join('\n');
}

// ---------- 1. 批量替换 ----------

/**
 * 批量替换
 * @param {string} text 原文
 * @param {object} opts
 *   - find: 查找内容
 *   - replace: 替换为
 *   - useRegex: 是否正则模式
 *   - caseSensitive: 区分大小写
 *   - multiline: 多行模式
 *   - global: 全局替换（默认 true）
 *   - wholeWord: 全字匹配
 */
function replaceText(text, opts) {
  opts = opts || {};
  const find = opts.find === undefined ? '' : String(opts.find);
  const replacement = opts.replace === undefined ? '' : String(opts.replace);
  if (find === '') return String(text === null || text === undefined ? '' : text);

  let pattern;
  if (opts.useRegex) {
    try {
      const flags = (opts.global === false ? '' : 'g') + (opts.caseSensitive ? '' : 'i') + (opts.multiline ? 'm' : '');
      pattern = new RegExp(find, flags);
    } catch (e) {
      // 正则非法，回退到字面量
      pattern = new RegExp(escapeRegExp(find), 'g');
    }
  } else {
    const flags = (opts.global === false ? '' : 'g') + (opts.caseSensitive ? '' : 'i');
    pattern = new RegExp(escapeRegExp(find), flags);
  }

  if (opts.wholeWord) {
    // 重建为全字匹配（仅在非正则模式下生效有意义）
    const src = opts.useRegex ? find : escapeRegExp(find);
    const flags = (opts.global === false ? '' : 'g') + (opts.caseSensitive ? '' : 'i') + (opts.multiline ? 'm' : '');
    try {
      pattern = new RegExp('\\b' + src + '\\b', flags);
    } catch (e) {
      // 保持原 pattern
    }
  }

  // 处理正则中的 $ 字符：用户可能想用 $1 等捕获组，保留原行为
  return String(text).replace(pattern, replacement);
}

// ---------- 2. 文本分割 ----------

/**
 * 文本分割
 * @param {string} text
 * @param {object} opts
 *   - mode: 'separator' | 'length' | 'lines' | 'regex'
 *   - separator: 分隔符（mode=separator）
 *   - length: 每段长度（mode=length）
 *   - keepEmpty: 是否保留空段
 *   - limit: 最多段数（0 表示不限制）
 */
function splitText(text, opts) {
  opts = opts || {};
  const input = String(text === null || text === undefined ? '' : text);
  let parts;

  switch (opts.mode) {
    case 'length': {
      const len = Math.max(1, parseInt(opts.length, 10) || 1);
      parts = [];
      for (let i = 0; i < input.length; i += len) {
        parts.push(input.slice(i, i + len));
      }
      break;
    }
    case 'lines': {
      parts = input.replace(/\r\n?/g, '\n').split('\n');
      break;
    }
    case 'regex': {
      try {
        const flags = opts.caseSensitive ? '' : 'i';
        parts = input.split(new RegExp(opts.separator, flags));
      } catch (e) {
        parts = [input];
      }
      break;
    }
    case 'separator':
    default: {
      const sep = opts.separator === undefined ? ',' : String(opts.separator);
      if (sep === '') {
        parts = input.split('');
      } else {
        parts = input.split(sep);
      }
      break;
    }
  }

  if (opts.keepEmpty === false) {
    parts = parts.filter(p => p !== '');
  }
  if (opts.limit && opts.limit > 0) {
    parts = parts.slice(0, opts.limit);
  }
  return parts;
}

// ---------- 3. 模式提取 ----------

/**
 * 模式提取
 * @param {string} text
 * @param {object} opts
 *   - pattern: 正则表达式字符串
 *   - group: 提取的捕获组序号（0=整体匹配，1=第一个捕获组）
 *   - caseSensitive
 *   - multiline
 *   - unique: 是否去重
 */
function extractText(text, opts) {
  opts = opts || {};
  const input = String(text === null || text === undefined ? '' : text);
  const patternStr = opts.pattern === undefined ? '' : String(opts.pattern);
  if (patternStr === '') return [];

  let regex;
  try {
    const flags = 'g' + (opts.caseSensitive ? '' : 'i') + (opts.multiline ? 'm' : '');
    regex = new RegExp(patternStr, flags);
  } catch (e) {
    return [];
  }

  const results = [];
  let m;
  const seen = Object.create(null);
  while ((m = regex.exec(input)) !== null) {
    const groupIdx = Math.max(0, parseInt(opts.group, 10) || 0);
    const value = m[groupIdx] !== undefined ? m[groupIdx] : m[0];
    if (opts.unique) {
      if (seen[value]) continue;
      seen[value] = true;
    }
    results.push(value);
    if (m.index === regex.lastIndex) regex.lastIndex++;
  }
  return results;
}

// ---------- 4. 大小写转换 ----------

function caseConvert(text, mode) {
  const input = String(text === null || text === undefined ? '' : text);
  switch (mode) {
    case 'upper':
      return input.toUpperCase();
    case 'lower':
      return input.toLowerCase();
    case 'capitalize':
      // 每个单词首字母大写（其余小写）
      return input.replace(/\b\w/g, c => c.toUpperCase()).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    case 'title': {
      // 标题式：每个单词首字母大写
      return input.replace(/\b\w/g, c => c.toUpperCase());
    }
    case 'sentence': {
      // 句首大写
      return input.replace(/(^\s*|[.!?。！？\n]\s+)([a-z\u4e00-\u9fa5])/g,
        (_, pre, ch) => pre + ch.toUpperCase());
    }
    case 'camel': {
      // 驼峰 helloWorld
      const words = splitToWords(input);
      if (words.length === 0) return '';
      return words.map((w, i) => i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join('');
    }
    case 'pascal': {
      // 帕斯卡 HelloWorld
      const words = splitToWords(input);
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    }
    case 'snake': {
      const words = splitToWords(input);
      return words.map(w => w.toLowerCase()).join('_');
    }
    case 'kebab': {
      const words = splitToWords(input);
      return words.map(w => w.toLowerCase()).join('-');
    }
    case 'invert': {
      // 大小写互换
      let out = '';
      for (const ch of input) {
        if (ch >= 'a' && ch <= 'z') out += ch.toUpperCase();
        else if (ch >= 'A' && ch <= 'Z') out += ch.toLowerCase();
        else out += ch;
      }
      return out;
    }
    case 'alternating': {
      // 交替大小写 aLtErNaTiNg
      let out = '';
      let lower = true;
      for (const ch of input) {
        if (/[a-zA-Z]/.test(ch)) {
          out += lower ? ch.toLowerCase() : ch.toUpperCase();
          lower = !lower;
        } else {
          out += ch;
        }
      }
      return out;
    }
    default:
      return input;
  }
}

function splitToWords(input) {
  // 把任意分隔符（空格、标点、连字符、下划线、驼峰边界）切分为单词
  const s = input
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // 驼峰边界
    .replace(/[_\-\.\s,;:!?]+/g, ' ');
  return s.split(' ').map(w => w.trim()).filter(w => w.length > 0);
}

// ---------- 5. 去重 ----------

/**
 * 按行去重
 * @param {string} text
 * @param {object} opts
 *   - caseSensitive: 区分大小写
 *   - trim: 去除行首尾空白后比较
 *   - keepEmpty: 保留空行
 *   - keepOrder: 保留首次出现顺序（默认 true）
 */
function dedupeLines(text, opts) {
  opts = opts || {};
  const lines = safeLines(text);
  const seen = Object.create(null);
  const result = [];
  for (let line of lines) {
    let key = line;
    if (opts.trim) key = key.trim();
    // 默认区分大小写；仅当显式传 caseSensitive:false 时不区分
    if (opts.caseSensitive === false) key = key.toLowerCase();
    if (key === '') {
      // 默认保留所有空行（不去重空行）；显式 keepEmpty:false 时丢弃
      if (opts.keepEmpty === false) continue;
      result.push(line);
      continue;
    }
    if (seen[key]) continue;
    seen[key] = true;
    result.push(line);
  }
  return joinLines(result);
}

/**
 * 按相似度去重（基于简单的字符集相似度）
 * 阈值 0~1，越接近 1 表示越严格（只有几乎相同才算重复）
 */
function dedupeBySimilarity(text, threshold) {
  threshold = threshold === undefined ? 0.9 : Math.max(0, Math.min(1, threshold));
  const lines = safeLines(text).filter(l => l.trim() !== '');
  const result = [];
  for (const line of lines) {
    let isDup = false;
    for (const kept of result) {
      if (similarity(line, kept) >= threshold) {
        isDup = true;
        break;
      }
    }
    if (!isDup) result.push(line);
  }
  return joinLines(result);
}

// 简单的 Jaccard 相似度（基于字符 bigram）
function similarity(a, b) {
  if (a === b) return 1;
  const setA = bigrams(a);
  const setB = bigrams(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let inter = 0;
  for (const g of setA) if (setB.has(g)) inter++;
  return inter / (setA.size + setB.size - inter);
}

function bigrams(s) {
  const set = new Set();
  s = String(s);
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

// ---------- 额外实用操作：行处理 ----------

function trimLines(text) {
  return safeLines(text).map(l => l.trim()).join('\n');
}

function removeEmptyLines(text) {
  return safeLines(text).filter(l => l.trim() !== '').join('\n');
}

function sortLines(text, opts) {
  opts = opts || {};
  let lines = safeLines(text);
  if (opts.ignoreCase) {
    lines.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  } else {
    lines.sort();
  }
  if (opts.descending) lines.reverse();
  return joinLines(lines);
}

function reverseLines(text) {
  return safeLines(text).reverse().join('\n');
}

function addLineNumber(text, opts) {
  opts = opts || {};
  const lines = safeLines(text);
  const pad = String(lines.length).length;
  return lines.map((l, i) => {
    const num = opts.startAt === undefined ? i + 1 : i + opts.startAt;
    const sep = opts.separator || '. ';
    return String(num).padStart(pad, '0') + sep + l;
  }).join('\n');
}

function addPrefixSuffix(text, opts) {
  opts = opts || {};
  const prefix = opts.prefix === undefined ? '' : String(opts.prefix);
  const suffix = opts.suffix === undefined ? '' : String(opts.suffix);
  return safeLines(text).map(l => prefix + l + suffix).join('\n');
}

// ---------- 统计 ----------

function countStats(text) {
  const input = String(text === null || text === undefined ? '' : text);
  const lines = input === '' ? 0 : input.replace(/\r\n?/g, '\n').split('\n').length;
  const chars = input.length;
  const charsNoSpace = input.replace(/\s/g, '').length;
  // 词数：英文按空白切分，中文按字符
  const englishWords = (input.match(/[a-zA-Z0-9']+/g) || []).length;
  const chineseChars = (input.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = englishWords + chineseChars;
  const paragraphs = input.split(/\n\s*\n/).filter(p => p.trim() !== '').length;
  return { chars, charsNoSpace, words, lines, paragraphs, englishWords, chineseChars };
}

// ---------- 导出 ----------

const textOps = {
  // 工具
  escapeRegExp,
  // 主操作
  replaceText,
  splitText,
  extractText,
  caseConvert,
  dedupeLines,
  dedupeBySimilarity,
  // 行处理
  trimLines,
  removeEmptyLines,
  sortLines,
  reverseLines,
  addLineNumber,
  addPrefixSuffix,
  // 统计
  countStats,
  // 暴露给测试
  _similarity: similarity,
  _splitToWords: splitToWords,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = textOps;
}
if (typeof window !== 'undefined') {
  window.TextOps = textOps;
}
