// 分账助手 - 核心账务逻辑测试
// 运行: node test/accounting.test.js
// 退出码 0 = 全部通过，1 = 有失败

'use strict';

const assert = require('assert');
const A = require('../src/lib/accounting');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.error('  ✗ ' + name);
    console.error('    ' + e.message);
  }
}

console.log('\n=== 分账助手核心逻辑测试 ===\n');

// --- 单位换算 ---
console.log('[单位换算]');
test('yuanToFen 正数四舍五入', () => {
  assert.strictEqual(A.yuanToFen(12.34), 1234);
  assert.strictEqual(A.yuanToFen('0.01'), 1);
  assert.strictEqual(A.yuanToFen(0.005), 1); // 四舍五入
});
test('yuanToFen 非法值返回0', () => {
  assert.strictEqual(A.yuanToFen(NaN), 0);
  assert.strictEqual(A.yuanToFen('abc'), 0);
  assert.strictEqual(A.yuanToFen(undefined), 0);
});
test('fenToYuan 两位小数', () => {
  assert.strictEqual(A.fenToYuan(1234), '12.34');
  assert.strictEqual(A.fenToYuan(1), '0.01');
  assert.strictEqual(A.fenToYuan(0), '0.00');
});

// --- 均摊 ---
console.log('\n[均摊 splitType=equal]');
test('3人均摊100元：每人33.34/33.33/33.33，总和=100', () => {
  const g = A.createGroup('测试');
  A.createMember(g, 'A');
  A.createMember(g, 'B');
  A.createMember(g, 'C');
  const exp = {
    description: '聚餐',
    amount: 100,
    payerId: g.members[0].id,
    splitType: 'equal',
  };
  const shares = A.computeShares({ ...exp, amount: A.yuanToFen(exp.amount) }, g);
  const sum = Object.values(shares).reduce((s, v) => s + v, 0);
  assert.strictEqual(sum, 10000, '分摊总和必须等于100元(10000分)');
  // 余数应分给前几个
  assert.strictEqual(shares[g.members[0].id], 3334);
  assert.strictEqual(shares[g.members[1].id], 3333);
  assert.strictEqual(shares[g.members[2].id], 3333);
});
test('指定部分成员均摊', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  A.createMember(g, 'C');
  const exp = {
    amount: A.yuanToFen(90),
    payerId: a.id,
    splitType: 'equal',
    splits: [a.id, b.id],
  };
  const shares = A.computeShares(exp, g);
  assert.strictEqual(Object.keys(shares).length, 2);
  assert.strictEqual(shares[a.id], 4500);
  assert.strictEqual(shares[b.id], 4500);
});

// --- 按份数 ---
console.log('\n[按份数 splitType=share]');
test('2人按1:2份数分摊90元 = 30/60', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  const exp = {
    amount: A.yuanToFen(90),
    payerId: a.id,
    splitType: 'share',
    splits: { [a.id]: 1, [b.id]: 2 },
  };
  const shares = A.computeShares(exp, g);
  const sum = Object.values(shares).reduce((s, v) => s + v, 0);
  assert.strictEqual(sum, 9000);
  assert.strictEqual(shares[a.id], 3000);
  assert.strictEqual(shares[b.id], 6000);
});

// --- 指定金额 ---
console.log('\n[指定金额 splitType=exact]');
test('指定金额分摊，总和可能≠账单金额', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  const exp = {
    amount: A.yuanToFen(100),
    payerId: a.id,
    splitType: 'exact',
    splits: { [a.id]: A.yuanToFen(40), [b.id]: A.yuanToFen(40) },
  };
  const shares = A.computeShares(exp, g);
  assert.strictEqual(shares[a.id], 4000);
  assert.strictEqual(shares[b.id], 4000);
});

// --- 百分比 ---
console.log('\n[百分比 splitType=percent]');
test('百分比分摊100元，50%/50% = 50/50', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  const exp = {
    amount: A.yuanToFen(100),
    payerId: a.id,
    splitType: 'percent',
    splits: { [a.id]: 50, [b.id]: 50 },
  };
  const shares = A.computeShares(exp, g);
  assert.strictEqual(shares[a.id], 5000);
  assert.strictEqual(shares[b.id], 5000);
});

// --- 余额计算 ---
console.log('\n[余额计算]');
test('A垫付300，3人均摊：A余额+200，B/C各-100', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  const c = A.createMember(g, 'C');
  const g2 = A.addExpense(g, {
    description: '房租',
    amount: 300,
    payerId: a.id,
    splitType: 'equal',
  });
  const bal = A.computeBalances(g2);
  assert.strictEqual(bal[a.id], 20000, 'A应+200元');
  assert.strictEqual(bal[b.id], -10000, 'B应-100元');
  assert.strictEqual(bal[c.id], -10000, 'C应-100元');
});
test('余额总和必须为0（守恒）', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  const c = A.createMember(g, 'C');
  let g2 = A.addExpense(g, { amount: 250, payerId: a.id, splitType: 'equal' });
  g2 = A.addExpense(g2, { amount: 80, payerId: b.id, splitType: 'percent', splits: { [a.id]: 30, [b.id]: 30, [c.id]: 40 } });
  const bal = A.computeBalances(g2);
  const sum = Object.values(bal).reduce((s, v) => s + v, 0);
  assert.strictEqual(sum, 0, '所有成员余额总和必须为0');
});

// --- 债务简化 ---
console.log('\n[债务简化]');
test('A垫300(3人均摊)：B→A 100，C→A 100', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  const c = A.createMember(g, 'C');
  const g2 = A.addExpense(g, { amount: 300, payerId: a.id, splitType: 'equal' });
  const debts = A.simplifyDebts(g2);
  assert.strictEqual(debts.length, 2);
  const totalDebt = debts.reduce((s, d) => s + d.amount, 0);
  assert.strictEqual(totalDebt, 20000, '总债务=200元');
  // 每笔都是从欠款人给A
  for (const d of debts) {
    assert.strictEqual(d.to, a.id, '收款方应为A');
  }
});
test('复杂场景债务简化后净额正确', () => {
  // A垫100（AB均摊），B垫100（BC均摊）
  // A: +50 -50 = 0 ; B: -50 +50 = 0 ; C: -50
  // 实际：A垫100 AB均摊 → A+50 B-50; B垫100 BC均摊 → B+50 C-50
  // 净：A=0, B=0, C=-50 → 但总和0? A50-50=0, B-50+50=0, C-50... 总=-50≠0 错误
  // 重新算：A垫100 AB均摊：A付100承担50 → A+50; B承担50 → B-50
  // B垫100 BC均摊：B付100承担50 → B+50; C承担50 → C-50
  // 净：A=+50, B=-50+50=0, C=-50 → 总=0 ✓
  // 所以 A应收50，C应付50 → C→A 50
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  const c = A.createMember(g, 'C');
  let g2 = A.addExpense(g, { amount: 100, payerId: a.id, splitType: 'equal', splits: [a.id, b.id] });
  g2 = A.addExpense(g2, { amount: 100, payerId: b.id, splitType: 'equal', splits: [b.id, c.id] });
  const debts = A.simplifyDebts(g2);
  assert.strictEqual(debts.length, 1, '应只需1笔结算');
  assert.strictEqual(debts[0].from, c.id);
  assert.strictEqual(debts[0].to, a.id);
  assert.strictEqual(debts[0].amount, 5000);
});

// --- 结算记录 ---
console.log('\n[结算记录]');
test('添加结算后余额更新', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  const g2 = A.addExpense(g, { amount: 100, payerId: a.id, splitType: 'equal' });
  // A+50 B-50
  let bal = A.computeBalances(g2);
  assert.strictEqual(bal[a.id], 5000);
  assert.strictEqual(bal[b.id], -5000);
  // B给A 50元结算
  const g3 = A.addSettlement(g2, { fromId: b.id, toId: a.id, amount: 50 });
  bal = A.computeBalances(g3);
  assert.strictEqual(bal[a.id], 0, 'A结算后应归零');
  assert.strictEqual(bal[b.id], 0, 'B结算后应归零');
});

// --- 统计 ---
console.log('\n[统计]');
test('computeStats 总额/笔数/人均', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  let g2 = A.addExpense(g, { amount: 100, payerId: a.id });
  g2 = A.addExpense(g2, { amount: 50, payerId: b.id });
  const stats = A.computeStats(g2);
  assert.strictEqual(stats.total, 15000);
  assert.strictEqual(stats.count, 2);
  assert.strictEqual(stats.memberCount, 2);
  assert.strictEqual(stats.perPerson, 7500);
});

// --- 不可变性 ---
console.log('\n[不可变性]');
test('addExpense 不修改原 group', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const before = g.expenses.length;
  A.addExpense(g, { amount: 100, payerId: a.id });
  assert.strictEqual(g.expenses.length, before, '原 group 不应被修改');
});

// --- 浮点精度 ---
console.log('\n[浮点精度]');
test('0.1+0.2 场景不产生浮点误差', () => {
  const g = A.createGroup('测试');
  const a = A.createMember(g, 'A');
  const b = A.createMember(g, 'B');
  const c = A.createMember(g, 'C');
  // 0.1元3人均摊
  const g2 = A.addExpense(g, { amount: 0.1, payerId: a.id, splitType: 'equal' });
  const bal = A.computeBalances(g2);
  const sum = Object.values(bal).reduce((s, v) => s + v, 0);
  assert.strictEqual(sum, 0, '余额总和为0，无浮点泄漏');
  // 0.1元=10分，3人：4/3/3
  assert.strictEqual(bal[a.id] + bal[b.id] + bal[c.id], 0);
});

console.log('\n----------------------------------------');
console.log('通过: ' + passed + ' / 失败: ' + failed);
console.log('----------------------------------------\n');

if (failed > 0) {
  process.exit(1);
}
