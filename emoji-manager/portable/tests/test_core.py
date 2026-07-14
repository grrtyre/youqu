# -*- coding: utf-8 -*-
"""tests/test_core.py — emoji 核心逻辑单元测试
运行：python -m pytest tests/test_core.py -v
或：python tests/test_core.py
"""
import os
import sys

# 让 tests 目录能 import 到 src
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

import emoji_core as core  # noqa: E402
import store as store_mod  # noqa: E402
import emoji_data  # noqa: E402


def test_categories_loaded():
    cats = core.list_categories()
    assert len(cats) == 11, f"应有 11 个分类，实际 {len(cats)}"
    ids = {c["id"] for c in cats}
    expected = {"smileys", "gestures", "animals", "food", "activities", "travel",
                "objects", "symbols", "flags", "kao", "special"}
    assert expected.issubset(ids), f"缺少分类：{expected - ids}"


def test_total_emoji_count():
    all_emojis = emoji_data.get_all_emojis()
    assert len(all_emojis) >= 1200, f"emoji 总数应 ≥1200，实际 {len(all_emojis)}"
    # 每个条目必有 c/n 字段
    for e in all_emojis[:50]:
        assert "c" in e and e["c"], f"条目缺少字符字段：{e}"
        assert "n" in e and e["n"], f"条目缺少名称字段：{e}"


def test_search_by_chinese_name():
    results = core.search("猫")
    assert any(e["n"] == "猫脸" or "猫" in e["n"] for e in results), "应能搜到猫相关"
    assert len(results) >= 1


def test_search_by_keyword():
    # "开心" 是多个 emoji 的关键词
    results = core.search("开心")
    assert len(results) >= 2, f"开心关键词至少命中多个，实际 {len(results)}"


def test_search_by_character():
    results = core.search("😀")
    assert any(e["c"] == "😀" for e in results), "应能按字符搜到 😀"


def test_search_empty_returns_empty():
    assert core.search("") == []
    assert core.search("   ") == []


def test_search_case_insensitive():
    # 关键词字段含 "happy"（小写）
    results = core.search("HAPPY")
    assert len(results) >= 1, "搜索应不区分大小写"


def test_filter_by_category():
    food = core.filter_by_category("food")
    assert len(food) > 0
    assert all(e["cat"] == "food" for e in food), "filter_by_category 结果应都属于该分类"


def test_filter_all():
    all_items = core.filter_by_category("all")
    assert len(all_items) == len(emoji_data.get_all_emojis())


def test_dedupe_preserve_order():
    a = [{"c": "1"}, {"c": "2"}, {"c": "1"}, {"c": "3"}, {"c": "2"}]
    out = core.dedupe_preserve_order(a)
    assert [x["c"] for x in out] == ["1", "2", "3"]


def test_merge_results_favorites_first():
    fav = [{"c": "A", "n": "a"}]
    hist = [{"c": "B", "n": "b"}, {"c": "A", "n": "a"}]  # A 重复
    searched = [{"c": "C", "n": "c"}]
    out = core.merge_results(fav, hist, searched)
    chars = [x["c"] for x in out]
    assert chars == ["A", "B", "C"], f"合并应去重且收藏优先：{chars}"


def test_store_toggle_favorite(tmp_path):
    p = tmp_path / "data.json"
    s = store_mod.EmojiStore(str(p))
    item = {"c": "😀", "n": "笑脸", "k": "开心", "cat": "smileys", "catName": "笑脸表情"}
    # 加入收藏
    assert s.toggle_favorite(item) is True
    assert s.is_favorite("😀")
    favs = s.get_favorites()
    assert len(favs) == 1 and favs[0]["c"] == "😀"
    # 再次切换：取消
    assert s.toggle_favorite(item) is False
    assert not s.is_favorite("😀")
    assert s.get_favorites() == []


def test_store_history_dedup_and_limit(tmp_path):
    p = tmp_path / "h.json"
    s = store_mod.EmojiStore(str(p))
    s.add_history({"c": "A"})
    s.add_history({"c": "B"})
    s.add_history({"c": "A"})  # 重复，应移到队首
    hist = s.get_history()
    assert [h["c"] for h in hist] == ["A", "B"], f"重复项应移到队首：{[h['c'] for h in hist]}"
    # 历史上限
    for i in range(80):
        s.add_history({"c": f"X{i}"})
    assert len(s.get_history()) == 50


def test_store_persistence(tmp_path):
    p = tmp_path / "p.json"
    s1 = store_mod.EmojiStore(str(p))
    s1.toggle_favorite({"c": "Z", "n": "z", "k": "", "cat": "", "catName": ""})
    s1.add_history({"c": "Z", "n": "z", "k": "", "cat": "", "catName": ""})
    # 新实例读同一文件
    s2 = store_mod.EmojiStore(str(p))
    assert s2.is_favorite("Z")
    assert len(s2.get_history()) == 1


if __name__ == "__main__":
    # 直接运行：执行所有 test_ 函数
    failed = 0
    passed = 0
    import traceback
    from pathlib import Path
    g = dict(globals())
    for name, fn in list(g.items()):
        if name.startswith("test_") and callable(fn):
            try:
                # 简易 tmp_path 替换（用 pathlib.Path 兼容 / 操作符）
                import tempfile
                fn(Path(tempfile.mkdtemp())) if "tmp_path" in fn.__code__.co_varnames else fn()
                passed += 1
                print(f"  ✓ {name}")
            except Exception as e:
                failed += 1
                print(f"  ✗ {name}: {e}")
                traceback.print_exc()
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
