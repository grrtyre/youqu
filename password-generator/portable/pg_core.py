# -*- coding: utf-8 -*-
"""pg_core.py - 密码生成器便携版核心逻辑

使用 Python 标准库 secrets（基于操作系统 CSPRNG）实现密码学安全随机数，
逻辑对齐 Electron 原版 main.js，保证行为一致性与安全性。
"""

from __future__ import annotations

import math
import re
import secrets
from typing import List

# ============ 字符集 ============
CHARSETS = {
    "lower": "abcdefghijklmnopqrstuvwxyz",
    "upper": "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "digits": "0123456789",
    "symbols": "!@#$%^&*()-_=+[]{};:,.<>?/~",
    "ambiguous": "il1Lo0O",
}

# 记忆口令词库（80 词，对齐原版）
WORD_LIST = [
    "apple", "river", "stone", "cloud", "light", "moon", "star", "tree",
    "wind", "rain", "snow", "fire", "mountain", "ocean", "forest", "desert",
    "tiger", "eagle", "whale", "wolf", "fox", "bear", "lion", "deer",
    "happy", "brave", "calm", "wise", "quick", "soft", "warm", "cool",
    "silver", "golden", "crystal", "amber", "ivory", "jade", "pearl", "coral",
    "dance", "sing", "fly", "run", "jump", "swim", "climb", "dream",
    "spring", "summer", "autumn", "winter", "morning", "evening", "night", "dawn",
    "garden", "castle", "bridge", "tower", "harbor", "meadow", "valley", "peak",
    "silent", "gentle", "bright", "clever", "noble", "honest", "kind", "loyal",
    "violet", "rose", "lily", "lotus", "jasmine", "daisy", "iris", "orchid",
    "thunder", "frost", "mist", "shadow", "glow", "spark", "flame", "wave",
]

# 预设配置（对齐原版 v1.1.0 五种场景）
PRESETS = {
    "PIN": {"length": 6, "lower": False, "upper": False, "digits": True, "symbols": False, "exclude_ambiguous": True},
    "WiFi": {"length": 16, "lower": True, "upper": True, "digits": True, "symbols": False, "exclude_ambiguous": True},
    "标准": {"length": 16, "lower": True, "upper": True, "digits": True, "symbols": True, "exclude_ambiguous": False},
    "高强": {"length": 24, "lower": True, "upper": True, "digits": True, "symbols": True, "exclude_ambiguous": True},
    "极高": {"length": 32, "lower": True, "upper": True, "digits": True, "symbols": True, "exclude_ambiguous": True},
}


def clamp_int(value, default: int, min_v: int, max_v: int) -> int:
    """钳制整数到 [min_v, max_v]，非法值回退默认值。"""
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = default
    if n < min_v:
        n = min_v
    if n > max_v:
        n = max_v
    return n


def secure_shuffle(arr: list) -> list:
    """Fisher-Yates 洗牌，使用 secrets 保证无偏。"""
    a = list(arr)
    for i in range(len(a) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        a[i], a[j] = a[j], a[i]
    return a


def _filter_ambiguous(s: str) -> str:
    return "".join(c for c in s if c not in CHARSETS["ambiguous"])


def generate_password(opts: dict | None = None) -> str:
    """生成随机密码。opts: length/lower/upper/digits/symbols/exclude_ambiguous。"""
    opts = opts or {}
    length = clamp_int(opts.get("length"), 16, 4, 64)
    lower = opts.get("lower", True)
    upper = opts.get("upper", True)
    digits = opts.get("digits", True)
    symbols = opts.get("symbols", True)
    exclude_ambiguous = opts.get("exclude_ambiguous", False)

    pool = ""
    required: List[str] = []
    if lower:
        s = _filter_ambiguous(CHARSETS["lower"]) if exclude_ambiguous else CHARSETS["lower"]
        pool += s
        required.append(s[secrets.randbelow(len(s))])
    if upper:
        s = _filter_ambiguous(CHARSETS["upper"]) if exclude_ambiguous else CHARSETS["upper"]
        pool += s
        required.append(s[secrets.randbelow(len(s))])
    if digits:
        s = _filter_ambiguous(CHARSETS["digits"]) if exclude_ambiguous else CHARSETS["digits"]
        pool += s
        required.append(s[secrets.randbelow(len(s))])
    if symbols:
        s = CHARSETS["symbols"]
        pool += s
        required.append(s[secrets.randbelow(len(s))])

    if not pool:
        return ""

    chars: List[str] = list(required)
    for _ in range(length - len(chars)):
        chars.append(pool[secrets.randbelow(len(pool))])
    return "".join(secure_shuffle(chars)[:length])


def generate_passphrase(opts: dict | None = None) -> str:
    """生成记忆口令。opts: words/separator/capitalize/include_number。"""
    opts = opts or {}
    words = clamp_int(opts.get("words"), 4, 3, 8)
    separator = opts.get("separator", "-")
    if not isinstance(separator, str):
        separator = "-"
    separator = separator[:3]
    capitalize = opts.get("capitalize", True)
    include_number = opts.get("include_number", True)

    picked: List[str] = []
    for _ in range(words):
        w = WORD_LIST[secrets.randbelow(len(WORD_LIST))]
        if capitalize:
            w = w.capitalize()
        picked.append(w)
    if include_number:
        picked.append(str(secrets.randbelow(100)))
    return separator.join(picked)


def evaluate_strength(password: str) -> dict:
    """评估密码强度（基于 Shannon 熵 + 启发式）。返回 score/label/entropy/suggestions。"""
    if not password:
        return {"score": 0, "label": "无", "entropy": 0.0, "suggestions": []}

    pool_size = 0
    if re.search(r"[a-z]", password):
        pool_size += 26
    if re.search(r"[A-Z]", password):
        pool_size += 26
    if re.search(r"[0-9]", password):
        pool_size += 10
    if re.search(r"[^a-zA-Z0-9]", password):
        pool_size += 26

    entropy = len(password) * math.log2(pool_size or 1)
    suggestions: List[str] = []

    if len(password) < 8:
        suggestions.append("建议至少 8 位长度")
    if len(password) < 12:
        suggestions.append("建议增加到 12 位以上")
    if not re.search(r"[A-Z]", password):
        suggestions.append("加入大写字母")
    if not re.search(r"[0-9]", password):
        suggestions.append("加入数字")
    if not re.search(r"[^a-zA-Z0-9]", password):
        suggestions.append("加入特殊符号")
    if re.search(r"^(123|abc|password|qwerty|admin|letmein)", password, re.IGNORECASE):
        suggestions.append("避免使用常见弱密码开头")
    if re.search(r"(.)\1{2,}", password):
        suggestions.append("避免重复字符")

    if entropy < 28:
        score = 1
    elif entropy < 36:
        score = 2
    elif entropy < 60:
        score = 3
    elif entropy < 80:
        score = 4
    elif entropy < 120:
        score = 5
    else:
        score = 6

    labels = ["无", "极弱", "弱", "一般", "强", "很强", "极强"]
    return {
        "score": score,
        "label": labels[score],
        "entropy": round(entropy * 10) / 10,
        "suggestions": suggestions,
    }


def batch_generate(opts: dict | None = None) -> List[str]:
    """批量生成密码。opts.count 控制数量（1-200）。"""
    opts = dict(opts or {})
    count = clamp_int(opts.get("count"), 10, 1, 200)
    opts.pop("count", None)
    return [generate_password(opts) for _ in range(count)]


def estimate_crack_time(entropy: float) -> str:
    """根据熵值估算离线破解耗时（假设 10^10 次/秒）。"""
    if entropy <= 0:
        return "瞬时"
    guesses = 2 ** entropy / 2  # 平均尝试一半空间
    seconds = guesses / 1e10
    if seconds < 1:
        return f"{seconds * 1000:.1f} 毫秒"
    if seconds < 60:
        return f"{seconds:.1f} 秒"
    if seconds < 3600:
        return f"{seconds / 60:.1f} 分钟"
    if seconds < 86400:
        return f"{seconds / 3600:.1f} 小时"
    if seconds < 86400 * 365:
        return f"{seconds / 86400:.1f} 天"
    years = seconds / (86400 * 365)
    if years < 1000:
        return f"{years:.1f} 年"
    if years < 1e6:
        return f"{years / 1000:.1f} 千年"
    if years < 1e9:
        return f"{years / 1e6:.1f} 百万年"
    return "宇宙级"
