// 科学计算器管家 · 计算引擎
// 自研词法+语法+求值，不依赖任何第三方库，纯本地隐私优先
// 支持：四则运算、括号嵌套、函数（sin/cos/tan/log/ln/sqrt/abs/exp/floor/ceil/round/factorial）、
//      常量（pi/e）、变量定义、幂运算(^)、取模(%)、阶乘(!)、程序员模式（bin/oct/dec/hex + 位运算）

'use strict';

// ============ 词法分析 ============

const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  IDENT: 'IDENT',       // 变量或函数名
  OP: 'OP',             // + - * / ^ %
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  BANG: 'BANG',         // 阶乘 !
  ASSIGN: 'ASSIGN',     // =
};

const OPS = new Set(['+', '-', '*', '/', '^', '%']);

// 位运算关键字（程序员模式）：在 tokenize 时识别为 OP
const BITWISE_KEYWORDS = {
  and: 'and',
  or: 'or',
  xor: 'xor',
  not: 'not',
  shl: 'shl',
  shr: 'shr',
  ushr: 'ushr',
};

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const n = expr.length;

  while (i < n) {
    const ch = expr[i];

    // 跳过空白
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // 数字（含小数和科学计数法）
    if (isDigit(ch) || (ch === '.' && i + 1 < n && isDigit(expr[i + 1]))) {
      // 检测进制前缀：0x / 0b / 0o
      if (ch === '0' && i + 1 < n) {
        const next = expr[i + 1];
        if (next === 'x' || next === 'X') {
          // 十六进制 0xFF
          let j = i + 2;
          while (j < n && /[0-9a-fA-F]/.test(expr[j])) j++;
          if (j === i + 2) throw new Error('十六进制数字 0x 后无有效数字');
          tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseInt(expr.slice(i + 2, j), 16).toString() });
          i = j;
          continue;
        }
        if (next === 'b' || next === 'B') {
          // 二进制 0b1010
          let j = i + 2;
          while (j < n && /[01]/.test(expr[j])) j++;
          if (j === i + 2) throw new Error('二进制数字 0b 后无有效数字');
          tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseInt(expr.slice(i + 2, j), 2).toString() });
          i = j;
          continue;
        }
        if (next === 'o' || next === 'O') {
          // 八进制 0o17
          let j = i + 2;
          while (j < n && /[0-7]/.test(expr[j])) j++;
          if (j === i + 2) throw new Error('八进制数字 0o 后无有效数字');
          tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseInt(expr.slice(i + 2, j), 8).toString() });
          i = j;
          continue;
        }
      }
      let j = i;
      let dotSeen = false;
      let eSeen = false;
      while (j < n) {
        const c = expr[j];
        if (isDigit(c)) {
          j++;
        } else if (c === '.' && !dotSeen && !eSeen) {
          dotSeen = true;
          j++;
        } else if ((c === 'e' || c === 'E') && !eSeen && j + 1 < n &&
                   (isDigit(expr[j + 1]) || ((expr[j + 1] === '+' || expr[j + 1] === '-') && j + 2 < n && isDigit(expr[j + 2])))) {
          eSeen = true;
          j++;
          if (expr[j] === '+' || expr[j] === '-') j++;
        } else {
          break;
        }
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: expr.slice(i, j) });
      i = j;
      continue;
    }

    // 标识符（变量/函数/常量）：字母或下划线开头
    if (isIdentStart(ch)) {
      let j = i;
      while (j < n && isIdentPart(expr[j])) j++;
      const word = expr.slice(i, j);
      // 检查是否是位运算关键字（区分大小写）
      if (Object.prototype.hasOwnProperty.call(BITWISE_KEYWORDS, word)) {
        tokens.push({ type: TOKEN_TYPES.OP, value: word });
      } else {
        tokens.push({ type: TOKEN_TYPES.IDENT, value: word });
      }
      i = j;
      continue;
    }

    // 运算符
    if (OPS.has(ch)) {
      tokens.push({ type: TOKEN_TYPES.OP, value: ch });
      i++;
      continue;
    }

    if (ch === '(') { tokens.push({ type: TOKEN_TYPES.LPAREN, value: ch }); i++; continue; }
    if (ch === ')') { tokens.push({ type: TOKEN_TYPES.RPAREN, value: ch }); i++; continue; }
    if (ch === ',') { tokens.push({ type: TOKEN_TYPES.COMMA, value: ch }); i++; continue; }
    if (ch === '!') { tokens.push({ type: TOKEN_TYPES.BANG, value: ch }); i++; continue; }
    if (ch === '=') { tokens.push({ type: TOKEN_TYPES.ASSIGN, value: ch }); i++; continue; }

    throw new Error(`无法识别的字符: "${ch}" (位置 ${i})`);
  }

  return tokens;
}

function isDigit(c) { return c >= '0' && c <= '9'; }
function isIdentStart(c) { return /[a-zA-Z_]/.test(c); }
function isIdentPart(c) { return /[a-zA-Z0-9_]/.test(c); }

// ============ 语法分析（Shunting Yard → RPN）============

// 运算符优先级
const PRECEDENCE = {
  'or': 0,
  'and': 1, 'xor': 1,
  '+': 2, '-': 2,
  'shl': 2, 'shr': 2, 'ushr': 2,
  '*': 3, '/': 3, '%': 3,
  'u-': 4,  // 一元负号（低于 ^，使 -2^2 = -4 而非 4）
  'not': 4, // 一元前缀 not（同 u-）
  '^': 5,   // 幂运算（高于一元负）
  '!': 6,   // 后缀阶乘（最高）
};

// 结合性：^ 右结合；一元前缀 u-/not 也是右结合（不弹前面的同优先级一元运算符）
const RIGHT_ASSOC = new Set(['^', 'u-', 'not']);

// 支持的函数
const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  log: Math.log10, ln: Math.log,
  log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt,
  abs: Math.abs, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sign: Math.sign,
  // 双参数
  pow: Math.pow, atan2: Math.atan2, max: Math.max, min: Math.min,
  // 可变参数
  gcd: (a, b) => {
    a = Math.abs(Math.trunc(a)); b = Math.abs(Math.trunc(b));
    while (b) { [a, b] = [b, a % b]; }
    return a;
  },
  lcm: (a, b) => {
    a = Math.abs(Math.trunc(a)); b = Math.abs(Math.trunc(b));
    if (a === 0 || b === 0) return 0;
    const g = FUNCTIONS.gcd(a, b);
    return (a / g) * b;
  },
  rand: () => Math.random(),
};

const FUNCTION_ARITY = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1,
  sinh: 1, cosh: 1, tanh: 1,
  log: 1, ln: 1, log2: 1,
  sqrt: 1, cbrt: 1, abs: 1, exp: 1,
  floor: 1, ceil: 1, round: 1, sign: 1,
  pow: 2, atan2: 2, max: 2, min: 2, gcd: 2, lcm: 2,
  rand: 0,
};

const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  phi: (1 + Math.sqrt(5)) / 2,
  inf: Infinity,
};

function isFunctionName(name) { return Object.prototype.hasOwnProperty.call(FUNCTIONS, name); }

// 把 token 流转换为 RPN（逆波兰表达式），便于求值
function toRPN(tokens, variables) {
  const output = [];
  const opStack = []; // 存运算符、左括号、函数标记

  let prevType = null; // 上一个输出 token 类型，用于识别一元负号

  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];

    if (tk.type === TOKEN_TYPES.NUMBER) {
      output.push({ kind: 'num', value: parseFloat(tk.value) });
      prevType = 'operand';
      continue;
    }

    if (tk.type === TOKEN_TYPES.IDENT) {
      // 函数调用 vs 变量/常量
      const next = tokens[i + 1];
      if (next && next.type === TOKEN_TYPES.LPAREN) {
        // 函数
        if (!isFunctionName(tk.value)) {
          throw new Error(`未知函数: ${tk.value}`);
        }
        opStack.push({ kind: 'func', name: tk.value });
        // 注意：不把左括号再 push，func 自身就起到"括号域开始"的标记作用
        // 但为了简洁，我们仍然 push 一个 func 标记，下面 LPAREN 处理时跳过
        prevType = 'func';
        continue;
      }
      // 常量优先于变量
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, tk.value)) {
        output.push({ kind: 'num', value: CONSTANTS[tk.value] });
      } else if (variables && Object.prototype.hasOwnProperty.call(variables, tk.value)) {
        const v = variables[tk.value];
        if (typeof v !== 'number' || isNaN(v)) {
          throw new Error(`变量 "${tk.value}" 的值无效`);
        }
        output.push({ kind: 'num', value: v });
      } else {
        throw new Error(`未知标识符: ${tk.value}`);
      }
      prevType = 'operand';
      continue;
    }

    if (tk.type === TOKEN_TYPES.LPAREN) {
      opStack.push({ kind: 'lparen' });
      prevType = 'lparen';
      continue;
    }

    if (tk.type === TOKEN_TYPES.RPAREN) {
      // 弹栈直到找到 lparen
      let found = false;
      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1];
        if (top.kind === 'lparen') {
          opStack.pop();
          found = true;
          break;
        }
        if (top.kind === 'func') {
          // 不应该在这里直接遇到 func，但为防御抛错
          throw new Error(`函数 ${top.name} 缺少左括号`);
        }
        output.push({ kind: 'op', value: opStack.pop().value });
      }
      if (!found) {
        throw new Error('括号不匹配：缺少左括号 (');
      }
      // 弹出 lparen 后，如果栈顶是 func，则这是函数调用
      if (opStack.length > 0 && opStack[opStack.length - 1].kind === 'func') {
        const func = opStack.pop();
        output.push({ kind: 'call', name: func.name });
      }
      prevType = 'operand';
      continue;
    }

    if (tk.type === TOKEN_TYPES.COMMA) {
      // 函数参数分隔符：弹栈到 func 标记
      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1];
        if (top.kind === 'func') break;
        if (top.kind === 'lparen') break; // 防御
        output.push({ kind: 'op', value: opStack.pop().value });
      }
      prevType = 'comma';
      continue;
    }

    if (tk.type === TOKEN_TYPES.BANG) {
      // 后缀阶乘，作为右结合的一元运算符
      opStack.push({ kind: 'op', value: '!' });
      prevType = 'postop';
      continue;
    }

    if (tk.type === TOKEN_TYPES.OP) {
      let op = tk.value;
      // 一元负号识别：当 op 是 '-' 或 '+' 且前一个是 null/lparen/op/comma/func 时
      if ((op === '-' || op === '+') &&
          (prevType === null || prevType === 'lparen' || prevType === 'op' || prevType === 'comma' || prevType === 'func')) {
        if (op === '-') {
          op = 'u-'; // 一元负
        } else {
          // 一元正号直接忽略
          prevType = 'uop';
          continue;
        }
      }
      // 'not' 总是当作一元前缀运算符
      if (op === 'not') {
        op = 'not'; // 一元前缀
        opStack.push({ kind: 'op', value: op });
        prevType = 'op';
        continue;
      }

      // 弹出优先级更高或相等（左结合）的运算符
      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1];
        if (top.kind !== 'op') break;
        const topPrec = PRECEDENCE[top.value];
        const curPrec = PRECEDENCE[op];
        if (topPrec > curPrec ||
            (topPrec === curPrec && !RIGHT_ASSOC.has(op))) {
          output.push({ kind: 'op', value: opStack.pop().value });
        } else {
          break;
        }
      }
      opStack.push({ kind: 'op', value: op });
      prevType = 'op';
      continue;
    }
  }

  // 弹出剩余运算符
  while (opStack.length > 0) {
    const top = opStack.pop();
    if (top.kind === 'lparen') {
      throw new Error('括号不匹配：缺少右括号 )');
    }
    if (top.kind === 'func') {
      throw new Error(`函数 ${top.name} 缺少右括号`);
    }
    output.push({ kind: 'op', value: top.value });
  }

  return output;
}

// ============ RPN 求值 ============

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) {
    // 对非整数用 Gamma 函数的 Lanczos 近似（够用）
    if (n < 0) throw new Error('负数无阶乘');
    return gamma(n + 1);
  }
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// Lanczos 近似 Gamma 函数
function gamma(z) {
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function applyOp(op, b, a) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/':
      if (b === 0) throw new Error('除零错误');
      return a / b;
    case '%':
      if (b === 0) throw new Error('模零错误');
      return a % b;
    case '^': return Math.pow(a, b);
    case 'u-': return -b; // 一元负
    // 位运算（程序员模式）
    case 'and': return Math.trunc(a) & Math.trunc(b);
    case 'or': return Math.trunc(a) | Math.trunc(b);
    case 'xor': return Math.trunc(a) ^ Math.trunc(b);
    case 'shl': return Math.trunc(a) << Math.trunc(b);
    case 'shr': return Math.trunc(a) >> Math.trunc(b);
    case 'ushr': return Math.trunc(a) >>> Math.trunc(b);
    default: throw new Error(`未知运算符: ${op}`);
  }
}

// 一元运算符求值
function applyUnaryOp(op, a) {
  switch (op) {
    case 'u-': return -a;
    case 'not': return ~Math.trunc(a);
    default: throw new Error(`未知一元运算符: ${op}`);
  }
}

function evaluateRPN(rpn) {
  const stack = [];
  for (const item of rpn) {
    if (item.kind === 'num') {
      stack.push(item.value);
    } else if (item.kind === 'op') {
      if (item.value === '!') {
        // 后缀阶乘，一元
        const a = stack.pop();
        if (a === undefined) throw new Error('表达式不完整');
        stack.push(factorial(a));
      } else if (item.value === 'u-' || item.value === 'not') {
        const a = stack.pop();
        if (a === undefined) throw new Error('表达式不完整');
        stack.push(applyUnaryOp(item.value, a));
      } else {
        // 二元
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) throw new Error('表达式不完整');
        stack.push(applyOp(item.value, b, a));
      }
    } else if (item.kind === 'call') {
      const arity = FUNCTION_ARITY[item.name];
      const args = [];
      for (let k = 0; k < arity; k++) {
        const v = stack.pop();
        if (v === undefined) throw new Error(`函数 ${item.name} 参数不足`);
        args.unshift(v);
      }
      const result = FUNCTIONS[item.name](...args);
      stack.push(result);
    }
  }
  if (stack.length !== 1) {
    throw new Error('表达式不完整或语法错误');
  }
  return stack[0];
}

// ============ 对外入口：求值 ============

function evaluate(expr, variables) {
  if (typeof expr !== 'string') throw new Error('表达式必须是字符串');
  const trimmed = expr.trim();
  if (trimmed === '') throw new Error('表达式为空');
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) throw new Error('表达式为空');
  const rpn = toRPN(tokens, variables || {});
  return evaluateRPN(rpn);
}

// ============ 变量赋值解析 ============

// 解析 "x = 5" 形式，返回 { name, value }
// 如果不是赋值表达式，返回 null
function tryParseAssignment(expr, existingVariables) {
  // 找到第一个顶层 =（不在函数括号内）
  const tokens = tokenize(expr);
  // 必须形如: IDENT = <expr>
  if (tokens.length < 3) return null;
  if (tokens[0].type !== TOKEN_TYPES.IDENT) return null;
  if (tokens[1].type !== TOKEN_TYPES.ASSIGN) return null;
  if (isFunctionName(tokens[0].value)) {
    throw new Error(`不能给函数 "${tokens[0].value}" 赋值`);
  }
  if (Object.prototype.hasOwnProperty.call(CONSTANTS, tokens[0].value)) {
    throw new Error(`不能给常量 "${tokens[0].value}" 赋值`);
  }
  const name = tokens[0].value;
  const rhsTokens = tokens.slice(2);
  if (rhsTokens.length === 0) throw new Error('赋值右侧为空');
  const rpn = toRPN(rhsTokens, existingVariables || {});
  const value = evaluateRPN(rpn);
  return { name, value };
}

// ============ 程序员模式：进制转换与位运算 ============

const BASES = { bin: 2, oct: 8, dec: 10, hex: 16 };

function toBase(num, base) {
  if (typeof num !== 'number' || !isFinite(num)) {
    throw new Error('数值无效');
  }
  const n = Math.trunc(num);
  if (base === 10) return String(n);
  if (base === 2) return n.toString(2);
  if (base === 8) return n.toString(8);
  if (base === 16) return n.toString(16).toUpperCase();
  throw new Error(`不支持的进制: ${base}`);
}

function fromBase(str, base) {
  if (typeof str !== 'string') throw new Error('输入必须是字符串');
  const cleaned = str.trim().toLowerCase().replace(/^0b|^0o|^0x/, '');
  const n = parseInt(cleaned, base);
  if (isNaN(n)) throw new Error(`无法解析为 base ${base}: ${str}`);
  return n;
}

function bitwiseOp(op, a, b) {
  const x = Math.trunc(a);
  const y = Math.trunc(b);
  switch (op) {
    case 'and': return x & y;
    case 'or': return x | y;
    case 'xor': return x ^ y;
    case 'shl': return x << y;
    case 'shr': return x >> y;
    case 'ushr': return x >>> y;
    case 'not': return ~x;
    default: throw new Error(`未知位运算: ${op}`);
  }
}

// ============ 格式化输出 ============

function formatResult(num, options) {
  if (typeof num !== 'number') return String(num);
  if (isNaN(num)) return 'NaN';
  if (!isFinite(num)) return num > 0 ? '∞' : '-∞';
  if (Object.is(num, -0)) num = 0;

  const opts = options || {};
  const precision = opts.precision != null ? opts.precision : 12;

  // 整数
  if (Number.isInteger(num)) {
    // 避免大整数精度问题
    if (Math.abs(num) < 1e15) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return num.toExponential(precision);
  }

  // 浮点数：先 toPrecision 再去掉尾零
  let s = num.toPrecision(precision);
  // 去掉多余 0
  if (s.indexOf('.') !== -1 && s.indexOf('e') === -1 && s.indexOf('E') === -1) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return s;
}

module.exports = {
  TOKEN_TYPES,
  tokenize,
  toRPN,
  evaluateRPN,
  evaluate,
  tryParseAssignment,
  factorial,
  FUNCTIONS,
  CONSTANTS,
  BASES,
  toBase,
  fromBase,
  bitwiseOp,
  formatResult,
};
