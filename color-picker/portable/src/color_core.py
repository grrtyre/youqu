# -*- coding: utf-8 -*-
"""拾色管家·便携版 - 核心逻辑模块

包含：
- 颜色格式转换（HEX / RGB / HSL 互逆）
- WCAG 2.1 对比度计算与等级评估
- 最佳前景色选择
- 调色板与历史记录的本地存储（JSON）

纯逻辑，无 Qt / GUI 依赖，可独立测试。
苹果白风格调色板默认色：#007AFF
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Optional


# ================================================================
#  通用工具
# ================================================================

def clamp(value: float, min_v: float, max_v: float) -> float:
    """限制数值到 [min_v, max_v]。"""
    return min(max_v, max(min_v, value))


# ================================================================
#  颜色格式转换
# ================================================================

def hex_to_rgb(hex_str: str) -> Optional[dict]:
    """#RRGGBB / #RGB / RRGGBB → {r, g, b}，解析失败返回 None。"""
    if not isinstance(hex_str, str):
        return None
    h = hex_str.strip()
    if h.startswith('#'):
        h = h[1:]
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    if len(h) != 6:
        return None
    try:
        return {
            'r': int(h[0:2], 16),
            'g': int(h[2:4], 16),
            'b': int(h[4:6], 16),
        }
    except ValueError:
        return None


def rgb_to_hex(r: float, g: float, b: float) -> str:
    """{r, g, b} → #rrggbb（小写）。"""
    def to2(n: float) -> str:
        return f'{int(clamp(round(n), 0, 255)):02x}'
    return f'#{to2(r)}{to2(g)}{to2(b)}'


def rgb_to_hsl(r: float, g: float, b: float) -> dict:
    """{r, g, b} → {h, s, l}，h ∈ [0,360)，s/l ∈ [0,100]。"""
    r /= 255.0
    g /= 255.0
    b /= 255.0
    mx = max(r, g, b)
    mn = min(r, g, b)
    d = mx - mn
    h = 0.0
    if d != 0:
        if mx == r:
            h = ((g - b) / d) % 6
        elif mx == g:
            h = (b - r) / d + 2
        else:
            h = (r - g) / d + 4
        h *= 60
        if h < 0:
            h += 360
    l = (mx + mn) / 2
    s = 0 if d == 0 else d / (1 - abs(2 * l - 1))
    return {
        'h': round(h),
        's': round(s * 100),
        'l': round(l * 100),
    }


def hsl_to_rgb(h: float, s: float, l: float) -> dict:
    """{h, s, l} → {r, g, b}。"""
    h = ((h % 360) + 360) % 360
    s = clamp(s, 0, 100) / 100.0
    l = clamp(l, 0, 100) / 100.0
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs(((h / 60) % 2) - 1))
    m = l - c / 2
    if h < 60:
        r1, g1, b1 = c, x, 0
    elif h < 120:
        r1, g1, b1 = x, c, 0
    elif h < 180:
        r1, g1, b1 = 0, c, x
    elif h < 240:
        r1, g1, b1 = 0, x, c
    elif h < 300:
        r1, g1, b1 = x, 0, c
    else:
        r1, g1, b1 = c, 0, x
    return {
        'r': round((r1 + m) * 255),
        'g': round((g1 + m) * 255),
        'b': round((b1 + m) * 255),
    }


def color_distance(a: dict, b: dict) -> float:
    """两个 RGB 颜色的欧氏距离，0 表示完全相同。"""
    dr = a['r'] - b['r']
    dg = a['g'] - b['g']
    db = a['b'] - b['b']
    return (dr * dr + dg * dg + db * db) ** 0.5


def best_foreground(r: float, g: float, b: float) -> str:
    """返回在指定背景色上的最佳前景色（深灰或白）。"""
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return '#1d1d1f' if luminance > 0.55 else '#ffffff'


def format_color(rgb: dict) -> dict:
    """生成颜色的所有格式字符串。"""
    r, g, b = rgb['r'], rgb['g'], rgb['b']
    hsl = rgb_to_hsl(r, g, b)
    return {
        'hex': rgb_to_hex(r, g, b),
        'hexUpper': rgb_to_hex(r, g, b).upper(),
        'rgb': f'rgb({r}, {g}, {b})',
        'hsl': f'hsl({hsl["h"]}, {hsl["s"]}%, {hsl["l"]}%)',
        'rgbObj': {'r': r, 'g': g, 'b': b},
        'hslObj': hsl,
    }


# ================================================================
#  WCAG 2.1 对比度
# ================================================================

def _to_linear(c: float) -> float:
    s = clamp(c, 0, 255) / 255.0
    return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4


def relative_luminance(r: float, g: float, b: float) -> float:
    """WCAG 相对亮度，0-1。"""
    return 0.2126 * _to_linear(r) + 0.7152 * _to_linear(g) + 0.0722 * _to_linear(b)


def contrast_ratio(rgb1: dict, rgb2: dict) -> float:
    """两个颜色之间的对比度比值，范围 1 ~ 21。"""
    l1 = relative_luminance(rgb1['r'], rgb1['g'], rgb1['b'])
    l2 = relative_luminance(rgb2['r'], rgb2['g'], rgb2['b'])
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def wcag_grade(ratio: float) -> dict:
    """给定对比度比值，返回 WCAG 2.1 等级评估。"""
    r = max(0.0, float(ratio or 0))
    return {
        'ratio': round(r * 100) / 100,
        'aaNormal': r >= 4.5,
        'aaLarge': r >= 3,
        'aaaNormal': r >= 7,
        'aaaLarge': r >= 4.5,
    }


# ================================================================
#  快捷键校验
# ================================================================

VALID_MODIFIERS = {
    'Ctrl', 'Control', 'Shift', 'Alt', 'Win', 'Super', 'Meta',
}
VALID_KEYS = set(
    [str(i) for i in range(10)]
    + [chr(c) for c in range(ord('A'), ord('Z') + 1)]
    + [f'F{i}' for i in range(1, 25)]
    + ['Space', 'Tab', 'Enter', 'Return', 'Escape', 'Esc', 'Backspace',
       'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown',
       'Up', 'Down', 'Left', 'Right',
       ',', '.', '/', ';', "'", '[', ']', '-', '=', '`']
)


def validate_shortcut(s: str) -> bool:
    """校验快捷键字符串：至少 1 个修饰键 + 1 个按键。"""
    if not isinstance(s, str):
        return False
    parts = [p.strip() for p in s.split('+') if p.strip()]
    if len(parts) < 2:
        return False
    key = parts[-1]
    modifiers = parts[:-1]
    # 单字母键统一大写比较
    if len(key) == 1 and key.isalpha():
        key = key.upper()
    if key not in VALID_KEYS:
        return False
    return all(m in VALID_MODIFIERS for m in modifiers)


# ================================================================
#  存储模块
# ================================================================

MAX_HISTORY = 50

DEFAULT_PALETTES = [
    {
        'id': 'default',
        'name': '苹果系统色',
        'colors': ['#007AFF', '#34C759', '#FF3B30', '#FF9500', '#AF52DE',
                   '#5AC8FA', '#FFD60A', '#8E8E93', '#30B0C7', '#FF2D55'],
        'createdAt': 0,
    }
]


def default_data() -> dict:
    """默认数据结构。每次返回全新深拷贝（colors 列表不共享引用）。"""
    return {
        'history': [],
        'palettes': [
            {**p, 'colors': list(p['colors'])}
            for p in DEFAULT_PALETTES
        ],
        'settings': {
            'copyFormat': 'hex',
            'shortcut': 'Ctrl+Shift+C',
            'magnifierZoom': 13,
        },
    }


def load_store(file_path: str) -> dict:
    """从文件加载数据，容错合并默认值。"""
    base = default_data()
    if not os.path.exists(file_path):
        return base
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            parsed = json.load(f)
    except (json.JSONDecodeError, OSError):
        return base
    return {
        'history': parsed.get('history', base['history']) if isinstance(parsed.get('history'), list) else base['history'],
        'palettes': parsed.get('palettes', base['palettes']) if isinstance(parsed.get('palettes'), list) and len(parsed.get('palettes', [])) > 0 else base['palettes'],
        'settings': {**base['settings'], **(parsed.get('settings') or {})},
    }


def save_store(file_path: str, data: dict) -> bool:
    """保存数据到文件（原子写入：先写临时文件再 rename）。"""
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
    except OSError:
        pass
    tmp = file_path + '.tmp'
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, file_path)
        return True
    except OSError:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except OSError:
            pass
        return False


def push_history(data: dict, hex_str: str, rgb: dict) -> dict:
    """添加到历史（去重，最新在前，最多 MAX_HISTORY 条）。"""
    entry = {
        'hex': hex_str,
        'r': rgb['r'],
        'g': rgb['g'],
        'b': rgb['b'],
        'ts': int(time.time() * 1000),
    }
    lower = hex_str.lower()
    data['history'] = [c for c in data['history'] if c.get('hex', '').lower() != lower]
    data['history'].insert(0, entry)
    if len(data['history']) > MAX_HISTORY:
        data['history'] = data['history'][:MAX_HISTORY]
    return data


def create_palette(data: dict, name: str) -> dict:
    """新建调色板，返回新建的调色板对象。"""
    palette = {
        'id': f'p_{int(time.time() * 1000)}',
        'name': name or '未命名调色板',
        'colors': [],
        'createdAt': int(time.time() * 1000),
    }
    data['palettes'].append(palette)
    return palette


def delete_palette(data: dict, palette_id: str) -> bool:
    """删除调色板（至少保留一个）。"""
    if len(data['palettes']) <= 1:
        return False
    before = len(data['palettes'])
    data['palettes'] = [p for p in data['palettes'] if p['id'] != palette_id]
    return len(data['palettes']) < before


def add_color_to_palette(data: dict, palette_id: str, hex_str: str) -> bool:
    """向指定调色板添加颜色（去重）。"""
    for p in data['palettes']:
        if p['id'] == palette_id:
            lower = hex_str.lower()
            if any(c.lower() == lower for c in p['colors']):
                return False
            p['colors'].append(hex_str)
            return True
    return False


def remove_color_from_palette(data: dict, palette_id: str, hex_str: str) -> bool:
    """从指定调色板移除颜色。"""
    for p in data['palettes']:
        if p['id'] == palette_id:
            lower = hex_str.lower()
            before = len(p['colors'])
            p['colors'] = [c for c in p['colors'] if c.lower() != lower]
            return len(p['colors']) < before
    return False


def rename_palette(data: dict, palette_id: str, new_name: str) -> bool:
    """重命名调色板。"""
    new_name = (new_name or '').strip()
    if not new_name:
        return False
    for p in data['palettes']:
        if p['id'] == palette_id:
            p['name'] = new_name
            return True
    return False


def clear_history(data: dict) -> int:
    """清空历史，返回被清除的条数。"""
    before = len(data['history'])
    data['history'] = []
    return before
