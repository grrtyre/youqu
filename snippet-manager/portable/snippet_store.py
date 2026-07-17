# -*- coding: utf-8 -*-
"""
代码片段数据存储引擎 - 读写本地 JSON 文件
数据结构与原版 snippet-manager 完全兼容：
{
  "snippets": [
    { "id", "title", "language", "content", "tags": [], "description", "favorite", "pinned", "createdAt", "updatedAt" }
  ],
  "version": 1
}
"""
import json
import os
import time
import random
import string
import tempfile
import shutil
from datetime import datetime, timezone


def _now_iso():
    """当前 UTC 时间的 ISO 字符串"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _new_id():
    """生成唯一 ID，格式与原版一致：s_<时间基36>_<随机6>"""
    ts = int(time.time() * 1000)
    ts_b36 = ""
    n = ts
    while n > 0:
        ts_b36 = string.digits + string.ascii_lowercase
        ts_b36 = ""
        break
    # 简化：直接用 hex
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"s_{ts:x}_{rand}"


class SnippetStore:
    """代码片段存储引擎"""

    def __init__(self, file_path):
        self.file_path = file_path
        self.data = {"snippets": [], "version": 1}
        self._load()

    def _load(self):
        """从文件加载数据，损坏时备份并重置"""
        try:
            if os.path.exists(self.file_path):
                with open(self.file_path, "r", encoding="utf-8") as f:
                    raw = f.read()
                parsed = json.loads(raw)
                if parsed and isinstance(parsed.get("snippets"), list):
                    self.data = {"version": 1, "snippets": parsed["snippets"]}
        except Exception:
            # 数据损坏时备份
            if os.path.exists(self.file_path):
                bak = f"{self.file_path}.bak.{int(time.time())}"
                try:
                    shutil.copy2(self.file_path, bak)
                except Exception:
                    pass
            self.data = {"snippets": [], "version": 1}

    def _save(self):
        """原子写入：先写临时文件再重命名"""
        d = os.path.dirname(self.file_path)
        if d and not os.path.exists(d):
            os.makedirs(d, exist_ok=True)
        tmp = f"{self.file_path}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        # Windows 上 os.replace 可以原子替换
        os.replace(tmp, self.file_path)

    def list(self):
        """列出所有片段：置顶在前，再按更新时间倒序"""
        items = sorted(
            self.data["snippets"],
            key=lambda s: (
                0 if s.get("pinned") else 1,
                -(self._ts(s.get("updatedAt") or s.get("createdAt"))),
            ),
        )
        return items

    def _ts(self, iso_str):
        """将 ISO 时间字符串转为时间戳"""
        try:
            if not iso_str:
                return 0
            s = iso_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(s)
            return dt.timestamp()
        except Exception:
            return 0

    def get(self, snippet_id):
        for s in self.data["snippets"]:
            if s.get("id") == snippet_id:
                return s
        return None

    def create(self, title="", language="javascript", content="", tags=None,
               description="", favorite=False, pinned=False):
        now = _now_iso()
        snippet = {
            "id": _new_id(),
            "title": (title or "").strip() or "未命名片段",
            "language": language or "javascript",
            "content": content or "",
            "tags": [str(t).strip() for t in (tags or []) if str(t).strip()],
            "description": description or "",
            "favorite": bool(favorite),
            "pinned": bool(pinned),
            "createdAt": now,
            "updatedAt": now,
        }
        self.data["snippets"].append(snippet)
        self._save()
        return snippet

    def update(self, snippet_id, patch):
        s = self.get(snippet_id)
        if not s:
            return None
        if "title" in patch:
            s["title"] = (patch["title"] or "").strip() or s["title"]
        if "language" in patch:
            s["language"] = patch["language"]
        if "content" in patch:
            s["content"] = patch["content"]
        if "tags" in patch:
            s["tags"] = [str(t).strip() for t in patch["tags"] if str(t).strip()]
        if "description" in patch:
            s["description"] = patch["description"]
        if "favorite" in patch:
            s["favorite"] = bool(patch["favorite"])
        if "pinned" in patch:
            s["pinned"] = bool(patch["pinned"])
        s["updatedAt"] = _now_iso()
        self._save()
        return s

    def remove(self, snippet_id):
        for i, s in enumerate(self.data["snippets"]):
            if s.get("id") == snippet_id:
                removed = self.data["snippets"].pop(i)
                self._save()
                return removed
        return None

    def toggle_favorite(self, snippet_id):
        s = self.get(snippet_id)
        if not s:
            return None
        s["favorite"] = not s.get("favorite", False)
        s["updatedAt"] = _now_iso()
        self._save()
        return s

    def toggle_pin(self, snippet_id):
        s = self.get(snippet_id)
        if not s:
            return None
        s["pinned"] = not s.get("pinned", False)
        s["updatedAt"] = _now_iso()
        self._save()
        return s

    def search(self, query):
        """全文搜索：标题 + 内容 + 描述 + 标签 + 语言，多词 AND"""
        q = (query or "").strip().lower()
        if not q:
            return self.list()
        words = [w for w in q.split() if w]
        results = []
        for s in self.list():
            hay = " ".join([
                s.get("title", ""),
                s.get("content", ""),
                s.get("description", ""),
                " ".join(s.get("tags", [])),
                s.get("language", ""),
            ]).lower()
            if all(w in hay for w in words):
                results.append(s)
        return results

    def languages(self):
        """按语言分组统计"""
        m = {}
        for s in self.data["snippets"]:
            lang = s.get("language", "text")
            m[lang] = m.get(lang, 0) + 1
        return sorted([{"language": k, "count": v} for k, v in m.items()],
                       key=lambda x: x["count"], reverse=True)

    def tags(self):
        """所有标签及计数"""
        m = {}
        for s in self.data["snippets"]:
            for t in s.get("tags", []):
                m[t] = m.get(t, 0) + 1
        return sorted([{"tag": k, "count": v} for k, v in m.items()],
                       key=lambda x: x["count"], reverse=True)

    def count(self):
        return len(self.data["snippets"])

    def export_json(self):
        return json.dumps(self.data, ensure_ascii=False, indent=2)

    def import_json(self, json_str, mode="merge"):
        parsed = json.loads(json_str)
        if not parsed or not isinstance(parsed.get("snippets"), list):
            raise ValueError("无效的导入数据")
        if mode == "replace":
            self.data = {"version": 1, "snippets": parsed["snippets"]}
        else:
            exist_keys = {f"{s.get('title')}||{s.get('language')}"
                          for s in self.data["snippets"]}
            for s in parsed["snippets"]:
                key = f"{s.get('title')}||{s.get('language')}"
                if key not in exist_keys:
                    s["id"] = _new_id()
                    self.data["snippets"].append(s)
                    exist_keys.add(key)
        self._save()
        return {"count": len(self.data["snippets"])}

    def seed_if_empty(self):
        """首次启动注入示例数据"""
        if self.data["snippets"]:
            return False
        now = _now_iso()
        samples = [
            {
                "title": "防抖函数 debounce",
                "language": "javascript",
                "content": 'function debounce(fn, delay = 300) {\n  let timer = null;\n  return function (...args) {\n    if (timer) clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), delay);\n  };\n}',
                "tags": ["工具函数", "性能"],
                "description": "前端常用防抖，适用于搜索输入、窗口 resize 等高频事件。",
                "favorite": True,
                "pinned": True,
            },
            {
                "title": "快速排序",
                "language": "python",
                "content": "def quick_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    mid = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quick_sort(left) + mid + quick_sort(right)",
                "tags": ["算法", "排序"],
                "description": "经典快排实现，平均 O(n log n)。",
                "favorite": False,
                "pinned": False,
            },
            {
                "title": "Flex 居中",
                "language": "css",
                "content": ".center {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}",
                "tags": ["布局"],
                "description": "Flexbox 水平垂直居中万能方案。",
                "favorite": True,
                "pinned": False,
            },
            {
                "title": "fetch 封装",
                "language": "javascript",
                "content": 'async function request(url, options = {}) {\n  const res = await fetch(url, {\n    headers: { "Content-Type": "application/json", ...options.headers },\n    ...options,\n  });\n  if (!res.ok) throw new Error(`HTTP ${res.status}`);\n  return res.json();\n}',
                "tags": ["请求", "工具函数"],
                "description": "带错误处理与默认 JSON 头的 fetch 封装。",
                "favorite": False,
                "pinned": False,
            },
            {
                "title": "Git 撤销最近提交",
                "language": "bash",
                "content": "# 撤销最近一次提交但保留改动\ngit reset --soft HEAD~1\n\n# 完全丢弃最近一次提交\ngit reset --hard HEAD~1",
                "tags": ["Git"],
                "description": "常用 Git 撤销操作备忘。",
                "favorite": False,
                "pinned": False,
            },
            {
                "title": "Docker 常用命令",
                "language": "bash",
                "content": "# 构建镜像\ndocker build -t myapp .\n\n# 运行容器\ndocker run -d -p 8080:80 myapp\n\n# 进入容器\ndocker exec -it <container> bash\n\n# 清理无用镜像\ndocker image prune -a",
                "tags": ["Docker", "运维"],
                "description": "Docker 日常操作速查。",
                "favorite": False,
                "pinned": False,
            },
        ]
        for s in samples:
            s["id"] = _new_id()
            s["createdAt"] = now
            s["updatedAt"] = now
            self.data["snippets"].append(s)
        self._save()
        return True
