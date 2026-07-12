'use strict';

// 表格管家核心逻辑：CSV/TSV 解析、分析、转换
// 全部纯函数，可独立测试

/**
 * 自动检测分隔符：统计每行各候选分隔符出现次数的方差，取最稳定的
 * @param {string} text
 * @returns {string} 分隔符
 */
function detectDelimiter(text) {
  const sample = text.split(/\r\n|\r|\n/).slice(0, 20).filter(Boolean).join('\n');
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const counts = sample.split('\n').map(line => {
      // 忽略引号内的分隔符做粗略统计
      let inQuote = false;
      let c = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { i++; continue; }
          inQuote = !inQuote;
        } else if (!inQuote && ch === d) {
          c++;
        }
      }
      return c;
    });
    if (counts.length === 0) continue;
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    if (avg < 1) continue;
    // 方差越小越稳定
    const variance = counts.reduce((s, c) => s + (c - avg) ** 2, 0) / counts.length;
    const score = avg / (1 + variance);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/**
 * 解析 CSV/TSV 文本，支持引号包裹、引号内换行、转义双引号
 * @param {string} text
 * @param {object} opts { delimiter, hasHeader }
 * @returns {{ headers: string[], rows: string[][], delimiter: string }}
 */
function parseCSV(text, opts) {
  opts = opts || {};
  let delimiter = opts.delimiter || detectDelimiter(text);
  if (!delimiter) delimiter = ',';
  const hasHeader = opts.hasHeader !== false;

  // 标准化换行
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  // 末尾收尾
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 去除全空行
  const cleanRows = rows.filter(r => !(r.length === 1 && r[0] === ''));

  let headers;
  let dataRows;
  if (hasHeader && cleanRows.length > 0) {
    headers = cleanRows[0].map((h, idx) => h.trim() || ('列 ' + (idx + 1)));
    dataRows = cleanRows.slice(1);
  } else {
    headers = cleanRows[0] ? cleanRows[0].map((_, idx) => '列 ' + (idx + 1)) : [];
    dataRows = cleanRows;
  }

  // 补齐列数：保证每行与表头等长
  const colCount = headers.length;
  for (const r of dataRows) {
    while (r.length < colCount) r.push('');
    if (r.length > colCount) r.length = colCount;
  }

  return { headers, rows: dataRows, delimiter };
}

/**
 * 推断列类型并计算数值列统计
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {object[]} 每列信息 { name, type, stats }
 */
function analyzeColumns(headers, rows) {
  const numRe = /^-?\d+(\.\d+)?$/;
  const intRe = /^-?\d+$/;
  const dateRe = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;

  return headers.map((name, col) => {
    let numCount = 0;
    let dateCount = 0;
    let nonEmpty = 0;
    const values = [];
    for (const r of rows) {
      const v = (r[col] === undefined ? '' : r[col]).trim();
      if (v === '') continue;
      nonEmpty++;
      if (intRe.test(v) || numRe.test(v)) {
        numCount++;
        values.push(parseFloat(v));
      } else if (dateRe.test(v)) {
        dateCount++;
      }
    }

    let type = 'text';
    if (nonEmpty > 0 && numCount / nonEmpty >= 0.8) {
      type = numCount === nonEmpty ? 'number' : 'mixed-number';
    } else if (nonEmpty > 0 && dateCount / nonEmpty >= 0.8) {
      type = 'date';
    }

    const info = { name, col, type, count: nonEmpty };

    if (type === 'number' || type === 'mixed-number') {
      if (values.length > 0) {
        let sum = 0, min = Infinity, max = -Infinity;
        for (const n of values) {
          sum += n;
          if (n < min) min = n;
          if (n > max) max = n;
        }
        info.stats = {
          sum: round2(sum),
          avg: round2(sum / values.length),
          min,
          max,
          count: values.length
        };
      }
    }
    return info;
  });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * 全局搜索过滤行（匹配任意单元格，不区分大小写）
 * @param {string[][]} rows
 * @param {string} query
 * @returns {number[]} 命中行的索引
 */
function filterRows(rows, query) {
  if (!query) return rows.map((_, i) => i);
  const q = String(query).toLowerCase();
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (let j = 0; j < r.length; j++) {
      if (String(r[j] || '').toLowerCase().indexOf(q) !== -1) {
        result.push(i);
        break;
      }
    }
  }
  return result;
}

/**
 * 按列排序
 * @param {string[][]} rows
 * @param {number} col
 * @param {'asc'|'desc'} dir
 * @returns {string[][]} 新数组（不修改原数组）
 */
function sortRows(rows, col, dir) {
  const factor = dir === 'desc' ? -1 : 1;
  const arr = rows.map((r, i) => [r, i]);
  const numRe = /^-?\d+(\.\d+)?$/;
  arr.sort((a, b) => {
    const va = String(a[0][col] === undefined ? '' : a[0][col]).trim();
    const vb = String(b[0][col] === undefined ? '' : b[0][col]).trim();
    if (va === '' && vb === '') return 0;
    if (va === '') return 1;
    if (vb === '') return -1;
    if (numRe.test(va) && numRe.test(vb)) {
      return (parseFloat(va) - parseFloat(vb)) * factor;
    }
    return va.localeCompare(vb, 'zh') * factor;
  });
  return arr.map(x => x[0]);
}

/**
 * 序列化为 CSV
 * @param {string[]} headers
 * @param {string[][]} rows
 * @param {string} delimiter
 * @returns {string}
 */
function toCSV(headers, rows, delimiter) {
  delimiter = delimiter || ',';
  const all = [headers, ...rows];
  return all.map(r => r.map(v => escapeField(v, delimiter)).join(delimiter)).join('\n');
}

function escapeField(v, delimiter) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.indexOf('"') !== -1 || s.indexOf(delimiter) !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * 转为 JSON 数组
 */
function toJSON(headers, rows) {
  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] === undefined ? '' : r[i];
    });
    return obj;
  });
}

/**
 * 转为 Markdown 表格
 */
function toMarkdown(headers, rows) {
  if (headers.length === 0) return '';
  const line = (arr) => '| ' + arr.map(c => String(c === undefined ? '' : c).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |';
  const md = [];
  md.push(line(headers));
  md.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  for (const r of rows) md.push(line(r));
  return md.join('\n');
}

/**
 * 提取数值列用于图表
 * @param {string[][]} rows
 * @param {number} col
 * @param {number} limit
 * @returns {number[]}
 */
function numericSeries(rows, col, limit) {
  limit = limit || 1000;
  const numRe = /^-?\d+(\.\d+)?$/;
  const out = [];
  for (let i = 0; i < rows.length && out.length < limit; i++) {
    const v = String(rows[i][col] === undefined ? '' : rows[i][col]).trim();
    if (numRe.test(v)) out.push(parseFloat(v));
  }
  return out;
}

/**
 * 简易直方图分桶
 */
function histogram(values, bins) {
  bins = bins || 10;
  if (values.length === 0) return [];
  let min = Infinity, max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return [{ from: min, to: max, count: values.length }];
  const width = (max - min) / bins;
  const buckets = [];
  for (let i = 0; i < bins; i++) {
    buckets.push({ from: round2(min + i * width), to: round2(min + (i + 1) * width), count: 0 });
  }
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count++;
  }
  return buckets;
}

const csvApi = {
  detectDelimiter,
  parseCSV,
  analyzeColumns,
  filterRows,
  sortRows,
  toCSV,
  toJSON,
  toMarkdown,
  numericSeries,
  histogram,
  round2
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = csvApi;
}
if (typeof window !== 'undefined') {
  window.CsvCore = csvApi;
}
