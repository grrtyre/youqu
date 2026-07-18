# -*- coding: utf-8 -*-
"""核心逻辑测试 —— 翻译引擎纯函数 + 数据存储。
不依赖 GUI，可在纯命令行环境运行。
运行：python test_core.py
"""
import os
import sys
import json
import tempfile

# 把当前目录加入 import 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import engine
import store


def test_google_url_building():
    """测试 Google gtx URL 构造。"""
    url = engine.build_google_url("auto", "zh", "hello")
    assert "client=gtx" in url
    assert "sl=auto" in url
    assert "tl=zh" in url
    assert "q=hello" in url
    print("✓ Google URL 构造正确")


def test_google_parse():
    """测试 Google gtx 响应解析（用真实响应样例）。"""
    # Google gtx 实际响应格式：[[["你好","hello",null,null,1]],null,"en",...]
    sample = '[[["你好","hello",null,null,1]],null,"en",[],"en",null,[[]],[[1]],[]]'
    result = engine.parse_google_response(sample)
    assert result is not None
    assert result["text"] == "你好"
    assert result["detectedSource"] == "en"
    print("✓ Google 响应解析正确")


def test_google_parse_empty():
    """测试 Google gtx 空响应解析。"""
    assert engine.parse_google_response("") is None
    assert engine.parse_google_response("not json") is None
    assert engine.parse_google_response("[]") is None
    print("✓ Google 空响应正确返回 None")


def test_mymemory_url():
    """测试 MyMemory URL 构造。"""
    url = engine.build_mymemory_url("en", "zh", "hello")
    assert "langpair=en%7Czh" in url or "langpair=en|zh" in url
    assert "q=hello" in url
    print("✓ MyMemory URL 构造正确")


def test_mymemory_parse():
    """测试 MyMemory 响应解析。"""
    sample = json.dumps({
        "responseData": {"translatedText": "你好"},
        "responseStatus": 200,
    })
    result = engine.parse_mymemory_response(sample)
    assert result is not None
    assert result["text"] == "你好"
    print("✓ MyMemory 响应解析正确")


def test_mymemory_parse_warning():
    """测试 MyMemory 错误信息过滤。"""
    sample = json.dumps({
        "responseData": {"translatedText": "MYMEMORY WARNING: blah"},
    })
    assert engine.parse_mymemory_response(sample) is None
    print("✓ MyMemory 错误信息正确过滤")


def test_lang_detection():
    """测试启发式源语言检测。"""
    assert engine._detect_lang_heuristic("hello world") == "en"
    assert engine._detect_lang_heuristic("你好世界") == "zh"
    print("✓ 启发式语言检测正确")


def test_lang_name():
    """测试语言代码转中文名。"""
    assert engine.lang_name("zh") == "中文"
    assert engine.lang_name("en") == "英语"
    assert engine.lang_name("auto") == "自动检测"
    assert engine.lang_name("xx") == "XX"
    print("✓ 语言名称转换正确")


def test_languages_list():
    """测试语言列表完整性。"""
    codes = [c for c, _ in engine.LANGUAGES]
    assert "auto" in codes
    assert "zh" in codes
    assert "en" in codes
    assert "ja" in codes
    assert len(codes) == 20
    target_codes = [c for c, _ in engine.TARGET_LANGUAGES]
    assert "auto" not in target_codes
    print(f"✓ 语言列表完整（共 {len(codes)} 种）")


def test_store_default():
    """测试默认数据结构。"""
    s = store.DEFAULT_STORE
    assert "history" in s
    assert "settings" in s
    assert s["settings"]["from"] == "auto"
    assert s["settings"]["to"] == "zh"
    print("✓ 默认数据结构正确")


def test_store_load_save():
    """测试存储读写。"""
    # 用临时文件
    with tempfile.TemporaryDirectory() as tmpdir:
        # monkey-patch data_file
        orig_data_file = store.data_file
        orig_data_dir = store.data_dir
        store.data_dir = lambda: tmpdir
        store.data_file = lambda: os.path.join(tmpdir, "data.json")

        try:
            # 加载（默认）
            s = store.load_store()
            assert s["settings"]["from"] == "auto"

            # 修改后保存
            store.update_settings(s, from_lang="en", to="zh")
            store.save_store(s)

            # 重新加载
            s2 = store.load_store()
            # 注意：update_settings 接受 **kwargs，原 key 是 "from" 不是 "from_lang"
            # 但 update_settings 会把 from_lang 当成新 key 添加。这里测试实际的 from/to：
            assert s2["settings"]["from"] == "auto"  # 我们传错了参数名
            # 用正确参数名重测
            store.update_settings(s2, **{"from": "en", "to": "ja"})
            store.save_store(s2)
            s3 = store.load_store()
            assert s3["settings"]["from"] == "en"
            assert s3["settings"]["to"] == "ja"
            print("✓ 存储读写正确")
        finally:
            store.data_file = orig_data_file
            store.data_dir = orig_data_dir


def test_store_history():
    """测试历史记录增删。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        orig_data_file = store.data_file
        orig_data_dir = store.data_dir
        store.data_dir = lambda: tmpdir
        store.data_file = lambda: os.path.join(tmpdir, "data.json")

        try:
            s = store.load_store()
            # 添加历史
            store.add_history(s, "hello", "你好", "en", "zh", detected="en", engine="google")
            store.add_history(s, "world", "世界", "en", "zh", detected="en", engine="google")
            assert len(s["history"]) == 2
            # 最新在前
            assert s["history"][0]["src"] == "world"

            # 去重：再次添加相同项
            store.add_history(s, "hello", "你好", "en", "zh", detected="en", engine="google")
            assert len(s["history"]) == 2  # 仍然 2 条
            assert s["history"][0]["src"] == "hello"  # 被提到最前

            # 清空
            store.clear_history(s)
            assert len(s["history"]) == 0
            print("✓ 历史记录增删正确")
        finally:
            store.data_file = orig_data_file
            store.data_dir = orig_data_dir


def test_store_history_max():
    """测试历史记录最大数量限制。"""
    with tempfile.TemporaryDirectory() as tmpdir:
        orig_data_file = store.data_file
        orig_data_dir = store.data_dir
        store.data_dir = lambda: tmpdir
        store.data_file = lambda: os.path.join(tmpdir, "data.json")

        try:
            s = store.load_store()
            # 添加 110 条
            for i in range(110):
                store.add_history(s, f"src{i}", f"tgt{i}", "en", "zh")
            assert len(s["history"]) == store.MAX_HISTORY  # 100
            # 最前面的是最后添加的
            assert s["history"][0]["src"] == "src109"
            print(f"✓ 历史记录限制正确（保留 {store.MAX_HISTORY} 条）")
        finally:
            store.data_file = orig_data_file
            store.data_dir = orig_data_dir


def main():
    tests = [
        test_google_url_building,
        test_google_parse,
        test_google_parse_empty,
        test_mymemory_url,
        test_mymemory_parse,
        test_mymemory_parse_warning,
        test_lang_detection,
        test_lang_name,
        test_languages_list,
        test_store_default,
        test_store_load_save,
        test_store_history,
        test_store_history_max,
    ]
    failed = 0
    for t in tests:
        try:
            t()
        except Exception as e:
            failed += 1
            print(f"✗ {t.__name__} 失败: {e}")
    if failed:
        print(f"\n{failed} 个测试失败")
        sys.exit(1)
    else:
        print(f"\n全部 {len(tests)} 个测试通过 ✓")


if __name__ == "__main__":
    main()
