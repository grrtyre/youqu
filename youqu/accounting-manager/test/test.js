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

console.log('\n=== 账户余额测试 ===');
{
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const store = new AccountStore(tmpFile);
  const accounts = store.listAccounts();
  // 准备数据：多账户多类型
  store.createTransaction({ type: 'income', amount: 8800, categoryId: 'i_salary', accountId: 'bank', date: '2026-07-05', note: '工资' });
  store.createTransaction({ type: 'expense', amount: 38.5, categoryId: 'e_food', accountId: 'wechat', date: '2026-07-07', note: '午餐' });
  store.createTransaction({ type: 'expense', amount: 2500, categoryId: 'e_housing', accountId: 'bank', date: '2026-07-03', note: '房租' });
  store.createTransaction({ type: 'expense', amount: 120, categoryId: 'e_shopping', accountId: 'credit', date: '2026-07-08', note: '信用卡购物' });
  store.createTransaction({ type: 'income', amount: 500, categoryId: 'i_parttime', accountId: 'alipay', date: '2026-07-10', note: '兼职' });
  store.createTransaction({ type: 'expense', amount: 68, categoryId: 'e_food', accountId: 'cash', date: '2026-07-09', note: '聚餐' });

  const txs = store.listTransactions();
  const result = stats.accountBalances(txs, accounts);

  // 银行卡余额 = 8800 - 2500 = 6300
  const bank = result.list.find((a) => a.id === 'bank');
  assert(bank && approx(bank.balance, 6300), '银行卡余额 = 6300 (8800-2500)');
  assert(bank && bank.txCount === 2, '银行卡交易数 = 2');

  // 微信余额 = -38.5
  const wechat = result.list.find((a) => a.id === 'wechat');
  assert(wechat && approx(wechat.balance, -38.5), '微信余额 = -38.5');

  // 信用卡余额 = -120 (负债)
  const credit = result.list.find((a) => a.id === 'credit');
  assert(credit && approx(credit.balance, -120), '信用卡余额 = -120 (负债)');

  // 支付宝余额 = 500
  const alipay = result.list.find((a) => a.id === 'alipay');
  assert(alipay && approx(alipay.balance, 500), '支付宝余额 = 500');

  // 现金余额 = -68
  const cash = result.list.find((a) => a.id === 'cash');
  assert(cash && approx(cash.balance, -68), '现金余额 = -68');

  // 总资产 = 6300 + 500 = 6800
  assert(approx(result.totalAssets, 6800), '总资产 = 6800 (6300+500)');

  // 总负债 = 38.5 + 120 + 68 = 226.5
  assert(approx(result.totalLiabilities, 226.5), '总负债 = 226.5 (38.5+120+68)');

  // 净资产 = 6800 - 226.5 = 6573.5
  assert(approx(result.netWorth, 6573.5), '净资产 = 6573.5');

  // 排序：余额从高到低
  assert(result.list[0].id === 'bank', '余额最高的是银行卡');
  assert(result.list[result.list.length - 1].balance <= 0, '余额最低的为负数');
}

console.log('\n=== 账户余额边界测试 ===');
{
  // 空交易
  const result = stats.accountBalances([], [
    { id: 'a', name: 'A', icon: '💵', color: '#34c759' },
    { id: 'b', name: 'B', icon: '🏦', color: '#007aff' },
  ]);
  assert(result.list.length === 2, '空交易返回所有账户');
  assert(approx(result.totalAssets, 0), '空交易总资产 = 0');
  assert(approx(result.totalLiabilities, 0), '空交易总负债 = 0');
  assert(approx(result.netWorth, 0), '空交易净资产 = 0');
  assert(result.list.every((a) => a.balance === 0), '空交易所有余额 = 0');

  // 空账户列表 + 有交易（兼容旧数据）
  const result2 = stats.accountBalances([
    { type: 'income', amount: 100, accountId: 'unknown_acc', date: '2026-07-01' },
    { type: 'expense', amount: 30, accountId: 'unknown_acc', date: '2026-07-02' },
  ], []);
  assert(result2.list.length === 1, '未知账户被自动加入列表');
  assert(approx(result2.list[0].balance, 70), '未知账户余额 = 70');

  // null 参数安全
  const result3 = stats.accountBalances(null, null);
  assert(result3.list.length === 0, 'null 参数返回空列表');
  assert(approx(result3.netWorth, 0), 'null 参数净资产 = 0');
}

console.log('\n=== 转账功能测试 ===');
{
  const tf = path.join(os.tmpdir(), 'accounting-transfer-test-' + Date.now() + '.json');
  if (fs.existsSync(tf)) fs.unlinkSync(tf);
  const store = new AccountStore(tf);

  // 基础创建
  const tr = store.createTransfer({ amount: 500, fromAccountId: 'bank', toAccountId: 'alipay', date: '2026-07-15', note: '转入支付宝' });
  assert(tr.id && tr.id.startsWith('t_'), '转账 id 以 t_ 开头');
  assert(tr.type === 'transfer', '转账类型 = transfer');
  assert(approx(tr.amount, 500), '转账金额 = 500');
  assert(tr.fromAccountId === 'bank' && tr.toAccountId === 'alipay', '转出/转入账户正确');

  // 金额必须为正
  let threw = false;
  try { store.createTransfer({ amount: -10, fromAccountId: 'bank', toAccountId: 'cash' }); } catch (e) { threw = true; }
  assert(threw, '负金额应抛错');

  // 账户不能相同
  threw = false;
  try { store.createTransfer({ amount: 100, fromAccountId: 'bank', toAccountId: 'bank' }); } catch (e) { threw = true; }
  assert(threw, '转出转入相同应抛错');

  // 账户必填
  threw = false;
  try { store.createTransfer({ amount: 100, fromAccountId: 'bank' }); } catch (e) { threw = true; }
  assert(threw, '缺少转入账户应抛错');

  // 列表包含转账
  const all = store.listTransactions();
  assert(all.length === 1 && all[0].type === 'transfer', '列表包含 1 笔转账');

  // 按类型筛选：转账与收支互不干扰
  const transfers = store.listTransactions({ type: 'transfer' });
  assert(transfers.length === 1, 'type=transfer 筛选返回 1 笔');
  const expenses = store.listTransactions({ type: 'expense' });
  assert(expenses.length === 0, 'type=expense 筛选不含转账');

  // 加一笔收入 + 支出，验证统计排除转账
  store.createTransaction({ type: 'income', amount: 1000, categoryId: 'i_salary', accountId: 'bank', date: '2026-07-10' });
  store.createTransaction({ type: 'expense', amount: 200, categoryId: 'e_food', accountId: 'wechat', date: '2026-07-11' });

  const txs = store.listTransactions();
  const summary = stats.monthlySummary(txs, '2026-07');
  assert(approx(summary.income, 1000), '月度收入 = 1000（不含转账）');
  assert(approx(summary.expense, 200), '月度支出 = 200（不含转账）');
  assert(approx(summary.balance, 800), '月度结余 = 800（转账不影响收支）');

  // 账户余额：转账正确移动资金，净值不变
  const accounts = store.listAccounts();
  const bal = stats.accountBalances(txs, accounts);
  const bank = bal.list.find((a) => a.id === 'bank');
  const alipay = bal.list.find((a) => a.id === 'alipay');
  // bank: +1000(工资) - 500(转出) = 500
  assert(bank && approx(bank.balance, 500), '银行卡余额 = 500 (1000工资 - 500转出)');
  // alipay: +500(转入)
  assert(alipay && approx(alipay.balance, 500), '支付宝余额 = 500 (转入)');
  // wechat: -200(支出)
  const wechat = bal.list.find((a) => a.id === 'wechat');
  assert(wechat && approx(wechat.balance, -200), '微信余额 = -200 (支出)');
  // 净值 = 500 + 500 - 200 = 800（与月度结余一致，转账不改变净值）
  assert(approx(bal.netWorth, 800), '净资产 = 800（转账不改变净值）');

  // 更新转账字段
  store.updateTransaction(tr.id, { fromAccountId: 'cash' });
  const updated = store.getTransaction(tr.id);
  assert(updated.fromAccountId === 'cash', '更新转出账户成功');
  // 更新为相同账户应抛错
  threw = false;
  try { store.updateTransaction(tr.id, { toAccountId: 'cash' }); } catch (e) { threw = true; }
  assert(threw, '更新为相同账户应抛错');

  // CSV 导出包含转账行
  const csv = store.exportCSV();
  assert(csv.includes('转账'), 'CSV 包含转账类型');
  assert(csv.includes('→'), 'CSV 包含账户转向箭头');

  // 删除转账
  store.removeTransaction(tr.id);
  assert(store.listTransactions({ type: 'transfer' }).length === 0, '删除转账后列表为空');

  try { if (fs.existsSync(tf)) fs.unlinkSync(tf); } catch (_) {}
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
