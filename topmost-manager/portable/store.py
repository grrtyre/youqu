# -*- coding: utf-8 -*-
"""store.py —— 自动置顶规则持久化（纯函数，便于单测）。

规则文件结构：
{
  "rules": [{"proc": "notepad.exe", "enabled": true}, ...],
  "autoPin": false
}
"""
from __future__ import annotations

import json
import os
from typing import List, Dict, Any


def default_data() -> Dict[str, Any]:
    return {"rules": [], "autoPin": False}


def load(file_path: str) -> Dict[str, Any]:
    """加载规则文件，失败返回默认值。"""
    try:
        if not os.path.exists(file_path):
            return default_data()
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return default_data()
        if not isinstance(data.get("rules"), list):
            data["rules"] = []
        if not isinstance(data.get("autoPin"), bool):
            data["autoPin"] = False
        # 规整每条规则：strip + lower，enabled 缺失默认 True
        data["rules"] = [
            {"proc": str(r["proc"]).strip().lower(),
             "enabled": r.get("enabled", True)}
            for r in data["rules"]
            if isinstance(r, dict) and isinstance(r.get("proc"), str)
            and r["proc"].strip() != ""
        ]
        return data
    except Exception:
        return default_data()


def save(file_path: str, data: Dict[str, Any]) -> bool:
    """原子写入：先写临时文件再 rename，避免损坏。"""
    try:
        tmp = file_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, file_path)
        return True
    except Exception:
        return False


def add_rule(data: Dict[str, Any], proc: str) -> Dict[str, Any]:
    p = (proc or "").strip().lower()
    if not p:
        return data
    if any(r["proc"] == p for r in data["rules"]):
        return data
    data["rules"].append({"proc": p, "enabled": True})
    return data


def remove_rule(data: Dict[str, Any], proc: str) -> Dict[str, Any]:
    p = (proc or "").strip().lower()
    data["rules"] = [r for r in data["rules"] if r["proc"] != p]
    return data


def toggle_rule(data: Dict[str, Any], proc: str, enabled: bool) -> Dict[str, Any]:
    p = (proc or "").strip().lower()
    for r in data["rules"]:
        if r["proc"] == p:
            r["enabled"] = bool(enabled)
    return data


def matches_rule(data: Dict[str, Any], proc: str) -> bool:
    """判断某进程名是否命中启用中的规则。"""
    p = (proc or "").strip().lower()
    if not p:
        return False
    return any(r["proc"] == p and r.get("enabled", True) for r in data["rules"])


def is_rule(data: Dict[str, Any], proc: str) -> bool:
    """判断某进程是否已在规则列表（不论启用状态）。"""
    p = (proc or "").strip().lower()
    return any(r["proc"] == p for r in data["rules"])
