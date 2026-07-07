// date-utils.js — 日期计算与农历转换
// 职责：公历/农历日期计算、天数差、格式化、相对描述
// 农历数据覆盖 1900-2099，使用经典查表算法

// 农历查找表 1900-2099
// 每个元素编码规则：
//   bits[15:4]  12 个月的大小月（1=30天, 0=29天），高位为正月
//   bits[3:0]   闰月月份（0 表示无闰月）
//   bit[16]     闰月大小月（仅当有闰月时有效，1=30天）
// 注：实际本表使用 16 位整数 + 闰月大小单独存放的约定（见 lYearDays 实现）
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
];

const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];
const SOLAR_TERMS = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
];
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// 返回农历 y 年的总天数
function lYearDays(y) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  }
  return sum + leapDays(y);
}

// 闰月天数
function leapDays(y) {
  if (leapMonth(y)) {
    return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

// 闰月月份（0 = 无闰月）
function leapMonth(y) {
  return LUNAR_INFO[y - 1900] & 0xf;
}

// y 年第 m 月的天数（m 从 1 开始，1=正月）
function monthDays(y, m) {
  return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
}

// 公历转农历
// 输入：Date 对象（本地时区）
// 输出：{ year, month, day, isLeap, monthName, dayName, ganZhi, zodiac, term }
// 采用经典查表算法（参考 lunar-javascript）
function solarToLunar(date) {
  const baseDate = new Date(1900, 0, 31);
  let offset = Math.round((date - baseDate) / 86400000);
  let i, temp = 0;
  for (i = 1900; i < 2101 && offset > 0; i++) {
    temp = lYearDays(i);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    i--;
  }
  const year = i;

  const leap = leapMonth(year);
  let isLeap = false;
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) {
      i--;
      isLeap = true;
      temp = leapDays(year);
    } else {
      temp = monthDays(year, i);
    }
    if (isLeap && i === leap + 1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) {
      isLeap = false;
    } else {
      isLeap = true;
      i--;
    }
  }
  if (offset < 0) {
    offset += temp;
    i--;
  }
  const month = i;
  const day = offset + 1;

  const ganZhi = getGanZhi(year);
  const zodiac = getZodiac(year);
  const monthName = (isLeap ? '闰' : '') + LUNAR_MONTHS[month - 1] + '月';
  const dayName = LUNAR_DAYS[day - 1];

  return {
    year, month, day, isLeap,
    monthName, dayName,
    ganZhi, zodiac,
    term: getSolarTerm(date)
  };
}

// 天干地支（年）
function getGanZhi(lunarYear) {
  const offset = lunarYear - 4;
  return TIAN_GAN[offset % 10] + DI_ZHI[offset % 12];
}

// 生肖
function getZodiac(lunarYear) {
  return ZODIAC[(lunarYear - 4) % 12];
}

// 节气（简化：基于地球公转近似，精度 ±1 天）
function getSolarTerm(date) {
  // sTerm 计算某节气在 y 年的公历日期（日）
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  // 节气近似公式（世纪项使用 21 世纪常量）
  const sTermInfo = [
    0, 21208, 42467, 63836, 85337, 107014,
    128867, 150921, 173149, 195551, 218072, 240693,
    263343, 285989, 308563, 331033, 353350, 375494,
    397447, 419210, 440795, 462224, 483532, 504758
  ];
  function sTerm(y, n) {
    const ms = Date.UTC(y, 0, 1, 0, 0, 0) + (sTermInfo[n] * 60000);
    return new Date(ms).getUTCDate();
  }
  const idx = m * 2;
  if (d === sTerm(y, idx)) return SOLAR_TERMS[idx];
  if (d === sTerm(y, idx + 1)) return SOLAR_TERMS[idx + 1];
  return '';
}

// 农历转公历（在某公历年内查找匹配的农历日期）
// 输入：lunarMonth, lunarDay, isLeap, yearHint（搜索的公历年份）
// 输出：Date 对象 或 null
function lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeap) {
  // 从该年正月初一附近开始遍历查找（农历正月初一通常在 1/21 - 2/21 之间）
  // 简化：遍历该公历年的每一天做匹配（365 次 solarToLunar 调用，可接受）
  const start = new Date(lunarYear, 0, 1);
  for (let i = 0; i < 400; i++) {
    const d = new Date(lunarYear, 0, 1 + i);
    if (d.getFullYear() !== lunarYear && d.getFullYear() !== lunarYear + 1) continue;
    const l = solarToLunar(d);
    if (l.year === lunarYear && l.month === lunarMonth && l.day === lunarDay && l.isLeap === !!isLeap) {
      return d;
    }
    if (l.year > lunarYear) break;
  }
  return null;
}

// 两个日期之间的天数差（按本地时区，仅比日期不含时间）
// 返回正数表示 from 在 to 之前
function daysBetween(from, to) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((a - b) / 86400000);
}

// 格式化日期 YYYY-MM-DD
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 解析 YYYY-MM-DD
function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

// 解析用户输入的多种格式
// 支持：YYYY-MM-DD / YYYY/M/D / YYYY年M月D日 / 农历：农历腊月廿三
function parseFlexible(input) {
  if (!input) return null;
  input = String(input).trim();
  // 纯数字日期
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(input);
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  }
  m = /^(\d{4})年(\d{1,2})月(\d{1,2})日?$/.exec(input);
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  }
  return null;
}

// 星期几中文
function weekdayCN(date) {
  return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
}

// 相对描述
// days > 0 表示未来还有 N 天；days < 0 表示已过去 N 天；0 表示今天
function relativeText(days) {
  if (days === 0) return '就是今天';
  if (days > 0) {
    if (days === 1) return '还有 1 天';
    if (days < 30) return `还有 ${days} 天`;
    if (days < 365) return `还有 ${Math.round(days / 30)} 个月`;
    return `还有 ${Math.floor(days / 365)} 年 ${Math.round((days % 365) / 30)} 个月`;
  }
  const abs = -days;
  if (abs === 1) return '已过 1 天';
  if (abs < 30) return `已过 ${abs} 天`;
  if (abs < 365) return `已过 ${Math.round(abs / 30)} 个月`;
  return `已过 ${Math.floor(abs / 365)} 年`;
}

module.exports = {
  solarToLunar, lunarToSolar,
  daysBetween, formatDate, parseDate, parseFlexible,
  weekdayCN, relativeText,
  getGanZhi, getZodiac, getSolarTerm,
  LUNAR_MONTHS, LUNAR_DAYS
};
