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

/** 账户余额计算：每个账户的收入-支出，及总资产/总负债/净资产
 *  余额为正=资产，为负=负债（如信用卡消费产生欠款）
 *  accounts: [{ id, name, icon, color, ... }]
 *  返回: { list: [...accounts+balance+txCount], totalAssets, totalLiabilities, netWorth }
 */
function accountBalances(transactions, accounts) {
  const map = {};
  const countMap = {};
  (accounts || []).forEach((a) => {
    map[a.id] = 0;
    countMap[a.id] = 0;
  });
  (transactions || []).forEach((t) => {
    if (t.type === 'transfer') {
      // 转账：转出账户余额减少，转入账户余额增加，两账户交易数各 +1。
      // 转账不计入收支统计，仅移动资金，因此不影响总资产/总负债的净值。
      if (map[t.fromAccountId] === undefined) { map[t.fromAccountId] = 0; countMap[t.fromAccountId] = 0; }
      if (map[t.toAccountId] === undefined) { map[t.toAccountId] = 0; countMap[t.toAccountId] = 0; }
      map[t.fromAccountId] -= t.amount;
      map[t.toAccountId] += t.amount;
      countMap[t.fromAccountId]++;
      countMap[t.toAccountId]++;
    } else {
      if (map[t.accountId] === undefined) {
        map[t.accountId] = 0;
        countMap[t.accountId] = 0;
      }
      if (t.type === 'income') map[t.accountId] += t.amount;
      else if (t.type === 'expense') map[t.accountId] -= t.amount;
      countMap[t.accountId]++;
    }
  });

  const knownIds = new Set((accounts || []).map((a) => a.id));
  const list = (accounts || []).map((a) => ({
    ...a,
    balance: Math.round((map[a.id] || 0) * 100) / 100,
    txCount: countMap[a.id] || 0,
  }));
  // 处理交易中出现但不在 accounts 列表中的账户（兼容旧数据）
  Object.keys(map).forEach((id) => {
    if (!knownIds.has(id) && countMap[id] > 0) {
      list.push({
        id, name: id, icon: '✏️', color: '#8e8e93',
        balance: Math.round(map[id] * 100) / 100,
        txCount: countMap[id],
      });
    }
  });
  list.sort((a, b) => b.balance - a.balance);

  let totalAssets = 0, totalLiabilities = 0;
  list.forEach((a) => {
    if (a.balance > 0) totalAssets += a.balance;
    else totalLiabilities += Math.abs(a.balance);
  });

  return {
    list,
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,
    netWorth: Math.round((totalAssets - totalLiabilities) * 100) / 100,
  };
}

module.exports = {
  monthlySummary,
  categoryBreakdown,
  dailySummary,
  monthlyTrend,
  budgetUsage,
  accountBalances,
};
