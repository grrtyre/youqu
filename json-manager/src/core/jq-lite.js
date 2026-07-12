'use strict';
// JSON管家 - jq-lite：简化 jq 语法过滤
// 支持子集：
//   .               根
//   .foo            取对象字段
//   .foo.bar        嵌套字段
//   .[N]            数组索引（负数从末尾）
//   .[A:B]          数组切片
//   .[]             数组遍历（每项输出）
//   .foo[]          字段取值后遍历
//   .foo[].bar      遍历后取字段
//   .a, .b          逗号多选
//   .foo | .bar     管道
//   length          取长度
//   keys            取键数组
//   values          取值数组
//   type            取类型字符串
//   map(.x)         对数组每项应用表达式
//   select(.x > 1)  过滤
// 输出统一为 JSON 文本（多结果输出数组）

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// 词法分析：把表达式拆成 token 流（粗略实现，仅支持上述子集）
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const n = expr.length;
  while (i < n) {
    const c = expr[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '.') { tokens.push({ t: 'dot' }); i++; continue; }
    if (c === ',') { tokens.push({ t: 'comma' }); i++; continue; }
    if (c === '|') { tokens.push({ t: 'pipe' }); i++; continue; }
    if (c === '[') {
      // 可能是 .[...] 切片/索引
      let j = i + 1;
      let body = '';
      while (j < n && expr[j] !== ']') { body += expr[j]; j++; }
      if (j >= n) throw new Error('未闭合的 [');
      tokens.push({ t: 'bracket', body: body.trim() });
      i = j + 1;
      continue;
    }
    if (c === '(') {
      let depth = 1;
      let j = i + 1;
      let body = '';
      while (j < n && depth > 0) {
        if (expr[j] === '(') depth++;
        else if (expr[j] === ')') { depth--; if (depth === 0) break; }
        body += expr[j];
        j++;
      }
      if (depth !== 0) throw new Error('未闭合的 (');
      tokens.push({ t: 'paren', body: body.trim() });
      i = j + 1;
      continue;
    }
    // 标识符 / 数字 / 关键字
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      let id = '';
      while (j < n && /[\w$]/.test(expr[j])) { id += expr[j]; j++; }
      tokens.push({ t: 'ident', v: id });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let str = '';
      while (j < n && expr[j] !== quote) {
        if (expr[j] === '\\' && j + 1 < n) { str += expr[j] + expr[j + 1]; j += 2; }
        else { str += expr[j]; j++; }
      }
      tokens.push({ t: 'str', v: str });
      i = j + 1;
      continue;
    }
    // 数字、操作符、比较符号等
    if (/[0-9+\-*/%<>=!]/.test(c)) {
      let j = i;
      let sym = '';
      while (j < n && /[0-9+\-*/%<>=!.]/.test(expr[j])) { sym += expr[j]; j++; }
      tokens.push({ t: 'sym', v: sym });
      i = j;
      continue;
    }
    throw new Error('无法识别的字符: ' + c);
  }
  return tokens;
}

// 简单解析器：返回管道阶段的数组，每阶段是「路径段」或「内置函数调用」
// 路径段类型：root / key(name) / index(n) / slice(a,b) / iterate / ident(name)
function parseExpr(expr) {
  const tokens = tokenize(expr);
  // 按 pipe 分割
  const stages = [];
  let cur = [];
  tokens.forEach((tk) => {
    if (tk.t === 'pipe') { stages.push(cur); cur = []; }
    else cur.push(tk);
  });
  stages.push(cur);
  // 每个阶段解析为 segments
  return stages.map((stage) => parseStage(stage));
}

function parseStage(tokens) {
  // 处理逗号：把一个阶段拆为多个并行子表达式
  const groups = [[]];
  tokens.forEach((tk) => {
    if (tk.t === 'comma') groups.push([]);
    else groups[groups.length - 1].push(tk);
  });
  return groups.map((tkList) => parseSegments(tkList));
}

function parseSegments(tokens) {
  const segs = [];
  let i = 0;
  const n = tokens.length;
  // 第一个 token 可能是 dot 或 ident（裸函数如 length/keys）或 bracket
  while (i < n) {
    const tk = tokens[i];
    if (tk.t === 'dot') {
      i++;
      // dot 后可能跟 ident / bracket / 无（表示根）
      if (i < n) {
        const next = tokens[i];
        if (next.t === 'ident') { segs.push({ k: 'key', name: next.v }); i++; }
        else if (next.t === 'bracket') { segs.push(parseBracket(next.body)); i++; }
        else if (next.t === 'str') { segs.push({ k: 'key', name: next.v }); i++; }
        else throw new Error('. 后语法错误: ' + JSON.stringify(next));
      } else {
        // 单独的 . 表示根
        segs.push({ k: 'root' });
      }
      continue;
    }
    if (tk.t === 'bracket') {
      segs.push(parseBracket(tk.body));
      i++;
      continue;
    }
    if (tk.t === 'ident') {
      // 裸标识符：可能是函数调用 length / keys / values / type / map / select
      const name = tk.v;
      i++;
      if (i < n && tokens[i].t === 'paren') {
        const arg = tokens[i].body;
        i++;
        segs.push({ k: 'func', name, arg });
      } else {
        // 无参函数
        segs.push({ k: 'func', name, arg: null });
      }
      continue;
    }
    if (tk.t === 'str') {
      // 裸字符串字面量
      segs.push({ k: 'literal', v: tk.v });
      i++;
      continue;
    }
    throw new Error('阶段语法错误: ' + JSON.stringify(tk));
  }
  return segs;
}

function parseBracket(body) {
  if (body === '') return { k: 'iterate' };
  if (body === ':') return { k: 'slice', a: null, b: null };
  // 切片 [A:B] / [A:] / [:B]
  if (body.indexOf(':') >= 0) {
    const parts = body.split(':');
    const a = parts[0].trim() === '' ? null : parseInt(parts[0].trim(), 10);
    const b = parts[1].trim() === '' ? null : parseInt(parts[1].trim(), 10);
    return { k: 'slice', a, b };
  }
  // 索引
  const num = parseInt(body, 10);
  if (isNaN(num)) throw new Error('无效的索引: ' + body);
  return { k: 'index', n: num };
}

// 执行：输入 value + 表达式字符串，输出结果数组
function run(value, expr) {
  const stages = parseExpr(expr);
  let current = [value];
  for (const stage of stages) {
    // stage 是 groups：每组的 segments 应用到 current 的每项，结果展平
    const next = [];
    for (const group of stage) {
      for (const item of current) {
        const produced = applyGroup(item, group);
        next.push(...produced);
      }
    }
    current = next;
  }
  return current;
}

function applyGroup(value, segs) {
  let cur = [value];
  for (const seg of segs) {
    const next = [];
    for (const item of cur) {
      next.push(...applySeg(item, seg));
    }
    cur = next;
  }
  return cur;
}

function applySeg(value, seg) {
  switch (seg.k) {
    case 'root': return [value];
    case 'key': {
      if (isObj(value) && Object.prototype.hasOwnProperty.call(value, seg.name)) {
        return [value[seg.name]];
      }
      return [];
    }
    case 'index': {
      if (!Array.isArray(value)) return [];
      let idx = seg.n;
      if (idx < 0) idx = value.length + idx;
      if (idx < 0 || idx >= value.length) return [];
      return [value[idx]];
    }
    case 'slice': {
      if (!Array.isArray(value)) return [];
      const a = seg.a === null ? 0 : (seg.a < 0 ? value.length + seg.a : seg.a);
      const b = seg.b === null ? value.length : (seg.b < 0 ? value.length + seg.b : seg.b);
      return [value.slice(a, b)];
    }
    case 'iterate': {
      if (Array.isArray(value)) return value.slice();
      if (isObj(value)) return Object.keys(value).map((k) => value[k]);
      return [];
    }
    case 'literal': return [seg.v];
    case 'func': return applyFunc(value, seg.name, seg.arg);
    default: return [];
  }
}

function applyFunc(value, name, arg) {
  switch (name) {
    case 'length': {
      if (Array.isArray(value) || typeof value === 'string') return [value.length];
      if (isObj(value)) return [Object.keys(value).length];
      return [0];
    }
    case 'keys': {
      if (isObj(value)) return [Object.keys(value)];
      return [[]];
    }
    case 'values': {
      if (isObj(value)) return [Object.keys(value).map((k) => value[k])];
      return [[]];
    }
    case 'type': {
      if (value === null) return ['null'];
      if (Array.isArray(value)) return ['array'];
      return [typeof value];
    }
    case 'map': {
      // arg 是表达式，对数组每项应用
      if (!Array.isArray(value) || !arg) return [];
      const out = [];
      value.forEach((item) => {
        const r = run(item, arg);
        if (r.length > 0) out.push(r[0]);
      });
      return [out];
    }
    case 'select': {
      // arg 是布尔表达式，如 .x > 1
      if (!arg) return [];
      if (evalPredicate(value, arg)) return [value];
      return [];
    }
    case 'tojson': return [JSON.stringify(value)];
    default:
      throw new Error('未知函数: ' + name);
  }
}

// 简单谓词求值：支持 .field (op value) 形式
// 例：.x > 1, .name == "abc", .active, .x >= 5
function evalPredicate(value, arg) {
  const expr = arg.trim();
  // 取反 not
  if (expr.toLowerCase() === 'not null') return value !== null;
  if (expr === '.') return true;
  // 纯字段：truthy 判断
  if (/^\.[A-Za-z_$][\w$]*$/.test(expr)) {
    const k = expr.slice(1);
    return !!(isObj(value) && value[k]);
  }
  // 比较表达式
  const m = expr.match(/^\.([A-Za-z_$][\w$]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (m) {
    const key = m[1];
    const op = m[2];
    let rhs = m[3].trim();
    if (rhs === 'null') rhs = null;
    else if (rhs === 'true') rhs = true;
    else if (rhs === 'false') rhs = false;
    else if (/^-?\d+(\.\d+)?$/.test(rhs)) rhs = parseFloat(rhs);
    else if ((rhs[0] === '"' && rhs[rhs.length - 1] === '"') || (rhs[0] === "'" && rhs[rhs.length - 1] === "'")) {
      rhs = rhs.slice(1, -1);
    }
    const lhs = isObj(value) ? value[key] : undefined;
    switch (op) {
      case '==': return lhs === rhs;
      case '!=': return lhs !== rhs;
      case '>': return lhs > rhs;
      case '<': return lhs < rhs;
      case '>=': return lhs >= rhs;
      case '<=': return lhs <= rhs;
    }
  }
  // 布尔字段
  if (expr === 'length') return Array.isArray(value) ? value.length > 0 : false;
  return false;
}

// 对外：运行表达式并返回 JSON 文本（多结果包装为数组）
function query(value, expr) {
  const results = run(value, expr);
  if (results.length === 0) return '';
  if (results.length === 1) return JSON.stringify(results[0], null, 2);
  return JSON.stringify(results, null, 2);
}

module.exports = {
  parse: parseExpr,
  run,
  query
};
