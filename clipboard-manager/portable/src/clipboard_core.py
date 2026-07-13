# -*- coding: utf-8 -*-
"""剪贴板管家·便携版 - 核心逻辑（纯 Python，无 GUI 依赖，可独立测试）

包含：内容分类、去重、存储、置顶/收藏、搜索、最大条目限制。
"""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import List, Optional


# ---------- 分类正则 ----------

_LINK_RE = re.compile(
    r"^(?:https?://|ftp://|www\.)|^[a-zA-Z][a-zA-Z0-9+.-]*://",
    re.IGNORECASE,
)
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PHONE_RE = re.compile(r"^(\+?\d[\d\-\s]{6,18}\d)$")
# 简单判定为代码：包含常见代码符号且有多行 / 缩进
_CODE_HINT_RE = re.compile(
    r"(def |function |class |import |from |const |let |var |public |private |"
    r"#include |package |func |return |if \(|for \(|while \()"
)
_INDENT_RE = re.compile(r"^\s{4,}\S", re.MULTILINE)


def classify(content: str) -> str:
    """对文本内容进行智能分类，返回类型字符串。

    返回值：link / email / phone / code / text
    """
    if not content:
        return "text"
    text = content.strip()
    # 单行优先判定
    first_line = text.splitlines()[0] if text else ""
    if _LINK_RE.match(first_line):
        return "link"
    if _EMAIL_RE.match(first_line):
        return "email"
    if _PHONE_RE.match(first_line):
        return "phone"
    # 代码判定：含关键字或明显缩进
    if _CODE_HINT_RE.search(text) or (_INDENT_RE.search(text) and len(text.splitlines()) > 1):
        return "code"
    return "text"


# ---------- 数据结构 ----------

@dataclass
class ClipboardItem:
    """单条剪贴板记录。"""
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    content: str = ""
    kind: str = "text"
    timestamp: float = field(default_factory=time.time)
    pinned: bool = False
    favorite: bool = False

    def preview(self, max_len: int = 120) -> str:
        """返回用于列表展示的单行预览文本。"""
        one = self.content.replace("\r", " ").replace("\n", " ").strip()
        if len(one) > max_len:
            return one[:max_len] + "…"
        return one

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "ClipboardItem":
        return cls(
            id=d.get("id", uuid.uuid4().hex[:12]),
            content=d.get("content", ""),
            kind=d.get("kind", "text"),
            timestamp=float(d.get("timestamp", time.time())),
            pinned=bool(d.get("pinned", False)),
            favorite=bool(d.get("favorite", False)),
        )


# ---------- 存储管理 ----------

MAX_TEXT_ITEMS = 500  # 最大文本条目数


class ClipboardStore:
    """剪贴板历史存储，负责增删查、去重、持久化。

    列表顺序：置顶在前，其余按时间倒序。
    """

    def __init__(self, max_items: int = MAX_TEXT_ITEMS):
        self._items: List[ClipboardItem] = []
        self._max = max_items
        self._seen: set[str] = set()  # 用于去重的内容指纹

    # ---- 查询 ----

    @property
    def items(self) -> List[ClipboardItem]:
        return list(self._items)

    def count(self) -> int:
        return len(self._items)

    def get_by_id(self, item_id: str) -> Optional[ClipboardItem]:
        for it in self._items:
            if it.id == item_id:
                return it
        return None

    # ---- 增删 ----

    def _fingerprint(self, content: str) -> str:
        return content.strip()

    def add(self, content: str) -> Optional[ClipboardItem]:
        """新增一条记录。空内容或重复返回 None。"""
        content = content or ""
        if not content.strip():
            return None
        fp = self._fingerprint(content)
        # 已存在则提升到最前（若非置顶）
        existing = self._find_by_fp(fp)
        if existing is not None:
            self._items.remove(existing)
            # 更新时间戳
            existing.timestamp = time.time()
            self._reinsert(existing)
            return existing
        item = ClipboardItem(content=content, kind=classify(content))
        self._seen.add(fp)
        self._reinsert(item)
        self._enforce_limit()
        return item

    def _find_by_fp(self, fp: str) -> Optional[ClipboardItem]:
        for it in self._items:
            if self._fingerprint(it.content) == fp:
                return it
        return None

    def _reinsert(self, item: ClipboardItem) -> None:
        """把条目插到正确位置：置顶在前，其余按时间倒序。"""
        if item.pinned:
            # 插到置顶区末尾
            insert_at = 0
            for i, it in enumerate(self._items):
                if it.pinned:
                    insert_at = i + 1
                else:
                    break
            self._items.insert(insert_at, item)
        else:
            # 非置顶插到第一个非置顶位置之前（即置顶区之后）
            insert_at = 0
            for i, it in enumerate(self._items):
                if it.pinned:
                    insert_at = i + 1
                else:
                    break
            self._items.insert(insert_at, item)

    def _enforce_limit(self) -> None:
        """超过上限时淘汰最旧的非置顶非收藏条目。"""
        # 从末尾往前淘汰
        while self.count() > self._max:
            removed = None
            for i in range(len(self._items) - 1, -1, -1):
                it = self._items[i]
                if not it.pinned and not it.favorite:
                    removed = self._items.pop(i)
                    break
            if removed is None:
                break  # 全部是置顶/收藏，不再淘汰
            self._seen.discard(self._fingerprint(removed.content))

    def remove(self, item_id: str) -> bool:
        for i, it in enumerate(self._items):
            if it.id == item_id:
                self._items.pop(i)
                self._seen.discard(self._fingerprint(it.content))
                return True
        return False

    def clear(self) -> int:
        """清空所有条目，但保留置顶和收藏。返回被清除的数量。"""
        keep: List[ClipboardItem] = []
        removed = 0
        for it in self._items:
            if it.pinned or it.favorite:
                keep.append(it)
            else:
                removed += 1
        self._items = keep
        # 重建指纹集合
        self._seen = {self._fingerprint(it.content) for it in self._items}
        return removed

    # ---- 置顶 / 收藏 ----

    def toggle_pin(self, item_id: str) -> bool:
        it = self.get_by_id(item_id)
        if it is None:
            return False
        it.pinned = not it.pinned
        self._items.remove(it)
        self._reinsert(it)
        return True

    def toggle_favorite(self, item_id: str) -> bool:
        it = self.get_by_id(item_id)
        if it is None:
            return False
        it.favorite = not it.favorite
        return True

    # ---- 搜索 ----

    def search(self, keyword: str, kind_filter: str = "all") -> List[ClipboardItem]:
        """按关键词和类型筛选。返回匹配列表。"""
        kw = (keyword or "").strip().lower()
        out: List[ClipboardItem] = []
        for it in self._items:
            if kind_filter != "all":
                if kind_filter == "favorite" and not it.favorite:
                    continue
                elif kind_filter != "favorite" and it.kind != kind_filter:
                    continue
            if kw and kw not in it.content.lower():
                continue
            out.append(it)
        return out

    # ---- 持久化 ----

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = {
            "version": 1,
            "items": [it.to_dict() for it in self._items],
        }
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)

    def load(self, path: str) -> None:
        if not os.path.exists(path):
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            items = [ClipboardItem.from_dict(d) for d in data.get("items", [])]
            self._items = items
            self._seen = {self._fingerprint(it.content) for it in items}
        except (json.JSONDecodeError, OSError, KeyError):
            self._items = []
            self._seen = set()


# ---------- 相对时间 ----------

def relative_time(ts: float, now: Optional[float] = None) -> str:
    """把时间戳转成相对时间描述，如「刚刚」「3 分钟前」。"""
    now = now if now is not None else time.time()
    diff = max(0, now - ts)
    if diff < 60:
        return "刚刚"
    if diff < 3600:
        return f"{int(diff // 60)} 分钟前"
    if diff < 86400:
        return f"{int(diff // 3600)} 小时前"
    if diff < 604800:
        return f"{int(diff // 86400)} 天前"
    # 超过一周显示日期
    t = time.localtime(ts)
    return time.strftime("%m-%d", t)
