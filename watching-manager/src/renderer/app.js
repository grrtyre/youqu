// src/renderer/app.js — 剧集管家渲染层逻辑
const STATUS_TEXT = { watching: '观看中', planning: '想看', completed: '已看完', dropped: '弃剧' };
const TYPE_TEXT = { tv: '电视剧', anime: '动漫', variety: '综艺', movie: '电影', doc: '纪录片' };
const TYPE_EMOJI = { tv: '📺', anime: '🎌', variety: '🎭', movie: '🎬', doc: '🎞' };

let currentView = 'library';
let allShows = [];
let editingId = null;
let editingPoster = '';

const $ = (id) => document.getElementById(id);

// ============ 启动 ============
document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  await loadShows();
  await refreshAll();
  // 启动时检查提醒
  const reminders = await window.api.remindersCheck();
  if (reminders && reminders.length > 0) {
    window.api.notify('剧集管家', `你有 ${reminders.length} 部剧该追下一集了`);
  }
}

function bindEvents() {
  // 窗口控制
  $('winMin').onclick = () => window.api.winMin();
  $('winMax').onclick = () => window.api.winMax();
  $('winClose').onclick = () => window.api.winClose();

  // 导航
  document.querySelectorAll('.nav-item').forEach(item => {
    item.onclick = () => switchView(item.dataset.view);
  });

  // 工具条
  $('addBtn').onclick = () => openModal();
  $('searchInput').oninput = debounce(refreshLibrary, 200);
  $('filterStatus').onchange = refreshLibrary;
  $('filterType').onchange = refreshLibrary;
  $('sortBy').onchange = refreshLibrary;

  // 设置页
  $('exportBtn').onclick = onExport;
  $('importBtn').onclick = onImport;
  $('clearBtn').onclick = onClear;
  $('afdianBtn').onclick = () => window.api.openExternal('https://www.ifdian.net/a/giquwei');

  // 弹窗
  $('modalClose').onclick = closeModal;
  $('modalCancel').onclick = closeModal;
  $('modalMask').onclick = (e) => { if (e.target === $('modalMask')) closeModal(); };
  $('modalSave').onclick = onSave;
  $('pickPosterBtn').onclick = onPickPoster;
  $('clearPosterBtn').onclick = () => { editingPoster = ''; renderPosterPreview(); };
  $('posterPreview').onclick = onPickPoster;
}

// ============ 视图切换 ============
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + view).classList.add('active');
  if (view === 'stats') refreshStats();
  if (view === 'reminders') refreshReminders();
}

// ============ 数据加载 ============
async function loadShows() {
  const isDemo = await window.api.isDemo();
  if (isDemo) {
    // demo 模式：仅用展示数据，不写入 store
    allShows = await window.api.demoShows();
    return;
  }
  allShows = await window.api.showsGet();
}

async function refreshAll() {
  refreshLibrary();
  refreshStats();
  refreshReminders();
}

// ============ 剧集库 ============
function getFilteredShows() {
  const opts = {
    keyword: $('searchInput').value.trim(),
    status: $('filterStatus').value,
    type: $('filterType').value,
    sortBy: $('sortBy').value,
    asc: $('sortBy').value === 'title'
  };
  let list = allShows.slice();
  if (opts.keyword) {
    const k = opts.keyword.toLowerCase();
    list = list.filter(s =>
      s.title.toLowerCase().includes(k) ||
      (Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(k))) ||
      (s.note || '').toLowerCase().includes(k)
    );
  }
  if (opts.status) list = list.filter(s => s.status === opts.status);
  if (opts.type) list = list.filter(s => s.type === opts.type);
  const by = opts.sortBy || 'updated';
  list.sort((a, b) => {
    let av, bv;
    if (by === 'title') return a.title.localeCompare(b.title, 'zh') * (opts.asc ? 1 : -1);
    if (by === 'rating') { av = a.rating; bv = b.rating; }
    else if (by === 'added') { av = a.addedAt; bv = b.addedAt; }
    else if (by === 'lastWatched') { av = a.lastWatchedAt || ''; bv = b.lastWatchedAt || ''; }
    else { av = a.updatedAt; bv = b.updatedAt; }
    return av < bv ? 1 : av > bv ? -1 : 0;
  });
  return list;
}

function refreshLibrary() {
  const list = getFilteredShows();
  const grid = $('showGrid');
  const empty = $('emptyState');
  grid.innerHTML = '';
  if (list.length === 0) {
    empty.classList.add('active');
    return;
  }
  empty.classList.remove('active');
  for (const s of list) {
    grid.appendChild(renderCard(s));
  }
}

function renderCard(s) {
  const card = document.createElement('div');
  card.className = 'show-card';
  card.onclick = () => openModal(s);
  const epText = `S${s.season}·E${s.episode}`;
  const ratingText = s.rating > 0 ? `★ ${s.rating.toFixed(1)}` : '—';
  const typeClass = `type-${s.type}`;
  let posterHTML;
  if (s.poster) {
    posterHTML = `
      <img src="${escapeAttr(s.poster)}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
      <div class="poster-ph ${typeClass}" style="display:none;">
        <div class="ph-emoji">${TYPE_EMOJI[s.type] || '🎬'}</div>
        <div class="ph-title">${escapeHtml(s.title)}</div>
      </div>`;
  } else {
    posterHTML = `
      <div class="poster-ph ${typeClass}">
        <div class="ph-emoji">${TYPE_EMOJI[s.type] || '🎬'}</div>
        <div class="ph-title">${escapeHtml(s.title)}</div>
      </div>`;
  }
  card.innerHTML = `
    <div class="poster">
      ${posterHTML}
      <div class="status-badge status-${s.status}">${STATUS_TEXT[s.status]}</div>
      <div class="ep-badge">${escapeHtml(epText)}</div>
    </div>
    <div class="card-body">
      <div class="card-title">${escapeHtml(s.title)}</div>
      <div class="card-meta">
        <span class="card-type">${TYPE_TEXT[s.type] || '电视剧'}</span>
        <span class="card-rating">${ratingText}</span>
      </div>
      <div class="card-actions">
        <button class="act-btn primary" data-act="next" title="标记看了下一集">＋ 下一集</button>
        <button class="act-btn del" data-act="del" title="删除该剧" aria-label="删除">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M6 1 h4 v1 h3 v2 h-10 v-2 h3 z M4 5 h8 l-1 10 h-6 z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  // 拦截按钮点击
  card.querySelector('[data-act="next"]').onclick = async (e) => {
    e.stopPropagation();
    const r = await window.api.showsAdvance(s.id, 1);
    if (r.ok) {
      const idx = allShows.findIndex(x => x.id === s.id);
      if (idx >= 0) allShows[idx] = r.show;
      refreshAll();
      toast(`「${s.title}」进度 +1`);
    } else {
      toast(r.error || '操作失败');
    }
  };
  card.querySelector('[data-act="del"]').onclick = async (e) => {
    e.stopPropagation();
    if (!confirm(`确定删除「${s.title}」吗？此操作不可恢复。`)) return;
    const r = await window.api.showsRemove(s.id);
    if (r.ok) {
      allShows = allShows.filter(x => x.id !== s.id);
      refreshAll();
      toast('已删除');
    }
  };
  return card;
}

// ============ 统计 ============
async function refreshStats() {
  const s = await window.api.showsStats();
  const cards = [
    { num: s.total, label: '剧集总数' },
    { num: s.byStatus.watching, label: '观看中' },
    { num: s.byStatus.planning, label: '想看' },
    { num: s.byStatus.completed, label: '已看完' },
    { num: s.totalEpisodesWatched, label: '已看集数' },
    { num: s.avgRating.toFixed(1), label: `平均评分（${s.ratedCount} 部）` }
  ];
  $('statsGrid').innerHTML = cards.map(c =>
    `<div class="stat-card"><div class="stat-num">${c.num}</div><div class="stat-label">${c.label}</div></div>`
  ).join('');

  // 类型分布
  const types = Object.entries(s.byType).filter(([, v]) => v > 0);
  const maxT = Math.max(1, ...types.map(([, v]) => v));
  $('typeBars').innerHTML = types.map(([t, v]) =>
    `<div class="bar-row">
      <div class="bar-label">${TYPE_TEXT[t] || t}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(v / maxT * 100).toFixed(0)}%;"></div></div>
      <div class="bar-val">${v}</div>
    </div>`
  ).join('') || '<div class="empty-desc">暂无数据</div>';

  // 标签云
  const tags = s.topTags || [];
  $('tagCloud').innerHTML = tags.length > 0
    ? tags.map(t => `<div class="tag">${escapeHtml(t.tag)} · ${t.count}</div>`).join('')
    : '<div class="empty-desc">暂无标签</div>';
}

// ============ 提醒 ============
async function refreshReminders() {
  const list = await window.api.remindersCheck();
  const box = $('reminderList');
  if (!list || list.length === 0) {
    box.innerHTML = '<div class="empty-desc">暂无待追的剧集，去追新的吧 🍿</div>';
    return;
  }
  box.innerHTML = list.map(r => {
    const days = r.lastWatchedAt
      ? Math.floor((Date.now() - new Date(r.lastWatchedAt).getTime()) / 86400000)
      : '—';
    return `<div class="reminder-item">
      <div class="rem-ico">⏰</div>
      <div class="rem-title">${escapeHtml(r.title)} <span style="color:var(--text-2);font-weight:400;">· S${r.season} E${r.episode}</span></div>
      <div class="rem-sub">${typeof days === 'number' ? `已 ${days} 天未看` : '从未观看'}</div>
    </div>`;
  }).join('');
}

// ============ 弹窗（添加/编辑） ============
function openModal(show) {
  editingId = show ? show.id : null;
  editingPoster = show ? (show.poster || '') : '';
  $('modalTitle').textContent = show ? '编辑剧集' : '添加剧集';
  $('fTitle').value = show ? show.title : '';
  $('fType').value = show ? show.type : 'tv';
  $('fStatus').value = show ? show.status : 'planning';
  $('fSeason').value = show ? show.season : 1;
  $('fEpisode').value = show ? show.episode : 0;
  $('fTotalSeasons').value = show ? show.totalSeasons : 0;
  $('fTotalEpisodes').value = show ? show.totalEpisodes : 0;
  $('fRating').value = show ? show.rating : 0;
  $('fTags').value = show && show.tags ? show.tags.join(', ') : '';
  $('fNote').value = show ? (show.note || '') : '';
  renderPosterPreview();
  $('modalMask').classList.add('active');
  setTimeout(() => $('fTitle').focus(), 50);
}

function closeModal() {
  $('modalMask').classList.remove('active');
  editingId = null;
  editingPoster = '';
}

function renderPosterPreview() {
  const box = $('posterPreview');
  if (editingPoster) {
    box.innerHTML = `<img src="${escapeAttr(editingPoster)}" alt="" onerror="this.parentElement.innerHTML='<span class=&quot;poster-placeholder&quot;>加载失败</span>';" />`;
  } else {
    box.innerHTML = `<span class="poster-placeholder">点击选择海报</span>`;
  }
}

async function onPickPoster() {
  const r = await window.api.pickPoster();
  if (r.ok) {
    editingPoster = r.dataURL;
    renderPosterPreview();
  } else if (r.error) {
    toast(r.error);
  }
}

async function onSave() {
  const input = {
    title: $('fTitle').value.trim(),
    type: $('fType').value,
    status: $('fStatus').value,
    season: parseInt($('fSeason').value, 10) || 1,
    episode: parseInt($('fEpisode').value, 10) || 0,
    totalSeasons: parseInt($('fTotalSeasons').value, 10) || 0,
    totalEpisodes: parseInt($('fTotalEpisodes').value, 10) || 0,
    rating: parseFloat($('fRating').value) || 0,
    tags: $('fTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean),
    note: $('fNote').value.trim(),
    poster: editingPoster
  };
  if (!input.title) { toast('请填写剧名'); return; }
  let r;
  if (editingId) {
    r = await window.api.showsUpdate(editingId, input);
  } else {
    r = await window.api.showsAdd(input);
  }
  if (r.ok) {
    if (editingId) {
      const idx = allShows.findIndex(s => s.id === editingId);
      if (idx >= 0) allShows[idx] = r.show;
    } else {
      allShows.push(r.show);
    }
    closeModal();
    refreshAll();
    toast(editingId ? '已更新' : '已添加');
  } else {
    toast(r.error || '保存失败');
  }
}

// ============ 设置 ============
async function onExport() {
  const r = await window.api.showsExport();
  if (r.ok) toast(`已导出到 ${r.path}`);
  else if (r.error) toast(r.error);
}

async function onImport() {
  const r = await window.api.showsImport();
  if (r.ok) {
    await loadShows();
    refreshAll();
    toast(`导入成功，共 ${r.count} 部剧集`);
  } else if (r.error) {
    toast(r.error);
  }
}

async function onClear() {
  if (!confirm('确定清空全部剧集数据吗？此操作不可恢复。')) return;
  const r = await window.api.showsClear();
  if (r.ok) {
    allShows = [];
    refreshAll();
    toast('已清空');
  }
}

// ============ 工具 ============
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); };
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
