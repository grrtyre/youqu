// 便签管家 - 渲染层逻辑
'use strict';

const COLORS = {
  default: { hex: '#f5f5f7', dot: '#c7c7cc' },
  blue:    { hex: '#e3f0ff', dot: '#007aff' },
  green:   { hex: '#e8f8ec', dot: '#34c759' },
  yellow:  { hex: '#fff9e0', dot: '#ffcc00' },
  orange:  { hex: '#fff0e0', dot: '#ff9500' },
  pink:    { hex: '#ffe8ef', dot: '#ff2d55' },
  purple:  { hex: '#f3e8ff', dot: '#af52de' }
};

const CATEGORIES = ['工作', '个人', '灵感', '待办', '其他'];

// === SVG 图标库（用于确认弹窗、空状态、卡片置顶按钮等） ===
const ICON_SVG = {
  // 确认弹窗图标
  info:  '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#e3f0ff"/><circle cx="16" cy="16" r="14" stroke="#007aff" stroke-width="1.5"/><path d="M16 9V18" stroke="#007aff" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="23" r="1.5" fill="#007aff"/></svg>',
  warn:  '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#fff0f0"/><circle cx="16" cy="16" r="14" stroke="#ff3b30" stroke-width="1.5"/><path d="M16 9V19" stroke="#ff3b30" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="23" r="1.5" fill="#ff3b30"/></svg>',
  // 空状态：便签图标（默认空）
  notes: '<svg width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="12" y="16" width="40" height="36" rx="6" stroke="#d1d1d6" stroke-width="2.5"/><path d="M20 16V12C20 9.79 21.79 8 24 8H40C42.21 8 44 9.79 44 12V16" stroke="#d1d1d6" stroke-width="2.5"/><line x1="22" y1="30" x2="42" y2="30" stroke="#d1d1d6" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="38" x2="34" y2="38" stroke="#d1d1d6" stroke-width="2" stroke-linecap="round"/></svg>',
  // 空状态：回收站空
  trash: '<svg width="64" height="64" viewBox="0 0 64 64" fill="none"><path d="M14 18H50M22 18V14C22 11.79 23.79 10 26 10H38C40.21 10 42 11.79 42 14V18M20 18L21 50C21.1 53.3 23.7 56 27 56H37C40.3 56 42.9 53.3 43 50L44 18" stroke="#d1d1d6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="28" y1="30" x2="28" y2="46" stroke="#d1d1d6" stroke-width="2" stroke-linecap="round"/><line x1="36" y1="30" x2="36" y2="46" stroke="#d1d1d6" stroke-width="2" stroke-linecap="round"/></svg>',
  // 空状态：无搜索结果（放大镜）
  search: '<svg width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="26" cy="26" r="14" stroke="#d1d1d6" stroke-width="2.5"/><line x1="36" y1="36" x2="50" y2="50" stroke="#d1d1d6" stroke-width="2.5" stroke-linecap="round"/><line x1="20" y1="26" x2="32" y2="26" stroke="#d1d1d6" stroke-width="2" stroke-linecap="round"/></svg>'
};

// 分类对应颜色（与侧边栏一致，标签文字用降低饱和度版）
const CATEGORY_COLORS = {
  '工作': '#0066cc',
  '个人': '#1a8a3e',
  '灵感': '#b89500',
  '待办': '#cc3b30',
  '其他': '#6e6e73'
};
// 分类对应浅色背景（卡片标签用）
const CATEGORY_BG = {
  '工作': '#eef4ff',
  '个人': '#f0fbf3',
  '灵感': '#fffdec',
  '待办': '#fff0f0',
  '其他': '#f5f5f7'
};
let notes = [];
let trash = [];
let currentView = 'notes'; // 'notes' | 'trash'
let currentCategory = '全部';
let currentSearch = '';
let editingNoteId = null;
let editingCategory = '其他';
let editingColor = 'default';

// DOM 元素
const notesGrid = document.getElementById('notesGrid');
const trashList = document.getElementById('trashList');
const emptyState = document.getElementById('emptyState');
const mainTitle = document.getElementById('mainTitle');
const searchInput = document.getElementById('searchInput');
const newNoteBtn = document.getElementById('newNoteBtn');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const trashEntry = document.getElementById('trashEntry');
const emptyTrashBtn = document.getElementById('emptyTrashBtn');
const sortInfo = document.getElementById('sortInfo');

// 弹窗元素
const modalOverlay = document.getElementById('modalOverlay');
const editTitle = document.getElementById('editTitle');
const editContent = document.getElementById('editContent');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const charCount = document.getElementById('charCount');
const categoryOptions = document.getElementById('categoryOptions');
const colorOptions = document.getElementById('colorOptions');
const searchClearBtn = document.getElementById('searchClearBtn');

// 自定义确认弹窗元素
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmIcon = document.getElementById('confirmIcon');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmOkBtn = document.getElementById('confirmOkBtn');

// === 时间格式化 ===
function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) {
    return m + '月' + day + '日';
  }
  return d.getFullYear() + '/' + m + '/' + day;
}

// === 回收站剩余天数 ===
const TRASH_MAX_DAYS = 30;
function getDaysLeft(deletedAt) {
  const now = Date.now();
  const maxAgeMs = TRASH_MAX_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = now - deletedAt;
  const left = Math.ceil((maxAgeMs - elapsed) / (24 * 60 * 60 * 1000));
  return left < 0 ? 0 : left;
}

// === 转义 HTML ===
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// === 总渲染入口：根据当前视图分发 ===
function render() {
  if (currentView === 'trash') {
    renderTrash();
  } else {
    renderNotes();
  }
  updateStats();
  updateViewControls();
}

// 控制各视图容器的显隐与按钮
function updateViewControls() {
  if (currentView === 'trash') {
    notesGrid.style.display = 'none';
    trashList.style.display = 'flex';
    emptyTrashBtn.style.display = trash.length > 0 ? 'inline-flex' : 'none';
    sortInfo.style.display = 'none';
    newNoteBtn.style.opacity = '0.5';
    newNoteBtn.style.pointerEvents = 'none';
    searchInput.disabled = true;
    searchInput.placeholder = '回收站中不支持搜索';
    searchInput.value = '';
    currentSearch = ''; // 同步清空搜索状态，避免返回便签视图时输入框空但列表仍被过滤
    searchClearBtn.style.display = 'none'; // 同步隐藏清除按钮
  } else {
    trashList.style.display = 'none';
    notesGrid.style.display = 'grid';
    emptyTrashBtn.style.display = 'none';
    sortInfo.style.display = 'block';
    newNoteBtn.style.opacity = '1';
    newNoteBtn.style.pointerEvents = 'auto';
    searchInput.disabled = false;
    searchInput.placeholder = '搜索便签...';
    // 恢复清除按钮的可见性（基于当前搜索值）
    searchClearBtn.style.display = currentSearch ? 'flex' : 'none';
  }
}

// === 渲染便签列表 ===
function renderNotes() {
  let filtered = notes;

  // 分类筛选
  if (currentCategory !== '全部') {
    filtered = filtered.filter(n => n.category === currentCategory);
  }

  // 搜索
  if (currentSearch) {
    const kw = currentSearch.toLowerCase();
    filtered = filtered.filter(n =>
      (n.title || '').toLowerCase().includes(kw) ||
      (n.content || '').toLowerCase().includes(kw)
    );
  }

  // 排序：置顶优先 → 更新时间倒序
  filtered = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    return b.updatedAt - a.updatedAt;
  });

  // 更新标题
  mainTitle.textContent = currentCategory === '全部' ? '全部便签' : currentCategory + '便签';

  // 渲染
  if (filtered.length === 0) {
    notesGrid.style.display = 'none';
    emptyState.style.display = 'flex';
    const emptyIconEl = document.getElementById('emptyIcon');
    if (currentSearch) {
      emptyState.querySelector('.empty-title').textContent = '没有找到便签';
      emptyState.querySelector('.empty-desc').textContent = '试试其他关键词，或点击右侧清除按钮';
      if (emptyIconEl) emptyIconEl.innerHTML = ICON_SVG.search;
    } else {
      emptyState.querySelector('.empty-title').textContent = '还没有便签';
      emptyState.querySelector('.empty-desc').textContent = '点击「新建便签」开始记录你的想法';
      if (emptyIconEl) emptyIconEl.innerHTML = ICON_SVG.notes;
    }
  } else {
    notesGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    notesGrid.innerHTML = filtered.map(n => {
      const color = COLORS[n.color] || COLORS.default;
      // 置顶按钮：放在卡片右上角，可见+可点击，与右键快捷方式等价
      // pinned 状态下始终显示；未 pinned 状态下 hover 才显示
      const pinBtnClass = n.pinned ? 'note-pin-btn pinned' : 'note-pin-btn';
      const pinTitle = n.pinned ? '点击取消置顶' : '点击置顶 · 也可右键卡片';
      const pinBtnHtml = `
        <button class="${pinBtnClass}" data-id="${n.id}" title="${pinTitle}" aria-label="${n.pinned ? '取消置顶' : '置顶'}" aria-pressed="${n.pinned}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M7 0.5L8.8 4.5L13 5L10 8L10.5 12.5L7 10.5L3.5 12.5L4 8L1 5L5.2 4.5L7 0.5Z"/>
          </svg>
        </button>`;
      const titleHtml = n.title
        ? `<div class="note-title">${escapeHtml(n.title)}</div>`
        : `<div class="note-title" style="color:var(--text-tertiary);font-weight:400;">无标题</div>`;
      const contentHtml = n.content
        ? `<div class="note-content-preview">${escapeHtml(n.content)}</div>`
        : `<div class="note-content-preview" style="color:var(--text-tertiary);font-style:italic;">空便签</div>`;
      return `
        <div class="note-card" data-id="${n.id}" tabindex="0" style="border-left-color:${color.dot}">
          ${pinBtnHtml}
          <div class="note-card-header">
            ${titleHtml}
          </div>
          ${contentHtml}
          <div class="note-card-footer">
            <span class="note-category">${escapeHtml(n.category)}</span>
            <span class="note-date">${formatDate(n.updatedAt)}</span>
          </div>
        </div>`;
    }).join('');

    // 绑定点击事件
    notesGrid.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // 如果点击的是置顶按钮，不打开编辑弹窗
        if (e.target.closest('.note-pin-btn')) return;
        openEditModal(card.dataset.id);
      });
      // 键盘支持：Enter / Space 打开
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEditModal(card.dataset.id);
        }
      });
      // 右键切换置顶
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        togglePin(card.dataset.id);
      });
    });
    // 置顶按钮点击：切换置顶状态（不打开编辑弹窗）
    notesGrid.querySelectorAll('.note-pin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePin(btn.dataset.id);
      });
    });
  }
}

// === 渲染回收站列表 ===
function renderTrash() {
  mainTitle.textContent = '回收站';
  // 回收站按删除时间倒序
  const sorted = [...trash].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

  if (sorted.length === 0) {
    trashList.style.display = 'none';
    emptyState.style.display = 'flex';
    emptyState.querySelector('.empty-title').textContent = '回收站为空';
    emptyState.querySelector('.empty-desc').textContent = '删除的便签会暂存于此，30 天后自动清理';
    const emptyIconEl = document.getElementById('emptyIcon');
    if (emptyIconEl) emptyIconEl.innerHTML = ICON_SVG.trash;
  } else {
    emptyState.style.display = 'none';
    trashList.style.display = 'flex';
    trashList.innerHTML = sorted.map(n => {
      const color = COLORS[n.color] || COLORS.default;
      const daysLeft = getDaysLeft(n.deletedAt);
      // 按剩余天数分级显示紧急程度：≤1 天红色、≤3 天橙色、其余灰色
      const daysClass = daysLeft <= 1 ? 'trash-days-urgent' : (daysLeft <= 3 ? 'trash-days-warn' : 'trash-days');
      const titleHtml = n.title
        ? `<div class="trash-item-title">${escapeHtml(n.title)}</div>`
        : `<div class="trash-item-title" style="color:var(--text-tertiary);font-weight:400;">无标题</div>`;
      const contentHtml = n.content
        ? `<div class="trash-item-content">${escapeHtml(n.content)}</div>`
        : `<div class="trash-item-content" style="color:var(--text-tertiary);font-style:italic;">空便签</div>`;
      return `
        <div class="trash-row" data-id="${n.id}" style="border-left-color:${color.dot}">
          <div class="trash-row-main">
            ${titleHtml}
            ${contentHtml}
            <div class="trash-row-meta">
              <span class="trash-cat">${escapeHtml(n.category)}</span>
              <span class="trash-deleted">删除于 ${formatDate(n.deletedAt)}</span>
              <span class="${daysClass}">${daysLeft} 天后自动清理</span>
            </div>
          </div>
          <div class="trash-row-actions">
            <button class="trash-restore-btn" data-id="${n.id}" title="恢复到便签列表" aria-label="恢复便签">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8C3 5.24 5.24 3 8 3C10.76 3 13 5.24 13 8C13 10.76 10.76 13 8 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M5 3L3 5L5 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              恢复
            </button>
            <button class="trash-delete-btn" data-id="${n.id}" title="彻底删除（不可恢复）" aria-label="彻底删除便签">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 4H13M6 4V3C6 2.45 6.45 2 7 2H9C9.55 2 10 2.45 10 3V4M5 4L5.5 13C5.55 13.83 6.17 14 7 14H9C9.83 14 10.45 13.83 10.5 13L11 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              删除
            </button>
          </div>
        </div>`;
    }).join('');

    // 绑定恢复 / 彻底删除
    trashList.querySelectorAll('.trash-restore-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        restoreNote(btn.dataset.id);
      });
    });
    trashList.querySelectorAll('.trash-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFromTrash(btn.dataset.id);
      });
    });
  }
}

// === 更新统计 ===
function updateStats() {
  document.getElementById('statTotal').textContent = notes.length;
  document.getElementById('statPinned').textContent = notes.filter(n => n.pinned).length;

  // 分类计数
  CATEGORIES.forEach(cat => {
    const el = document.getElementById('count-' + cat);
    if (el) el.textContent = notes.filter(n => n.category === cat).length;
  });
  const allEl = document.getElementById('count-全部');
  if (allEl) allEl.textContent = notes.length;

  // 回收站计数
  const trashEl = document.getElementById('count-trash');
  if (trashEl) trashEl.textContent = trash.length;

  // 字数
  let totalWords = 0;
  notes.forEach(n => {
    const text = (n.title + ' ' + n.content).trim();
    const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const english = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
    totalWords += chinese + english;
  });
  document.getElementById('statWords').textContent = totalWords;
}

// === 打开编辑弹窗 ===
function openEditModal(id) {
  editingNoteId = id;
  const note = notes.find(n => n.id === id);
  if (note) {
    editTitle.value = note.title || '';
    editContent.value = note.content || '';
    editingCategory = note.category || '其他';
    editingColor = note.color || 'default';
    deleteBtn.style.display = 'inline-block';
  } else {
    editTitle.value = '';
    editContent.value = '';
    editingCategory = '其他';
    editingColor = 'default';
    deleteBtn.style.display = 'none';
  }
  updateMetaSelection();
  updateCharCount();
  modalOverlay.style.display = 'flex';
  setTimeout(() => editTitle.focus(), 100);
}

// 检测编辑弹窗中是否有未保存的内容
function hasUnsavedChanges() {
  const title = editTitle.value.trim();
  const content = editContent.value.trim();
  if (!title && !content) return false; // 空内容无需提示
  if (editingNoteId) {
    const note = notes.find(n => n.id === editingNoteId);
    if (note) {
      return title !== (note.title || '') ||
             content !== (note.content || '') ||
             editingCategory !== (note.category || '其他') ||
             editingColor !== (note.color || 'default');
    }
  }
  return true; // 新建便签且已输入内容
}
async function closeModal(force) {
  if (!force && hasUnsavedChanges()) {
    const ok = await showConfirm({
      title: '有未保存的内容',
      message: '关闭后未保存的内容将丢失，确定要关闭吗？',
      okText: '关闭',
      cancelText: '继续编辑',
      danger: true,
      icon: 'warn'
    });
    if (!ok) return;
  }
  modalOverlay.style.display = 'none';
  editingNoteId = null;
}

function updateMetaSelection() {
  categoryOptions.querySelectorAll('.meta-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.cat === editingCategory);
  });
  colorOptions.querySelectorAll('.color-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === editingColor);
  });
}

function updateCharCount() {
  const text = editTitle.value + editContent.value;
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const english = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
  charCount.textContent = (chinese + english) + ' 字';
  updateSaveButtonState();
}

// 保存按钮禁用态：标题与正文都为空时禁用
function updateSaveButtonState() {
  const isEmpty = !editTitle.value.trim() && !editContent.value.trim();
  saveBtn.disabled = isEmpty;
}

// === 保存便签 ===
async function saveNote() {
  const title = editTitle.value.trim();
  const content = editContent.value.trim();

  // 双重保险：禁用态被绕过时也阻止
  if (!title && !content) {
    showToast('请输入标题或内容');
    return;
  }

  if (editingNoteId) {
    // 更新
    notes = notes.map(n => {
      if (n.id === editingNoteId) {
        return {
          ...n,
          title: title,
          content: content,
          category: editingCategory,
          color: editingColor,
          updatedAt: Date.now()
        };
      }
      return n;
    });
  } else {
    // 新增
    const newNote = {
      id: 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      title: title,
      content: content,
      color: editingColor,
      category: editingCategory,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    notes.unshift(newNote);
  }

  await window.notesAPI.save(notes, trash);
  const wasUpdating = !!editingNoteId;
  closeModal(true);
  render();
  showToast(wasUpdating ? '已保存' : '已创建');
}

// === 删除便签（移入回收站） ===
async function deleteNote() {
  if (!editingNoteId) return;
  const note = notes.find(n => n.id === editingNoteId);
  if (note) {
    // 移入回收站：加 deletedAt，取消置顶
    trash.unshift({ ...note, pinned: false, deletedAt: Date.now() });
  }
  notes = notes.filter(n => n.id !== editingNoteId);
  await window.notesAPI.save(notes, trash);
  closeModal(true);
  render();
  showToast('已移入回收站');
}

// === 切换置顶 ===
async function togglePin(id) {
  notes = notes.map(n => {
    if (n.id === id) {
      return { ...n, pinned: !n.pinned, updatedAt: n.updatedAt };
    }
    return n;
  });
  await window.notesAPI.save(notes, trash);
  render();
  const note = notes.find(n => n.id === id);
  showToast(note && note.pinned ? '已置顶' : '已取消置顶');
}

// === 从回收站恢复 ===
async function restoreNote(id) {
  const result = await window.notesAPI.restoreFromTrash(id);
  if (result.success) {
    notes = result.notes;
    trash = result.trash;
    render();
    showToast('已恢复');
  }
}

// === 从回收站彻底删除（二次确认，防误操作） ===
async function deleteFromTrash(id) {
  const note = trash.find(n => n.id === id);
  const name = note && note.title ? '「' + note.title + '」' : '该便签';
  const ok = await showConfirm({
    title: '彻底删除便签',
    message: '确定要彻底删除' + name + '吗？此操作不可恢复，删除后无法找回。',
    okText: '彻底删除',
    cancelText: '取消',
    danger: true,
    icon: 'warn'
  });
  if (!ok) return;
  const result = await window.notesAPI.deleteFromTrash(id);
  trash = result.trash;
  render();
  showToast('已彻底删除');
}

// === 清空回收站（二次确认，防误操作） ===
async function emptyTrash() {
  if (trash.length === 0) return;
  const ok = await showConfirm({
    title: '清空回收站',
    message: '共 ' + trash.length + ' 条便签将被永久删除，此操作不可恢复。',
    okText: '清空回收站',
    cancelText: '取消',
    danger: true,
    icon: 'warn'
  });
  if (!ok) return;
  const result = await window.notesAPI.emptyTrash();
  trash = result.trash;
  render();
  showToast('回收站已清空');
}

// === Toast ===
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 2000);
}

// === 自定义确认弹窗（Promise，替代原生 confirm，保持苹果白风格一致） ===
// options: { title, message, okText, cancelText, danger (bool), icon }
let confirmResolveFn = null;
function showConfirm(opts) {
  return new Promise((resolve) => {
    confirmTitle.textContent = opts.title || '确认';
    // 消息支持换行
    confirmMessage.textContent = opts.message || '';
    confirmOkBtn.textContent = opts.okText || '确定';
    confirmCancelBtn.textContent = opts.cancelText || '取消';

    // 危险操作样式
    if (opts.danger) {
      confirmOkBtn.classList.add('danger');
      confirmIcon.classList.add('danger');
      confirmIcon.classList.remove('info');
    } else {
      confirmOkBtn.classList.remove('danger');
      confirmIcon.classList.remove('danger');
      confirmIcon.classList.add('info');
    }

    // 注入图标（默认问号 / 警告三角 / 信息）
    const iconType = opts.icon || (opts.danger ? 'warn' : 'info');
    confirmIcon.innerHTML = ICON_SVG[iconType] || ICON_SVG.info;

    confirmOverlay.style.display = 'flex';
    // 自动聚焦确认按钮以便键盘操作
    setTimeout(() => confirmOkBtn.focus(), 50);
    confirmResolveFn = resolve;
  });
}

function resolveConfirm(result) {
  confirmOverlay.style.display = 'none';
  const fn = confirmResolveFn;
  confirmResolveFn = null;
  if (fn) fn(result);
}

confirmCancelBtn.addEventListener('click', () => resolveConfirm(false));
confirmOkBtn.addEventListener('click', () => resolveConfirm(true));
// 点击遮罩 = 取消
confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) resolveConfirm(false);
});
// Esc 取消
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && confirmOverlay.style.display === 'flex') {
    resolveConfirm(false);
  }
});

// === 事件绑定 ===
newNoteBtn.addEventListener('click', () => {
  editingNoteId = null;
  openEditModal(null);
});

searchInput.addEventListener('input', (e) => {
  if (currentView === 'trash') return; // 回收站不支持搜索
  currentSearch = e.target.value;
  // 显示/隐藏清除按钮
  searchClearBtn.style.display = currentSearch ? 'flex' : 'none';
  render();
});

// 清除搜索按钮：点击后清空搜索框 + 隐藏按钮 + 重新聚焦输入框
searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  currentSearch = '';
  searchClearBtn.style.display = 'none';
  render();
  searchInput.focus();
});

// Ctrl+F 聚焦搜索框（应用内快捷键）
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
    if (currentView !== 'trash' && modalOverlay.style.display !== 'flex') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  }
});

document.querySelectorAll('.category-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    currentCategory = item.dataset.category;
    currentView = 'notes'; // 切换分类时回到便签视图
    render();
  });
});

// 回收站入口
trashEntry.addEventListener('click', () => {
  document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
  trashEntry.classList.add('active');
  currentView = 'trash';
  render();
});

// 清空回收站
emptyTrashBtn.addEventListener('click', () => {
  emptyTrash();
});

modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

saveBtn.addEventListener('click', saveNote);
deleteBtn.addEventListener('click', deleteNote);

editTitle.addEventListener('input', updateCharCount);
editContent.addEventListener('input', updateCharCount);

// Ctrl+Enter 保存（标题与正文均支持）
function ctrlEnterSave(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (saveBtn.disabled) {
      showToast('请输入标题或内容');
      return;
    }
    saveNote();
  }
}
editContent.addEventListener('keydown', ctrlEnterSave);
editTitle.addEventListener('keydown', ctrlEnterSave);

// Esc 关闭弹窗
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.style.display === 'flex') {
    closeModal();
  }
});

// 分类选择
categoryOptions.querySelectorAll('.meta-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    editingCategory = btn.dataset.cat;
    updateMetaSelection();
  });
});

// 颜色选择
colorOptions.querySelectorAll('.color-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    editingColor = btn.dataset.color;
    updateMetaSelection();
  });
});

// 导入导出
importBtn.addEventListener('click', async () => {
  const result = await window.notesAPI.importNotes();
  if (result.success) {
    notes = result.notes;
    currentView = 'notes';
    render();
    showToast('导入成功');
  } else if (result.error) {
    showToast('导入失败：' + result.error);
  }
});

exportBtn.addEventListener('click', async () => {
  const result = await window.notesAPI.exportNotes(notes);
  if (result.success) {
    showToast('已导出到 ' + result.path);
  }
});

// 全局快捷键回调
window.notesAPI.onAction((action) => {
  if (action === 'new-note') {
    editingNoteId = null;
    openEditModal(null);
  }
});

// === 初始化 ===
async function init() {
  const data = await window.notesAPI.load();
  notes = data.notes || [];
  trash = data.trash || [];
  render();
}

init();
