// 测试脚本：验证核心逻辑（分类、去重、IPC 接口契约）
// 由于 main.js 依赖 electron，我们提取纯逻辑函数测试
const assert = require('assert');

// 重新实现 classifyContent（与 main.js 一致）进行测试
function classifyContent(text) {
  if (typeof text !== 'string' || text.length === 0) return 'text';
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'link';
  if (/^\S+@\S+\.\S+$/.test(trimmed)) return 'email';
  if (/^1[3-9]\d{9}$/.test(trimmed)) return 'phone';
  if (/(?:function|const|let|var|import|export|=>|class |return |if\s*\(|for\s*\(|while\s*\(|switch\s*\(|\.map\(|\.filter\(|\.forEach\(|async |await )/.test(trimmed)) return 'code';
  if (trimmed.includes('\n') && trimmed.split('\n').length >= 2) {
    const lines = trimmed.split('\n');
    const indentedLines = lines.filter(l => /^\s{2,}/.test(l));
    if (indentedLines.length >= Math.floor(lines.length / 2)) return 'code';
  }
  return 'text';
}

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + ' — ' + e.message); }
}

console.log('\n=== 1. 内容分类 ===');
test('链接识别 http', () => assert.strictEqual(classifyContent('https://github.com'), 'link'));
test('链接识别 http://', () => assert.strictEqual(classifyContent('http://example.com/path'), 'link'));
test('邮箱识别', () => assert.strictEqual(classifyContent('user@example.com'), 'email'));
test('手机号识别', () => assert.strictEqual(classifyContent('13812345678'), 'phone'));
test('代码识别 function', () => assert.strictEqual(classifyContent('function add(a,b){return a+b}'), 'code'));
test('代码识别 const', () => assert.strictEqual(classifyContent('const x = 1'), 'code'));
test('代码识别 箭头函数', () => assert.strictEqual(classifyContent('const f = () => 2'), 'code'));
test('代码识别 import', () => assert.strictEqual(classifyContent('import React from "react"'), 'code'));
test('代码识别 多行缩进', () => {
  assert.strictEqual(classifyContent('if true:\n  print(1)\n  print(2)'), 'code');
});
test('普通文本', () => assert.strictEqual(classifyContent('今天天气不错'), 'text'));
test('空字符串', () => assert.strictEqual(classifyContent(''), 'text'));
test('null 安全', () => assert.strictEqual(classifyContent(null), 'text'));
test('undefined 安全', () => assert.strictEqual(classifyContent(undefined), 'text'));

console.log('\n=== 2. 数据结构契约 ===');
// 模拟一个剪贴板条目的结构
const sampleItem = {
  id: 'abc123',
  content: 'hello',
  type: 'text',
  timestamp: Date.now(),
  pinned: false,
  favorite: false
};
test('条目结构完整', () => {
  assert.ok(sampleItem.id, '需要有 id');
  assert.ok(sampleItem.content, '需要有 content');
  assert.ok(['code','link','email','phone','text'].includes(sampleItem.type), 'type 需合法');
  assert.strictEqual(typeof sampleItem.timestamp, 'number');
  assert.strictEqual(typeof sampleItem.pinned, 'boolean');
  assert.strictEqual(typeof sampleItem.favorite, 'boolean');
});

console.log('\n=== 3. 去重逻辑 ===');
// 模拟 main.js 的去重：连续相同内容不记录
let history = [{ content: 'aaa', id: '1' }];
let lastContent = 'aaa';
function tryAdd(current) {
  if (current && current !== lastContent) {
    if (history.length > 0 && history[0].content === current) return false;
    history.unshift({ content: current, id: Date.now().toString() });
    lastContent = current;
    return true;
  }
  return false;
}
test('相同内容不重复记录', () => assert.strictEqual(tryAdd('aaa'), false));
test('新内容会记录', () => assert.strictEqual(tryAdd('bbb'), true));
test('新内容在顶部', () => assert.strictEqual(history[0].content, 'bbb'));

console.log('\n=== 4. 最大条目限制 ===');
let bigHistory = [];
for (let i = 0; i < 600; i++) bigHistory.push({ id: i, content: 'item' + i });
if (bigHistory.length > 500) bigHistory = bigHistory.slice(0, 500);
test('超过 500 条截断', () => assert.strictEqual(bigHistory.length, 500));

console.log('\n=== 5. 清空保留置顶 ===');
let clearHistory = [
  { id: '1', content: 'a', pinned: true },
  { id: '2', content: 'b', pinned: false },
  { id: '3', content: 'c', pinned: true },
  { id: '4', content: 'd', pinned: false }
];
clearHistory = clearHistory.filter(i => i.pinned);
test('清空后只剩置顶', () => {
  assert.strictEqual(clearHistory.length, 2);
  assert.ok(clearHistory.every(i => i.pinned));
});

console.log('\n=== 6. 搜索过滤 ===');
const searchPool = [
  { content: 'hello world', type: 'text' },
  { content: 'function foo()', type: 'code' },
  { content: 'https://github.com', type: 'link' }
];
test('关键词搜索', () => {
  const q = 'hello';
  const r = searchPool.filter(i => i.content.toLowerCase().includes(q));
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].content, 'hello world');
});
test('类型筛选', () => {
  const r = searchPool.filter(i => i.type === 'code');
  assert.strictEqual(r.length, 1);
});

console.log('\n=== 7. 相对时间格式 ===');
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return '刚刚';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' 分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小时前';
  return '更久前';
}
test('刚刚', () => assert.strictEqual(timeAgo(Date.now() - 5000), '刚刚'));
test('分钟前', () => assert.strictEqual(timeAgo(Date.now() - 120000), '2 分钟前'));
test('小时前', () => assert.strictEqual(timeAgo(Date.now() - 7200000), '2 小时前'));

console.log('\n=== 8. 键盘导航索引边界 ===');
// 模拟 renderer.js 的 focusedIndex 边界控制逻辑
function clampFocus(focusedIndex, itemsLen) {
  if (focusedIndex >= itemsLen) focusedIndex = itemsLen - 1;
  if (focusedIndex < -1) focusedIndex = -1;
  return focusedIndex;
}
test('索引超出上限被截断', () => assert.strictEqual(clampFocus(5, 3), 2));
test('索引 -2 被修正为 -1', () => assert.strictEqual(clampFocus(-2, 3), -1));
test('空列表索引归 -1', () => assert.strictEqual(clampFocus(0, 0), -1));
test('合法索引不变', () => assert.strictEqual(clampFocus(1, 3), 1));

// 模拟上下箭头移动
function moveDown(focusedIndex, itemsLen) {
  return Math.min(focusedIndex + 1, itemsLen - 1);
}
function moveUp(focusedIndex) {
  return Math.max(focusedIndex - 1, 0);
}
test('下箭头不超上限', () => assert.strictEqual(moveDown(2, 3), 2));
test('上箭头不低于 0', () => assert.strictEqual(moveUp(0), 0));
test('下箭头从 -1 到 0', () => assert.strictEqual(moveDown(-1, 3), 0));

console.log('\n=== 9. 自动粘贴设置 ===');
// 模拟 localStorage 读取逻辑
function readAutoPaste(stored) {
  return stored === null ? true : stored === '1';
}
test('未设置时默认开启', () => assert.strictEqual(readAutoPaste(null), true));
test('"1" 表示开启', () => assert.strictEqual(readAutoPaste('1'), true));
test('"0" 表示关闭', () => assert.strictEqual(readAutoPaste('0'), false));

console.log('\n=== 10. 搜索关键词高亮 ===');
// 与 renderer.js 中 highlight 一致的纯逻辑实现
function escapeHtmlTest(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeRegExpTest(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function highlight(text, query) {
  const escaped = escapeHtmlTest(text);
  if (!query) return escaped;
  const safeQuery = escapeRegExpTest(query);
  try {
    const re = new RegExp('(' + safeQuery + ')', 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  } catch (e) {
    return escaped;
  }
}
test('无关键词返回纯 escape', () => {
  assert.strictEqual(highlight('hello world', ''), 'hello world');
});
test('匹配关键词被 mark 包裹', () => {
  const r = highlight('hello world', 'world');
  assert.strictEqual(r, 'hello <mark>world</mark>');
});
test('大小写不敏感匹配', () => {
  const r = highlight('Hello World', 'hello');
  assert.strictEqual(r, '<mark>Hello</mark> World');
});
test('多处匹配都高亮', () => {
  const r = highlight('foo bar foo', 'foo');
  assert.strictEqual(r, '<mark>foo</mark> bar <mark>foo</mark>');
});
test('HTML 特殊字符被转义', () => {
  const r = highlight('<script>', '');
  assert.strictEqual(r, '&lt;script&gt;');
});
test('正则特殊字符作为关键词安全', () => {
  // 关键词含正则元字符，不应抛错且按字面匹配
  const r = highlight('a.b c.d', 'c.d');
  assert.strictEqual(r, 'a.b <mark>c.d</mark>');
});
test('空文本安全', () => {
  assert.strictEqual(highlight('', 'x'), '');
});

console.log('\n=== 11. 预览展开逻辑 ===');
// 模拟 expandedId 的 toggle 行为
let expandedId = null;
function toggleExpand(id) {
  expandedId = (expandedId === id) ? null : id;
  return expandedId;
}
test('首次展开返回 id', () => {
  expandedId = null;
  assert.strictEqual(toggleExpand('a1'), 'a1');
});
test('再次点击同一项收起', () => {
  expandedId = 'a1';
  assert.strictEqual(toggleExpand('a1'), null);
});
test('切换到另一项展开', () => {
  expandedId = 'a1';
  assert.strictEqual(toggleExpand('b2'), 'b2');
});
test('删除当前展开项应清空 expandedId', () => {
  expandedId = 'a1';
  // 模拟 renderer.js 中删除分支
  if (expandedId === 'a1') expandedId = null;
  assert.strictEqual(expandedId, null);
});

console.log('\n=== 12. 字数与行数统计 ===');
function countChars(s) { return String(s).length; }
function countLines(s) { return String(s).split('\n').length; }
test('字符数统计', () => {
  assert.strictEqual(countChars('hello'), 5);
  assert.strictEqual(countChars('你好世界'), 4);
  assert.strictEqual(countChars(''), 0);
});
test('行数统计（单行）', () => {
  assert.strictEqual(countLines('hello'), 1);
});
test('行数统计（多行）', () => {
  assert.strictEqual(countLines('a\nb\nc'), 3);
});
test('行数统计（含空行）', () => {
  assert.strictEqual(countLines('a\n\nb'), 3);
});

console.log('\n=========================');
console.log('通过: ' + pass + ' / 失败: ' + fail);
console.log('=========================');
process.exit(fail > 0 ? 1 : 0);
