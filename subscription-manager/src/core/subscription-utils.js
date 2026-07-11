// subscription-utils.js - 订阅计算工具

// 将任意周期的价格换算为月均价格
function toMonthly(price, cycle) {
  if (cycle === 'monthly') return price;
  if (cycle === 'yearly') return price / 12;
  if (cycle === 'quarterly') return price / 3;
  if (cycle === 'weekly') return price * 4.345;
  return price;
}

// 将任意周期的价格换算为年均价格
function toYearly(price, cycle) {
  if (cycle === 'monthly') return price * 12;
  if (cycle === 'yearly') return price;
  if (cycle === 'quarterly') return price * 4;
  if (cycle === 'weekly') return price * 52.14;
  return price;
}

// 计算下一个续费日期
function nextRenewalDate(startDate, cycle, count) {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;

  let next = new Date(start);
  // 根据 cycle 推进
  for (let i = 0; i <= count; i++) {
    if (cycle === 'monthly') {
      next = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
    } else if (cycle === 'yearly') {
      next = new Date(start.getFullYear() + i, start.getMonth(), start.getDate());
    } else if (cycle === 'quarterly') {
      next = new Date(start.getFullYear(), start.getMonth() + i * 3, start.getDate());
    } else if (cycle === 'weekly') {
      next = new Date(start.getTime() + i * 7 * 24 * 3600 * 1000);
    }
  }
  return next;
}

// 找到从 startDate 开始，最早的未来续费日期
function upcomingRenewal(startDate, cycle) {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  let next = new Date(start);
  let count = 0;
  while (next <= now && count < 1000) {
    next = nextRenewalDate(startDate, cycle, count + 1);
    count++;
  }
  return next;
}

// 距今天数
function daysUntil(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return -1;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - now) / (24 * 3600 * 1000));
}

// 计算汇总统计
function computeStats(subscriptions) {
  let monthlyTotal = 0;
  let yearlyTotal = 0;
  let activeCount = 0;

  for (const sub of subscriptions) {
    if (sub.active === false) continue;
    monthlyTotal += toMonthly(sub.price, sub.cycle);
    yearlyTotal += toYearly(sub.price, sub.cycle);
    activeCount++;
  }

  // 即将续费列表（7天内）
  const upcoming = [];
  for (const sub of subscriptions) {
    if (sub.active === false) continue;
    const renewal = upcomingRenewal(sub.startDate, sub.cycle);
    if (!renewal) continue;
    const days = daysUntil(renewal);
    if (days >= 0 && days <= 7) {
      upcoming.push({ ...sub, renewalDate: renewal.toISOString().slice(0, 10), daysLeft: days });
    }
  }
  upcoming.sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    yearlyTotal: Math.round(yearlyTotal * 100) / 100,
    activeCount,
    upcoming
  };
}

// 按分类分组统计
function categoryBreakdown(subscriptions) {
  const map = {};
  for (const sub of subscriptions) {
    if (sub.active === false) continue;
    const cat = sub.category || '其他';
    if (!map[cat]) map[cat] = { count: 0, monthly: 0 };
    map[cat].count++;
    map[cat].monthly += toMonthly(sub.price, sub.cycle);
  }
  const result = [];
  for (const [cat, val] of Object.entries(map)) {
    result.push({ category: cat, count: val.count, monthly: Math.round(val.monthly * 100) / 100 });
  }
  result.sort((a, b) => b.monthly - a.monthly);
  return result;
}

module.exports = {
  toMonthly,
  toYearly,
  nextRenewalDate,
  upcomingRenewal,
  daysUntil,
  computeStats,
  categoryBreakdown
};
