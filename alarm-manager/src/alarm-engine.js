// 闹钟管家 - 闹钟调度引擎（纯函数模块，可在主进程和测试中复用）
// 闹钟数据结构：
//   {
//     id: 'a_xxx',
//     label: '起床',
//     hour: 7,             // 0-23
//     minute: 30,          // 0-59
//     enabled: true,
//     repeat: {
//       type: 'once'|'daily'|'weekdays'|'weekend'|'custom'|'lunar-annual'|'lunar-once',
//       weekdays: [1,2,3,4,5],   // 仅 type=custom 时使用，0=周日..6=周六
//       lunarMonth: 1,            // 仅 lunar-* 时使用，1..12
//       lunarDay: 15,             // 仅 lunar-* 时使用，1..30
//       isLeap: false             // 仅 lunar-* 时使用，是否闰月
//     },
//     sound: 'chime',
//     snoozeMinutes: 5,
//     maxSnoozeCount: 3,
//     volume: 0.9,
//     lastTriggered: null,        // 上次触发时间戳
//     nextTrigger: 1234567890,    // 下次触发时间戳
//     snoozeCount: 0,             // 当前贪睡次数
//     createdAt: 1234567890
//   }

const lunar = require('./lunar.js');

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'];

// 工具：返回今天 0 点的 Date
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 工具：返回明天的 Date（同时分秒）
function nextDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

// 工具：构造今天的指定时刻
function todayAt(date, hour, minute) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// 判断闰年
function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// 公历月份天数
function solarDaysInMonth(y, m) {
  const days = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[m - 1];
}

// 比较两个时间戳是否在同一"日"（按本地时区）
function sameDay(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth() === db.getMonth() &&
         da.getDate() === db.getDate();
}

// 计算下一次触发时间（基于 from 时间，默认 now）
// 如果闹钟已禁用或配置无效，返回 null
function nextTrigger(alarm, from) {
  if (!alarm || !alarm.enabled) return null;
  if (typeof alarm.hour !== 'number' || typeof alarm.minute !== 'number') return null;
  from = from || Date.now();
  const rep = alarm.repeat || { type: 'once' };
  const type = rep.type || 'once';

  // 一次性闹钟
  if (type === 'once') {
    const candidate = todayAt(from, alarm.hour, alarm.minute);
    // 如果今天时刻已过，则一次性闹钟不再触发（一次性语义）
    if (candidate.getTime() < from) {
      // 已过期，但若 lastTriggered 为空，则仍在今天可触发未来时刻？
      // 严格 once：如果今天时刻未到，则下一次=今天；否则不触发
      return null;
    }
    return candidate.getTime();
  }

  // 每日
  if (type === 'daily') {
    return findNextDaily(from, alarm.hour, alarm.minute, [0,1,2,3,4,5,6]);
  }
  // 工作日
  if (type === 'weekdays') {
    return findNextDaily(from, alarm.hour, alarm.minute, [1,2,3,4,5]);
  }
  // 周末
  if (type === 'weekend') {
    return findNextDaily(from, alarm.hour, alarm.minute, [0,6]);
  }
  // 自定义周几
  if (type === 'custom') {
    const wd = Array.isArray(rep.weekdays) ? rep.weekdays : [];
    if (wd.length === 0) return null;
    return findNextDaily(from, alarm.hour, alarm.minute, wd);
  }
  // 农历每年（如正月十五、八月十五）
  if (type === 'lunar-annual') {
    return findNextLunarAnnual(from, rep.lunarMonth, rep.lunarDay, !!rep.isLeap, alarm.hour, alarm.minute);
  }
  // 农历一次性
  if (type === 'lunar-once') {
    return findNextLunarOnce(from, rep.lunarYear || (new Date(from).getFullYear()), rep.lunarMonth, rep.lunarDay, !!rep.isLeap, alarm.hour, alarm.minute);
  }
  return null;
}

// 在 from 后查找下一个公历某周几的指定时刻
function findNextDaily(from, hour, minute, weekdays) {
  let d = new Date(from);
  for (let i = 0; i < 8; i++) {
    const candidate = todayAt(d, hour, minute);
    if (candidate.getTime() > from && weekdays.indexOf(candidate.getDay()) >= 0) {
      return candidate.getTime();
    }
    d = nextDay(d);
  }
  return null;
}

// 农历年度：从今年起查找最多 5 年内的最近触发时间
function findNextLunarAnnual(from, lunarMonth, lunarDay, isLeap, hour, minute) {
  const startYear = new Date(from).getFullYear();
  for (let y = startYear; y < startYear + 5; y++) {
    try {
      let solar;
      // 如果指定闰月，优先尝试闰月；否则用平月
      if (isLeap) {
        if (lunar.leapMonth(y) !== lunarMonth) continue; // 该年无此闰月
        solar = lunar.lunarToSolar(y, lunarMonth, lunarDay, true);
      } else {
        solar = lunar.lunarToSolar(y, lunarMonth, lunarDay, false);
      }
      if (!solar) continue;
      const candidate = new Date(solar);
      candidate.setHours(hour, minute, 0, 0);
      if (candidate.getTime() > from) {
        return candidate.getTime();
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// 农历一次性：在指定农历年查找
function findNextLunarOnce(from, lunarYear, lunarMonth, lunarDay, isLeap, hour, minute) {
  try {
    const solar = lunar.lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeap);
    if (!solar) return null;
    const candidate = new Date(solar);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate.getTime() > from) {
      return candidate.getTime();
    }
    return null;
  } catch (e) {
    return null;
  }
}

// 判断某个闹钟在 [lastCheck, now] 区间内是否应该触发
// 防重复触发：依赖 alarm.lastTriggered
function shouldFire(alarm, now, lastCheck) {
  if (!alarm || !alarm.enabled) return false;
  now = now || Date.now();
  lastCheck = lastCheck || alarm.lastTriggered || (now - 60000);
  const next = alarm.nextTrigger;
  if (next == null) return false;
  // nextTrigger 在 [lastCheck, now] 区间内，则触发
  if (next >= lastCheck && next <= now) {
    return true;
  }
  return false;
}

// 触发后：更新 lastTriggered，并计算新的 nextTrigger
// 对于 once 类型，触发后 enabled=false
// 对于其他类型，计算下一次
function afterFired(alarm, firedAt) {
  firedAt = firedAt || Date.now();
  alarm.lastTriggered = firedAt;
  alarm.snoozeCount = 0;
  if (alarm.repeat && alarm.repeat.type === 'once') {
    alarm.enabled = false;
    alarm.nextTrigger = null;
  } else if (alarm.repeat && alarm.repeat.type === 'lunar-once') {
    alarm.enabled = false;
    alarm.nextTrigger = null;
  } else {
    // 计算下一次（从触发时刻 +1 秒开始，避免重复命中）
    alarm.nextTrigger = nextTrigger(alarm, firedAt + 1000);
  }
  return alarm;
}

// 贪睡：增加 snoozeCount，nextTrigger = now + snoozeMinutes
// 若超过 maxSnoozeCount，则不再贪睡，返回 false
function snooze(alarm, now) {
  now = now || Date.now();
  const max = (typeof alarm.maxSnoozeCount === 'number') ? alarm.maxSnoozeCount : 3;
  if (alarm.snoozeCount >= max) return false;
  alarm.snoozeCount = (alarm.snoozeCount || 0) + 1;
  const mins = alarm.snoozeMinutes || 5;
  alarm.nextTrigger = now + mins * 60 * 1000;
  return true;
}

// 取消贪睡：恢复到正常下一次触发
function cancelSnooze(alarm, now) {
  now = now || Date.now();
  alarm.snoozeCount = 0;
  alarm.nextTrigger = nextTrigger(alarm, now);
  return alarm;
}

// 友好的重复模式描述
function describeRepeat(rep) {
  if (!rep || !rep.type) return '一次性';
  switch (rep.type) {
    case 'once': return '一次性';
    case 'daily': return '每天';
    case 'weekdays': return '工作日';
    case 'weekend': return '周末';
    case 'custom': {
      if (!rep.weekdays || rep.weekdays.length === 0) return '自定义（未选）';
      const list = rep.weekdays.slice().sort().map(w => '周' + WEEKDAY_CN[w]);
      return '每周 ' + list.join('、');
    }
    case 'lunar-annual': {
      return '农历每年 ' + (rep.isLeap ? '闰' : '') + rep.lunarMonth + '月' + lunar.dayName(rep.lunarDay);
    }
    case 'lunar-once': {
      return '农历 ' + (rep.lunarYear || '') + '年' + (rep.isLeap ? '闰' : '') + rep.lunarMonth + '月' + lunar.dayName(rep.lunarDay);
    }
    default: return '未知';
  }
}

// 友好的下次触发倒计时文本
function describeCountdown(nextTs, now) {
  now = now || Date.now();
  if (nextTs == null) return '已停用';
  let diff = nextTs - now;
  if (diff < 0) diff = 0;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (days > 0) return days + '天 ' + hours + '小时';
  if (hours > 0) return hours + '小时 ' + mins + '分';
  if (mins > 0) return mins + '分 ' + secs + '秒';
  return secs + '秒';
}

// 友好的下次触发时间文本
function describeNextTime(nextTs) {
  if (nextTs == null) return '—';
  const d = new Date(nextTs);
  const now = new Date();
  const sameD = sameDay(d, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = sameDay(d, tomorrow);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameD) return '今天 ' + hh + ':' + mm;
  if (isTomorrow) return '明天 ' + hh + ':' + mm;
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh + ':' + mm;
}

// 创建新闹钟（带默认值）
function createAlarm(input) {
  input = input || {};
  const alarm = {
    id: input.id || ('a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)),
    label: input.label || '闹钟',
    hour: typeof input.hour === 'number' ? input.hour : 7,
    minute: typeof input.minute === 'number' ? input.minute : 0,
    enabled: input.enabled !== false,
    repeat: input.repeat || { type: 'once' },
    sound: input.sound || 'chime',
    snoozeMinutes: typeof input.snoozeMinutes === 'number' ? input.snoozeMinutes : 5,
    maxSnoozeCount: typeof input.maxSnoozeCount === 'number' ? input.maxSnoozeCount : 3,
    volume: typeof input.volume === 'number' ? input.volume : 0.9,
    lastTriggered: input.lastTriggered || null,
    snoozeCount: input.snoozeCount || 0,
    createdAt: input.createdAt || Date.now()
  };
  alarm.nextTrigger = nextTrigger(alarm);
  return alarm;
}

module.exports = {
  WEEKDAY_CN,
  startOfDay,
  todayAt,
  nextDay,
  sameDay,
  isLeapYear,
  solarDaysInMonth,
  nextTrigger,
  findNextDaily,
  findNextLunarAnnual,
  findNextLunarOnce,
  shouldFire,
  afterFired,
  snooze,
  cancelSnooze,
  describeRepeat,
  describeCountdown,
  describeNextTime,
  createAlarm
};
