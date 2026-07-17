# -*- coding: utf-8 -*-
"""单元测试：核心逻辑"""
import os
import sys
import tempfile

# 把 portable/ 目录加入 path
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from store import PromptStore, extract_vars, fill_vars

passed = 0
failed = 0

def ok(name, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  OK  {name}")
    else:
        failed += 1
        print(f"  FAIL {name}  {extra}")

# === extract_vars / fill_vars ===
print("=== extract_vars / fill_vars ===")
vars_ = extract_vars("hello {{name}} and {{name}} and {{age}}")
ok("extract dedup + order", vars_ == ["name", "age"], str(vars_))
ok("extract empty", extract_vars("no vars") == [])
filled = fill_vars("hi {{name}}, {{age}}", {"name": "Tom", "age": "20"})
ok("fill basic", filled == "hi Tom, 20", filled)
filled2 = fill_vars("no var", {})
ok("fill no var", filled2 == "no var")

# === PromptStore ===
print("\n=== PromptStore CRUD ===")
tmpdir = tempfile.mkdtemp()
data_path = os.path.join(tmpdir, "prompts.json")
store = PromptStore(data_path)
ok("seeded 6 prompts", len(store.all()) == 6, f"got {len(store.all())}")

p = store.add(title="测试1", content="hello {{x}}", category="测试", tags=["t1", "t2"], favorite=True)
ok("add returns item with id", bool(p.get("id")))
ok("count after add", len(store.all()) == 7)

got = store.get(p["id"])
ok("get by id", got is not None and got["title"] == "测试1")

upd = store.update(p["id"], title="改名后")
ok("update title", upd["title"] == "改名后")

fav = store.toggle_favorite(p["id"])
ok("toggle favorite", fav is False)  # was True

store.bump_usage(p["id"])
got2 = store.get(p["id"])
ok("bump usage count", got2["usageCount"] == 1)
ok("bump usage lastUsedAt set", bool(got2["lastUsedAt"]))

delok = store.delete(p["id"])
ok("delete returns True", delok is True)
ok("count after delete", len(store.all()) == 6)

# === search ===
print("\n=== search ===")
res = store.search(keyword="翻译")
ok("search keyword", any(p["title"] == "智能翻译" for p in res), str([p["title"] for p in res]))

res2 = store.search(favorite_only=True)
ok("search favorite_only", all(p.get("favorite") for p in res2) and len(res2) >= 1)

res3 = store.search(category="编程")
ok("search category", all(p.get("category") == "编程" for p in res3) and len(res3) >= 1)

res4 = store.search(tag="SQL")
ok("search tag", all("SQL" in (p.get("tags") or []) for p in res4) and len(res4) >= 1)

# === import/export ===
print("\n=== import/export ===")
data = store.export_all()
ok("export has prompts list", isinstance(data.get("prompts"), list) and len(data["prompts"]) >= 6)

# add a fake id then re-import
data["prompts"].append({"id": "ext-1", "title": "外部导入", "content": "x", "category": "测试", "tags": [], "favorite": False, "usageCount": 0})
added = store.import_merge(data)
ok("import added 1", added == 1, f"added={added}")
ok("count after import", len(store.all()) == 7)

# duplicate id should not be re-added
added2 = store.import_merge(data)
ok("import no dup", added2 == 0)

# === categories / tags ===
print("\n=== categories / tags ===")
cats = store.categories()
ok("categories contains known", "翻译" in cats and "编程" in cats, str(cats))

tags = store.tags()
ok("tags contains known", "SQL" in tags and "翻译" in tags, str(tags))

# === persistence ===
print("\n=== persistence ===")
store2 = PromptStore(data_path)
ok("persistence reload count", len(store2.all()) == 7)

print(f"\n=== Result: {passed} passed, {failed} failed ===")
sys.exit(0 if failed == 0 else 1)
