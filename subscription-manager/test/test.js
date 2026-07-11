// test.js - 核心逻辑测试
const utils = require('../src/core/subscription-utils');
const assert = require('assert');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS: ' + name);
  } catch (e) {
    fail++;
    console.error('  FAIL: ' + name + ' - ' + e.message);
  }
}

console.log('订阅管家 - 核心逻辑测试\n');

console.log('价格换算:');
test('月付转月均 = 原价', () => {
  assert.strictEqual(utils.toMonthly(30, 'monthly'), 30);
});
test('年付转月均 = /12', () => {
  assert.strictEqual(utils.toMonthly(120, 'yearly'), 10);
});
test('季付转月均 = /3', () => {
  assert.strictEqual(utils.toMonthly(30, 'quarterly'), 10);
});
test('月付转年均 = *12', () => {
  assert.strictEqual(utils.toYearly(30, 'monthly'), 360);
});
test('年付转年均 = 原价', () => {
  assert.strictEqual(utils.toYearly(120, 'yearly'), 120);
});

console.log('\n续费日期计算:');
test('月付下次续费日期', () => {
  const d = utils.upcomingRenewal('2026-01-15', 'monthly');
  assert.ok(d instanceof Date);
});
test('距今天数', () => {
  const future = new Date();
  future.setDate(future.getDate() + 5);
  const days = utils.daysUntil(future.toISOString().slice(0, 10));
  assert.strictEqual(days, 5);
});
test('今天的距今天数=0', () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.strictEqual(utils.daysUntil(today), 0);
});

console.log('\n统计计算:');
test('computeStats 汇总', () => {
  const subs = [
    { id: '1', name: 'A', price: 30, cycle: 'monthly', startDate: '2026-01-15', active: true },
    { id: '2', name: 'B', price: 120, cycle: 'yearly', startDate: '2026-01-15', active: true },
    { id: '3', name: 'C', price: 10, cycle: 'monthly', startDate: '2026-01-15', active: false }
  ];
  const stats = utils.computeStats(subs);
  assert.strictEqual(stats.activeCount, 2);
  assert.strictEqual(stats.monthlyTotal, 40); // 30 + 10
  assert.strictEqual(stats.yearlyTotal, 480); // 360 + 120
});

console.log('\n分类统计:');
test('categoryBreakdown 分组', () => {
  const subs = [
    { id: '1', name: 'A', price: 30, cycle: 'monthly', startDate: '2026-01-15', category: '流媒体', active: true },
    { id: '2', name: 'B', price: 10, cycle: 'monthly', startDate: '2026-01-15', category: '流媒体', active: true },
    { id: '3', name: 'C', price: 120, cycle: 'yearly', startDate: '2026-01-15', category: '软件', active: true }
  ];
  const cats = utils.categoryBreakdown(subs);
  assert.strictEqual(cats.length, 2);
  assert.strictEqual(cats[0].category, '流媒体');
  assert.strictEqual(cats[0].count, 2);
  assert.strictEqual(cats[0].monthly, 40);
});

console.log('\n=============================');
console.log('通过: ' + pass + ' | 失败: ' + fail);
console.log(fail === 0 ? 'ALL PASSED' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
