// 纪念日管家 - 渲染层逻辑
const CATEGORIES = [
  { v: 'all', label: '全部', emoji: '🗂️' },
  { v: 'family', label: '家人', emoji: '👨‍👩‍👧' },
  { v: 'friend', label: '朋友', emoji: '🤝' },
  { v: 'colleague', label: '同事', emoji: '💼' },
  { v: 'other', label: '其他', emoji: '🌟' },
];

const EVENT_TYPES = {
  birthday: { label: '生日', emoji: '🎂', color: '#ff6b8a' },
  anniversary: { label: '纪念日', emoji: '💞', color: '#ff2d55' },
  memorial: { label: '忌日', emoji: '🕊️', color: '#8e8e93' },
  custom: { label: '自定义', emoji: '📌', color: '#007aff' },
};

let allEvents = [];
let currentCat = 'all';
let currentSort = 'upcoming';
let searchKw = '';
let editingId = null;

const $ = (id) => document.getElementById(id);

// ===== 初始化 =====
async function init() {
  renderCats();
  bindEvents();
  await refresh();
  renderToday();
}

function bindEvents() {
  $('searchInput').addEventListener('input', (e) => {
    searchKw = e.target.value.trim().toLowerCase();
    renderGrid();
  });
  $('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderGrid();
  });
  $('addBtn').addEventListener('click', () => openModal());
  $('exportBtn').addEventListener('click', exportData);
  $('importBtn').addEventListener('click', importData);
  $('modalClose').addEventListener('click', closeModal);
  $('cancelBtn').addEventListener('click', closeModal);
  $('modalMask').addEventListener('click', (e) => {
    if (e.target === $('modalMask')) closeModal();
  });
  $('saveBtn').addEventListener('click', saveEvent);
  $('delBtn').addEventListener('click', deleteEvent);
  bindSeg('fType', 'eventType');
  bindSeg('fCat', 'category');
  bindSeg('fDateType', 'dateType', () => {
    $('leapWrap').hidden = getSegValue('fDateType') !== 'lunar';
  });
}

function bindSeg(containerId, fieldName, onChange) {
  const c = $(containerId);
  c.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    c.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (onChange) onChange();
  });
}

function getSegValue(containerId) {
  const active = $(containerId).querySelector('.seg-btn.active');
  return active ? active.dataset.v : null;
}

function setSegValue(containerId, v) {
  const c = $(containerId);
  c.querySelectorAll('.seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.v === v);
  });
}

// ===== 数据加载 =====
async function refresh() {
  allEvents = await window.api.list();
  renderCats();
  renderUpcoming();
  renderGrid();
}

function renderToday() {
  window.api.today().then((t) => {
    const d = new Date(t);
    const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    $('todayLabel').textContent = `今天 · ${t.replace(/-/g, '/')} · ${w}`;
  });
}

// ===== 分类列表 =====
function renderCats() {
  const counts = { all: allEvents.length };
  for (const e of allEvents) {
    counts[e.category] = (counts[e.category] || 0) + 1;
  }
  const ul = $('catList');
  ul.innerHTML = '';
  for (const c of CATEGORIES) {
    const count = counts[c.v] || 0;
    const li = document.createElement('li');
    li.className = 'cat-item' + (currentCat === c.v ? ' active' : '');
    li.innerHTML = `
      <span class="cat-emoji">${c.emoji}</span>
      <span>${c.label}</span>
      <span class="cat-count">${count}</span>
    `;
    li.addEventListener('click', () => {
      currentCat = c.v;
      renderCats();
      renderGrid();
      $('contentTitle').textContent = c.v === 'all' ? '全部纪念日' : c.label + '的纪念日';
    });
    ul.appendChild(li);
  }
  $('statTotal').textContent = `${allEvents.length} 个纪念日`;
}

// ===== 即将到来 =====
function renderUpcoming() {
  const list = [...allEvents]
    .filter((e) => e.daysUntilNext >= 0 && e.daysUntilNext <= 90)
    .sort((a, b) => a.daysUntilNext - b.daysUntilNext)
    .slice(0, 5);
  const ul = $('upcomingList');
  ul.innerHTML = '';
  if (list.length === 0) {
    ul.innerHTML = '<li style="padding:8px 10px;font-size:12px;color:var(--text-mute)">90 天内暂无</li>';
    return;
  }
  for (const e of list) {
    const li = document.createElement('li');
    li.className = 'upcoming-item';
    let daysText;
    if (e.daysUntilNext === 0) daysText = `<span class="days-num" style="color:var(--ok)">就是今天</span>`;
    else daysText = `还有 <span class="days-num">${e.daysUntilNext}</span> 天`;
    li.innerHTML = `
      <div class="up-name">${e.eventTypeEmoji} ${escapeHtml(e.name)}</div>
      <div class="up-days">${daysText}</div>
    `;
    li.addEventListener('click', () => openModal(e.id));
    ul.appendChild(li);
  }
}

// ===== 卡片网格 =====
function renderGrid() {
  let list = allEvents.slice();
  if (currentCat !== 'all') {
    list = list.filter((e) => e.category === currentCat);
  }
  if (searchKw) {
    list = list.filter((e) =>
      e.name.toLowerCase().includes(searchKw) ||
      (e.relationship || '').toLowerCase().includes(searchKw) ||
      (e.notes || '').toLowerCase().includes(searchKw)
    );
  }
  // 排序
  if (currentSort === 'upcoming') {
    list.sort((a, b) => a.daysUntilNext - b.daysUntilNext);
  } else if (currentSort === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  } else if (currentSort === 'date') {
    list.sort((a, b) => a.solarDate.localeCompare(b.solarDate));
  }
  const grid = $('cardGrid');
  grid.innerHTML = '';
  $('emptyState').hidden = list.length > 0;
  for (const e of list) {
    grid.appendChild(buildCard(e));
  }
}

function buildCard(e) {
  const type = EVENT_TYPES[e.eventType] || EVENT_TYPES.custom;
  const card = document.createElement('div');
  card.className = 'card';
  if (e.daysUntilNext === 0) card.classList.add('today');
  else if (e.daysUntilNext <= 7) card.classList.add('urgent');

  let cdNum, cdUnit, cdLabel;
  if (e.daysUntilNext === 0) {
    cdNum = '🎉 今天';
    cdUnit = '';
    cdLabel = type.label + '快乐';
  } else {
    cdNum = e.daysUntilNext;
    cdUnit = '天';
    cdLabel = `距下次${type.label}还有`;
  }

  const cdClass = e.daysUntilNext === 0 ? 'today' : (e.daysUntilNext <= 7 ? 'urgent' : '');
  const urgentBadge = '';

  const chips = [];
  if (e.eventType === 'birthday' && e.age > 0) {
    chips.push(`<span class="chip">将满 ${e.age + 1} 岁</span>`);
  } else if (e.age > 0) {
    chips.push(`<span class="chip">第 ${e.age + 1} 年</span>`);
  }
  if (e.zodiacName) chips.push(`<span class="chip">${e.zodiacEmoji} ${e.zodiacName}</span>`);

  const dateTypeLabel = e.dateType === 'lunar' ? '农历' : '公历';

  card.innerHTML = `
    <div class="card-head">
      <div>
        <div class="card-name-row">
          <span class="card-emoji">${e.eventTypeEmoji}</span>
          <span class="card-name">${escapeHtml(e.name)}</span>
        </div>
        ${e.relationship ? `<div class="card-rel">${escapeHtml(e.relationship)}</div>` : ''}
      </div>
      ${urgentBadge}
    </div>
    <div class="card-countdown">
      <span class="cd-num ${cdClass}">${cdNum}</span><span class="cd-unit">${cdUnit}</span>
      <div class="cd-label">${cdLabel}</div>
    </div>
    <div class="card-date">
      <span class="next-date">${e.nextDate.replace(/-/g, '/')} · ${e.weekday}</span>
      <span class="lunar">${dateTypeLabel} · ${e.lunarDisplay || ''}</span>
    </div>
    <div class="card-chips">${chips.join('')}</div>
  `;
  card.addEventListener('click', () => openModal(e.id));
  return card;
}

// ===== 弹窗 =====
async function openModal(id) {
  editingId = id || null;
  if (id) {
    const e = await window.api.get(id);
    if (!e) return;
    $('modalTitle').textContent = '编辑纪念日';
    $('fName').value = e.name || '';
    setSegValue('fType', e.eventType || 'custom');
    setSegValue('fCat', e.category || 'other');
    setSegValue('fDateType', e.dateType || 'solar');
    $('fDate').value = e.date || '';
    $('fLeap').checked = !!e.isLeap;
    $('fRel').value = e.relationship || '';
    $('fNotes').value = e.notes || '';
    $('delBtn').hidden = false;
    $('leapWrap').hidden = (e.dateType || 'solar') !== 'lunar';
  } else {
    $('modalTitle').textContent = '新建纪念日';
    $('fName').value = '';
    setSegValue('fType', 'birthday');
    setSegValue('fCat', 'family');
    setSegValue('fDateType', 'solar');
    $('fDate').value = '';
    $('fLeap').checked = false;
    $('fRel').value = '';
    $('fNotes').value = '';
    $('delBtn').hidden = true;
    $('leapWrap').hidden = true;
  }
  $('modalMask').hidden = false;
  setTimeout(() => $('fName').focus(), 50);
}

function closeModal() {
  $('modalMask').hidden = true;
  editingId = null;
}

async function saveEvent() {
  const name = $('fName').value.trim();
  const date = $('fDate').value;
  if (!name) { toast('请填写名称'); return; }
  if (!date) { toast('请选择日期'); return; }
  const data = {
    name,
    eventType: getSegValue('fType'),
    category: getSegValue('fCat'),
    dateType: getSegValue('fDateType'),
    date,
    isLeap: $('fLeap').checked,
    relationship: $('fRel').value.trim(),
    notes: $('fNotes').value.trim(),
  };
  try {
    if (editingId) {
      await window.api.update(editingId, data);
      toast('已保存');
    } else {
      await window.api.create(data);
      toast('已新建');
    }
    closeModal();
    await refresh();
  } catch (e) {
    toast('保存失败：' + e.message);
  }
}

async function deleteEvent() {
  if (!editingId) return;
  if (!confirm('确定删除这个纪念日吗？此操作不可撤销。')) return;
  await window.api.remove(editingId);
  toast('已删除');
  closeModal();
  await refresh();
}

// ===== 导入导出 =====
async function exportData() {
  const r = await window.api.export();
  if (r) toast('已导出到：' + r);
}

async function importData() {
  const r = await window.api.import();
  if (!r) return;
  toast(`已导入 ${r.imported} 条，共 ${r.total} 条`);
  await refresh();
}

// ===== 工具 =====
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

init();
