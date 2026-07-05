// 速览管家 - 核心预览引擎
// 纯逻辑模块，不依赖 Electron，便于单元测试
// 职责：文件类型识别、预览策略路由、元信息提取、历史记录管理

'use strict';

const path = require('path');
const fs = require('fs');

// ===== 文件类型分类表 =====
const TYPE_CATEGORIES = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif', 'tiff', 'tif'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv', 'wmv', 'flv'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff'],
  pdf:   ['pdf'],
  text:  ['txt', 'log', 'ini', 'conf', 'cfg', 'env', 'csv', 'tsv'],
  code:  ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'lua', 'r', 'dart', 'vue', 'svelte', 'yml', 'yaml', 'toml', 'xml', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'sql', 'graphql', 'dockerfile', 'makefile'],
  markdown: ['md', 'markdown', 'mdx'],
  json:  ['json', 'json5', 'jsonc'],
  archive: ['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'],
  office: ['docx', 'pptx', 'xlsx', 'doc', 'ppt', 'xls'],
  font:  ['ttf', 'otf', 'woff', 'woff2'],
};

// 代码类语言映射（用于高亮显示）
const CODE_LANGUAGE_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', java: 'java', c: 'c', cpp: 'cpp', cc: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp', go: 'go', rs: 'rust', rb: 'ruby', php: 'php', swift: 'swift',
  kt: 'kotlin', scala: 'scala', sh: 'bash', bash: 'bash', zsh: 'bash',
  ps1: 'powershell', bat: 'batch', cmd: 'batch', lua: 'lua', r: 'r',
  dart: 'dart', vue: 'xml', svelte: 'xml', yml: 'yaml', yaml: 'yaml',
  toml: 'ini', xml: 'xml', html: 'xml', htm: 'xml', css: 'css',
  scss: 'scss', sass: 'sass', less: 'less', sql: 'sql', graphql: 'graphql',
};

// 可预览的最大文本文件体积（5MB），超过则提示
const MAX_TEXT_SIZE = 5 * 1024 * 1024;
// 可预览的最大媒体体积（200MB）
const MAX_MEDIA_SIZE = 200 * 1024 * 1024;

/**
 * 根据文件路径返回分类
 * @param {string} filePath
 * @returns {{ category: string, ext: string }}
 */
function categorize(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  for (const [category, exts] of Object.entries(TYPE_CATEGORIES)) {
    if (exts.includes(ext)) {
      return { category, ext };
    }
  }
  return { category: 'unknown', ext };
}

/**
 * 判断是否可预览
 */
function isPreviewable(filePath) {
  const { category } = categorize(filePath);
  return category !== 'unknown';
}

/**
 * 获取代码高亮语言
 */
function getHighlightLanguage(ext) {
  return CODE_LANGUAGE_MAP[ext] || null;
}

/**
 * 友好的体积字符串
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * 提取文件元信息
 */
function getMeta(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const { category, ext } = categorize(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      dir: path.dirname(filePath),
      ext,
      category,
      size: stat.size,
      sizeText: formatSize(stat.size),
      mtime: stat.mtime.toISOString(),
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
    };
  } catch (e) {
    return null;
  }
}

/**
 * 决定预览策略
 * @returns {{ kind: string, language?: string, tooLarge?: boolean, supported: boolean }}
 */
function decidePreview(filePath, statSize) {
  const { category, ext } = categorize(filePath);
  switch (category) {
    case 'image':
      return { kind: 'image', supported: true };
    case 'video':
      return { kind: 'video', supported: statSize <= MAX_MEDIA_SIZE };
    case 'audio':
      return { kind: 'audio', supported: statSize <= MAX_MEDIA_SIZE };
    case 'pdf':
      return { kind: 'pdf', supported: true };
    case 'markdown':
      return { kind: 'markdown', supported: statSize <= MAX_TEXT_SIZE };
    case 'json':
      return { kind: 'json', supported: statSize <= MAX_TEXT_SIZE };
    case 'text':
      return { kind: 'text', supported: statSize <= MAX_TEXT_SIZE };
    case 'code':
      return { kind: 'code', language: getHighlightLanguage(ext), supported: statSize <= MAX_TEXT_SIZE };
    case 'archive':
      return { kind: 'archive', supported: true };
    case 'office':
      return { kind: 'office', supported: true };
    case 'font':
      return { kind: 'font', supported: true };
    default:
      return { kind: 'unknown', supported: false };
  }
}

/**
 * 历史记录管理器
 */
class History {
  constructor(maxSize = 50) {
    this.items = [];
    this.maxSize = maxSize;
  }
  add(filePath) {
    if (!filePath) return;
    // 去重，最新置顶（p 是 {path, time} 对象）
    this.items = this.items.filter(p => p.path !== filePath);
    this.items.unshift({ path: filePath, time: Date.now() });
    if (this.items.length > this.maxSize) {
      this.items = this.items.slice(0, this.maxSize);
    }
  }
  list() {
    return this.items.slice();
  }
  clear() {
    this.items = [];
  }
  toJSON() {
    return { items: this.items, maxSize: this.maxSize };
  }
  static fromJSON(obj) {
    const h = new History(obj.maxSize || 50);
    h.items = Array.isArray(obj.items) ? obj.items.slice() : [];
    return h;
  }
}

/**
 * 配置管理器（带默认值合并）
 */
const DEFAULT_CONFIG = {
  hotkey: 'Alt+Q',
  windowWidth: 960,
  windowHeight: 640,
  theme: 'light',
  historyEnabled: true,
  showMeta: true,
  fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
};

function mergeConfig(userCfg) {
  return Object.assign({}, DEFAULT_CONFIG, userCfg || {});
}

module.exports = {
  TYPE_CATEGORIES,
  CODE_LANGUAGE_MAP,
  MAX_TEXT_SIZE,
  MAX_MEDIA_SIZE,
  categorize,
  isPreviewable,
  getHighlightLanguage,
  formatSize,
  getMeta,
  decidePreview,
  History,
  DEFAULT_CONFIG,
  mergeConfig,
};
