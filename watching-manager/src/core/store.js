// src/core/store.js — 剧集管家核心数据逻辑（纯函数，不依赖 Electron，便于测试）
// 剧集结构：
// {
//   id, title, type, status, season, episode, totalSeasons, totalEpisodes,
//   rating, tags[], poster, note, addedAt, updatedAt, lastWatchedAt, finishedAt
// }

const VALID_STATUSES = ['watching', 'planning', 'completed', 'dropped'];
const VALID_TYPES = ['tv', 'anime', 'variety', 'movie', 'doc'];

// 生成 ID
function genId() {
  return 'sh_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// 校验剧集对象，返回归一化后的对象；非法则抛错
function validateShow(show) {
  if (!show || typeof show !== 'object') throw new Error('剧集数据无效');
  if (!show.title || typeof show.title !== 'string' || !show.title.trim()) {
    throw new Error('剧名不能为空');
  }
  const title = String(show.title).trim();
  const type = VALID_TYPES.includes(show.type) ? show.type : 'tv';
  const status = VALID_STATUSES.includes(show.status) ? show.status : 'planning';
  const season = Math.max(1, parseInt(show.season, 10) || 1);
  const episode = Math.max(0, parseInt(show.episode, 10) || 0);
  const totalSeasons = Math.max(0, parseInt(show.totalSeasons, 10) || 0);
  const totalEpisodes = Math.max(0, parseInt(show.totalEpisodes, 10) || 0);
  const rating = Math.min(10, Math.max(0, parseFloat(show.rating) || 0));
  const tags = Array.isArray(show.tags)
    ? show.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 20)
    : [];
  const poster = typeof show.poster === 'string' ? show.poster : '';
  const note = typeof show.note === 'string' ? show.note.slice(0, 2000) : '';
  return { title, type, status, season, episode, totalSeasons, totalEpisodes, rating, tags, poster, note };
}

// 新建剧集
function createShow(input) {
  const v = validateShow(input);
  const now = new Date().toISOString();
  return {
    id: genId(),
    ...v,
    addedAt: now,
    updatedAt: now,
    lastWatchedAt: null,
    finishedAt: null
  };
}

// 更新剧集（保留 id 与时间戳）
function updateShow(show, patch) {
  if (!show || !show.id) throw new Error('原剧集无效');
  const merged = { ...show, ...patch };
  const v = validateShow(merged);
  const next = { ...show, ...v, updatedAt: new Date().toISOString() };
  // 状态联动
  if (next.status === 'completed' && !next.finishedAt) {
    next.finishedAt = new Date().toISOString();
  }
  if (next.status !== 'completed') {
    next.finishedAt = null;
  }
  // 进度变化：标记最近观看（除非显式传 null）
  if (patch && (patch.episode !== undefined || patch.season !== undefined)) {
    if (patch.lastWatchedAt === null) {
      // 显式重置：保持 null
      next.lastWatchedAt = null;
    } else if (patch.lastWatchedAt !== undefined) {
      // 显式指定
      next.lastWatchedAt = patch.lastWatchedAt;
    } else {
      next.lastWatchedAt = new Date().toISOString();
    }
  }
  return next;
}

// 标记看了下一集
function advanceEpisode(show, step = 1) {
  if (!show) throw new Error('剧集无效');
  let { season, episode } = show;
  season = parseInt(season, 10) || 1;
  episode = parseInt(episode, 10) || 0;
  episode += step;
  // 若有总集数且超出，自动进入下一季
  const totalEps = parseInt(show.totalEpisodes, 10) || 0;
  const totalSeasons = parseInt(show.totalSeasons, 10) || 0;
  if (totalEps > 0 && episode > totalEps) {
    if (totalSeasons === 0 || season < totalSeasons) {
      season += 1;
      episode = 1;
    } else {
      // 已是最终集
      episode = totalEps;
      return updateShow(show, { season, episode, status: 'completed' });
    }
  }
  // 边界：到达最后一季的最终集
  const isFinal = totalEps > 0 && episode >= totalEps && totalSeasons > 0 && season >= totalSeasons;
  let status = show.status === 'planning' ? 'watching' : show.status;
  if (isFinal) status = 'completed';
  return updateShow(show, { season, episode, status });
}

// 重置进度
function resetProgress(show) {
  return updateShow(show, { season: 1, episode: 0, status: 'planning', lastWatchedAt: null, finishedAt: null });
}

// 统计
function stats(shows) {
  const list = Array.isArray(shows) ? shows : [];
  const total = list.length;
  const byStatus = { watching: 0, planning: 0, completed: 0, dropped: 0 };
  const byType = { tv: 0, anime: 0, variety: 0, movie: 0, doc: 0 };
  let totalEpisodesWatched = 0;
  let totalRating = 0;
  let ratedCount = 0;
  const tagCount = {};
  for (const s of list) {
    if (byStatus[s.status] !== undefined) byStatus[s.status]++;
    if (byType[s.type] !== undefined) byType[s.type]++;
    totalEpisodesWatched += parseInt(s.episode, 10) || 0;
    if (s.rating > 0) { totalRating += s.rating; ratedCount++; }
    if (Array.isArray(s.tags)) for (const t of s.tags) tagCount[t] = (tagCount[t] || 0) + 1;
  }
  return {
    total,
    byStatus,
    byType,
    totalEpisodesWatched,
    avgRating: ratedCount > 0 ? Math.round((totalRating / ratedCount) * 10) / 10 : 0,
    ratedCount,
    topTags: Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, c]) => ({ tag: t, count: c }))
  };
}

// 搜索/筛选
function filterShows(shows, opts = {}) {
  let list = Array.isArray(shows) ? shows.slice() : [];
  const { keyword = '', status = '', type = '', tag = '' } = opts;
  if (keyword) {
    const k = keyword.toLowerCase();
    list = list.filter(s =>
      s.title.toLowerCase().includes(k) ||
      (Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(k))) ||
      (s.note || '').toLowerCase().includes(k)
    );
  }
  if (status) list = list.filter(s => s.status === status);
  if (type) list = list.filter(s => s.type === type);
  if (tag) list = list.filter(s => Array.isArray(s.tags) && s.tags.includes(tag));
  return list;
}

// 排序
function sortShows(shows, by = 'updated', asc = false) {
  const list = (Array.isArray(shows) ? shows : []).slice();
  const dir = asc ? 1 : -1;
  list.sort((a, b) => {
    let av, bv;
    switch (by) {
      case 'title': av = a.title; bv = b.title; return av.localeCompare(bv, 'zh') * (asc ? 1 : -1);
      case 'rating': av = a.rating; bv = b.rating; break;
      case 'added': av = a.addedAt; bv = b.addedAt; break;
      case 'lastWatched':
        av = a.lastWatchedAt || ''; bv = b.lastWatchedAt || '';
        break;
      case 'updated':
      default: av = a.updatedAt; bv = b.updatedAt; break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return list;
}

// 导出（仅数据，剥离内部字段不必要）
function exportData(shows) {
  return { version: 1, exportedAt: new Date().toISOString(), shows: Array.isArray(shows) ? shows : [] };
}

// 导入（合并：同 id 覆盖，否则追加）
function importData(currentShows, data) {
  if (!data || !Array.isArray(data.shows)) throw new Error('导入数据格式错误');
  const map = new Map();
  for (const s of currentShows || []) map.set(s.id, s);
  for (const s of data.shows) {
    try {
      const v = validateShow(s);
      const merged = { ...s, ...v };
      if (!merged.id) merged.id = genId();
      if (!merged.addedAt) merged.addedAt = new Date().toISOString();
      map.set(merged.id, merged);
    } catch (e) {
      // 跳过非法项
    }
  }
  return Array.from(map.values());
}

module.exports = {
  VALID_STATUSES, VALID_TYPES,
  genId, validateShow, createShow, updateShow,
  advanceEpisode, resetProgress,
  stats, filterShows, sortShows,
  exportData, importData
};
