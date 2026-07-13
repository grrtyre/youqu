// 农历转换模块（1900-2100）
// 基于通用农历查询表算法，仅使用整数运算，无外部依赖

// 1900-2100 每年的农历信息编码
// 低位 4 位：闰月月份（0 表示无闰月）
// 第 5-16 位：12 个月的大小月标志（1=30天, 0=29天）
// 第 17 位：闰月大小月标志
const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
  0x0d520
];

const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAY_PREFIX = ['初', '十', '廿', '卅'];
const LUNAR_DAY_DIGIT = ['十', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function leapMonth(year) {
  return LUNAR_INFO[year - 1900] & 0xf;
}

function leapDays(year) {
  if (leapMonth(year)) {
    return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

function monthDays(year, month) {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

function lunarYearDays(year) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[year - 1900] & i) ? 1 : 0;
  }
  return sum + leapDays(year);
}

// 公历转农历：返回 {year, month, day, isLeap}
function solarToLunar(year, month, day) {
  if (year < 1900 || year > 2100) {
    throw new Error('农历转换仅支持 1900-2100 年');
  }
  const baseDate = new Date(1900, 0, 31);
  const objDate = new Date(year, month - 1, day);
  let offset = Math.round((objDate - baseDate) / 86400000);

  let y, temp = 0;
  for (y = 1900; y < 2101 && offset > 0; y++) {
    temp = lunarYearDays(y);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    y--;
  }

  const leap = leapMonth(y);
  let isLeap = false;

  let m;
  for (m = 1; m < 13 && offset > 0; m++) {
    if (leap > 0 && m === leap + 1 && !isLeap) {
      --m;
      isLeap = true;
      temp = leapDays(y);
    } else {
      temp = monthDays(y, m);
    }
    if (isLeap && m === leap + 1) isLeap = false;
    offset -= temp;
  }

  if (offset === 0 && leap > 0 && m === leap + 1) {
    if (isLeap) {
      isLeap = false;
    } else {
      isLeap = true;
      --m;
    }
  }

  if (offset < 0) {
    offset += temp;
    --m;
  }

  return { year: y, month: m, day: offset + 1, isLeap };
}

// 农历转公历：返回 Date
function lunarToSolar(year, month, day, isLeap) {
  if (year < 1900 || year > 2100) {
    throw new Error('农历转换仅支持 1900-2100 年');
  }
  const baseDate = new Date(1900, 0, 31);
  let offset = 0;

  for (let i = 1900; i < year; i++) {
    offset += lunarYearDays(i);
  }

  // 构建当年农历月份的日历顺序：1, 2, ..., leap, 闰leap, leap+1, ...
  const leap = leapMonth(year);
  const monthSeq = [];
  for (let m = 1; m <= 12; m++) {
    monthSeq.push({ m, isLeap: false });
    if (m === leap) monthSeq.push({ m, isLeap: true });
  }

  // 累加目标月之前所有月份的天数
  for (const mo of monthSeq) {
    if (mo.m === month && mo.isLeap === isLeap) break;
    if (mo.isLeap) {
      offset += leapDays(year);
    } else {
      offset += monthDays(year, mo.m);
    }
  }

  offset += day - 1;

  const result = new Date(baseDate);
  result.setDate(result.getDate() + offset);
  return result;
}

// 农历日期格式化：返回如 "腊月初一"、"闰六月十五"
function formatLunarDate(lunar) {
  const monthName = (lunar.isLeap ? '闰' : '') + LUNAR_MONTH_NAMES[lunar.month - 1] + '月';
  let dayName;
  if (lunar.day === 10) {
    dayName = '初十';
  } else if (lunar.day === 20) {
    dayName = '二十';
  } else if (lunar.day === 30) {
    dayName = '三十';
  } else {
    const prefix = LUNAR_DAY_PREFIX[Math.floor(lunar.day / 10)];
    const digit = LUNAR_DAY_DIGIT[lunar.day % 10];
    dayName = prefix + digit;
  }
  return monthName + dayName;
}

module.exports = {
  LUNAR_INFO,
  leapMonth,
  leapDays,
  monthDays,
  lunarYearDays,
  solarToLunar,
  lunarToSolar,
  formatLunarDate,
  LUNAR_MONTH_NAMES,
};
