# -*- coding: utf-8 -*-
"""计算器便携版 · 表达式引擎
移植自 calculator-manager/src/core/calc-engine.js
自研词法 + Shunting Yard 语法分析 + RPN 求值，不依赖第三方库
支持：四则运算、括号嵌套、函数、常量、变量定义、幂运算、取模、阶乘、进制前缀
"""
import math
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

# ============ 词法分析 ============

NUMBER = 'NUMBER'
IDENT = 'IDENT'           # 变量或函数名
OP = 'OP'                 # + - * / ^ %
LPAREN = 'LPAREN'
RPAREN = 'RPAREN'
COMMA = 'COMMA'
BANG = 'BANG'             # 阶乘 !
ASSIGN = 'ASSIGN'         # =

_OPS = set('+-*/^%')

# 位运算关键字（程序员模式）：词法分析时识别为 OP
_BITWISE_KEYWORDS = {'and', 'or', 'xor', 'not', 'shl', 'shr', 'ushr'}


@dataclass
class Token:
    type: str
    value: str


def _is_digit(c: str) -> bool:
    return '0' <= c <= '9'


def _is_ident_start(c: str) -> bool:
    return c.isalpha() or c == '_'


def _is_ident_part(c: str) -> bool:
    return c.isalnum() or c == '_'


def tokenize(expr: str) -> List[Token]:
    tokens: List[Token] = []
    i = 0
    n = len(expr)
    while i < n:
        ch = expr[i]
        # 跳过空白
        if ch in ' \t\n\r':
            i += 1
            continue
        # 数字（含小数、科学计数法、进制前缀）
        if _is_digit(ch) or (ch == '.' and i + 1 < n and _is_digit(expr[i + 1])):
            # 进制前缀 0x / 0b / 0o
            if ch == '0' and i + 1 < n:
                nxt = expr[i + 1]
                if nxt in 'xX':
                    j = i + 2
                    while j < n and expr[j] in '0123456789abcdefABCDEF':
                        j += 1
                    if j == i + 2:
                        raise ValueError('十六进制数字 0x 后无有效数字')
                    tokens.append(Token(NUMBER, str(int(expr[i + 2:j], 16))))
                    i = j
                    continue
                if nxt in 'bB':
                    j = i + 2
                    while j < n and expr[j] in '01':
                        j += 1
                    if j == i + 2:
                        raise ValueError('二进制数字 0b 后无有效数字')
                    tokens.append(Token(NUMBER, str(int(expr[i + 2:j], 2))))
                    i = j
                    continue
                if nxt in 'oO':
                    j = i + 2
                    while j < n and expr[j] in '01234567':
                        j += 1
                    if j == i + 2:
                        raise ValueError('八进制数字 0o 后无有效数字')
                    tokens.append(Token(NUMBER, str(int(expr[i + 2:j], 8))))
                    i = j
                    continue
            j = i
            dot_seen = False
            e_seen = False
            while j < n:
                c = expr[j]
                if _is_digit(c):
                    j += 1
                elif c == '.' and not dot_seen and not e_seen:
                    dot_seen = True
                    j += 1
                elif c in 'eE' and not e_seen and j + 1 < n and (
                    _is_digit(expr[j + 1]) or (expr[j + 1] in '+-' and j + 2 < n and _is_digit(expr[j + 2]))
                ):
                    e_seen = True
                    j += 1
                    if j < n and expr[j] in '+-':
                        j += 1
                else:
                    break
            tokens.append(Token(NUMBER, expr[i:j]))
            i = j
            continue
        # 标识符
        if _is_ident_start(ch):
            j = i
            while j < n and _is_ident_part(expr[j]):
                j += 1
            word = expr[i:j]
            if word in _BITWISE_KEYWORDS:
                tokens.append(Token(OP, word))
            else:
                tokens.append(Token(IDENT, word))
            i = j
            continue
        # 运算符
        if ch in _OPS:
            tokens.append(Token(OP, ch))
            i += 1
            continue
        if ch == '(':
            tokens.append(Token(LPAREN, ch)); i += 1; continue
        if ch == ')':
            tokens.append(Token(RPAREN, ch)); i += 1; continue
        if ch == ',':
            tokens.append(Token(COMMA, ch)); i += 1; continue
        if ch == '!':
            tokens.append(Token(BANG, ch)); i += 1; continue
        if ch == '=':
            tokens.append(Token(ASSIGN, ch)); i += 1; continue
        raise ValueError(f'无法识别的字符: "{ch}" (位置 {i})')
    return tokens


# ============ 运算符优先级 / 结合性 ============

PRECEDENCE = {
    'or': 0,
    'and': 1, 'xor': 1,
    '+': 2, '-': 2,
    'shl': 2, 'shr': 2, 'ushr': 2,
    '*': 3, '/': 3, '%': 3,
    'u-': 4, 'not': 4,
    '^': 5,
    '!': 6,
}
RIGHT_ASSOC = {'^', 'u-', 'not'}


# ============ 函数 / 常量 ============

def _gcd(a: float, b: float) -> float:
    a = abs(int(a)); b = abs(int(b))
    while b:
        a, b = b, a % b
    return a


def _lcm(a: float, b: float) -> float:
    a = abs(int(a)); b = abs(int(b))
    if a == 0 or b == 0:
        return 0
    return (a // _gcd(a, b)) * b


FUNCTIONS = {
    'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
    'asin': math.asin, 'acos': math.acos, 'atan': math.atan,
    'sinh': math.sinh, 'cosh': math.cosh, 'tanh': math.tanh,
    'log': math.log10, 'ln': math.log, 'log2': math.log2,
    'sqrt': math.sqrt, 'cbrt': lambda x: math.copysign(abs(x) ** (1 / 3), x),
    'abs': abs, 'exp': math.exp,
    'floor': math.floor, 'ceil': math.ceil, 'round': lambda x: float(round(x)),
    'sign': lambda x: math.copysign(1.0, x) if x != 0 else 0.0,
    'pow': math.pow, 'atan2': math.atan2, 'max': max, 'min': min,
    'gcd': _gcd, 'lcm': _lcm,
    'rand': lambda: __import__('random').random(),
}

FUNCTION_ARITY = {
    'sin': 1, 'cos': 1, 'tan': 1, 'asin': 1, 'acos': 1, 'atan': 1,
    'sinh': 1, 'cosh': 1, 'tanh': 1,
    'log': 1, 'ln': 1, 'log2': 1,
    'sqrt': 1, 'cbrt': 1, 'abs': 1, 'exp': 1,
    'floor': 1, 'ceil': 1, 'round': 1, 'sign': 1,
    'pow': 2, 'atan2': 2, 'max': 2, 'min': 2, 'gcd': 2, 'lcm': 2,
    'rand': 0,
}

CONSTANTS = {
    'pi': math.pi,
    'e': math.e,
    'tau': math.tau,
    'phi': (1 + math.sqrt(5)) / 2,
    'inf': math.inf,
}


def _is_function_name(name: str) -> bool:
    return name in FUNCTIONS


# ============ Shunting Yard → RPN ============

@dataclass
class _RPNItem:
    kind: str
    value: Any = None
    name: Optional[str] = None


def to_rpn(tokens: List[Token], variables: Dict[str, float]) -> List[_RPNItem]:
    output: List[_RPNItem] = []
    op_stack: List[_RPNItem] = []
    prev_type: Optional[str] = None

    for idx, tk in enumerate(tokens):
        if tk.type == NUMBER:
            output.append(_RPNItem('num', float(tk.value)))
            prev_type = 'operand'
            continue
        if tk.type == IDENT:
            nxt = tokens[idx + 1] if idx + 1 < len(tokens) else None
            if nxt and nxt.type == LPAREN:
                if not _is_function_name(tk.value):
                    raise ValueError(f'未知函数: {tk.value}')
                op_stack.append(_RPNItem('func', name=tk.value))
                prev_type = 'func'
                continue
            if tk.value in CONSTANTS:
                output.append(_RPNItem('num', CONSTANTS[tk.value]))
            elif tk.value in variables:
                v = variables[tk.value]
                if not isinstance(v, (int, float)) or (isinstance(v, float) and math.isnan(v)):
                    raise ValueError(f'变量 "{tk.value}" 的值无效')
                output.append(_RPNItem('num', float(v)))
            else:
                raise ValueError(f'未知标识符: {tk.value}')
            prev_type = 'operand'
            continue
        if tk.type == LPAREN:
            op_stack.append(_RPNItem('lparen'))
            prev_type = 'lparen'
            continue
        if tk.type == RPAREN:
            found = False
            while op_stack:
                top = op_stack[-1]
                if top.kind == 'lparen':
                    op_stack.pop()
                    found = True
                    break
                if top.kind == 'func':
                    raise ValueError(f'函数 {top.name} 缺少左括号')
                output.append(op_stack.pop())
            if not found:
                raise ValueError('括号不匹配：缺少左括号 (')
            if op_stack and op_stack[-1].kind == 'func':
                func = op_stack.pop()
                output.append(_RPNItem('call', name=func.name))
            prev_type = 'operand'
            continue
        if tk.type == COMMA:
            while op_stack:
                top = op_stack[-1]
                if top.kind in ('func', 'lparen'):
                    break
                output.append(op_stack.pop())
            prev_type = 'comma'
            continue
        if tk.type == BANG:
            op_stack.append(_RPNItem('op', '!'))
            prev_type = 'postop'
            continue
        if tk.type == OP:
            op = tk.value
            if op in ('-', '+') and prev_type in (None, 'lparen', 'op', 'comma', 'func'):
                if op == '-':
                    op = 'u-'
                else:
                    prev_type = 'uop'
                    continue
            if op == 'not':
                op_stack.append(_RPNItem('op', 'not'))
                prev_type = 'op'
                continue
            while op_stack:
                top = op_stack[-1]
                if top.kind != 'op':
                    break
                top_prec = PRECEDENCE.get(top.value, -1)
                cur_prec = PRECEDENCE.get(op, -1)
                if top_prec > cur_prec or (top_prec == cur_prec and op not in RIGHT_ASSOC):
                    output.append(op_stack.pop())
                else:
                    break
            op_stack.append(_RPNItem('op', op))
            prev_type = 'op'
            continue

    while op_stack:
        top = op_stack.pop()
        if top.kind == 'lparen':
            raise ValueError('括号不匹配：缺少右括号 )')
        if top.kind == 'func':
            raise ValueError(f'函数 {top.name} 缺少右括号')
        output.append(top)
    return output


# ============ 阶乘 / Gamma ============

def _gamma(z: float) -> float:
    g = 7
    c = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ]
    if z < 0.5:
        return math.pi / (math.sin(math.pi * z) * _gamma(1 - z))
    z -= 1
    x = c[0]
    for i in range(1, g + 2):
        x += c[i] / (z + i)
    t = z + g + 0.5
    return math.sqrt(2 * math.pi) * (t ** (z + 0.5)) * math.exp(-t) * x


def factorial(n: float) -> float:
    if n < 0:
        raise ValueError('负数无阶乘')
    if n != int(n):
        return _gamma(n + 1)
    n = int(n)
    if n > 170:
        return math.inf
    r = 1.0
    for i in range(2, n + 1):
        r *= i
    return r


def _apply_op(op: str, b: float, a: float) -> float:
    if op == '+': return a + b
    if op == '-': return a - b
    if op == '*': return a * b
    if op == '/':
        if b == 0: raise ValueError('除零错误')
        return a / b
    if op == '%':
        if b == 0: raise ValueError('模零错误')
        return a % b
    if op == '^': return math.pow(a, b)
    if op == 'u-': return -b
    if op == 'and': return int(a) & int(b)
    if op == 'or': return int(a) | int(b)
    if op == 'xor': return int(a) ^ int(b)
    if op == 'shl': return int(a) << int(b)
    if op == 'shr': return int(a) >> int(b)
    if op == 'ushr': return (int(a) % (1 << 32)) >> int(b)
    raise ValueError(f'未知运算符: {op}')


def _apply_unary(op: str, a: float) -> float:
    if op == 'u-': return -a
    if op == 'not': return ~int(a)
    raise ValueError(f'未知一元运算符: {op}')


def evaluate_rpn(rpn: List[_RPNItem]) -> float:
    stack: List[float] = []
    for item in rpn:
        if item.kind == 'num':
            stack.append(item.value)
        elif item.kind == 'op':
            v = item.value
            if v == '!':
                a = stack.pop() if stack else None
                if a is None: raise ValueError('表达式不完整')
                stack.append(factorial(a))
            elif v in ('u-', 'not'):
                a = stack.pop() if stack else None
                if a is None: raise ValueError('表达式不完整')
                stack.append(_apply_unary(v, a))
            else:
                b = stack.pop() if stack else None
                a = stack.pop() if stack else None
                if a is None or b is None: raise ValueError('表达式不完整')
                stack.append(_apply_op(v, b, a))
        elif item.kind == 'call':
            arity = FUNCTION_ARITY[item.name]
            args = []
            for _ in range(arity):
                v = stack.pop() if stack else None
                if v is None: raise ValueError(f'函数 {item.name} 参数不足')
                args.insert(0, v)
            stack.append(FUNCTIONS[item.name](*args))
    if len(stack) != 1:
        raise ValueError('表达式不完整或语法错误')
    return stack[0]


# ============ 对外入口 ============

def evaluate(expr: str, variables: Optional[Dict[str, float]] = None) -> float:
    if not isinstance(expr, str):
        raise ValueError('表达式必须是字符串')
    trimmed = expr.strip()
    if trimmed == '':
        raise ValueError('表达式为空')
    tokens = tokenize(trimmed)
    if not tokens:
        raise ValueError('表达式为空')
    rpn = to_rpn(tokens, variables or {})
    return evaluate_rpn(rpn)


def try_parse_assignment(expr: str, existing_variables: Optional[Dict[str, float]] = None) -> Optional[Dict[str, Any]]:
    """解析 'x = 5' 形式，返回 {'name':..., 'value':...}；非赋值返回 None"""
    tokens = tokenize(expr)
    if len(tokens) < 3:
        return None
    if tokens[0].type != IDENT or tokens[1].type != ASSIGN:
        return None
    if _is_function_name(tokens[0].value):
        raise ValueError(f'不能给函数 "{tokens[0].value}" 赋值')
    if tokens[0].value in CONSTANTS:
        raise ValueError(f'不能给常量 "{tokens[0].value}" 赋值')
    name = tokens[0].value
    rhs_tokens = tokens[2:]
    if not rhs_tokens:
        raise ValueError('赋值右侧为空')
    rpn = to_rpn(rhs_tokens, existing_variables or {})
    value = evaluate_rpn(rpn)
    return {'name': name, 'value': value}


# ============ 格式化输出 ============

def format_result(num: float, precision: int = 12) -> str:
    if not isinstance(num, (int, float)):
        return str(num)
    if isinstance(num, float) and math.isnan(num):
        return 'NaN'
    if isinstance(num, float) and math.isinf(num):
        return '∞' if num > 0 else '-∞'
    # 整数（int 或 float 整数值）：加千分位
    is_int = isinstance(num, int) or (isinstance(num, float) and num.is_integer())
    if is_int:
        iv = int(num)
        if abs(iv) < 10 ** 15:
            return f'{iv:,}'
        return f'{float(iv):.{precision}e}'
    # 浮点数：toPrecision 后去尾零
    s = f'{num:.{precision}g}'
    if '.' in s and 'e' not in s and 'E' not in s:
        s = s.rstrip('0').rstrip('.')
    return s
