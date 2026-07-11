// 换算管家 - 核心逻辑测试
// 用 node:test 运行：node --test test/test.js

const test = require('node:test');
const assert = require('node:assert');
const conv = require('../src/core/converter');
const store = require('../src/core/store');

test('长度：1 m = 100 cm', () => {
  assert.strictEqual(conv.convert('length', 'm', 1, 'cm'), 100);
});

test('长度：1 km = 1000 m', () => {
  assert.strictEqual(conv.convert('length', 'km', 1, 'm'), 1000);
});

test('长度：1 英寸 = 2.54 厘米', () => {
  assert.strictEqual(conv.convert('length', 'in', 1, 'cm'), 2.54);
});

test('长度：1 英里 = 1.609344 千米', () => {
  assert.strictEqual(conv.convert('length', 'mi', 1, 'km'), 1.609344);
});

test('温度：0℃ = 32℉', () => {
  assert.strictEqual(conv.convert('temperature', 'c', 0, 'f'), 32);
});

test('温度：100℃ = 212℉', () => {
  assert.strictEqual(conv.convert('temperature', 'c', 100, 'f'), 212);
});

test('温度：0℃ = 273.15 K', () => {
  assert.strictEqual(conv.convert('temperature', 'c', 0, 'k'), 273.15);
});

test('温度反向：32℉ = 0℃', () => {
  assert.strictEqual(conv.convert('temperature', 'f', 32, 'c'), 0);
});

test('质量：1 kg = 2.2046226218 磅', () => {
  assert.ok(Math.abs(conv.convert('mass', 'kg', 1, 'lb') - 2.2046226218487757) < 1e-9);
});

test('质量：1 市斤 = 0.5 kg', () => {
  assert.strictEqual(conv.convert('mass', 'jin', 1, 'kg'), 0.5);
});

test('体积：1 升 = 1000 毫升', () => {
  assert.strictEqual(conv.convert('volume', 'l', 1, 'ml'), 1000);
});

test('体积：1 美制加仑 = 3.785411784 升', () => {
  assert.strictEqual(conv.convert('volume', 'gal_us', 1, 'l'), 3.785411784);
});

test('速度：1 km/h = 0.2777... m/s', () => {
  assert.ok(Math.abs(conv.convert('speed', 'kmh', 1, 'mps') - 1 / 3.6) < 1e-9);
});

test('时间：1 小时 = 3600 秒', () => {
  assert.strictEqual(conv.convert('time', 'h', 1, 's'), 3600);
});

test('数据：1 KB = 8192 bit', () => {
  assert.strictEqual(conv.convert('data', 'kb', 1, 'bit'), 8192);
});

test('压力：1 atm = 101325 Pa', () => {
  assert.strictEqual(conv.convert('pressure', 'atm', 1, 'pa'), 101325);
});

test('能量：1 kWh = 3600000 J', () => {
  assert.strictEqual(conv.convert('energy', 'kwh', 1, 'j'), 3.6e6);
});

test('进制：十进制 255 = 十六进制 FF', () => {
  assert.strictEqual(conv.convert('digital', 'dec', 255, 'hex'), 'FF');
});

// 进制类 fromBase 返回字符串
test('进制：二进制 1010 = 十进制 10', () => {
  assert.strictEqual(conv.convert('digital', 'bin', '1010', 'dec'), '10');
});

test('进制：十六进制 FF = 十进制 255', () => {
  assert.strictEqual(conv.convert('digital', 'hex', 'FF', 'dec'), '255');
});

test('convertAll 返回所有单位', () => {
  const results = conv.convertAll('length', 'm', 1);
  assert.ok(results.length > 0);
  const cm = results.find(r => r.unitId === 'cm');
  assert.strictEqual(cm.value, '100');
});

test('convertAll 温度也能批量换算', () => {
  const results = conv.convertAll('temperature', 'c', 100);
  const f = results.find(r => r.unitId === 'f');
  assert.strictEqual(f.value, '212');
});

test('parseInput 支持小数和负数', () => {
  assert.strictEqual(conv.parseInput('3.14'), 3.14);
  assert.strictEqual(conv.parseInput('-5'), -5);
  assert.strictEqual(conv.parseInput('1e3'), 1000);
  assert.strictEqual(conv.parseInput('1,000.5'), 1000.5);
  assert.strictEqual(conv.parseInput(''), null);
  assert.strictEqual(conv.parseInput('abc'), null);
});

test('formatValue 截断浮点尾巴', () => {
  assert.strictEqual(conv.formatValue(0.1 + 0.2), '0.3');
  assert.strictEqual(conv.formatValue(100), '100');
  assert.strictEqual(conv.formatValue(0), '0');
  assert.strictEqual(conv.formatValue(1e20), '1.000000000e+20');
});

// ---- 存储逻辑 ----

test('addHistory 限制 50 条', () => {
  let s = store.createState();
  for (let i = 0; i < 60; i++) {
    s = store.addHistory(s, { categoryId: 'length', fromUnitId: 'm', toUnitId: 'cm', value: i, ts: i });
  }
  assert.strictEqual(s.history.length, 50);
  assert.strictEqual(s.history[0].value, 59); // 最新在前
});

test('clearHistory 清空历史', () => {
  let s = store.createState();
  s = store.addHistory(s, { categoryId: 'length' });
  s = store.clearHistory(s);
  assert.strictEqual(s.history.length, 0);
});

test('addFavorite 去重', () => {
  let s = store.createState();
  const fav = { categoryId: 'length', fromUnitId: 'm', toUnitId: 'cm' };
  s = store.addFavorite(s, fav);
  s = store.addFavorite(s, fav);
  assert.strictEqual(s.favorites.length, 1);
  assert.strictEqual(store.isFavorite(s, fav), true);
});

test('removeFavorite 移除', () => {
  let s = store.createState();
  const fav = { categoryId: 'length', fromUnitId: 'm', toUnitId: 'cm' };
  s = store.addFavorite(s, fav);
  s = store.removeFavorite(s, fav);
  assert.strictEqual(s.favorites.length, 0);
  assert.strictEqual(store.isFavorite(s, fav), false);
});

test('setLast 记录最后状态', () => {
  let s = store.createState();
  s = store.setLast(s, { categoryId: 'mass', fromUnitId: 'kg' });
  assert.strictEqual(s.lastCategory, 'mass');
  assert.strictEqual(s.lastFromUnit, 'kg');
});

console.log('\n所有测试通过 ✅');
