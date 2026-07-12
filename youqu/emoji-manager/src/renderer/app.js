// src/renderer/app.js — 表情管家 渲染层逻辑
// 苹果白高端风格，纯原生 JS 实现，无外部依赖

const $ = (id) => document.getElementById(id);

const state = {
  categories: [],       // 所有分类
  allEmojis: [],       // 所有表情（扁平）
  currentCatId: 'smileys', // 当前选中的分类
  currentList: [],     // 当前展示的列表
  searchKw: '',        // 当前搜索关键词
  favorites: [],       // 收藏列表（仅字符数组）
  history: [],         // 历史记录
  selectedChar: null   // 当前选中的 emoji 字符
};

// 判断是否为颜文字 / 特殊符号分类
function isTextLikeCat(catId) {
  return catId === 'kao' || catId === 'special';
}

// ============ 启动 ============
document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindWindowControls();
  bindSearchBox();
  bindHistoryClear();

  try {
    const [cats, all, favs, hist] = await Promise.all([
      window.emojiAPI.getCategories(),
      window.emojiAPI.getAll(),
      window.emojiAPI.getFavorites(),
      window.emojiAPI.getHistory()
    ]);
    state.categories = cats || [];
    state.allEmojis = all || [];
    state.favorites = (favs || []).map(f => f.c);
    state.history = hist || [];

    renderCategories();
    renderHistory();
    // 默认选第一个分类
    if (state.categories.length) {
      selectCategory(state.categories[0].id);
    }
    renderPlaceholderStats();
  } catch (e) {
    showToast('加载失败：' + e.message);
  }
}

function renderPlaceholderStats() {
  const wrap = $('placeholderStats');
  if (!wrap) return;
  const total = state.allEmojis.length;
  const catCount = state.categories.length;
  wrap.innerHTML = `
    <div class="stat-card"><span class="stat-num">${total}</span><span class="stat-label">表情总数</span></div>
    <div class="stat-card"><span class="stat-num">${catCount}</span><span class="stat-label">分类数量</span></div>
  `;
}

// ============ 窗口控制 ============
function bindWindowControls() {
  const btnClose = $('btnClose');
  const btnMin = $('btnMin');
  const btnMax = $('btnMax');
  if (btnClose) btnClose.addEventListener('click', () => window.emojiAPI.winClose());
  if (btnMin) btnMin.addEventListener('click', () => window.emojiAPI.winMin());
  if (btnMax) btnMax.addEventListener('click', () => window.emojiAPI.winMax());
}

// ============ 搜索框 ============
function bindSearchBox() {
  const input = $('searchInput');
  const clear = $('searchClear');
  if (!input) return;
  let timer = null;
  input.addEventListener('input', (e) => {
    const v = e.target.value;
    if (clear) clear.style.display = v ? 'flex' : 'none';
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.searchKw = v.trim();
      refreshList();
    }, 120);
  });
  if (clear) clear.addEventListener('click', () => {
    input.value = '';
    clear.style.display = 'none';
    state.searchKw = '';
    refreshList();
    input.focus();
  });
}

// ============ 历史清空 ============
function bindHistoryClear() {
  const btn = $('historyClear');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await window.emojiAPI.clearHistory();
    state.history = [];
    renderHistory();
    showToast('历史已清空');
  });
}

// ============ 分类列表 ============
function renderCategories() {
  const wrap = $('categoryList');
  if (!wrap) return;
  wrap.innerHTML = '';
  state.categories.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'cat-item';
    div.dataset.catId = cat.id;
    div.innerHTML = `
      <span class="cat-icon">${cat.icon || '·'}</span>
      <span class="cat-name">${escapeHtml(cat.name)}</span>
      <span class="cat-count">${(cat.emojis || []).length}</span>
    `;
    div.addEventListener('click', () => {
      // 搜索时点分类自动清空搜索
      if (state.searchKw) {
        state.searchKw = '';
        const input = $('searchInput'); if (input) input.value = '';
        const clear = $('searchClear'); if (clear) clear.style.display = 'none';
      }
      selectCategory(cat.id);
    });
    wrap.appendChild(div);
  });
}

function selectCategory(catId) {
  state.currentCatId = catId;
  // 高亮
  document.querySelectorAll('.cat-item').forEach(el => {
    el.classList.toggle('active', el.dataset.catId === catId);
  });
  refreshList();
}

// ============ 刷新列表（根据搜索 / 分类） ============
async function refreshList() {
  let list = [];
  if (state.searchKw) {
    list = await window.emojiAPI.search(state.searchKw);
  } else {
    const cat = state.categories.find(c => c.id === state.currentCatId);
    list = cat ? (cat.emojis || []).map(e => ({ ...e, cat: cat.id, catName: cat.name })) : [];
  }
  state.currentList = list;
  renderGrid(list);
  updateResultCount(list.length);
}

function updateResultCount(n) {
  const el = $('resultCount');
  if (!el) return;
  if (state.searchKw) {
    el.innerHTML = `搜索到 <span class="num">${n}</span> 个`;
  } else {
    el.innerHTML = `共 <span class="num">${n}</span> 个`;
  }
}

// ============ Emoji 网格 ============
function renderGrid(list) {
  const grid = $('emojiGrid');
  const empty = $('emptyState');
  if (!grid) return;
  grid.innerHTML = '';
  if (!list.length) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  const frag = document.createDocumentFragment();
  const catId = state.currentCatId;
  const textLike = isTextLikeCat(catId) && !state.searchKw;

  list.forEach(item => {
    const cell = document.createElement('div');
    let cls = 'emoji-cell';
    // 搜索结果混合时也按当前项分类判断
    const itemCat = item.cat || catId;
    if (isTextLikeCat(itemCat)) {
      cls += itemCat === 'kao' ? ' kao-cell' : ' special-cell';
    }
    if (state.selectedChar === item.c) cls += ' selected';
    cell.className = cls;
    cell.textContent = item.c;
    cell.title = item.n || '';
    if (state.favorites.includes(item.c)) {
      const dot = document.createElement('span');
      dot.className = 'fav-dot';
      cell.appendChild(dot);
    }
    cell.addEventListener('click', () => onEmojiClick(item));
    frag.appendChild(cell);
  });
  grid.appendChild(frag);
}

// ============ 点击 Emoji ============
async function onEmojiClick(item) {
  state.selectedChar = item.c;
  // 复制
  const r = await window.emojiAPI.copy(item.c);
  if (r && r.ok) {
    showToast(`已复制 ${item.n || ''}`);
  } else {
    showToast('复制失败');
  }
  // 添加历史
  state.history = await window.emojiAPI.addHistory({
    c: item.c, n: item.n, k: item.k, cat: item.cat
  });
  renderHistory();
  // 刷新网格高亮 + 收藏标记
  refreshGridMark();
  // 详情
  renderDetail(item);
}

function refreshGridMark() {
  // 仅更新选中状态和收藏点（不重渲染）
  document.querySelectorAll('.emoji-cell').forEach(cell => {
    cell.classList.remove('selected');
  });
  // 找到匹配 cell
  document.querySelectorAll('.emoji-cell').forEach(cell => {
    if (cell.firstChild && cell.firstChild.textContent === state.selectedChar) {
      cell.classList.add('selected');
    }
  });
}

// ============ 历史栏 ============
function renderHistory() {
  const wrap = $('historyList');
  const bar = document.querySelector('.history-bar');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!state.history || !state.history.length) {
    if (bar) bar.classList.add('is-empty');
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = '暂无使用记录';
    wrap.appendChild(empty);
    return;
  }
  if (bar) bar.classList.remove('is-empty');
  state.history.slice(0, 30).forEach(h => {
    const item = document.createElement('div');
    let cls = 'history-item';
    if (isTextLikeCat(h.cat)) {
      cls += h.cat === 'kao' ? ' kao-item' : ' special-item';
    }
    item.className = cls;
    item.textContent = h.c;
    item.title = h.n || '';
    item.addEventListener('click', () => onEmojiClick(h));
    wrap.appendChild(item);
  });
}

// ============ 详情面板 ============
async function renderDetail(item) {
  const wrap = $('detailContent');
  if (!wrap) return;
  const cat = state.categories.find(c => c.id === item.cat);
  const catName = cat ? cat.name : (item.catName || '');
  const isText = isTextLikeCat(item.cat);

  // 计算码点
  const codepoints = [];
  for (const ch of item.c) {
    const cp = ch.codePointAt(0);
    codepoints.push('U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
  }
  const cpStr = codepoints.join(' ');

  const isFav = state.favorites.includes(item.c);
  wrap.innerHTML = `
    <div class="detail-emoji ${isText ? (item.cat === 'kao' ? 'kao' : 'special') : ''}">${escapeHtml(item.c)}</div>
    <div class="detail-name">${escapeHtml(item.n || '')}</div>
    <div class="detail-cat">${escapeHtml(catName)}</div>
    <div class="detail-codepoint">
      <span class="cp-label">UNICODE 码点</span>
      ${escapeHtml(cpStr)}
    </div>
    <div class="detail-actions">
      <button class="btn btn-primary" id="btnCopy">📋 再次复制</button>
      <button class="btn ${isFav ? 'btn-fav active' : 'btn-fav'}" id="btnFav">
        ${isFav ? '★ 已收藏' : '☆ 加入收藏'}
      </button>
    </div>
  `;

  const btnCopy = $('btnCopy');
  if (btnCopy) btnCopy.addEventListener('click', async () => {
    const r = await window.emojiAPI.copy(item.c);
    showToast(r && r.ok ? '已复制' : '复制失败');
  });

  const btnFav = $('btnFav');
  if (btnFav) btnFav.addEventListener('click', async () => {
    const r = await window.emojiAPI.toggleFavorite({
      c: item.c, n: item.n, k: item.k, cat: item.cat
    });
    if (r && r.ok) {
      state.favorites = (r.favorites || []).map(f => f.c);
      renderDetail(item);
      refreshGridMark();
      // 重新渲染整个网格以更新 fav-dot
      renderGrid(state.currentList);
      showToast(r.isFav ? '已加入收藏' : '已取消收藏');
    }
  });
}

// ============ Toast ============
let toastTimer = null;
function showToast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
}

// ============ 工具 ============
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
