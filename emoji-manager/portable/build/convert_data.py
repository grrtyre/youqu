# -*- coding: utf-8 -*-
"""将原版 emoji-manager 的 JS 数据文件转换为 Python 模块 emoji_data.py
数据结构：11 个分类，每个分类含 {c, n, k} 三元组的 emoji 列表
"""
import re
import os
import sys

SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "src", "core")
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "emoji_data.py")

# 匹配单个 emoji 对象 { c: '...', n: '...', k: '...' }（支持转义）
EMOJI_RE = re.compile(
    r"\{\s*c:\s*'((?:[^'\\]|\\.)*)'\s*,\s*n:\s*'((?:[^'\\]|\\.)*)'\s*,\s*k:\s*'((?:[^'\\]|\\.)*)'\s*\}",
    re.DOTALL,
)

# 匹配分类头部 { id: '...', name: '...', icon: '...', emojis:  ... }
CAT_HEAD_RE = re.compile(
    r"id:\s*'([^']*)'\s*,\s*name:\s*'([^']*)'\s*,\s*icon:\s*'([^']*)'\s*,\s*emojis:\s*",
    re.DOTALL,
)


def unescape_js(s: str) -> str:
    """反转义 JS 字符串中的转义序列"""
    out = []
    i = 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            c = s[i + 1]
            if c == "\\":
                out.append("\\"); i += 2; continue
            if c == "'":
                out.append("'"); i += 2; continue
            if c == '"':
                out.append('"'); i += 2; continue
            if c == "n":
                out.append("\n"); i += 2; continue
            if c == "t":
                out.append("\t"); i += 2; continue
            if c == "r":
                out.append("\r"); i += 2; continue
            if c == "b":
                out.append("\b"); i += 2; continue
            if c == "f":
                out.append("\f"); i += 2; continue
            if c == "/":
                out.append("/"); i += 2; continue
            if c == "u" and i + 5 < len(s):
                out.append(chr(int(s[i + 2:i + 6], 16))); i += 6; continue
            out.append(c); i += 2; continue
        out.append(s[i]); i += 1
    return "".join(out)


def find_array_end(text: str, start: int) -> int:
    """从 text[start] == '[' 开始，找到匹配的 ']' 位置（含）"""
    assert text[start] == "["
    depth = 0
    in_str = False
    str_char = None
    i = start
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == "\\":
                i += 2; continue
            if ch == str_char:
                in_str = False
        else:
            if ch in ("'", '"'):
                in_str = True; str_char = ch
            elif ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    return i + 1
        i += 1
    raise ValueError("未找到数组结束位置")


def parse_inline_categories(text: str) -> list:
    """解析内联 emojis 数组的分类（如 EMOJI_CATEGORIES / EXTRA_CATEGORIES）"""
    cats = []
    for m in CAT_HEAD_RE.finditer(text):
        cat_id, cat_name, cat_icon = m.group(1), m.group(2), m.group(3)
        # emojis: 之后应该是 [ 或变量名
        rest_start = m.end()
        # 跳过空白
        j = rest_start
        while j < len(text) and text[j] in " \t\r\n":
            j += 1
        if j >= len(text) or text[j] != "[":
            # 引用变量（如 KAO_DATA），跳过 —— 由调用方单独处理
            continue
        arr_end = find_array_end(text, j)
        arr_text = text[j:arr_end]
        emojis = []
        for em in EMOJI_RE.finditer(arr_text):
            emojis.append({
                "c": unescape_js(em.group(1)),
                "n": unescape_js(em.group(2)),
                "k": unescape_js(em.group(3)),
            })
        cats.append({"id": cat_id, "name": cat_name, "icon": cat_icon, "emojis": emojis})
    return cats


def parse_standalone_array(text: str, var_name: str) -> list:
    """解析 const VAR = [ ... ]; 形式的独立数组（如 KAO_DATA / SYMBOLS_DATA）"""
    m = re.search(rf"const\s+{var_name}\s*=\s*\[", text)
    if not m:
        return []
    arr_start = m.end() - 1
    arr_end = find_array_end(text, arr_start)
    arr_text = text[arr_start:arr_end]
    emojis = []
    for em in EMOJI_RE.finditer(arr_text):
        emojis.append({
            "c": unescape_js(em.group(1)),
            "n": unescape_js(em.group(2)),
            "k": unescape_js(em.group(3)),
        })
    return emojis


def py_repr_str(s: str) -> str:
    return repr(s)


def main():
    with open(os.path.join(SRC_DIR, "emoji-data.js"), "r", encoding="utf-8") as f:
        main_js = f.read()
    with open(os.path.join(SRC_DIR, "emoji-data-extra.js"), "r", encoding="utf-8") as f:
        extra_js = f.read()
    with open(os.path.join(SRC_DIR, "emoji-data-kao.js"), "r", encoding="utf-8") as f:
        kao_js = f.read()

    main_cats = parse_inline_categories(main_js)
    extra_cats = parse_inline_categories(extra_js)
    kao_data = parse_standalone_array(kao_js, "KAO_DATA")
    sym_data = parse_standalone_array(kao_js, "SYMBOLS_DATA")

    all_cats = main_cats + extra_cats + [
        {"id": "kao", "name": "颜文字", "icon": "ʕ•ᴥ•ʔ", "emojis": kao_data},
        {"id": "special", "name": "特殊符号", "icon": "★", "emojis": sym_data},
    ]

    total = sum(len(c["emojis"]) for c in all_cats)
    print(f"解析完成：{len(all_cats)} 个分类，共 {total} 个 emoji")

    # 生成 Python 模块
    lines = [
        "# -*- coding: utf-8 -*-",
        '"""emoji 数据模块 —— 由 build/convert_data.py 从原版 JS 数据自动生成',
        "原版数据来源：emoji-manager/src/core/emoji-data*.js",
        f"共 {len(all_cats)} 个分类，{total} 个 emoji",
        '"""',
        "",
        "# 字段：c=字符, n=中文名, k=关键词（空格分隔，便于搜索匹配）",
        "CATEGORIES = [",
    ]
    for cat in all_cats:
        lines.append("    {")
        lines.append(f"        'id': {py_repr_str(cat['id'])},")
        lines.append(f"        'name': {py_repr_str(cat['name'])},")
        lines.append(f"        'icon': {py_repr_str(cat['icon'])},")
        lines.append("        'emojis': [")
        for e in cat["emojis"]:
            lines.append(
                f"            {{'c': {py_repr_str(e['c'])}, 'n': {py_repr_str(e['n'])}, 'k': {py_repr_str(e['k'])}}},"
            )
        lines.append("        ],")
        lines.append("    },")
    lines.append("]")
    lines.append("")
    lines.append("")
    lines.append("def get_all_categories():")
    lines.append("    return CATEGORIES")
    lines.append("")
    lines.append("")
    lines.append("def get_all_emojis():")
    lines.append("    out = []")
    lines.append("    for cat in CATEGORIES:")
    lines.append("        for e in cat['emojis']:")
    lines.append("            out.append({**e, 'cat': cat['id'], 'catName': cat['name']})")
    lines.append("    return out")
    lines.append("")
    lines.append("")
    lines.append("if __name__ == '__main__':")
    lines.append("    cats = get_all_categories()")
    lines.append("    total = sum(len(c['emojis']) for c in cats)")
    lines.append("    print(f'{len(cats)} categories, {total} emojis')")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"已写入：{OUT}")
    print(f"  文件大小：{os.path.getsize(OUT)} bytes")


if __name__ == "__main__":
    main()
