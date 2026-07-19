// 房贷计算核心模块单元测试
// 运行：node test/calc.test.js
'use strict';

const assert = require('assert');
const calc = require('../src/calc.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  OK ${name}`); passed++; }
  catch (e) { console.error(`  FAIL ${name}: ${e.message}`); failed++; }
}

console.log('\n=== mortgage calc tests ===\n');
console.log('- round -');
test('round(3.14159,2)=3.14', () => assert.strictEqual(calc.round(3.14159, 2), 3.14));
test('round(3.145,2)=3.15', () => assert.strictEqual(calc.round(3.145, 2), 3.15));

console.log('- annualToMonthlyRate -');
test('4.2% -> 0.0035', () => assert.strictEqual(calc.annualToMonthlyRate(4.2), 0.0035));

console.log('- equalInstallment -');
test('1M 4.2% 30y monthly ~4890', () => {
  const r = calc.equalInstallment(1000000, 4.2, 30);
  assert.ok(r.monthlyPayment > 4880 && r.monthlyPayment < 4900, 'monthly=' + r.monthlyPayment);
  assert.strictEqual(r.schedule.length, 360);
});
test('zero rate -> principal/n', () => {
  const r = calc.equalInstallment(120000, 0, 10);
  assert.strictEqual(r.monthlyPayment, 1000);
  assert.strictEqual(r.totalInterest, 0);
});
test('totalPayment = principal + interest', () => {
  const r = calc.equalInstallment(500000, 3.25, 20);
  assert.ok(Math.abs(r.totalPayment - (500000 + r.totalInterest)) < 1);
});
test('last period remaining ~ 0', () => {
  const r = calc.equalInstallment(800000, 4.5, 25);
  assert.ok(r.schedule[r.schedule.length - 1].remaining < 5);
});

console.log('- equalPrincipal -');
test('1M 4.2% 30y first > last', () => {
  const r = calc.equalPrincipal(1000000, 4.2, 30);
  assert.ok(r.monthlyPaymentFirst > r.monthlyPaymentLast);
  assert.strictEqual(r.schedule.length, 360);
});
test('monthly principal fixed', () => {
  const r = calc.equalPrincipal(600000, 3.5, 20);
  const expected = calc.round(600000 / 240);
  assert.strictEqual(r.schedule[0].principalPart, expected);
  assert.strictEqual(r.schedule[100].principalPart, expected);
});
test('equalPrincipal interest < equalInstallment interest', () => {
  const ei = calc.equalInstallment(1000000, 4.2, 30);
  const ep = calc.equalPrincipal(1000000, 4.2, 30);
  assert.ok(ep.totalInterest < ei.totalInterest);
});

console.log('- combinedLoan -');
test('combined 500k+500k 30y', () => {
  const r = calc.combinedLoan({
    commercialPrincipal: 500000, commercialRate: 4.2,
    fundPrincipal: 500000, fundRate: 3.1,
    years: 30, method: 'equalInstallment'
  });
  assert.strictEqual(r.schedule.length, 360);
  assert.ok(r.totalPayment > 1000000);
  assert.ok(Math.abs(r.totalPayment - r.totalPrincipal - r.totalInterest) < 5);
});

console.log('- prepayment -');
test('reduceTerm saves interest > 0', () => {
  const orig = calc.equalInstallment(1000000, 4.2, 30);
  const r = calc.prepayment({
    originalSchedule: orig.schedule, prepayMonth: 36,
    prepayAmount: 200000, annualRate: 4.2, mode: 'reduceTerm'
  });
  assert.ok(r.savedInterest > 0);
  assert.ok(r.newTermMonths < 360);
});
test('reducePayment saves interest > 0', () => {
  const orig = calc.equalInstallment(1000000, 4.2, 30);
  const r = calc.prepayment({
    originalSchedule: orig.schedule, prepayMonth: 36,
    prepayAmount: 200000, annualRate: 4.2, mode: 'reducePayment'
  });
  assert.ok(r.savedInterest > 0);
  assert.strictEqual(r.newTermMonths, 360);
  assert.ok(r.newMonthlyPayment < orig.monthlyPayment);
});
test('payoff when amount >= remaining', () => {
  const orig = calc.equalInstallment(500000, 4.2, 20);
  const r = calc.prepayment({
    originalSchedule: orig.schedule, prepayMonth: 60,
    prepayAmount: 10000000, annualRate: 4.2, mode: 'reduceTerm'
  });
  assert.ok(r.paidOff === true);
  assert.strictEqual(r.newTermMonths, 60);
});

console.log('- lprRate -');
test('LPR 3.6% + 60BP = 4.2%', () => assert.strictEqual(calc.lprRate(3.6, 60), 4.2));

console.log('- scheduleToCSV -');
test('CSV has BOM and header', () => {
  const r = calc.equalInstallment(100000, 4.2, 5);
  const csv = calc.scheduleToCSV(r.schedule);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('期次'));
});

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
