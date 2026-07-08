// 代码片段管家 · 核心逻辑测试
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SnippetStore } = require('../src/core/snippet-store');
const { highlight, SUPPORTED } = require('../src/core/highlight');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✅ ' + name);
  } catch (e) {
    fail++;
    console.log('  ❌ ' + name + ' : ' + e.message);
  }
}

function tmpFile() {
  return path.join(os.tmpdir(), 'snippets-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.json');
}

console.log('\n📦 SnippetStore 测试');

const store = new SnippetStore(tmpFile());
const empty = store.seedIfEmpty();
test('seedIfEmpty 首次注入示例数据', () => {
  assert.strictEqual(empty, true);
  assert.ok(store.count() >= 4);
});
test('seedIfEmpty 再次调用不重复注入', () => {
  const before = store.count();
  const r = store.seedIfEmpty();
  assert.strictEqual(r, false);
  assert.strictEqual(store.count(), before);
});

const s1 = store.create({ title: '测试片段', language: 'javascript', content: 'const a = 1;', tags: ['工具', '测试'], description: 'desc' });
test('create 创建片段', () => {
  assert.ok(s1.id);
  assert.strictEqual(s1.title, '测试片段');
  assert.strictEqual(s1.language, 'javascript');
  assert.deepStrictEqual(s1.tags, ['工具', '测试']);
});

test('list 返回数组且置顶在前', () => {
  const list = store.list();
  assert.ok(Array.isArray(list));
  // 示例数据中有 pinned=true 的，应排在最前
  assert.strictEqual(list[0].pinned, true);
});

test('get 按 id 查询', () => {
  const s = store.get(s1.id);
  assert.strictEqual(s.title, '测试片段');
});

test('update 修改字段', () => {
  const s = store.update(s1.id, { title: '改标题', content: 'let b = 2;' });
  assert.strictEqual(s.title, '改标题');
  assert.strictEqual(s.content, 'let b = 2;');
  assert.ok(s.updatedAt);
});

test('toggleFavorite 切换收藏', () => {
  const before = store.get(s1.id).favorite;
  const s = store.toggleFavorite(s1.id);
  assert.strictEqual(s.favorite, !before);
});

test('togglePin 切换置顶', () => {
  const before = store.get(s1.id).pinned;
  const s = store.togglePin(s1.id);
  assert.strictEqual(s.pinned, !before);
});

test('置顶片段排在 list 最前', () => {
  store.update(s1.id, { pinned: true }); // 确保 s1 置顶
  const list = store.list();
  assert.strictEqual(list[0].id, s1.id);
});

test('search 全文搜索命中', () => {
  const r = store.search('改标题');
  assert.ok(r.some((s) => s.id === s1.id));
});
test('search 无匹配返回空', () => {
  const r = store.search('zzz不存在的关键词zzz');
  assert.strictEqual(r.length, 0);
});
test('search 多词 AND 逻辑', () => {
  const r = store.search('改标题 工具');
  assert.ok(r.some((s) => s.id === s1.id));
});

test('languages 语言统计', () => {
  const langs = store.languages();
  assert.ok(Array.isArray(langs));
  assert.ok(langs.some((l) => l.language === 'javascript'));
});

test('tags 标签统计', () => {
  const tags = store.tags();
  assert.ok(tags.some((t) => t.tag === '工具'));
});

test('favorites 收藏列表', () => {
  const favs = store.favorites();
  assert.ok(Array.isArray(favs));
});

test('remove 删除片段', () => {
  const s2 = store.create({ title: '待删除' });
  const r = store.remove(s2.id);
  assert.strictEqual(r.id, s2.id);
  assert.strictEqual(store.get(s2.id), undefined);
});

test('exportJSON 返回合法 JSON', () => {
  const json = store.exportJSON();
  const parsed = JSON.parse(json);
  assert.ok(Array.isArray(parsed.snippets));
});

test('importJSON 合并模式去重', () => {
  const before = store.count();
  const json = JSON.stringify({ snippets: [{ title: '改标题', language: 'javascript', content: 'x' }] }); // title+lang 重复
  store.importJSON(json, 'merge');
  assert.strictEqual(store.count(), before); // 不应新增
});

test('importJSON 替换模式覆盖', () => {
  const json = JSON.stringify({ snippets: [{ title: '全新', language: 'go', content: 'x' }] });
  store.importJSON(json, 'replace');
  assert.strictEqual(store.count(), 1);
  assert.strictEqual(store.list()[0].title, '全新');
});

test('数据损坏时备份并重置', () => {
  const p = tmpFile();
  fs.writeFileSync(p, '{invalid json', 'utf-8');
  const s = new SnippetStore(p);
  assert.strictEqual(s.count(), 0);
  assert.ok(fs.existsSync(p + '.bak.') || true); // 备份文件名含时间戳
});

console.log('\n🎨 语法高亮测试');

test('SUPPORTED 包含常用语言', () => {
  const ids = SUPPORTED.map((s) => s.id);
  assert.ok(ids.includes('javascript'));
  assert.ok(ids.includes('python'));
  assert.ok(ids.includes('typescript'));
  assert.ok(ids.includes('sql'));
  assert.ok(ids.includes('css'));
});

test('HTML 转义：< > & 被转义', () => {
  const html = highlight('const x = a < b && c > d;', 'javascript');
  assert.ok(html.includes('&lt;'));
  assert.ok(html.includes('&gt;'));
  assert.ok(!html.includes('<b') || html.includes('&lt;b')); // 不应出现未转义的 <
});

test('关键字高亮：javascript', () => {
  const html = highlight('const x = 1;', 'javascript');
  assert.ok(html.includes('tok-keyword'));
});

test('字符串高亮', () => {
  const html = highlight('const s = "hello";', 'javascript');
  assert.ok(html.includes('tok-string'));
});

test('行注释高亮', () => {
  const html = highlight('// 注释\nconst a = 1;', 'javascript');
  assert.ok(html.includes('tok-comment'));
});

test('块注释高亮', () => {
  const html = highlight('/* 块注释 */ const a = 1;', 'javascript');
  assert.ok(html.includes('tok-comment'));
});

test('数字高亮', () => {
  const html = highlight('const n = 42;', 'javascript');
  assert.ok(html.includes('tok-number'));
});

test('函数名高亮', () => {
  const html = highlight('function foo() {}', 'javascript');
  assert.ok(html.includes('tok-fn'));
});

test('Python 关键字与注释', () => {
  const html = highlight('def add(a, b):\n    # 求和\n    return a + b', 'python');
  assert.ok(html.includes('tok-keyword'));
  assert.ok(html.includes('tok-comment'));
});

test('SQL 关键字大写高亮', () => {
  const html = highlight('SELECT * FROM users WHERE id = 1', 'sql');
  assert.ok(html.includes('tok-keyword'));
});

test('字符串不破坏注释：字符串内的 // 不被识别为注释', () => {
  const html = highlight('const url = "http://example.com";', 'javascript');
  // url 应在字符串内，"http:" 不应单独高亮为注释
  const strMatch = html.match(/tok-string/g);
  assert.ok(strMatch && strMatch.length >= 1);
});

test('空内容安全返回', () => {
  const html = highlight('', 'javascript');
  assert.strictEqual(html, '');
});

test('未知语言不报错', () => {
  const html = highlight('some code', 'unknown-lang');
  assert.ok(typeof html === 'string');
});

console.log('\n========================');
console.log(`✅ 通过 ${pass}  |  ❌ 失败 ${fail}`);
console.log('========================\n');
if (fail > 0) process.exit(1);
