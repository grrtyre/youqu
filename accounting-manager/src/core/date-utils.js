// 日期工具函数 - 所有函数纯函数，便于测试

/** 转 YYYY-MM-DD 格式（本地时区） */
function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 转 YYYY-MM 格式 */
function toMonthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** 解析 YYYY-MM-DD 为 Date（本地时区） */
function parseDateKey(key) {
  const [y, m, d] = String(key).split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/** 获取某月的天数 */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** 获取某月第一天是周几（0=周日） */
function firstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

/** 获取上一个月的 year, month */
function prevMonth(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/** 获取下一个月的 year, month */
function nextMonth(year, month) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

/** 友好的相对时间描述 */
function relativeTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return toDateKey(d);
}

/** 格式化金额：1234.5 -> "1,234.50" */
function formatMoney(num) {
  const n = Number(num) || 0;
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

module.exports = {
  toDateKey,
  toMonthKey,
  parseDateKey,
  daysInMonth,
  firstDayOfWeek,
  prevMonth,
  nextMonth,
  relativeTime,
  formatMoney,
};
