// rename-engine.js
// 核心重命名引擎 —— 纯逻辑模块，不依赖 Electron，可在 Node 中独立测试
//
// 规则类型（Rule.type）：
//   replace  - 文本替换      { find, replaceWith, caseSensitive, wholeWord }
//   regex    - 正则替换      { pattern, replacement, flags }
//   sequence - 序号命名      { prefix, start, step, pad, suffix, position }
//   date     - 日期命名      { source: mtime|ctime|birthtime|exif, format, position }
//   case     - 大小写转换    { mode: upper|lower|title|camel|snake }
//   insert   - 插入文本      { text, position }
//   remove   - 删除字符集    { chars }

const path = require('path');

// ---------- 工具函数 ----------

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 日期格式化：支持 YYYY YY MM DD HH mm ss 占位符
function formatDate(ts, format) {
  const d = new Date(ts);
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const map = {
    YYYY: d.getFullYear(),
    YY: String(d.getFullYear()).slice(-2),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds())
  };
  let result = format;
  // 按长度降序替换，避免 YY 被 YYYY 的子串误匹配
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    result = result.split(k).join(map[k]);
  }
  return result;
}

// ---------- 文件项构造 ----------

/**
 * 创建文件项
 * @param {string} filePath - 完整路径
 * @param {fs.Stats} stats - 文件 stat
 * @param {number} index - 在列表中的原始序号
 * @param {string|null} exifDate - EXIF 拍摄日期 ISO 字符串
 */
function createFileItem(filePath, stats, index, exifDate = null) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return {
    id: genId(),
    dir: path.dirname(filePath),
    name: path.basename(filePath),
    base,
    ext,
    size: stats.size,
    mtime: stats.mtimeMs,
    ctime: stats.ctimeMs,
    birthtime: stats.birthtimeMs,
    exifDate,
    index
  };
}

// ---------- 单条规则应用 ----------

/**
 * 应用单条规则到文件名（不含扩展名）
 * @param {string} baseName - 当前文件名（不含扩展名）
 * @param {string} ext - 扩展名（含 .）
 * @param {object} item - 文件项（date/sequence 等需要元数据）
 * @param {object} rule - 规则对象
 * @param {object} ctx - 上下文 { counter }
 * @returns {string} 新的 baseName
 */
function applyRule(baseName, ext, item, rule, ctx) {
  switch (rule.type) {
    case 'replace': {
      const { find, replaceWith = '', caseSensitive = true, wholeWord = false } = rule;
      if (!find) return baseName;
      const flags = caseSensitive ? 'g' : 'gi';
      if (wholeWord) {
        // 文件名友好的词边界：_ - . 空格 字符串首尾 视为分隔符
        // （JS 原生 \b 把 _ 当作单词字符，对文件名不友好）
        const pattern = new RegExp(
          `(^|[\\s_.\\-])${escapeRegex(find)}(?=$|[\\s_.\\-])`,
          flags
        );
        return baseName.replace(pattern, (match, prefix) => prefix + replaceWith);
      }
      const pattern = new RegExp(escapeRegex(find), flags);
      return baseName.replace(pattern, replaceWith);
    }

    case 'regex': {
      const { pattern: patternStr, replacement = '', flags = 'g' } = rule;
      if (!patternStr) return baseName;
      try {
        const re = new RegExp(patternStr, flags);
        return baseName.replace(re, replacement);
      } catch (e) {
        return baseName; // 正则无效，保持原样
      }
    }

    case 'sequence': {
      const {
        prefix = '', start = 1, step = 1, pad = 0, suffix = '',
        position = 'replace'
      } = rule;
      const seq = start + ctx.counter * step;
      ctx.counter += 1;
      const seqStr = pad > 0 ? String(seq).padStart(pad, '0') : String(seq);
      const token = `${prefix}${seqStr}${suffix}`;
      if (position === 'prefix') return token + baseName;
      if (position === 'suffix') return baseName + token;
      return token; // replace
    }

    case 'date': {
      const { source = 'mtime', format = 'YYYYMMDD', position = 'replace' } = rule;
      let ts;
      if (source === 'exif') {
        ts = item.exifDate ? new Date(item.exifDate).getTime() : item.mtime;
      } else if (source === 'ctime') {
        ts = item.ctime;
      } else if (source === 'birthtime') {
        ts = item.birthtime;
      } else {
        ts = item.mtime;
      }
      const token = formatDate(ts, format);
      if (position === 'prefix') return token + baseName;
      if (position === 'suffix') return baseName + token;
      return token; // replace
    }

    case 'case': {
      const { mode = 'upper' } = rule;
      switch (mode) {
        case 'upper': return baseName.toUpperCase();
        case 'lower': return baseName.toLowerCase();
        case 'title': return baseName.replace(/\b\w/g, c => c.toUpperCase());
        case 'camel': {
          const parts = baseName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
          if (parts.length === 0) return baseName;
          const camel = parts.map((p, i) =>
            i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
          ).join('');
          return camel;
        }
        case 'snake': {
          return baseName
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .replace(/[\s\-]+/g, '_')
            .toLowerCase();
        }
        default: return baseName;
      }
    }

    case 'insert': {
      const { text = '', position = 0 } = rule;
      const pos = Math.max(0, Math.min(position, baseName.length));
      return baseName.slice(0, pos) + text + baseName.slice(pos);
    }

    case 'remove': {
      const { chars = '' } = rule;
      if (!chars) return baseName;
      const charPattern = new RegExp(`[${escapeRegex(chars)}]`, 'g');
      return baseName.replace(charPattern, '');
    }

    default:
      return baseName;
  }
}

// ---------- 预览生成 ----------

/**
 * 生成重命名预览
 * @param {Array} items - 文件项数组
 * @param {Array} rules - 规则数组（按顺序应用）
 * @returns {Array} 预览结果，每项含 { id, oldName, newName, oldPath, newPath, willChange, hasConflict }
 */
function generatePreview(items, rules) {
  const ctx = { counter: 0 };
  const results = items.map(item => {
    let newBase = item.base;
    for (const rule of rules) {
      newBase = applyRule(newBase, item.ext, item, rule, ctx);
    }
    const newName = newBase + item.ext;
    const newPath = path.join(item.dir, newName);
    return {
      id: item.id,
      oldName: item.name,
      newName,
      oldPath: path.join(item.dir, item.name),
      newPath,
      willChange: newName !== item.name
    };
  });

  // 检测内部冲突（两个文件映射到同一路径）
  const targetCount = new Map();
  for (const r of results) {
    if (r.willChange) {
      targetCount.set(r.newPath, (targetCount.get(r.newPath) || 0) + 1);
    }
  }
  for (const r of results) {
    r.hasConflict = r.willChange && targetCount.get(r.newPath) > 1;
  }

  return results;
}

// ---------- 执行重命名 ----------

/**
 * 执行重命名（自动处理交换冲突）
 * @param {Array} preview - 来自 generatePreview 的结果
 * @returns {Promise<{success:number, failed:number, history:Array}>}
 */
async function executeRename(preview) {
  const fs = require('fs');
  const history = [];
  const result = { success: 0, failed: 0, history };

  const toRename = preview.filter(p => p.willChange && !p.hasConflict);

  // 检测交换冲突：某项的目标路径是另一项的源路径
  const sourcePaths = new Set(toRename.map(r => r.oldPath));
  const hasSwap = toRename.some(r => sourcePaths.has(r.newPath));

  if (hasSwap) {
    // 两阶段重命名：先全部改为临时名，再改为最终名
    const tempRenames = [];
    for (const item of toRename) {
      const tempPath = path.join(
        path.dirname(item.oldPath),
        `.rename-tmp-${item.id}-${Date.now()}`
      );
      try {
        await fs.promises.rename(item.oldPath, tempPath);
        tempRenames.push({ item, tempPath });
      } catch (e) {
        result.failed++;
      }
    }
    for (const { item, tempPath } of tempRenames) {
      try {
        await fs.promises.rename(tempPath, item.newPath);
        history.push({ oldPath: item.oldPath, newPath: item.newPath });
        result.success++;
      } catch (e) {
        // 尝试回滚到原名
        try { await fs.promises.rename(tempPath, item.oldPath); } catch (_) {}
        result.failed++;
      }
    }
  } else {
    // 无交换冲突，直接重命名
    for (const item of toRename) {
      try {
        await fs.promises.rename(item.oldPath, item.newPath);
        history.push({ oldPath: item.oldPath, newPath: item.newPath });
        result.success++;
      } catch (e) {
        result.failed++;
      }
    }
  }

  return result;
}

// ---------- 撤销 ----------

/**
 * 撤销重命名（按历史倒序恢复）
 * @param {Array} history - 来自 executeRename 的 history
 * @returns {Promise<{success:number, failed:number}>}
 */
async function undoRename(history) {
  const fs = require('fs');
  const result = { success: 0, failed: 0 };
  for (let i = history.length - 1; i >= 0; i--) {
    const { oldPath, newPath } = history[i];
    try {
      await fs.promises.rename(newPath, oldPath);
      result.success++;
    } catch (e) {
      result.failed++;
    }
  }
  return result;
}

// ---------- 文件名合法性校验 ----------

const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * 检查文件名是否合法（Windows）
 * @returns {string|null} 错误信息，null 表示合法
 */
function validateFileName(name) {
  if (!name || name.length === 0) return '文件名不能为空';
  if (INVALID_CHARS.test(name)) return '包含非法字符 < > : " / \\ | ? *';
  // Windows 保留名
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
  const base = name.replace(/\.[^.]*$/, '');
  if (reserved.test(base)) return `保留名 "${base}" 不可用`;
  if (name.endsWith(' ') || name.endsWith('.')) return '不能以空格或点结尾';
  return null;
}

module.exports = {
  genId,
  escapeRegex,
  formatDate,
  createFileItem,
  applyRule,
  generatePreview,
  executeRename,
  undoRename,
  validateFileName
};
