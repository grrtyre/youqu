# -*- coding: utf-8 -*-
"""store.py — 收藏与历史本地持久化（JSON）
存到 %APPDATA%/emoji-portable/data.json
"""
from __future__ import annotations
import os
import json
import threading
from typing import List, Dict, Any

DEFAULT_HISTORY_LIMIT = 50


def _default_path() -> str:
    base = os.environ.get("APPDATA") or os.path.expanduser("~")
    d = os.path.join(base, "emoji-portable")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "data.json")


class EmojiStore:
    """线程安全的本地存储：收藏 + 历史"""

    def __init__(self, path: str | None = None):
        self._path = path or _default_path()
        self._lock = threading.Lock()
        self._favorites: List[Dict[str, Any]] = []
        self._history: List[Dict[str, Any]] = []
        self._load()

    # ---- 内部 ----
    def _load(self):
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._favorites = list(data.get("favorites", []))
            self._history = list(data.get("history", []))
        except Exception:
            self._favorites = []
            self._history = []

    def _persist(self):
        try:
            with open(self._path, "w", encoding="utf-8") as f:
                json.dump(
                    {"favorites": self._favorites, "history": self._history},
                    f, ensure_ascii=False, indent=2,
                )
        except Exception:
            pass

    # ---- 收藏 ----
    def get_favorites(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._favorites)

    def is_favorite(self, char: str) -> bool:
        with self._lock:
            return any(f.get("c") == char for f in self._favorites)

    def toggle_favorite(self, item: Dict[str, Any]) -> bool:
        """切换收藏状态，返回切换后是否为收藏"""
        with self._lock:
            char = item.get("c")
            idx = next((i for i, f in enumerate(self._favorites) if f.get("c") == char), -1)
            if idx >= 0:
                self._favorites.pop(idx)
                self._persist()
                return False
            # 仅保留必要字段
            slim = {k: item.get(k) for k in ("c", "n", "k", "cat", "catName") if k in item}
            self._favorites.insert(0, slim)
            self._persist()
            return True

    # ---- 历史 ----
    def get_history(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._history)

    def add_history(self, item: Dict[str, Any]):
        with self._lock:
            char = item.get("c")
            # 先移除已有同字符项，再插到队首
            self._history = [h for h in self._history if h.get("c") != char]
            slim = {k: item.get(k) for k in ("c", "n", "k", "cat", "catName") if k in item}
            self._history.insert(0, slim)
            if len(self._history) > DEFAULT_HISTORY_LIMIT:
                self._history = self._history[:DEFAULT_HISTORY_LIMIT]
            self._persist()

    def clear_history(self):
        with self._lock:
            self._history = []
            self._persist()
