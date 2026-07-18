// 纯函数逻辑模块 - 可独立测试，不依赖 Electron
// 包含：URL 校验/规范化、文章过滤/排序/统计、标签解析等核心逻辑

'use strict';

// 文章状态枚举
const STATUS = Object.freeze({
  UNREAD: 'unread',       // 未读
  READING: 'reading',      // 阅读中
  READ: 'read',            // 已读
  ARCHIVED: 'archived'     // 已归档
});

// 状态中文标签
const STATUS_LABELS = Object.freeze({
  [STATUS.UNREAD]: '未读',
  [STATUS.READING]: '阅读中',
  [STATUS.READ]: '已读',
  [STATUS.ARCHIVED]: '已归档'
});

// 生成唯一 ID（时间戳 + 随机后缀）
function generateId() {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 校验 URL 合法性
function isValidUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const u = new URL(url.trim());
    // 仅允许 http/https
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// 规范化 URL：去除首尾空白、移除常见跟踪参数
function normalizeUrl(url) {
  if (!isValidUrl(url)) return null;
  try {
    const u = new URL(url.trim());
    // 移除 utm_* 等跟踪参数
    const trackingPrefixes = ['utm_', 'fbclid', 'gclid', 'ref', 'ref_src'];
    const params = new URLSearchParams(u.search);
    for (const key of [...params.keys()]) {
      if (trackingPrefixes.some(p => key.startsWith(p))) {
        params.delete(key);
      }
    }
    u.search = params.toString();
    // 去除 hash 中的跟踪参数（简单处理）
    return u.toString();
  } catch {
    return null;
  }
}

// 从 URL 提取域名（用于显示来源）
function getDomain(url) {
  if (!isValidUrl(url)) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// 解析标签字符串（逗号或空格分隔）
function parseTags(tagsInput) {
  if (!tagsInput) return [];
  if (Array.isArray(tagsInput)) {
    return tagsInput.map(t => String(t).trim()).filter(Boolean);
  }
  return String(tagsInput)
    .split(/[,，\s]+/)
    .map(t => t.trim())
    .filter(Boolean)
    // 去重
    .filter((t, i, arr) => arr.findIndex(x => x.toLowerCase() === t.toLowerCase()) === i);
}

// 创建新文章对象（不包含 ID，由调用方决定）
function createArticle({ url, title, notes = '', tags = [], status = STATUS.UNREAD } = {}) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    throw new Error('URL 不合法');
  }
  return {
    url: normalized,
    title: (title || '').trim() || normalized,
    notes: (notes || '').trim(),
    tags: parseTags(tags),
    status: Object.values(STATUS).includes(status) ? status : STATUS.UNREAD,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    readAt: null
  };
}

// 按状态过滤
function filterByStatus(articles, status) {
  if (!status || status === 'all') return articles;
  return articles.filter(a => a.status === status);
}

// 按标签过滤
function filterByTag(articles, tag) {
  if (!tag || tag === 'all') return articles;
  return articles.filter(a => a.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
}

// 按搜索关键词过滤（标题、URL、笔记、标签）
function searchArticles(articles, query) {
  if (!query || !query.trim()) return articles;
  const q = query.trim().toLowerCase();
  return articles.filter(a =>
    (a.title || '').toLowerCase().includes(q) ||
    (a.url || '').toLowerCase().includes(q) ||
    (a.notes || '').toLowerCase().includes(q) ||
    a.tags.some(t => t.toLowerCase().includes(q))
  );
}

// 排序
function sortArticles(articles, sortBy = 'createdAt', order = 'desc') {
  const sorted = [...articles];
  const dir = order === 'asc' ? 1 : -1;
  switch (sortBy) {
    case 'title':
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh') * dir);
      break;
    case 'updatedAt':
      sorted.sort((a, b) => (a.updatedAt - b.updatedAt) * dir);
      break;
    case 'createdAt':
    default:
      sorted.sort((a, b) => (a.createdAt - b.createdAt) * dir);
      break;
  }
  return sorted;
}

// 统计
function getStats(articles) {
  const stats = {
    total: articles.length,
    unread: 0,
    reading: 0,
    read: 0,
    archived: 0,
    tagCounts: {}
  };
  for (const a of articles) {
    if (stats[a.status] !== undefined) stats[a.status]++;
    for (const t of a.tags) {
      const key = t.toLowerCase();
      stats.tagCounts[key] = (stats.tagCounts[key] || 0) + 1;
    }
  }
  return stats;
}

// 获取所有标签（按使用频率降序）
// 单篇文章内重复出现的同名标签仅计 1 次
function getAllTags(articles) {
  const counts = {};
  for (const a of articles) {
    const seenInArticle = new Set();
    for (const t of a.tags) {
      const key = t.toLowerCase();
      if (seenInArticle.has(key)) continue;
      seenInArticle.add(key);
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// 转换状态（带合法校验）
function transitionStatus(current, next) {
  if (!Object.values(STATUS).includes(next)) return current;
  return next;
}

// 序列化/反序列化（用于存储）
function serializeArticles(articles) {
  return JSON.stringify({ version: 1, articles }, null, 2);
}

function deserializeArticles(json) {
  if (!json) return [];
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (!Array.isArray(data?.articles)) return [];
    return data.articles.filter(a => a && isValidUrl(a.url));
  } catch {
    return [];
  }
}

module.exports = {
  STATUS,
  STATUS_LABELS,
  generateId,
  isValidUrl,
  normalizeUrl,
  getDomain,
  parseTags,
  createArticle,
  filterByStatus,
  filterByTag,
  searchArticles,
  sortArticles,
  getStats,
  getAllTags,
  transitionStatus,
  serializeArticles,
  deserializeArticles
};
