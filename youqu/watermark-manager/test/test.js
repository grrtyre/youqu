'use strict';
// 水印管家 - 核心逻辑测试
// 运行: node test/test.js

const assert = require('assert');
const {
  DEFAULT_CONFIG,
  TEMPLATES,
  resolveVariables,
  mergeConfig,
  validateConfig,
  formatTime
} = require('../src/core/watermark-core');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failed++;
    console.log('  ✗ ' + name + ' — ' + err.message);
  }
}

console.log('\n=== 水印管家核心逻辑测试 ===\n');

// ---- DEFAULT_CONFIG ----
console.log('默认配置:');
test('DEFAULT_CONFIG 含必要字段', () => {
  assert.strictEqual(typeof DEFAULT_CONFIG.enabled, 'boolean');
  assert.strictEqual(typeof DEFAULT_CONFIG.content, 'string');
  assert.strictEqual(typeof DEFAULT_CONFIG.fontSize, 'number');
  assert.strictEqual(typeof DEFAULT_CONFIG.color, 'string');
  assert.ok(DEFAULT_CONFIG.content.length > 0);
});

test('DEFAULT_CONFIG 颜色格式合法', () => {
  assert.ok(/^#[0-9a-fA-F]{6}$/.test(DEFAULT_CONFIG.color));
});

test('DEFAULT_CONFIG opacity 在合理范围', () => {
  assert.ok(DEFAULT_CONFIG.opacity > 0 && DEFAULT_CONFIG.opacity <= 0.5);
});

// ---- resolveVariables ----
console.log('\n变量替换:');
test('替换 {USERNAME}', () => {
  const result = resolveVariables('工号:{USERNAME}', { username: 'zhangsan' });
  assert.strictEqual(result, '工号:zhangsan');
});

test('替换多个变量', () => {
  const result = resolveVariables('{IP} {TIME} {MACHINE}', {
    ip: '192.168.1.1', time: '14:30', machine: 'PC-001'
  });
  assert.strictEqual(result, '192.168.1.1 14:30 PC-001');
});

test('变量缺失时替换为空', () => {
  const result = resolveVariables('用户:{USERNAME}', {});
  assert.strictEqual(result, '用户:');
});

test('无变量时原样返回', () => {
  const result = resolveVariables('内部资料', {});
  assert.strictEqual(result, '内部资料');
});

test('空内容返回空字符串', () => {
  assert.strictEqual(resolveVariables('', { username: 'x' }), '');
  assert.strictEqual(resolveVariables(null, {}), '');
});

test('同一变量多次出现全部替换', () => {
  const result = resolveVariables('{USERNAME}-{USERNAME}', { username: 'admin' });
  assert.strictEqual(result, 'admin-admin');
});

// ---- mergeConfig ----
console.log('\n配置合并:');
test('空配置返回默认', () => {
  const merged = mergeConfig(null);
  assert.deepStrictEqual(merged, DEFAULT_CONFIG);
});

test('部分配置合并保留默认值', () => {
  const merged = mergeConfig({ content: '测试', fontSize: 20 });
  assert.strictEqual(merged.content, '测试');
  assert.strictEqual(merged.fontSize, 20);
  assert.strictEqual(merged.color, DEFAULT_CONFIG.color);
  assert.strictEqual(merged.opacity, DEFAULT_CONFIG.opacity);
});

test('null 值不覆盖默认', () => {
  const merged = mergeConfig({ content: null, fontSize: 18 });
  assert.strictEqual(merged.content, DEFAULT_CONFIG.content);
  assert.strictEqual(merged.fontSize, 18);
});

// ---- validateConfig ----
console.log('\n配置校验:');
test('字号超出范围被限制', () => {
  const c = validateConfig({ fontSize: 200 });
  assert.strictEqual(c.fontSize, 72);
  const c2 = validateConfig({ fontSize: 1 });
  assert.strictEqual(c2.fontSize, 8);
});

test('透明度超出范围被限制', () => {
  const c = validateConfig({ opacity: 0.99 });
  assert.strictEqual(c.opacity, 0.5);
  const c2 = validateConfig({ opacity: 0 });
  assert.strictEqual(c2.opacity, 0.02);
});

test('非法颜色回退默认', () => {
  const c = validateConfig({ color: 'red' });
  assert.strictEqual(c.color, '#888888');
  const c2 = validateConfig({ color: '#xyz123' });
  assert.strictEqual(c2.color, '#888888');
});

test('合法颜色保留', () => {
  const c = validateConfig({ color: '#007aff' });
  assert.strictEqual(c.color, '#007aff');
});

test('旋转角度限制', () => {
  const c = validateConfig({ rotation: 180 });
  assert.strictEqual(c.rotation, 90);
  const c2 = validateConfig({ rotation: -180 });
  assert.strictEqual(c2.rotation, -90);
});

test('间距限制', () => {
  const c = validateConfig({ gapX: 50, gapY: 30 });
  assert.strictEqual(c.gapX, 80);
  assert.strictEqual(c.gapY, 60);
  const c2 = validateConfig({ gapX: 2000, gapY: 1000 });
  assert.strictEqual(c2.gapX, 1000);
  assert.strictEqual(c2.gapY, 800);
});

test('布尔值强制转换', () => {
  const c = validateConfig({ enabled: 1, showUserName: 'yes', autoStart: 0 });
  assert.strictEqual(c.enabled, true);
  assert.strictEqual(c.showUserName, true);
  assert.strictEqual(c.autoStart, false);
});

test('空内容回退默认', () => {
  const c = validateConfig({ content: '' });
  assert.strictEqual(c.content, DEFAULT_CONFIG.content);
  const c2 = validateConfig({ content: null });
  assert.strictEqual(c2.content, DEFAULT_CONFIG.content);
});

test('NaN 数值回退最小值', () => {
  const c = validateConfig({ fontSize: 'abc', opacity: 'xyz' });
  assert.strictEqual(c.fontSize, 8);
  assert.strictEqual(c.opacity, 0.02);
});

// ---- formatTime ----
console.log('\n时间格式化:');
test('完整格式 YYYY-MM-DD HH:mm', () => {
  const d = new Date(2026, 6, 12, 14, 30);
  const result = formatTime(d, 'YYYY-MM-DD HH:mm');
  assert.strictEqual(result, '2026-07-12 14:30');
});

test('带秒格式', () => {
  const d = new Date(2026, 6, 12, 14, 30, 45);
  const result = formatTime(d, 'YYYY/MM/DD HH:mm:ss');
  assert.strictEqual(result, '2026/07/12 14:30:45');
});

test('仅时间', () => {
  const d = new Date(2026, 0, 1, 9, 5);
  const result = formatTime(d, 'HH:mm');
  assert.strictEqual(result, '09:05');
});

test('默认格式', () => {
  const d = new Date(2026, 6, 12, 14, 30);
  const result = formatTime(d);
  assert.strictEqual(result, '2026-07-12 14:30');
});

test('月份补零', () => {
  const d = new Date(2026, 0, 5, 8, 3);
  const result = formatTime(d, 'YYYY-MM-DD HH:mm');
  assert.strictEqual(result, '2026-01-05 08:03');
});

// ---- TEMPLATES ----
console.log('\n模板:');
test('模板数量 >= 4', () => {
  assert.ok(TEMPLATES.length >= 4);
});

test('每个模板有必要字段', () => {
  for (const tpl of TEMPLATES) {
    assert.ok(tpl.id, '模板缺 id');
    assert.ok(tpl.name, '模板缺 name');
    assert.ok(tpl.content, '模板缺 content');
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(tpl.color), '模板颜色非法: ' + tpl.color);
    assert.ok(tpl.opacity > 0 && tpl.opacity <= 0.5, '模板透明度异常');
  }
});

test('模板 id 唯一', () => {
  const ids = TEMPLATES.map(t => t.id);
  const unique = new Set(ids);
  assert.strictEqual(ids.length, unique.size);
});

// ---- 总结 ----
console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ' / 失败: ' + failed);
if (failed > 0) {
  console.log('❌ 存在失败用例');
  process.exit(1);
} else {
  console.log('✅ 全部通过');
}
