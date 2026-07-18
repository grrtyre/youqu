// 纯函数工具模块 - 壁纸管理器
// 不依赖 Electron/DOM，可在 Node.js 中直接测试

'use strict';

// 支持的图片扩展名
const IMG_EXTS = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'];

// 默认配置
function defaultConfig() {
  return {
    sources: [],
    favorites: [],
    currentWallpaper: '',
    autoChange: false,
    intervalHours: 6,
    lastChange: 0,
    bingDaily: false,
    bingLastDate: '',
    favorites_only: false
  };
}

// 文件大小格式化
function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return v.toFixed(v < 10 ? 1 : 0) + ' ' + units[i];
}

// 取文件名
function basename(p) {
  if (!p) return '';
  const parts = String(p).replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

// 取扩展名（小写）
function extname(p) {
  if (!p) return '';
  const idx = String(p).lastIndexOf('.');
  if (idx < 0) return '';
  return String(p).slice(idx).toLowerCase();
}

// 判断是否为支持的图片
function isImageFile(name) {
  return IMG_EXTS.includes(extname(name));
}

// 过滤并排序壁纸列表（收藏优先，再按修改时间倒序）
function sortWallpapers(list, favorites) {
  const favSet = new Set(favorites || []);
  return list.slice().sort((a, b) => {
    const af = favSet.has(a.path) ? 0 : 1;
    const bf = favSet.has(b.path) ? 0 : 1;
    if (af !== bf) return af - bf;
    return (b.mtime || 0) - (a.mtime || 0);
  });
}

// 按视图过滤壁纸
function filterByView(list, view, favorites, currentWallpaper) {
  const favSet = new Set(favorites || []);
  if (view === 'favorites') {
    return list.filter(w => favSet.has(w.path));
  }
  if (view === 'current') {
    if (!currentWallpaper) return [];
    const found = list.find(w => w.path === currentWallpaper);
    return found ? [found] : [{ path: currentWallpaper, name: basename(currentWallpaper), size: 0, mtime: 0 }];
  }
  return list;
}

// 按关键词过滤
function filterByQuery(list, query) {
  if (!query) return list;
  const q = String(query).toLowerCase();
  return list.filter(w => String(w.name).toLowerCase().includes(q));
}

// HTML 转义
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// 计算下次切换时间（毫秒）
function nextChangeTime(lastChange, intervalHours) {
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;
  return (lastChange || 0) + intervalMs;
}

// 判断是否到切换时间
function isTimeToChange(lastChange, intervalHours, now) {
  if (!now) now = Date.now();
  return now >= nextChangeTime(lastChange, intervalHours);
}

// CommonJS 导出（用于 Node.js 测试）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IMG_EXTS,
    defaultConfig,
    formatSize,
    basename,
    extname,
    isImageFile,
    sortWallpapers,
    filterByView,
    filterByQuery,
    escapeHtml,
    nextChangeTime,
    isTimeToChange
  };
}
