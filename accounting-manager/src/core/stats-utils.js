// 统计计算工具 - 纯函数，便于测试

const { toMonthKey } = require('./date-utils');

/** 月度汇总：总收入、总支出、结余 */
function monthlySummary(transactions, monthKey) {
  let income = 0;
  let expense = 0;
  transactions.forEach((t) => {
    if (!monthKey || toMonthKey(t.date) === monthKey) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    }
  });
  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    balance: Math.round((income - expense) * 100) / 100,
  };
}

/** 按分类统计 */
function categoryBreakdown(transactions, type, monthKey) {
  const map = {};
  transactions.forEach((t) => {
    if (t.type !== type) return;
    if (monthKey && toMonthKey(t.date) !== monthKey) return;
    map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
  });
  const total = Object.values(map).reduce((s, n) => s + n, 0);
  const list = Object.entries(map).map(([categoryId, amount]) => ({
    categoryId,
    amount: Math.round(amount * 100) / 100,
    percent: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
  }));
  list.sort((a, b) => b.amount - a.amount);
  return { list, total: Math.round(total * 100) / 100 };
}

/** 日历每日统计 */
function dailySummary(transactions, monthKey) {
  const map = {};
  transactions.forEach((t) => {
    if (toMonthKey(t.date) !== monthKey) return;
    if (!map[t.date]) map[t.date] = { income: 0, expense: 0 };
    if (t.type === 'income') map[t.date].income += t.amount;
    else if (t.type === 'expense') map[t.date].expense += t.amount;
  });
  Object.keys(map).forEach((k) => {
    map[k].income = Math.round(map[k].income * 100) / 100;
    map[k].expense = Math.round(map[k].expense * 100) / 100;
  });
  return map;
}

/** 近 6 个月趋势 */
function monthlyTrend(transactions, months = 6) {
  const now = new Date();
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const s = monthlySummary(transactions, mk);
    result.push({ month: mk, ...s });
  }
  return result;
}

/** 预算使用情况 */
function budgetUsage(transactions, monthKey, budget) {
  const { expense } = monthlySummary(transactions, monthKey);
  const percent = budget > 0 ? Math.round((expense / budget) * 100) : 0;
  const remaining = Math.round((budget - expense) * 100) / 100;
  return { budget, expense, percent, remaining, overBudget: expense > budget };
}

module.exports = {
  monthlySummary,
  categoryBreakdown,
  dailySummary,
  monthlyTrend,
  budgetUsage,
};
