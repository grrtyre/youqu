// 习惯工具函数 - 纯逻辑、无副作用、可被测试和渲染层共用

/**
 * 计算 YYYY-MM-DD 形式的本地日期键
 * 注意：toISOString 返回 UTC，会有时区偏差，故手动拼装
 */
function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 由日期键还原 Date 对象（本地时间零点）
 */
function fromDateKey(key) {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/**
 * 给某日期加减 n 天，返回新 Date
 */
function shiftDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * 计算两个日期键相差天数（a - b，可为负）
 */
function diffDays(aKey, bKey) {
  const a = fromDateKey(aKey).getTime();
  const b = fromDateKey(bKey).getTime();
  return Math.round((a - b) / 86400000);
}

/**
 * 计算当前连续打卡天数（含今天则从今天往前数；今天没打则从昨天往前数）
 * records: 已完成日期键数组
 */
function currentStreak(records, today = new Date()) {
  if (!records || records.length === 0) return 0;
  const set = new Set(records);
  const todayKey = toDateKey(today);
  let cursor = set.has(todayKey) ? today : shiftDays(fromDateKey(todayKey), -1);
  let streak = 0;
  // 最多回溯 5 年防止异常数据死循环
  for (let i = 0; i < 365 * 5; i++) {
    if (set.has(toDateKey(cursor))) {
      streak += 1;
      cursor = shiftDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * 计算历史最长连续打卡天数
 */
function longestStreak(records) {
  if (!records || records.length === 0) return 0;
  const sorted = [...new Set(records)].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(sorted[i], sorted[i - 1]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }
  return longest;
}

/**
 * 计算给定月份（year, month 0-based）的日历网格
 * 返回二维数组，每行 7 天（周日到周六），非本月为 null
 * 每个本日项含 { key, day, inMonth, isToday, done }
 */
function monthGrid(year, month, records, today = new Date()) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0=周日
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toDateKey(today);
  const set = new Set(records || []);
  const cells = [];
  // 前置空位
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = toDateKey(date);
    cells.push({
      key,
      day: d,
      inMonth: true,
      isToday: key === todayKey,
      done: set.has(key),
    });
  }
  // 补齐到 7 的倍数
  while (cells.length % 7 !== 0) cells.push(null);
  // 切分成周
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * 统计本周（周日到周六）完成情况
 */
function weekStats(records, today = new Date()) {
  const set = new Set(records || []);
  const todayKey = toDateKey(today);
  const t = fromDateKey(todayKey);
  const start = shiftDays(t, -t.getDay());
  let done = 0;
  const total = 7;
  const keys = [];
  for (let i = 0; i < 7; i++) keys.push(toDateKey(shiftDays(start, i)));
  keys.forEach((k) => {
    if (set.has(k)) done += 1;
  });
  return { done, total, rate: done / total };
}

/**
 * 统计本月完成率
 */
function monthStats(records, today = new Date()) {
  const set = new Set(records || []);
  const t = new Date(today);
  const year = t.getFullYear();
  const month = t.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let done = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (set.has(toDateKey(new Date(year, month, d)))) done += 1;
  }
  return { done, total: daysInMonth, rate: done / daysInMonth };
}

module.exports = {
  toDateKey,
  fromDateKey,
  shiftDays,
  diffDays,
  currentStreak,
  longestStreak,
  monthGrid,
  weekStats,
  monthStats,
};
