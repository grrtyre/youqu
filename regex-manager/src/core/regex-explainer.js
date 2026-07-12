// 正则管家 - 正则解释器
// 把正则表达式逐 token 解析成中文可读说明，帮助理解复杂正则
// 纯函数模块，可在 Node（测试）与浏览器（preload 桥接）中复用

'use strict';

/**
 * 标志位中文说明
 */
var FLAG_DESC = {
  g: '全局匹配（找出所有匹配）',
  i: '忽略大小写',
  m: '多行模式（^ 与 $ 匹配每行首尾）',
  s: '单行模式（. 可匹配换行符）',
  u: 'Unicode 模式',
  y: '粘连匹配（从 lastIndex 处精确匹配）'
};

/**
 * 解释标志字符串
 * @param {string} flags
 * @returns {array} [{flag, desc}]
 */
function explainFlags(flags) {
  flags = flags || '';
  var seen = {};
  var out = [];
  for (var i = 0; i < flags.length; i++) {
    var f = flags[i];
    if (seen[f]) continue;
    seen[f] = true;
    out.push({ flag: f, desc: FLAG_DESC[f] || ('未知标志「' + f + '」') });
  }
  return out;
}

// 字符类简写的中文字面量展示（用于在描述里还原原文）
function literalChar(ch) {
  if (ch === '\n') return '\\n';
  if (ch === '\r') return '\\r';
  if (ch === '\t') return '\\t';
  if (ch === ' ') return '空格';
  return ch;
}

/**
 * 解析字符类 [...]，返回 {raw, desc}，pos 停在 ] 之后
 */
function parseCharClass(pattern, start) {
  // start 指向 '['
  var i = start + 1;
  var negated = false;
  if (pattern[i] === '^') { negated = true; i++; }

  var items = []; // 每项: {text, kind}
  var ranges = [];
  var raw = pattern[start];

  while (i < pattern.length && pattern[i] !== ']') {
    var ch = pattern[i];
    if (ch === '\\') {
      // 转义在字符类内
      var esc = parseEscape(pattern, i);
      if (!esc) { raw += pattern[i]; i++; continue; }
      var text = esc.raw;
      // 判断是否是范围：后面跟 - ]
      if (pattern[esc.end] === '-' && pattern[esc.end + 1] && pattern[esc.end + 1] !== ']') {
        // 范围 a-\d 这种
        var rangeStart = esc;
        var dashEnd = esc.end + 1;
        var nextEsc = parseEscape(pattern, dashEnd);
        if (nextEsc) {
          ranges.push({ from: rangeStart.raw, to: nextEsc.raw, fromDesc: rangeStart.desc, toDesc: nextEsc.desc });
          raw += rangeStart.raw + '-' + nextEsc.raw;
          i = nextEsc.end;
          continue;
        }
      }
      items.push({ text: text, desc: esc.desc });
      raw += text;
      i = esc.end;
      continue;
    } else if (ch === '-' && items.length > 0 && pattern[i + 1] && pattern[i + 1] !== ']') {
      // 字面量范围：前一项是单字符，后一项是单字符
      var prev = items[items.length - 1];
      var afterDash = pattern[i + 1];
      var afterText, afterEnd;
      if (afterDash === '\\') {
        var ae = parseEscape(pattern, i + 1);
        if (ae) { afterText = ae.raw; afterEnd = ae.end; }
        else { afterText = afterDash; afterEnd = i + 2; }
      } else {
        afterText = afterDash; afterEnd = i + 2;
      }
      // 把 prev 从 items 移除，转为范围
      items.pop();
      ranges.push({ from: prev.text, to: afterText, fromDesc: prev.desc, toDesc: '字面量「' + literalChar(afterDash) + '」' });
      raw = raw.slice(0, raw.length - prev.text.length) + prev.text + '-' + afterText;
      i = afterEnd;
      continue;
    } else {
      // 普通字符
      items.push({ text: ch, desc: '字面量「' + literalChar(ch) + '」' });
      raw += ch;
      i++;
      continue;
    }
  }

  if (i < pattern.length && pattern[i] === ']') {
    raw += ']';
    i++;
  } else {
    // 未闭合，按字面量处理
    return { raw: raw, desc: '未闭合的字符类（缺少 ]）', end: i, error: true };
  }

  // 组装描述
  var parts = [];
  ranges.forEach(function (r) {
    parts.push(r.from + ' 到 ' + r.to + ' 范围');
  });
  items.forEach(function (it) {
    parts.push(it.desc);
  });

  var desc;
  if (parts.length === 0) {
    desc = negated ? '匹配任意字符（空字符类）' : '匹配空字符类';
  } else if (negated) {
    desc = '匹配不在下列集合中的任意字符：' + parts.join('、');
  } else {
    desc = '匹配下列任意一个：' + parts.join('、');
  }

  return { raw: raw, desc: desc, end: i };
}

/**
 * 解析转义序列，返回 {raw, desc, end}，end 指向转义之后的位置
 * start 指向 '\\'
 */
function parseEscape(pattern, start) {
  if (pattern[start] !== '\\') return null;
  var next = pattern[start + 1];
  if (next === undefined) {
    return { raw: '\\', desc: '孤立的反斜杠', end: start + 1 };
  }
  switch (next) {
    case 'd': return { raw: '\\d', desc: '匹配一个数字 [0-9]', end: start + 2 };
    case 'D': return { raw: '\\D', desc: '匹配一个非数字字符', end: start + 2 };
    case 'w': return { raw: '\\w', desc: '匹配一个单词字符 [A-Za-z0-9_]', end: start + 2 };
    case 'W': return { raw: '\\W', desc: '匹配一个非单词字符', end: start + 2 };
    case 's': return { raw: '\\s', desc: '匹配一个空白字符（空格/制表/换行等）', end: start + 2 };
    case 'S': return { raw: '\\S', desc: '匹配一个非空白字符', end: start + 2 };
    case 'b': return { raw: '\\b', desc: '单词边界', end: start + 2 };
    case 'B': return { raw: '\\B', desc: '非单词边界', end: start + 2 };
    case 'n': return { raw: '\\n', desc: '换行符', end: start + 2 };
    case 'r': return { raw: '\\r', desc: '回车符', end: start + 2 };
    case 't': return { raw: '\\t', desc: '制表符', end: start + 2 };
    case 'v': return { raw: '\\v', desc: '垂直制表符', end: start + 2 };
    case 'f': return { raw: '\\f', desc: '换页符', end: start + 2 };
    case '0': return { raw: '\\0', desc: '空字符（NUL）', end: start + 2 };
    case 'u':
      // \uXXXX
      if (/^[0-9a-fA-F]{4}$/.test(pattern.slice(start + 2, start + 6))) {
        var cp = pattern.slice(start + 2, start + 6).toUpperCase();
        return { raw: '\\u' + cp, desc: 'Unicode 字符 U+' + cp, end: start + 6 };
      }
      // \u{...} ES6
      if (pattern[start + 2] === '{') {
        var close = pattern.indexOf('}', start + 3);
        if (close > -1) {
          var hex = pattern.slice(start + 3, close).toUpperCase();
          return { raw: '\\u{' + hex + '}', desc: 'Unicode 字符 U+' + hex, end: close + 1 };
        }
      }
      return { raw: '\\u', desc: '无效的 \\u 转义', end: start + 2, error: true };
    case 'x':
      if (/^[0-9a-fA-F]{2}$/.test(pattern.slice(start + 2, start + 4))) {
        var hx = pattern.slice(start + 2, start + 4).toUpperCase();
        return { raw: '\\x' + hx, desc: '十六进制字符 0x' + hx, end: start + 4 };
      }
      return { raw: '\\x', desc: '无效的 \\x 转义', end: start + 2, error: true };
    case 'c':
      if (pattern[start + 2] && /[A-Za-z]/.test(pattern[start + 2])) {
        return { raw: '\\c' + pattern[start + 2], desc: '控制字符 Ctrl+' + pattern[start + 2].toUpperCase(), end: start + 3 };
      }
      return { raw: '\\c', desc: '无效的 \\c 转义', end: start + 2, error: true };
    case 'k':
      // \k<name>
      if (pattern[start + 2] === '<') {
        var gt = pattern.indexOf('>', start + 3);
        if (gt > -1) {
          var nm = pattern.slice(start + 3, gt);
          return { raw: '\\k<' + nm + '>', desc: '反向引用命名组「' + nm + '」', end: gt + 1 };
        }
      }
      return { raw: '\\k', desc: '无效的 \\k 转义', end: start + 2, error: true };
    default:
      // 数字 → 反向引用 \1 ~ \9
      if (/[1-9]/.test(next)) {
        // 贪婪读取后续数字（但 JS 中 \10 只有在存在 10 个组时才是反向引用，否则是 \1 + 0）
        // 这里简化：读取连续数字作为组号
        var numStr = next;
        var j = start + 2;
        while (/[0-9]/.test(pattern[j]) && numStr.length < 2) {
          numStr += pattern[j];
          j++;
        }
        var num = parseInt(numStr, 10);
        return { raw: '\\' + numStr, desc: '反向引用第 ' + num + ' 组', end: j };
      }
      // 其它转义元字符：\. \* \+ \? \^ \$ \( \) \[ \] \{ \} \\ \| \/ 等
      if (/[.*+?^${}()|[\]\\\/]/.test(next)) {
        return { raw: '\\' + next, desc: '字面量「' + next + '」', end: start + 2 };
      }
      // 其它：未知转义，按字面量处理
      return { raw: '\\' + next, desc: '字面量「' + next + '」（无特殊含义的转义）', end: start + 2 };
  }
}

/**
 * 解析量词 {n} {n,} {n,m}，返回 {raw, desc, end} 或 null（不是合法量词）
 * start 指向 '{'
 */
function parseBraceQuant(pattern, start) {
  var m = /^\{(\d+)(,(\d+)?)?\}/.exec(pattern.slice(start));
  if (!m) return null;
  var raw = m[0];
  var min = m[1];
  var max = m[3];
  var desc;
  if (m[2] === undefined) {
    desc = '恰好重复 ' + min + ' 次';
  } else if (max === undefined) {
    desc = '至少重复 ' + min + ' 次';
  } else {
    desc = '重复 ' + min + ' 到 ' + max + ' 次';
  }
  return { raw: raw, desc: desc, end: start + raw.length };
}

/**
 * 主入口：解释正则表达式
 * @param {string} pattern - 正则字符串（不含两端的 / 和标志）
 * @param {string} flags - 标志字符串
 * @returns {object} { ok, tokens, flagsDesc, summary, error }
 *   tokens: [{raw, desc, type, depth}] depth 表示分组嵌套层级
 */
function explainRegex(pattern, flags) {
  if (!pattern) {
    return { ok: false, tokens: [], flagsDesc: [], summary: '', error: '请输入正则表达式' };
  }

  // 先尝试编译，确保语法有效
  try {
    new RegExp(pattern, flags || ''); // eslint-disable-line no-new
  } catch (e) {
    return { ok: false, tokens: [], flagsDesc: explainFlags(flags), summary: '', error: '正则语法错误：' + e.message };
  }

  var tokens = [];
  var depth = 0;
  var groupCounter = 0;
  var groupStack = []; // 记录每层的组号（捕获组为数字，非捕获为 null）
  var i = 0;

  while (i < pattern.length) {
    var c = pattern[i];
    var tok = null;

    if (c === '\\') {
      var esc = parseEscape(pattern, i);
      tok = { raw: esc.raw, desc: esc.desc, type: 'escape', depth: depth };
      if (esc.error) tok.error = true;
      i = esc.end;
    } else if (c === '[') {
      var cc = parseCharClass(pattern, i);
      tok = { raw: cc.raw, desc: cc.desc, type: 'class', depth: depth };
      if (cc.error) tok.error = true;
      i = cc.end;
    } else if (c === '(') {
      // 判断分组类型
      var rest = pattern.slice(i);
      var grp = null;
      if (/^\(\?:/.test(rest)) {
        grp = { raw: '(?:', desc: '非捕获组（开始）', close: ')', type: 'group-noncap' };
        groupStack.push(null);
      } else if (/^\(\?<([A-Za-z_$][\w$]*)>/.test(rest)) {
        var nm = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(rest)[1];
        groupCounter++;
        grp = { raw: '(?<' + nm + '>', desc: '命名捕获组「' + nm + '」（第 ' + groupCounter + ' 组，开始）', close: ')', type: 'group-named' };
        groupStack.push(groupCounter);
      } else if (/^\(\?=/.test(rest)) {
        grp = { raw: '(?=', desc: '正向先行断言（向右匹配，开始）', close: ')', type: 'assert' };
        groupStack.push(null);
      } else if (/^\(\?!/.test(rest)) {
        grp = { raw: '(?!', desc: '负向先行断言（向右不能匹配，开始）', close: ')', type: 'assert' };
        groupStack.push(null);
      } else if (/^\(\?<=/.test(rest)) {
        grp = { raw: '(?<=', desc: '正向后行断言（向左匹配，开始）', close: ')', type: 'assert' };
        groupStack.push(null);
      } else if (/^\(\?<!/.test(rest)) {
        grp = { raw: '(?<!', desc: '负向后行断言（向左不能匹配，开始）', close: ')', type: 'assert' };
        groupStack.push(null);
      } else if (/^\(\?<>/.test(rest) || /^\(\?/.test(rest)) {
        // 未知 (? 形式
        grp = { raw: '(?', desc: '未知的分组语法', close: ')', type: 'group-unknown', error: true };
        groupStack.push(null);
      } else {
        // 普通捕获组
        groupCounter++;
        grp = { raw: '(', desc: '捕获组（第 ' + groupCounter + ' 组，开始）', close: ')', type: 'group-cap' };
        groupStack.push(groupCounter);
      }
      tok = { raw: grp.raw, desc: grp.desc, type: grp.type, depth: depth };
      if (grp.error) tok.error = true;
      depth++;
      i += grp.raw.length;
    } else if (c === ')') {
      depth = Math.max(0, depth - 1);
      groupStack.pop();
      tok = { raw: ')', desc: '分组结束', type: 'group-close', depth: depth };
      i++;
    } else if (c === '|') {
      tok = { raw: '|', desc: '或（| 两侧任选其一）', type: 'alt', depth: depth };
      i++;
    } else if (c === '^') {
      tok = { raw: '^', desc: (flags && flags.indexOf('m') > -1) ? '行首' : '字符串开头', type: 'anchor', depth: depth };
      i++;
    } else if (c === '$') {
      tok = { raw: '$', desc: (flags && flags.indexOf('m') > -1) ? '行尾' : '字符串结尾', type: 'anchor', depth: depth };
      i++;
    } else if (c === '.') {
      var dotDesc = (flags && flags.indexOf('s') > -1) ? '任意字符（含换行）' : '任意字符（不含换行）';
      tok = { raw: '.', desc: dotDesc, type: 'dot', depth: depth };
      i++;
    } else if (c === '*' || c === '+' || c === '?') {
      var lazy = pattern[i + 1] === '?';
      var baseDesc;
      if (c === '*') baseDesc = '重复 0 次或多次（贪婪）';
      else if (c === '+') baseDesc = '重复 1 次或多次（贪婪）';
      else baseDesc = '重复 0 次或 1 次（可选，贪婪）';
      if (lazy) baseDesc += '；惰性匹配（尽量少匹配）';
      tok = { raw: lazy ? c + '?' : c, desc: '量词：修饰前一个元素，' + baseDesc, type: 'quant', depth: depth };
      i += lazy ? 2 : 1;
    } else if (c === '{') {
      var bq = parseBraceQuant(pattern, i);
      if (bq) {
        var blazy = pattern[bq.end] === '?';
        var bdesc = bq.desc;
        if (blazy) bdesc += '；惰性匹配（尽量少匹配）';
        tok = { raw: blazy ? bq.raw + '?' : bq.raw, desc: '量词：修饰前一个元素，' + bdesc, type: 'quant', depth: depth };
        i = blazy ? bq.end + 1 : bq.end;
      } else {
        // 不是合法量词，按字面量 {
        tok = { raw: '{', desc: '字面量「{」', type: 'literal', depth: depth };
        i++;
      }
    } else {
      // 普通字面量字符
      tok = { raw: c, desc: '字面量「' + literalChar(c) + '」', type: 'literal', depth: depth };
      i++;
    }

    tokens.push(tok);
  }

  // 生成摘要：把描述串成一句话
  var summary = tokens.map(function (t) { return t.desc; }).join('；');

  return {
    ok: true,
    tokens: tokens,
    flagsDesc: explainFlags(flags),
    summary: summary,
    groupCount: groupCounter,
    error: null
  };
}

module.exports = {
  explainRegex: explainRegex,
  explainFlags: explainFlags,
  FLAG_DESC: FLAG_DESC
};
