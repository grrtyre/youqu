# -*- coding: utf-8 -*-
"""番茄管家便携版 - 核心状态机单元测试"""
from __future__ import annotations
import os
import sys
import json
import tempfile
import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pomodoro_core import (
    PomodoroCore, PomodoroConfig, PomodoroStore,
    PHASE_COLORS, PHASE_LABELS,
)


def make_core(**overrides) -> PomodoroCore:
    cfg = PomodoroConfig(**overrides) if overrides else PomodoroConfig()
    return PomodoroCore(cfg, stats={})


def test_initial_state():
    c = make_core()
    assert c.state == "idle"
    assert c.remaining_ms == 25 * 60 * 1000
    assert c.cycle_count == 0
    assert c.completed_today == 0
    assert not c.is_running
    assert not c.is_paused
    print("[OK] initial_state")


def test_start_and_tick():
    c = make_core(work_duration=1)
    assert c.start()
    assert c.state == "working"
    before = c.remaining_ms
    c.tick(1.0)
    assert c.remaining_ms == before - 1000
    print("[OK] start_and_tick")


def test_phase_advance():
    c = make_core(work_duration=1, auto_start_break=True)
    c.start()
    event = None
    for _ in range(70):
        event = c.tick(1.0)
        if event:
            break
    assert event is not None
    assert event["next_phase"] == "short_break"
    assert c.state == "short_break"
    assert c.cycle_count == 1
    print("[OK] phase_advance")


def test_pause_resume():
    c = make_core()
    c.start()
    assert c.pause()
    assert c.state == "paused"
    assert c.resume()
    assert c.state == "working"
    print("[OK] pause_resume")


def test_skip():
    c = make_core()
    c.start()
    e1 = c.skip()
    assert e1["next_phase"] == "short_break"
    assert c.state == "short_break"
    assert c.cycle_count == 1
    e2 = c.skip()
    assert e2["next_phase"] == "working"
    print("[OK] skip")


def test_long_break_branch():
    c = make_core(long_break_interval=4)
    c.start()
    c.skip(); c.skip(); c.skip(); c.skip(); c.skip(); c.skip(); c.skip()
    assert c.state == "long_break"
    assert c.cycle_count == 4
    print("[OK] long_break_branch")


def test_reset():
    c = make_core(work_duration=25)
    c.start()
    for _ in range(10):
        c.tick(1.0)
    c.reset()
    assert c.remaining_ms == 25 * 60 * 1000
    assert c.state == "working"
    print("[OK] reset")


def test_stats_persistence():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "data.json")
        s1 = PomodoroStore(path)
        s1.config.work_duration = 30
        s1.stats = {datetime.date.today().isoformat(): {"work_sessions": 3, "total_minutes": 90}}
        s1.save(s1.config, s1.stats)
        s2 = PomodoroStore(path)
        assert s2.config.work_duration == 30
        key = datetime.date.today().isoformat()
        assert s2.stats.get(key, {}).get("work_sessions") == 3
    print("[OK] stats_persistence")


def test_progress_color():
    c = make_core()
    c.start()
    assert 0.0 <= c.progress <= 1.0
    assert c.phase_color == PHASE_COLORS["working"]
    c.pause()
    assert c.phase_color == PHASE_COLORS["paused"]
    print("[OK] progress_color")


def run_all():
    print("=" * 50)
    print("番茄管家便携版 - 核心逻辑测试")
    print("=" * 50)
    test_initial_state()
    test_start_and_tick()
    test_phase_advance()
    test_pause_resume()
    test_skip()
    test_long_break_branch()
    test_reset()
    test_stats_persistence()
    test_progress_color()
    print("=" * 50)
    print("ALL TESTS PASSED")
    print("=" * 50)


if __name__ == "__main__":
    run_all()
