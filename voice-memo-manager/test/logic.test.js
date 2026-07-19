// test/logic.test.js - 核心逻辑测试（纯函数：时间/大小格式化、HTML转义、base64往返、列表过滤）
// 这些函数与 renderer.js 中的实现保持一致，用于验证算法正确性

const assert = require('assert');

// ========== 工具函数（与 renderer.js 同源） ==========
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return '今天 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return '昨天 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function base64ToBuffer(b64) {
  const bin = Buffer.from(b64, 'base64');
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}

function filterByQuery(list, q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return list.slice();
  return list.filter((r) => (r.title || '').toLowerCase().includes(q));
}

// ========== 测试 ==========
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' -> ' + e.message); fail++; }
}

console.log('时间格式化 fmtTime:');
test('0 秒 -> 00:00', () => assert.strictEqual(fmtTime(0), '00:00'));
test('5 秒 -> 00:05', () => assert.strictEqual(fmtTime(5), '00:05'));
test('65 秒 -> 01:05', () => assert.strictEqual(fmtTime(65), '01:05'));
test('3661 秒 -> 61:01', () => assert.strictEqual(fmtTime(3661), '61:01'));
test('负数归零 -> 00:00', () => assert.strictEqual(fmtTime(-10), '00:00'));
test('null -> 00:00', () => assert.strictEqual(fmtTime(null), '00:00'));
test('小数取整 -> 00:05', () => assert.strictEqual(fmtTime(5.9), '00:05'));

console.log('\n大小格式化 fmtSize:');
test('0 B', () => assert.strictEqual(fmtSize(0), '0 B'));
test('512 B', () => assert.strictEqual(fmtSize(512), '512 B'));
test('1024 B -> 1.0 KB', () => assert.strictEqual(fmtSize(1024), '1.0 KB'));
test('1536 B -> 1.5 KB', () => assert.strictEqual(fmtSize(1536), '1.5 KB'));
test('1 MB', () => assert.strictEqual(fmtSize(1024 * 1024), '1.0 MB'));
test('1.5 MB', () => assert.strictEqual(fmtSize(1024 * 1024 * 1.5), '1.5 MB'));

console.log('\n日期格式化 fmtDate:');
test('今天', () => {
  const r = fmtDate(Date.now());
  assert.ok(r.startsWith('今天 '), '应前缀"今天 "');
});
test('昨天', () => {
  const r = fmtDate(Date.now() - 24 * 3600 * 1000);
  assert.ok(r.startsWith('昨天 '), '应前缀"昨天 "');
});
test('更早显示月日', () => {
  const d = new Date(); d.setMonth(d.getMonth() - 2); d.setDate(3);
  const r = fmtDate(d.getTime());
  assert.ok(/月/.test(r) && /日/.test(r), '应包含"月"和"日": ' + r);
});

console.log('\nHTML 转义 escapeHtml:');
test('空字符串', () => assert.strictEqual(escapeHtml(''), ''));
test('null -> 空串', () => assert.strictEqual(escapeHtml(null), ''));
test('特殊字符转义', () => {
  assert.strictEqual(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});
test('单引号转义', () => assert.strictEqual(escapeHtml("a'b"), 'a&#39;b'));
test('与号转义', () => assert.strictEqual(escapeHtml('a&b'), 'a&amp;b'));
test('普通文本不变', () => assert.strictEqual(escapeHtml('hello world'), 'hello world'));

console.log('\nBase64 往返:');
test('已知字符串往返', () => {
  const orig = Buffer.from('hello voice memo', 'utf8');
  const b64 = orig.toString('base64');
  const back = Buffer.from(base64ToBuffer(b64));
  assert.strictEqual(back.toString('utf8'), 'hello voice memo');
});
test('空 buffer 往返', () => {
  const orig = Buffer.alloc(0);
  const b64 = orig.toString('base64');
  const back = Buffer.from(base64ToBuffer(b64));
  assert.strictEqual(back.length, 0);
});
test('二进制数据往返', () => {
  const orig = Buffer.from([0, 1, 2, 3, 255, 254, 128, 64]);
  const b64 = orig.toString('base64');
  const back = Buffer.from(base64ToBuffer(b64));
  assert.deepStrictEqual(Array.from(back), [0, 1, 2, 3, 255, 254, 128, 64]);
});

console.log('\n列表过滤 filterByQuery:');
const sampleList = [
  { id: '1', title: '会议录音 7月19日' },
  { id: '2', title: '英语口语练习' },
  { id: '3', title: '会议纪要' },
  { id: '4', title: '随机想法' }
];
test('空查询返回全部', () => assert.strictEqual(filterByQuery(sampleList, '').length, 4));
test('大小写不敏感', () => assert.strictEqual(filterByQuery(sampleList, 'HUI').length, 0));
test('中文匹配', () => assert.strictEqual(filterByQuery(sampleList, '会议').length, 2));
test('英文匹配', () => assert.strictEqual(filterByQuery(sampleList, 'english').length, 0));
test('部分匹配', () => assert.strictEqual(filterByQuery(sampleList, '录音').length, 1));
test('空列表', () => assert.strictEqual(filterByQuery([], 'test').length, 0));
test('null 查询视为空', () => assert.strictEqual(filterByQuery(sampleList, null).length, 4));
test('空白查询视为空', () => assert.strictEqual(filterByQuery(sampleList, '   ').length, 4));

console.log('\n========================================');
console.log('通过: ' + pass + ' / 失败: ' + fail);
console.log('========================================');
if (fail > 0) process.exit(1);
