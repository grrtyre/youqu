// 代码片段管家 · 渲染层逻辑
const API = window.snippetAPI;
const HL = window.SnippetHighlight;

const state = {
  snippets: [],
  current: null,        // 当前选中的片段对象
  filter: { type: 'all', value: null }, // { type: 'all'|'favorites'|'pinned'|'lang'|'tag', value }
  search: '',
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const elList = $('#snippetList');
const elNav = $('#nav');
const elSearch = $('#searchInput');
const elDetail = $('#detailPane');
const elToast = $('#toast');
const elListTitle = $('#listTitle');
const elListCount = $('#listCount');

// ===== 工具函数 =====
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function langLabel(id) {
  const f = HL.SUPPORTED.find((s) => s.id === id);
  return f ? f.label : id;
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== SVG 图标（线条风格，stroke-width 1.6） =====
const ICON = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 14.7 9.3 21.5 9.9 16.3 14.3 17.9 21 12 17.3 6.1 21 7.7 14.3 2.5 9.9 9.3 9.3 12 3"/></svg>',
  starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 14.7 9.3 21.5 9.9 16.3 14.3 17.9 21 12 17.3 6.1 21 7.7 14.3 2.5 9.9 9.3 9.3 12 3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M9 17h6l-1.5-4.5V5h-3v7.5L9 17z"/><path d="M7.5 5h9"/></svg>',
  pinOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M9 17h6l-1.5-4.5V5h-3v7.5L9 17z"/><path d="M7.5 5h9"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 20 7"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><line x1="10" y1="11" x2="10" y2="16"/><line x1="14" y1="11" x2="14" y2="16"/></svg>',
  dot: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>',
  hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="4" x2="8" y2="20"/><line x1="16" y1="4" x2="14" y2="20"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 6 3 12 8 18"/><polyline points="16 6 21 12 16 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v10"/><circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none"/></svg>',
};

// ===== 确认对话框（苹果白风格，替代原生 confirm） =====
function confirmDialog({ title, message, confirmText = '确认', cancelText = '取消', danger = true }) {
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-body">
          <div class="confirm-icon-wrap">
            <div class="confirm-icon">${ICON.alert}</div>
            <div class="confirm-title">${escapeHtml(title)}</div>
          </div>
          <div class="confirm-msg">${escapeHtml(message)}</div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" data-cancel>${escapeHtml(cancelText)}</button>
          <button class="danger-btn" data-ok>${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    const close = (val) => { mask.remove(); resolve(val); };
    mask.querySelector('[data-cancel]').addEventListener('click', () => close(false));
    mask.querySelector('[data-ok]').addEventListener('click', () => close(true));
    mask.addEventListener('click', (e) => { if (e.target === mask) close(false); });
    // ESC 取消
    const onKey = (e) => { if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
  });
}

let toastTimer;
function toast(msg) {
  elToast.textContent = msg;
  elToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 1800);
}

// ===== 加载数据 =====
async function refresh() {
  const [snippets, langs, tags] = await Promise.all([
    API.list(),
    API.languages(),
    API.tags(),
  ]);
  state.snippets = snippets;
  renderNav(langs, tags);
  renderList();
  $('#cntAll').textContent = snippets.length;
  $('#cntFav').textContent = snippets.filter((s) => s.favorite).length;
  $('#cntPin').textContent = snippets.filter((s) => s.pinned).length;
  $('#footCount').textContent = snippets.length + ' 个片段';
}

// ===== 左侧导航 =====
function renderNav(langs, tags) {
  const navLangs = $('#navLangs');
  navLangs.innerHTML = langs.slice(0, 10).map(({ language, count }) => {
    const active = state.filter.type === 'lang' && state.filter.value === language ? 'active' : '';
    return `<div class="nav-item ${active}" data-filter="lang" data-value="${escapeHtml(language)}">
      <span class="icon">${ICON.dot}</span><span class="label">${escapeHtml(langLabel(language))}</span><span class="count">${count}</span>
    </div>`;
  }).join('') || '<div style="padding:4px 10px;font-size:12px;color:var(--text-3)">暂无</div>';

  const navTags = $('#navTags');
  navTags.innerHTML = tags.slice(0, 10).map(({ tag, count }) => {
    const active = state.filter.type === 'tag' && state.filter.value === tag ? 'active' : '';
    return `<div class="nav-item ${active}" data-filter="tag" data-value="${escapeHtml(tag)}">
      <span class="icon">${ICON.hash}</span><span class="label">${escapeHtml(tag)}</span><span class="count">${count}</span>
    </div>`;
  }).join('') || '<div style="padding:4px 10px;font-size:12px;color:var(--text-3)">暂无</div>';
}

// ===== 中间列表 =====
function getFiltered() {
  let arr = state.snippets.slice();
  const f = state.filter;
  if (f.type === 'favorites') arr = arr.filter((s) => s.favorite);
  else if (f.type === 'pinned') arr = arr.filter((s) => s.pinned);
  else if (f.type === 'lang') arr = arr.filter((s) => s.language === f.value);
  else if (f.type === 'tag') arr = arr.filter((s) => s.tags.includes(f.value));

  const q = state.search.trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/);
    arr = arr.filter((s) => {
      const hay = (s.title + ' ' + s.content + ' ' + s.description + ' ' + s.tags.join(' ') + ' ' + s.language).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  return arr;
}

function renderList() {
  const arr = getFiltered();
  const f = state.filter;
  let title = '全部片段';
  if (f.type === 'favorites') title = '收藏';
  else if (f.type === 'pinned') title = '置顶';
  else if (f.type === 'lang') title = langLabel(f.value);
  else if (f.type === 'tag') title = '#' + f.value;
  if (state.search) title = '搜索：' + state.search;
  elListTitle.textContent = title;
  elListCount.textContent = arr.length;

  if (arr.length === 0) {
    elList.innerHTML = `<div class="empty-state"><div class="emoji">${ICON.code}</div><div class="text">没有匹配的片段</div></div>`;
    return;
  }

  elList.innerHTML = arr.map((s) => {
    const active = state.current && s.id === state.current.id ? 'active' : '';
    return `<div class="snippet-card ${active}" data-id="${s.id}">
      <div class="card-row">
        <span class="card-lang">${escapeHtml(langLabel(s.language))}</span>
        ${s.favorite ? `<span class="card-fav">${ICON.star}</span>` : ''}
        ${s.pinned ? `<span class="card-pin">${ICON.pin}</span>` : ''}
        <span class="card-meta">${fmtDate(s.updatedAt || s.createdAt)}</span>
      </div>
      <div class="card-title">${escapeHtml(s.title)}</div>
      ${s.description ? `<div class="card-desc">${escapeHtml(s.description)}</div>` : ''}
      ${s.tags && s.tags.length ? `<div class="card-tags">${s.tags.map((t) => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
}

// ===== 右侧详情/编辑 =====
async function selectSnippet(id) {
  const s = await API.get(id);
  if (!s) return;
  state.current = s;
  renderList();
  renderDetail();
}

function renderDetail() {
  const s = state.current;
  if (!s) {
    elDetail.innerHTML = `<div class="detail-empty" id="detailEmpty">
      <div class="big">${ICON.code}</div>
      <div class="tip">选择一个片段查看，或点击「新建」创建</div>
      <div class="tip" style="font-size:11px;color:var(--text-3)">Ctrl+Shift+S 全局唤起 · Ctrl+N 新建 · Ctrl+F 搜索</div>
    </div>`;
    return;
  }

  const langOptions = HL.SUPPORTED.map((l) =>
    `<option value="${l.id}" ${l.id === s.language ? 'selected' : ''}>${l.label}</option>`
  ).join('');

  elDetail.innerHTML = `
    <div class="detail-head">
      <input class="detail-title" id="editTitle" value="${escapeHtml(s.title)}" placeholder="片段标题" />
      <button class="tool-btn ${s.favorite ? 'active' : ''}" id="btnFav" title="收藏">${s.favorite ? ICON.star : ICON.starOutline}</button>
      <button class="tool-btn ${s.pinned ? 'active' : ''}" id="btnPin" title="置顶">${s.pinned ? ICON.pin : ICON.pinOutline}</button>
      <button class="tool-btn" id="btnCopy" title="复制代码">${ICON.copy}</button>
      <button class="tool-btn danger" id="btnDel" title="删除">${ICON.trash}</button>
    </div>
    <div class="detail-meta">
      <div class="field">
        <span class="field-label">语言</span>
        <select class="lang-select" id="editLang">${langOptions}</select>
      </div>
      <div class="field">
        <span class="field-label">标签</span>
        <div class="tag-input-wrap" id="tagWrap">
          ${s.tags.map((t) => `<span class="tag-chip">#${escapeHtml(t)}<span class="x" data-tag="${escapeHtml(t)}">×</span></span>`).join('')}
          <input class="tag-input" id="tagInput" placeholder="添加标签..." />
        </div>
      </div>
    </div>
    <div class="detail-desc">
      <textarea class="desc-input" id="editDesc" rows="2" placeholder="添加描述...">${escapeHtml(s.description)}</textarea>
    </div>
    <div class="code-area">
      <div class="code-toolbar">
        <span class="lang-badge">${escapeHtml(s.language)}</span>
        <button class="copy-btn" id="btnCopy2">${ICON.copy} 复制代码</button>
      </div>
      <div class="code-scroll">
        <pre class="code-view" id="codeView"></pre>
        <textarea class="code-edit" id="codeEdit" spellcheck="false" placeholder="在这里输入代码..."></textarea>
      </div>
      <div class="code-status" id="codeStatus">就绪</div>
    </div>
  `;

  const codeEdit = $('#codeEdit');
  const codeView = $('#codeView');
  codeEdit.value = s.content || '';
  updateHighlight();

  // 事件绑定
  $('#editTitle').addEventListener('input', debounceSave);
  $('#editLang').addEventListener('change', async (e) => {
    await API.update(s.id, { language: e.target.value });
    state.current = await API.get(s.id);
    updateHighlight();
    $('.lang-badge').textContent = e.target.value;
    refresh();
  });
  $('#editDesc').addEventListener('input', debounceSave);

  codeEdit.addEventListener('input', () => {
    updateHighlight();
    debounceSave();
  });
  codeEdit.addEventListener('scroll', () => {
    codeView.scrollTop = codeEdit.scrollTop;
    codeView.scrollLeft = codeEdit.scrollLeft;
  });

  // 标签
  $('#tagInput').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = e.target.value.trim();
      if (v && !s.tags.includes(v)) {
        s.tags.push(v);
        await API.update(s.id, { tags: s.tags });
        state.current = s;
        renderDetail();
        refresh();
      }
      e.target.value = '';
    }
  });
  $$('#tagWrap .x').forEach((x) => {
    x.addEventListener('click', async () => {
      const tag = x.dataset.tag;
      s.tags = s.tags.filter((t) => t !== tag);
      await API.update(s.id, { tags: s.tags });
      state.current = s;
      renderDetail();
      refresh();
    });
  });

  $('#btnFav').addEventListener('click', async () => {
    state.current = await API.toggleFav(s.id);
    renderDetail();
    refresh();
  });
  $('#btnPin').addEventListener('click', async () => {
    state.current = await API.togglePin(s.id);
    renderDetail();
    refresh();
  });
  $('#btnDel').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '删除片段',
      message: '确定删除这个片段吗？此操作不可撤销。',
      confirmText: '删除',
    });
    if (ok) {
      await API.remove(s.id);
      state.current = null;
      renderDetail();
      refresh();
      toast('已删除');
    }
  });
  const doCopy = async () => {
    await API.copy(s.content || '');
    const btn = $('#btnCopy2');
    btn.classList.add('done');
    btn.innerHTML = ICON.check + ' 已复制';
    toast('代码已复制到剪贴板');
    setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = ICON.copy + ' 复制代码'; }, 1500);
  };
  $('#btnCopy').addEventListener('click', doCopy);
  $('#btnCopy2').addEventListener('click', doCopy);
}

function updateHighlight() {
  const s = state.current;
  if (!s) return;
  const codeEdit = $('#codeEdit');
  const codeView = $('#codeView');
  const code = codeEdit.value;
  // 末尾补一个换行，保证换行符显示
  const html = HL.highlight(code + (code.endsWith('\n') ? ' ' : ''), s.language);
  codeView.innerHTML = html;
  // 更新状态栏
  const status = $('#codeStatus');
  if (status) {
    const lines = code ? code.split('\n').length : 0;
    const chars = code.length;
    status.textContent = lines + ' 行 · ' + chars + ' 字符 · ' + langLabel(s.language);
  }
}

let saveTimer;
function debounceSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const s = state.current;
    if (!s) return;
    const patch = {
      title: $('#editTitle').value,
      description: $('#editDesc').value,
      content: $('#codeEdit').value,
    };
    state.current = await API.update(s.id, patch);
    // 仅刷新列表（不重渲染详情，避免输入失焦）
    state.snippets = await API.list();
    renderList();
  }, 400);
}

// ===== 新建片段 =====
async function newSnippet() {
  const s = await API.create({ title: '未命名片段', language: 'javascript', content: '' });
  state.filter = { type: 'all', value: null };
  state.search = '';
  elSearch.value = '';
  $$('.nav-item').forEach((n) => n.classList.remove('active'));
  $('.nav-item[data-filter="all"]').classList.add('active');
  state.snippets = await API.list();
  await refresh();
  await selectSnippet(s.id);
  setTimeout(() => { $('#editTitle').focus(); $('#editTitle').select(); }, 50);
}

// ===== 事件绑定 =====
elSearch.addEventListener('input', (e) => {
  state.search = e.target.value;
  renderList();
});

elNav.addEventListener('click', (e) => {
  const item = e.target.closest('.nav-item');
  if (!item) return;
  $$('.nav-item').forEach((n) => n.classList.remove('active'));
  item.classList.add('active');
  state.filter = { type: item.dataset.filter, value: item.dataset.value || null };
  renderList();
});

$('#btnNew').addEventListener('click', newSnippet);

$('#btnExport').addEventListener('click', async () => {
  const p = await API.saveExport();
  if (p) toast('已导出到：' + p);
});

$('#btnImport').addEventListener('click', async () => {
  const r = await API.pickImport();
  if (r) { toast('已导入，共 ' + r.count + ' 个片段'); await refresh(); }
});

// 全局快捷键（应用内）
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    newSnippet();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    elSearch.focus();
    elSearch.select();
  }
});

// 托盘菜单「新建」
if (API.onMenuNew) API.onMenuNew(() => newSnippet());

// ===== 启动 =====
(async () => {
  await refresh();
  // 默认选中第一个片段，避免右栏空白
  if (!state.current) {
    const list = getFiltered();
    if (list.length > 0) {
      await selectSnippet(list[0].id);
    }
  }
})();
