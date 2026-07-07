// 记账管家 - 核心逻辑测试
// 运行：node test/test.js

const path = require('path');
const fs = require('fs');
const os = require('os');

const { AccountStore } = require('../src/core/transaction-store');
const stats = require('../src/core/stats-utils');
const dateUtils = require('../src/core/date-utils');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + msg);
  } else {
    failed++;
    console.error('  ✗ ' + msg);
  }
}

function approx(a, b, eps = 0.01) {
  return Math.abs(a - b) < eps;
}

// 临时文件路径
const tmpFile = path.join(os.tmpdir(), 'accounting-test-' + Date.now() + '.json');

console.log('\n=== 日期工具测试 ===');
{
  const d = new Date(2026, 6, 7); // 2026-07-07
  assert(dateUtils.toDateKey(d) === '2026-07-07', 'toDateKey 应返回 YYYY-MM-DD');
  assert(dateUtils.toMonthKey(d) === '2026-07', 'toMonthKey 应返回 YYYY-MM');
  assert(dateUtils.daysInMonth(2026, 7) === 31, '7 月有 31 天');
  assert(dateUtils.daysInMonth(2026, 2) === 28, '2026 年 2 月有 28 天');
  assert(dateUtils.daysInMonth(2024, 2) === 29, '2024 年 2 月有 29 天（闰年）');
  assert(dateUtils.firstDayOfWeek(2026, 7) === 3, '2026-07-01 是周三');
  const p = dateUtils.prevMonth(2026, 1);
  assert(p.year === 2025 && p.month === 12, '1 月前一个月是去年 12 月');
  const n = dateUtils.nextMonth(2026, 12);
  assert(n.year === 2027 && n.month === 1, '12 月后一个月是明年 1 月');
  assert(dateUtils.formatMoney(1234.5) === '1,234.50', 'formatMoney 1234.5 -> 1,234.50');
  assert(dateUtils.formatMoney(0) === '0.00', 'formatMoney 0 -> 0.00');
}

console.log('\n=== AccountStore 测试 ===');
{
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const store = new AccountStore(tmpFile);

  // 默认分类
  const cats = store.listCategories();
  assert(cats.expense.length >= 10, '默认支出分类 >=10');
  assert(cats.income.length >= 6, '默认收入分类 >=6');

  // 默认账户
  const accs = store.listAccounts();
  assert(accs.length >= 5, '默认账户 >=5');

  // 创建交易
  const tx1 = store.createTransaction({ type: 'expense', amount: 38.5, categoryId: 'e_food', accountId: 'wechat', date: '2026-07-07', note: '午餐' });
  assert(tx1.id && tx1.id.startsWith('t_'), '交易 id 应以 t_ 开头');
  assert(approx(tx1.amount, 38.5), '交易金额 = 38.5');
  assert(tx1.type === 'expense', '交易类型 = expense');

  // 创建第二笔
  const tx2 = store.createTransaction({ type: 'income', amount: 8800, categoryId: 'i_salary', accountId: 'bank', date: '2026-07-05', note: '工资' });
  assert(tx2.type === 'income', '收入类型');

  // 列表查询
  const all = store.listTransactions();
  assert(all.length === 2, '应有 2 笔交易');

  // 按月查询
  const julTx = store.listTransactions({ monthKey: '2026-07' });
  assert(julTx.length === 2, '7 月应有 2 笔');
  const augTx = store.listTransactions({ monthKey: '2026-08' });
  assert(augTx.length === 0, '8 月应有 0 笔');

  // 按类型查询
  const expTx = store.listTransactions({ type: 'expense' });
  assert(expTx.length === 1, '支出应有 1 笔');

  // 排序：日期倒序
  assert(julTx[0].id === tx1.id, '7 月最新交易应排第一（7/7 > 7/5）');

  // 金额必须为正数
  let threw = false;
  try { store.createTransaction({ type: 'expense', amount: -10 }); } catch (e) { threw = true; }
  assert(threw, '负金额应抛错');
  threw = false;
  try { store.createTransaction({ type: 'expense', amount: 0 }); } catch (e) { threw = true; }
  assert(threw, '零金额应抛错');

  // 更新
  const updated = store.updateTransaction(tx1.id, { amount: 40, note: '午餐外卖' });
  assert(approx(updated.amount, 40), '更新金额为 40');
  assert(updated.note === '午餐外卖', '更新备注');

  // 删除
  const removed = store.removeTransaction(tx2.id);
  assert(removed.id === tx2.id, '删除返回被删交易');
  assert(store.listTransactions().length === 1, '删除后剩 1 笔');

  // 不存在的删除返回 null
  assert(store.removeTransaction('non-exist') === null, '删除不存在的返回 null');
}

console.log('\n=== 预算测试 ===');
{
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const store = new AccountStore(tmpFile);
  assert(store.getBudget('2026-07') === 0, '未设置预算返回 0');
  store.setBudget('2026-07', 5000);
  assert(store.getBudget('2026-07') === 5000, '设置预算 5000');
  const all = store.listBudgets();
  assert(all['2026-07'] === 5000, '预算列表包含 5000');
  let threw = false;
  try { store.setBudget('2026-07', -100); } catch (e) { threw = true; }
  assert(threw, '负预算应抛错');
}

console.log('\n=== 统计测试 ===');
{
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const store = new AccountStore(tmpFile);
  // 准备数据
  store.createTransaction({ type: 'expense', amount: 100, categoryId: 'e_food', date: '2026-07-01' });
  store.createTransaction({ type: 'expense', amount: 200, categoryId: 'e_food', date: '2026-07-05' });
  store.createTransaction({ type: 'expense', amount: 150, categoryId: 'e_transport', date: '2026-07-10' });
  store.createTransaction({ type: 'income', amount: 1000, categoryId: 'i_salary', date: '2026-07-05' });
  store.createTransaction({ type: 'expense', amount: 50, categoryId: 'e_food', date: '2026-06-15' });

  const txs = store.listTransactions();
  const summary = stats.monthlySummary(txs, '2026-07');
  assert(approx(summary.income, 1000), '7 月收入 1000');
  assert(approx(summary.expense, 450), '7 月支出 450 (100+200+150)');
  assert(approx(summary.balance, 550), '7 月结余 550');

  // 全部
  const allSum = stats.monthlySummary(txs);
  assert(approx(allSum.expense, 500), '所有支出 500 (含 6 月 50)');

  // 分类统计
  const expCats = stats.categoryBreakdown(txs, 'expense', '2026-07');
  assert(approx(expCats.total, 450), '7 月支出分类总额 450 (100+200+150)');
  assert(expCats.list[0].categoryId === 'e_food', '最大分类为 e_food');
  assert(approx(expCats.list[0].amount, 300), 'e_food 金额 300');
  assert(approx(expCats.list[0].percent, 66.7), 'e_food 占比 66.7%');

  // 日历每日统计
  const daily = stats.dailySummary(txs, '2026-07');
  assert(daily['2026-07-01'] && approx(daily['2026-07-01'].expense, 100), '7-01 支出 100');
  assert(daily['2026-07-05'] && approx(daily['2026-07-05'].income, 1000), '7-05 收入 1000');
  assert(daily['2026-07-05'] && approx(daily['2026-07-05'].expense, 200), '7-05 支出 200');
  assert(!daily['2026-07-15'], '7-15 无数据');

  // 月度趋势
  const trend = stats.monthlyTrend(txs, 6);
  assert(trend.length === 6, '近 6 个月趋势');
  const jul = trend.find((t) => t.month === '2026-07');
  assert(jul && approx(jul.expense, 450), '趋势中 7 月支出 450');

  // 预算使用
  store.setBudget('2026-07', 1000);
  const usage = stats.budgetUsage(txs, '2026-07', 1000);
  assert(approx(usage.expense, 450), '预算已用 450');
  assert(usage.percent === 45, '已用 45%');
  assert(approx(usage.remaining, 550), '剩余 550');
  assert(!usage.overBudget, '未超预算');
}

console.log('\n=== 导入导出测试 ===');
{
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const store = new AccountStore(tmpFile);
  store.createTransaction({ type: 'expense', amount: 50, categoryId: 'e_food', date: '2026-07-01' });
  store.setBudget('2026-07', 2000);
  const exported = store.exportJSON();
  assert(exported.includes('"transactions"'), '导出包含 transactions');
  assert(exported.includes('"budgets"'), '导出包含 budgets');

  // 重新导入
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const store2 = new AccountStore(tmpFile);
  store2.importJSON(exported);
  assert(store2.listTransactions().length === 1, '导入后 1 笔交易');
  assert(store2.getBudget('2026-07') === 2000, '导入后预算 2000');

  // CSV 导出
  const csv = store2.exportCSV();
  assert(csv.includes('"日期"') && csv.includes('"类型"') && csv.includes('"分类"'), 'CSV 头部正确');
  assert(csv.includes('2026-07-01'), 'CSV 包含日期');
  assert(csv.includes('餐饮'), 'CSV 包含分类名');

  // 无效导入抛错
  let threw = false;
  try { store2.importJSON('{"x":1}'); } catch (e) { threw = true; }
  assert(threw, '无效数据应抛错');
}

console.log('\n=== 示例数据测试 ===');
{
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const store = new AccountStore(tmpFile);
  const ok = store.seedSampleData();
  assert(ok, '首次写入示例数据应返回 true');
  assert(store.listTransactions().length > 0, '示例数据应有交易');
  const ok2 = store.seedSampleData();
  assert(!ok2, '已有数据时再写入应返回 false');
}

console.log('\n=== 清空数据测试 ===');
{
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const store = new AccountStore(tmpFile);
  store.createTransaction({ type: 'expense', amount: 50, categoryId: 'e_food', date: '2026-07-01' });
  store.createTransaction({ type: 'income', amount: 1000, categoryId: 'i_salary', date: '2026-07-05' });
  store.setBudget('2026-07', 3000);
  assert(store.listTransactions().length === 2, '清空前应有 2 笔交易');
  assert(store.getBudget('2026-07') === 3000, '清空前预算 3000');

  const r = store.clearAll();
  assert(r === true, 'clearAll 返回 true');
  assert(store.listTransactions().length === 0, '清空后交易为 0');
  assert(store.getBudget('2026-07') === 0, '清空后预算为 0');
  assert(Object.keys(store.listBudgets()).length === 0, '清空后预算列表为空');

  // 分类与账户应保留
  const cats = store.listCategories();
  assert(cats.expense.length >= 10, '清空后支出分类仍保留');
  assert(cats.income.length >= 6, '清空后收入分类仍保留');
  assert(store.listAccounts().length >= 5, '清空后账户仍保留');

  // 持久化：重新加载文件应为空
  const store2 = new AccountStore(tmpFile);
  assert(store2.listTransactions().length === 0, '重新加载后交易仍为 0');
  assert(store2.getBudget('2026-07') === 0, '重新加载后预算仍为 0');
}

// 清理
try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}

console.log(`\n=== 测试结果 ===`);
console.log(`通过：${passed}，失败：${failed}`);
if (failed > 0) {
  console.error('❌ 测试失败');
  process.exit(1);
} else {
  console.log('✅ 全部测试通过');
}
