// renderer.js - 渲染进程逻辑
let appData = { subscriptions: [], settings: { currency: 'CNY', reminderDays: 3 } };
let editingId = null;

// SVG 图标（统一矢量风格）
const CATEGORY_SVGS = {
  '流媒体': '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="4" width="16" height="11" rx="2"/><path d="M7 17h6l-1 2H8z"/></svg>',
  '软件工具': '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M14.2 2.8l3 3-9 9-4 1 1-4 9-9z"/></svg>',
  '云服务': '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M5 14a4 4 0 010-8 5 5 0 019.6-1A4 4 0 0115 14H5z"/></svg>',
  '会员': '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.3 4.8 17l1-5.8L1.6 7.1l5.8-.8z"/></svg>',
  '音乐': '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2v10.5a3 3 0 10-2 2.8V4h8V2H8z"/></svg>',
  '游戏': '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M3 8a4 4 0 014-4h6a4 4 0 014 4v4a3 3 0 01-5.5 1.7L10 12h0l-1.5 1.7A3 3 0 013 12V8zm1 1v1h2v2h1v-2h2V9H7V7H6v2H4z"/><circle cx="14" cy="9" r="1"/><circle cx="15.5" cy="11" r="1"/></svg>',
  '学习': '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2L1 6l9 4 7-3.1V13h1V6L10 2zM3 9.5V14c0 1.7 3.1 3 7 3s7-1.3 7-3V9.5l-7 3.1-7-3.1z"/></svg>',
  '其他': '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></svg>'
};
const CATEGORY_COLORS = [
  '#007aff', '#34c759', '#ff9500', '#af52de',
  '#ff3b30', '#5ac8fa', '#ffcc00', '#64d2ff'
];

// 初始化
async function init() {
  appData = await window.subAPI.getAll();
  if (!appData.subscriptions) appData.subscriptions = [];
  if (!appData.settings) appData.settings = { currency: 'CNY', reminderDays: 3 };

  // 注入演示数据（首次启动）
  if (appData.subscriptions.length === 0) {
    appData.subscriptions = getDemoData();
    await window.subAPI.save(appData);
  }

  bindEvents();
  renderAll();
}

function getDemoData() {
  const today = new Date();
  const offset = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  return [
    { id: 'd1', name: 'Netflix', price: 68, cycle: 'monthly', startDate: offset(-25), category: '流媒体', note: '标准套餐', active: true },
    { id: 'd2', name: 'Spotify', price: 11, cycle: 'monthly', startDate: offset(-28), category: '音乐', note: '个人版', active: true },
    { id: 'd3', name: 'iCloud+', price: 21, cycle: 'monthly', startDate: offset(-2), category: '云服务', note: '200GB', active: true },
    { id: 'd4', name: 'JetBrains', price: 899, cycle: 'yearly', startDate: offset(-300), category: '软件工具', note: '全家桶', active: true },
    { id: 'd5', name: 'GitHub Pro', price: 4, cycle: 'monthly', startDate: offset(1), category: '软件工具', note: '', active: true },
    { id: 'd6', name: '京东Plus', price: 149, cycle: 'yearly', startDate: offset(-200), category: '会员', note: '', active: true },
    { id: 'd7', name: 'Notion', price: 8, cycle: 'monthly', startDate: offset(-29), category: '软件工具', note: 'Plus plan', active: true },
    { id: 'd8', name: 'Apple Music', price: 10, cycle: 'monthly', startDate: offset(-15), category: '音乐', note: '', active: true }
  ];
}

function bindEvents() {
  // 导航
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
    });
  });

  // 添加按钮
  document.getElementById('btnAdd').addEventListener('click', () => openModal(null));

  // 弹窗
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
  document.getElementById('btnSave').addEventListener('click', saveSub);

  // 搜索和过滤
  document.getElementById('searchInput').addEventListener('input', renderSubList);
  document.getElementById('filterCategory').addEventListener('change', renderSubList);
}

function renderAll() {
  renderDashboard();
  renderSubList();
  renderStats();
  updateCategoryFilter();
}

function fmtMoney(val) {
  return '¥' + Number(val).toFixed(2);
}

function cycleLabel(cycle) {
  return { monthly: '/月', yearly: '/年', quarterly: '/季', weekly: '/周' }[cycle] || '';
}

function getCatIcon(cat) {
  return CATEGORY_SVGS[cat] || CATEGORY_SVGS['其他'];
}

function getCatIconColor(cat) {
  const cats = Object.keys(CATEGORY_SVGS);
  const idx = cats.indexOf(cat);
  return getCatColor(idx >= 0 ? idx : cats.length - 1);
}

function getCatColor(index) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

// 渲染概览
async function renderDashboard() {
  const { stats, categories } = await window.subAPI.getStats();

  document.getElementById('statMonthly').textContent = fmtMoney(stats.monthlyTotal);
  document.getElementById('statMonthlyHint').textContent = stats.activeCount + ' 个活跃订阅';
  document.getElementById('statYearly').textContent = fmtMoney(stats.yearlyTotal);
  document.getElementById('statCount').textContent = stats.activeCount;
  document.getElementById('statUpcoming').textContent = stats.upcoming.length;

  // 续费列表
  const list = document.getElementById('upcomingList');
  document.getElementById('upcomingBadge').textContent = stats.upcoming.length;
  if (stats.upcoming.length === 0) {
    list.innerHTML = '<div class="empty-state">7天内暂无续费</div>';
  } else {
    list.innerHTML = stats.upcoming.map(sub => {
      const cls = sub.daysLeft <= 1 ? 'urgent' : (sub.daysLeft <= 3 ? 'soon' : 'normal');
      const label = sub.daysLeft === 0 ? '今天' : (sub.daysLeft + '天');
      return `
        <div class="renewal-item">
          <div class="renewal-icon" style="color:${getCatIconColor(sub.category)};background:${getCatIconColor(sub.category)}18">${getCatIcon(sub.category)}</div>
          <div class="renewal-info">
            <div class="renewal-name">${escapeHtml(sub.name)}</div>
            <div class="renewal-date">${sub.renewalDate} · ${fmtMoney(sub.price)}${cycleLabel(sub.cycle)}</div>
          </div>
          <div class="renewal-days ${cls}">${label}</div>
        </div>`;
    }).join('');
  }

  // 分类图
  const chart = document.getElementById('categoryChart');
  if (categories.length === 0) {
    chart.innerHTML = '<div class="empty-state">暂无数据</div>';
  } else {
    const max = Math.max(...categories.map(c => c.monthly), 1);
    chart.innerHTML = categories.map((c, i) => {
      const color = getCatIconColor(c.category);
      return `
      <div class="category-bar-item">
        <div class="cat-bar-header">
          <span class="cat-bar-name" style="display:flex;align-items:center;gap:8px;color:${color}">
            ${getCatIcon(c.category)}
            <span style="color:var(--text)">${escapeHtml(c.category)}</span>
          </span>
          <span class="cat-bar-value">${fmtMoney(c.monthly)}/月</span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${(c.monthly / max * 100).toFixed(1)}%;background:${color}"></div>
        </div>
      </div>`;
    }).join('');
  }
}

// 渲染订阅列表
function renderSubList() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filterCat = document.getElementById('filterCategory').value;

  let subs = appData.subscriptions.filter(s => {
    if (filterCat && s.category !== filterCat) return false;
    if (search && !s.name.toLowerCase().includes(search) && !(s.note || '').toLowerCase().includes(search)) return false;
    return true;
  });

  const list = document.getElementById('subList');
  if (subs.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无订阅，点击"添加订阅"开始</div>';
    return;
  }

  list.innerHTML = subs.map(sub => `
    <div class="sub-item" data-id="${sub.id}">
      <div class="sub-icon" style="color:${getCatIconColor(sub.category)};background:${getCatIconColor(sub.category)}18">${getCatIcon(sub.category)}</div>
      <div class="sub-info">
        <div class="sub-name">${escapeHtml(sub.name)} ${sub.active === false ? '<span style="color:#aeaeb2;font-size:12px">已停用</span>' : ''}</div>
        <div class="sub-meta">${escapeHtml(sub.category || '其他')} · ${sub.startDate}${sub.note ? ' · ' + escapeHtml(sub.note) : ''}</div>
      </div>
      <div class="sub-price">
        <div class="sub-price-value">${fmtMoney(sub.price)}</div>
        <div class="sub-price-cycle">${cycleLabel(sub.cycle)}</div>
      </div>
      <div class="sub-actions">
        <button class="sub-btn edit" onclick="event.stopPropagation();openModal('${sub.id}')" title="编辑">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1.5l3 3L5 14l-3.5.5L2 11l9.5-9.5z"/></svg>
        </button>
        <button class="sub-btn delete" onclick="event.stopPropagation();deleteSub('${sub.id}')" title="删除">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 2h6v1h4v2H1V3h4V2zm-2 4h10l-1 9H4L3 6z"/></svg>
        </button>
      </div>
    </div>`).join('');
}

// 渲染统计
async function renderStats() {
  const { stats, categories } = await window.subAPI.getStats();
  const chart = document.getElementById('statsChart');
  const tbody = document.getElementById('statsTableBody');

  if (categories.length === 0) {
    chart.innerHTML = '<div class="empty-state">暂无数据</div>';
    tbody.innerHTML = '';
    return;
  }

  const max = Math.max(...categories.map(c => c.monthly), 1);
  chart.innerHTML = categories.map((c, i) => {
    const color = getCatIconColor(c.category);
    return `
    <div class="category-bar-item">
      <div class="cat-bar-header">
        <span class="cat-bar-name" style="display:flex;align-items:center;gap:6px;color:${color}">${getCatIcon(c.category)} <span style="color:var(--text)">${escapeHtml(c.category)}</span></span>
        <span class="cat-bar-value">${fmtMoney(c.monthly)}/月 · ${c.count}个</span>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${(c.monthly / max * 100).toFixed(1)}%;background:${color}"></div>
      </div>
    </div>`;
  }).join('');

  tbody.innerHTML = categories.map((c, i) => {
    const color = getCatIconColor(c.category);
    return `
    <tr>
      <td><span style="display:inline-flex;align-items:center;gap:6px;color:${color}">${getCatIcon(c.category)}</span> <span style="color:var(--text)">${escapeHtml(c.category)}</span></td>
      <td>${c.count}</td>
      <td>${fmtMoney(c.monthly)}</td>
      <td>${fmtMoney(c.monthly * 12)}</td>
    </tr>`;
  }).join('');
}

function updateCategoryFilter() {
  const cats = [...new Set(appData.subscriptions.map(s => s.category || '其他'))];
  const sel = document.getElementById('filterCategory');
  sel.innerHTML = '<option value="">全部分类</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

// 弹窗
function openModal(id) {
  editingId = id;
  const modal = document.getElementById('modalOverlay');
  if (id) {
    const sub = appData.subscriptions.find(s => s.id === id);
    if (!sub) return;
    document.getElementById('modalTitle').textContent = '编辑订阅';
    document.getElementById('fName').value = sub.name;
    document.getElementById('fPrice').value = sub.price;
    document.getElementById('fCycle').value = sub.cycle;
    document.getElementById('fStartDate').value = sub.startDate;
    document.getElementById('fCategory').value = sub.category || '';
    document.getElementById('fNote').value = sub.note || '';
  } else {
    document.getElementById('modalTitle').textContent = '添加订阅';
    document.getElementById('fName').value = '';
    document.getElementById('fPrice').value = '';
    document.getElementById('fCycle').value = 'monthly';
    document.getElementById('fStartDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('fCategory').value = '';
    document.getElementById('fNote').value = '';
  }
  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  editingId = null;
}

async function saveSub() {
  const name = document.getElementById('fName').value.trim();
  const price = parseFloat(document.getElementById('fPrice').value);
  const cycle = document.getElementById('fCycle').value;
  const startDate = document.getElementById('fStartDate').value;
  const category = document.getElementById('fCategory').value.trim() || '其他';
  const note = document.getElementById('fNote').value.trim();

  if (!name) { document.getElementById('fName').focus(); return; }
  if (isNaN(price) || price < 0) { document.getElementById('fPrice').focus(); return; }
  if (!startDate) { document.getElementById('fStartDate').focus(); return; }

  if (editingId) {
    const idx = appData.subscriptions.findIndex(s => s.id === editingId);
    if (idx >= 0) {
      appData.subscriptions[idx] = { ...appData.subscriptions[idx], name, price, cycle, startDate, category, note };
    }
  } else {
    appData.subscriptions.push({
      id: 's' + Date.now() + Math.random().toString(36).slice(2, 6),
      name, price, cycle, startDate, category, note, active: true
    });
  }

  await window.subAPI.save(appData);
  closeModal();
  renderAll();
}

async function deleteSub(id) {
  appData.subscriptions = appData.subscriptions.filter(s => s.id !== id);
  await window.subAPI.save(appData);
  renderAll();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

// 暴露给 onclick
window.openModal = openModal;
window.deleteSub = deleteSub;

init();
