'use strict';
// JSON管家 - 格式转换器（纯 JS，零依赖）
// 支持：JSON ↔ CSV、JSON → YAML、JSON → XML、JSON → Properties（扁平化）

const ops = require('./json-ops');

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// ===== JSON → CSV =====
// 规则：
//   - 输入对象数组：用并集字段作表头，每对象一行
//   - 输入单个对象：一行，表头为字段名
//   - 输入二维数组（每行是数组）：直接输出
//   - 其他：报错
function toCSV(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    // 二维数组
    if (value.every((row) => Array.isArray(row))) {
      return value.map((row) => row.map(csvCell).join(',')).join('\n');
    }
    // 对象数组：并集字段
    if (value.every((row) => isObj(row))) {
      const headers = [];
      value.forEach((row) => {
        Object.keys(row).forEach((k) => { if (!headers.includes(k)) headers.push(k); });
      });
      const lines = [headers.map(csvCell).join(',')];
      value.forEach((row) => {
        lines.push(headers.map((h) => csvCell(row[h])).join(','));
      });
      return lines.join('\n');
    }
    // 一维数组：单列表
    return ['value'].concat(value.map(csvCell)).join('\n');
  }
  if (isObj(value)) {
    const ks = Object.keys(value);
    return [ks.map(csvCell).join(','), ks.map((k) => csvCell(value[k])).join(',')].join('\n');
  }
  return csvCell(value);
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ===== JSON → YAML =====
// 简化版 YAML：缩进 2 空格，对象用 key: value，数组用 - item
function toYAML(value, indent) {
  const ind = indent || 0;
  const pad = '  '.repeat(ind);
  if (value === null) return pad + 'null';
  if (typeof value === 'boolean') return pad + (value ? 'true' : 'false');
  if (typeof value === 'number') return pad + (Number.isFinite(value) ? String(value) : 'null');
  if (typeof value === 'string') {
    // 含特殊字符则用双引号
    if (/[:\n\r#{}\[\],&*?|<>%@`"' ]/.test(value) || value === '' || /^\s|\s$/.test(value)) {
      return pad + '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return pad + value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return pad + '[]';
    return value.map((item) => {
      if (isObj(item) || Array.isArray(item)) {
        // 复合项：第一行 - 然后接续
        const sub = toYAML(item, ind + 1).replace(/^  /, '');
        return pad + '- ' + sub;
      }
      return pad + '- ' + toYAML(item, 0).trim();
    }).join('\n');
  }
  if (isObj(value)) {
    const ks = Object.keys(value);
    if (ks.length === 0) return pad + '{}';
    return ks.map((k) => {
      const v = value[k];
      if (isObj(v) || Array.isArray(v)) {
        const sub = toYAML(v, ind + 1);
        return pad + yamlKey(k) + ':\n' + sub;
      }
      return pad + yamlKey(k) + ': ' + toYAML(v, 0).trim();
    }).join('\n');
  }
  return pad + String(value);
}

function yamlKey(k) {
  if (/^[A-Za-z_$][\w$-]*$/.test(k)) return k;
  return '"' + k.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// ===== JSON → XML =====
// 规则：对象键→标签，数组项用父键单数 + <item>，文本值直接放标签内
function toXML(value, rootName) {
  const root = rootName || 'root';
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlNode(root, value, 0);
}

function xmlNode(tag, value, depth) {
  const pad = '  '.repeat(depth);
  if (value === null || value === undefined) return pad + '<' + tag + ' />';
  if (typeof value === 'boolean' || typeof value === 'number') {
    return pad + '<' + tag + '>' + String(value) + '</' + tag + '>';
  }
  if (typeof value === 'string') {
    return pad + '<' + tag + '>' + xmlEscape(value) + '</' + tag + '>';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return pad + '<' + tag + ' />';
    const singular = singularize(tag);
    return value.map((item) => xmlNode(singular, item, depth)).join('\n');
  }
  if (isObj(value)) {
    const ks = Object.keys(value);
    if (ks.length === 0) return pad + '<' + tag + ' />';
    const inner = ks.map((k) => xmlNode(k, value[k], depth + 1)).join('\n');
    return pad + '<' + tag + '>\n' + inner + '\n' + pad + '</' + tag + '>';
  }
  return pad + '<' + tag + ' />';
}

function singularize(tag) {
  if (tag.endsWith('s') && tag.length > 1) return tag.slice(0, -1);
  return tag + '_item';
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ===== JSON → Properties =====
// 扁平化为 a.b.c = value
function toProperties(value) {
  const lines = [];
  function walk(v, prefix) {
    if (v === null) { lines.push(prefix + '=null'); return; }
    if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(prefix + '=' + String(v)); return;
    }
    if (typeof v === 'string') { lines.push(prefix + '=' + v); return; }
    if (Array.isArray(v)) {
      if (v.length === 0) { lines.push(prefix + '='); return; }
      v.forEach((item, i) => walk(item, prefix + '[' + i + ']'));
      return;
    }
    if (isObj(v)) {
      const ks = Object.keys(v);
      if (ks.length === 0) { lines.push(prefix + '='); return; }
      if (prefix === '') {
        ks.forEach((k) => walk(v[k], propKey(k)));
      } else {
        ks.forEach((k) => walk(v[k], prefix + '.' + propKey(k)));
      }
    }
  }
  walk(value, '');
  return lines.join('\n');
}

function propKey(k) {
  if (/^[A-Za-z_$][\w$]*$/.test(k)) return k;
  return '"' + k.replace(/"/g, '\\"') + '"';
}

// ===== JSON 对比 =====
// 返回差异列表 [{ path, type, left, right }]
// type: 'added' | 'removed' | 'changed'
function diff(left, right) {
  const out = [];
  function walk(l, r, path) {
    if (l === r) return;
    if (typeOf(l) !== typeOf(r)) {
      out.push({ path: ops.pathToString(path), type: 'changed', left: l, right: r });
      return;
    }
    if (Array.isArray(l)) {
      const len = Math.max(l.length, r.length);
      for (let i = 0; i < len; i++) {
        if (i >= l.length) {
          out.push({ path: ops.pathToString(path.concat(i)), type: 'added', left: undefined, right: r[i] });
        } else if (i >= r.length) {
          out.push({ path: ops.pathToString(path.concat(i)), type: 'removed', left: l[i], right: undefined });
        } else {
          walk(l[i], r[i], path.concat(i));
        }
      }
      return;
    }
    if (isObj(l)) {
      const lk = Object.keys(l);
      const rk = Object.keys(r);
      const all = new Set(lk.concat(rk));
      all.forEach((k) => {
        const hasL = Object.prototype.hasOwnProperty.call(l, k);
        const hasR = Object.prototype.hasOwnProperty.call(r, k);
        if (hasL && !hasR) {
          out.push({ path: ops.pathToString(path.concat(k)), type: 'removed', left: l[k], right: undefined });
        } else if (!hasL && hasR) {
          out.push({ path: ops.pathToString(path.concat(k)), type: 'added', left: undefined, right: r[k] });
        } else {
          walk(l[k], r[k], path.concat(k));
        }
      });
      return;
    }
    // 基本类型不等
    out.push({ path: ops.pathToString(path), type: 'changed', left: l, right: r });
  }
  walk(left, right, []);
  return out;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

// ===== JSON Schema 简化校验 =====
// 支持子集：type / required / properties / items / enum / minimum / maximum / minLength / maxLength / pattern
function validateSchema(value, schema) {
  const errors = [];
  function walk(v, s, path) {
    if (!isObj(s)) return;
    if (s.type) {
      const t = typeOf(v);
      const expected = Array.isArray(s.type) ? s.type : [s.type];
      const actual = t === 'number' && Number.isInteger(v) ? ['number', 'integer'] : [t];
      const ok = expected.some((e) => actual.includes(e));
      if (!ok) {
        errors.push({ path: ops.pathToString(path), msg: '类型应为 ' + expected.join('|') + '，实际 ' + t });
      }
    }
    if (s.enum) {
      if (!s.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) {
        errors.push({ path: ops.pathToString(path), msg: '值不在枚举内: ' + JSON.stringify(s.enum) });
      }
    }
    if (typeof v === 'number') {
      if (typeof s.minimum === 'number' && v < s.minimum) {
        errors.push({ path: ops.pathToString(path), msg: '值 ' + v + ' 小于 minimum ' + s.minimum });
      }
      if (typeof s.maximum === 'number' && v > s.maximum) {
        errors.push({ path: ops.pathToString(path), msg: '值 ' + v + ' 大于 maximum ' + s.maximum });
      }
    }
    if (typeof v === 'string') {
      if (typeof s.minLength === 'number' && v.length < s.minLength) {
        errors.push({ path: ops.pathToString(path), msg: '字符串长度小于 minLength ' + s.minLength });
      }
      if (typeof s.maxLength === 'number' && v.length > s.maxLength) {
        errors.push({ path: ops.pathToString(path), msg: '字符串长度大于 maxLength ' + s.maxLength });
      }
      if (s.pattern) {
        try {
          const re = new RegExp(s.pattern);
          if (!re.test(v)) errors.push({ path: ops.pathToString(path), msg: '不匹配 pattern ' + s.pattern });
        } catch (_) { /* 忽略非法正则 */ }
      }
    }
    if (isObj(v) && s.properties) {
      Object.keys(s.properties).forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(v, k)) {
          walk(v[k], s.properties[k], path.concat(k));
        }
      });
    }
    if (s.required && isObj(v)) {
      s.required.forEach((k) => {
        if (!Object.prototype.hasOwnProperty.call(v, k)) {
          errors.push({ path: ops.pathToString(path), msg: '缺少必填字段 ' + k });
        }
      });
    }
    if (Array.isArray(v) && s.items) {
      v.forEach((item, i) => walk(item, s.items, path.concat(i)));
    }
  }
  walk(value, schema, []);
  return errors;
}

module.exports = {
  toCSV,
  toYAML,
  toXML,
  toProperties,
  diff,
  validateSchema
};
