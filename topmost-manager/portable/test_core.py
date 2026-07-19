# -*- coding: utf-8 -*-
"""test_core.py —— 核心逻辑测试（store + win32_api 基本可用性）。

用 Python 标准库 unittest，不引入额外依赖。
运行：python test_core.py
"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

# 确保能 import 同目录模块
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import store
import win32_api


class TestStore(unittest.TestCase):
    """规则存储纯函数测试。"""

    def test_default_data(self):
        d = store.default_data()
        self.assertEqual(d, {"rules": [], "autoPin": False})

    def test_save_and_load(self):
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "rules.json")
            d = {"rules": [{"proc": "notepad.exe", "enabled": True}],
                 "autoPin": True}
            self.assertTrue(store.save(p, d))
            loaded = store.load(p)
            self.assertEqual(loaded["rules"], [{"proc": "notepad.exe",
                                                 "enabled": True}])
            self.assertTrue(loaded["autoPin"])

    def test_load_missing_file_returns_default(self):
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "nope.json")
            self.assertEqual(store.load(p), store.default_data())

    def test_load_invalid_json_returns_default(self):
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "bad.json")
            with open(p, "w", encoding="utf-8") as f:
                f.write("{not valid json")
            self.assertEqual(store.load(p), store.default_data())

    def test_load_normalizes_rules(self):
        """进程名应被小写化，enabled 缺失默认 True。"""
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "rules.json")
            with open(p, "w", encoding="utf-8") as f:
                import json
                json.dump({"rules": [
                    {"proc": "NOTEPAD.EXE"},
                    {"proc": "  Chrome.EXE ", "enabled": False},
                    {"proc": ""},
                    {"not_proc": "x"},
                ], "autoPin": "yes"}, f)
            d = store.load(p)
            procs = [r["proc"] for r in d["rules"]]
            self.assertIn("notepad.exe", procs)
            self.assertIn("chrome.exe", procs)
            self.assertNotIn("", procs)
            # autoPin 非布尔应回退到 False
            self.assertFalse(d["autoPin"])

    def test_add_rule_dedup(self):
        d = store.default_data()
        store.add_rule(d, "notepad.exe")
        store.add_rule(d, "NOTEPAD.EXE")  # 同名不应重复
        store.add_rule(d, "")
        self.assertEqual(len(d["rules"]), 1)
        self.assertEqual(d["rules"][0]["proc"], "notepad.exe")
        self.assertTrue(d["rules"][0]["enabled"])

    def test_remove_rule(self):
        d = store.default_data()
        store.add_rule(d, "notepad.exe")
        store.add_rule(d, "chrome.exe")
        store.remove_rule(d, "NOTEPAD.EXE")  # 大小写不敏感
        self.assertEqual(len(d["rules"]), 1)
        self.assertEqual(d["rules"][0]["proc"], "chrome.exe")

    def test_toggle_rule(self):
        d = store.default_data()
        store.add_rule(d, "notepad.exe")
        store.toggle_rule(d, "notepad.exe", False)
        self.assertFalse(d["rules"][0]["enabled"])
        store.toggle_rule(d, "NOTEPAD.exe", True)
        self.assertTrue(d["rules"][0]["enabled"])

    def test_matches_rule(self):
        d = store.default_data()
        store.add_rule(d, "notepad.exe")
        store.add_rule(d, "chrome.exe")
        store.toggle_rule(d, "chrome.exe", False)
        self.assertTrue(store.matches_rule(d, "notepad.exe"))
        self.assertTrue(store.matches_rule(d, "NOTEPAD.EXE"))  # 大小写
        self.assertFalse(store.matches_rule(d, "chrome.exe"))  # 已禁用
        self.assertFalse(store.matches_rule(d, "calc.exe"))    # 不在规则
        self.assertFalse(store.matches_rule(d, ""))

    def test_is_rule(self):
        d = store.default_data()
        store.add_rule(d, "notepad.exe")
        store.toggle_rule(d, "notepad.exe", False)
        # is_rule 不管启用状态
        self.assertTrue(store.is_rule(d, "notepad.exe"))
        self.assertFalse(store.is_rule(d, "chrome.exe"))


class TestWin32Api(unittest.TestCase):
    """Win32 API 封装基本可用性测试（不依赖具体窗口存在）。"""

    def test_list_windows_returns_list(self):
        """能跑通就行，至少当前有窗口（如本测试进程）。"""
        wins = win32_api.list_windows()
        self.assertIsInstance(wins, list)
        # 至少应该有窗口（除非真的什么都没开）
        # 不强断言数量，避免 CI 环境失败

    def test_list_windows_each_item_well_formed(self):
        wins = win32_api.list_windows()
        for w in wins:
            self.assertIsInstance(w.hwnd, int)
            self.assertIsInstance(w.pid, int)
            self.assertIsInstance(w.title, str)
            self.assertIsInstance(w.proc, str)
            self.assertIsInstance(w.topmost, bool)
            self.assertIsInstance(w.alpha, int)
            self.assertGreaterEqual(w.alpha, 0)
            self.assertLessEqual(w.alpha, 255)
            self.assertTrue(w.proc.endswith(".exe") or "." in w.proc or
                            w.proc != "")

    def test_get_foreground(self):
        fg = win32_api.get_foreground()
        # 可能是 None（没有前台窗口），但类型正确
        self.assertTrue(fg is None or isinstance(fg, int))

    def test_set_alpha_invalid_hwnd_returns_false_or_silent(self):
        """无效 hwnd 不应抛异常。"""
        try:
            win32_api.set_alpha(0, 50)
        except Exception as e:
            self.fail(f"set_alpha 不应抛异常: {e}")


class TestIcon(unittest.TestCase):
    """图标生成测试。"""

    def test_make_tray_icon(self):
        import icon
        img = icon.make_tray_icon(64)
        self.assertEqual(img.size, (64, 64))
        self.assertEqual(img.mode, "RGBA")

    def test_make_icon_file(self):
        import icon
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "icon.ico")
            icon.make_icon_file(p)
            self.assertTrue(os.path.exists(p))
            # 多尺寸 ICO（含 256x256）应 > 5KB
            self.assertGreater(os.path.getsize(p), 5000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
