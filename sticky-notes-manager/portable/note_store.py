# -*- coding: utf-8 -*-
"""便签管家便携版 - 数据层
纯 Python 实现，零第三方依赖，与原 Electron 版数据格式兼容（version 2）。
"""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

# === 常量 ===

# 颜色标签（与原版保持一致，苹果白风格配色）
COLORS: Dict[str, Dict[str, str]] = {
    "default": {"name": "默认", "hex": "#f5f5f7", "dot": "#8e8e93"},
    "blue":    {"name": "蓝色", "hex": "#e3f0ff", "dot": "#007aff"},
    "green":   {"name": "绿色", "hex": "#e8f8ec", "dot": "#34c759"},
    "yellow":  {"name": "黄色", "hex": "#fff9e0", "dot": "#ffcc00"},
    "orange":  {"name": "橙色", "hex": "#fff0e0", "dot": "#ff9500"},
    "pink":    {"name": "粉色", "hex": "#ffe8ef", "dot": "#ff2d55"},
    "purple":  {"name": "紫色", "hex": "#f3e8ff", "dot": "#af52de"},
}

CATEGORIES: List[str] = ["工作", "个人", "灵感", "待办", "其他"]

TRASH_MAX_DAYS = 30


def _now_ms() -> int:
    """当前毫秒时间戳"""
    return int(time.time() * 1000)


def generate_id() -> str:
    """生成唯一 ID"""
    return "n_" + uuid.uuid4().hex[:12]


def default_data_path() -> str:
    """默认数据文件路径（用户数据目录下，与原版路径不同，避免冲突）"""
    base = os.environ.get("APPDATA") or os.environ.get("HOME") or os.environ.get("USERPROFILE") or "."
    return os.path.join(base, "sticky-notes-portable", "notes.json")


def create_note(data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """创建便签对象（带默认值）"""
    data = data or {}
    now = _now_ms()
    color = data.get("color", "default")
    if color not in COLORS:
        color = "default"
    category = data.get("category", "其他")
    if category not in CATEGORIES:
        category = "其他"
    updated = data.get("updatedAt")
    if not (isinstance(updated, (int, float)) and updated > 0):
        updated = now
    return {
        "id": data.get("id") or generate_id(),
        "title": (data.get("title") or "").strip(),
        "content": (data.get("content") or "").strip(),
        "color": color,
        "category": category,
        "pinned": bool(data.get("pinned", False)),
        "createdAt": data.get("createdAt") or now,
        "updatedAt": updated,
    }


def create_trash_note(data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """创建回收站便签对象"""
    note = create_note(data)
    note["deletedAt"] = (data or {}).get("deletedAt") or _now_ms()
    return note


def load_all(data_path: Optional[str] = None) -> Dict[str, List[Dict[str, Any]]]:
    """读取便签 + 回收站"""
    path = data_path or default_data_path()
    if not os.path.exists(path):
        return {"notes": [], "trash": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        notes = [create_note(n) for n in data.get("notes", [])] if isinstance(data.get("notes"), list) else []
        trash = [create_trash_note(n) for n in data.get("trash", [])] if isinstance(data.get("trash"), list) else []
        return {"notes": notes, "trash": trash}
    except Exception:
        return {"notes": [], "trash": []}


def save_all(notes: List[Dict[str, Any]], trash: List[Dict[str, Any]], data_path: Optional[str] = None) -> bool:
    """保存全部便签 + 回收站"""
    path = data_path or default_data_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = {
        "version": 2,
        "exportedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "notes": notes,
        "trash": trash,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return True


def add_note(notes: List[Dict[str, Any]], data: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """新增便签（插入到最前）"""
    note = create_note(data)
    return [note] + notes, note


def update_note(notes: List[Dict[str, Any]], note_id: str, patch: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """更新便签"""
    updated: Optional[Dict[str, Any]] = None
    new_notes: List[Dict[str, Any]] = []
    for n in notes:
        if n["id"] == note_id:
            merged = {**n, **patch, "id": n["id"], "createdAt": n["createdAt"], "updatedAt": _now_ms()}
            updated = create_note(merged)
            new_notes.append(updated)
        else:
            new_notes.append(n)
    return new_notes, updated


def toggle_pin(notes: List[Dict[str, Any]], note_id: str) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """切换置顶"""
    updated: Optional[Dict[str, Any]] = None
    new_notes: List[Dict[str, Any]] = []
    for n in notes:
        if n["id"] == note_id:
            updated = {**n, "pinned": not n["pinned"], "updatedAt": _now_ms()}
            new_notes.append(updated)
        else:
            new_notes.append(n)
    return new_notes, updated


def move_to_trash(notes: List[Dict[str, Any]], trash: List[Dict[str, Any]], note_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """移入回收站"""
    target = next((n for n in notes if n["id"] == note_id), None)
    if not target:
        return notes, trash, None
    trashed = create_trash_note({**target, "deletedAt": _now_ms()})
    return [n for n in notes if n["id"] != note_id], [trashed] + trash, trashed


def restore_note(trash: List[Dict[str, Any]], notes: List[Dict[str, Any]], note_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """从回收站恢复"""
    target = next((n for n in trash if n["id"] == note_id), None)
    if not target:
        return notes, trash, None
    restored = create_note({**target, "pinned": False, "updatedAt": _now_ms()})
    return [restored] + notes, [n for n in trash if n["id"] != note_id], restored


def delete_from_trash(trash: List[Dict[str, Any]], note_id: str) -> List[Dict[str, Any]]:
    """从回收站彻底删除"""
    return [n for n in trash if n["id"] != note_id]


def empty_trash(trash: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """清空回收站"""
    return []


def auto_clean_trash(trash: List[Dict[str, Any]], now_ms: Optional[int] = None) -> List[Dict[str, Any]]:
    """自动清理过期回收站"""
    now = now_ms or _now_ms()
    max_age_ms = TRASH_MAX_DAYS * 24 * 60 * 60 * 1000
    return [n for n in trash if not n.get("deletedAt") or (now - n["deletedAt"]) < max_age_ms]


def get_trash_days_left(note: Dict[str, Any], now_ms: Optional[int] = None) -> int:
    """计算回收站便签的剩余保留天数"""
    now = now_ms or _now_ms()
    if not note.get("deletedAt"):
        return TRASH_MAX_DAYS
    max_age_ms = TRASH_MAX_DAYS * 24 * 60 * 60 * 1000
    elapsed = now - note["deletedAt"]
    left = -(-(max_age_ms - elapsed) // (24 * 60 * 60 * 1000))  # 向上取整
    return max(0, int(left))


def search_notes(notes: List[Dict[str, Any]], keyword: str) -> List[Dict[str, Any]]:
    """搜索便签（标题 + 内容，不区分大小写"""
    if not keyword or not keyword.strip():
        return notes
    kw = keyword.strip().lower()
    return [n for n in notes if kw in (n.get("title") or "").lower() or kw in (n.get("content") or "").lower()]


def filter_by_category(notes: List[Dict[str, Any]], category: str) -> List[Dict[str, Any]]:
    """按分类筛选"""
    if not category or category == "全部":
        return notes
    return [n for n in notes if n.get("category") == category]


def sort_notes(notes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """排序：置顶优先 → 更新时间倒序"""
    return sorted(notes, key=lambda n: (not n.get("pinned", False), -n.get("updatedAt", 0)))


def get_stats(notes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """统计信息"""
    stats: Dict[str, Any] = {
        "total": len(notes),
        "pinned": sum(1 for n in notes if n.get("pinned")),
        "byCategory": {c: 0 for c in CATEGORIES},
        "byColor": {c: 0 for c in COLORS},
        "totalWords": 0,
        "totalChars": 0,
    }
    for n in notes:
        if n.get("category") in stats["byCategory"]:
            stats["byCategory"][n["category"]] += 1
        if n.get("color") in stats["byColor"]:
            stats["byColor"][n["color"]] += 1
        text = ((n.get("title") or "") + " " + (n.get("content") or "")).strip()
        stats["totalChars"] += len(text)
        # 简化版字数统计
        chinese = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fa5")
        english = len([w for w in "".join(ch if not ("\u4e00" <= ch <= "\u9fa5") else " " for ch in text).split() if any(c.isalnum() for c in w)])
        stats["totalWords"] += chinese + english
    return stats


def export_notes(notes: List[Dict[str, Any]]) -> str:
    """导出为 JSON 字符串"""
    return json.dumps({
        "version": 1,
        "exportedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "notes": notes,
    }, ensure_ascii=False, indent=2)


def import_notes(json_str: str, existing_notes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """从 JSON 字符串导入（重新生成 ID，保留原时间戳）"""
    data = json.loads(json_str)
    if not isinstance(data.get("notes"), list):
        raise ValueError("无效的便签数据格式")
    imported: List[Dict[str, Any]] = []
    for n in data["notes"]:
        imported.append(create_note({
            **n,
            "id": None,  # 重新生成 ID
            "createdAt": n.get("createdAt"),
            "updatedAt": n.get("updatedAt"),
        }))
    return existing_notes + imported


def format_relative_time(ts: int, now_ms: Optional[int] = None) -> str:
    """格式化相对时间"""
    now = now_ms or _now_ms()
    diff = (now - ts) / 1000  # 秒
    if diff < 60:
        return "刚刚"
    if diff < 3600:
        return f"{int(diff // 60)} 分钟前"
    if diff < 86400:
        return f"{int(diff // 3600)} 小时前"
    if diff < 86400 * 30:
        return f"{int(diff // 86400)} 天前"
    return time.strftime("%Y-%m-%d", time.localtime(ts / 1000))
