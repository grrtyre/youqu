# -*- coding: utf-8 -*-
"""模糊搜索算法 —— 子序列匹配 + 连续匹配加分 + 词边界加分
忠实移植自原 Electron 版 src/lib/fuzzySearch.js，保持评分一致性。"""

from __future__ import annotations
import re
from typing import List, Tuple, Optional, Any


def _range(start: int, end: int) -> List[int]:
    return list(range(start, end))


def match_score(text: str, query: str) -> Tuple[float, List[int]]:
    """对单个文本计算与查询的匹配分数及命中位置。
    返回 (score, positions)；score < 0 表示不匹配。"""
    if not query:
        return 1.0, []
    t = text.lower()
    q = query.lower()

    # 精确匹配
    if t == q:
        return 1000.0, _range(0, len(q))
    # 前缀匹配
    if t.startswith(q):
        return 500.0 + (1.0 / (len(t) + 1)) * 100.0, _range(0, len(q))
    # 子串包含
    idx = t.find(q)
    if idx >= 0:
        before = (idx == 0) or (not t[idx - 1].isalnum())
        after = (idx + len(q) >= len(t)) or (not t[idx + len(q)].isalnum())
        if before and after:
            return 600.0, _range(idx, idx + len(q))
        return 300.0 - idx + (1.0 / (len(t) + 1)) * 50.0, _range(idx, idx + len(q))

    # 子序列模糊匹配
    positions: List[int] = []
    ti = 0
    for ch in q:
        found = False
        while ti < len(t):
            if t[ti] == ch:
                positions.append(ti)
                ti += 1
                found = True
                break
            ti += 1
        if not found:
            return -1.0, []

    score = 50.0
    consecutive = 1
    for i in range(1, len(positions)):
        if positions[i] == positions[i - 1] + 1:
            consecutive += 1
            score += consecutive * 8
        else:
            consecutive = 1
            score -= 3
    if positions[0] == 0:
        score += 30
    for i in range(1, len(positions)):
        prev = t[positions[i] - 1]
        if prev in (' ', '-', '_', '.'):
            score += 15
    span = positions[-1] - positions[0]
    score -= span * 0.5
    return score, positions


def fuzzy_search(items: List[Any], query: str, key: str = 'name',
                 limit: int = 8) -> List[dict]:
    """对 items 列表做模糊搜索，返回 [{item, score, positions}] 列表，按分数降序。"""
    if not query or not query.strip():
        return [{'item': it, 'score': 0.0, 'positions': []}
                for it in items[:limit]]

    results = []
    for it in items:
        text = it.get(key, '') if isinstance(it, dict) else getattr(it, key, '')
        score, positions = match_score(text, query)
        if score >= 0:
            results.append({'item': it, 'score': score, 'positions': positions})

    def sort_key(r):
        text = r['item'].get(key, '') if isinstance(r['item'], dict) \
            else getattr(r['item'], key, '')
        return (-r['score'], len(text))

    results.sort(key=sort_key)
    return results[:limit]


def highlight_segments(text: str, positions: List[int]) -> List[Tuple[str, bool]]:
    """根据命中位置把 text 切成 [(片段, 是否命中)] 列表，供 UI 高亮渲染。"""
    if not positions:
        return [(text, False)]
    pos_set = set(positions)
    segments: List[Tuple[str, bool]] = []
    buf = ''
    matched = False
    for i, ch in enumerate(text):
        is_hit = i in pos_set
        if is_hit == matched:
            buf += ch
        else:
            if buf:
                segments.append((buf, matched))
            buf = ch
            matched = is_hit
    if buf:
        segments.append((buf, matched))
    return segments
