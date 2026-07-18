# -*- coding: utf-8 -*-
"""
番茄管家便携版 - 核心计时状态机
纯逻辑模块，不依赖 Qt，方便单元测试。
状态：idle | working | short_break | long_break | paused
"""
from __future__ import annotations
import json
import os
from dataclasses import dataclass, field, asdict
from typing import Optional, Callable


DEFAULT_CONFIG = {
    "work_duration": 25,
    "short_break": 5,
    "long_break": 15,
    "long_break_interval": 4,
    "daily_goal": 8,
    "auto_start_break": True,
    "auto_start_work": False,
    "sound_enabled": True,
    "hotkey": "Ctrl+Alt+P",
    "auto_hide_ms": 800,
}


def _today_key() -> str:
    import datetime
    return datetime.date.today().isoformat()


@dataclass
class PomodoroConfig:
    work_duration: int = 25
    short_break: int = 5
    long_break: int = 15
    long_break_interval: int = 4
    daily_goal: int = 8
    auto_start_break: bool = True
    auto_start_work: bool = False
    sound_enabled: bool = True
    hotkey: str = "Ctrl+Alt+P"
    auto_hide_ms: int = 800

    @classmethod
    def from_dict(cls, d: dict) -> "PomodoroConfig":
        cfg = cls()
        for k, v in d.items():
            if hasattr(cfg, k):
                setattr(cfg, k, v)
        return cfg

    def to_dict(self) -> dict:
        return asdict(self)


PHASE_LABELS = {
    "idle": "准备就绪",
    "working": "专注中",
    "short_break": "短休息",
    "long_break": "长休息",
    "paused": "已暂停",
}

PHASE_COLORS = {
    "idle": "#8e8e93",
    "working": "#007aff",
    "short_break": "#34c759",
    "long_break": "#ff9500",
    "paused": "#8e8e93",
}


class PomodoroCore:
    """番茄钟核心状态机，纯逻辑、无 UI 依赖。"""

    def __init__(self, config: Optional[PomodoroConfig] = None, stats: Optional[dict] = None):
        self.config = config or PomodoroConfig()
        self.state = "idle"
        self.paused_state: Optional[str] = None
        self.remaining_ms = self._phase_duration_ms("working")
        self.cycle_count = 0
        self.completed_today = 0
        self.stats: dict = stats or {}
        self._load_today()

    def _phase_duration_ms(self, phase: str) -> int:
        m = {
            "working": self.config.work_duration,
            "short_break": self.config.short_break,
            "long_break": self.config.long_break,
        }.get(phase, self.config.work_duration)
        return int(m * 60 * 1000)

    def start(self) -> bool:
        if self.state == "idle":
            self.state = "working"
            self.remaining_ms = self._phase_duration_ms("working")
            return True
        if self.state == "paused":
            return self.resume()
        return False

    def pause(self) -> bool:
        if self.state in ("working", "short_break", "long_break"):
            self.paused_state = self.state
            self.state = "paused"
            return True
        return False

    def resume(self) -> bool:
        if self.state == "paused" and self.paused_state:
            self.state = self.paused_state
            self.paused_state = None
            return True
        return False

    def reset(self) -> None:
        if self.state in ("working", "short_break", "long_break"):
            self.remaining_ms = self._phase_duration_ms(self.state)
        elif self.state == "paused" and self.paused_state:
            self.remaining_ms = self._phase_duration_ms(self.paused_state)
        else:
            self.state = "idle"
            self.remaining_ms = self._phase_duration_ms("working")

    def skip(self) -> Optional[dict]:
        if self.state == "idle":
            return None
        return self._advance_phase(completed=False)

    def tick(self, seconds: float = 1.0) -> Optional[dict]:
        if self.state in ("idle", "paused"):
            return None
        self.remaining_ms -= int(seconds * 1000)
        if self.remaining_ms <= 0:
            self.remaining_ms = 0
            return self._advance_phase(completed=True)
        return None

    def _advance_phase(self, completed: bool) -> dict:
        event = {
            "completed_work": False,
            "next_phase": None,
            "remaining_ms": 0,
            "cycle_count": self.cycle_count,
            "completed_today": self.completed_today,
        }
        if self.state == "working":
            self.cycle_count += 1
            if completed:
                self.completed_today += 1
                self._record_work_session()
            if self.cycle_count % self.config.long_break_interval == 0:
                self.state = "long_break"
            else:
                self.state = "short_break"
            self.remaining_ms = self._phase_duration_ms(self.state)
            event["completed_work"] = completed
            event["next_phase"] = self.state
            event["remaining_ms"] = self.remaining_ms
            event["cycle_count"] = self.cycle_count
            event["completed_today"] = self.completed_today
            return event
        else:
            self.state = "working"
            self.remaining_ms = self._phase_duration_ms("working")
            event["next_phase"] = "working"
            event["remaining_ms"] = self.remaining_ms
            return event

    def _record_work_session(self) -> None:
        key = _today_key()
        s = self.stats.setdefault(key, {"work_sessions": 0, "total_minutes": 0})
        s["work_sessions"] += 1
        s["total_minutes"] += self.config.work_duration

    def _load_today(self) -> None:
        key = _today_key()
        s = self.stats.get(key, {"work_sessions": 0, "total_minutes": 0})
        self.completed_today = s.get("work_sessions", 0)
        self.stats[key] = s

    def today_stats(self) -> dict:
        return self.stats.get(_today_key(), {"work_sessions": 0, "total_minutes": 0})

    @property
    def phase_color(self) -> str:
        return PHASE_COLORS.get(self.state, "#8e8e93")

    @property
    def phase_label(self) -> str:
        return PHASE_LABELS.get(self.state, "准备就绪")

    @property
    def total_ms(self) -> int:
        if self.state == "paused" and self.paused_state:
            return self._phase_duration_ms(self.paused_state)
        return self._phase_duration_ms(self.state) if self.state != "idle" else self._phase_duration_ms("working")

    @property
    def progress(self) -> float:
        total = self.total_ms
        if total <= 0:
            return 0.0
        done = total - self.remaining_ms
        return max(0.0, min(1.0, done / total))

    @property
    def is_running(self) -> bool:
        return self.state in ("working", "short_break", "long_break")

    @property
    def is_paused(self) -> bool:
        return self.state == "paused"


class PomodoroStore:
    """简单的 JSON 持久化，存配置 + 统计。"""

    def __init__(self, path: str):
        self.path = path
        self.config = PomodoroConfig()
        self.stats: dict = {}
        self.load()

    def load(self) -> None:
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.config = PomodoroConfig.from_dict(data.get("config", {}))
            self.stats = data.get("stats", {})
        except (json.JSONDecodeError, OSError):
            pass

    def save(self, config: PomodoroConfig, stats: dict) -> None:
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        data = {"config": config.to_dict(), "stats": stats}
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)
