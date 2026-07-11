// 换算管家 - 渲染层逻辑
// 核心换算 API 通过 preload 注入到 window.core / window.store
const { categories, convertAll, parseInput, formatValue, convert } = window.core;
const Store = window.store;

let currentCategoryId = 'length';
let currentFromUnit = 'm';
let currentState = Store.createState();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// 初始化
async function init() {
  // 加载持久化状态
  try {
    const saved = await window.api.getState();
    if (saved) {
      currentState = Store.createState(saved);
      currentCategoryId = currentState.lastCategory || 'length';
      currentFromUnit = currentState.lastFromUnit || 'm';
    }
  } catch (e) {
    console.error('加载状态失败', e);
  }

  renderCategoryList();
  selectCategory(currentCategoryId, false);
  bindEvents();
}

// 渲染侧边栏类别
function renderCategoryList(filter = '') {
  const list = $('#category-list');
  list.innerHTML = '';
  const kw = filter.trim().toLowerCase();
  categories.forEach(cat => {
    const match = !kw ||
      cat.name.toLowerCase().includes(kw) ||
      cat.id.toLowerCase().includes(kw) ||
      cat.units.some(u => u.name.toLowerCase().includes(kw) || u.id.toLowerCase().includes(kw));
    if (!match) return;
    const li = document.createElement('li');
    li.className = 'category-item' + (cat.id === currentCategoryId ? ' active' : '');
    li.dataset.id = cat.id;
    li.innerHTML = `<span class="cat-icon">${cat.icon}</span><span>${cat.name}</span>`;
    li.addEventListener('click', () => selectCategory(cat.id, true));
    list.appendChild(li);
  });
}

// 选择类别
function selectCategory(categoryId, persist) {
  currentCategoryId = categoryId;
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) return;

  // 更新标题
  $('#category-title').textContent = cat.icon + ' ' + cat.name;
  $('#category-desc').textContent = `共 ${cat.units.length} 个单位，输入数值即可实时换算`;

  // 更新侧边栏高亮
  $$('.category-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === categoryId);
  });

  // 当前类别是否有上次选中的单位，否则用第一个
  if (!cat.units.some(u => u.id === currentFromUnit)) {
    currentFromUnit = cat.units[0].id;
  }

  // 填充单位下拉
  const sel = $('#from-unit');
  sel.innerHTML = '';
  cat.units.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.name;
    if (u.id === currentFromUnit) opt.selected = true;
    sel.appendChild(opt);
  });

  updateFavoriteStar();
  recalculate();

  if (persist) {
    window.api.setLast({ categoryId, fromUnitId: currentFromUnit }).then(s => { currentState = s; });
  } else {
    window.api.setLast({ categoryId, fromUnitId: currentFromUnit });
  }
}

// 重新计算结果
function recalculate() {
  const inputEl = $('#value-input');
  const raw = inputEl.value;
  const value = parseInput(raw);

  const list = $('#results-list');
  list.innerHTML = '';

  if (raw.trim() !== '' && value === null) {
    list.innerHTML = '<li class="result-empty"><span class="empty-icon">⚠️</span>请输入有效的数字</li>';
    return;
  }

  if (value === null) {
    list.innerHTML = '<li class="result-empty"><span class="empty-icon">⌨️</span>输入数值后自动换算</li>';
    return;
  }

  const results = convertAll(currentCategoryId, currentFromUnit, value);
  results.forEach(r => {
    const li = document.createElement('li');
    li.className = 'result-item' + (r.unitId === currentFromUnit ? ' is-source' : '');
    li.dataset.unitId = r.unitId;
    li.innerHTML = `
      <span class="result-name">${escapeHtml(r.name)}</span>
      <span class="result-value">
        <span class="value-text">${escapeHtml(r.value)}</span>
        <svg class="copy-mini" viewBox="0 0 16 16" width="14" height="14" title="复制">
          <path fill="currentColor" d="M4 1.5H11a.5.5 0 0 1 .5.5v1H12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h.5V2a.5.5 0 0 1 .5-.5zM4 3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4z"/>
          <path fill="currentColor" d="M6.5 0H3a2 2 0 0 0-2 2v8a2 2 0 0 0 1 1.732V3a1 1 0 0 1 1-1h5.732A2 2 0 0 0 6.5 0z"/>
        </svg>
      </span>
    `;
    li.addEventListener('click', (e) => {
      if (e.target.closest('.copy-mini')) {
        copyText(r.value);
      } else {
        // 点击结果项：切换为该单位作为输入单位
        currentFromUnit = r.unitId;
        $('#from-unit').value = r.unitId;
        // 把该结果值填入输入框（方便继续换算）
        $('#value-input').value = r.value;
        updateFavoriteStar();
        recalculate();
        window.api.setLast({ categoryId: currentCategoryId, fromUnitId: currentFromUnit }).then(s => { currentState = s; });
        addToHistory(value, r.value, r.unitId);
      }
    });
    list.appendChild(li);
  });

  // 写历史（去抖：仅在有效换算时记录）
  if (value !== null && results.length > 0) {
    const target = results.find(r => r.unitId !== currentFromUnit) || results[0];
    addToHistory(value, target.value, target.unitId);
  }
}

let historyTimer = null;
function addToHistory(value, result, toUnitId) {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    window.api.addHistory({
      categoryId: currentCategoryId,
      fromUnitId: currentFromUnit,
      toUnitId: toUnitId,
      value: formatValue(value),
      result: String(result),
      ts: Date.now()
    }).then(s => { currentState = s; });
  }, 800);
}

// 更新收藏星标
function updateFavoriteStar() {
  const fav = { categoryId: currentCategoryId, fromUnitId: currentFromUnit, toUnitId: currentFromUnit };
  const isFav = Store.isFavorite(currentState, fav);
  $('#favorite-toggle').classList.toggle('active', isFav);
}

// 切换当前收藏
function toggleCurrentFavorite() {
  const fav = { categoryId: currentCategoryId, fromUnitId: currentFromUnit, toUnitId: currentFromUnit };
  window.api.toggleFavorite(fav).then(({ state, isFavorite }) => {
    currentState = state;
    updateFavoriteStar();
    showToast(isFavorite ? '已收藏' : '已取消收藏');
  });
}

// 渲染历史
async function renderHistory() {
  const list = $('#history-list');
  const items = currentState.history || [];
  if (items.length === 0) {
    list.innerHTML = '<li class="drawer-empty">暂无历史记录</li>';
    return;
  }
  list.innerHTML = '';
  items.forEach(h => {
    const cat = categories.find(c => c.id === h.categoryId);
    if (!cat) return;
    const fromU = cat.units.find(u => u.id === h.fromUnitId);
    const toU = cat.units.find(u => u.id === h.toUnitId);
    const li = document.createElement('li');
    li.className = 'drawer-item';
    const time = new Date(h.ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `
      <div class="drawer-item-main">${cat.icon} ${escapeHtml(h.value || '')} ${escapeHtml(fromU ? fromU.name : h.fromUnitId)} → ${escapeHtml(h.result || '')} ${escapeHtml(toU ? toU.name : h.toUnitId)}</div>
      <div class="drawer-item-meta">${time}</div>
    `;
    li.addEventListener('click', () => {
      selectCategory(h.categoryId, true);
      $('#from-unit').value = h.fromUnitId;
      currentFromUnit = h.fromUnitId;
      $('#value-input').value = h.value;
      closeDrawers();
      recalculate();
    });
    list.appendChild(li);
  });
}

// 渲染收藏
function renderFavorites() {
  const list = $('#favorite-list');
  const favs = currentState.favorites || [];
  if (favs.length === 0) {
    list.innerHTML = '<li class="drawer-empty">暂无收藏，点击工作区右上角星标添加</li>';
    return;
  }
  list.innerHTML = '';
  favs.forEach(fav => {
    const cat = categories.find(c => c.id === fav.categoryId);
    if (!cat) return;
    const fromU = cat.units.find(u => u.id === fav.fromUnitId);
    const toU = cat.units.find(u => u.id === fav.toUnitId);
    const li = document.createElement('li');
    li.className = 'drawer-item';
    li.innerHTML = `
      <div class="drawer-item-main">${cat.icon} ${escapeHtml(fromU ? fromU.name : fav.fromUnitId)} ↔ ${escapeHtml(toU ? toU.name : fav.toUnitId)}</div>
      <div class="drawer-item-sub">${cat.name}</div>
    `;
    li.addEventListener('click', () => {
      selectCategory(fav.categoryId, true);
      $('#from-unit').value = fav.fromUnitId;
      currentFromUnit = fav.fromUnitId;
      closeDrawers();
      recalculate();
    });
    list.appendChild(li);
  });
}

function openDrawer(id) {
  closeDrawers();
  $('#' + id).classList.remove('hidden');
  if (id === 'history-drawer') renderHistory();
  if (id === 'favorite-drawer') renderFavorites();
}

function closeDrawers() {
  $('#history-drawer').classList.add('hidden');
  $('#favorite-drawer').classList.add('hidden');
}

// 复制到剪贴板
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('已复制 ' + text));
  } else {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('已复制 ' + text); } catch (e) {}
    document.body.removeChild(ta);
  }
}

function copyAllResults() {
  const inputEl = $('#value-input');
  const value = parseInput(inputEl.value);
  if (value === null) {
    showToast('请先输入数值');
    return;
  }
  const results = convertAll(currentCategoryId, currentFromUnit, value);
  const cat = categories.find(c => c.id === currentCategoryId);
  const lines = [`# ${cat.name} 换算结果`, `输入：${value} ${currentFromUnit}`, ''];
  results.forEach(r => {
    lines.push(`${r.name}: ${r.value}`);
  });
  copyText(lines.join('\n'));
}

let toastTimer = null;
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1600);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 事件绑定
function bindEvents() {
  $('#value-input').addEventListener('input', recalculate);

  $('#from-unit').addEventListener('change', (e) => {
    currentFromUnit = e.target.value;
    updateFavoriteStar();
    recalculate();
    window.api.setLast({ categoryId: currentCategoryId, fromUnitId: currentFromUnit }).then(s => { currentState = s; });
  });

  $('#search').addEventListener('input', (e) => {
    renderCategoryList(e.target.value);
  });

  $('#favorite-toggle').addEventListener('click', toggleCurrentFavorite);

  $('#history-btn').addEventListener('click', () => {
    $('#history-btn').classList.toggle('active');
    openDrawer('history-drawer');
  });

  $('#favorite-btn').addEventListener('click', () => {
    $('#favorite-btn').classList.toggle('active');
    openDrawer('favorite-drawer');
  });

  $('#close-history').addEventListener('click', closeDrawers);
  $('#close-favorite').addEventListener('click', closeDrawers);

  $$('.drawer-mask').forEach(m => m.addEventListener('click', closeDrawers));

  $('#clear-history').addEventListener('click', async () => {
    const s = await window.api.clearHistory();
    currentState = s;
    renderHistory();
    showToast('已清空历史');
  });

  $('#copy-all').addEventListener('click', copyAllResults);

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawers();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      $('#search').focus();
    }
  });
}

init();
