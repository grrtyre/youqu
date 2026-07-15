// renderer.js — 渲染进程逻辑
'use strict';

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const countEl = document.getElementById('count');
const toastEl = document.getElementById('toast');
const clearBtn = document.getElementById('clearBtn');
const closeBtn = document.getElementById('closeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const dataPathEl = document.getElementById('dataPath');
const afdianLink = document.getElementById('afdianLink');
const tabs = document.querySelectorAll('.tab');

let allItems = [];
let currentFilter = 'all';
let currentSearch = '';
let focusedIndex = -1; // 键盘导航：当前高亮索引
let expandedId = null; // 预览面板：当前展开的条目 id
let editingId = null;  // 编辑模式：当前正在编辑的条目 id
// 自动粘贴设置：默认开启，存在 localStorage
let autoPaste = localStorage.getItem('cbm_autoPaste');
autoPaste = autoPaste === null ? true : autoPaste === '1';

// 相对时间
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return '刚刚';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' 分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小时前';
  const d = Math.floor(h / 24);
  if (d < 30) return d + ' 天前';
  return new Date(ts).toLocaleDateString('zh-CN');
}

const TYPE_LABEL = { code: 'CODE', link: 'LINK', email: 'MAIL', phone: 'TEL', text: 'TEXT', image: 'IMG' };

// 图片直接用主进程生成的缩略图 dataURL（item.thumb），无需 file:// 转换

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// 转义正则特殊字符
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 搜索关键词高亮：先 escape，再用 <mark> 包裹匹配项
function highlight(text, query) {
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const safeQuery = escapeRegExp(query);
  try {
    const re = new RegExp('(' + safeQuery + ')', 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  } catch (e) {
    return escaped;
  }
}

// 字数统计
function countChars(s) {
  return String(s).length;
}

// 过滤+搜索
function getFilteredItems() {
  let items = allItems;
  if (currentFilter === 'favorite') {
    items = items.filter(i => i.favorite);
  } else if (currentFilter !== 'all') {
    items = items.filter(i => i.type === currentFilter);
  }
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    items = items.filter(i => i.content.toLowerCase().includes(q));
  }
  return items;
}

// 排序：置顶在前，然后按时间
function getSortedItems() {
  return [...allItems].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.timestamp - a.timestamp;
  });
}

// 获取排序+过滤后的列表
function getFilteredSorted() {
  const sorted = getSortedItems();
  const orig = allItems;
  allItems = sorted;
  const items = getFilteredItems();
  allItems = orig;
  return items;
}

// 渲染单个条目的预览内容
function renderPreviewContent(item) {
  if (item.type === 'image' && item.thumb) {
    const dim = (item.width && item.height) ? (item.width + ' × ' + item.height + ' px') : '';
    return `
      <div class="preview-image-wrap">
        <img class="preview-image" src="${item.thumb}" alt="剪贴板图片" />
        ${dim ? `<span class="preview-stat">${dim}</span>` : ''}
      </div>
    `;
  }
  const full = escapeHtml(item.content);
  if (item.type === 'link') {
    // 链接：显示完整 URL + 打开按钮
    return `
      <div class="preview-link-row">
        <span class="preview-url">${full}</span>
        <button class="preview-open-btn" data-act="open-link" data-url="${full}">打开 ↗</button>
      </div>
      <pre class="preview-body preview-body-link">${full}</pre>
    `;
  }
  if (item.type === 'code') {
    // 代码：带行号的等宽显示
    const lines = item.content.split('\n');
    const numbered = lines.map((ln, i) =>
      `<span class="line-no">${String(i + 1).padStart(2, ' ')}</span>  ${escapeHtml(ln)}`
    ).join('\n');
    return `<pre class="preview-body preview-body-code">${numbered}</pre>`;
  }
  // 其他：pre-wrap 保留格式
  return `<pre class="preview-body">${full}</pre>`;
}

// 渲染列表条目的主内容（区分图片/文本/编辑模式）
function renderItemContent(item, isEditing) {
  if (isEditing) {
    // 编辑模式：textarea + 保存/取消
    return `
      <textarea class="item-edit-area" rows="4">${escapeHtml(item.content)}</textarea>
      <div class="item-edit-actions">
        <button class="edit-save-btn" data-act="edit-save">保存</button>
        <button class="edit-cancel-btn" data-act="edit-cancel">取消</button>
      </div>
    `;
  }
  if (item.type === 'image' && item.thumb) {
    return `
      <div class="item-image-thumb" data-act="image-thumb">
        <img src="${item.thumb}" alt="图片" />
        <span class="item-image-label">${escapeHtml(item.content)}</span>
      </div>
    `;
  }
  // 文本类：高亮关键词 + 截断
  return `<div class="item-content">${highlight(truncate(item.content, 200), currentSearch)}</div>`;
}

// 渲染
function render() {
  const items = getFilteredSorted();
  // 修复：筛选/搜索时显示「已显示/总数」，避免计数误导
  const total = allItems.length;
  const shown = items.length;
  const isFiltered = currentFilter !== 'all' || !!currentSearch;
  countEl.textContent = isFiltered ? (shown + '/' + total + ' 条') : (total + ' 条记录');

  if (items.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    if (currentSearch || currentFilter !== 'all') {
      emptyEl.querySelector('.empty-icon').textContent = '🔍';
      emptyEl.querySelector('.empty-text').textContent = '没有匹配的记录';
      emptyEl.querySelector('.empty-hint').textContent = '试试其他关键词或筛选';
    } else {
      emptyEl.querySelector('.empty-icon').textContent = '📭';
      emptyEl.querySelector('.empty-text').textContent = '还没有剪贴板历史';
      emptyEl.querySelector('.empty-hint').textContent = '复制任何内容，就会出现在这里';
    }
    return;
  }
  emptyEl.hidden = true;

  // 限制 focusedIndex 不超出范围
  if (focusedIndex >= items.length) focusedIndex = items.length - 1;
  if (focusedIndex < -1) focusedIndex = -1;

  listEl.innerHTML = items.map((item, idx) => {
    const cls = ['item', 'type-' + item.type];
    if (item.pinned) cls.push('pinned');
    if (idx === focusedIndex) cls.push('focused');
    if (item.id === expandedId) cls.push('expanded');
    if (item.id === editingId) cls.push('editing');
    const expanded = item.id === expandedId;
    const isEditing = item.id === editingId;
    const previewHtml = expanded && !isEditing ? `
      <div class="item-preview">
        <div class="preview-meta">
          <span class="preview-stat">${countChars(item.content)} 字符 · ${item.content.split('\n').length} 行</span>
        </div>
        ${renderPreviewContent(item)}
      </div>
    ` : '';
    // 操作按钮：图片不可编辑
    const editBtn = item.type !== 'image'
      ? `<button class="act-btn ${isEditing ? 'edit-active' : ''}" data-act="edit" title="编辑">✎</button>`
      : '';
    return `
      <div class="${cls.join(' ')}" data-id="${item.id}" style="animation-delay:${Math.min(idx*0.02, 0.3)}s">
        <div class="item-header">
          <div class="item-meta">
            <span class="type-badge ${item.type}">${TYPE_LABEL[item.type] || 'TEXT'}</span>
            <span class="item-time">${timeAgo(item.timestamp)}</span>
          </div>
          <div class="item-actions">
            <button class="act-btn ${expanded ? 'preview-active' : ''}" data-act="preview" title="预览/展开">👁</button>
            ${editBtn}
            <button class="act-btn ${item.favorite ? 'fav-active' : ''}" data-act="favorite" title="收藏">★</button>
            <button class="act-btn ${item.pinned ? 'pin-active' : ''}" data-act="pin" title="置顶">📌</button>
            <button class="act-btn act-btn-del" data-act="delete" title="删除">🗑</button>
          </div>
        </div>
        ${renderItemContent(item, isEditing)}
        ${previewHtml}
      </div>
    `;
  }).join('');
}

// 加载
async function load() {
  try {
    allItems = await window.api.getItems();
    render();
  } catch (e) {
    console.error('load error', e);
  }
}

// 事件委托：列表操作
listEl.addEventListener('click', async (e) => {
  const actBtn = e.target.closest('.act-btn');
  const openBtn = e.target.closest('.preview-open-btn');
  const editSaveBtn = e.target.closest('[data-act="edit-save"]');
  const editCancelBtn = e.target.closest('[data-act="edit-cancel"]');
  const imageThumb = e.target.closest('[data-act="image-thumb"]');
  const itemEl = e.target.closest('.item');
  if (!itemEl) return;
  const id = itemEl.dataset.id;

  // 编辑模式下的保存
  if (editSaveBtn) {
    e.stopPropagation();
    const ta = itemEl.querySelector('.item-edit-area');
    if (!ta) return;
    const newContent = ta.value;
    if (!newContent || !newContent.trim()) {
      showToast('内容不能为空');
      return;
    }
    const updated = await window.api.editItem(id, newContent);
    if (updated) {
      editingId = null;
      showToast('已保存');
      await load();
    } else {
      showToast('保存失败');
    }
    return;
  }

  // 编辑模式下的取消
  if (editCancelBtn) {
    e.stopPropagation();
    editingId = null;
    render();
    return;
  }

  // 打开链接按钮（预览面板内）
  if (openBtn) {
    e.stopPropagation();
    const url = openBtn.dataset.url;
    if (url && window.api.openExternal) {
      await window.api.openExternal(url);
      showToast('已在浏览器打开');
    }
    return;
  }

  if (actBtn) {
    e.stopPropagation();
    const act = actBtn.dataset.act;
    if (act === 'preview') {
      // 切换预览展开
      expandedId = (expandedId === id) ? null : id;
      render();
    } else if (act === 'edit') {
      // 进入编辑模式（图片不可编辑，按钮已隐藏；这里二次保护）
      const item = allItems.find(i => i.id === id);
      if (item && item.type === 'image') return;
      editingId = id;
      expandedId = null;
      render();
      // 自动聚焦 textarea 并选中所有内容
      const ta = document.querySelector(`.item[data-id="${id}"] .item-edit-area`);
      if (ta) { ta.focus(); ta.select(); }
    } else if (act === 'favorite') {
      const updated = await window.api.toggleFavorite(id);
      showToast(updated && updated.favorite ? '已收藏' : '已取消收藏');
      await load();
    } else if (act === 'pin') {
      const updated = await window.api.togglePin(id);
      showToast(updated && updated.pinned ? '已置顶' : '已取消置顶');
      await load();
    } else if (act === 'delete') {
      await window.api.deleteItem(id);
      if (expandedId === id) expandedId = null;
      if (editingId === id) editingId = null;
      showToast('已删除');
      await load();
    }
    return;
  }

  // 编辑模式下点击非按钮区域不触发复制
  if (editingId === id) return;

  // 点击图片缩略图或卡片 = 复制
  if (imageThumb) e.stopPropagation();
  focusedIndex = -1; // 鼠标点击时清除键盘高亮
  const clickItem = allItems.find(i => i.id === id);
  const ok = await window.api.copyItem(id);
  if (ok) {
    showToast(clickItem && clickItem.type === 'image' ? '图片已复制' : '已复制');
    if (autoPaste && window.api.pasteToFront) {
      await window.api.pasteToFront();
    }
    setTimeout(() => window.close(), 300);
  }
});

// 搜索
searchInput.addEventListener('input', () => {
  currentSearch = searchInput.value.trim();
  searchClear.classList.toggle('show', !!currentSearch);
  focusedIndex = -1; // 搜索变化时重置键盘高亮
  editingId = null; // 搜索变化时退出编辑模式
  render();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  currentSearch = '';
  searchClear.classList.remove('show');
  searchInput.focus();
  render();
});

// 筛选
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    focusedIndex = -1; // 筛选变化时重置键盘高亮
    expandedId = null;
    editingId = null; // 切换筛选时退出编辑模式
    render();
  });
});

// 清空（自定义确认弹窗，替代原生 confirm）
const confirmModal = document.getElementById('confirmModal');
const confirmCancel = document.getElementById('confirmCancel');
const confirmOk = document.getElementById('confirmOk');
clearBtn.addEventListener('click', () => { confirmModal.hidden = false; });
confirmCancel.addEventListener('click', () => { confirmModal.hidden = true; });
confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) confirmModal.hidden = true; });
confirmOk.addEventListener('click', async () => {
  confirmModal.hidden = true;
  await window.api.clearAll();
  await load();
  showToast('已清空');
});

// 关闭/设置
closeBtn.addEventListener('click', () => window.close());
settingsBtn.addEventListener('click', () => { settingsPanel.hidden = false; });
closeSettings.addEventListener('click', () => { settingsPanel.hidden = true; });
settingsPanel.addEventListener('click', (e) => {
  if (e.target === settingsPanel) settingsPanel.hidden = true;
});

// 爱发电链接：调用主进程打开外部浏览器
if (afdianLink) {
  afdianLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const url = window.api.getAfdianUrl ? await window.api.getAfdianUrl() : 'https://www.ifdian.net/a/giquwei';
      if (window.api.openExternal) await window.api.openExternal(url);
    } catch (err) {
      showToast('打开失败');
    }
  });
}

// 自动粘贴开关
const autoPasteToggle = document.getElementById('autoPasteToggle');
if (autoPasteToggle) {
  autoPasteToggle.checked = autoPaste;
  autoPasteToggle.addEventListener('change', () => {
    autoPaste = autoPasteToggle.checked;
    localStorage.setItem('cbm_autoPaste', autoPaste ? '1' : '0');
    showToast(autoPaste ? '已开启自动粘贴' : '已关闭自动粘贴');
  });
}

// 加载数据存储路径
async function loadDataPath() {
  if (!dataPathEl || !window.api.getDataPath) return;
  try {
    const p = await window.api.getDataPath();
    dataPathEl.textContent = p;
    dataPathEl.title = p;
  } catch (e) {
    dataPathEl.textContent = '本地 userData';
  }
}

// --- 键盘导航 ---
document.addEventListener('keydown', async (e) => {
  // 清空确认弹窗打开时只处理 Escape
  if (confirmModal && !confirmModal.hidden) {
    if (e.key === 'Escape') { confirmModal.hidden = true; e.preventDefault(); }
    if (e.key === 'Enter') { confirmOk.click(); e.preventDefault(); }
    return;
  }
  // 设置面板打开时不拦截
  if (!settingsPanel.hidden) {
    if (e.key === 'Escape') { settingsPanel.hidden = true; e.preventDefault(); }
    return;
  }

  // 编辑模式下的快捷键：Ctrl/Cmd+Enter 保存，Esc 取消
  const inEditMode = editingId !== null;
  const activeIsTextarea = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('item-edit-area');
  if (inEditMode && activeIsTextarea) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const itemEl = document.querySelector(`.item[data-id="${editingId}"]`);
      if (itemEl) {
        const saveBtn = itemEl.querySelector('[data-act="edit-save"]');
        if (saveBtn) saveBtn.click();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      editingId = null;
      render();
      return;
    }
    // 编辑模式下不拦截其他按键（让用户正常输入）
    return;
  }

  const items = getFilteredSorted();
  if (items.length === 0 && e.key !== 'Escape') return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    expandedId = null;
    focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
    render();
    scrollFocusedIntoView();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    expandedId = null;
    focusedIndex = Math.max(focusedIndex - 1, 0);
    render();
    scrollFocusedIntoView();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (focusedIndex < 0 || focusedIndex >= items.length) return;
    const item = items[focusedIndex];
    const ok = await window.api.copyItem(item.id);
    if (ok) {
      showToast(item.type === 'image' ? '图片已复制' : '已复制');
      // 粘贴到前台窗口
      if (autoPaste && window.api.pasteToFront) {
        await window.api.pasteToFront();
      }
      setTimeout(() => window.close(), 300);
    }
  } else if (e.key === ' ') {
    // 空格键：预览/展开当前高亮项
    if (focusedIndex >= 0 && focusedIndex < items.length) {
      e.preventDefault();
      const item = items[focusedIndex];
      expandedId = (expandedId === item.id) ? null : item.id;
      render();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (expandedId) {
      expandedId = null;
      render();
    } else {
      window.close();
    }
  } else if (e.key === 'Delete') {
    // Delete 键：删除当前高亮项
    if (focusedIndex >= 0 && focusedIndex < items.length) {
      e.preventDefault();
      const item = items[focusedIndex];
      await window.api.deleteItem(item.id);
      if (expandedId === item.id) expandedId = null;
      if (editingId === item.id) editingId = null;
      showToast('已删除');
      await load();
    }
  }
});

// 让高亮项滚动到可视区
function scrollFocusedIntoView() {
  const el = listEl.children[focusedIndex];
  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// 监听历史更新
window.api.onHistoryUpdated(() => load());

// 初始加载
load();
loadDataPath();
// 自动聚焦搜索
setTimeout(() => searchInput.focus(), 100);
