# -*- coding: utf-8 -*-
"""便签管家便携版 - 数据层测试
验证 note_store.py 的所有核心函数
"""

import os
import sys
import json
import tempfile
import time

# 让脚本能找到 portable 目录下的模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import note_store as ns


PASS = 0
FAIL = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        print(f"  ✗ {name} {detail}")


def test_constants() -> None:
    print("\n[1] 常量")
    check("COLORS 7 种", len(ns.COLORS) == 7, f"got {len(ns.COLORS)}")
    check("CATEGORIES 5 类", len(ns.CATEGORIES) == 5, f"got {len(ns.CATEGORIES)}")
    check("TRASH_MAX_DAYS = 30", ns.TRASH_MAX_DAYS == 30)
    check("默认颜色存在", "default" in ns.COLORS)
    check("蓝色 hex 正确", ns.COLORS["blue"]["dot"] == "#007aff")


def test_create_note() -> None:
    print("\n[2] 创建便签")
    n = ns.create_note({"title": "测试", "content": "内容"})
    check("有 id", n["id"].startswith("n_"))
    check("标题正确", n["title"] == "测试")
    check("内容正确", n["content"] == "内容")
    check("默认颜色", n["color"] == "default")
    check("默认分类", n["category"] == "其他")
    check("默认不置顶", n["pinned"] is False)
    check("有 createdAt", n["createdAt"] > 0)
    check("有 updatedAt", n["updatedAt"] > 0)

    # 无效数据兜底
    n2 = ns.create_note({"color": "invalid", "category": "不存在"})
    check("无效颜色兜底", n2["color"] == "default")
    check("无效分类兜底", n2["category"] == "其他")

    # 空数据
    n3 = ns.create_note()
    check("空数据有 id", n3["id"].startswith("n_"))
    check("空数据标题为空串", n3["title"] == "")


def test_load_save() -> None:
    print("\n[3] 加载/保存")
    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, "notes.json")
        data = ns.load_all(path)
        check("空路径无便签", data["notes"] == [])
        check("空路径无回收站", data["trash"] == [])

        # 保存
        notes, _ = ns.add_note([], {"title": "第一条", "content": "hello"})
        ns.save_all(notes, [], path)
        check("文件已创建", os.path.exists(path))

        # 重新加载
        data2 = ns.load_all(path)
        check("加载 1 条", len(data2["notes"]) == 1)
        check("标题正确", data2["notes"][0]["title"] == "第一条")

        # 损坏文件兜底
        with open(path, "w", encoding="utf-8") as f:
            f.write("not json")
        data3 = ns.load_all(path)
        check("损坏文件兜底", data3["notes"] == [])


def test_crud() -> None:
    print("\n[4] CRUD 操作")
    notes, n1 = ns.add_note([], {"title": "A"})
    notes, n2 = ns.add_note(notes, {"title": "B"})
    check("新增后 2 条", len(notes) == 2)
    check("B 在最前", notes[0]["title"] == "B")

    # 更新
    notes, updated = ns.update_note(notes, n1["id"], {"content": "updated"})
    check("更新成功", updated is not None)
    check("更新内容正确", updated["content"] == "updated")
    check("更新时间变化", updated["updatedAt"] >= n1["updatedAt"])

    # 置顶
    notes, pinned = ns.toggle_pin(notes, n1["id"])
    check("置顶成功", pinned["pinned"] is True)
    notes, unpinned = ns.toggle_pin(notes, n1["id"])
    check("取消置顶", unpinned["pinned"] is False)


def test_trash() -> None:
    print("\n[5] 回收站")
    notes, n1 = ns.add_note([], {"title": "A"})
    notes, n2 = ns.add_note(notes, {"title": "B"})
    trash = []

    # 移入回收站
    notes, trash, trashed = ns.move_to_trash(notes, trash, n1["id"])
    check("移入后剩 1 条", len(notes) == 1)
    check("回收站 1 条", len(trash) == 1)
    check("有 deletedAt", trashed["deletedAt"] > 0)

    # 恢复
    notes, trash, restored = ns.restore_note(trash, notes, n1["id"])
    check("恢复后 2 条", len(notes) == 2)
    check("回收站为空", len(trash) == 0)
    check("恢复后无 deletedAt", "deletedAt" not in restored)

    # 彻底删除
    notes, trash, _ = ns.move_to_trash(notes, trash, n1["id"])
    trash = ns.delete_from_trash(trash, n1["id"])
    check("彻底删除后回收站空", len(trash) == 0)

    # 清空回收站
    notes, trash, _ = ns.move_to_trash(notes, trash, n2["id"])
    trash = ns.empty_trash(trash)
    check("清空回收站", len(trash) == 0)


def test_trash_expiry() -> None:
    print("\n[6] 回收站过期清理")
    now = int(time.time() * 1000)
    fresh = ns.create_trash_note({"title": "fresh", "deletedAt": now - 1000})
    expired = ns.create_trash_note({"title": "expired", "deletedAt": now - 31 * 24 * 60 * 60 * 1000})

    cleaned = ns.auto_clean_trash([fresh, expired], now)
    check("过期清理保留新鲜", len(cleaned) == 1)
    check("过期清理正确条目", cleaned[0]["title"] == "fresh")

    days_left = ns.get_trash_days_left(fresh, now)
    check("剩余天数 30", days_left == 30)
    days_left_old = ns.get_trash_days_left(expired, now)
    check("过期剩余 0 天", days_left_old == 0)


def test_search_filter_sort() -> None:
    print("\n[7] 搜索/筛选/排序")
    notes, n1 = ns.add_note([], {"title": "Python 笔记", "content": "abc", "category": "工作"})
    notes, n2 = ns.add_note(notes, {"title": "随机灵感", "content": "python idea", "category": "灵感"})
    notes, n3 = ns.add_note(notes, {"title": "购物清单", "content": "apple", "category": "个人"})

    # 搜索（不区分大小写）
    result = ns.search_notes(notes, "python")
    check("搜索 python 命中 2 条", len(result) == 2)

    # 搜索内容
    result = ns.search_notes(notes, "apple")
    check("搜索内容命中", len(result) == 1)

    # 分类筛选
    result = ns.filter_by_category(notes, "工作")
    check("筛选工作 1 条", len(result) == 1)
    result = ns.filter_by_category(notes, "全部")
    check("全部 = 全部", len(result) == 3)

    # 排序：置顶优先
    notes, _ = ns.toggle_pin(notes, n3["id"])
    sorted_notes = ns.sort_notes(notes)
    check("置顶在最前", sorted_notes[0]["id"] == n3["id"])


def test_stats() -> None:
    print("\n[8] 统计")
    notes, _ = ns.add_note([], {"title": "测试中文", "content": "hello world", "category": "工作", "color": "blue"})
    notes, _ = ns.add_note(notes, {"title": "abc", "content": "", "category": "工作", "color": "blue", "pinned": True})
    stats = ns.get_stats(notes)
    check("总数 2", stats["total"] == 2)
    check("置顶 1", stats["pinned"] == 1)
    check("工作分类 2", stats["byCategory"]["工作"] == 2)
    check("蓝色 2", stats["byColor"]["blue"] == 2)
    check("字数 > 0", stats["totalWords"] > 0)
    check("字符数 > 0", stats["totalChars"] > 0)


def test_import_export() -> None:
    print("\n[9] 导入/导出")
    notes, n1 = ns.add_note([], {"title": "原数据", "content": "test"})
    json_str = ns.export_notes(notes)
    parsed = json.loads(json_str)
    check("导出有 version", parsed["version"] == 1)
    check("导出有 notes 数组", isinstance(parsed["notes"], list))

    # 导入：会重新生成 ID
    combined = ns.import_notes(json_str, [])
    check("导入 1 条", len(combined) == 1)
    check("导入后 ID 不同", combined[0]["id"] != n1["id"])

    # 合并导入
    notes2, _ = ns.add_note([], {"title": "已有"})
    combined2 = ns.import_notes(json_str, notes2)
    check("合并导入 2 条", len(combined2) == 2)


def test_relative_time() -> None:
    print("\n[10] 相对时间格式化")
    now = int(time.time() * 1000)
    check("刚刚", ns.format_relative_time(now, now) == "刚刚")
    check("1 分钟前", ns.format_relative_time(now - 60 * 1000, now) == "1 分钟前")
    check("1 小时前", ns.format_relative_time(now - 3600 * 1000, now) == "1 小时前")
    check("1 天前", ns.format_relative_time(now - 86400 * 1000, now) == "1 天前")


def test_default_path() -> None:
    print("\n[11] 默认路径")
    path = ns.default_data_path()
    check("路径非空", bool(path))
    check("路径包含 sticky-notes-portable", "sticky-notes-portable" in path)
    check("路径以 notes.json 结尾", path.endswith("notes.json"))


def main() -> int:
    print("=" * 50)
    print("便签管家便携版 - 数据层测试")
    print("=" * 50)

    test_constants()
    test_create_note()
    test_load_save()
    test_crud()
    test_trash()
    test_trash_expiry()
    test_search_filter_sort()
    test_stats()
    test_import_export()
    test_relative_time()
    test_default_path()

    print("\n" + "=" * 50)
    print(f"通过 {PASS} 项，失败 {FAIL} 项")
    print("=" * 50)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
