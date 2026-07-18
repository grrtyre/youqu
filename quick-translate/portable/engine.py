# -*- coding: utf-8 -*-
"""翻译引擎模块 —— 纯函数便于单元测试。
默认引擎：Google gtx（免费、无需 key、自动检测）；备用：MyMemory。
"""
from __future__ import annotations

import json
import re
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# 支持的语言列表（code -> 中文名）
LANGUAGES = [
    ("auto", "自动检测"),
    ("zh", "中文"),
    ("en", "英语"),
    ("ja", "日语"),
    ("ko", "韩语"),
    ("fr", "法语"),
    ("de", "德语"),
    ("es", "西班牙语"),
    ("it", "意大利语"),
    ("ru", "俄语"),
    ("pt", "葡萄牙语"),
    ("ar", "阿拉伯语"),
    ("th", "泰语"),
    ("vi", "越南语"),
    ("id", "印尼语"),
    ("ms", "马来语"),
    ("tr", "土耳其语"),
    ("nl", "荷兰语"),
    ("pl", "波兰语"),
    ("hi", "印地语"),
]

# 不包含 auto 的目标语言列表
TARGET_LANGUAGES = [l for l in LANGUAGES if l[0] != "auto"]


def build_google_url(sl: str, tl: str, q: str) -> str:
    """构造 Google gtx 请求 URL。"""
    sl_param = sl or "auto"
    return (
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl="
        + quote(sl_param)
        + "&tl="
        + quote(tl)
        + "&dt=t&q="
        + quote(q)
    )


def parse_google_response(raw: str) -> dict | None:
    """解析 Google gtx 返回。返回 {text, detectedSource}；失败返回 None。"""
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return None
    if not isinstance(data, list) or not data or not isinstance(data[0], list):
        return None
    text = ""
    for seg in data[0]:
        if isinstance(seg, list) and isinstance(seg[0], str):
            text += seg[0]
    detected = data[2] if len(data) > 2 and isinstance(data[2], str) else None
    if not text:
        return None
    return {"text": text, "detectedSource": detected}


def build_mymemory_url(sl: str, tl: str, q: str) -> str:
    """构造 MyMemory 请求 URL（要求显式源语言）。"""
    return (
        "https://api.mymemory.translated.net/get?q="
        + quote(q)
        + "&langpair="
        + quote(sl + "|" + tl)
    )


def parse_mymemory_response(raw: str) -> dict | None:
    """解析 MyMemory 返回。"""
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return None
    text = (
        data.get("responseData", {}).get("translatedText")
        if isinstance(data, dict)
        else None
    )
    if not isinstance(text, str) or not text:
        return None
    # 过滤 MyMemory 偶尔返回的大写错误信息
    if re.match(r"^(MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID)", text, re.I):
        return None
    return {"text": text, "detectedSource": None}


def _http_get(url: str, timeout: float = 8.0) -> str:
    """通过 urllib 发起 GET 请求，返回字符串。"""
    req = Request(url, headers={"User-Agent": "quick-translate-portable/1.0"})
    with urlopen(req, timeout=timeout) as resp:
        # Google 返回 utf-8
        return resp.read().decode("utf-8", errors="replace")


def _detect_lang_heuristic(text: str) -> str:
    """启发式源语言检测：含 CJK 视为 zh，否则视为 en。"""
    return "zh" if re.search(r"[\u4e00-\u9fff]", text) else "en"


def translate(text: str, from_lang: str = "auto", to_lang: str = "zh",
              engine: str = "auto") -> dict:
    """主翻译入口。
    返回 {text, detectedSource, engine}；失败抛出 Exception。
    """
    if not text or not text.strip():
        return {"text": "", "detectedSource": None, "engine": None}

    def try_google() -> dict | None:
        raw = _http_get(build_google_url(from_lang, to_lang, text))
        r = parse_google_response(raw)
        return r and {"text": r["text"], "detectedSource": r["detectedSource"], "engine": "google"}

    def try_mymemory() -> dict | None:
        sl = from_lang
        if sl == "auto":
            sl = _detect_lang_heuristic(text)
        raw = _http_get(build_mymemory_url(sl, to_lang, text))
        r = parse_mymemory_response(raw)
        return r and {"text": r["text"], "detectedSource": r["detectedSource"], "engine": "mymemory"}

    if engine == "google":
        r = try_google()
        if r:
            return r
        raise Exception("Google 翻译失败")
    if engine == "mymemory":
        r = try_mymemory()
        if r:
            return r
        raise Exception("MyMemory 翻译失败")

    # auto：先 google，失败回退 mymemory
    last_err = None
    try:
        r = try_google()
        if r:
            return r
    except (URLError, HTTPError, Exception) as e:
        last_err = e
    try:
        r = try_mymemory()
        if r:
            return r
    except (URLError, HTTPError, Exception) as e:
        last_err = e
    raise last_err or Exception("所有翻译引擎均失败")


def lang_name(code: str) -> str:
    """根据 code 返回中文名。"""
    for c, n in LANGUAGES:
        if c == code:
            return n
    return code.upper()
