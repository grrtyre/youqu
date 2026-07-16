# -*- coding: utf-8 -*-
"""计算器管家·便携版 — 单文件版（合并所有模块，方便 PyInstaller 打包）
像输入法一样的计算器：全局热键唤起、失焦自动隐藏、系统托盘常驻、小界面。
苹果白高端风格，原生 Python + customtkinter，无 Electron。
"""
import ctypes
import ctypes.wintypes as wt
import json
import math
import os
import re
import sys
import threading
import tkinter as tk

import customtkinter as ctk
from PIL import Image, ImageDraw

# ============ 表达式引擎 ============
class CalcError(Exception):
    pass

CONSTANTS = {'pi': math.pi, 'e': math.e, 'tau': math.tau, 'phi': 1.618033988749895}

UNARY_FUNCS = {
    'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
    'asin': math.asin, 'acos': math.acos, 'atan': math.atan,
    'sinh': math.sinh, 'cosh': math.cosh, 'tanh': math.tanh,
    'log': math.log10, 'ln': math.log, 'log2': math.log2,
    'exp': math.exp, 'sqrt': math.sqrt,
    'cbrt': lambda x: math.copysign(abs(x) ** (1 / 3), x),
    'floor': lambda x: float(math.floor(x)),
    'ceil': lambda x: float(math.ceil(x)),
    'round': lambda x: float(round(x)),
    'abs': abs, 'sign': lambda x: (x > 0) - (x < 0),
}

def _gcd(a, b): return float(math.gcd(int(a), int(b)))
def _lcm(a, b):
    if a == 0 or b == 0: return 0.0
    return float(abs(int(a) * int(b)) // math.gcd(int(a), int(b)))

MULTI_FUNCS = {
    'pow': lambda a, b: a ** b, 'atan2': math.atan2,
    'gcd': _gcd, 'lcm': _lcm,
    'max': lambda a, b: max(a, b), 'min': lambda a, b: min(a, b),
}

KEYWORDS = {'and': 'AND', 'or': 'OR', 'xor': 'XOR', 'not': 'NOT',
            'shl': 'SHL', 'shr': 'SHR', 'mod': 'MOD'}

PRECEDENCE = {'OR': 1, 'AND': 1, 'XOR': 1, 'NOT': 2, 'SHL': 3, 'SHR': 3,
              'MOD': 4, 'PLUS': 5, 'MINUS': 5, 'MUL': 6, 'DIV': 6, 'PERCENT': 6,
              'UPLUS': 7, 'UMINUS': 7, 'POW': 8, 'FACT': 9}
RIGHT_ASSOC = {'POW', 'UPLUS', 'UMINUS', 'NOT'}

class Token:
    __slots__ = ('type', 'value')
    def __init__(self, t, v): self.type, self.value = t, v

def tokenize(s):
    tokens, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c.isspace(): i += 1; continue
        if c == '0' and i + 1 < n and s[i + 1] in 'xXbBoO':
            j = i + 2
            while j < n and s[j].isalnum(): j += 1
            try:
                val = int(s[i:j], {'x': 16, 'X': 16, 'b': 2, 'B': 2, 'o': 8, 'O': 8}[s[i + 1]])
            except ValueError: raise CalcError(f'无效的进制字面量: {s[i:j]}')
            tokens.append(Token('NUMBER', float(val))); i = j; continue
        if c.isdigit() or (c == '.' and i + 1 < n and s[i + 1].isdigit()):
            j = i
            while j < n and (s[j].isdigit() or s[j] == '.'): j += 1
            if j < n and s[j] in 'eE':
                j += 1
                if j < n and s[j] in '+-': j += 1
                while j < n and s[j].isdigit(): j += 1
            try: val = float(s[i:j])
            except ValueError: raise CalcError(f'无效的数字: {s[i:j]}')
            tokens.append(Token('NUMBER', val)); i = j; continue
        if c.isalpha() or c == '_':
            j = i
            while j < n and (s[j].isalnum() or s[j] == '_'): j += 1
            name, lower = s[i:j], s[i:j].lower()
            if lower in KEYWORDS: tokens.append(Token(KEYWORDS[lower], name))
            elif lower in CONSTANTS: tokens.append(Token('NUMBER', CONSTANTS[lower]))
            elif lower in UNARY_FUNCS or lower in MULTI_FUNCS: tokens.append(Token('FUNC', lower))
            else: tokens.append(Token('VAR', name))
            i = j; continue
        op_map = {'+': 'PLUS', '-': 'MINUS', '*': 'MUL', '/': 'DIV', '^': 'POW',
                  '%': 'PERCENT', '!': 'FACT', '(': 'LPAREN', ')': 'RPAREN', ',': 'COMMA'}
        if c in op_map: tokens.append(Token(op_map[c], c)); i += 1; continue
        raise CalcError(f'未知字符: {c}')
    return tokens

def _is_unary_context(prev):
    if prev is None: return True
    return prev.type in ('PLUS', 'MINUS', 'MUL', 'DIV', 'POW', 'PERCENT', 'MOD',
                         'AND', 'OR', 'XOR', 'SHL', 'SHR', 'NOT', 'UPLUS', 'UMINUS', 'LPAREN', 'COMMA')

def _should_pop(sop, cop):
    if sop == 'FACT': return True
    if cop == 'FACT': return False
    sp, cp = PRECEDENCE.get(sop, 0), PRECEDENCE.get(cop, 0)
    return sp > cp if cop in RIGHT_ASSOC else sp >= cp

def to_rpn(tokens):
    output, stack, prev = [], [], None
    for tok in tokens:
        if tok.type in ('NUMBER', 'VAR'): output.append(tok)
        elif tok.type == 'FUNC': stack.append(tok)
        elif tok.type == 'COMMA':
            while stack and stack[-1].type != 'LPAREN': output.append(stack.pop())
            if not stack: raise CalcError('逗号不匹配')
        elif tok.type == 'LPAREN': stack.append(tok)
        elif tok.type == 'RPAREN':
            while stack and stack[-1].type != 'LPAREN': output.append(stack.pop())
            if not stack: raise CalcError('括号不匹配')
            stack.pop()
            if stack and stack[-1].type == 'FUNC': output.append(stack.pop())
        else:
            op_type = tok.type
            if tok.type == 'PLUS': op_type = 'UPLUS' if _is_unary_context(prev) else 'PLUS'
            elif tok.type == 'MINUS': op_type = 'UMINUS' if _is_unary_context(prev) else 'MINUS'
            while (stack and stack[-1].type not in ('LPAREN', 'FUNC')
                   and _should_pop(stack[-1].type, op_type)): output.append(stack.pop())
            stack.append(Token(op_type, tok.value))
        prev = tok
    while stack:
        top = stack.pop()
        if top.type in ('LPAREN', 'RPAREN'): raise CalcError('括号不匹配')
        output.append(top)
    return output

def eval_rpn(rpn, variables):
    stack = []
    for tok in rpn:
        if tok.type == 'NUMBER': stack.append(tok.value)
        elif tok.type == 'VAR':
            if tok.value in variables: stack.append(variables[tok.value])
            else: raise CalcError(f'未定义的变量: {tok.value}')
        elif tok.type == 'FUNC':
            if tok.value in UNARY_FUNCS:
                if not stack: raise CalcError(f'函数 {tok.value} 缺少参数')
                try: stack.append(float(UNARY_FUNCS[tok.value](stack.pop())))
                except Exception as e: raise CalcError(f'函数 {tok.value} 错误: {e}')
            elif tok.value in MULTI_FUNCS:
                if len(stack) < 2: raise CalcError(f'函数 {tok.value} 需两个参数')
                b, a = stack.pop(), stack.pop()
                try: stack.append(float(MULTI_FUNCS[tok.value](a, b)))
                except Exception as e: raise CalcError(f'函数 {tok.value} 错误: {e}')
        elif tok.type in ('UPLUS', 'UMINUS', 'NOT'):
            if not stack: raise CalcError('一元运算符缺操作数')
            a = stack.pop()
            stack.append(+a if tok.type == 'UPLUS' else (-a if tok.type == 'UMINUS' else float(~int(a))))
        elif tok.type == 'FACT':
            if not stack: raise CalcError('阶乘缺操作数')
            a = int(stack.pop())
            if a < 0: raise CalcError('负数不能阶乘')
            r = 1
            for k in range(2, a + 1): r *= k
            stack.append(float(r))
        elif tok.type == 'COMMA': pass
        else:
            if len(stack) < 2: raise CalcError(f'运算符 {tok.type} 缺操作数')
            b, a = stack.pop(), stack.pop()
            if tok.type == 'PLUS': stack.append(a + b)
            elif tok.type == 'MINUS': stack.append(a - b)
            elif tok.type == 'MUL': stack.append(a * b)
            elif tok.type == 'DIV':
                if b == 0: raise CalcError('除零错误')
                stack.append(a / b)
            elif tok.type == 'POW': stack.append(a ** b)
            elif tok.type == 'PERCENT': stack.append(a % b)
            elif tok.type == 'MOD':
                if b == 0: raise CalcError('模零错误')
                stack.append(float(int(a) % int(b)))
            elif tok.type == 'AND': stack.append(float(int(a) & int(b)))
            elif tok.type == 'OR': stack.append(float(int(a) | int(b)))
            elif tok.type == 'XOR': stack.append(float(int(a) ^ int(b)))
            elif tok.type == 'SHL': stack.append(float(int(a) << int(b)))
            elif tok.type == 'SHR': stack.append(float(int(a) >> int(b)))
            else: raise CalcError(f'未知运算符: {tok.type}')
    if len(stack) != 1: raise CalcError('表达式不完整')
    return stack[0]

def try_parse_assignment(expr, variables):
    m = re.match(r'^([a-zA-Z_]\w*)\s*=\s*(.+)$', expr)
    if not m: return None
    return (m.group(1), evaluate(m.group(2), variables))

def evaluate(expr, variables=None):
    if variables is None: variables = {}
    expr = expr.strip()
    if not expr: raise CalcError('空表达式')
    return eval_rpn(to_rpn(tokenize(expr)), variables)

def to_base(num, base):
    n = int(num)
    return {16: hex(n).upper().replace('0X', '0x'), 10: str(n),
            8: oct(n), 2: bin(n)}.get(base, str(n))

def format_result(num):
    if not math.isfinite(num): return 'NaN' if math.isnan(num) else ('∞' if num > 0 else '-∞')
    if num == 0: return '0'
    if num == int(num) and abs(num) < 1e15: return f'{int(num):,}'
    ab = abs(num)
    if ab >= 1e15 or ab < 1e-6: return f'{num:.6e}'.replace('e+0', 'e+').replace('e-0', 'e-')
    s = f'{num:.10g}'
    if '.' in s:
        ip, dp = s.split('.')
        if ip.lstrip('-').isdigit(): ip = f'{int(ip):,}'
        s = f'{ip}.{dp}'
    elif s.lstrip('-').isdigit(): s = f'{int(s):,}'
    return s


# ============ 单位转换 ============
class ConvertError(Exception): pass

def _c2k(v): return v + 273.15
def _k2c(v): return v - 273.15
def _f2k(v): return (v - 32) * 5 / 9 + 273.15
def _k2f(v): return (v - 273.15) * 9 / 5 + 32

UNITS = [
    {'key': 'length', 'label': '长度', 'units': [
        {'name': 'm', 'label': '米', 'factor': 1}, {'name': 'km', 'label': '千米', 'factor': 1000},
        {'name': 'cm', 'label': '厘米', 'factor': 0.01}, {'name': 'mm', 'label': '毫米', 'factor': 0.001},
        {'name': 'mi', 'label': '英里', 'factor': 1609.344}, {'name': 'ft', 'label': '英尺', 'factor': 0.3048},
        {'name': 'in', 'label': '英寸', 'factor': 0.0254}, {'name': 'nmi', 'label': '海里', 'factor': 1852},
    ]},
    {'key': 'mass', 'label': '质量', 'units': [
        {'name': 'kg', 'label': '千克', 'factor': 1}, {'name': 'g', 'label': '克', 'factor': 0.001},
        {'name': 't', 'label': '吨', 'factor': 1000}, {'name': 'lb', 'label': '磅', 'factor': 0.45359237},
        {'name': 'oz', 'label': '盎司', 'factor': 0.028349523125}, {'name': 'jin', 'label': '斤', 'factor': 0.5},
    ]},
    {'key': 'time', 'label': '时间', 'units': [
        {'name': 's', 'label': '秒', 'factor': 1}, {'name': 'ms', 'label': '毫秒', 'factor': 0.001},
        {'name': 'min', 'label': '分钟', 'factor': 60}, {'name': 'h', 'label': '小时', 'factor': 3600},
        {'name': 'd', 'label': '天', 'factor': 86400}, {'name': 'w', 'label': '周', 'factor': 604800},
        {'name': 'y', 'label': '年', 'factor': 31557600},
    ]},
    {'key': 'area', 'label': '面积', 'units': [
        {'name': 'm2', 'label': '平方米', 'factor': 1}, {'name': 'km2', 'label': '平方千米', 'factor': 1e6},
        {'name': 'ha', 'label': '公顷', 'factor': 1e4}, {'name': 'mu', 'label': '亩', 'factor': 666.6666666666666},
        {'name': 'ft2', 'label': '平方英尺', 'factor': 0.09290304}, {'name': 'ac', 'label': '英亩', 'factor': 4046.8564224},
    ]},
    {'key': 'volume', 'label': '体积', 'units': [
        {'name': 'l', 'label': '升', 'factor': 0.001}, {'name': 'ml', 'label': '毫升', 'factor': 1e-6},
        {'name': 'm3', 'label': '立方米', 'factor': 1}, {'name': 'gal', 'label': '加仑', 'factor': 0.003785411784},
        {'name': 'pt', 'label': '品脱', 'factor': 0.000473176473}, {'name': 'cup', 'label': '杯', 'factor': 0.0002365882365},
    ]},
    {'key': 'speed', 'label': '速度', 'units': [
        {'name': 'mps', 'label': '米/秒', 'factor': 1}, {'name': 'kmh', 'label': '千米/小时', 'factor': 0.2777777777777778},
        {'name': 'mph', 'label': '英里/小时', 'factor': 0.44704}, {'name': 'kn', 'label': '节', 'factor': 0.5144444444444444},
    ]},
    {'key': 'temperature', 'label': '温度', 'units': [
        {'name': 'c', 'label': '摄氏度', 'toBase': _c2k, 'fromBase': _k2c},
        {'name': 'f', 'label': '华氏度', 'toBase': _f2k, 'fromBase': _k2f},
        {'name': 'k', 'label': '开尔文', 'toBase': lambda v: v, 'fromBase': lambda v: v},
    ]},
    {'key': 'data', 'label': '数据', 'units': [
        {'name': 'B', 'label': '字节', 'factor': 1}, {'name': 'KB', 'label': '千字节', 'factor': 1000},
        {'name': 'MB', 'label': '兆字节', 'factor': 1e6}, {'name': 'GB', 'label': '吉字节', 'factor': 1e9},
        {'name': 'TB', 'label': '太字节', 'factor': 1e12}, {'name': 'KiB', 'label': '千比字节', 'factor': 1024},
        {'name': 'MiB', 'label': '兆比字节', 'factor': 1048576}, {'name': 'GiB', 'label': '吉比字节', 'factor': 1073741824},
    ]},
    {'key': 'pressure', 'label': '压力', 'units': [
        {'name': 'pa', 'label': '帕斯卡', 'factor': 1}, {'name': 'kpa', 'label': '千帕', 'factor': 1000},
        {'name': 'bar', 'label': '巴', 'factor': 1e5}, {'name': 'atm', 'label': '标准大气压', 'factor': 101325},
        {'name': 'mmhg', 'label': '毫米汞柱', 'factor': 133.322387415}, {'name': 'psi', 'label': '磅/平方英寸', 'factor': 6894.757293168},
    ]},
    {'key': 'energy', 'label': '能量', 'units': [
        {'name': 'j', 'label': '焦耳', 'factor': 1}, {'name': 'kj', 'label': '千焦', 'factor': 1000},
        {'name': 'cal', 'label': '卡路里', 'factor': 4.184}, {'name': 'kcal', 'label': '千卡', 'factor': 4184},
        {'name': 'wh', 'label': '瓦时', 'factor': 3600}, {'name': 'kwh', 'label': '千瓦时', 'factor': 3.6e6},
    ]},
]

def list_categories():
    return UNITS

def get_common_conversions(cat_key):
    cat = next((c for c in UNITS if c['key'] == cat_key), None)
    if not cat: return []
    fu = cat['units'][0] if cat['units'] else None
    if not fu: return []
    out = []
    for tu in cat['units'][1:6]:
        try:
            out.append({'fromLabel': fu['label'], 'toLabel': tu['label'], 'value': convert(1, fu['name'], tu['name'], cat_key)})
        except ConvertError: continue
    return out

def convert(value, from_name, to_name, cat_key):
    cat = next((c for c in UNITS if c['key'] == cat_key), None)
    if not cat: raise ConvertError(f'未知类别: {cat_key}')
    fu = next((u for u in cat['units'] if u['name'] == from_name), None)
    tu = next((u for u in cat['units'] if u['name'] == to_name), None)
    if not fu: raise ConvertError(f'未知源单位: {from_name}')
    if not tu: raise ConvertError(f'未知目标单位: {to_name}')
    base = fu['toBase'](value) if 'toBase' in fu else value * fu['factor']
    return tu['fromBase'](base) if 'fromBase' in tu else base / tu['factor']

def format_convert_result(num):
    if not math.isfinite(num): return '—'
    if num == 0: return '0'
    ab = abs(num)
    if ab >= 1e6 or ab < 1e-4: return f'{num:.2e}'.replace('e+0', 'e').replace('e0', 'e')
    s = f'{num:.6g}'
    return s.rstrip('0').rstrip('.') if '.' in s else s


# ============ 持久化 ============
APP_DIR = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'calculator-manager-portable')
HISTORY_FILE = os.path.join(APP_DIR, 'history.json')
VARIABLES_FILE = os.path.join(APP_DIR, 'variables.json')
MAX_HISTORY = 200

def _ensure_dir():
    try: os.makedirs(APP_DIR, exist_ok=True)
    except Exception: pass

def _atomic_write(path, data):
    _ensure_dir()
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def load_history():
    try:
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception: return []

def save_history_item(item):
    hist = load_history()
    hist.append(item)
    if len(hist) > MAX_HISTORY: hist = hist[-MAX_HISTORY:]
    _atomic_write(HISTORY_FILE, hist)
    return hist

def load_variables():
    try:
        with open(VARIABLES_FILE, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception: return {}

def save_variable(name, value):
    v = load_variables()
    v[name] = value
    _atomic_write(VARIABLES_FILE, v)
    return v


# ============ GUI ============
C_BG, C_BG_SOFT, C_CARD = '#ffffff', '#ececef', '#fafafa'
# 苹果系统蓝 #007AFF（macOS/iOS 标准强调色）
C_ACCENT, C_ACCENT_SOFT = '#007AFF', '#e6f0fe'
# keypad 背景用 C_BG_SOFT 让白底按钮清晰浮起
C_KEYPAD = C_BG_SOFT
# 文字色：主文字略深、次文字略浅，强化层级
C_TEXT, C_TEXT_SUB, C_BORDER = '#1d1d1f', '#86868b', '#d8d8dc'
C_OP, C_FN = '#e4e4e7', '#ededee'
FONT_FAMILY = 'Microsoft YaHei UI'
APP_TITLE = '计算器管家·便携版'
HOTKEY_ID = 0xC001
WIN_W, WIN_H = 380, 520

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
MOD_ALT, MOD_CONTROL, WM_HOTKEY = 0x0001, 0x0002, 0x0312

class HotkeyThread(threading.Thread):
    def __init__(self, cb):
        super().__init__(daemon=True)
        self.callback, self._stop = cb, threading.Event()
    def run(self):
        if not user32.RegisterHotKey(None, HOTKEY_ID, MOD_CONTROL | MOD_ALT, ord('C')): return
        msg = wt.MSG()
        try:
            while not self._stop.is_set():
                if user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):
                    if msg.message == WM_HOTKEY and msg.wParam == HOTKEY_ID:
                        try: self.callback()
                        except Exception: pass
                else: self._stop.wait(0.05)
        finally: user32.UnregisterHotKey(None, HOTKEY_ID)
    def stop(self): self._stop.set()

def _make_tray_icon():
    img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 6, 58, 58], radius=14, fill=(0, 122, 255, 255))
    d.rounded_rectangle([16, 14, 48, 26], radius=3, fill=(255, 255, 255, 255))
    for r in range(3):
        for c in range(3):
            x, y = 19 + c * 10, 32 + r * 8
            d.ellipse([x, y, x + 5, y + 5], fill=(255, 255, 255, 255))
    return img

class TrayThread(threading.Thread):
    def __init__(self, on_show, on_quit):
        super().__init__(daemon=True)
        self.on_show, self.on_quit, self.icon = on_show, on_quit, None
    def run(self):
        import pystray
        menu = pystray.Menu(
            pystray.MenuItem('显示计算器', self._show, default=True),
            pystray.MenuItem('退出', self._quit))
        self.icon = pystray.Icon('calc-portable', _make_tray_icon(), APP_TITLE, menu)
        self.icon.run()
    def _show(self, *a):
        try: self.on_show()
        except Exception: pass
    def _quit(self, *a):
        try: self.on_quit()
        except Exception: pass
        if self.icon: self.icon.stop()


class CalcApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.mode = 'scientific'
        self.variables = load_variables()
        self.history = load_history()
        self.history_cursor = -1
        self.last_result = '0'
        self._preview_after = None
        self._convert_after = None
        self.history_visible = False
        self.convert_categories = list_categories()
        self.convert_category = 'length'
        self.screenshot_mode = '--screenshot' in sys.argv

        self.overrideredirect(True)
        self.attributes('-topmost', True)
        self.configure(fg_color=C_BG)
        self.title(APP_TITLE)
        self.geometry(f'{WIN_W}x{WIN_H}')

        self._build_ui()
        if self.screenshot_mode:
            self.geometry(f'{WIN_W}x{WIN_H}+40+40')
            self.update_idletasks(); self.update(); self.deiconify(); self.update()
            try:
                inner = self.winfo_id()
                root = user32.GetAncestor(inner, 2)
                with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'calc_hwnd.txt'), 'w') as f:
                    f.write(str(root or inner))
            except Exception: pass
        else:
            self._position_bottom_right()

        if not self.screenshot_mode:
            self.bind('<FocusOut>', self._on_focus_out)
        self.bind('<Button-1>', self._start_drag)
        self.bind('<B1-Motion>', self._on_drag)

        if not self.screenshot_mode:
            self.hotkey = HotkeyThread(self._toggle_visibility)
            self.hotkey.start()
            self.tray = TrayThread(self.show_window, self.quit_app)
            self.tray.start()
        else:
            self.hotkey = self.tray = None
            self.expr_var.set('sin(pi/4)^2 + cos(pi/4)^2')
            self._preview()
        self.after(80, self._focus_expr)

    def _font(self, size, weight='normal'):
        return ctk.CTkFont(family=FONT_FAMILY, size=size, weight=weight)

    def _build_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)
        self._build_titlebar()
        self._build_tabs()
        self.content = ctk.CTkFrame(self, fg_color=C_BG, corner_radius=0)
        self.content.grid(row=2, column=0, sticky='nsew')
        self.content.grid_columnconfigure(0, weight=1)
        self.content.grid_rowconfigure(0, weight=1)
        self._build_display(self.content)
        self._build_scientific(self.content)
        self._build_programmer(self.content)
        self._build_convert(self.content)
        self._build_history(self.content)
        self._switch_mode('scientific')

    def _build_titlebar(self):
        bar = ctk.CTkFrame(self, fg_color=C_BG, corner_radius=0, height=32)
        bar.grid(row=0, column=0, sticky='ew')
        bar.grid_propagate(False)
        bar.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(bar, text='计算器', font=self._font(12, 'bold'),
                     text_color=C_TEXT_SUB, anchor='w').grid(row=0, column=0, sticky='ew', padx=14)
        ctk.CTkButton(bar, text='×', width=22, height=22, corner_radius=11,
                      fg_color='transparent', hover_color=C_BG_SOFT, text_color=C_TEXT_SUB,
                      font=self._font(14, 'bold'), border_width=0,
                      command=self.hide_window).grid(row=0, column=1, padx=8)
        self._drag_data = {'x': 0, 'y': 0}

    def _build_tabs(self):
        # Tab 栏：高度增至 48，pady 8，增加垂直呼吸感
        bar = ctk.CTkFrame(self, fg_color=C_BG, corner_radius=0, height=48)
        bar.grid(row=1, column=0, sticky='ew')
        bar.grid_propagate(False)
        # 4 列：3 个 tab + 1 个历史按钮，tab 等分，历史按钮固定宽
        bar.grid_columnconfigure((0, 1, 2), weight=1, uniform='t')
        self.tab_buttons = {}
        for i, (key, label) in enumerate([('scientific', '科学'), ('programmer', '程序员'), ('convert', '转换')]):
            b = ctk.CTkButton(bar, text=label, font=self._font(13, 'bold'), height=32, corner_radius=16,
                              fg_color='transparent', hover_color=C_BG_SOFT, text_color=C_TEXT_SUB,
                              command=lambda k=key: self._switch_mode(k))
            b.grid(row=0, column=i, padx=(10 if i == 0 else 4, 4), pady=8, sticky='ew')
            self.tab_buttons[key] = b
        ctk.CTkButton(bar, text='🕐', width=36, height=32, corner_radius=16,
                      fg_color='transparent', hover_color=C_BG_SOFT, font=self._font(14),
                      command=self._toggle_history).grid(row=0, column=3, padx=(4, 10), pady=8)

    def _build_display(self, parent):
        disp = ctk.CTkFrame(parent, fg_color=C_CARD, corner_radius=14)
        disp.grid(row=0, column=0, sticky='ew', padx=12, pady=(12, 8))
        disp.grid_columnconfigure(0, weight=1)
        self.expr_var = tk.StringVar(value='')
        self.expr_entry = ctk.CTkEntry(disp, textvariable=self.expr_var, font=self._font(13),
                                       fg_color=C_BG_SOFT, border_color=C_BORDER, border_width=1,
                                       corner_radius=10, height=32, text_color=C_TEXT_SUB)
        self.expr_entry.grid(row=0, column=0, sticky='ew', padx=10, pady=(10, 4))
        self.expr_entry.bind('<KeyRelease>', self._on_expr_change)
        self.expr_entry.bind('<Return>', self._on_enter)
        self.expr_entry.bind('<Escape>', self._on_escape)
        self.expr_entry.bind('<Up>', self._on_history_up)
        self.expr_entry.bind('<Down>', self._on_history_down)
        self.result_var = tk.StringVar(value='0')
        # 表达式与结果之间的极细 hairline，强化信息层级
        ctk.CTkFrame(disp, fg_color=C_BG_SOFT, corner_radius=0, height=1).grid(
            row=1, column=0, sticky='ew', padx=14, pady=(4, 0))
        # 结果字号 30、深蓝 #0a5ec4（与主蓝同色系，略深保证可读）
        ctk.CTkLabel(disp, textvariable=self.result_var, font=self._font(30, 'bold'),
                     text_color='#0a5ec4', anchor='e', justify='right').grid(row=2, column=0, sticky='ew', padx=14, pady=(6, 6))
        self.hint_var = tk.StringVar(value='输入表达式，回车计算 · ↑↓浏览历史')
        ctk.CTkLabel(disp, textvariable=self.hint_var, font=self._font(10),
                     text_color=C_TEXT_SUB, anchor='w').grid(row=3, column=0, sticky='ew', padx=14, pady=(0, 8))
        row_btn = ctk.CTkFrame(disp, fg_color=C_CARD, corner_radius=0)
        row_btn.grid(row=4, column=0, sticky='ew', padx=10, pady=(0, 8))
        row_btn.grid_columnconfigure((0, 1, 2), weight=1)
        ctk.CTkButton(row_btn, text='⧉ 复制', font=self._font(11), height=22, corner_radius=6,
                      fg_color='transparent', hover_color=C_BG_SOFT, text_color=C_ACCENT, border_width=0,
                      command=self._copy_result).grid(row=0, column=0, sticky='ew', padx=2)
        ctk.CTkButton(row_btn, text='清空', font=self._font(11), height=22, corner_radius=6,
                      fg_color='transparent', hover_color=C_BG_SOFT, text_color=C_TEXT_SUB, border_width=0,
                      command=self._clear_expr).grid(row=0, column=1, sticky='ew', padx=2)
        ctk.CTkButton(row_btn, text='⌫ 退格', font=self._font(11), height=22, corner_radius=6,
                      fg_color='transparent', hover_color=C_BG_SOFT, text_color=C_TEXT_SUB, border_width=0,
                      command=self._backspace).grid(row=0, column=2, sticky='ew', padx=2)

    def _build_scientific(self, parent):
        self.sci_frame = ctk.CTkFrame(parent, fg_color=C_BG, corner_radius=0)
        keys = [
            [('sin(', 'fn'), ('cos(', 'fn'), ('tan(', 'fn'), ('π', 'fn'), ('e', 'fn')],
            [('log(', 'fn'), ('ln(', 'fn'), ('√', 'fn'), ('x²', 'fn'), ('^', 'fn')],
            [('AC', 'danger'), ('(', ''), (')', ''), ('%', 'op'), ('÷', 'op')],
            [('7', ''), ('8', ''), ('9', ''), ('×', 'op'), ('n!', 'fn')],
            [('4', ''), ('5', ''), ('6', ''), ('−', 'op'), ('1/x', 'fn')],
            [('1', ''), ('2', ''), ('3', ''), ('+', 'op'), ('abs(', 'fn')],
            [('0', 'wide'), ('.', ''), ('=', 'accent')],
        ]
        self._build_keypad(self.sci_frame, keys, parent, 1)

    def _build_keypad(self, frame, keys, parent, row):
        frame.grid(row=row, column=0, sticky='nsew')
        frame.grid_columnconfigure(0, weight=1)
        frame.grid_rowconfigure(0, weight=1)
        inner = ctk.CTkFrame(frame, fg_color=C_KEYPAD, corner_radius=12)
        inner.grid(row=0, column=0, sticky='nsew', padx=10, pady=(6, 12))
        for col in range(5): inner.grid_columnconfigure(col, weight=1, uniform='k')
        self._fill_keys(inner, keys)

    def _fill_keys(self, inner, keys):
        for r, rks in enumerate(keys):
            inner.grid_rowconfigure(r, weight=1)
            col = 0
            for label, kind in rks:
                wide = 1
                if kind == 'wide': kind, wide = '', 2
                if kind == 'accent_wide': kind, wide = 'accent', 5
                self._make_key(inner, label, kind).grid(row=r, column=col, columnspan=wide, sticky='nsew', padx=3, pady=4)
                col += wide

    def _make_key(self, parent, label, kind):
        # 按钮配色矩阵：(fg, text, hover, border)
        # 设计原则：白底按钮浮在 keypad 灰背景上，靠 1px 描边与微投影层次区分
        cm = {'fn': ('#ffffff', C_TEXT_SUB, '#f5f5f7', '#d8d8dc'),
              'op': ('#f0f0f3', C_TEXT, '#e6e6ea', '#cfcfd4'),
              'danger': ('#ffffff', '#b00020', '#f5f5f7', '#e4cfd2'),
              'accent': (C_ACCENT, '#ffffff', '#0066d6', C_ACCENT),
              '': ('#ffffff', C_TEXT, '#f5f5f7', '#d8d8dc')}
        fg, txt, hov, border = cm.get(kind, cm[''])
        if kind == 'accent':
            f = self._font(14, 'bold'); bw = 0
        elif kind == 'fn':
            f = self._font(12, 'normal'); bw = 1
        elif kind == 'op':
            f = self._font(13, 'normal'); bw = 1
        else:
            f = self._font(14, 'bold'); bw = 1
        return ctk.CTkButton(parent, text=label, font=f,
                             corner_radius=12, fg_color=fg, hover_color=hov, text_color=txt,
                             height=34, border_width=bw, border_color=border,
                             command=lambda l=label: self._on_key(l))

    def _build_programmer(self, parent):
        self.prog_frame = ctk.CTkFrame(parent, fg_color=C_BG, corner_radius=0)
        base = ctk.CTkFrame(self.prog_frame, fg_color=C_CARD, corner_radius=12)
        base.pack(fill='x', padx=12, pady=(8, 4))
        self.base_vars = {}
        for i, (lbl, key) in enumerate([('HEX', 'hex'), ('DEC', 'dec'), ('OCT', 'oct'), ('BIN', 'bin')]):
            v = tk.StringVar(value='0')
            self.base_vars[key] = v
            ctk.CTkLabel(base, text=lbl, font=self._font(10, 'bold'), text_color=C_TEXT_SUB,
                         width=34).grid(row=i, column=0, padx=(10, 4), pady=3, sticky='w')
            ctk.CTkLabel(base, textvariable=v, font=self._font(12), text_color=C_TEXT,
                         anchor='w').grid(row=i, column=1, sticky='ew', padx=4, pady=3)
        base.grid_columnconfigure(1, weight=1)
        inner = ctk.CTkFrame(self.prog_frame, fg_color=C_KEYPAD, corner_radius=12)
        inner.pack(fill='both', expand=True, padx=10, pady=(4, 10))
        for col in range(5): inner.grid_columnconfigure(col, weight=1, uniform='k')
        keys = [
            [('AND', 'fn'), ('OR', 'fn'), ('XOR', 'fn'), ('NOT', 'fn'), ('MOD', 'fn')],
            [('<<', 'fn'), ('>>', 'fn'), ('AC', 'danger'), ('(', ''), (')', '')],
            [('A', 'op'), ('B', 'op'), ('C', 'op'), ('D', 'op'), ('÷', 'op')],
            [('E', 'op'), ('F', 'op'), ('9', ''), ('8', ''), ('×', 'op')],
            [('7', ''), ('6', ''), ('5', ''), ('4', ''), ('−', 'op')],
            [('3', ''), ('2', ''), ('1', ''), ('0', ''), ('+', 'op')],
            [('=', 'accent_wide')],
        ]
        self._fill_keys(inner, keys)

    def _build_convert(self, parent):
        self.conv_frame = ctk.CTkFrame(parent, fg_color=C_BG, corner_radius=0)
        self.conv_frame.grid(row=1, column=0, sticky='nsew')
        self.conv_frame.grid_columnconfigure(0, weight=1)
        self.conv_frame.grid_rowconfigure(4, weight=1)
        cat_row = ctk.CTkFrame(self.conv_frame, fg_color=C_BG, corner_radius=0)
        cat_row.grid(row=0, column=0, sticky='ew', padx=12, pady=(10, 4))
        cat_row.grid_columnconfigure(0, weight=1)
        cat_labels = [c['label'] for c in self.convert_categories]
        self.cat_menu = ctk.CTkOptionMenu(cat_row, values=cat_labels, font=self._font(12),
                                          fg_color=C_BG_SOFT, button_color=C_ACCENT,
                                          button_hover_color='#0066d6', text_color=C_TEXT,
                                          corner_radius=10, height=30, command=self._on_cat_change)
        self.cat_menu.set(cat_labels[0])
        self.cat_menu.grid(row=0, column=0, sticky='ew')
        self.conv_val = tk.StringVar(value='1')
        ve = ctk.CTkEntry(self.conv_frame, textvariable=self.conv_val, font=self._font(15),
                          fg_color=C_BG_SOFT, border_color=C_BORDER, border_width=1,
                          corner_radius=10, height=36, text_color=C_TEXT)
        ve.grid(row=1, column=0, sticky='ew', padx=12, pady=4)
        ve.bind('<KeyRelease>', self._schedule_convert)
        ft = ctk.CTkFrame(self.conv_frame, fg_color=C_BG, corner_radius=0)
        ft.grid(row=2, column=0, sticky='ew', padx=12, pady=4)
        ft.grid_columnconfigure((0, 2), weight=1)
        self.from_menu = ctk.CTkOptionMenu(ft, font=self._font(11), fg_color=C_BG_SOFT,
                                           button_color=C_ACCENT, button_hover_color='#0066d6',
                                           text_color=C_TEXT, corner_radius=10, height=30,
                                           command=self._schedule_convert)
        self.from_menu.grid(row=0, column=0, sticky='ew', padx=(0, 4))
        ctk.CTkButton(ft, text='⇄', width=34, height=30, corner_radius=15, fg_color=C_ACCENT,
                      hover_color='#0066d6', text_color='#ffffff', font=self._font(14, 'bold'),
                      command=self._swap_units).grid(row=0, column=1, padx=4)
        self.to_menu = ctk.CTkOptionMenu(ft, font=self._font(11), fg_color=C_BG_SOFT,
                                         button_color=C_ACCENT, button_hover_color='#0066d6',
                                         text_color=C_TEXT, corner_radius=10, height=30,
                                         command=self._schedule_convert)
        self.to_menu.grid(row=0, column=2, sticky='ew', padx=(4, 0))
        rc = ctk.CTkFrame(self.conv_frame, fg_color=C_CARD, corner_radius=12)
        rc.grid(row=3, column=0, sticky='ew', padx=12, pady=4)
        rc.grid_columnconfigure(0, weight=1)
        self.conv_res = tk.StringVar(value='—')
        ctk.CTkLabel(rc, textvariable=self.conv_res, font=self._font(22, 'bold'),
                     text_color=C_ACCENT, anchor='e').grid(row=0, column=0, sticky='ew', padx=14, pady=(8, 0))
        self.conv_formula = tk.StringVar(value='')
        ctk.CTkLabel(rc, textvariable=self.conv_formula, font=self._font(11),
                     text_color=C_TEXT_SUB, anchor='w').grid(row=1, column=0, sticky='ew', padx=14, pady=(0, 8))
        rw = ctk.CTkScrollableFrame(self.conv_frame, fg_color=C_BG, corner_radius=0,
                                    scrollbar_button_color=C_BORDER)
        rw.grid(row=4, column=0, sticky='nsew', padx=12, pady=(2, 8))
        self.ref_wrap = rw
        self._populate_units()

    def _populate_units(self):
        cat = next((c for c in self.convert_categories if c['key'] == self.convert_category), None)
        if not cat: return
        ul = [f"{u['label']} ({u['name']})" for u in cat['units']]
        self.from_menu.configure(values=ul)
        self.to_menu.configure(values=ul)
        if len(cat['units']) >= 2:
            self.from_menu.set(ul[0]); self.to_menu.set(ul[1])
        for w in self.ref_wrap.winfo_children(): w.destroy()
        common = get_common_conversions(self.convert_category)
        for i, it in enumerate(common):
            r, c = divmod(i, 2)
            card = ctk.CTkFrame(self.ref_wrap, fg_color=C_BG_SOFT, corner_radius=8, height=44)
            card.grid(row=r, column=c, sticky='ew', padx=3, pady=3)
            card.grid_columnconfigure(0, weight=1)
            vs = self._fmt_ref(it['value'])
            ctk.CTkLabel(card, text=f"1 {it['fromLabel']}", font=self._font(9),
                         text_color=C_TEXT_SUB, anchor='w').grid(row=0, column=0, sticky='w', padx=8, pady=(4, 0))
            ctk.CTkLabel(card, text=f"{vs} {it['toLabel']}", font=self._font(11, 'bold'),
                         text_color=C_TEXT, anchor='w').grid(row=1, column=0, sticky='w', padx=8, pady=(0, 4))
        self.ref_wrap.grid_columnconfigure((0, 1), weight=1)

    def _build_history(self, parent):
        self.hist_frame = ctk.CTkScrollableFrame(parent, fg_color=C_BG, corner_radius=0,
                                                 scrollbar_button_color=C_BORDER)
        self._render_history()

    def _render_history(self):
        for w in self.hist_frame.winfo_children(): w.destroy()
        if not self.history:
            ctk.CTkLabel(self.hist_frame, text='暂无历史记录', font=self._font(12),
                         text_color=C_TEXT_SUB).pack(pady=40)
            return
        for item in reversed(self.history):
            card = ctk.CTkFrame(self.hist_frame, fg_color=C_CARD, corner_radius=10, border_width=1,
                                border_color=C_BORDER)
            card.pack(fill='x', padx=8, pady=4)
            mt = {'scientific': '科学', 'programmer': '程序员', 'convert': '转换'}.get(item.get('mode'), '')
            tag = f"  · {mt}" if mt else ''
            ctk.CTkLabel(card, text=item.get('expr', ''), font=self._font(11),
                         text_color=C_TEXT_SUB, anchor='w').pack(fill='x', padx=10, pady=(6, 0))
            ctk.CTkLabel(card, text=f"= {item.get('result', '')}", font=self._font(14, 'bold'),
                         text_color=C_ACCENT, anchor='w').pack(fill='x', padx=10, pady=(0, 6))
            def _load(e=item):
                self.expr_var.set(e.get('expr', ''))
                self._on_expr_change()
                self._toggle_history()
                self._focus_expr()
            card.bind('<Button-1>', lambda e, fn=_load: fn())
            for ch in card.winfo_children(): ch.bind('<Button-1>', lambda ev, fn=_load: fn())

    def _switch_mode(self, mode):
        self.mode = mode
        for k, b in self.tab_buttons.items():
            if k == mode:
                # 选中态：实色蓝底胶囊 + 白色加粗文字，明显区分
                b.configure(fg_color=C_ACCENT, text_color='#ffffff', hover_color='#0066d6')
            else:
                b.configure(fg_color='transparent', text_color=C_TEXT, hover_color=C_BG_SOFT)
        self.sci_frame.grid_remove()
        self.prog_frame.grid_remove()
        self.conv_frame.grid_remove()
        self.hist_frame.grid_remove()
        self.history_visible = False
        if mode == 'scientific': self.sci_frame.grid(row=1, column=0, sticky='nsew')
        elif mode == 'programmer': self.prog_frame.grid(row=1, column=0, sticky='nsew')
        elif mode == 'convert':
            self.conv_frame.grid(row=1, column=0, sticky='nsew')
            self._schedule_convert()
        self._focus_expr()

    def _toggle_history(self):
        self.history_visible = not self.history_visible
        if self.history_visible:
            self.history = load_history()
            self._render_history()
            self.sci_frame.grid_remove()
            self.prog_frame.grid_remove()
            self.conv_frame.grid_remove()
            self.hist_frame.grid(row=1, column=0, sticky='nsew')
        else:
            self.hist_frame.grid_remove()
            self._switch_mode(self.mode)

    def _on_key(self, label):
        m = {'÷': '/', '×': '*', '−': '-', 'π': 'pi', '√': 'sqrt(', 'x²': '^2',
             'n!': '!', '1/x': '1/(', 'MOD': ' mod ', 'AND': ' and ', 'OR': ' or ',
             'XOR': ' xor ', 'NOT': 'not ', '<<': ' shl ', '>>': ' shr ',
             'A': '0xA', 'B': '0xB', 'C': '0xC', 'D': '0xD', 'E': '0xE', 'F': '0xF'}
        if label == 'AC': return self._clear_expr()
        if label == '=': return self._do_evaluate()
        self._insert_text(m.get(label, label))

    def _insert_text(self, text):
        self.expr_var.set(self.expr_var.get() + text)
        self._on_expr_change()
        self._focus_expr_end()

    def _on_expr_change(self, event=None):
        if self._preview_after: self.after_cancel(self._preview_after)
        self._preview_after = self.after(120, self._preview)

    def _preview(self):
        expr = self.expr_var.get().strip()
        if not expr:
            self.result_var.set('0')
            self.hint_var.set('输入表达式，回车计算 · ↑↓浏览历史')
            return
        if self._is_assign(expr):
            self.result_var.set('赋值')
            self.hint_var.set('回车确认赋值变量')
            return
        try:
            r = evaluate(expr, self.variables)
            self.result_var.set(format_result(r))
            self.last_result = format_result(r)
            self.hint_var.set('')
            if self.mode == 'programmer': self._update_base(r)
        except CalcError:
            if self.mode == 'programmer': self._clear_base()

    def _is_assign(self, expr):
        return bool(re.match(r'^[a-zA-Z_]\w*\s*=[^=]', expr))

    def _on_enter(self, event=None):
        self._do_evaluate()
        return 'break'

    def _on_escape(self, event=None):
        self._clear_expr()
        return 'break'

    def _do_evaluate(self):
        expr = self.expr_var.get().strip()
        if not expr: return
        if self._is_assign(expr):
            try:
                res = try_parse_assignment(expr, self.variables)
                if res:
                    name, value = res
                    self.variables = save_variable(name, value)
                    self.result_var.set(format_result(value))
                    self.last_result = format_result(value)
                    self.hint_var.set(f'已设置 {name} = {format_result(value)}')
                    save_history_item({'expr': expr, 'result': format_result(value), 'mode': self.mode})
                    self.history = load_history()
                    self.history_cursor = -1
            except CalcError as e: self.hint_var.set(str(e))
            return
        try:
            r = evaluate(expr, self.variables)
            fmt = format_result(r)
            self.result_var.set(fmt)
            self.last_result = fmt
            self.hint_var.set('已复制结果到剪贴板')
            self._copy_text(fmt)
            save_history_item({'expr': expr, 'result': fmt, 'mode': self.mode})
            self.history = load_history()
            self.history_cursor = -1
            if self.mode == 'programmer': self._update_base(r)
        except CalcError as e:
            self.hint_var.set(f'错误: {e}')

    def _update_base(self, num):
        try:
            for k, b in [('hex', 16), ('dec', 10), ('oct', 8), ('bin', 2)]:
                self.base_vars[k].set(to_base(num, b))
        except Exception: self._clear_base()

    def _clear_base(self):
        for k in self.base_vars: self.base_vars[k].set('0')

    def _clear_expr(self):
        self.expr_var.set('')
        self.result_var.set('0')
        self.hint_var.set('输入表达式，回车计算 · ↑↓浏览历史')
        self._clear_base()
        self._focus_expr()

    def _backspace(self):
        self.expr_var.set(self.expr_var.get()[:-1])
        self._on_expr_change()

    def _on_history_up(self, event=None):
        if not self.history: return
        if self.history_cursor == -1: self.history_cursor = len(self.history)
        self.history_cursor = max(0, self.history_cursor - 1)
        item = self.history[self.history_cursor]
        if item:
            self.expr_var.set(item.get('expr', ''))
            self._preview()
            self._focus_expr_end()
        return 'break'

    def _on_history_down(self, event=None):
        if not self.history: return
        if self.history_cursor == -1: return
        self.history_cursor += 1
        if self.history_cursor >= len(self.history): self.history_cursor = len(self.history) - 1
        item = self.history[self.history_cursor]
        if item:
            self.expr_var.set(item.get('expr', ''))
            self._preview()
            self._focus_expr_end()
        return 'break'

    def _on_cat_change(self, label):
        cat = next((c for c in self.convert_categories if c['label'] == label), None)
        if cat:
            self.convert_category = cat['key']
            self._populate_units()
            self._schedule_convert()

    def _swap_units(self):
        a = self.from_menu.get()
        self.from_menu.set(self.to_menu.get())
        self.to_menu.set(a)
        self._schedule_convert()

    def _schedule_convert(self, event=None):
        if self._convert_after: self.after_cancel(self._convert_after)
        self._convert_after = self.after(80, self._do_convert)

    def _do_convert(self):
        try: val = float(self.conv_val.get())
        except ValueError:
            self.conv_res.set('—'); self.conv_formula.set(''); return
        cat = next((c for c in self.convert_categories if c['label'] == self.cat_menu.get()), None)
        if not cat: return
        fn = self._un(self.from_menu.get(), cat)
        tn = self._un(self.to_menu.get(), cat)
        if not fn or not tn: return
        try:
            r = convert(val, fn, tn, cat['key'])
            self.conv_res.set(format_convert_result(r))
            fl = next((u['label'] for u in cat['units'] if u['name'] == fn), fn)
            tl = next((u['label'] for u in cat['units'] if u['name'] == tn), tn)
            self.conv_formula.set(f'{self._fmt_in(val)} {fl} = {format_convert_result(r)} {tl}')
        except ConvertError as e:
            self.conv_res.set('—'); self.conv_formula.set(str(e))

    @staticmethod
    def _un(label, cat):
        for u in cat['units']:
            if f"{u['label']} ({u['name']})" == label: return u['name']
        return None

    @staticmethod
    def _fmt_in(num):
        return str(int(num)) if num.is_integer() else f'{num:.6g}'

    @staticmethod
    def _fmt_ref(num):
        if not math.isfinite(num): return '—'
        if num == 0: return '0'
        ab = abs(num)
        if ab >= 1e6 or ab < 1e-4: return f'{num:.2e}'.replace('e+0', 'e').replace('e0', 'e')
        s = f'{num:.6g}'
        return s.rstrip('0').rstrip('.') if '.' in s else s

    def _copy_result(self):
        self._copy_text(self.last_result)
        self.hint_var.set('已复制结果')

    def _copy_text(self, text):
        self.clipboard_clear()
        self.clipboard_append(str(text))

    def _focus_expr(self):
        try: self.expr_entry.focus_set()
        except Exception: pass

    def _focus_expr_end(self):
        try:
            self.expr_entry.focus_set()
            self.expr_entry.icursor('end')
        except Exception: pass

    def _position_bottom_right(self):
        self.update_idletasks()
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f'{WIN_W}x{WIN_H}+{sw - WIN_W - 24}+{sh - WIN_H - 60}')

    def _start_drag(self, event):
        self._drag_data = {'x': event.x, 'y': event.y}

    def _on_drag(self, event):
        x = self.winfo_x() + (event.x - self._drag_data['x'])
        y = self.winfo_y() + (event.y - self._drag_data['y'])
        self.geometry(f'+{x}+{y}')

    def _on_focus_out(self, event):
        self.after(180, self._check_hide)

    def _check_hide(self):
        try:
            if self.focus_get() is None: self.hide_window()
        except Exception: pass

    def hide_window(self): self.withdraw()

    def show_window(self):
        self.deiconify()
        self.attributes('-topmost', True)
        self._position_bottom_right()
        self._focus_expr()
        self._clear_expr()
        if self.mode == 'convert': self._switch_mode('scientific')

    def _toggle_visibility(self):
        try:
            if self.winfo_viewable(): self.hide_window()
            else: self.show_window()
        except Exception: self.show_window()

    def quit_app(self):
        try:
            if self.hotkey: self.hotkey.stop()
        except Exception: pass
        self.destroy()


def main():
    ctk.set_appearance_mode('light')
    ctk.set_default_color_theme('blue')
    CalcApp().mainloop()


if __name__ == '__main__':
    main()
