# -*- coding: utf-8 -*-
"""剪贴板管家·便携版 - 核心逻辑单元测试"""

import os
import sys
import json
import time
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from clipboard_core import (
    classify, ClipboardItem, ClipboardStore, relative_time,
    MAX_TEXT_ITEMS,
)


class TestClassify(unittest.TestCase):
    """内容分类测试。"""

    def test_link_http(self):
        self.assertEqual(classify("https://example.com"), "link")

    def test_link_www(self):
        self.assertEqual(classify("www.google.com"), "link")

    def test_link_ftp(self):
        self.assertEqual(classify("ftp://server/file"), "link")

    def test_email(self):
        self.assertEqual(classify("user@example.com"), "email")

    def test_email_simple(self):
        self.assertEqual(classify("a.b@c.org"), "email")

    def test_phone(self):
        self.assertEqual(classify("13800138000"), "phone")

    def test_phone_with_dash(self):
        self.assertEqual(classify("010-12345678"), "phone")

    def test_phone_with_plus(self):
        self.assertEqual(classify("+86 138 0013 8000"), "phone")

    def test_code_python(self):
        self.assertEqual(classify("def hello():\n    print('hi')"), "code")

    def test_code_js(self):
        self.assertEqual(classify("const x = 1;\nfunction foo() {}"), "code")

    def test_code_indented(self):
        self.assertEqual(classify("line1\n    indented code\n    more code"), "code")

    def test_text_plain(self):
        self.assertEqual(classify("你好世界"), "text")

    def test_text_multiline(self):
        self.assertEqual(classify("第一行\n第二行\n第三行"), "text")

    def test_empty(self):
        self.assertEqual(classify(""), "text")

    def test_whitespace(self):
        self.assertEqual(classify("   "), "text")


class TestClipboardItem(unittest.TestCase):
    """数据结构测试。"""

    def test_preview_short(self):
        item = ClipboardItem(content="hello")
        self.assertEqual(item.preview(), "hello")

    def test_preview_long(self):
        content = "x" * 200
        item = ClipboardItem(content=content)
        self.assertTrue(item.preview().endswith("…"))
        self.assertEqual(len(item.preview()), 121)  # 120 + ellipsis

    def test_preview_multiline(self):
        item = ClipboardItem(content="line1\nline2\nline3")
        self.assertEqual(item.preview(), "line1 line2 line3")

    def test_to_dict_from_dict_roundtrip(self):
        item = ClipboardItem(content="test", kind="code", pinned=True, favorite=True)
        d = item.to_dict()
        item2 = ClipboardItem.from_dict(d)
        self.assertEqual(item2.content, "test")
        self.assertEqual(item2.kind, "code")
        self.assertTrue(item2.pinned)
        self.assertTrue(item2.favorite)

    def test_from_dict_missing_fields(self):
        item = ClipboardItem.from_dict({"content": "hi"})
        self.assertEqual(item.content, "hi")
        self.assertEqual(item.kind, "text")
        self.assertFalse(item.pinned)


class TestClipboardStore(unittest.TestCase):
    """存储管理测试。"""

    def setUp(self):
        self.store = ClipboardStore(max_items=10)

    def test_add_new(self):
        item = self.store.add("hello")
        self.assertIsNotNone(item)
        self.assertEqual(self.store.count(), 1)

    def test_add_empty(self):
        item = self.store.add("")
        self.assertIsNone(item)
        self.assertEqual(self.store.count(), 0)

    def test_add_whitespace(self):
        item = self.store.add("   \n  ")
        self.assertIsNone(item)

    def test_dedup(self):
        self.store.add("hello")
        self.store.add("hello")
        self.assertEqual(self.store.count(), 1)

    def test_dedup_updates_timestamp(self):
        item1 = self.store.add("hello")
        time.sleep(0.05)
        item2 = self.store.add("hello")
        self.assertEqual(item1.id, item2.id)
        self.assertGreaterEqual(item2.timestamp, item1.timestamp)

    def test_dedup_strips_whitespace(self):
        self.store.add("hello")
        result = self.store.add("  hello  ")
        self.assertEqual(self.store.count(), 1)

    def test_remove(self):
        item = self.store.add("hello")
        self.assertTrue(self.store.remove(item.id))
        self.assertEqual(self.store.count(), 0)

    def test_remove_nonexistent(self):
        self.assertFalse(self.store.remove("nonexistent"))

    def test_clear_preserves_pinned(self):
        item1 = self.store.add("normal")
        item2 = self.store.add("pinned")
        self.store.toggle_pin(item2.id)
        removed = self.store.clear()
        self.assertEqual(removed, 1)
        self.assertEqual(self.store.count(), 1)
        self.assertEqual(self.store.items[0].content, "pinned")

    def test_clear_preserves_favorite(self):
        item1 = self.store.add("normal")
        item2 = self.store.add("favorite")
        self.store.toggle_favorite(item2.id)
        removed = self.store.clear()
        self.assertEqual(removed, 1)
        self.assertEqual(self.store.count(), 1)

    def test_toggle_pin(self):
        item = self.store.add("hello")
        self.store.toggle_pin(item.id)
        self.assertTrue(self.store.get_by_id(item.id).pinned)
        self.store.toggle_pin(item.id)
        self.assertFalse(self.store.get_by_id(item.id).pinned)

    def test_toggle_favorite(self):
        item = self.store.add("hello")
        self.store.toggle_favorite(item.id)
        self.assertTrue(self.store.get_by_id(item.id).favorite)

    def test_pin_moves_to_top(self):
        item1 = self.store.add("first")
        item2 = self.store.add("second")
        item3 = self.store.add("third")
        # 置顶 item1
        self.store.toggle_pin(item1.id)
        # item1 应在最前
        self.assertEqual(self.store.items[0].id, item1.id)

    def test_pin_order(self):
        a = self.store.add("a")
        b = self.store.add("b")
        c = self.store.add("c")
        # 置顶 a, c -> 置顶区顺序 a, c
        self.store.toggle_pin(a.id)
        self.store.toggle_pin(c.id)
        self.assertEqual(self.store.items[0].id, a.id)
        self.assertEqual(self.store.items[1].id, c.id)

    def test_max_items_limit(self):
        store = ClipboardStore(max_items=5)
        for i in range(10):
            store.add(f"item-{i}")
        self.assertEqual(store.count(), 5)

    def test_max_items_preserves_pinned(self):
        store = ClipboardStore(max_items=5)
        # 填满
        for i in range(5):
            store.add(f"item-{i}")
        # 置顶第一个
        first = store.items[-1]  # 最旧的
        store.toggle_pin(first.id)
        # 再添加超出上限
        for i in range(5, 10):
            store.add(f"new-{i}")
        # 置顶项应该还在
        self.assertIsNotNone(store.get_by_id(first.id))

    def test_search_keyword(self):
        self.store.add("hello world")
        self.store.add("goodbye world")
        self.store.add("hello python")
        results = self.store.search("hello")
        self.assertEqual(len(results), 2)

    def test_search_case_insensitive(self):
        self.store.add("Hello World")
        results = self.store.search("hello")
        self.assertEqual(len(results), 1)

    def test_search_filter_kind(self):
        self.store.add("https://example.com")
        self.store.add("hello world")
        results = self.store.search("", kind_filter="link")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].kind, "link")

    def test_search_filter_favorite(self):
        item = self.store.add("hello")
        self.store.toggle_favorite(item.id)
        self.store.add("world")
        results = self.store.search("", kind_filter="favorite")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].content, "hello")

    def test_search_empty_keyword(self):
        self.store.add("a")
        self.store.add("b")
        results = self.store.search("")
        self.assertEqual(len(results), 2)

    def test_search_no_match(self):
        self.store.add("hello")
        results = self.store.search("xyz")
        self.assertEqual(len(results), 0)

    def test_save_load(self):
        self.store.add("hello")
        self.store.add("world")
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            path = f.name
        try:
            self.store.save(path)
            store2 = ClipboardStore()
            store2.load(path)
            self.assertEqual(store2.count(), 2)
            self.assertEqual(store2.items[0].content, "world")
        finally:
            os.unlink(path)

    def test_load_nonexistent(self):
        store = ClipboardStore()
        store.load("/nonexistent/path.json")
        self.assertEqual(store.count(), 0)

    def test_load_corrupt(self):
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            f.write("not valid json{{{")
            path = f.name
        try:
            store = ClipboardStore()
            store.load(path)
            self.assertEqual(store.count(), 0)
        finally:
            os.unlink(path)


class TestRelativeTime(unittest.TestCase):
    """相对时间测试。"""

    def test_just_now(self):
        now = time.time()
        self.assertEqual(relative_time(now, now), "刚刚")

    def test_minutes_ago(self):
        now = time.time()
        self.assertEqual(relative_time(now - 180, now), "3 分钟前")

    def test_hours_ago(self):
        now = time.time()
        self.assertEqual(relative_time(now - 7200, now), "2 小时前")

    def test_days_ago(self):
        now = time.time()
        self.assertEqual(relative_time(now - 86400 * 3, now), "3 天前")

    def test_future_returns_just_now(self):
        now = time.time()
        self.assertEqual(relative_time(now + 100, now), "刚刚")


if __name__ == "__main__":
    unittest.main(verbosity=2)
