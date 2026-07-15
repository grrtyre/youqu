// timezone-core.js
// 世界时钟核心逻辑 —— 纯函数，无副作用，可测试
// 依赖浏览器 Intl API（自动处理夏令时 DST），无需第三方库

(function (global) {
  'use strict';

  // 常用时区清单（城市 → IANA 时区名）
  const COMMON_TIMEZONES = [
    { city: '北京', tz: 'Asia/Shanghai', country: '中国' },
    { city: '上海', tz: 'Asia/Shanghai', country: '中国' },
    { city: '深圳', tz: 'Asia/Shanghai', country: '中国' },
    { city: '香港', tz: 'Asia/Hong_Kong', country: '中国香港' },
    { city: '台北', tz: 'Asia/Taipei', country: '中国台湾' },
    { city: '东京', tz: 'Asia/Tokyo', country: '日本' },
    { city: '首尔', tz: 'Asia/Seoul', country: '韩国' },
    { city: '新加坡', tz: 'Asia/Singapore', country: '新加坡' },
    { city: '曼谷', tz: 'Asia/Bangkok', country: '泰国' },
    { city: '雅加达', tz: 'Asia/Jakarta', country: '印尼' },
    { city: '孟买', tz: 'Asia/Kolkata', country: '印度' },
    { city: '迪拜', tz: 'Asia/Dubai', country: '阿联酋' },
    { city: '德黑兰', tz: 'Asia/Tehran', country: '伊朗' },
    { city: '莫斯科', tz: 'Europe/Moscow', country: '俄罗斯' },
    { city: '伊斯坦布尔', tz: 'Europe/Istanbul', country: '土耳其' },
    { city: '柏林', tz: 'Europe/Berlin', country: '德国' },
    { city: '巴黎', tz: 'Europe/Paris', country: '法国' },
    { city: '阿姆斯特丹', tz: 'Europe/Amsterdam', country: '荷兰' },
    { city: '伦敦', tz: 'Europe/London', country: '英国' },
    { city: '都柏林', tz: 'Europe/Dublin', country: '爱尔兰' },
    { city: '开罗', tz: 'Africa/Cairo', country: '埃及' },
    { city: '约堡', tz: 'Africa/Johannesburg', country: '南非' },
    { city: '纽约', tz: 'America/New_York', country: '美国' },
    { city: '华盛顿', tz: 'America/New_York', country: '美国' },
    { city: '迈阿密', tz: 'America/New_York', country: '美国' },
    { city: '多伦多', tz: 'America/Toronto', country: '加拿大' },
    { city: '芝加哥', tz: 'America/Chicago', country: '美国' },
    { city: '墨西哥城', tz: 'America/Mexico_City', country: '墨西哥' },
    { city: '丹佛', tz: 'America/Denver', country: '美国' },
    { city: '凤凰城', tz: 'America/Phoenix', country: '美国' },
    { city: '洛杉矶', tz: 'America/Los_Angeles', country: '美国' },
    { city: '旧金山', tz: 'America/Los_Angeles', country: '美国' },
    { city: '西雅图', tz: 'America/Los_Angeles', country: '美国' },
    { city: '温哥华', tz: 'America/Vancouver', country: '加拿大' },
    { city: '安克雷奇', tz: 'America/Anchorage', country: '美国' },
    { city: '夏威夷', tz: 'Pacific/Honolulu', country: '美国' },
    { city: '圣保罗', tz: 'America/Sao_Paulo', country: '巴西' },
    { city: '布宜诺斯艾利斯', tz: 'America/Argentina/Buenos_Aires', country: '阿根廷' },
    { city: '悉尼', tz: 'Australia/Sydney', country: '澳大利亚' },
    { city: '墨尔本', tz: 'Australia/Melbourne', country: '澳大利亚' },
    { city: '珀斯', tz: 'Australia/Perth', country: '澳大利亚' },
    { city: '奥克兰', tz: 'Pacific/Auckland', country: '新西兰' },
    { city: '斐济', tz: 'Pacific/Fiji', country: '斐济' },
  ];

  // 默认选中的时区（去重后）
  const DEFAULT_ZONES = [
    { city: '北京', tz: 'Asia/Shanghai' },
    { city: '东京', tz: 'Asia/Tokyo' },
    { city: '伦敦', tz: 'Europe/London' },
    { city: '纽约', tz: 'America/New_York' },
    { city: '旧金山', tz: 'America/Los_Angeles' },
    { city: '悉尼', tz: 'Australia/Sydney' },
  ];

  // 默认工作时段（当地时钟 9:00-18:00）
  const DEFAULT_WORK_HOURS = { start: 9, end: 18 };

  // 把 Date 在某时区下的各部分字段解析出来
  // 返回 { year, month(1-12), day, hour(0-23), minute, second, weekday }
  function getZoneParts(timezone, date) {
    date = date || new Date();
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, weekday: 'short'
    });
    const parts = fmt.formatToParts(date);
    const obj = {};
    for (const p of parts) obj[p.type] = p.value;
    let h = parseInt(obj.hour, 10);
    if (h === 24) h = 0; // 部分环境午夜返回 24
    return {
      year: parseInt(obj.year, 10),
      month: parseInt(obj.month, 10),
      day: parseInt(obj.day, 10),
      hour: h,
      minute: parseInt(obj.minute, 10),
      second: parseInt(obj.second, 10),
      weekday: obj.weekday,
    };
  }

  // 获取某时区相对 UTC 的偏移（分钟）。东八区返回 480。
  function getOffsetMinutes(timezone, date) {
    date = date || new Date();
    const p = getZoneParts(timezone, date);
    // 把该时区的"墙上时间"当作 UTC 构造时间戳
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUTC - date.getTime()) / 60000);
  }

  // 把偏移分钟转成 "UTC+8:00" 形式
  function formatOffset(minutes) {
    const sign = minutes >= 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return 'UTC' + sign + h + (m ? ':' + String(m).padStart(2, '0') : '');
  }

  // 获取某时区当前的小时数（含分钟小数，0-23.999）
  function getHoursInZone(timezone, date) {
    date = date || new Date();
    const p = getZoneParts(timezone, date);
    return p.hour + p.minute / 60 + p.second / 3600;
  }

  // 把 Date 格式化为某时区下的时间字符串
  // fmt 形如 'HH:mm' / 'HH:mm:ss' / 'YYYY-MM-DD HH:mm' / 'MM-DD HH:mm'
  function formatInZone(timezone, date, fmt) {
    date = date || new Date();
    fmt = fmt || 'HH:mm';
    const p = getZoneParts(timezone, date);
    const pad = (n) => String(n).padStart(2, '0');
    const weekdayCN = { Mon: '周一', Tue: '周二', Wed: '周三', Thu: '周四', Fri: '周五', Sat: '周六', Sun: '周日' };
    return fmt
      .replace('YYYY', p.year)
      .replace('MM', pad(p.month))
      .replace('DD', pad(p.day))
      .replace('HH', pad(p.hour))
      .replace('mm', pad(p.minute))
      .replace('ss', pad(p.second))
      .replace('W', weekdayCN[p.weekday] || p.weekday);
  }

  // 判断某时区在某时刻是白天还是夜晚（6:00-18:00 为白天）
  function isDaytime(timezone, date) {
    const h = getHoursInZone(timezone, date);
    return h >= 6 && h < 18;
  }

  // 计算两个时区在某时刻的小时差（带正负，base - target，单位小时）
  // 例：base=北京, target=纽约 → 返回 +13（北京比纽约快13小时）
  function getHourDiff(baseTz, targetTz, date) {
    date = date || new Date();
    const baseOff = getOffsetMinutes(baseTz, date);
    const targetOff = getOffsetMinutes(targetTz, date);
    return (baseOff - targetOff) / 60;
  }

  // 把工作时段（当地时钟）转换成 UTC 区间（分钟）
  // workHours: { start: 9, end: 18 }
  // 返回 [startUTC, endUTC]（分钟，0-1440，可能跨天）
  function workHoursToUTC(timezone, workHours, date) {
    date = date || new Date();
    const offset = getOffsetMinutes(timezone, date); // 该时区相对 UTC 的偏移
    // 当地 9:00 对应 UTC = 9:00 - offset
    let startUTC = workHours.start * 60 - offset;
    let endUTC = workHours.end * 60 - offset;
    // 归一化到 [0, 1440)
    startUTC = ((startUTC % 1440) + 1440) % 1440;
    endUTC = ((endUTC % 1440) + 1440) % 1440;
    return { startUTC, endUTC, offset };
  }

  // 计算多个时区工作时段在 UTC 上的重叠区间
  // zones: [{ city, tz }]
  // workHours: { start, end }（当地时钟）
  // 返回 [{ startUTC, endUTC }]（UTC 分钟，可能多段，因为跨天归一化后可能拆分）
  // 若无重叠返回 []
  function computeOverlap(zones, workHours, date) {
    date = date || new Date();
    if (!zones.length) return [];
    // 每个时区的工作时段在 UTC 上的区间（考虑跨天）
    // 用"展开到 [-1440, 2880]"的方式表达，便于求交
    const intervals = zones.map((z) => {
      const { startUTC, endUTC } = workHoursToUTC(z.tz, workHours, date);
      // 展开成三个副本：-1440~0, 0~1440, 1440~2880
      if (startUTC < endUTC) {
        // 正常区间
        return [
          { s: startUTC - 1440, e: endUTC - 1440 },
          { s: startUTC, e: endUTC },
          { s: startUTC + 1440, e: endUTC + 1440 },
        ];
      } else {
        // 跨天区间（如 22:00-6:00），拆成两段
        return [
          { s: startUTC - 1440, e: 1440 },
          { s: 0, e: endUTC },
          { s: startUTC, e: 1440 + endUTC },
          { s: 1440, e: endUTC + 1440 },
        ];
      }
    });

    // 以第一个时区的"中心区间 [0,1440]"为种子，依次求交
    let result = [{ s: 0, e: 1440 }];
    for (const list of intervals) {
      const next = [];
      for (const a of result) {
        for (const b of list) {
          const s = Math.max(a.s, b.s);
          const e = Math.min(a.e, b.e);
          if (e > s) next.push({ s, e });
        }
      }
      result = next;
      if (!result.length) break;
    }

    // 把结果归一化回 [0,1440)，并合并跨天相邻段
    const normalized = result.map((r) => ({
      startUTC: ((r.s % 1440) + 1440) % 1440,
      endUTC: ((r.e % 1440) + 1440) % 1440,
    }));
    return mergeIntervals(normalized);
  }

  // 合并相邻/重叠区间（处理 endUTC < startUTC 的跨天情况）
  function mergeIntervals(intervals) {
    if (!intervals.length) return [];
    // 把跨天区间 [s, e] (s>e) 拆成 [s,1440) + [0,e]
    const expanded = [];
    for (const it of intervals) {
      if (it.startUTC === it.endUTC) continue;
      if (it.startUTC < it.endUTC) {
        expanded.push([it.startUTC, it.endUTC]);
      } else {
        expanded.push([it.startUTC, 1440]);
        expanded.push([0, it.endUTC]);
      }
    }
    expanded.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [s, e] of expanded) {
      if (merged.length && s <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
      } else {
        merged.push([s, e]);
      }
    }
    // 再尝试首尾相连（若 [0,x] 和 [y,1440] 相邻）
    if (merged.length >= 2 && merged[0][0] === 0 && merged[merged.length - 1][1] === 1440) {
      const first = merged.shift();
      merged[merged.length - 1][1] = first[1];
      // 由于合并后可能再次出现 y > x，需转回跨天表达
    }
    return merged.map(([s, e]) => {
      if (s === 0 && e === 1440) return { startUTC: 0, endUTC: 1440, fullDay: true };
      return { startUTC: s, endUTC: e };
    });
  }

  // 把 UTC 分钟转换成参考时区的"墙上时间"小时数（0-23.999）
  function utcMinutesToZoneHour(utcMinutes, targetTz, date) {
    date = date || new Date();
    const offset = getOffsetMinutes(targetTz, date);
    let local = utcMinutes + offset;
    local = ((local % 1440) + 1440) % 1440;
    return local / 60;
  }

  // 把 UTC 分钟转成参考时区的 HH:mm 字符串
  function utcMinutesToZoneTime(utcMinutes, targetTz, date) {
    const h = utcMinutesToZoneHour(utcMinutes, targetTz, date);
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  // Unix 时间戳 → 指定时区的格式化字符串
  function convertTimestamp(ts, timezone, fmt) {
    // 兼容秒/毫秒
    const ms = ts > 1e12 ? ts : ts * 1000;
    return formatInZone(timezone, new Date(ms), fmt || 'YYYY-MM-DD HH:mm:ss');
  }

  // ISO 字符串 → 指定时区格式化字符串
  function convertISO(iso, timezone, fmt) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return formatInZone(timezone, d, fmt || 'YYYY-MM-DD HH:mm:ss');
  }

  // 把"YYYY-MM-DDTHH:mm"本地输入框值，按指定时区解析成 UTC Date
  function parseLocalInput(value, timezone) {
    // value 形如 "2026-07-05T14:30"
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (!m) return null;
    const [, y, mo, d, h, mi] = m.map(Number);
    if (!(y && mo && d)) return null;
    // 该时区墙上时间 y-mo-d h:mi 对应的 UTC = 墙上时间 - offset
    // 但 offset 依赖具体日期（DST），这里先按该日期的"正午"估算 offset
    const guess = Date.UTC(y, mo - 1, d, 12, 0, 0);
    const offset = getOffsetMinutes(timezone, new Date(guess));
    const utcMs = Date.UTC(y, mo - 1, d, h, mi, 0) - offset * 60000;
    return new Date(utcMs);
  }

  // 智能会议推荐：对重叠时段按"便利度"打分并排序
  // overlap: computeOverlap 的返回值 [{ startUTC, endUTC, fullDay? }]
  // refTz: 参考时区，用于把 UTC 时段换算成参考时区的墙上时间来评估时段好坏
  // 返回 [{ startUTC, endUTC, fullDay, score, label, startHour, endHour, durMin }]
  // score 0~1，越高越好；label 为 "极佳"/"较好"/"勉强"
  function rankOverlapSlots(overlap, refTz, date) {
    date = date || new Date();
    if (!overlap || !overlap.length) return [];
    return overlap.map((slot) => {
      const fullDay = !!slot.fullDay;
      const durMin = fullDay ? 1440 : ((slot.endUTC - slot.startUTC) + (slot.endUTC <= slot.startUTC ? 1440 : 0));
      const startH = utcMinutesToZoneHour(slot.startUTC, refTz, date);
      const endH = utcMinutesToZoneHour(slot.endUTC, refTz, date);
      // 综合分数：时段黄金度 × 0.65 + 时长分 × 0.35
      const golden = goldenHourScore(startH, endH);
      const durScore = Math.min(1, durMin / 180); // 3 小时即满分
      const score = Math.max(0, Math.min(1, golden * 0.65 + durScore * 0.35));
      let label;
      if (fullDay || score >= 0.8) label = '极佳';
      else if (score >= 0.5) label = '较好';
      else label = '勉强';
      return {
        startUTC: slot.startUTC,
        endUTC: slot.endUTC,
        fullDay,
        score: Math.round(score * 100) / 100,
        label,
        startHour: startH,
        endHour: endH,
        durMin,
      };
    }).sort((a, b) => b.score - a.score);
  }

  // 评估 [startH, endH]（参考时区墙上小时，可跨天）的"黄金度"
  // 黄金时段：9-11、14-17；午餐 12-13 扣分；早 <8 / 晚 >19 重扣
  function goldenHourScore(startH, endH) {
    // 把跨天区间归一为 0-24 线性区间，分点采样取平均
    const pts = 24;
    const span = endH > startH ? endH - startH : endH + 24 - startH;
    let sum = 0;
    for (let i = 0; i < pts; i++) {
      const h = ((startH + (span * i) / pts) % 24 + 24) % 24;
      sum += hourWeight(h);
    }
    return sum / pts;
  }

  // 单个小时的权重（参考时区墙上时间）
  function hourWeight(h) {
    if (h >= 9 && h < 12) return 1.0;        // 上午黄金
    if (h >= 14 && h < 18) return 1.0;       // 下午黄金
    if (h >= 12 && h < 14) return 0.55;      // 午餐
    if (h >= 8 && h < 9) return 0.6;         // 早 8 点
    if (h >= 18 && h < 19) return 0.6;       // 晚 18 点
    if (h >= 7 && h < 8) return 0.3;
    if (h >= 19 && h < 20) return 0.3;
    return 0.05;                              // 深夜/清晨
  }

  // 把 UTC 时段在参考时区下格式化成 "HH:00–HH:00"（跨天不额外标注，已归一）
  function formatSlotLocal(slot, refTz, date) {
    date = date || new Date();
    if (slot.fullDay) return '全天可约';
    const s = utcMinutesToZoneTime(slot.startUTC, refTz, date);
    const e = utcMinutesToZoneTime(slot.endUTC, refTz, date);
    return s + '–' + e;
  }

  // 导出
  global.TimezoneCore = {
    COMMON_TIMEZONES,
    DEFAULT_ZONES,
    DEFAULT_WORK_HOURS,
    getZoneParts,
    getOffsetMinutes,
    formatOffset,
    getHoursInZone,
    formatInZone,
    isDaytime,
    getHourDiff,
    workHoursToUTC,
    computeOverlap,
    mergeIntervals,
    utcMinutesToZoneHour,
    utcMinutesToZoneTime,
    convertTimestamp,
    convertISO,
    parseLocalInput,
    rankOverlapSlots,
    goldenHourScore,
    formatSlotLocal,
  };

  // CommonJS 兼容（供 Node 测试使用）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.TimezoneCore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
