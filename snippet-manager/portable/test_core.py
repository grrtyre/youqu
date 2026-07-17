# -*- coding: utf-8 -*-
"""
便携版核心逻辑测试 —— 不启动 GUI，只测试数据存储和高亮引擎
"""
import sys
import os
import json
import tempfile

# 添加 portable 目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from snippet_store import SnippetStore
from highlight import highlight, highlight_html

PASS = 0
FAIL = 0

def test(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name} {detail}")


def test_store():
    """测试数据存储引擎"""
    print("\n=== 数据存储引擎测试 ===")
    tmp = tempfile.mktemp(suffix=".json")

    store = SnippetStore(tmp)
    test("初始为空", store.count() == 0, f"count={store.count()}")

    # 注入示例
    seeded = store.seed_if_empty()
    test("注入示例数据", seeded, f"seeded={seeded}")
    test("示例数据数量", store.count() == 6, f"count={store.count()}")

    # 再次注入应返回 False
    seeded2 = store.seed_if_empty()
    test("重复注入返回False", not seeded2)

    # 列表排序：置顶在前
    items = store.list()
    test("列表非空", len(items) > 0)
    test("置顶在前", items[0].get("pinned") == True, f"first title={items[0].get('title')}")

    # 创建
    s = store.create(title="测试片段", language="python", content="print('hello')", tags=["test"])
    test("创建片段", s is not None and s["title"] == "测试片段")
    sid = s["id"]

    # 获取
    g = store.get(sid)
    test("获取片段", g is not None and g["title"] == "测试片段")

    # 更新
    u = store.update(sid, {"title": "更新后的标题"})
    test("更新片段", u is not None and u["title"] == "更新后的标题")

    # 切换收藏
    f = store.toggle_favorite(sid)
    test("切换收藏", f is not None and f["favorite"] == True)

    # 切换置顶
    p = store.toggle_pin(sid)
    test("切换置顶", p is not None and p["pinned"] == True)

    # 搜索
    results = store.search("防抖")
    test("搜索匹配", len(results) > 0, f"results={len(results)}")
    test("搜索标题匹配", any(r["title"] == "防抖函数 debounce" for r in results))

    # 多词搜索
    results2 = store.search("防抖 函数")
    test("多词AND搜索", len(results2) > 0)

    # 无匹配搜索
    results3 = store.search("xyznotexist")
    test("无匹配搜索", len(results3) == 0)

    # 语言统计
    langs = store.languages()
    test("语言统计", len(langs) > 0)
    test("包含javascript", any(l["language"] == "javascript" for l in langs))

    # 标签统计
    tags = store.tags()
    test("标签统计", len(tags) > 0)

    # 删除
    d = store.remove(sid)
    test("删除片段", d is not None)
    test("删除后count减少", store.count() == 6)

    # 导入导出
    exported = store.export_json()
    test("导出JSON", "snippets" in exported)
    parsed = json.loads(exported)
    test("导出数据有效", isinstance(parsed.get("snippets"), list))

    # 导入（合并模式）
    import_data = json.dumps({
        "version": 1,
        "snippets": [{"title": "导入的片段", "language": "go", "content": "fmt.Println()"}]
    })
    r = store.import_json(import_data, "merge")
    test("导入合并模式", r["count"] > 6)

    # 数据持久化
    store2 = SnippetStore(tmp)
    test("数据持久化", store2.count() == store.count())

    # 数据损坏恢复
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("INVALID JSON{{{")
    store3 = SnippetStore(tmp)
    test("数据损坏恢复", store3.count() == 0)

    # 原子写入后文件有效
    store3.create(title="原子写入测试", content="test")
    store4 = SnippetStore(tmp)
    test("原子写入有效", store4.count() == 1)

    # 清理
    try:
        os.unlink(tmp)
    except:
        pass
    # 清理备份文件
    for f in os.listdir(tempfile.gettempdir()):
        if f.startswith(os.path.basename(tmp)):
            try:
                os.unlink(os.path.join(tempfile.gettempdir(), f))
            except:
                pass


def test_highlight():
    """测试语法高亮"""
    print("\n=== 语法高亮测试 ===")

    # JavaScript 高亮
    js_code = 'const x = "hello"; // comment'
    result = highlight(js_code, "javascript")
    test("JS高亮非空", len(result) > 0)
    test("JS关键字高亮", "007aff" in result, "关键字应为蓝色")
    test("JS字符串高亮", "34c759" in result, "字符串应为绿色")
    test("JS注释高亮", "8e8e93" in result, "注释应为灰色")

    # Python 高亮
    py_code = 'def hello():\n    return True'
    result = highlight(py_code, "python")
    test("Python关键字高亮", "007aff" in result)

    # CSS 高亮
    css_code = '.center { display: flex; }'
    result = highlight(css_code, "css")
    test("CSS高亮非空", len(result) > 0)

    # HTML 转义
    html_code = '<div class="test">hello</div>'
    result = highlight(html_code, "html")
    test("HTML转义正确", "&lt;div" in result or "&lt;" in result)

    # 空代码
    test("空代码处理", highlight("", "javascript") == "")

    # HTML 包装
    wrapped = highlight_html("print('hi')", "python")
    test("HTML包装包含div", "<div" in wrapped)
    test("HTML包装包含font-family", "font-family" in wrapped)

    # 多语言不崩溃
    for lang in ["javascript", "python", "css", "bash", "sql", "go", "rust", "java", "json", "unknown"]:
        try:
            highlight("test code", lang)
            test(f"语言{lang}不崩溃", True)
        except Exception as e:
            test(f"语言{lang}不崩溃", False, str(e))


def main():
    print("=" * 50)
    print("代码片段管家 · 便携版 核心逻辑测试")
    print("=" * 50)

    test_store()
    test_highlight()

    print("\n" + "=" * 50)
    print(f"结果: {PASS} 通过, {FAIL} 失败")
    print("=" * 50)

    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    main()
