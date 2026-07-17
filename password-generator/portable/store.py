# -*- coding: utf-8 -*-
"""store.py - 历史记录与设置持久化

纯本地 JSON 存储，不联网不上传。历史最多保留 50 条（对齐原版）。
存储位置：%APPDATA%/PasswordGeneratorPortable/ 下，便携不写注册表。
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List

MAX_HISTORY = 50


def _app_dir() -> str:
    """便携版数据目录，遵循 Windows 习惯放在 %APPDATA%。"""
    base = os.environ.get("APPDATA") or os.path.expanduser("~")
    path = os.path.join(base, "PasswordGeneratorPortable")
    os.makedirs(path, exist_ok=True)
    return path


def history_path() -> str:
    return os.path.join(_app_dir(), "history.json")


def settings_path() -> str:
    return os.path.join(_app_dir(), "settings.json")


def load_history() -> List[Dict[str, Any]]:
    try:
        with open(history_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data[:MAX_HISTORY]
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    return []


def save_history(history: List[Dict[str, Any]]) -> None:
    trimmed = history[:MAX_HISTORY]
    tmp = history_path() + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(trimmed, f, ensure_ascii=False, indent=2)
    os.replace(tmp, history_path())


def add_history(history: List[Dict[str, Any]], password: str, kind: str = "random") -> List[Dict[str, Any]]:
    entry = {"password": password, "kind": kind, "ts": time.time()}
    # 避免连续重复
    if history and history[0].get("password") == password:
        history[0]["ts"] = entry["ts"]
        return history
    history.insert(0, entry)
    return history[:MAX_HISTORY]


def clear_history() -> None:
    try:
        os.remove(history_path())
    except OSError:
        pass


def load_settings() -> Dict[str, Any]:
    try:
        with open(settings_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    return {}


def save_settings(settings: Dict[str, Any]) -> None:
    tmp = settings_path() + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)
    os.replace(tmp, settings_path())
