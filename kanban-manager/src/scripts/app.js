// 看板管家 - 渲染进程主逻辑
const Store = window.KanbanStore;
const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

const state = {
  data: null,
  currentBoardId: null,
  editing: { listId: null, cardId: null },
  search: ''
};

const PRIORITY_LABEL = { none: '无', low: '低', med: '中', high: '高' };

// 非 Electron 环境降级（Edge headless 截图、浏览器预览）
// 使用纯内存数据，避免 file:// 协议下 localStorage 限制
const isElectron = !!(window.kanbanAPI && window.kanbanAPI.readData);
if (!isElectron) {
  let _memData = null;
  window.kanbanAPI = {
    readData: async () => _memData || { boards: [], settings: { theme: 'light', accent: '#007aff' } },
    writeData: async (data) => { _memData = data; return { success: true }; },
    exportData: async (data) => ({ success: false, message: '浏览器环境不支持导出' }),
    importData: async () => ({ success: false, message: '浏览器环境不支持导入' }),
    onMenuExport: () => {},
    onMenuImport: () => {},
    onMenuAbout: (cb) => {}
  };
}

// ====== 数据持久化 ======
async function persist() {
  await window.kanbanAPI.writeData(state.data);
}

async function reload() {
  state.data = await window.kanbanAPI.readData();
  if (!state.data.boards.length) {
    const b = Store.createBoard('我的看板');
    state.data.boards.push(b);
    // 浏览器/截图环境：插入演示数据让界面有内容
    if (!isElectron) {
      insertDemoData(b);
    }
    await persist();
  }
  state.currentBoardId = state.data.boards[0].id;
  renderAll();
}

// 演示数据（截图/预览用）
function insertDemoData(board) {
  const now = Date.now();
  const day = 86400000;
  const cards = {
    todo: [
      Store.createCard('完成看板管家 v1.0 发布稿', { desc: '撰写 README 与更新日志，准备截图素材', labels: ['文档'], priority: 'high', due: new Date(now + day).toISOString() }),
      Store.createCard('调研竞品功能差异', { desc: '对比 Trello / Notion / 飞书看板', labels: ['调研', '产品'], priority: 'med', due: new Date(now + 2 * day).toISOString() }),
      Store.createCard('设计应用图标', { labels: ['设计'], priority: 'low', due: null })
    ],
    doing: [
      Store.createCard('实现拖拽排序逻辑', { desc: '支持卡片在列表间拖拽与列表内重排', labels: ['开发'], priority: 'high', due: new Date(now + 0.5 * day).toISOString() }),
      Store.createCard('苹果白样式调优', { labels: ['设计', '开发'], priority: 'med', due: null })
    ],
    done: [
      Store.createCard('搭建项目骨架', { labels: ['开发'], priority: 'med', due: null, completed: true }),
      Store.createCard('核心逻辑单元测试', { labels: ['测试'], priority: 'high', due: null, completed: true })
    ]
  };
  board.lists[0].cards = cards.todo;
  board.lists[1].cards = cards.doing;
  board.lists[2].cards = cards.done;
}

function currentBoard() {
  return state.data.boards.find(b => b.id === state.currentBoardId) || state.data.boards[0];
}

// ====== 渲染 ======
function renderAll() {
  renderBoardTabs();
  renderStatusbar();
  renderBoard();
}

function renderBoardTabs() {
  const tabs = $('#boardTabs');
  tabs.innerHTML = '';
  for (const b of state.data.boards) {
    const el = document.createElement('div');
    el.className = 'board-tab' + (b.id === state.currentBoardId ? ' active' : '');
    el.textContent = b.name;
    el.onclick = () => { state.currentBoardId = b.id; renderAll(); };
    tabs.appendChild(el);
  }
}

function renderStatusbar() {
  const s = Store.stats(currentBoard());
  $('#statusbar').innerHTML = `
    <span class="stat">📊 <span class="num">${s.total}</span> 总数</span>
    <span class="stat">⏳ <span class="num">${s.pending}</span> 待办</span>
    <span class="stat completed">✓ <span class="num">${s.completed}</span> 已完成</span>
    ${s.overdue ? `<span class="stat overdue">⚠ <span class="num">${s.overdue}</span> 已逾期</span>` : ''}
    <span style="flex:1"></span>
    <button class="btn" id="btnArchive">📦 归档已完成</button>
  `;
  $('#btnArchive').onclick = onArchive;
}

function renderBoard() {
  const board = currentBoard();
  const area = $('#boardArea');
  area.innerHTML = '';

  if (!board.lists.length) {
    area.innerHTML = `<div class="empty-state">
      <div class="icon">📋</div>
      <div class="title">这个看板还没有列表</div>
      <div class="desc">点击右侧"添加列表"开始</div>
    </div>`;
  }

  for (const list of board.lists) {
    area.appendChild(renderList(list));
  }

  // 添加列表按钮
  const addListBtn = document.createElement('button');
  addListBtn.className = 'add-list';
  addListBtn.innerHTML = '+ 添加列表';
  addListBtn.onclick = onAddList;
  area.appendChild(addListBtn);
}

function renderList(list) {
  const el = document.createElement('div');
  el.className = 'list';
  el.dataset.listId = list.id;
  el.innerHTML = `
    <div class="list-header">
      <div class="list-title" data-action="rename">${escapeHtml(list.name)}</div>
      <span class="list-count">${list.cards.length}</span>
      <div class="list-actions">
        <button class="btn-icon" data-action="add-card" title="添加卡片">＋</button>
        <button class="btn-icon danger" data-action="del-list" title="删除列表">🗑</button>
      </div>
    </div>
    <div class="cards" data-list-cards="${list.id}"></div>
    <button class="add-card-btn" data-action="add-card-bottom">+ 添加卡片</button>
  `;

  // 列表标题重命名
  const titleEl = $('.list-title', el);
  titleEl.onclick = () => startRenameList(list, titleEl);

  // 列表操作按钮
  $$('[data-action]', el).forEach(btn => {
    const action = btn.dataset.action;
    if (action === 'add-card' || action === 'add-card-bottom') {
      btn.onclick = () => openCardEditor(list.id, null);
    } else if (action === 'del-list') {
      btn.onclick = () => onDeleteList(list);
    }
  });

  // 渲染卡片
  const cardsContainer = $('[data-list-cards]', el);
  for (const card of list.cards) {
    cardsContainer.appendChild(renderCard(card, list.id));
  }

  // 拖拽目标：列表
  setupDropZone(el, list);

  return el;
}

function renderCard(card, listId) {
  const el = document.createElement('div');
  el.className = 'card' + (card.completed ? ' completed' : '');
  el.dataset.cardId = card.id;
  el.draggable = true;

  const dueInfo = formatDue(card.due);
  const labelsHtml = (card.labels || []).map(l => `<span class="label-chip">${escapeHtml(l)}</span>`).join('');

  el.innerHTML = `
    <div class="card-priority ${card.priority || 'none'}"></div>
    <div class="card-menu">
      <button data-act="edit" title="编辑">✎</button>
      <button data-act="del" title="删除">✕</button>
    </div>
    <div class="card-title">${escapeHtml(card.title)}</div>
    ${card.desc ? `<div class="card-desc">${escapeHtml(card.desc)}</div>` : ''}
    <div class="card-footer">
      ${labelsHtml}
      ${dueInfo ? `<span class="due-chip ${dueInfo.cls}">⏰ ${dueInfo.text}</span>` : ''}
    </div>
  `;

  // 卡片点击编辑
  el.onclick = (e) => {
    if (e.target.closest('[data-act]')) return;
    openCardEditor(listId, card);
  };

  // 菜单按钮
  $('[data-act="edit"]', el).onclick = (e) => { e.stopPropagation(); openCardEditor(listId, card); };
  $('[data-act="del"]', el).onclick = (e) => { e.stopPropagation(); onDeleteCard(card); };

  // 拖拽源
  el.ondragstart = (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId: card.id, fromList: listId }));
    el.classList.add('dragging');
  };
  el.ondragend = () => el.classList.remove('dragging');

  return el;
}

// ====== 拖拽 ======
function setupDropZone(listEl, list) {
  const cardsContainer = $('[data-list-cards]', listEl);

  listEl.ondragover = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    listEl.classList.add('drag-over');
  };
  listEl.ondragleave = (e) => {
    if (!listEl.contains(e.relatedTarget)) listEl.classList.remove('drag-over');
  };
  listEl.ondrop = async (e) => {
    e.preventDefault();
    listEl.classList.remove('drag-over');
    const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
    if (!data.cardId) return;

    // 计算插入位置
    const afterElement = getDragAfterElement(cardsContainer, e.clientY);
    const cards = list.cards;
    let toIndex = -1;
    if (afterElement) {
      const targetCardId = afterElement.dataset.cardId;
      toIndex = cards.findIndex(c => c.id === targetCardId);
    }
    Store.moveCard(currentBoard(), data.cardId, list.id, toIndex);
    await persist();
    renderBoard();
  };
}

function getDragAfterElement(container, y) {
  const els = $$('.card:not(.dragging)', container);
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: -Infinity }).element;
}

// ====== 列表操作 ======
function startRenameList(list, titleEl) {
  const input = document.createElement('input');
  input.className = 'list-title-input';
  input.value = list.name;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  const commit = async () => {
    const newName = input.value.trim() || list.name;
    Store.renameList(currentBoard(), list.id, newName);
    await persist();
    renderBoard();
  };
  input.onblur = commit;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') renderBoard();
  };
}

async function onAddList() {
  const list = Store.addList(currentBoard(), '新列表');
  await persist();
  renderBoard();
  // 自动进入重命名
  setTimeout(() => {
    const els = $$(`.list[data-list-id="${list.id}"] .list-title`);
    if (els[0]) els[0].click();
  }, 50);
}

async function onDeleteList(list) {
  if (!confirm(`确定删除列表「${list.name}」及其 ${list.cards.length} 张卡片？`)) return;
  Store.deleteList(currentBoard(), list.id);
  await persist();
  renderAll();
}

// ====== 卡片编辑器 ======
function openCardEditor(listId, card) {
  const isNew = !card;
  const data = card ? { ...card } : Store.createCard('', { labels: [], priority: 'none' });
  const labels = [...(data.labels || [])];

  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${isNew ? '新建卡片' : '编辑卡片'}</div>
        <button class="btn btn-icon" data-act="close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">标题 *</label>
          <input class="form-input" id="cardTitle" value="${escapeAttr(data.title)}" placeholder="卡片标题" />
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea class="form-textarea" id="cardDesc" placeholder="添加更详细的描述...">${escapeHtml(data.desc || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">标签（回车添加）</label>
          <div class="labels-input" id="labelsInput">
            <input id="labelInput" placeholder="输入后回车" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">截止日期</label>
          <input class="form-input" type="datetime-local" id="cardDue" value="${data.due ? toLocalInput(data.due) : ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">优先级</label>
          <div class="priority-pills">
            ${['none', 'low', 'med', 'high'].map(p => `
              <div class="priority-pill ${data.priority === p ? 'active' : ''}" data-priority="${p}">${PRIORITY_LABEL[p]}</div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${card ? `<button class="btn" data-act="delete" style="margin-right:auto;color:var(--danger)">删除</button>` : ''}
        <button class="btn" data-act="cancel">取消</button>
        <button class="btn btn-primary" data-act="save">保存</button>
      </div>
    </div>
  `;
  $('#modalContainer').appendChild(modal);

  let priority = data.priority || 'none';

  // 标签输入
  const labelsInput = $('#labelsInput');
  const labelInput = $('#labelInput');
  function renderLabels() {
    Array.from(labelsInput.querySelectorAll('.label-tag')).forEach(n => n.remove());
    labels.forEach((l, i) => {
      const tag = document.createElement('span');
      tag.className = 'label-tag';
      tag.innerHTML = `${escapeHtml(l)} <span class="x" data-i="${i}">×</span>`;
      tag.querySelector('.x').onclick = () => { labels.splice(i, 1); renderLabels(); };
      labelsInput.insertBefore(tag, labelInput);
    });
  }
  renderLabels();
  labelInput.onkeydown = (e) => {
    if (e.key === 'Enter' && labelInput.value.trim()) {
      e.preventDefault();
      labels.push(labelInput.value.trim());
      labelInput.value = '';
      renderLabels();
    } else if (e.key === 'Backspace' && !labelInput.value && labels.length) {
      labels.pop();
      renderLabels();
    }
  };
  labelInput.onclick = () => labelInput.focus();

  // 优先级选择
  $$('.priority-pill', modal).forEach(p => {
    p.onclick = () => {
      $$('.priority-pill', modal).forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      priority = p.dataset.priority;
    };
  });

  // 关闭
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  $('[data-act="close"]', modal).onclick = closeModal;
  $('[data-act="cancel"]', modal).onclick = closeModal;
  $('[data-act="save"]', modal).onclick = async () => {
    const title = $('#cardTitle', modal).value.trim();
    if (!title) { toast('请输入卡片标题', 'error'); return; }
    const desc = $('#cardDesc', modal).value.trim();
    const due = $('#cardDue', modal).value;
    data.title = title;
    data.desc = desc;
    data.labels = labels;
    data.priority = priority;
    data.due = due ? new Date(due).toISOString() : null;
    if (isNew) {
      Store.addCardToList(currentBoard(), listId, data);
    } else {
      Store.updateCard(currentBoard(), data.id, {
        title, desc, labels, priority, due: data.due
      });
    }
    await persist();
    closeModal();
    renderAll();
  };
  if (card) {
    $('[data-act="delete"]', modal).onclick = async () => {
      if (!confirm('确定删除这张卡片？')) return;
      Store.deleteCard(currentBoard(), card.id);
      await persist();
      closeModal();
      renderAll();
    };
  }
  $('#cardTitle', modal).focus();
}

function closeModal() { $('#modalContainer').innerHTML = ''; }

async function onDeleteCard(card) {
  if (!confirm(`删除卡片「${card.title}」？`)) return;
  Store.deleteCard(currentBoard(), card.id);
  await persist();
  renderAll();
}

async function onArchive() {
  const n = Store.archiveCompleted(currentBoard());
  await persist();
  renderAll();
  toast(n ? `已归档 ${n} 张已完成卡片` : '没有已完成的卡片', n ? 'success' : 'warn');
}

// ====== 新建看板 ======
async function onAddBoard() {
  const name = prompt('新建看板名称：', '我的看板 ' + (state.data.boards.length + 1));
  if (!name || !name.trim()) return;
  const b = Store.createBoard(name.trim());
  state.data.boards.push(b);
  state.currentBoardId = b.id;
  await persist();
  renderAll();
}

// ====== 搜索 ======
function onSearch(keyword) {
  state.search = keyword;
  const results = Store.searchCards(currentBoard(), keyword);
  const box = $('#searchResults');
  if (!keyword.trim()) { box.classList.remove('show'); return; }
  box.classList.add('show');
  if (!results.length) {
    box.innerHTML = `<div class="search-item"><div class="search-item-title" style="color:var(--text-3)">无匹配结果</div></div>`;
    return;
  }
  box.innerHTML = results.map(r => {
    const title = highlight(r.card.title, keyword);
    return `<div class="search-item" data-card-id="${r.card.id}">
      <div class="search-item-title">${title}</div>
      <div class="search-item-meta">在「${escapeHtml(r.listName)}」</div>
    </div>`;
  }).join('');
  $$('.search-item[data-card-id]', box).forEach(item => {
    item.onclick = () => {
      const cardEl = $(`.card[data-card-id="${item.dataset.cardId}"]`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardEl.style.outline = '2px solid var(--accent)';
        setTimeout(() => cardEl.style.outline = '', 1600);
      }
      box.classList.remove('show');
      $('#searchInput').value = '';
    };
  });
}

// ====== 工具函数 ======
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }

function formatDue(due) {
  if (!due) return null;
  const d = new Date(due);
  const now = new Date();
  const diff = d - now;
  const day = 86400000;
  let cls = '', text;
  if (diff < 0) { cls = 'overdue'; text = '已逾期 · ' + formatDate(d); }
  else if (diff < day) { cls = 'soon'; text = '即将到期 · ' + formatDate(d); }
  else { text = formatDate(d); }
  return { cls, text };
}

function formatDate(d) {
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const m = d.getMonth() + 1, day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return sameYear ? `${m}月${day}日 ${hh}:${mm}` : `${d.getFullYear()}年${m}月${day}日 ${hh}:${mm}`;
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function highlight(text, kw) {
  if (!kw) return escapeHtml(text);
  const esc = escapeHtml(text);
  const re = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return esc.replace(re, '<mark>$1</mark>');
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 2200);
  setTimeout(() => el.remove(), 2600);
}

// ====== 关于 ======
function openAbout() {
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = `
    <div class="modal about-modal">
      <div class="modal-body" style="padding:32px 24px">
        <div class="about-logo">▦</div>
        <div class="modal-title">看板管家</div>
        <div class="about-version">版本 1.0.0</div>
        <div class="about-desc">苹果白风格的本地优先看板任务管理工具<br>支持拖拽、标签、截止日期、归档与导入导出</div>
        <a class="about-link" id="afdianLink">☕ 爱发电支持我们</a>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" data-act="close">关闭</button>
      </div>
    </div>
  `;
  $('#modalContainer').appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  $('[data-act="close"]', modal).onclick = closeModal;
  $('#afdianLink', modal).onclick = (e) => {
    e.preventDefault();
    window.open('https://www.ifdian.net/a/giquwei', '_blank');
  };
}

// ====== 导入导出 ======
async function onExport() {
  const res = await window.kanbanAPI.exportData(state.data);
  if (res.success) toast('已导出到：' + res.filePath, 'success');
  else if (res.message !== '取消导出') toast('导出失败：' + res.message, 'error');
}

async function onImport() {
  const res = await window.kanbanAPI.importData();
  if (!res.success) {
    if (res.message !== '取消导入') toast('导入失败：' + res.message, 'error');
    return;
  }
  const errors = Store.validate(res.data);
  if (errors.length) { toast('数据校验失败：' + errors[0], 'error'); return; }
  if (!confirm('导入将覆盖当前所有数据，确定继续？')) return;
  state.data = res.data;
  await persist();
  state.currentBoardId = state.data.boards[0]?.id;
  renderAll();
  toast('导入成功', 'success');
}

// ====== 事件绑定 ======
$('#btnAddBoard').onclick = onAddBoard;
$('#btnExport').onclick = onExport;
$('#btnImport').onclick = onImport;
$('#btnAbout').onclick = openAbout;
$('#searchInput').oninput = (e) => onSearch(e.target.value);
$('#searchInput').onblur = () => setTimeout(() => $('#searchResults').classList.remove('show'), 200);

// 菜单事件
window.kanbanAPI.onMenuExport(() => onExport());
window.kanbanAPI.onMenuImport(() => onImport());
window.kanbanAPI.onMenuAbout(() => openAbout());

// 启动
reload().catch(err => toast('初始化失败：' + err.message, 'error'));
