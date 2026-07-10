// 统计计算 - 日/周/月时长、项目分布、趋势
'use strict';
const { startOfDay, startOfWeek, startOfMonth, dateKey } = require('./time-utils');

// 按时间范围汇总总时长
function totalInRange(records, from, to) {
  return records
    .filter((r) => r.start >= from && r.start < to)
    .reduce((sum, r) => sum + r.duration, 0);
}

// 今日总时长
function todayTotal(records, now) {
  const from = startOfDay(now || Date.now());
  return totalInRange(records, from, from + 86400000);
}

// 本周总时长
function weekTotal(records, now) {
  const from = startOfWeek(now || Date.now());
  return totalInRange(records, from, from + 7 * 86400000);
}

// 本月总时长
function monthTotal(records, now) {
  const from = startOfMonth(now || Date.now());
  const d = new Date(from);
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return totalInRange(records, from, nextMonth.getTime());
}

// 项目分布：[{projectId, name, color, duration, percent}]
function projectDistribution(records, projects, from, to) {
  const map = new Map();
  for (const r of records) {
    if (r.start >= from && r.start < to) {
      map.set(r.projectId, (map.get(r.projectId) || 0) + r.duration);
    }
  }
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
  return projects
    .map((p) => {
      const dur = map.get(p.id) || 0;
      return {
        projectId: p.id,
        name: p.name,
        color: p.color,
        duration: dur,
        percent: total > 0 ? Math.round((dur / total) * 100) : 0,
      };
    })
    .filter((x) => x.duration > 0)
    .sort((a, b) => b.duration - a.duration);
}

// 最近 N 天每日时长 [{date, key, duration}]
function dailyTrend(records, days, now) {
  const base = startOfDay(now || Date.now());
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = base - i * 86400000;
    const dayEnd = dayStart + 86400000;
    const dur = records
      .filter((r) => r.start >= dayStart && r.start < dayEnd)
      .reduce((s, r) => s + r.duration, 0);
    const d = new Date(dayStart);
    result.push({
      key: dateKey(dayStart),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      duration: dur,
    });
  }
  return result;
}

module.exports = {
  totalInRange,
  todayTotal,
  weekTotal,
  monthTotal,
  projectDistribution,
  dailyTrend,
};
