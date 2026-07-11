// stats-utils.js — 休息统计计算
// 职责：基于历史记录计算今日/本周/连续达标天数等指标
// 纯逻辑模块，便于测试

'use strict';

// 把 ISO 字符串转换为本地日期 YYYY-MM-DD
function localDayKey(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 计算给定日期往前 N 天的日期键数组（含今天，从旧到新）
function lastNDayKeys(n, ref) {
  const base = ref ? new Date(ref) : new Date();
  base.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    out.push(localDayKey(d));
  }
  return out;
}

// 按天聚合并返回：{ 'YYYY-MM-DD': { completed, skipped, snoozed, totalSec } }
function aggregateByDay(history) {
  const map = {};
  for (const item of history) {
    const key = localDayKey(item.ts);
    if (!map[key]) map[key] = { completed: 0, skipped: 0, snoozed: 0, totalSec: 0 };
    if (item.action === 'completed') {
      map[key].completed += 1;
      map[key].totalSec += item.durationSec || 0;
    } else if (item.action === 'skipped') {
      map[key].skipped += 1;
    } else if (item.action === 'snoozed') {
      map[key].snoozed += 1;
    }
  }
  return map;
}

// 今日汇总
function todaySummary(history, ref) {
  const key = localDayKey(ref ? new Date(ref) : new Date());
  const all = aggregateByDay(history);
  return all[key] || { completed: 0, skipped: 0, snoozed: 0, totalSec: 0 };
}

// 最近 7 天柱状图数据：[{ date, completed, skipped, totalSec }]
function weeklyChart(history, ref) {
  const keys = lastNDayKeys(7, ref);
  const map = aggregateByDay(history);
  return keys.map(k => ({
    date: k,
    completed: (map[k] && map[k].completed) || 0,
    skipped: (map[k] && map[k].skipped) || 0,
    totalSec: (map[k] && map[k].totalSec) || 0
  }));
}

// 连续达标天数：从今天往前数，完成率 >= 60% 的连续天数
// 完成率 = completed / (completed + skipped)
function streakDays(history, ref) {
  const map = aggregateByDay(history);
  const base = ref ? new Date(ref) : new Date();
  base.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(base.getTime() - i * 86400000);
    const key = localDayKey(d);
    const s = map[key];
    if (!s) {
      // 今天没数据不算中断，从昨天起算
      if (i === 0) continue;
      break;
    }
    const total = s.completed + s.skipped;
    if (total === 0) {
      if (i === 0) continue;
      break;
    }
    const rate = s.completed / total;
    if (rate >= 0.6) streak += 1;
    else break;
  }
  return streak;
}

// 总累计：完成次数、累计护眼秒数
function lifetimeSummary(history) {
  let completed = 0, totalSec = 0;
  for (const item of history) {
    if (item.action === 'completed') {
      completed += 1;
      totalSec += item.durationSec || 0;
    }
  }
  return { completed, totalSec };
}

module.exports = {
  localDayKey,
  lastNDayKeys,
  aggregateByDay,
  todaySummary,
  weeklyChart,
  streakDays,
  lifetimeSummary
};
