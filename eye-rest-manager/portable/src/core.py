# -*- coding: utf-8 -*-
"""core.py — 护眼管家便携版核心逻辑

职责：设置归一化、休息调度引擎、眼保健操动作库、本地统计与 JSON 持久化。
纯逻辑模块，不依赖任何 UI，便于单元测试。对应原版 break-engine.js / exercises.js / store.js / stats-utils.js。
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta
from typing import Any

# 休息类型
BREAK_TYPES = ("micro", "short", "long")

# 默认设置：遵循 20-20-20 法则
DEFAULT_SETTINGS: dict[str, Any] = {
    "breaks": {
        "micro": {"enabled": True, "interval": 20, "duration": 20},      # 每 20 分钟，休息 20 秒
        "short": {"enabled": True, "interval": 60, "duration": 180},     # 每 60 分钟，休息 3 分钟
        "long": {"enabled": True, "interval": 180, "duration": 600},     # 每 180 分钟，休息 10 分钟
    },
    "warning": {"enabled": True, "leadTime": 10},                         # 休息前 10 秒预警
    "dnd": {"enabled": False, "start": "22:00", "end": "08:00"},          # 免打扰时段（支持跨午夜）
    "fullscreenSuppress": True,                                           # 全屏时抑制休息
    "strictMode": False,                                                  # 严格模式：休息时不可跳过/延后/关闭
    "sound": True,
    "launchAtLogin": False,
}

# 状态机
STATES = {"IDLE": "idle", "WARNING": "warning", "BREAK": "break", "PAUSED": "paused"}


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------
def _clone(obj: Any) -> Any:
    return json.loads(json.dumps(obj))


def _bool_or(v: Any, d: bool) -> bool:
    return v if isinstance(v, bool) else d


def _clamp_int(v: Any, lo: int, hi: int, d: int) -> int:
    try:
        n = int(v)
    except (TypeError, ValueError):
        return d
    return max(lo, min(hi, n))


def _time_str_or(v: Any, d: str) -> str:
    if isinstance(v, str) and len(v) == 5 and v[2] == ":" and v[:2].isdigit() and v[3:].isdigit():
        return v
    return d


def normalize_settings(user: Any | None) -> dict[str, Any]:
    """用用户设置合并默认设置，保证字段完整且取值合法。"""
    out = _clone(DEFAULT_SETTINGS)
    if not isinstance(user, dict):
        return out
    breaks = user.get("breaks")
    if isinstance(breaks, dict):
        for t in BREAK_TYPES:
            if isinstance(breaks.get(t), dict):
                out["breaks"][t] = {
                    "enabled": _bool_or(breaks[t].get("enabled"), out["breaks"][t]["enabled"]),
                    "interval": _clamp_int(breaks[t].get("interval"), 1, 240, out["breaks"][t]["interval"]),
                    "duration": _clamp_int(breaks[t].get("duration"), 5, 3600, out["breaks"][t]["duration"]),
                }
    warning = user.get("warning")
    if isinstance(warning, dict):
        out["warning"] = {
            "enabled": _bool_or(warning.get("enabled"), out["warning"]["enabled"]),
            "leadTime": _clamp_int(warning.get("leadTime"), 0, 60, out["warning"]["leadTime"]),
        }
    dnd = user.get("dnd")
    if isinstance(dnd, dict):
        out["dnd"] = {
            "enabled": _bool_or(dnd.get("enabled"), out["dnd"]["enabled"]),
            "start": _time_str_or(dnd.get("start"), out["dnd"]["start"]),
            "end": _time_str_or(dnd.get("end"), out["dnd"]["end"]),
        }
    out["fullscreenSuppress"] = _bool_or(user.get("fullscreenSuppress"), out["fullscreenSuppress"])
    out["strictMode"] = _bool_or(user.get("strictMode"), out["strictMode"])
    out["sound"] = _bool_or(user.get("sound"), out["sound"])
    out["launchAtLogin"] = _bool_or(user.get("launchAtLogin"), out["launchAtLogin"])
    return out


def is_in_dnd(now: datetime, dnd: dict) -> bool:
    """判断给定时间是否在免打扰时段内，支持跨午夜（如 22:00-08:00）。"""
    if not dnd or not dnd.get("enabled"):
        return False
    cur = now.hour * 60 + now.minute
    try:
        sh, sm = map(int, dnd["start"].split(":"))
        eh, em = map(int, dnd["end"].split(":"))
    except (KeyError, ValueError):
        return False
    start, end = sh * 60 + sm, eh * 60 + em
    if start == end:
        return False
    if start < end:
        return start <= cur < end
    return cur >= start or cur < end  # 跨午夜


def schedule_next_breaks(settings: dict, from_time: datetime) -> list[dict]:
    """计算从 from_time 起，所有启用休息类型的下次触发时间，按时间升序排列。"""
    out = []
    for t in BREAK_TYPES:
        cfg = settings["breaks"][t]
        if not cfg["enabled"]:
            continue
        fire = from_time + timedelta(minutes=cfg["interval"])
        out.append({"type": t, "time": fire, "durationSec": cfg["duration"]})
    out.sort(key=lambda x: x["time"])
    return out


def next_idle_state(seconds_to_break: float, settings: dict) -> str:
    """根据距下次休息的秒数返回下一个状态。"""
    lead = settings["warning"]["leadTime"] if settings["warning"]["enabled"] else 0
    if seconds_to_break <= 0:
        return STATES["BREAK"]
    if seconds_to_break <= lead:
        return STATES["WARNING"]
    return STATES["IDLE"]


def seconds_between(from_time: datetime, to_time: datetime) -> int:
    """两个时间戳间隔秒数（向上取整，避免 0 秒边界）。"""
    return max(0, int(round((to_time - from_time).total_seconds())))


# ---------------------------------------------------------------------------
# 眼保健操动作库
# ---------------------------------------------------------------------------
EXERCISES = [
    {"id": "blink", "title": "轻柔眨眼", "instruction": "缓慢闭合双眼，停顿 2 秒，再缓缓睁开。重复数次，让泪膜重新滋润眼球。", "durationSec": 20, "icon": "👁"},
    {"id": "far-focus", "title": "远眺 20 英尺", "instruction": "将视线移向 6 米（20 英尺）以外的远处景物，放松睫状肌，持续约 20 秒。", "durationSec": 20, "icon": "🌅"},
    {"id": "rotate", "title": "眼球转动", "instruction": "保持头部不动，眼球顺时针缓慢转动 5 圈，再逆时针 5 圈，缓解眼肌疲劳。", "durationSec": 30, "icon": "🔄"},
    {"id": "palming", "title": "掌心捂眼", "instruction": "双手搓热，掌心轻覆于闭合的双眼上，感受温热与黑暗，深呼吸放松。", "durationSec": 40, "icon": "🤲"},
    {"id": "focus-shift", "title": "远近聚焦", "instruction": "先看鼻尖 3 秒，再望远处 3 秒，反复数次，训练眼睛对焦灵活性。", "durationSec": 30, "icon": "🔁"},
    {"id": "water-break", "title": "起身喝水", "instruction": "站起身走动几步，喝一口温水，让身体和眼睛都得到短暂休整。", "durationSec": 30, "icon": "💧"},
]


def pick_exercises(break_type: str, duration_sec: int) -> list[dict]:
    """按休息类型选择合适的动作集。"""
    if break_type == "micro":
        return [e for e in EXERCISES if e["durationSec"] <= 20][:3]
    if break_type == "short":
        return [e for e in EXERCISES if e["durationSec"] <= 30][:4]
    return list(EXERCISES)


# ---------------------------------------------------------------------------
# 持久化存储
# ---------------------------------------------------------------------------
class Store:
    """JSON 本地存储：设置 + 统计 + 历史。原子写入。"""

    def __init__(self, path: str | None = None) -> None:
        if path is None:
            base = os.environ.get("APPDATA") or os.path.expanduser("~")
            base = os.path.join(base, "EyeRestPortable")
            os.makedirs(base, exist_ok=True)
            path = os.path.join(base, "data.json")
        self.path = path
        self.data: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        if not os.path.exists(self.path):
            return {"settings": _clone(DEFAULT_SETTINGS), "stats": self._empty_stats(), "history": []}
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                d = json.load(f)
            d.setdefault("settings", _clone(DEFAULT_SETTINGS))
            d.setdefault("stats", self._empty_stats())
            d.setdefault("history", [])
            return d
        except (json.JSONDecodeError, OSError):
            return {"settings": _clone(DEFAULT_SETTINGS), "stats": self._empty_stats(), "history": []}

    def _empty_stats(self) -> dict[str, Any]:
        return {
            "todayDate": datetime.now().strftime("%Y-%m-%d"),
            "todayCompleted": 0,
            "todaySkipped": 0,
            "totalRestSeconds": 0,
            "streakDays": 0,
            "lastCompletedDate": None,
            "daily": {},  # {"YYYY-MM-DD": {"completed": n, "skipped": n, "seconds": n}}
        }

    def save(self) -> None:
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)  # 原子替换

    # ---- 设置 ----
    def get_settings(self) -> dict[str, Any]:
        return normalize_settings(self.data.get("settings"))

    def set_settings(self, settings: dict[str, Any]) -> None:
        self.data["settings"] = normalize_settings(settings)
        self.save()

    # ---- 统计 ----
    def _ensure_today(self) -> None:
        today = datetime.now().strftime("%Y-%m-%d")
        if self.data["stats"].get("todayDate") != today:
            # 跨天重置今日计数
            self.data["stats"]["todayDate"] = today
            self.data["stats"]["todayCompleted"] = 0
            self.data["stats"]["todaySkipped"] = 0

    def record_completed(self, seconds: int) -> None:
        self._ensure_today()
        self.data["stats"]["todayCompleted"] += 1
        self.data["stats"]["totalRestSeconds"] += int(seconds)
        today = datetime.now().strftime("%Y-%m-%d")
        daily = self.data["stats"]["daily"].setdefault(today, {"completed": 0, "skipped": 0, "seconds": 0})
        daily["completed"] += 1
        daily["seconds"] += int(seconds)
        # 连续达标天数：若今天首次完成且昨天也有完成记录，则 streak +1
        if self.data["stats"].get("lastCompletedDate") != today:
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
            if self.data["stats"].get("lastCompletedDate") == yesterday:
                self.data["stats"]["streakDays"] += 1
            elif self.data["stats"].get("lastCompletedDate") is None:
                self.data["stats"]["streakDays"] = 1
            else:
                self.data["stats"]["streakDays"] = 1
            self.data["stats"]["lastCompletedDate"] = today
        self.save()

    def record_skipped(self) -> None:
        self._ensure_today()
        self.data["stats"]["todaySkipped"] += 1
        today = datetime.now().strftime("%Y-%m-%d")
        daily = self.data["stats"]["daily"].setdefault(today, {"completed": 0, "skipped": 0, "seconds": 0})
        daily["skipped"] += 1
        self.save()

    def get_stats(self) -> dict[str, Any]:
        self._ensure_today()
        stats = self.data["stats"]
        # 聚合近 7 天柱状图数据
        daily = stats.get("daily", {})
        last7 = []
        for i in range(6, -1, -1):
            d = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            info = daily.get(d, {"completed": 0, "skipped": 0, "seconds": 0})
            last7.append({"date": d, "completed": info["completed"], "seconds": info["seconds"]})
        return {
            "todayCompleted": stats["todayCompleted"],
            "todaySkipped": stats["todaySkipped"],
            "totalRestSeconds": stats["totalRestSeconds"],
            "streakDays": stats["streakDays"],
            "last7": last7,
        }


def format_duration(seconds: int) -> str:
    """将秒数格式化为 mm:ss 或 hh:mm:ss。"""
    seconds = int(seconds)
    if seconds < 3600:
        return f"{seconds // 60:02d}:{seconds % 60:02d}"
    return f"{seconds // 3600:02d}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"
