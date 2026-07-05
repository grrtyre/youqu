// renderer.js — 字体管家渲染层
// 核心函数（与 src/core/font-utils.js 同步，避免 contextIsolation 下 require 不可用）
function hasCJK(name) { return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(name); }
function isCJKFont(family) { return hasCJK(family); }
// 去除字体名两端引号（用于显示）
function displayName(name) {
  if (!name) return '';
  const s = String(name).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}
function inferCategory(family) {
  const f = (family || '').toLowerCase();
  if (/mono|code|consol|courier|menlo|fira code|jetbrains|source code/.test(f)) return '等宽';
  if (/hand|script|cursive|行|草|handwrit|comic/.test(f)) return '手写';
  if (/serif|宋|明|楷|times|georgia|garamond|cambria/.test(f)) return '衬线';
  if (/sans|黑|微软雅黑|pingfang|helvetica|arial|roboto|open sans|sf pro/.test(f)) return '无衬线';
  if (/display|title|装饰|poster|impact|bebas/.test(f)) return '装饰';
  return '其他';
}
function cssFamily(name) {
  if (/\s/.test(name) && !/^["'].*["']$/.test(name)) return `"${name}"`;
  return name;
}
function sortFontsCJKFirst(fonts) {
  return fonts.slice().sort((a, b) => {
    const aC = isCJKFont(a), bC = isCJKFont(b);
    if (aC && !bC) return -1;
    if (!aC && bC) return 1;
    return a.localeCompare(b, 'zh-Hans');
  });
}
function filterFonts(fonts, { search = '', tags = {}, filterTags = [], filterCategory = '' } = {}) {
  let list = fonts.slice();
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(f => f.toLowerCase().includes(s));
  }
  if (filterCategory) list = list.filter(f => inferCategory(f) === filterCategory);
  if (filterTags && filterTags.length) {
    list = list.filter(f => {
      const ft = tags[f] || [];
      return filterTags.every(t => ft.includes(t));
    });
  }
  return list;
}

const els = {
  search: document.getElementById('search'),
  fontGrid: document.getElementById('fontGrid'),
  emptyState: document.getElementById('emptyState'),
  categoryGroup: document.getElementById('categoryGroup'),
  tagList: document.getElementById('tagList'),
  favList: document.getElementById('favList'),
  previewText: document.getElementById('previewText'),
  fontSize: document.getElementById('fontSize'),
  fontSizeVal: document.getElementById('fontSizeVal'),
  addTagBtn: document.getElementById('addTagBtn'),
  viewList: document.getElementById('viewList'),
  viewGrid: document.getElementById('viewGrid'),
  viewCompare: document.getElementById('viewCompare'),
  compareDrawer: document.getElementById('compareDrawer'),
  compareList: document.getElementById('compareList'),
  closeCompare: document.getElementById('closeCompare'),
  minBtn: document.getElementById('minBtn'),
  closeBtn: document.getElementById('closeBtn'),
};

let allFonts = [];
let tags = {};
let favorites = [];
let settings = { previewText: '', fontSize: 36, sampleEn: '' };
let activeCategory = '';
let activeTagFilter = [];
let viewMode = 'grid'; // grid | list | compare
let selectedForCompare = new Set();
let pendingTagForFamily = null; // 待打标签的字体

// ============ 初始化 ============
async function init() {
  // 加载设置
  settings = await window.fontMgr.getSettings();
  els.previewText.value = settings.previewText;
  els.fontSize.value = settings.fontSize;
  els.fontSizeVal.textContent = settings.fontSize;

  // 加载字体
  const result = await window.fontMgr.listFonts();
  if (result && result.error) {
    els.emptyState.style.display = 'block';
    els.emptyState.querySelector('.empty-text').textContent = '字体加载失败：' + result.error;
    return;
  }
  allFonts = sortFontsCJKFirst(result || []);
  tags = await window.fontMgr.getTags() || {};
  favorites = await window.fontMgr.getFavorites() || [];
  renderTags();
  renderFavorites();
  renderFonts();
}

// ============ 渲染字体网格 ============
function renderFonts() {
  const filtered = filterFonts(allFonts, {
    search: els.search.value.trim(),
    tags,
    filterTags: activeTagFilter,
    filterCategory: activeCategory
  });
  if (!filtered.length) {
    els.fontGrid.innerHTML = '';
    els.emptyState.style.display = 'block';
    return;
  }
  els.emptyState.style.display = 'none';
  els.fontGrid.className = viewMode === 'list' ? 'font-grid list' : 'font-grid';
  const preview = els.previewText.value || settings.previewText || '永和九年岁在癸丑暮春之初';
  const size = parseInt(els.fontSize.value, 10);
  els.fontGrid.innerHTML = filtered.map(f => {
    const family = f;
    const famCss = cssFamily(f);
    const cat = inferCategory(f);
    const isFav = favorites.includes(f);
    const ftags = tags[family] || [];
    const selected = selectedForCompare.has(family) ? 'selected' : '';
    const tagHtml = ftags.map(t => `<span class="fc-tag">${escapeHtml(t)}</span>`).join('');
    const shown = displayName(family);
    return `
      <div class="font-card ${selected}" data-family="${escapeAttr(family)}">
        <div class="fc-fav ${isFav ? 'active' : ''}" data-action="fav" title="收藏">★</div>
        <div class="fc-head">
          <div class="fc-name">${escapeHtml(shown)}</div>
          <span class="fc-cat">${cat}</span>
        </div>
        <div class="fc-preview" style="font-family: ${famCss}; font-size: ${size}px;">${escapeHtml(preview)}</div>
        <div class="fc-tags">${tagHtml}</div>
        <div class="fc-meta">
          <span>${isCJKFont(family) ? '中文' : '拉丁'}</span>
        </div>
        <div class="fc-actions">
          <button class="mini-btn" data-action="tag">标签</button>
          <button class="mini-btn" data-action="compare">${selectedForCompare.has(family) ? '取消对比' : '加入对比'}</button>
          <button class="mini-btn warn" data-action="copy">复制 CSS</button>
        </div>
      </div>
    `;
  }).join('');
}

// ============ 渲染标签 ============
function renderTags() {
  const allTags = new Set();
  Object.values(tags).forEach(arr => arr.forEach(t => allTags.add(t)));
  const tagArr = Array.from(allTags).sort();
  if (!tagArr.length) {
    els.tagList.innerHTML = '<div class="fav-empty">暂无标签，点击 + 新建</div>';
    return;
  }
  els.tagList.innerHTML = tagArr.map(t => {
    const count = Object.entries(tags).filter(([_, arr]) => arr.includes(t)).length;
    const active = activeTagFilter.includes(t) ? 'active' : '';
    return `
      <div class="tag-item ${active}" data-tag="${escapeAttr(t)}">
        <span class="dot"></span>
        <span>${escapeHtml(t)}</span>
        <span class="count">${count}</span>
        <button class="del" data-del="${escapeAttr(t)}" title="删除标签">×</button>
      </div>
    `;
  }).join('');
}

// ============ 渲染收藏 ============
function renderFavorites() {
  if (!favorites.length) {
    els.favList.innerHTML = '<div class="fav-empty">暂无收藏</div>';
    return;
  }
  els.favList.innerHTML = favorites.map(f => `
    <div class="fav-item" data-family="${escapeAttr(f)}">${escapeHtml(displayName(f))}</div>
  `).join('');
}

// ============ 事件 ============
els.search.addEventListener('input', renderFonts);
els.previewText.addEventListener('input', () => {
  settings.previewText = els.previewText.value;
  window.fontMgr.setSettings(settings);
  renderFonts();
});
els.fontSize.addEventListener('input', () => {
  settings.fontSize = parseInt(els.fontSize.value, 10);
  els.fontSizeVal.textContent = settings.fontSize;
  window.fontMgr.setSettings(settings);
  renderFonts();
});

els.categoryGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg');
  if (!btn) return;
  els.categoryGroup.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cat = btn.dataset.cat;
  if (cat === '中') activeCategory = 'CJK'; // 特殊标记
  else activeCategory = cat;
  // 中文字体过滤需要单独处理
  if (cat === '中') {
    // 临时过滤中文字体
    const filtered = filterFonts(allFonts, {
      search: els.search.value.trim(),
      tags, filterTags: activeTagFilter, filterCategory: ''
    }).filter(f => isCJKFont(f));
    renderCustom(filtered);
    return;
  }
  renderFonts();
});

function renderCustom(list) {
  if (!list.length) {
    els.fontGrid.innerHTML = '';
    els.emptyState.style.display = 'block';
    return;
  }
  els.emptyState.style.display = 'none';
  els.fontGrid.className = viewMode === 'list' ? 'font-grid list' : 'font-grid';
  const preview = els.previewText.value || settings.previewText || '永和九年';
  const size = parseInt(els.fontSize.value, 10);
  els.fontGrid.innerHTML = list.map(f => {
    const famCss = cssFamily(f);
    const cat = inferCategory(f);
    const isFav = favorites.includes(f);
    const ftags = tags[f] || [];
    const selected = selectedForCompare.has(f) ? 'selected' : '';
    const tagHtml = ftags.map(t => `<span class="fc-tag">${escapeHtml(t)}</span>`).join('');
    const shown = displayName(f);
    return `
      <div class="font-card ${selected}" data-family="${escapeAttr(f)}">
        <div class="fc-fav ${isFav ? 'active' : ''}" data-action="fav" title="收藏">★</div>
        <div class="fc-head">
          <div class="fc-name">${escapeHtml(shown)}</div>
          <span class="fc-cat">${cat}</span>
        </div>
        <div class="fc-preview" style="font-family: ${famCss}; font-size: ${size}px;">${escapeHtml(preview)}</div>
        <div class="fc-tags">${tagHtml}</div>
        <div class="fc-meta"><span>${isCJKFont(f) ? '中文' : '拉丁'}</span></div>
        <div class="fc-actions">
          <button class="mini-btn" data-action="tag">标签</button>
          <button class="mini-btn" data-action="compare">${selectedForCompare.has(f) ? '取消对比' : '加入对比'}</button>
          <button class="mini-btn warn" data-action="copy">复制 CSS</button>
        </div>
      </div>`;
  }).join('');
}

els.tagList.addEventListener('click', (e) => {
  const del = e.target.closest('.del');
  if (del) {
    e.stopPropagation();
    const t = del.dataset.del;
    if (confirm(`确定删除标签「${t}」？`)) {
      Object.keys(tags).forEach(f => {
        tags[f] = (tags[f] || []).filter(x => x !== t);
        if (tags[f].length === 0) delete tags[f];
      });
      activeTagFilter = activeTagFilter.filter(x => x !== t);
      window.fontMgr.setTags(tags);
      renderTags();
      renderFonts();
    }
    return;
  }
  const item = e.target.closest('.tag-item');
  if (!item) return;
  const t = item.dataset.tag;
  if (activeTagFilter.includes(t)) activeTagFilter = activeTagFilter.filter(x => x !== t);
  else activeTagFilter.push(t);
  renderTags();
  renderFonts();
});

els.addTagBtn.addEventListener('click', () => showTagModal());

els.favList.addEventListener('click', (e) => {
  const item = e.target.closest('.fav-item');
  if (!item) return;
  els.search.value = item.dataset.family;
  renderFonts();
});

// 字体卡片操作（事件委托）
els.fontGrid.addEventListener('click', (e) => {
  const card = e.target.closest('.font-card');
  if (!card) return;
  const family = card.dataset.family;
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === 'fav') toggleFav(family);
    else if (action === 'tag') showTagModal(family);
    else if (action === 'compare') toggleCompare(family);
    else if (action === 'copy') copyCss(family);
    return;
  }
  // 单击卡片：切换选中（用于对比）
  toggleCompare(family);
});

function toggleFav(family) {
  if (favorites.includes(family)) favorites = favorites.filter(f => f !== family);
  else favorites.push(family);
  window.fontMgr.setFavorites(favorites);
  renderFavorites();
  renderFonts();
}

function toggleCompare(family) {
  if (selectedForCompare.has(family)) selectedForCompare.delete(family);
  else selectedForCompare.add(family);
  renderFonts();
}

function copyCss(family) {
  const css = `font-family: ${cssFamily(family)};`;
  navigator.clipboard.writeText(css).then(() => flash('已复制 ' + css));
}

// 视图切换
els.viewList.addEventListener('click', () => setView('list'));
els.viewGrid.addEventListener('click', () => setView('grid'));
els.viewCompare.addEventListener('click', () => {
  els.compareDrawer.style.display = 'flex';
  renderCompare();
});
els.closeCompare.addEventListener('click', () => { els.compareDrawer.style.display = 'none'; });

function setView(mode) {
  viewMode = mode;
  els.viewList.classList.toggle('active', mode === 'list');
  els.viewGrid.classList.toggle('active', mode === 'grid');
  renderFonts();
}

function renderCompare() {
  const list = Array.from(selectedForCompare);
  if (!list.length) {
    els.compareList.innerHTML = '<div class="fav-empty">点击字体卡片加入对比</div>';
    return;
  }
  const preview = els.previewText.value || settings.previewText || '永和九年岁在癸丑暮春之初';
  const size = parseInt(els.fontSize.value, 10);
  els.compareList.innerHTML = list.map(f => `
    <div class="compare-item">
      <div class="compare-name">
        <span>${escapeHtml(displayName(f))}</span>
        <button class="text-btn" data-rm="${escapeAttr(f)}">移除</button>
      </div>
      <div class="compare-text" style="font-family: ${cssFamily(f)}; font-size: ${size}px;">${escapeHtml(preview)}</div>
    </div>
  `).join('');
}

els.compareList.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-rm]');
  if (!rm) return;
  selectedForCompare.delete(rm.dataset.rm);
  renderCompare();
  renderFonts();
});

// 窗口控制
els.minBtn.addEventListener('click', () => {
  // 通过 ipcRenderer 最小化 — 这里用 BrowserWindow.getFocusedWindow
  // 简化：用 preload 暴露的 API（暂不实现，按钮仅占位）
});
els.closeBtn.addEventListener('click', () => window.close());

// ============ 标签弹窗 ============
function showTagModal(family) {
  pendingTagForFamily = family;
  const modalBg = document.createElement('div');
  modalBg.className = 'modal-bg';
  const existing = (family && tags[family]) || [];
  modalBg.innerHTML = `
    <div class="modal">
      <h3>${family ? '为「' + escapeHtml(family) + '」打标签' : '新建标签'}</h3>
      <input id="tagInput" type="text" placeholder="输入标签名，回车确认" value="${family ? '' : ''}" autocomplete="off">
      ${family && existing.length ? `<div style="margin-top:10px;font-size:12px;color:#86868b;">当前标签：${existing.map(t => '#' + escapeHtml(t)).join(' ')}</div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modalCancel">取消</button>
        <button class="btn btn-primary" id="modalOk">确定</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalBg);
  const input = modalBg.querySelector('#tagInput');
  input.focus();
  const close = () => modalBg.remove();
  modalBg.querySelector('#modalCancel').addEventListener('click', close);
  modalBg.querySelector('#modalOk').addEventListener('click', () => submitTag(input.value, family, close));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTag(input.value, family, close);
    if (e.key === 'Escape') close();
  });
}

function submitTag(value, family, done) {
  const t = (value || '').trim();
  if (!t) { done(); return; }
  if (family) {
    if (!tags[family]) tags[family] = [];
    if (!tags[family].includes(t)) tags[family].push(t);
    window.fontMgr.setTags(tags);
    renderTags();
    renderFonts();
  } else {
    // 仅创建空标签（实际上标签是依附字体的，这里只是预输入）
    renderTags();
  }
  done();
}

// ============ 工具 ============
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

let flashTimer = null;
function flash(text) {
  let el = document.getElementById('flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flash';
    el.style.cssText = `
      position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
      z-index: 300; padding: 8px 16px; background: rgba(0,0,0,0.82);
      color: #fff; font-size: 12px; border-radius: 8px; pointer-events: none;
      transition: opacity 0.3s; font-family: -apple-system, "PingFang SC";
    `;
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.style.opacity = '0'; }, 1500);
}

// 启动
init();
