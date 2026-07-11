'use strict';
// Hosts管家 - 核心逻辑测试
// 运行: node test/test.js

const assert = require('assert');
const {
  parseHosts,
  serializeHosts,
  serializeLine,
  toggleEntry,
  addEntry,
  removeEntry,
  updateEntry,
  TEMPLATES,
  diffContent,
  getStats,
  isValidAddress,
  matchEntry
} = require('../src/core/hosts-core');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
    passed++;
  } catch (err) {
    console.log('  ✗ ' + name + ' — ' + err.message);
    failed++;
  }
}

console.log('\n=== Hosts管家 核心逻辑测试 ===\n');

// --- 解析测试 ---
console.log('解析测试:');

test('解析正常条目', () => {
  const items = parseHosts('127.0.0.1 localhost');
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].type, 'entry');
  assert.strictEqual(items[0].ip, '127.0.0.1');
  assert.deepStrictEqual(items[0].hostnames, ['localhost']);
  assert.strictEqual(items[0].enabled, true);
});

test('解析带注释的条目', () => {
  const items = parseHosts('127.0.0.1 localhost # local loopback');
  assert.strictEqual(items[0].comment, 'local loopback');
});

test('解析被注释的条目', () => {
  const items = parseHosts('# 127.0.0.1 ad.example.com');
  assert.strictEqual(items[0].type, 'entry');
  assert.strictEqual(items[0].enabled, false);
  assert.strictEqual(items[0].ip, '127.0.0.1');
});

test('解析纯注释行', () => {
  const items = parseHosts('# This is a comment');
  assert.strictEqual(items[0].type, 'comment');
  assert.strictEqual(items[0].text, 'This is a comment');
});

test('解析空行', () => {
  const items = parseHosts('127.0.0.1 localhost\n\n::1 localhost');
  assert.strictEqual(items.length, 3);
  assert.strictEqual(items[1].type, 'blank');
});

test('解析多个域名', () => {
  const items = parseHosts('192.168.1.1 server1 server2 server3');
  assert.strictEqual(items[0].hostnames.length, 3);
  assert.deepStrictEqual(items[0].hostnames, ['server1', 'server2', 'server3']);
});

test('解析 IPv6 地址', () => {
  const items = parseHosts('::1 localhost');
  assert.strictEqual(items[0].type, 'entry');
  assert.strictEqual(items[0].ip, '::1');
});

test('解析多行复杂 hosts', () => {
  const text = '# Comment line\n127.0.0.1 localhost\n# 0.0.0.0 ad.com\n192.168.1.10 dev.local api.local # dev servers\n';
  const items = parseHosts(text);
  assert.strictEqual(items.length, 5);
  assert.strictEqual(items[0].type, 'comment');
  assert.strictEqual(items[1].type, 'entry');
  assert.strictEqual(items[2].type, 'entry');
  assert.strictEqual(items[2].enabled, false);
  assert.strictEqual(items[3].hostnames.length, 2);
  assert.strictEqual(items[3].comment, 'dev servers');
  assert.strictEqual(items[4].type, 'blank');
});

// --- 序列化测试 ---
console.log('\n序列化测试:');

test('序列化条目', () => {
  const items = parseHosts('127.0.0.1 localhost');
  const text = serializeHosts(items);
  assert.strictEqual(text, '127.0.0.1 localhost');
});

test('序列化禁用条目', () => {
  const items = parseHosts('127.0.0.1 localhost');
  items[0].enabled = false;
  items[0].raw = serializeLine(items[0]);
  const text = serializeHosts(items);
  assert.strictEqual(text, '# 127.0.0.1 localhost');
});

test('序列化带注释', () => {
  const items = parseHosts('127.0.0.1 localhost # loopback');
  const text = serializeHosts(items);
  assert.strictEqual(text, '127.0.0.1 localhost  # loopback');
});

test('往返：解析→序列化→解析一致', () => {
  const original = '127.0.0.1 localhost\n::1 localhost\n192.168.1.10 dev.local # dev\n';
  const items = parseHosts(original);
  const text = serializeHosts(items);
  const items2 = parseHosts(text);
  assert.strictEqual(items2.length, items.length);
  assert.strictEqual(items2[0].ip, '127.0.0.1');
  assert.strictEqual(items2[2].comment, 'dev');
});

// --- 条目操作 ---
console.log('\n条目操作测试:');

test('切换条目启用状态', () => {
  const items = parseHosts('127.0.0.1 localhost');
  const toggled = toggleEntry([...items], 0);
  assert.strictEqual(toggled[0].enabled, false);
  const toggled2 = toggleEntry(toggled, 0);
  assert.strictEqual(toggled2[0].enabled, true);
});

test('添加条目', () => {
  const items = [];
  const result = addEntry(items, '0.0.0.0', 'ad.com spam.com', 'block');
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].ip, '0.0.0.0');
  assert.strictEqual(result[0].hostnames.length, 2);
  assert.strictEqual(result[0].comment, 'block');
});

test('删除条目', () => {
  const items = parseHosts('127.0.0.1 a\n127.0.0.2 b\n127.0.0.3 c');
  const result = removeEntry(items, 1);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[1].ip, '127.0.0.3');
});

test('更新条目', () => {
  const items = parseHosts('127.0.0.1 localhost');
  const result = updateEntry(items, 0, { ip: '127.0.0.2', comment: 'updated' });
  assert.strictEqual(result[0].ip, '127.0.0.2');
  assert.strictEqual(result[0].comment, 'updated');
});

// --- 统计测试 ---
console.log('\n统计测试:');

test('统计条目', () => {
  const items = parseHosts('127.0.0.1 a\n# 127.0.0.2 b\n# comment\n127.0.0.3 c');
  const stats = getStats(items);
  assert.strictEqual(stats.enabled, 2);
  assert.strictEqual(stats.disabled, 1);
  assert.strictEqual(stats.comments, 1);
  assert.strictEqual(stats.total, 3);
});

// --- 差异对比 ---
console.log('\n差异对比测试:');

test('差异对比 - 新增行', () => {
  const diff = diffContent('a\nb', 'a\nb\nc');
  assert.strictEqual(diff.length, 3);
  assert.strictEqual(diff[2].type, 'add');
  assert.strictEqual(diff[2].line, 'c');
});

test('差异对比 - 删除行', () => {
  const diff = diffContent('a\nb\nc', 'a\nb');
  assert.strictEqual(diff[2].type, 'del');
  assert.strictEqual(diff[2].line, 'c');
});

test('差异对比 - 相同行', () => {
  const diff = diffContent('a\nb', 'a\nb');
  assert.strictEqual(diff[0].type, 'same');
  assert.strictEqual(diff[1].type, 'same');
});

test('差异对比 - LCS 中间插入', () => {
  // 旧: a b c，新: a x b c —— 应识别 b c 为相同行，只有 x 是新增
  const diff = diffContent('a\nb\nc', 'a\nx\nb\nc');
  const types = diff.map(d => d.type);
  // LCS 正确结果: same(a) add(x) same(b) same(c)
  assert.strictEqual(types.join(','), 'same,add,same,same');
  assert.strictEqual(diff[1].type, 'add');
  assert.strictEqual(diff[1].line, 'x');
});

test('差异对比 - LCS 中间删除', () => {
  // 旧: a b c d，新: a c d —— 应识别 a c d 为相同行，只有 b 被删除
  const diff = diffContent('a\nb\nc\nd', 'a\nc\nd');
  const types = diff.map(d => d.type);
  assert.strictEqual(types.join(','), 'same,del,same,same');
  assert.strictEqual(diff[1].type, 'del');
  assert.strictEqual(diff[1].line, 'b');
});

test('差异对比 - LCS 完全替换', () => {
  const diff = diffContent('x\ny', 'a\nb');
  assert.strictEqual(diff.length, 4);
  const adds = diff.filter(d => d.type === 'add');
  const dels = diff.filter(d => d.type === 'del');
  assert.strictEqual(adds.length, 2);
  assert.strictEqual(dels.length, 2);
});

// --- 地址校验 ---
console.log('\n地址校验测试:');

test('校验 IPv4 地址', () => {
  assert.strictEqual(isValidAddress('127.0.0.1'), true);
  assert.strictEqual(isValidAddress('192.168.1.1'), true);
  assert.strictEqual(isValidAddress('0.0.0.0'), true);
});

test('校验 IPv6 地址', () => {
  assert.strictEqual(isValidAddress('::1'), true);
  assert.strictEqual(isValidAddress('fe80::1'), true);
});

test('拒绝非法地址', () => {
  assert.strictEqual(isValidAddress('localhost'), false);
  assert.strictEqual(isValidAddress('not_an_ip'), false);
  assert.strictEqual(isValidAddress(''), false);
});

// --- 模板测试 ---
console.log('\n模板测试:');

test('模板非空', () => {
  assert.ok(TEMPLATES.length >= 3, '应有至少 3 个模板');
  for (const t of TEMPLATES) {
    assert.ok(t.name, '模板应有名称');
    assert.ok(t.content, '模板应有内容');
  }
});

test('模板可被解析', () => {
  for (const t of TEMPLATES) {
    const items = parseHosts(t.content);
    assert.ok(items.length > 0, '模板内容应可被解析为条目');
  }
});

// --- 边界情况 ---
console.log('\n边界情况测试:');

test('空字符串解析', () => {
  const items = parseHosts('');
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].type, 'blank');
});

test('只有空行的文本', () => {
  const items = parseHosts('\n\n\n');
  assert.strictEqual(items.length, 4);
  for (const item of items) {
    assert.strictEqual(item.type, 'blank');
  }
});

test('matchEntry 处理单 IP 无域名', () => {
  const result = matchEntry('127.0.0.1');
  // 只有 IP 没有域名，应该返回 null
  assert.strictEqual(result, null);
});

// --- 结果 ---
console.log('\n=== 测试结果 ===');
console.log('  通过: ' + passed + ' / ' + (passed + failed));
if (failed > 0) {
  console.log('  失败: ' + failed);
  process.exit(1);
} else {
  console.log('  全部通过 ✓');
  process.exit(0);
}
