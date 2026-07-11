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

// CSV 字段转义：包含逗号、引号或换行时用双引号包裹，内部引号双写
function csvEscape(val) {
  const s = val === undefined || val === null ? '' : String(val);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// 计费周期编码（CSV 用）
const CYCLE_CSV = { monthly: '月付', yearly: '年付', quarterly: '季付', weekly: '周付' };
const CYCLE_FROM_CSV = {
  '月付': 'monthly', 'monthly': 'monthly',
  '年付': 'yearly', 'yearly': 'yearly',
  '季付': 'quarterly', 'quarterly': 'quarterly',
  '周付': 'weekly', 'weekly': 'weekly'
};

// 订阅列表 -> CSV 字符串（含表头，UTF-8 BOM 由调用方加）
function toCSV(subscriptions) {
  const header = '名称,价格,计费周期,开始日期,分类,备注,状态';
  const lines = (subscriptions || []).map(sub => {
    const cycle = CYCLE_CSV[sub.cycle] || sub.cycle || '月付';
    const status = sub.active === false ? '已停用' : '活跃';
    return [sub.name, sub.price, cycle, sub.startDate, sub.category || '其他', sub.note || '', status]
      .map(csvEscape).join(',');
  });
  return header + '\n' + lines.join('\n') + (lines.length ? '\n' : '');
}

// 解析一行 CSV（支持引号包裹与内部双写引号）
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  result.push(cur);
  return result;
}

// CSV 字符串 -> 订阅对象数组（容错：跳过格式不合法的行）
function fromCSV(csvText) {
  const text = String(csvText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter(l => l.length > 0);
  if (lines.length < 2) return [];
  // 跳过表头
  const rows = lines.slice(1);
  const result = [];
  for (const row of rows) {
    const cols = parseCSVLine(row);
    if (cols.length < 4) continue;
    const name = (cols[0] || '').trim();
    const price = parseFloat(cols[1]);
    const cycle = CYCLE_FROM_CSV[cols[2]] || 'monthly';
    const startDate = (cols[3] || '').trim();
    if (!name || isNaN(price)) continue;
    result.push({
      id: 'csv' + Date.now() + '_' + result.length + '_' + Math.random().toString(36).slice(2, 6),
      name, price, cycle, startDate,
      category: (cols[4] || '其他').trim() || '其他',
      note: (cols[5] || '').trim(),
      active: (cols[6] || '').trim() === '已停用' ? false : true
    });
  }
  return result;
}

module.exports = {
  toMonthly,
  toYearly,
  nextRenewalDate,
  upcomingRenewal,
  daysUntil,
  computeStats,
  categoryBreakdown,
  toCSV,
  fromCSV
};
