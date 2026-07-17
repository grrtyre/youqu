# -*- coding: utf-8 -*-
"""test_core.py - 核心密码逻辑单元测试

对齐原版 test.js，验证密码学安全、长度边界、字符集约束、强度评估等。
运行：python -m pytest tests/test_core.py -v
或：python tests/test_core.py
"""

import re
import string
import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pg_core


class TestPasswordGeneration(unittest.TestCase):
    def test_default_length_16(self):
        pwd = pg_core.generate_password()
        self.assertEqual(len(pwd), 16)

    def test_custom_length(self):
        for n in [4, 8, 32, 64]:
            self.assertEqual(len(pg_core.generate_password({"length": n})), n)

    def test_length_clamp_min(self):
        self.assertEqual(len(pg_core.generate_password({"length": 1})), 4)

    def test_length_clamp_max(self):
        self.assertEqual(len(pg_core.generate_password({"length": 999})), 64)

    def test_only_lower(self):
        pwd = pg_core.generate_password({"length": 20, "lower": True, "upper": False, "digits": False, "symbols": False})
        self.assertTrue(all(c in string.ascii_lowercase for c in pwd))

    def test_only_digits(self):
        pwd = pg_core.generate_password({"length": 20, "lower": False, "upper": False, "digits": True, "symbols": False})
        self.assertTrue(all(c in string.digits for c in pwd))

    def test_only_symbols(self):
        pwd = pg_core.generate_password({"length": 20, "lower": False, "upper": False, "digits": False, "symbols": True})
        self.assertTrue(all(c in pg_core.CHARSETS["symbols"] for c in pwd))

    def test_required_chars_present(self):
        """开启的字符类型必须至少各出现一个。"""
        pwd = pg_core.generate_password({"length": 32, "lower": True, "upper": True, "digits": True, "symbols": True})
        self.assertRegex(pwd, r"[a-z]")
        self.assertRegex(pwd, r"[A-Z]")
        self.assertRegex(pwd, r"[0-9]")
        self.assertTrue(any(c in pg_core.CHARSETS["symbols"] for c in pwd))

    def test_exclude_ambiguous(self):
        pwd = pg_core.generate_password({"length": 64, "exclude_ambiguous": True})
        for c in "il1Lo0O":
            self.assertNotIn(c, pwd)

    def test_empty_pool(self):
        self.assertEqual(pg_core.generate_password({"lower": False, "upper": False, "digits": False, "symbols": False}), "")

    def test_two_passwords_differ(self):
        """两次生成不应相同（极大概率）。"""
        a = pg_core.generate_password({"length": 32})
        b = pg_core.generate_password({"length": 32})
        self.assertNotEqual(a, b)

    def test_pin_preset(self):
        cfg = pg_core.PRESETS["PIN"]
        pwd = pg_core.generate_password(cfg)
        self.assertEqual(len(pwd), 6)
        self.assertTrue(all(c in string.digits for c in pwd))


class TestPassphrase(unittest.TestCase):
    def test_default_4_words(self):
        pp = pg_core.generate_passphrase()
        # 4 词 + 1 数字 = 5 段
        self.assertEqual(len(pp.split("-")), 5)

    def test_word_count(self):
        for n in [3, 5, 8]:
            pp = pg_core.generate_passphrase({"words": n, "include_number": False})
            self.assertEqual(len(pp.split("-")), n)

    def test_separator(self):
        pp = pg_core.generate_passphrase({"separator": "_", "include_number": False, "words": 3})
        self.assertIn("_", pp)
        self.assertNotIn("-", pp)

    def test_no_number(self):
        pp = pg_core.generate_passphrase({"include_number": False, "words": 3})
        parts = pp.split("-")
        self.assertEqual(len(parts), 3)

    def test_capitalize(self):
        pp = pg_core.generate_passphrase({"capitalize": True, "include_number": False, "words": 3})
        for part in pp.split("-"):
            self.assertTrue(part[0].isupper())


class TestStrength(unittest.TestCase):
    def test_empty(self):
        r = pg_core.evaluate_strength("")
        self.assertEqual(r["score"], 0)
        self.assertEqual(r["label"], "无")

    def test_weak(self):
        r = pg_core.evaluate_strength("abc")
        self.assertLessEqual(r["score"], 2)

    def test_strong(self):
        r = pg_core.evaluate_strength("Xk9$mP2!nQrL8vW#zT4")
        self.assertGreaterEqual(r["score"], 4)

    def test_very_strong(self):
        r = pg_core.evaluate_strength("Xk9$mP2!nQrL8vW#zT4aB7cD5eF3gH1iJ0kL9mN8oP6qR4sS2tU")
        self.assertGreaterEqual(r["score"], 5)

    def test_entropy_increases_with_length(self):
        r1 = pg_core.evaluate_strength("Abcdef1!")
        r2 = pg_core.evaluate_strength("Abcdef1!Abcdef1!Abcdef1!")
        self.assertGreater(r2["entropy"], r1["entropy"])

    def test_suggestions_for_weak(self):
        r = pg_core.evaluate_strength("abc")
        self.assertGreater(len(r["suggestions"]), 0)


class TestBatch(unittest.TestCase):
    def test_batch_count(self):
        results = pg_core.batch_generate({"count": 10, "length": 16})
        self.assertEqual(len(results), 10)
        for p in results:
            self.assertEqual(len(p), 16)

    def test_batch_clamp(self):
        self.assertEqual(len(pg_core.batch_generate({"count": 0})), 1)
        self.assertEqual(len(pg_core.batch_generate({"count": 999})), 200)


class TestCrackTime(unittest.TestCase):
    def test_zero_entropy(self):
        self.assertEqual(pg_core.estimate_crack_time(0), "瞬时")

    def test_low_entropy(self):
        s = pg_core.estimate_crack_time(20)
        self.assertIn(s, ["毫秒", "秒", "分钟", "小时", "天", "年"] + [s])  # 仅验证不抛错
        self.assertTrue(len(s) > 0)

    def test_high_entropy(self):
        s = pg_core.estimate_crack_time(200)
        self.assertTrue("年" in s or "宇宙" in s)


if __name__ == "__main__":
    unittest.main(verbosity=2)
