// 渲染进程 - 提示词库管理逻辑
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // 状态
  const state = {
    prompts: [],
    filter: 'all',        // all | favorite | recent | category:xxx | tag:xxx
    keyword: '',
    view: 'grid',          // grid | list
    editingId: null,
    currentVarPrompt: null
  };

  // ============ 工具函数 ============
  function uuid() {
    return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function extractVars(text) {
    const set = [];
    const seen = new Set();
    const re = /\{\{([^{}]+)\}\}/g;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1].trim();
      if (!seen.has(name)) { seen.add(name); set.push(name); }
    }
    return set;
  }
  function highlightVars(text) {
    return escapeHtml(text).replace(/\{\{([^{}]+)\}\}/g, '<span class="var-tag">{{$1}}</span>');
  }
  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function unique(arr) { return Array.from(new Set(arr)); }

  function toast(msg, type) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = 'toast'; setTimeout(() => { el.hidden = true; }, 250); }, 1800);
  }

  // ============ 数据持久化 ============
  async function load() {
    const data = await window.api.readData();
    state.prompts = (data && Array.isArray(data.prompts)) ? data.prompts : [];
  }
  async function save() {
    return window.api.writeData({ prompts: state.prompts });
  }

  // ============ 过滤逻辑 ============
  function getFiltered() {
    let list = state.prompts.slice();
    // 分类/标签/收藏/最近 过滤
    const f = state.filter;
    if (f === 'favorite') list = list.filter(p => p.favorite);
    else if (f === 'recent') {
      list = list.filter(p => p.lastUsedAt)
        .sort((a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt));
    } else if (f.startsWith('category:')) {
      const cat = f.slice('category:'.length);
      list = list.filter(p => p.category === cat);
    } else if (f.startsWith('tag:')) {
      const tag = f.slice('tag:'.length);
      list = list.filter(p => Array.isArray(p.tags) && p.tags.includes(tag));
    }
    // 关键词
    const kw = state.keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(p => {
        const hay = [p.title, p.content, (p.tags || []).join(' '), p.category || ''].join(' ').toLowerCase();
        return hay.includes(kw);
      });
    }
    // 默认排序：收藏在前 → 最近更新
    if (f !== 'recent') {
      list.sort((a, b) => {
        if (!!b.favorite - !!a.favorite) return !!b.favorite - !!a.favorite ? 1 : -1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
    }
    return list;
  }

  // ============ 渲染 ============
  function renderSidebar() {
    // 分类列表
    const cats = unique(state.prompts.map(p => p.category).filter(Boolean)).sort();
    const catList = $('#categoryList');
    catList.innerHTML = '';
    cats.forEach(cat => {
      const count = state.prompts.filter(p => p.category === cat).length;
      const btn = document.createElement('button');
      btn.className = 'category-item' + (state.filter === 'category:' + cat ? ' active' : '');
      btn.dataset.filter = 'category:' + cat;
      btn.innerHTML = `<span class="cat-dot"></span><span class="cat-name">${escapeHtml(cat)}</span><span class="cat-count">${count}</span>`;
      catList.appendChild(btn);
    });
    // 更新 datalist
    const dl = $('#categoryOptions');
    dl.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');

    // 标签云
    const tagSet = {};
    state.prompts.forEach(p => (p.tags || []).forEach(t => { tagSet[t] = (tagSet[t] || 0) + 1; }));
    const tags = Object.keys(tagSet).sort((a, b) => tagSet[b] - tagSet[a]).slice(0, 24);
    const cloud = $('#tagCloud');
    cloud.innerHTML = tags.length
      ? tags.map(t => `<button class="tag-chip${state.filter === 'tag:' + t ? ' active' : ''}" data-filter="tag:${escapeHtml(t)}">${escapeHtml(t)} <span style="opacity:.6">${tagSet[t]}</span></button>`).join('')
      : '<span style="font-size:11.5px;color:var(--text-3);padding:4px 4px;">暂无标签</span>';

    // 计数
    $('[data-count="all"]').textContent = state.prompts.length;
    $('[data-count="favorite"]').textContent = state.prompts.filter(p => p.favorite).length;
    $('[data-count="recent"]').textContent = state.prompts.filter(p => p.lastUsedAt).length;
  }

  function renderContent() {
    const list = getFiltered();
    const content = $('#content');
    const empty = $('#emptyState');
    $('#countText').textContent = `共 ${list.length} 条` + (list.length < state.prompts.length ? ` / ${state.prompts.length}` : '');

    if (!list.length) {
      content.innerHTML = '';
      empty.hidden = false;
      // 区分无数据 vs 无匹配
      const sub = $('.empty-sub');
      if (state.prompts.length) {
        $('.empty-title').textContent = '没有匹配的提示词';
        sub.textContent = '试试调整搜索关键词或筛选条件';
        $('.empty-ico').textContent = '⌕';
      } else {
        $('.empty-title').textContent = '还没有提示词';
        sub.textContent = '点击右上角「新建提示词」开始管理你的灵感';
        $('.empty-ico').textContent = '✦';
      }
      return;
    }
    empty.hidden = true;

    content.className = 'content ' + state.view + '-view';
    content.innerHTML = list.map(cardHtml).join('');
  }

  function cardHtml(p) {
    const vars = extractVars(p.content);
    const varBadges = vars.length
      ? `<span class="card-usage" title="包含变量">⚙ ${vars.length} 变量</span>` : '';
    const usage = p.usageCount ? `<span class="card-usage">↻ ${p.usageCount}</span>` : '';
    const tags = (p.tags || []).slice(0, 4).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('');
    const cat = p.category ? `<span class="card-cat">${escapeHtml(p.category)}</span>` : '';
    return `
      <article class="card" data-id="${p.id}">
        <div class="card-head">
          <div class="card-title" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</div>
          <button class="card-fav ${p.favorite ? 'on' : ''}" data-act="fav" title="${p.favorite ? '取消收藏' : '收藏'}">${p.favorite ? '★' : '☆'}</button>
        </div>
        <div class="card-body">${highlightVars(p.content)}</div>
        <div class="card-meta">
          ${cat}
          ${tags}
          ${usage}
          ${varBadges}
        </div>
        <div class="card-actions">
          ${vars.length
            ? `<button class="card-btn primary" data-act="fill">填写并复制</button>`
            : `<button class="card-btn primary" data-act="copy">复制</button>`}
          <button class="card-btn" data-act="edit">编辑</button>
        </div>
      </article>`;
  }

  function render() {
    renderSidebar();
    renderContent();
    // 高亮当前筛选
    $$('.nav-item, .category-item, .tag-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === state.filter);
    });
  }

  // ============ 事件：筛选 ============
  $('#nav').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    render();
  });
  $('#tagCloud').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    render();
  });

  // ============ 事件：搜索 ============
  const searchInput = $('#searchInput');
  searchInput.addEventListener('input', e => {
    state.keyword = e.target.value;
    $('#clearSearch').hidden = !state.keyword;
    renderContent();
  });
  $('#clearSearch').addEventListener('click', () => {
    searchInput.value = '';
    state.keyword = '';
    $('#clearSearch').hidden = true;
    renderContent();
    searchInput.focus();
  });

  // ============ 事件：视图切换 ============
  $$('.seg-btn').forEach(b => b.addEventListener('click', () => {
    $$('.seg-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.view = b.dataset.view;
    renderContent();
  }));

  // ============ 事件：卡片操作 ============
  $('#content').addEventListener('click', async e => {
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    const p = state.prompts.find(x => x.id === id);
    if (!p) return;
    const act = e.target.closest('[data-act]')?.dataset.act;

    if (act === 'fav') {
      p.favorite = !p.favorite;
      p.updatedAt = new Date().toISOString();
      await save();
      render();
    } else if (act === 'copy') {
      await copyText(p.content);
      bumpUsage(p);
      toast('已复制到剪贴板', 'success');
    } else if (act === 'fill') {
      openVarModal(p);
    } else if (act === 'edit') {
      openEditModal(p);
    }
  });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 降级方案
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      return ok;
    }
  }
  function bumpUsage(p) {
    p.usageCount = (p.usageCount || 0) + 1;
    p.lastUsedAt = new Date().toISOString();
    save();
    renderSidebar();
  }

  // ============ 编辑弹窗 ============
  const modalMask = $('#modalMask');
  function openEditModal(p) {
    state.editingId = p ? p.id : null;
    $('#modalTitle').textContent = p ? '编辑提示词' : '新建提示词';
    $('#fTitle').value = p ? p.title : '';
    $('#fCategory').value = p ? (p.category || '') : '';
    $('#fTags').value = p && Array.isArray(p.tags) ? p.tags.join(', ') : '';
    $('#fContent').value = p ? p.content : '';
    $('#fFavorite').checked = !!p && p.favorite;
    $('#deleteBtn').hidden = !p;
    modalMask.hidden = false;
    setTimeout(() => $('#fTitle').focus(), 50);
  }
  function closeModal() {
    modalMask.hidden = true;
    state.editingId = null;
  }
  $('#newPromptBtn').addEventListener('click', () => openEditModal(null));
  $('#modalClose').addEventListener('click', closeModal);
  $('#cancelBtn').addEventListener('click', closeModal);
  modalMask.addEventListener('click', e => { if (e.target === modalMask) closeModal(); });

  $('#saveBtn').addEventListener('click', async () => {
    const title = $('#fTitle').value.trim();
    const content = $('#fContent').value;
    if (!title) { toast('请填写标题', 'error'); $('#fTitle').focus(); return; }
    if (!content.trim()) { toast('请填写内容', 'error'); $('#fContent').focus(); return; }
    const category = $('#fCategory').value.trim() || '未分类';
    const tags = $('#fTags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const now = new Date().toISOString();
    if (state.editingId) {
      const p = state.prompts.find(x => x.id === state.editingId);
      if (p) {
        Object.assign(p, { title, content, category, tags, favorite: $('#fFavorite').checked, updatedAt: now });
      }
    } else {
      state.prompts.push({
        id: uuid(), title, content, category, tags,
        favorite: $('#fFavorite').checked,
        usageCount: 0,
        createdAt: now, updatedAt: now, lastUsedAt: null
      });
    }
    await save();
    closeModal();
    render();
    toast('保存成功', 'success');
  });

  $('#deleteBtn').addEventListener('click', async () => {
    if (!state.editingId) return;
    if (!confirm('确定删除这条提示词？此操作不可撤销。')) return;
    state.prompts = state.prompts.filter(x => x.id !== state.editingId);
    await save();
    closeModal();
    render();
    toast('已删除', 'success');
  });

  // ============ 新建分类 ============
  $('#addCategoryBtn').addEventListener('click', () => {
    openEditModal(null);
    setTimeout(() => $('#fCategory').focus(), 60);
  });

  // ============ 变量填写弹窗 ============
  const varMask = $('#varMask');
  function openVarModal(p) {
    state.currentVarPrompt = p;
    const vars = extractVars(p.content);
    const body = $('#varBody');
    if (!vars.length) {
      body.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:8px 0;">这条提示词没有变量，可直接复制。</div>';
    } else {
      body.innerHTML = vars.map(v => `
        <div class="field var-field">
          <span class="field-label">变量 <span class="var-name">{{${escapeHtml(v)}}}</span></span>
          <input type="text" class="input" data-var="${escapeHtml(v)}" placeholder="请输入 ${escapeHtml(v)}" />
        </div>`).join('');
    }
    $('#varTitle').textContent = '填写变量并复制';
    varMask.hidden = false;
    setTimeout(() => {
      const first = body.querySelector('input');
      if (first) first.focus();
    }, 50);
  }
  function closeVar() {
    varMask.hidden = true;
    state.currentVarPrompt = null;
  }
  $('#varClose').addEventListener('click', closeVar);
  $('#varCancel').addEventListener('click', closeVar);
  varMask.addEventListener('click', e => { if (e.target === varMask) closeVar(); });

  $('#varCopy').addEventListener('click', async () => {
    const p = state.currentVarPrompt;
    if (!p) return;
    let result = p.content;
    $$('#varBody input[data-var]').forEach(inp => {
      const name = inp.dataset.var;
      const val = inp.value;
      result = result.split('{{' + name + '}}').join(val || '');
    });
    await copyText(result);
    bumpUsage(p);
    closeVar();
    toast('已复制到剪贴板', 'success');
  });

  // ============ 导入/导出 ============
  $('#exportBtn').addEventListener('click', async () => {
    const r = await window.api.exportData({ prompts: state.prompts });
    if (r.ok) toast('已导出 ' + r.filePath, 'success');
    else if (!r.canceled) toast('导出失败：' + (r.error || ''), 'error');
  });
  $('#importBtn').addEventListener('click', async () => {
    const r = await window.api.importData();
    if (!r.ok) {
      if (!r.canceled) toast('导入失败：' + (r.error || ''), 'error');
      return;
    }
    // 合并：按 id 去重
    const incoming = r.data.prompts || [];
    const existIds = new Set(state.prompts.map(p => p.id));
    let added = 0;
    incoming.forEach(p => {
      if (!p.id) p.id = uuid();
      if (!existIds.has(p.id)) {
        state.prompts.push(p);
        added++;
      }
    });
    await save();
    render();
    toast(`导入完成，新增 ${added} 条`, 'success');
  });

  // ============ 键盘快捷键 ============
  document.addEventListener('keydown', e => {
    // ESC 关闭弹窗
    if (e.key === 'Escape') {
      if (!modalMask.hidden) closeModal();
      else if (!varMask.hidden) closeVar();
    }
    // Ctrl/Cmd + N 新建
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (modalMask.hidden) openEditModal(null);
    }
    // Ctrl/Cmd + F 搜索
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  // ============ 启动 ============
  async function init() {
    await load();
    render();
    $('#statusText').textContent = '就绪';
  }
  init();
})();
