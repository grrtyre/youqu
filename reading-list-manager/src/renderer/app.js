// 渲染进程 - 文章列表 UI 逻辑
// 全部使用 window.api（contextBridge 暴露的 IPC 包装）

'use strict';

(function () {
  // ===== 状态 =====
  const state = {
    articles: [],
    filtered: [],
    statusFilter: 'all',
    tagFilter: 'all',
    search: '',
    sort: 'createdAt:desc'
  };

  const STATUS = window.STATUS;
  const STATUS_LABELS = window.STATUS_LABELS;
  const api = window.api;

  // ===== DOM =====
  const el = {
    list: document.getElementById('articleList'),
    empty: document.getElementById('emptyState'),
    count: document.getElementById('resultCount'),
    search: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    addBtn: document.getElementById('addBtn'),
    emptyAddBtn: document.getElementById('emptyAddBtn'),
    importBtn: document.getElementById('importBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importFile: document.getElementById('importFile'),
    sortSelect: document.getElementById('sortBy'),
    statusFilterList: document.getElementById('statusFilter'),
    tagFilterList: document.getElementById('tagFilter'),
    emptyTags: document.getElementById('emptyTags'),
    statTotal: document.getElementById('statTotal'),
    statUnread: document.getElementById('statUnread'),
    // modal
    modal: document.getElementById('articleModal'),
    modalTitle: document.getElementById('modalTitle'),
    form: document.getElementById('articleForm'),
    articleId: document.getElementById('articleId'),
    inputUrl: document.getElementById('inputUrl'),
    inputTitle: document.getElementById('inputTitle'),
    inputTags: document.getElementById('inputTags'),
    inputNotes: document.getElementById('inputNotes'),
    inputStatus: document.getElementById('inputStatus'),
    // toast
    toastContainer: document.getElementById('toastContainer')
  };

  // ===== 工具函数 =====
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  }

  function getInitial(domain) {
    return (domain || '?').charAt(0).toUpperCase();
  }

  function getFaviconUrl(url) {
    const domain = getDomain(url);
    if (!domain) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }

  function timeAgo(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 30) return new Date(timestamp).toLocaleDateString('zh-CN');
    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小时前`;
    if (minutes > 0) return `${minutes} 分钟前`;
    return '刚刚';
  }

  // ===== 渲染 =====
  function applyFilters() {
    let result = state.articles.slice();
    if (state.statusFilter !== 'all') {
      result = result.filter(a => a.status === state.statusFilter);
    }
    if (state.tagFilter !== 'all') {
      result = result.filter(a => a.tags.some(t => t.toLowerCase() === state.tagFilter.toLowerCase()));
    }
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      result = result.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.url || '').toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    // 排序
    const [sortBy, order] = state.sort.split(':');
    const dir = order === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      let av, bv;
      if (sortBy === 'title') {
        av = (a.title || '').toLowerCase(); bv = (b.title || '').toLowerCase();
        return av.localeCompare(bv, 'zh') * dir;
      } else if (sortBy === 'updatedAt') {
        av = a.updatedAt || 0; bv = b.updatedAt || 0;
      } else {
        av = a.createdAt || 0; bv = b.createdAt || 0;
      }
      return (av - bv) * dir;
    });
    state.filtered = result;
    renderList();
    renderCounts();
  }

  function renderList() {
    if (state.filtered.length === 0) {
      el.list.innerHTML = '';
      el.empty.hidden = false;
      el.count.textContent = state.articles.length === 0 ? '0 篇文章' : '没有匹配的文章';
    } else {
      el.empty.hidden = true;
      el.list.innerHTML = state.filtered.map(renderCard).join('');
      attachCardEvents();
      el.count.textContent = `${state.filtered.length} 篇文章`;
    }
  }

  function renderCard(article) {
    const domain = getDomain(article.url);
    const initial = getInitial(domain);
    const favicon = getFaviconUrl(article.url);
    const statusBadge = `<span class="status-badge badge-${article.status}">${STATUS_LABELS[article.status] || article.status}</span>`;
    const tags = article.tags.length
      ? `<div class="card-tags">${article.tags.map(t => `<span class="tag-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';
    const notes = article.notes ? `<div class="card-notes">${escapeHtml(article.notes)}</div>` : '';

    return `
      <article class="article-card ${article.status === 'archived' ? 'archived' : ''}" data-status="${article.status}" data-id="${article.id}">
        <div class="card-header">
          <div class="card-favicon">
            ${favicon ? `<img src="${escapeHtml(favicon)}" alt="" onerror="this.style.display='none';this.parentElement.textContent='${initial}'">${initial}` : initial}
          </div>
          <div class="card-title-block">
            <div class="card-title" data-action="open">${escapeHtml(article.title)}</div>
            <div class="card-domain">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>${escapeHtml(domain)}</span>
            </div>
          </div>
        </div>
        ${notes}
        ${tags}
        <div class="card-footer">
          <div class="card-meta">
            ${statusBadge}
            <span>${timeAgo(article.updatedAt || article.createdAt)}</span>
          </div>
          <div class="card-actions">
            <button class="icon-btn" data-action="mark-read" title="标记为已读">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="icon-btn" data-action="edit" title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="icon-btn danger" data-action="delete" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function attachCardEvents() {
    el.list.querySelectorAll('.article-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          await handleCardAction(action, id);
        });
      });
      // 点击标签筛选
      card.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = chip.dataset.tag;
          state.tagFilter = tag;
          updateTagFilterUI();
          applyFilters();
        });
      });
    });
  }

  async function handleCardAction(action, id) {
    const article = state.articles.find(a => a.id === id);
    if (!article) return;
    switch (action) {
      case 'open':
        await api.openExternal(article.url);
        // 自动标记为阅读中（如果还是未读）
        if (article.status === STATUS.UNREAD) {
          await api.update(id, { status: STATUS.READING });
          await reload();
        }
        break;
      case 'mark-read':
        await api.update(id, { status: STATUS.READ });
        await reload();
        showToast('已标记为已读', 'success');
        break;
      case 'edit':
        openModalForEdit(article);
        break;
      case 'delete':
        if (confirm('确定删除这篇文章？')) {
          const res = await api.remove(id);
          if (res.ok) {
            await reload();
            showToast('已删除', 'success');
          } else {
            showToast(res.error || '删除失败', 'error');
          }
        }
        break;
    }
  }

  function renderCounts() {
    const stats = {
      all: state.articles.length,
      unread: 0,
      reading: 0,
      read: 0,
      archived: 0
    };
    state.articles.forEach(a => { if (stats[a.status] !== undefined) stats[a.status]++; });
    document.querySelectorAll('[data-count]').forEach(node => {
      const key = node.dataset.count;
      node.textContent = stats[key] !== undefined ? stats[key] : 0;
    });
    el.statTotal.textContent = stats.all;
    el.statUnread.textContent = stats.unread;
  }

  function renderTagFilter() {
    const tagSet = new Map();
    state.articles.forEach(a => {
      a.tags.forEach(t => {
        const key = t.toLowerCase();
        tagSet.set(key, (tagSet.get(key) || 0) + 1);
      });
    });
    const tags = [...tagSet.entries()].sort((a, b) => b[1] - a[1]);
    if (tags.length === 0) {
      el.tagFilterList.innerHTML = `
        <li class="filter-item active" data-filter="tag" data-value="all">
          <span class="filter-label">全部标签</span>
        </li>`;
      el.emptyTags.hidden = false;
      return;
    }
    el.emptyTags.hidden = true;
    let html = `
      <li class="filter-item ${state.tagFilter === 'all' ? 'active' : ''}" data-filter="tag" data-value="all">
        <span class="filter-label">全部标签</span>
        <span class="filter-count">${state.articles.length}</span>
      </li>`;
    html += tags.map(([tag, count]) => `
      <li class="filter-item ${state.tagFilter === tag ? 'active' : ''}" data-filter="tag" data-value="${escapeHtml(tag)}">
        <span class="filter-icon">#</span>
        <span class="filter-label">${escapeHtml(tag)}</span>
        <span class="filter-count">${count}</span>
      </li>`).join('');
    el.tagFilterList.innerHTML = html;
  }

  function updateTagFilterUI() {
    el.tagFilterList.querySelectorAll('.filter-item').forEach(item => {
      item.classList.toggle('active', item.dataset.value === state.tagFilter);
    });
  }

  // ===== Modal =====
  function openModalForAdd() {
    el.modalTitle.textContent = '添加文章';
    el.articleId.value = '';
    el.form.reset();
    el.inputStatus.value = STATUS.UNREAD;
    el.modal.hidden = false;
    setTimeout(() => el.inputUrl.focus(), 60);
  }

  function openModalForEdit(article) {
    el.modalTitle.textContent = '编辑文章';
    el.articleId.value = article.id;
    el.inputUrl.value = article.url;
    el.inputTitle.value = article.title;
    el.inputTags.value = (article.tags || []).join(', ');
    el.inputNotes.value = article.notes || '';
    el.inputStatus.value = article.status;
    el.modal.hidden = false;
    setTimeout(() => el.inputUrl.focus(), 60);
  }

  function closeModal() {
    el.modal.hidden = true;
  }

  async function submitForm(e) {
    e.preventDefault();
    const id = el.articleId.value;
    const data = {
      url: el.inputUrl.value,
      title: el.inputTitle.value,
      tags: el.inputTags.value,
      notes: el.inputNotes.value,
      status: el.inputStatus.value
    };
    const res = id
      ? await api.update(id, data)
      : await api.add(data);
    if (res.ok) {
      closeModal();
      await reload();
      showToast(id ? '已更新' : '已添加', 'success');
    } else {
      showToast(res.error || '保存失败', 'error');
    }
  }

  // ===== Toast =====
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v5M12 16.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 17.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v.5M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    };
    toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 200);
    }, 2600);
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    el.addBtn.addEventListener('click', openModalForAdd);
    if (el.emptyAddBtn) el.emptyAddBtn.addEventListener('click', openModalForAdd);

    el.search.addEventListener('input', (e) => {
      state.search = e.target.value;
      el.searchClear.hidden = !state.search;
      applyFilters();
    });
    el.searchClear.addEventListener('click', () => {
      el.search.value = '';
      state.search = '';
      el.searchClear.hidden = true;
      applyFilters();
    });

    el.sortSelect.addEventListener('change', (e) => {
      state.sort = e.target.value;
      applyFilters();
    });

    el.statusFilterList.addEventListener('click', (e) => {
      const item = e.target.closest('.filter-item');
      if (!item) return;
      state.statusFilter = item.dataset.value;
      el.statusFilterList.querySelectorAll('.filter-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      applyFilters();
    });

    el.tagFilterList.addEventListener('click', (e) => {
      const item = e.target.closest('.filter-item');
      if (!item) return;
      state.tagFilter = item.dataset.value;
      updateTagFilterUI();
      applyFilters();
    });

    el.form.addEventListener('submit', submitForm);

    // 弹窗关闭
    el.modal.querySelectorAll('[data-close]').forEach(node => {
      node.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !el.modal.hidden) closeModal();
      // Ctrl+N 快速添加
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && el.modal.hidden) {
        e.preventDefault();
        openModalForAdd();
      }
    });

    // 导入导出
    el.exportBtn.addEventListener('click', async () => {
      const json = await api.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reading-list-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出 JSON 文件', 'success');
    });

    el.importBtn.addEventListener('click', () => el.importFile.click());
    el.importFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const res = await api.importData(text);
      if (res.ok) {
        await reload();
        showToast(`已导入 ${res.added} 篇文章`, 'success');
      } else {
        showToast(res.error || '导入失败', 'error');
      }
      e.target.value = '';
    });

    // 主进程事件
    api.onArticleAddedFromClipboard(async (article) => {
      await reload();
      showToast('已从剪贴板添加', 'success');
    });
    api.onArticleAlreadyExists(() => {
      showToast('该 URL 已存在', 'warning');
    });
    api.onClipboardNotUrl(() => {
      showToast('剪贴板不是有效的 URL', 'warning');
      openModalForAdd();
    });
  }

  // ===== 数据加载 =====
  async function reload() {
    state.articles = await api.list();
    renderTagFilter();
    applyFilters();
  }

  async function init() {
    bindEvents();
    await reload();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
