// recurrence.js — 重复事件规则
// 职责：计算年度重复事件的下一次发生日期（支持公历与农历重复）

const { solarToLunar, lunarToSolar, formatDate, parseDate } = require('./date-utils');

// 计算重复事件的下一个发生日期
// event: { date: 'YYYY-MM-DD', repeat: 'none'|'yearly'|'monthly', calendar: 'solar'|'lunar' }
// from: Date 对象（默认今天）
// 返回：Date 对象（下一次发生日期，可能就是原日期）
function nextOccurrence(event, from) {
  if (!event || !event.date) return null;
  if (!event.repeat || event.repeat === 'none') {
    return parseDate(event.date);
  }
  from = from || new Date();
  const baseDate = parseDate(event.date);
  if (!baseDate) return null;

  if (event.calendar === 'lunar') {
    return nextLunarOccurrence(baseDate, event.repeat, from);
  }
  return nextSolarOccurrence(baseDate, event.repeat, from);
}

// 公历重复
function nextSolarOccurrence(baseDate, repeat, from) {
  const year = from.getFullYear();
  const candidate = new Date(year, baseDate.getMonth(), baseDate.getDate());
  if (candidate >= startOfDay(from)) return candidate;
  // 跨年：取下一年
  return new Date(year + 1, baseDate.getMonth(), baseDate.getDate());
}

// 农历重复：基于 baseDate 对应的农历月日，在 from 当年/次年的农历中查找
function nextLunarOccurrence(baseDate, repeat, from) {
  const baseLunar = solarToLunar(baseDate);
  const year = from.getFullYear();
  // 尝试当年
  let solar = lunarToSolar(year, baseLunar.month, baseLunar.day, baseLunar.isLeap);
  if (solar && solar >= startOfDay(from)) return solar;
  // 次年
  solar = lunarToSolar(year + 1, baseLunar.month, baseLunar.day, baseLunar.isLeap);
  return solar;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

module.exports = { nextOccurrence };
