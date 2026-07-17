# -*- coding: utf-8 -*-
"""提示词本地存储 —— 单文件 JSON 持久化"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _gen_id() -> str:
    return "p-" + datetime.now().strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:6]


def _seed_prompts() -> List[Dict[str, Any]]:
    now = _now_iso()
    return [
        {
            "id": "seed-1",
            "title": "智能翻译",
            "content": "请将以下内容翻译为{{目标语言}}，保持语气自然流畅：\n\n{{待翻译内容}}",
            "category": "翻译",
            "tags": ["翻译", "语言"],
            "favorite": True,
            "usageCount": 0,
            "createdAt": now,
            "updatedAt": now,
            "lastUsedAt": None,
        },
        {
            "id": "seed-2",
            "title": "周报生成",
            "content": "请根据以下要点撰写一份结构清晰的周报，分为本周进展、下周计划、风险与求助三部分：\n\n{{本周要点}}",
            "category": "写作",
            "tags": ["工作", "周报"],
            "favorite": False,
            "usageCount": 0,
            "createdAt": now,
            "updatedAt": now,
            "lastUsedAt": None,
        },
        {
            "id": "seed-3",
            "title": "代码审查助手",
            "content": "请审查以下代码，重点关注：可读性、性能、安全性、潜在 Bug，并给出改进建议：\n\n```{{语言}}\n{{代码}}\n```",
            "category": "编程",
            "tags": ["代码", "审查"],
            "favorite": True,
            "usageCount": 0,
            "createdAt": now,
            "updatedAt": now,
            "lastUsedAt": None,
        },
        {
            "id": "seed-4",
            "title": "会议纪要整理",
            "content": "请把下面的会议记录整理成结构化纪要，包含：议题、讨论要点、决议、待办事项与负责人：\n\n{{会议记录}}",
            "category": "写作",
            "tags": ["会议", "纪要"],
            "favorite": False,
            "usageCount": 0,
            "createdAt": now,
            "updatedAt": now,
            "lastUsedAt": None,
        },
        {
            "id": "seed-5",
            "title": "一句话扩写",
            "content": "请把下面的核心观点扩写为一段 150 字左右、逻辑通顺的段落：\n\n{{核心观点}}",
            "category": "写作",
            "tags": ["扩写", "润色"],
            "favorite": False,
            "usageCount": 0,
            "createdAt": now,
            "updatedAt": now,
            "lastUsedAt": None,
        },
        {
            "id": "seed-6",
            "title": "SQL 生成",
            "content": "请根据需求用 {{数据库类型}} 编写 SQL：\n需求：{{需求描述}}\n表结构：{{表结构}}",
            "category": "编程",
            "tags": ["SQL", "数据库"],
            "favorite": False,
            "usageCount": 0,
            "createdAt": now,
            "updatedAt": now,
            "lastUsedAt": None,
        },
    ]


class PromptStore:
    """提示词库本地存储"""

    def __init__(self, path: str):
        self.path = path
        self._data: Dict[str, Any] = {"prompts": []}
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.path):
            self._data = {"prompts": _seed_prompts()}
            self._save()
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if not isinstance(raw, dict) or not isinstance(raw.get("prompts"), list):
                raise ValueError("invalid format")
            self._data = raw
        except Exception:
            self._data = {"prompts": _seed_prompts()}
            self._save()

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)

    # ===== CRUD =====
    def all(self) -> List[Dict[str, Any]]:
        return list(self._data.get("prompts", []))

    def get(self, pid: str) -> Optional[Dict[str, Any]]:
        for p in self._data["prompts"]:
            if p.get("id") == pid:
                return p
        return None

    def add(self, title: str, content: str, category: str = "", tags: Optional[List[str]] = None,
            favorite: bool = False) -> Dict[str, Any]:
        now = _now_iso()
        item = {
            "id": _gen_id(),
            "title": title,
            "content": content,
            "category": category or "未分类",
            "tags": tags or [],
            "favorite": favorite,
            "usageCount": 0,
            "createdAt": now,
            "updatedAt": now,
            "lastUsedAt": None,
        }
        self._data["prompts"].append(item)
        self._save()
        return item

    def update(self, pid: str, **fields) -> Optional[Dict[str, Any]]:
        for p in self._data["prompts"]:
            if p.get("id") == pid:
                for k, v in fields.items():
                    if k in ("title", "content", "category", "tags", "favorite"):
                        p[k] = v
                p["updatedAt"] = _now_iso()
                self._save()
                return p
        return None

    def delete(self, pid: str) -> bool:
        before = len(self._data["prompts"])
        self._data["prompts"] = [p for p in self._data["prompts"] if p.get("id") != pid]
        if len(self._data["prompts"]) != before:
            self._save()
            return True
        return False

    def bump_usage(self, pid: str) -> None:
        for p in self._data["prompts"]:
            if p.get("id") == pid:
                p["usageCount"] = int(p.get("usageCount", 0)) + 1
                p["lastUsedAt"] = _now_iso()
                self._save()
                return

    def toggle_favorite(self, pid: str) -> Optional[bool]:
        for p in self._data["prompts"]:
            if p.get("id") == pid:
                p["favorite"] = not p.get("favorite", False)
                p["updatedAt"] = _now_iso()
                self._save()
                return p["favorite"]
        return None

    # ===== 查询 =====
    def search(self, keyword: str = "", category: Optional[str] = None,
               tag: Optional[str] = None, favorite_only: bool = False,
               recent_only: bool = False, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        items = self.all()
        if favorite_only:
            items = [p for p in items if p.get("favorite")]
        if recent_only:
            items = [p for p in items if p.get("lastUsedAt")]
            items.sort(key=lambda x: x.get("lastUsedAt", ""), reverse=True)
        if category:
            items = [p for p in items if p.get("category") == category]
        if tag:
            items = [p for p in items if tag in (p.get("tags") or [])]
        kw = (keyword or "").strip().lower()
        if kw:
            def _match(p):
                hay = " ".join([
                    p.get("title", ""),
                    p.get("content", ""),
                    " ".join(p.get("tags") or []),
                    p.get("category", ""),
                ]).lower()
                return kw in hay
            items = [p for p in items if _match(p)]
        # 默认排序：收藏在前 → 最近更新
        if not recent_only:
            items.sort(key=lambda x: (not x.get("favorite", False), x.get("updatedAt", "")), reverse=True)
            # Python 排序稳定，先按 updatedAt 倒序，再按 favorite 分组
            items.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
            items.sort(key=lambda x: not x.get("favorite", False))
        if limit is not None:
            items = items[:limit]
        return items

    def categories(self) -> List[str]:
        return sorted({p.get("category", "") for p in self._data["prompts"] if p.get("category")})

    def tags(self) -> List[str]:
        d: Dict[str, int] = {}
        for p in self._data["prompts"]:
            for t in (p.get("tags") or []):
                d[t] = d.get(t, 0) + 1
        return sorted(d.keys(), key=lambda k: -d[k])

    # ===== 导入导出 =====
    def export_all(self) -> Dict[str, Any]:
        return {"prompts": list(self._data["prompts"])}

    def import_merge(self, data: Dict[str, Any]) -> int:
        incoming = data.get("prompts") or []
        if not isinstance(incoming, list):
            raise ValueError("invalid format")
        exist_ids = {p.get("id") for p in self._data["prompts"]}
        added = 0
        for p in incoming:
            if not isinstance(p, dict):
                continue
            if not p.get("id"):
                p["id"] = _gen_id()
            if p["id"] not in exist_ids:
                self._data["prompts"].append(p)
                exist_ids.add(p["id"])
                added += 1
        if added:
            self._save()
        return added


def extract_vars(text: str) -> List[str]:
    """提取 {{变量名}} 列表，去重保序"""
    import re
    seen = set()
    out = []
    for m in re.finditer(r"\{\{([^{}]+)\}\}", text):
        name = m.group(1).strip()
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def fill_vars(content: str, values: Dict[str, str]) -> str:
    """用值填充 {{变量名}}"""
    for name, val in values.items():
        content = content.replace("{{" + name + "}}", val or "")
    return content
