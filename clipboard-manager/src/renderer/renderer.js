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
const tabs = document.querySelectorAll('.tab');

let allItems = [];
let currentFilter = 'all';
let currentSearch = '';

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

const TYPE_LABEL = { code: 'CODE', link: 'LINK', email: 'MAIL', phone: 'TEL', text: 'TEXT' };

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

// 渲染
function render() {
  // 排序：置顶在前，然后按时间
  const sorted = [...allItems].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.timestamp - a.timestamp;
  });
  // 临时替换全局以便过滤
  const orig = allItems;
  allItems = sorted;
  const items = getFilteredItems();
  allItems = orig;

  countEl.textContent = orig.length + ' 条记录';

  if (items.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    if (currentSearch || currentFilter !== 'all') {
      emptyEl.querySelector('.empty-text').textContent = '没有匹配的记录';
      emptyEl.querySelector('.empty-hint').textContent = '试试其他关键词或筛选';
    } else {
      emptyEl.querySelector('.empty-text').textContent = '还没有剪贴板历史';
      emptyEl.querySelector('.empty-hint').textContent = '复制任何内容，就会出现在这里';
    }
    return;
  }
  emptyEl.hidden = true;

  listEl.innerHTML = items.map((item, idx) => {
    const cls = ['item', 'type-' + item.type];
    if (item.pinned) cls.push('pinned');
    const content = escapeHtml(truncate(item.content, 200));
    return `
      <div class="${cls.join(' ')}" data-id="${item.id}" style="animation-delay:${Math.min(idx*0.02, 0.3)}s">
        <div class="item-header">
          <div class="item-meta">
            <span class="type-badge ${item.type}">${TYPE_LABEL[item.type] || 'TEXT'}</span>
            <span class="item-time">${timeAgo(item.timestamp)}</span>
          </div>
          <div class="item-actions">
            <button class="act-btn ${item.favorite ? 'fav-active' : ''}" data-act="favorite" title="收藏">★</button>
            <button class="act-btn ${item.pinned ? 'pin-active' : ''}" data-act="pin" title="置顶">📌</button>
            <button class="act-btn act-btn-del" data-act="delete" title="删除">🗑</button>
          </div>
        </div>
        <div class="item-content">${content}</div>
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
  const itemEl = e.target.closest('.item');
  if (!itemEl) return;
  const id = itemEl.dataset.id;

  if (actBtn) {
    e.stopPropagation();
    const act = actBtn.dataset.act;
    if (act === 'favorite') {
      await window.api.toggleFavorite(id);
      showToast('已收藏');
    } else if (act === 'pin') {
      await window.api.togglePin(id);
      showToast('已置顶');
    } else if (act === 'delete') {
      await window.api.deleteItem(id);
      showToast('已删除');
    }
    await load();
    return;
  }

  // 点击卡片 = 复制
  const ok = await window.api.copyItem(id);
  if (ok) {
    showToast('已复制');
    setTimeout(() => window.close(), 200);
  }
});

// 搜索
searchInput.addEventListener('input', () => {
  currentSearch = searchInput.value.trim();
  searchClear.classList.toggle('show', !!currentSearch);
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
    render();
  });
});

// 清空
clearBtn.addEventListener('click', async () => {
  if (confirm('清空所有非置顶记录？此操作不可撤销。')) {
    await window.api.clearAll();
    await load();
    showToast('已清空');
  }
});

// 关闭/设置
closeBtn.addEventListener('click', () => window.close());
settingsBtn.addEventListener('click', () => { settingsPanel.hidden = false; });
closeSettings.addEventListener('click', () => { settingsPanel.hidden = true; });
settingsPanel.addEventListener('click', (e) => {
  if (e.target === settingsPanel) settingsPanel.hidden = true;
});

// 监听历史更新
window.api.onHistoryUpdated(() => load());

// 初始加载
load();
// 自动聚焦搜索
setTimeout(() => searchInput.focus(), 100);
