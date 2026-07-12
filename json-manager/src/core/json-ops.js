'use strict';
// JSON管家 - 核心处理算法（纯 JS，零依赖，可被主进程/测试直接 require）
// 提供：解析、格式化、压缩、统计、节点路径提取

// 安全解析 JSON，返回 { ok, value, error, pos }
function parse(text) {
  if (typeof text !== 'string') {
    return { ok: false, error: '输入不是字符串', pos: -1 };
  }
  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: false, error: '内容为空', pos: 0 };
  }
  try {
    const value = JSON.parse(trimmed);
    return { ok: true, value, error: null, pos: -1 };
  } catch (err) {
    // 提取错误位置（V8 引擎 JSON.parse 错误信息含 "position N"）
    const msg = String(err && err.message || err);
    let pos = -1;
    const m = msg.match(/position\s+(\d+)/i);
    if (m) pos = parseInt(m[1], 10);
    return { ok: false, error: msg, pos };
  }
}

// 格式化：beautify(value, indent=2)
function beautify(value, indent) {
  const ind = indent === 4 ? 4 : 2;
  return JSON.stringify(value, null, ind);
}

// 压缩
function minify(value) {
  return JSON.stringify(value);
}

// 转义 HTML，防 XSS（树形展示用）
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 统计：返回 { objects, arrays, keys, depth, bytes, leafNodes }
function stats(value) {
  const r = { objects: 0, arrays: 0, keys: 0, depth: 0, bytes: 0, leafNodes: 0 };
  if (value === null || value === undefined) {
    r.bytes = 4;
    r.leafNodes = 1;
    return r;
  }
  function walk(v, d) {
    if (d > r.depth) r.depth = d;
    if (Array.isArray(v)) {
      r.arrays++;
      v.forEach((item) => walk(item, d + 1));
    } else if (v && typeof v === 'object') {
      r.objects++;
      const ks = Object.keys(v);
      r.keys += ks.length;
      ks.forEach((k) => walk(v[k], d + 1));
    } else {
      r.leafNodes++;
    }
  }
  walk(value, 0);
  r.bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  return r;
}

// 类型判定（与展示一致）
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

// JSONPath 简化生成：从根到节点路径数组 -> 字符串
// 例：['users', 0, 'name'] -> 'users[0].name'
function pathToString(pathArr) {
  if (!Array.isArray(pathArr) || pathArr.length === 0) return '$';
  let s = '$';
  pathArr.forEach((seg) => {
    if (typeof seg === 'number') {
      s += '[' + seg + ']';
    } else {
      if (/^[A-Za-z_$][\w$]*$/.test(seg)) {
        s += '.' + seg;
      } else {
        s += '["' + seg.replace(/"/g, '\\"') + '"]';
      }
    }
  });
  return s;
}

module.exports = {
  parse,
  beautify,
  minify,
  escapeHtml,
  stats,
  typeOf,
  pathToString
};
