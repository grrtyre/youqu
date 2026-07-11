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
  minimizeToTray: true     // 关闭时最小化到托盘
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
  formatTime
};
