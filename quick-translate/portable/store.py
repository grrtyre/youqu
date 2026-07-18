# -*- coding: utf-8 -*-
"""数据持久化模块。
存储：用户家目录 ~/.mimo-quick-translate/data.json
结构：{ history: [...], settings: { from, to, engine, clipboardWatch } }
"""
from __future__ import annotations

import json
import os
import time
from typing import Any

DEFAULT_STORE: dict[str, Any] = {
    "history": [],
    "settings": {
        "from": "auto",
        "to": "zh",
        "engine": "auto",
        "clipboardWatch": False,
    },
}

MAX_HISTORY = 100


def data_dir() -> str:
    """返回应用数据目录路径（自动创建）。"""
    home = os.path.expanduser("~")
    d = os.path.join(home, ".mimo-quick-translate")
    os.makedirs(d, exist_ok=True)
    return d


def data_file() -> str:
    """返回数据文件路径。"""
    return os.path.join(data_dir(), "data.json")


def load_store() -> dict:
    """读取数据。失败返回默认结构。"""
    try:
        with open(data_file(), "r", encoding="utf-8") as f:
            data = json.load(f)
        # 兼容旧数据：补全缺失字段
        for k, v in DEFAULT_STORE.items():
            if k not in data:
                data[k] = v
            elif isinstance(v, dict):
                for sk, sv in v.items():
                    if sk not in data[k]:
                        data[k][sk] = sv
        return data
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return json.loads(json.dumps(DEFAULT_STORE))


def save_store(store: dict) -> bool:
    """写入数据。"""
    try:
        with open(data_file(), "w", encoding="utf-8") as f:
            json.dump(store, f, ensure_ascii=False, indent=2)
        return True
    except OSError:
        return False


def add_history(store: dict, src: str, tgt: str, src_lang: str, tgt_lang: str,
                detected: str | None = None, engine: str | None = None) -> dict:
    """添加一条翻译历史记录（去重，最新的在前）。返回更新后的 store。"""
    item = {
        "src": src,
        "tgt": tgt,
        "srcLang": src_lang,
        "tgtLang": tgt_lang,
        "detected": detected,
        "engine": engine,
        "ts": int(time.time()),
    }
    history = store.get("history", [])
    # 去重：相同源文+目标文+源语言+目标语言 → 替换并提到最前
    history = [
        h for h in history
        if not (
            h.get("src") == src
            and h.get("tgt") == tgt
            and h.get("srcLang") == src_lang
            and h.get("tgtLang") == tgt_lang
        )
    ]
    history.insert(0, item)
    if len(history) > MAX_HISTORY:
        history = history[:MAX_HISTORY]
    store["history"] = history
    return store


def clear_history(store: dict) -> dict:
    """清空历史。"""
    store["history"] = []
    return store


def update_settings(store: dict, **kwargs) -> dict:
    """更新设置项。"""
    settings = store.get("settings", DEFAULT_STORE["settings"].copy())
    settings.update(kwargs)
    store["settings"] = settings
    return store


def get_settings(store: dict) -> dict:
    """获取设置项。"""
    return store.get("settings", DEFAULT_STORE["settings"].copy())
