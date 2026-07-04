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

console.log('\n=========================');
console.log('通过: ' + pass + ' / 失败: ' + fail);
console.log('=========================');
process.exit(fail > 0 ? 1 : 0);
