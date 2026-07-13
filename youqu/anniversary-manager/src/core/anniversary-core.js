// 纪念日核心计算逻辑
// 包含：年龄、下次周年日期、距下次天数、生肖、星座、已过天数等
const { solarToLunar, formatLunarDate, lunarToSolar } = require('./lunar');

const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const ZODIAC_EMOJI = ['🐭', '🐮', '🐯', '🐰', '🐲', '🐍', '🐴', '🐑', '🐵', '🐔', '🐶', '🐷'];

// 星座边界（公历）
const CONSTELLATIONS = [
  { name: '摩羯座', emoji: '♑', start: [12, 22] },
  { name: '水瓶座', emoji: '♒', start: [1, 20] },
  { name: '双鱼座', emoji: '♓', start: [2, 19] },
  { name: '白羊座', emoji: '♈', start: [3, 21] },
  { name: '金牛座', emoji: '♉', start: [4, 20] },
  { name: '双子座', emoji: '♊', start: [5, 21] },
  { name: '巨蟹座', emoji: '♋', start: [6, 22] },
  { name: '狮子座', emoji: '♌', start: [7, 23] },
  { name: '处女座', emoji: '♍', start: [8, 23] },
  { name: '天秤座', emoji: '♎', start: [9, 23] },
  { name: '天蝎座', emoji: '♏', start: [10, 24] },
  { name: '射手座', emoji: '♐', start: [11, 23] },
  { name: '摩羯座', emoji: '♑', start: [12, 22] },
];

// 事件类型
const EVENT_TYPES = {
  birthday: { label: '生日', emoji: '🎂' },
  anniversary: { label: '纪念日', emoji: '💞' },
  memorial: { label: '忌日', emoji: '🕊️' },
  custom: { label: '自定义', emoji: '📌' },
};

// 关系分类
const CATEGORIES = {
  family: { label: '家人', emoji: '👨‍👩‍👧' },
  friend: { label: '朋友', emoji: '🤝' },
  colleague: { label: '同事', emoji: '💼' },
  other: { label: '其他', emoji: '🌟' },
};

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

// 规范化日期：返回 {year, month, day}（month/day 1-based）
function normalizeDate(input) {
  if (input instanceof Date) {
    return { year: input.getFullYear(), month: input.getMonth() + 1, day: input.getDate() };
  }
  if (typeof input === 'string') {
    const m = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) throw new Error('日期格式应为 YYYY-MM-DD: ' + input);
    return { year: +m[1], month: +m[2], day: +m[3] };
  }
  if (input && typeof input === 'object') {
    return { year: +input.year, month: +input.month, day: +input.day };
  }
  throw new Error('无法解析日期: ' + input);
}

// 计算生肖（按农历年）
function getZodiac(year) {
  // 1900 年为鼠年，基准
  const idx = (year - 1900) % 12;
  const fixed = idx < 0 ? idx + 12 : idx;
  return { name: ZODIAC[fixed], emoji: ZODIAC_EMOJI[fixed] };
}

// 计算星座（按公历月日）
// CONSTELLATIONS 已按时间顺序排列，每个区间为 [start, next.start)
function getConstellation(month, day) {
  // 12月22日及之后为摩羯座（跨年）
  if (month === 12 && day >= 22) return CONSTELLATIONS[0];
  for (let i = 0; i < CONSTELLATIONS.length - 1; i++) {
    const cur = CONSTELLATIONS[i];
    const next = CONSTELLATIONS[i + 1];
    const afterCur = month > cur.start[0] || (month === cur.start[0] && day >= cur.start[1]);
    const beforeNext = month < next.start[0] || (month === next.start[0] && day < next.start[1]);
    if (afterCur && beforeNext) return cur;
  }
  return CONSTELLATIONS[0];
}

// 计算周岁年龄
function calcAge(birth, fromDate) {
  const b = normalizeDate(birth);
  const f = fromDate ? normalizeDate(fromDate) : normalizeDate(new Date());
  let age = f.year - b.year;
  if (f.month < b.month || (f.month === b.month && f.day < b.day)) {
    age--;
  }
  return age >= 0 ? age : 0;
}

// 计算下次周年日期（在公历语境下，按 month/day 推进到 fromDate 之后/当天）
function nextSolarOccurrence(month, day, fromDate) {
  const f = fromDate ? normalizeDate(fromDate) : normalizeDate(new Date());
  let year = f.year;
  let candidate = new Date(year, month - 1, day);
  // 当天也算"今天"，daysUntil = 0
  if (candidate.getMonth() + 1 !== month || candidate.getDate() !== day) {
    // 处理 2 月 29 日在非闰年的情况：回落到 2 月 28 日
    candidate = new Date(year, month - 1, Math.min(day, 28));
    while (candidate.getMonth() + 1 !== month) {
      candidate = new Date(year, month - 1, day - 1);
      break;
    }
  }
  // 判断是否已过
  const fDate = new Date(f.year, f.month - 1, f.day);
  if (candidate < fDate) {
    year++;
    candidate = new Date(year, month - 1, day);
    if (candidate.getMonth() + 1 !== month) {
      candidate = new Date(year, month - 1, 28);
    }
  }
  return candidate;
}

// 计算农历的下次周年日期
// 思路：在 fromDate 所在农历年的该月该日查找，若已过则在下一年查找
function nextLunarOccurrence(lunarMonth, lunarDay, isLeap, fromDate) {
  const f = fromDate ? normalizeDate(fromDate) : normalizeDate(new Date());
  let solar = solarToLunar(f.year, f.month, f.day);
  let tryYear = solar.year;

  // 当年尝试
  let candidate = tryLunarDate(tryYear, lunarMonth, lunarDay, isLeap);
  if (candidate < new Date(f.year, f.month - 1, f.day)) {
    candidate = tryLunarDate(tryYear + 1, lunarMonth, lunarDay, isLeap);
  }
  return candidate;
}

function tryLunarDate(year, month, day, isLeap) {
  // 若该年无此闰月，则退回到普通月
  const { leapMonth } = require('./lunar');
  let useLeap = isLeap;
  if (isLeap && leapMonth(year) !== month) {
    useLeap = false;
  }
  // 若该月天数不足（如该月无三十），则取该月最后一天
  const { monthDays, leapDays } = require('./lunar');
  let maxDay;
  if (useLeap) {
    maxDay = leapDays(year);
  } else {
    maxDay = monthDays(year, month);
  }
  const actualDay = Math.min(day, maxDay);
  return lunarToSolar(year, month, actualDay, useLeap);
}

// 距下次周年天数（当天为 0）
function daysUntilNext(event, fromDate) {
  const f = fromDate ? normalizeDate(fromDate) : normalizeDate(new Date());
  const fDate = new Date(f.year, f.month - 1, f.day);
  let next;
  if (event.dateType === 'lunar') {
    const b = normalizeDate(event.date);
    next = nextLunarOccurrence(b.month, b.day, event.isLeap || false, fromDate);
  } else {
    const b = normalizeDate(event.date);
    next = nextSolarOccurrence(b.month, b.day, fromDate);
  }
  const diff = Math.round((next - fDate) / 86400000);
  return { days: diff, nextDate: next };
}

// 已出生/已过天数
function daysSince(event, fromDate) {
  const f = fromDate ? normalizeDate(fromDate) : normalizeDate(new Date());
  const fDate = new Date(f.year, f.month - 1, f.day);
  const b = normalizeDate(event.date);
  let startDate;
  if (event.dateType === 'lunar') {
    startDate = lunarToSolar(b.year, b.month, b.day, event.isLeap || false);
  } else {
    startDate = new Date(b.year, b.month - 1, b.day);
  }
  const diff = Math.round((fDate - startDate) / 86400000);
  return diff >= 0 ? diff : 0;
}

// 事件完整信息计算
function computeEventInfo(event, fromDate) {
  const b = normalizeDate(event.date);
  const dateType = event.dateType || 'solar';
  const { days, nextDate } = daysUntilNext(event, fromDate);
  const age = calcAge(event.date, fromDate);
  const since = daysSince(event, fromDate);

  // 农历显示
  let lunarDisplay = '';
  if (dateType === 'lunar') {
    lunarDisplay = formatLunarDate({ year: b.year, month: b.month, day: b.day, isLeap: event.isLeap || false });
  } else {
    // 公历也附带显示农历（便于了解农历对照）
    try {
      const lunar = solarToLunar(b.year, b.month, b.day);
      lunarDisplay = formatLunarDate(lunar);
    } catch (e) {
      lunarDisplay = '';
    }
  }

  // 下次周年的农历显示
  let nextLunarDisplay = '';
  try {
    const nl = solarToLunar(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());
    nextLunarDisplay = formatLunarDate(nl);
  } catch (e) {
    nextLunarDisplay = '';
  }

  const zodiac = getZodiac(b.year);
  const constellation = getConstellation(b.month, b.day);

  const eventType = EVENT_TYPES[event.eventType] || EVENT_TYPES.custom;
  const category = CATEGORIES[event.category] || CATEGORIES.other;

  return {
    id: event.id,
    name: event.name,
    eventType: event.eventType,
    eventTypeLabel: eventType.label,
    eventTypeEmoji: eventType.emoji,
    category: event.category,
    categoryLabel: category.label,
    categoryEmoji: category.emoji,
    relationship: event.relationship || '',
    notes: event.notes || '',
    color: event.color || '#007aff',
    dateType,
    solarDate: `${b.year}-${pad2(b.month)}-${pad2(b.day)}`,
    lunarDisplay,
    nextDate: `${nextDate.getFullYear()}-${pad2(nextDate.getMonth() + 1)}-${pad2(nextDate.getDate())}`,
    nextLunarDisplay,
    daysUntilNext: days,
    age,
    daysSince: since,
    zodiacName: zodiac.name,
    zodiacEmoji: zodiac.emoji,
    constellationName: constellation.name,
    constellationEmoji: constellation.emoji,
    weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][nextDate.getDay()],
  };
}

module.exports = {
  ZODIAC,
  ZODIAC_EMOJI,
  CONSTELLATIONS,
  EVENT_TYPES,
  CATEGORIES,
  normalizeDate,
  getZodiac,
  getConstellation,
  calcAge,
  nextSolarOccurrence,
  nextLunarOccurrence,
  daysUntilNext,
  daysSince,
  computeEventInfo,
  pad2,
};
