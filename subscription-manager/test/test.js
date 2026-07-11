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

console.log('\n停用订阅统计:');
test('已停用订阅不计入活跃统计', () => {
  const subs = [
    { id: '1', name: 'A', price: 30, cycle: 'monthly', startDate: '2026-01-15', active: true },
    { id: '2', name: 'B', price: 10, cycle: 'monthly', startDate: '2026-01-15', active: false }
  ];
  const stats = utils.computeStats(subs);
  assert.strictEqual(stats.activeCount, 1);
  assert.strictEqual(stats.monthlyTotal, 30);
});
test('已停用订阅不计入分类统计', () => {
  const subs = [
    { id: '1', name: 'A', price: 30, cycle: 'monthly', startDate: '2026-01-15', category: '流媒体', active: false },
    { id: '2', name: 'B', price: 10, cycle: 'monthly', startDate: '2026-01-15', category: '流媒体', active: true }
  ];
  const cats = utils.categoryBreakdown(subs);
  assert.strictEqual(cats.length, 1);
  assert.strictEqual(cats[0].count, 1);
  assert.strictEqual(cats[0].monthly, 10);
});

console.log('\nCSV 导出导入:');
test('toCSV 生成表头与数据行', () => {
  const subs = [
    { id: '1', name: 'Netflix', price: 68, cycle: 'monthly', startDate: '2026-06-16', category: '流媒体', note: '标准套餐', active: true }
  ];
  const csv = utils.toCSV(subs);
  const lines = csv.trim().split('\n');
  assert.strictEqual(lines[0], '名称,价格,计费周期,开始日期,分类,备注,状态');
  assert.ok(lines[1].includes('Netflix'));
  assert.ok(lines[1].includes('68'));
  assert.ok(lines[1].includes('月付'));
  assert.ok(lines[1].includes('活跃'));
});
test('toCSV 空列表仅含表头', () => {
  const csv = utils.toCSV([]);
  assert.strictEqual(csv.trim(), '名称,价格,计费周期,开始日期,分类,备注,状态');
});
test('toCSV 转义含逗号的字段', () => {
  const subs = [
    { id: '1', name: 'A,B', price: 10, cycle: 'monthly', startDate: '2026-01-01', category: '其他', note: '', active: true }
  ];
  const csv = utils.toCSV(subs);
  assert.ok(csv.includes('"A,B"'));
});
test('fromCSV 正确解析并还原', () => {
  const csv = '名称,价格,计费周期,开始日期,分类,备注,状态\nNetflix,68,月付,2026-06-16,流媒体,标准套餐,活跃\n';
  const subs = utils.fromCSV(csv);
  assert.strictEqual(subs.length, 1);
  assert.strictEqual(subs[0].name, 'Netflix');
  assert.strictEqual(subs[0].price, 68);
  assert.strictEqual(subs[0].cycle, 'monthly');
  assert.strictEqual(subs[0].startDate, '2026-06-16');
  assert.strictEqual(subs[0].category, '流媒体');
  assert.strictEqual(subs[0].note, '标准套餐');
  assert.strictEqual(subs[0].active, true);
});
test('fromCSV 解析已停用状态', () => {
  const csv = '名称,价格,计费周期,开始日期,分类,备注,状态\nA,10,月付,2026-01-01,其他,,已停用\n';
  const subs = utils.fromCSV(csv);
  assert.strictEqual(subs[0].active, false);
});
test('fromCSV 跳过非法行（缺列/无名称）', () => {
  const csv = '名称,价格,计费周期,开始日期,分类,备注,状态\n,10,月付,2026-01-01,其他,,活跃\nNetflix,68,月付,2026-06-16,流媒体,,活跃\n';
  const subs = utils.fromCSV(csv);
  assert.strictEqual(subs.length, 1);
  assert.strictEqual(subs[0].name, 'Netflix');
});
test('toCSV -> fromCSV 往返一致', () => {
  const subs = [
    { id: '1', name: 'Spotify', price: 11, cycle: 'monthly', startDate: '2026-06-13', category: '音乐', note: '个人版', active: true },
    { id: '2', name: 'JetBrains', price: 899, cycle: 'yearly', startDate: '2025-09-14', category: '软件工具', note: '', active: false }
  ];
  const csv = utils.toCSV(subs);
  const back = utils.fromCSV(csv);
  assert.strictEqual(back.length, 2);
  assert.strictEqual(back[0].name, 'Spotify');
  assert.strictEqual(back[0].cycle, 'monthly');
  assert.strictEqual(back[1].cycle, 'yearly');
  assert.strictEqual(back[1].active, false);
});
test('fromCSV 解析含引号字段', () => {
  const csv = '名称,价格,计费周期,开始日期,分类,备注,状态\n"A,B,C",10,月付,2026-01-01,其他,"含""引号",活跃\n';
  const subs = utils.fromCSV(csv);
  assert.strictEqual(subs[0].name, 'A,B,C');
  assert.strictEqual(subs[0].note, '含"引号');
});

console.log('\n=============================');
console.log('通过: ' + pass + ' | 失败: ' + fail);
console.log(fail === 0 ? 'ALL PASSED' : 'HAS FAILURES');
process.exit(fail === 0 ? 0 : 1);
