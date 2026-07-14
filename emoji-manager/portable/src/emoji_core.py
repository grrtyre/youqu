# -*- coding: utf-8 -*-
"""emoji_core.py — 表情管家便携版核心搜索/匹配逻辑
纯逻辑，无 Qt 依赖，便于单元测试
"""
from __future__ import annotations
from typing import Iterable, List, Dict, Any

from emoji_data import get_all_emojis, get_all_categories


def search(keyword: str, emojis: List[Dict[str, Any]] | None = None) -> List[Dict[str, Any]]:
    """关键词搜索：匹配中文名 n、关键词 k、字符 c（不区分大小写）
    返回匹配列表（保持原顺序），空关键词返回空列表
    """
    if not keyword or not keyword.strip():
        return []
    kw = keyword.strip().lower()
    if emojis is None:
        emojis = get_all_emojis()
    out = []
    for e in emojis:
        # 中文名包含
        if e.get("n") and kw in e["n"].lower():
            out.append(e); continue
        # 关键词字段：空格分隔，任一包含即命中
        if e.get("k"):
            for token in e["k"].split():
                if kw in token.lower():
                    out.append(e); break
            else:
                # 字符精确/包含匹配（仅当关键词较短时，避免误命中）
                if e.get("c") and len(kw) <= 4 and kw in e["c"].lower():
                    out.append(e)
        elif e.get("c") and len(kw) <= 4 and kw in e["c"].lower():
            out.append(e)
    return out


def filter_by_category(cat_id: str, emojis: List[Dict[str, Any]] | None = None) -> List[Dict[str, Any]]:
    """按分类 id 过滤"""
    if emojis is None:
        emojis = get_all_emojis()
    if cat_id == "all":
        return emojis
    return [e for e in emojis if e.get("cat") == cat_id]


def list_categories() -> List[Dict[str, Any]]:
    """返回所有分类（含 id/name/icon/emojis）"""
    return get_all_categories()


def dedupe_preserve_order(items: Iterable[Dict[str, Any]], key: str = "c") -> List[Dict[str, Any]]:
    """按 key 字段去重，保持首次出现顺序"""
    seen = set()
    out = []
    for it in items:
        v = it.get(key)
        if v in seen:
            continue
        seen.add(v)
        out.append(it)
    return out


def merge_results(favorites: List[Dict[str, Any]],
                  history: List[Dict[str, Any]],
                  searched: List[Dict[str, Any]],
                  limit: int = 64) -> List[Dict[str, Any]]:
    """合并收藏 + 历史 + 搜索结果为统一展示列表（去重，收藏优先）
    用于"推荐"视图
    """
    merged = list(favorites) + list(history) + list(searched)
    return dedupe_preserve_order(merged)[:limit]
