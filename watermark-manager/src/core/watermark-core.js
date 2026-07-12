'use strict';
// 水印管家 - 核心逻辑模块
// 负责水印配置默认值、模板生成、变量替换、配置校验

// ==================== 默认配置 ====================

const DEFAULT_CONFIG = {
  enabled: false,           // 水印开关
  content: '内部资料 请勿外传', // 水印文字内容
  fontSize: 16,            // 字号 px
  color: '#888888',        // 水印颜色
  opacity: 0.12,           // 不透明度 0-1
  rotation: -25,           // 旋转角度
  gapX: 320,               // 水平间距 px
  gapY: 200,               // 垂直间距 px
  // 动态变量开关
  showUserName: false,     // 显示用户名
  showIP: false,           // 显示本机IP
  showTime: false,         // 显示时间
  timeFormat: 'YYYY-MM-DD HH:mm', // 时间格式
  // 行为
  autoStart: false,        // 开机自启
  minimizeToTray: true,    // 关闭时最小化到托盘
  // 定时水印：仅在工作时段/指定星期显示
  scheduleEnabled: false,  // 启用定时
  scheduleStart: '09:00',  // 起始时间 HH:mm
  scheduleEnd: '18:00',    // 结束时间 HH:mm（支持跨夜，如 22:00-06:00）
  scheduleDays: [1, 2, 3, 4, 5]  // 生效星期 0=周日 .. 6=周六
};

// ==================== 水印模板 ====================

const TEMPLATES = [
  {
    id: 'confidential',
    name: '机密文件',
    content: '内部资料 请勿外传',
    color: '#cc3333',
    opacity: 0.15,
    rotation: -25
  },
  {
    id: 'company',
    name: '公司名称',
    content: '某某科技有限公司',
    color: '#666666',
    opacity: 0.10,
    rotation: -20
  },
  {
    id: 'username',
    name: '工号溯源',
    content: '工号:{USERNAME}',
    color: '#0066cc',
    opacity: 0.12,
    rotation: -30
  },
  {
    id: 'ip-trace',
    name: 'IP溯源',
    content: '{IP} {TIME}',
    color: '#333333',
    opacity: 0.10,
    rotation: -25
  },
  {
    id: 'draft',
    name: '草稿水印',
    content: '草稿 DRAFT',
    color: '#ff9900',
    opacity: 0.20,
    rotation: -15
  },
  {
    id: 'copyright',
    name: '版权标识',
    content: '© 2026 版权所有',
    color: '#999999',
    opacity: 0.08,
    rotation: -30
  }
];

// ==================== 变量替换 ====================

/**
 * 解析水印内容中的变量占位符
 * 支持: {USERNAME} {IP} {TIME} {DATE} {MACHINE}
 * @param {string} content 原始内容
 * @param {object} vars 变量值 { username, ip, time, date, machine }
 * @returns {string} 替换后的内容
 */
function resolveVariables(content, vars) {
  if (!content) return '';
  let result = content;
  const replacements = {
    '{USERNAME}': vars.username || '',
    '{IP}': vars.ip || '',
    '{TIME}': vars.time || '',
    '{DATE}': vars.date || '',
    '{MACHINE}': vars.machine || ''
  };
  for (const [key, val] of Object.entries(replacements)) {
    result = result.split(key).join(val);
  }
  return result;
}

// ==================== 配置管理 ====================

/**
 * 合并用户配置与默认配置（防止缺字段）
 * @param {object} userConfig 用户保存的配置
 * @returns {object} 完整配置
 */
function mergeConfig(userConfig) {
  if (!userConfig || typeof userConfig !== 'object') {
    return { ...DEFAULT_CONFIG };
  }
  const merged = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (userConfig[key] !== undefined && userConfig[key] !== null) {
      merged[key] = userConfig[key];
    }
  }
  return merged;
}

/**
 * 校验配置合法性，返回修正后的配置
 * @param {object} config 配置
 * @returns {object} 校验后的配置
 */
function validateConfig(config) {
  const c = { ...config };
  // 数值范围限制
  c.fontSize = clampInt(c.fontSize, 8, 72);
  c.opacity = clampFloat(c.opacity, 0.02, 0.5);
  c.rotation = clampFloat(c.rotation, -90, 90);
  c.gapX = clampInt(c.gapX, 80, 1000);
  c.gapY = clampInt(c.gapY, 60, 800);
  // 颜色格式校验
  if (!/^#[0-9a-fA-F]{6}$/.test(c.color)) {
    c.color = '#888888';
  }
  // 布尔值
  c.enabled = !!c.enabled;
  c.showUserName = !!c.showUserName;
  c.showIP = !!c.showIP;
  c.showTime = !!c.showTime;
  c.autoStart = !!c.autoStart;
  c.minimizeToTray = !!c.minimizeToTray;
  c.scheduleEnabled = !!c.scheduleEnabled;
  // 定时时段
  c.scheduleStart = sanitizeHM(c.scheduleStart, '09:00');
  c.scheduleEnd = sanitizeHM(c.scheduleEnd, '18:00');
  c.scheduleDays = sanitizeDays(c.scheduleDays);
  // 内容非空
  if (!c.content || typeof c.content !== 'string') {
    c.content = DEFAULT_CONFIG.content;
  }
  return c;
}

function clampInt(val, min, max) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clampFloat(val, min, max) {
  const n = parseFloat(val);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// ==================== 定时水印 ====================

/**
 * 将 HH:mm 字符串解析为当日分钟数
 * @param {string} hm 形如 "09:00"
 * @param {number} fallbackMin 解析失败时的回退分钟数
 * @returns {number} 分钟数 0-1439
 */
function parseHM(hm, fallbackMin) {
  if (typeof hm !== 'string') return fallbackMin;
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(hm.trim());
  if (!m) return fallbackMin;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return fallbackMin;
  return h * 60 + mi;
}

/**
 * 规范化 HH:mm 字符串（非法则回退）
 */
function sanitizeHM(hm, fallback) {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(hm || '').trim());
  if (!m) return fallback;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return fallback;
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}

/**
 * 规范化星期数组（去重、范围 0-6、保序）
 */
function sanitizeDays(days) {
  if (!Array.isArray(days)) return [1, 2, 3, 4, 5];
  const seen = new Set();
  const out = [];
  for (const d of days) {
    const n = parseInt(d, 10);
    if (!isNaN(n) && n >= 0 && n <= 6 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out.length ? out : [1, 2, 3, 4, 5];
}

/**
 * 判断给定时刻是否处于定时区间内
 * - 未启用定时 → 永远返回 true
 * - 支持跨夜区间（start >= end 视为跨夜，如 22:00-06:00）
 * @param {Date} now
 * @param {object} config
 * @returns {boolean}
 */
function isInSchedule(now, config) {
  if (!config || !config.scheduleEnabled) return true;
  const days = Array.isArray(config.scheduleDays) ? config.scheduleDays : [1, 2, 3, 4, 5];
  const day = now.getDay(); // 0=周日 .. 6=周六
  if (days.indexOf(day) === -1) return false;
  const start = parseHM(config.scheduleStart, 9 * 60);
  const end = parseHM(config.scheduleEnd, 18 * 60);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start <= end) {
    return cur >= start && cur < end;
  }
  // 跨夜：在 start 之后 或 end 之前
  return cur >= start || cur < end;
}

// ==================== IP 识别（过滤虚拟网卡） ====================

const VIRTUAL_ADAPTER_HINTS = [
  'vmware', 'virtualbox', 'vbox', 'docker', 'wsl', 'hyper-v',
  'tap', 'vethernet', 'loopback pseudo', 'bluetooth', 'isatap', 'teredo'
];

/**
 * 从 os.networkInterfaces() 结果中挑选物理网卡 IPv4
 * 跳过虚拟网卡（VMware/VirtualBox/WSL/Hyper-V 等）与链路本地地址
 * @param {object} interfaces os.networkInterfaces() 返回值
 * @returns {string} IPv4 地址，无则 '127.0.0.1'
 */
function pickPhysicalIP(interfaces) {
  const physical = [];
  const virtual = [];
  for (const [name, ifaces] of Object.entries(interfaces || {})) {
    const lower = String(name).toLowerCase();
    const isVirtual = VIRTUAL_ADAPTER_HINTS.some(h => lower.indexOf(h) !== -1);
    for (const iface of ifaces || []) {
      if (iface.family !== 'IPv4' && iface.family !== 4) continue;
      if (iface.internal) continue;
      if (iface.address && iface.address.indexOf('169.254.') === 0) continue;
      (isVirtual ? virtual : physical).push(iface.address);
    }
  }
  if (physical.length) return physical[0];
  if (virtual.length) return virtual[0];
  return '127.0.0.1';
}

// ==================== 时间格式化 ====================

/**
 * 格式化时间
 * 支持: YYYY MM DD HH mm ss
 * @param {Date} date 日期对象
 * @param {string} fmt 格式字符串
 * @returns {string}
 */
function formatTime(date, fmt) {
  if (!date) date = new Date();
  if (!fmt) fmt = 'YYYY-MM-DD HH:mm';
  const pad = (n) => String(n).padStart(2, '0');
  const map = {
    'YYYY': date.getFullYear(),
    'MM': pad(date.getMonth() + 1),
    'DD': pad(date.getDate()),
    'HH': pad(date.getHours()),
    'mm': pad(date.getMinutes()),
    'ss': pad(date.getSeconds())
  };
  let result = fmt;
  for (const [key, val] of Object.entries(map)) {
    result = result.split(key).join(val);
  }
  return result;
}

// ==================== 导出 ====================

module.exports = {
  DEFAULT_CONFIG,
  TEMPLATES,
  resolveVariables,
  mergeConfig,
  validateConfig,
  formatTime,
  isInSchedule,
  parseHM,
  sanitizeHM,
  sanitizeDays,
  pickPhysicalIP
};
