// 正则管家 - 正则表达式核心引擎
// 负责正则匹配、捕获组提取、替换预览等核心逻辑

'use strict';

/**
 * 解析标志字符串为对象
 * @param {string} flags - 标志字符串，如 "gim"
 * @returns {object} 标志对象
 */
function parseFlags(flags) {
  return {
    global: flags.includes('g'),
    ignoreCase: flags.includes('i'),
    multiline: flags.includes('m'),
    dotAll: flags.includes('s'),
    unicode: flags.includes('u'),
    sticky: flags.includes('y')
  };
}

/**
 * 执行正则匹配，返回结构化结果
 * @param {string} pattern - 正则表达式字符串
 * @param {string} flags - 标志字符串
 * @param {string} testString - 待匹配的字符串
 * @returns {object} 匹配结果 { ok, matches, error, groupNames }
 */
function executeRegex(pattern, flags, testString) {
  if (!pattern) {
    return { ok: false, matches: [], error: '请输入正则表达式', groupCount: 0 };
  }
  if (testString === null || testString === undefined) {
    testString = '';
  }

  let re;
  try {
    re = new RegExp(pattern, flags);
  } catch (e) {
    return { ok: false, matches: [], error: '正则语法错误：' + e.message, groupCount: 0 };
  }

  const matches = [];
  let groupCount = 0;

  try {
    if (re.global) {
      // 全局匹配：收集所有匹配
      let m;
      let guard = 0;
      while ((m = re.exec(testString)) !== null) {
        const match = {
          value: m[0],
          index: m.index,
          end: m.index + m[0].length,
          groups: []
        };
        for (let i = 1; i < m.length; i++) {
          match.groups.push(m[i] === undefined ? null : m[i]);
        }
        if (m.groups) {
          // 命名捕获组
          const named = {};
          for (const key of Object.keys(m.groups)) {
            named[key] = m.groups[key] === undefined ? null : m.groups[key];
          }
          match.namedGroups = named;
        }
        matches.push(match);
        if (match.groups.length > groupCount) groupCount = match.groups.length;

        // 防止零宽匹配死循环
        if (m[0] === '') {
          re.lastIndex++;
        }
        guard++;
        if (guard > 100000) break; // 安全上限
      }
    } else {
      // 非全局：只匹配第一个
      const m = re.exec(testString);
      if (m) {
        const match = {
          value: m[0],
          index: m.index,
          end: m.index + m[0].length,
          groups: []
        };
        for (let i = 1; i < m.length; i++) {
          match.groups.push(m[i] === undefined ? null : m[i]);
        }
        if (m.groups) {
          const named = {};
          for (const key of Object.keys(m.groups)) {
            named[key] = m.groups[key] === undefined ? null : m.groups[key];
          }
          match.namedGroups = named;
        }
        matches.push(match);
        groupCount = match.groups.length;
      }
    }
  } catch (e) {
    return { ok: false, matches: [], error: '执行错误：' + e.message, groupCount: 0 };
  }

  return { ok: true, matches, error: null, groupCount };
}

/**
 * 执行替换并返回预览
 * @param {string} pattern - 正则表达式字符串
 * @param {string} flags - 标志字符串
 * @param {string} testString - 原始字符串
 * @param {string} replacement - 替换文本（支持 $1 $2 $& 等）
 * @returns {object} { ok, result, replacements, error }
 */
function executeReplace(pattern, flags, testString, replacement) {
  if (!pattern) {
    return { ok: false, result: testString, replacements: 0, error: '请输入正则表达式' };
  }
  if (testString === null || testString === undefined) testString = '';
  if (replacement === null || replacement === undefined) replacement = '';

  // 替换需要 global 标志才能替换全部，否则只替换第一个
  let actualFlags = flags;
  if (!actualFlags.includes('g')) {
    actualFlags += 'g';
  }

  let re;
  try {
    re = new RegExp(pattern, actualFlags);
  } catch (e) {
    return { ok: false, result: testString, replacements: 0, error: '正则语法错误：' + e.message };
  }

  // 先统计匹配数量（用 executeRegex 复用逻辑）
  const matchResult = executeRegex(pattern, actualFlags, testString);
  if (!matchResult.ok) {
    return { ok: false, result: testString, replacements: 0, error: matchResult.error };
  }
  const count = matchResult.matches.length;

  let result;
  try {
    // 使用字符串替换，$1 $2 $& 等语法由 String.replace 原生处理
    result = testString.replace(re, replacement);
  } catch (e) {
    return { ok: false, result: testString, replacements: 0, error: '替换错误：' + e.message };
  }

  return { ok: true, result, replacements: count, error: null };
}

/**
 * 生成匹配高亮的 HTML（用于渲染层）
 * 返回分段数组，每段标注是否为匹配
 * @param {string} testString - 原始字符串
 * @param {array} matches - executeRegex 返回的 matches
 * @returns {array} 段数组 [{ text, isMatch, matchIndex, groups }]
 */
function buildHighlightSegments(testString, matches) {
  if (!testString) return [];
  if (!matches || matches.length === 0) {
    return [{ text: testString, isMatch: false }];
  }

  const segments = [];
  let cursor = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    // 匹配前的不匹配文本
    if (m.index > cursor) {
      segments.push({
        text: testString.slice(cursor, m.index),
        isMatch: false
      });
    }
    // 匹配文本
    segments.push({
      text: testString.slice(m.index, m.end),
      isMatch: true,
      matchIndex: i,
      groups: m.groups
    });
    cursor = m.end;
  }

  // 末尾剩余文本
  if (cursor < testString.length) {
    segments.push({
      text: testString.slice(cursor),
      isMatch: false
    });
  }

  return segments;
}

/**
 * 转义 HTML 特殊字符，防止注入
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 转义正则元字符，用于字面量匹配
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  parseFlags,
  executeRegex,
  executeReplace,
  buildHighlightSegments,
  escapeHtml,
  escapeRegExp
};
