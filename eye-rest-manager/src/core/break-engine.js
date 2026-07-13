// break-engine.js — 休息调度核心引擎
// 职责：根据设置计算下一次休息倒计时、推进状态机、生成休息计划
// 纯逻辑模块，不依赖 Electron，便于单元测试

'use strict';

const BREAK_TYPES = ['micro', 'short', 'long'];

const DEFAULT_SETTINGS = {
  breaks: {
    micro:  { enabled: true,  interval: 20,  duration: 20  }, // 20-20-20 法则：每 20 分钟，休息 20 秒
    short:  { enabled: true,  interval: 60,  duration: 180 }, // 每 60 分钟，休息 3 分钟
    long:   { enabled: true,  interval: 180, duration: 600 }  // 每 180 分钟，休息 10 分钟
  },
  warning: { enabled: true, leadTime: 10 },                    // 休息前 10 秒预警
  dnd:     { enabled: false, start: '22:00', end: '08:00' },   // 免打扰时段
  fullscreenSuppress: true,                                    // 全屏时抑制休息
  strictMode: false,                                           // 严格模式：休息时不可跳过/延后/关闭窗口
  sound: true,
  launchAtLogin: false
};

// 深拷贝（设置需要可变副本）
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// 用用户设置合并默认设置，保证字段完整
function normalizeSettings(user) {
  const out = clone(DEFAULT_SETTINGS);
  if (!user || typeof user !== 'object') return out;
  if (user.breaks && typeof user.breaks === 'object') {
    for (const t of BREAK_TYPES) {
      if (user.breaks[t] && typeof user.breaks[t] === 'object') {
        out.breaks[t] = {
          enabled: boolOr(user.breaks[t].enabled, out.breaks[t].enabled),
          interval: clampInt(user.breaks[t].interval, 1, 240, out.breaks[t].interval),
          duration: clampInt(user.breaks[t].duration, 5, 3600, out.breaks[t].duration)
        };
      }
    }
  }
  if (user.warning && typeof user.warning === 'object') {
    out.warning = {
      enabled: boolOr(user.warning.enabled, out.warning.enabled),
      leadTime: clampInt(user.warning.leadTime, 0, 60, out.warning.leadTime)
    };
  }
  if (user.dnd && typeof user.dnd === 'object') {
    out.dnd = {
      enabled: boolOr(user.dnd.enabled, out.dnd.enabled),
      start: timeStrOr(user.dnd.start, out.dnd.start),
      end: timeStrOr(user.dnd.end, out.dnd.end)
    };
  }
  out.fullscreenSuppress = boolOr(user.fullscreenSuppress, out.fullscreenSuppress);
  out.strictMode = boolOr(user.strictMode, out.strictMode);
  out.sound = boolOr(user.sound, out.sound);
  out.launchAtLogin = boolOr(user.launchAtLogin, out.launchAtLogin);
  return out;
}

function boolOr(v, d) { return typeof v === 'boolean' ? v : d; }
function clampInt(v, min, max, d) {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.max(min, Math.min(max, Math.round(n)));
}
function timeStrOr(v, d) {
  if (typeof v !== 'string') return d;
  return /^\d{2}:\d{2}$/.test(v) ? v : d;
}

// 给定一个时间（Date），判断是否在免打扰时段内
// 支持跨午夜，例如 start=22:00 end=08:00
function isInDND(now, dnd) {
  if (!dnd || !dnd.enabled) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = dnd.start.split(':').map(Number);
  const [eh, em] = dnd.end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  // 跨午夜
  return cur >= start || cur < end;
}

// 计算从某个起始时刻起，所有启用的休息类型的下次触发时间
// 返回按时间升序排列的数组：[{ type, time: Date, durationSec }]
function scheduleNextBreaks(settings, fromTime) {
  const out = [];
  for (const t of BREAK_TYPES) {
    const cfg = settings.breaks[t];
    if (!cfg || !cfg.enabled) continue;
    const fire = new Date(fromTime.getTime() + cfg.interval * 60 * 1000);
    out.push({ type: t, time: fire, durationSec: cfg.duration });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

// 状态机：idle（待命）/ warning（预警中）/ break（休息中）/ paused（手动暂停）
const STATES = { IDLE: 'idle', WARNING: 'warning', BREAK: 'break', PAUSED: 'paused' };

// 给定当前状态 + 距下次休息的秒数，返回下一个状态
// - secondsToBreak > leadTime: IDLE
// - 0 < secondsToBreak <= leadTime: WARNING
// - secondsToBreak <= 0: BREAK
function nextIdleState(secondsToBreak, settings) {
  const lead = settings.warning && settings.warning.enabled ? settings.warning.leadTime : 0;
  if (secondsToBreak <= 0) return STATES.BREAK;
  if (secondsToBreak <= lead) return STATES.WARNING;
  return STATES.IDLE;
}

// 计算两个时间戳之间相隔秒数（向上取整，避免 0 秒边界）
function secondsBetween(from, to) {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 1000));
}

module.exports = {
  BREAK_TYPES,
  DEFAULT_SETTINGS,
  STATES,
  normalizeSettings,
  isInDND,
  scheduleNextBreaks,
  nextIdleState,
  secondsBetween,
  // 便于测试导出内部函数
  _internals: { boolOr, clampInt, timeStrOr, clone }
};
