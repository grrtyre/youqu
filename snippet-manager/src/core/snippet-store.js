// 代码片段数据存储引擎 - 读写本地 JSON 文件
// 数据结构：
// {
//   snippets: [
//     { id, title, language, content, tags: [], description, favorite, pinned, createdAt, updatedAt }
//   ],
//   version: 1
// }

const fs = require('fs');
const path = require('path');

class SnippetStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { snippets: [], version: 1 };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.snippets)) {
          this.data = { version: 1, ...parsed, snippets: parsed.snippets };
        }
      }
    } catch (e) {
      // 数据损坏时备份并重置
      if (fs.existsSync(this.filePath)) {
        const bak = this.filePath + '.bak.' + Date.now();
        try { fs.copyFileSync(this.filePath, bak); } catch (_) {}
      }
      this.data = { snippets: [], version: 1 };
    }
  }

  _save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  _newId() {
    return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  list() {
    // 置顶在前，再按更新时间倒序
    return this.data.snippets
      .slice()
      .sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        const ta = new Date(a.updatedAt || a.createdAt).getTime();
        const tb = new Date(b.updatedAt || b.createdAt).getTime();
        return tb - ta;
      });
  }

  get(id) {
    return this.data.snippets.find((s) => s.id === id);
  }

  create({ title, language = 'javascript', content = '', tags = [], description = '', favorite = false, pinned = false } = {}) {
    const now = new Date().toISOString();
    const snippet = {
      id: this._newId(),
      title: String(title || '').trim() || '未命名片段',
      language: String(language || 'javascript'),
      content: String(content || ''),
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      description: String(description || ''),
      favorite: !!favorite,
      pinned: !!pinned,
      createdAt: now,
      updatedAt: now,
    };
    this.data.snippets.push(snippet);
    this._save();
    return snippet;
  }

  update(id, patch) {
    const s = this.get(id);
    if (!s) return null;
    if (patch.title !== undefined) s.title = String(patch.title).trim() || s.title;
    if (patch.language !== undefined) s.language = String(patch.language);
    if (patch.content !== undefined) s.content = String(patch.content);
    if (patch.tags !== undefined) s.tags = Array.isArray(patch.tags) ? patch.tags.map((t) => String(t).trim()).filter(Boolean) : [];
    if (patch.description !== undefined) s.description = String(patch.description);
    if (patch.favorite !== undefined) s.favorite = !!patch.favorite;
    if (patch.pinned !== undefined) s.pinned = !!patch.pinned;
    s.updatedAt = new Date().toISOString();
    this._save();
    return s;
  }

  remove(id) {
    const idx = this.data.snippets.findIndex((s) => s.id === id);
    if (idx >= 0) {
      const [removed] = this.data.snippets.splice(idx, 1);
      this._save();
      return removed;
    }
    return null;
  }

  toggleFavorite(id) {
    const s = this.get(id);
    if (!s) return null;
    s.favorite = !s.favorite;
    s.updatedAt = new Date().toISOString();
    this._save();
    return s;
  }

  togglePin(id) {
    const s = this.get(id);
    if (!s) return null;
    s.pinned = !s.pinned;
    s.updatedAt = new Date().toISOString();
    this._save();
    return s;
  }

  /** 全文搜索：标题 + 内容 + 描述 + 标签 */
  search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return this.list();
    const words = q.split(/\s+/).filter(Boolean);
    return this.list().filter((s) => {
      const hay = (
        s.title + ' ' + s.content + ' ' + s.description + ' ' + s.tags.join(' ') + ' ' + s.language
      ).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }

  /** 按语言分组统计 */
  languages() {
    const map = {};
    for (const s of this.data.snippets) {
      map[s.language] = (map[s.language] || 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([lang, count]) => ({ language: lang, count }));
  }

  /** 所有标签及计数 */
  tags() {
    const map = {};
    for (const s of this.data.snippets) {
      for (const t of s.tags) {
        map[t] = (map[t] || 0) + 1;
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }

  /** 收藏列表 */
  favorites() {
    return this.list().filter((s) => s.favorite);
  }

  count() {
    return this.data.snippets.length;
  }

  /** 导出 JSON 字符串 */
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  /** 从 JSON 字符串导入（合并模式：保留已有，新增导入的） */
  importJSON(json, mode = 'merge') {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.snippets)) throw new Error('无效的导入数据');
    if (mode === 'replace') {
      this.data = { version: 1, snippets: parsed.snippets };
    } else {
      // 合并：按 title+language 去重
      const existKeys = new Set(this.data.snippets.map((s) => s.title + '||' + s.language));
      for (const s of parsed.snippets) {
        const key = s.title + '||' + s.language;
        if (!existKeys.has(key)) {
          this.data.snippets.push({ ...s, id: this._newId() });
          existKeys.add(key);
        }
      }
    }
    this._save();
    return { count: this.data.snippets.length };
  }

  /** 写入示例数据（首次启动） */
  seedIfEmpty() {
    if (this.data.snippets.length > 0) return false;
    const now = new Date().toISOString();
    const samples = [
      {
        title: '防抖函数 debounce',
        language: 'javascript',
        content: 'function debounce(fn, delay = 300) {\n  let timer = null;\n  return function (...args) {\n    if (timer) clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), delay);\n  };\n}',
        tags: ['工具函数', '性能'],
        description: '前端常用防抖，适用于搜索输入、窗口 resize 等高频事件。',
        favorite: true,
        pinned: true,
      },
      {
        title: '快速排序',
        language: 'python',
        content: 'def quick_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    mid = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quick_sort(left) + mid + quick_sort(right)',
        tags: ['算法', '排序'],
        description: '经典快排实现，平均 O(n log n)。',
        favorite: false,
        pinned: false,
      },
      {
        title: 'Flex 居中',
        language: 'css',
        content: '.center {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}',
        tags: ['布局'],
        description: 'Flexbox 水平垂直居中万能方案。',
        favorite: true,
        pinned: false,
      },
      {
        title: 'fetch 封装',
        language: 'javascript',
        content: 'async function request(url, options = {}) {\n  const res = await fetch(url, {\n    headers: { "Content-Type": "application/json", ...options.headers },\n    ...options,\n  });\n  if (!res.ok) throw new Error(`HTTP ${res.status}`);\n  return res.json();\n}',
        tags: ['请求', '工具函数'],
        description: '带错误处理与默认 JSON 头的 fetch 封装。',
        favorite: false,
        pinned: false,
      },
      {
        title: 'Git 撤销最近提交',
        language: 'bash',
        content: '# 撤销最近一次提交但保留改动\ngit reset --soft HEAD~1\n\n# 完全丢弃最近一次提交\ngit reset --hard HEAD~1',
        tags: ['Git'],
        description: '常用 Git 撤销操作备忘。',
        favorite: false,
        pinned: false,
      },
    ];
    for (const s of samples) {
      this.data.snippets.push({
        id: this._newId(),
        ...s,
        createdAt: now,
        updatedAt: now,
      });
    }
    this._save();
    return true;
  }
}

module.exports = { SnippetStore };
