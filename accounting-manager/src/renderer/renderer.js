// 记账管家 - 渲染进程逻辑

const API = window.accountAPI;

// ===== 状态 =====
const state = {
  currentView: 'dashboard',
  currentMonth: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })(),
  selectedDate: null, // 日历选中日期（YYYY-MM-DD）
  filter: 'all',
  categories: { expense: [], income: [] },
  accounts: [],
  transactions: [],
  editingTxId: null,
  modalType: 'expense',
  modalCategoryId: null,
  modalAccountId: null,
};

// ===== 工具 =====
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function fmtMoney(num, withSign = false) {
  const n = Number(num) || 0;
  const abs = Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (withSign && n > 0) return '+' + abs;
  return abs;
}

function monthKeyToLabel(mk) {
  const [y, m] = mk.split('-');
  return `${y}年${parseInt(m, 10)}月`;
}

function mkToObj(mk) {
  const [y, m] = mk.split('-').map((n) => parseInt(n, 10));
  return { year: y, month: m };
}

function objToMonthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function prevMonthKey(mk) {
  const { year, month } = mkToObj(mk);
  if (month === 1) return objToMonthKey(year - 1, 12);
  return objToMonthKey(year, month - 1);
}

function nextMonthKey(mk) {
  const { year, month } = mkToObj(mk);
  if (month === 12) return objToMonthKey(year + 1, 1);
  return objToMonthKey(year, month + 1);
}

function thisMonthKey() {
  const d = new Date();
  return objToMonthKey(d.getFullYear(), d.getMonth() + 1);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast ' + type; }, 2200);
}

// 可复用确认对话框，返回 Promise<boolean>
function confirmDialog({ title, message, confirmText = '确认', cancelText = '取消', danger = true }) {
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'modal-mask active';
    const iconCls = danger ? '' : 'info';
    const iconSvg = danger
      ? '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 2v8M9 13v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 2v8M9 13v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    mask.innerHTML = `
      <div class="modal confirm-modal">
        <div class="confirm-body">
          <div class="confirm-icon-wrap">
            <div class="confirm-icon ${iconCls}">${iconSvg}</div>
            <div class="confirm-title">${escapeHtml(title)}</div>
          </div>
          <div class="confirm-msg">${escapeHtml(message)}</div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" data-cancel>${escapeHtml(cancelText)}</button>
          <button class="${danger ? 'danger-btn' : 'primary-btn'}" data-ok>${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    const close = (val) => { mask.remove(); resolve(val); };
    mask.querySelector('[data-cancel]').addEventListener('click', () => close(false));
    mask.querySelector('[data-ok]').addEventListener('click', () => close(true));
    mask.addEventListener('click', (e) => { if (e.target === mask) close(false); });
  });
}

function getCatById(id) {
  return [...state.categories.expense, ...state.categories.income].find((c) => c.id === id) || { name: '未分类', icon: '✏️', color: '#8e8e93' };
}

function getAccountById(id) {
  return state.accounts.find((a) => a.id === id) || { name: '未知', icon: '💵', color: '#8e8e93' };
}

// ===== 初始化 =====
async function init() {
  await loadCategories();
  await loadAccounts();
  await refresh();
  bindEvents();
}

async function loadCategories() {
  state.categories = await API.listCategories();
}

async function loadAccounts() {
  state.accounts = await API.listAccounts();
}

async function refresh() {
  state.transactions = await API.listTx({});
  $('monthLabel').textContent = monthKeyToLabel(state.currentMonth);
  renderView();
}

function bindEvents() {
  // 导航
  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  // 月份切换
  $('prevMonth').addEventListener('click', () => { state.currentMonth = prevMonthKey(state.currentMonth); refresh(); });
  $('nextMonth').addEventListener('click', () => { state.currentMonth = nextMonthKey(state.currentMonth); refresh(); });
  $('todayBtn').addEventListener('click', () => { state.currentMonth = thisMonthKey(); refresh(); });
  // 记一笔
  $('btnAdd').addEventListener('click', () => openModal());
  // 模态框
  $('modalClose').addEventListener('click', closeModal);
  $('modalCancel').addEventListener('click', closeModal);
  $('modalSave').addEventListener('click', saveTx);
  $('modalDelete').addEventListener('click', deleteTx);
  $('modalMask').addEventListener('click', (e) => { if (e.target.id === 'modalMask') closeModal(); });
  $$('.type-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchModalType(btn.dataset.type));
  });
  // 筛选
  $$('.filter-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.filter-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      renderTxList($('allTxList'), filterTx(state.transactions));
    });
  });
  // 预算保存
  $('saveBudget').addEventListener('click', saveBudget);
  $('budgetInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBudget(); });
  // 导出导入
  $('btnExport').addEventListener('click', exportData);
  $('btnImport').addEventListener('click', importData);
  // 清空数据
  $('btnClear').addEventListener('click', clearData);
  // 查看全部
  $('seeAllTx').addEventListener('click', () => switchView('transactions'));
}

function switchView(view) {
  state.currentView = view;
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));
  const titles = { dashboard: '概览', calendar: '日历', transactions: '明细', stats: '统计', budget: '预算' };
  $('pageTitle').textContent = titles[view] || '';
  $('pageSub').textContent = monthKeyToLabel(state.currentMonth);
  renderView();
}

function renderView() {
  $('pageSub').textContent = monthKeyToLabel(state.currentMonth);
  if (state.currentView === 'dashboard') renderDashboard();
  else if (state.currentView === 'calendar') renderCalendar();
  else if (state.currentView === 'transactions') renderTransactions();
  else if (state.currentView === 'stats') renderStats();
  else if (state.currentView === 'budget') renderBudget();
}

// ===== 概览 =====
function renderDashboard() {
  const monthTx = state.transactions.filter((t) => t.date.startsWith(state.currentMonth));
  let income = 0, expense = 0;
  monthTx.forEach((t) => {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  });
  $('overviewIncome').textContent = '¥' + fmtMoney(income);
  $('overviewExpense').textContent = '¥' + fmtMoney(expense);
  $('overviewBalance').textContent = '¥' + fmtMoney(income - expense);

  // 与上月对比
  const prevMk = prevMonthKey(state.currentMonth);
  const prevTx = state.transactions.filter((t) => t.date.startsWith(prevMk));
  let prevInc = 0, prevExp = 0;
  prevTx.forEach((t) => { if (t.type === 'income') prevInc += t.amount; else prevExp += t.amount; });
  $('overviewIncomeTrend').innerHTML = trendBadge(income, prevInc, '收入');
  $('overviewExpenseTrend').innerHTML = trendBadge(expense, prevExp, '支出');
  const balance = income - expense;
  const prevBal = prevInc - prevExp;
  $('overviewBalanceTrend').innerHTML = trendBadge(balance, prevBal, '结余');

  // 趋势（近6月）
  renderTrendChart();
  // 分类环形图
  renderDonut(monthTx);
  // 最近交易
  const recent = state.transactions.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1;
  }).slice(0, 8);
  renderTxList($('recentTxList'), recent, true);
}

function trendBadge(curr, prev, label) {
  if (prev === 0 && curr === 0) return `<span>较上月 持平</span>`;
  if (prev === 0) return `<span>较上月 新增</span>`;
  const diff = curr - prev;
  const pct = (diff / Math.abs(prev)) * 100;
  // 浮点误差容忍：差异小于 0.5% 视为持平
  if (Math.abs(pct) < 0.05) return `<span>较上月 持平</span>`;
  const arrow = diff > 0 ? '↑' : '↓';
  // 支出增加是坏事，反色
  const isBad = (label === '支出' && diff > 0) || (label !== '支出' && diff < 0);
  const colorClass = isBad ? 'trend-down' : 'trend-up';
  return `<span class="${colorClass}">较上月 ${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

function renderTrendChart() {
  const container = $('trendChart');
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(objToMonthKey(d.getFullYear(), d.getMonth() + 1));
  }
  const data = months.map((mk) => {
    const txs = state.transactions.filter((t) => t.date.startsWith(mk));
    let inc = 0, exp = 0;
    txs.forEach((t) => { if (t.type === 'income') inc += t.amount; else exp += t.amount; });
    return { month: mk, income: inc, expense: exp };
  });
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  // 取整刻度
  const step = Math.max(1, Math.pow(10, Math.floor(Math.log10(maxVal))));
  const max = Math.ceil(maxVal / step) * step;
  const W = 540, H = 260, PL = 48, PR = 14, PT = 24, PB = 32;
  const cw = W - PL - PR, ch = H - PT - PB;
  const groupW = cw / data.length;
  const barW = Math.min(24, groupW * 0.3);

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">`;
  // 渐变定义
  svg += `<defs>
    <linearGradient id="gradInc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34c759"/>
      <stop offset="100%" stop-color="#248a3d"/>
    </linearGradient>
    <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff453a"/>
      <stop offset="100%" stop-color="#d70015"/>
    </linearGradient>
  </defs>`;
  // 网格线（4 条）+ Y 轴刻度
  for (let i = 0; i <= 3; i++) {
    const y = PT + ch * (i / 3);
    const val = max * (1 - i / 3);
    svg += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}" stroke="#f0f0f5" stroke-width="1"/>`;
    svg += `<text x="${PL - 8}" y="${(y + 3).toFixed(1)}" font-size="10" fill="#a1a1a6" text-anchor="end" font-family="-apple-system">${fmtAxis(val)}</text>`;
  }
  // 柱状
  data.forEach((d, i) => {
    const cx = PL + i * groupW + groupW / 2;
    const hInc = (d.income / max) * ch;
    const hExp = (d.expense / max) * ch;
    const yInc = PT + ch - hInc;
    const yExp = PT + ch - hExp;
    const isCurrent = d.month === state.currentMonth;
    // 收入柱
    if (d.income > 0) {
      svg += `<rect x="${(cx - barW - 2).toFixed(1)}" y="${yInc.toFixed(1)}" width="${barW}" height="${hInc.toFixed(1)}" rx="3" fill="url(#gradInc)"/>`;
      const lblY = Math.max(yInc - 6, PT + 8);
      if (isCurrent) {
        svg += `<text x="${(cx - barW / 2 - 2).toFixed(1)}" y="${lblY.toFixed(1)}" font-size="10.5" fill="#248a3d" text-anchor="middle" font-weight="600">${fmtShortMoney(d.income)}</text>`;
      } else {
        svg += `<text x="${(cx - barW / 2 - 2).toFixed(1)}" y="${lblY.toFixed(1)}" font-size="9" fill="#8e8e93" text-anchor="middle" font-weight="400">${fmtShortMoney(d.income)}</text>`;
      }
    }
    // 支出柱
    if (d.expense > 0) {
      svg += `<rect x="${(cx + 2).toFixed(1)}" y="${yExp.toFixed(1)}" width="${barW}" height="${hExp.toFixed(1)}" rx="3" fill="url(#gradExp)"/>`;
      const lblY = Math.max(yExp - 6, PT + 8);
      if (isCurrent) {
        svg += `<text x="${(cx + barW / 2 + 2).toFixed(1)}" y="${lblY.toFixed(1)}" font-size="10.5" fill="#d70015" text-anchor="middle" font-weight="600">${fmtShortMoney(d.expense)}</text>`;
      } else {
        svg += `<text x="${(cx + barW / 2 + 2).toFixed(1)}" y="${lblY.toFixed(1)}" font-size="9" fill="#8e8e93" text-anchor="middle" font-weight="400">${fmtShortMoney(d.expense)}</text>`;
      }
    }
    const [y, m] = d.month.split('-');
    svg += `<text x="${cx.toFixed(1)}" y="${H - 10}" font-size="10" fill="${isCurrent ? '#007aff' : '#6e6e73'}" text-anchor="middle" font-weight="${isCurrent ? '600' : '400'}">${parseInt(m, 10)}月</text>`;
  });
  svg += '</svg>';
  // 图例
  svg += `<div style="display:flex;justify-content:flex-end;gap:16px;margin-top:6px;font-size:11.5px;color:#6e6e73;">
    <span style="display:flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;background:#34c759;border-radius:2px;"></span>收入</span>
    <span style="display:flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;background:#ff3b30;border-radius:2px;"></span>支出</span>
  </div>`;
  container.innerHTML = svg;
}

function fmtShortMoney(n) {
  if (n >= 10000) return '¥' + (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return '¥' + (n / 1000).toFixed(1) + 'k';
  return '¥' + Math.round(n).toString();
}

/** Y 轴刻度格式：统一用 k（避免 k/w 混用），带 ¥ 前缀 */
function fmtAxis(n) {
  if (n >= 1000) return '¥' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return '¥' + Math.round(n).toString();
}

function renderDonut(monthTx) {
  const map = {};
  monthTx.filter((t) => t.type === 'expense').forEach((t) => {
    map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
  });
  let list = Object.entries(map).map(([id, amount]) => ({ cat: getCatById(id), amount }))
    .sort((a, b) => b.amount - a.amount);
  const total = list.reduce((s, x) => s + x.amount, 0);

  $('donutTotal').textContent = '¥' + Math.round(total).toLocaleString('zh-CN');
  $('catTotal').textContent = total > 0 ? '共 ¥' + Math.round(total).toLocaleString('zh-CN') : '';

  const svg = $('donutChart');
  if (total === 0 || list.length === 0) {
    svg.innerHTML = `<circle cx="100" cy="100" r="78" stroke="#f0f0f5" stroke-width="18" fill="none"/>`;
    $('donutLegend').innerHTML = '<div style="text-align:center;color:#a1a1a6;font-size:12px;padding:10px;">暂无支出数据</div>';
    return;
  }

  // Top 4 + 其他，避免小分类被压缩
  let drawList = list.slice(0, 4);
  if (list.length > 4) {
    const othersSum = list.slice(4).reduce((s, x) => s + x.amount, 0);
    drawList.push({ cat: { name: '其他', icon: '', color: '#c7c7cc' }, amount: othersSum });
  }

  let acc = 0;
  const R = 78, C = 2 * Math.PI * R;
  let html = `<circle cx="100" cy="100" r="${R}" stroke="#f0f0f5" stroke-width="18" fill="none"/>`;
  drawList.forEach(({ cat, amount }) => {
    const ratio = amount / total;
    const dash = ratio * C;
    const offset = -acc * C;
    // 小于 1% 的段不画，避免细线
    if (ratio > 0.005) {
      html += `<circle cx="100" cy="100" r="${R}" stroke="${cat.color}" stroke-width="18" fill="none"
        stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/>`;
    }
    acc += ratio;
  });
  svg.innerHTML = html;

  // 图例
  const legendHtml = drawList.map(({ cat, amount }) => {
    const pct = (amount / total * 100).toFixed(1);
    const iconStr = cat.icon ? `<span class="legend-emoji">${cat.icon}</span>` : '';
    return `<div class="legend-item">
      <span class="legend-dot" style="background:${cat.color}"></span>
      <span class="legend-name">${iconStr}${escapeHtml(cat.name)}</span>
      <span class="legend-amount">¥${fmtMoney(amount)}</span>
      <span class="legend-percent">${pct}%</span>
    </div>`;
  }).join('');
  $('donutLegend').innerHTML = legendHtml;
}

// ===== 交易列表渲染 =====
function renderTxList(container, txs, showDate = false) {
  if (!txs || txs.length === 0) {
    container.innerHTML = `<div class="tx-empty"><span class="emoji">📝</span>暂无交易记录</div>`;
    return;
  }
  const html = txs.map((t) => {
    const cat = getCatById(t.categoryId);
    const acc = getAccountById(t.accountId);
    const sign = t.type === 'income' ? '+' : '-';
    const dateStr = showDate ? `<span class="tx-note">${t.date}</span>` : '';
    const noteStr = t.note ? `<span class="tx-note">· ${escapeHtml(t.note)}</span>` : '';
    return `<div class="tx-item" data-id="${t.id}">
      <div class="tx-icon" style="background:${cat.color}14">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-cat">${escapeHtml(cat.name)}</div>
        <div class="tx-meta">${dateStr}<span>${acc.icon} ${escapeHtml(acc.name)}</span>${noteStr}</div>
      </div>
      <div class="tx-amount ${t.type}">${sign}¥${fmtMoney(t.amount)}</div>
    </div>`;
  }).join('');
  container.innerHTML = html;
  container.querySelectorAll('.tx-item').forEach((el) => {
    el.addEventListener('click', () => openModal(el.dataset.id));
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function filterTx(all) {
  const monthTx = all.filter((t) => t.date.startsWith(state.currentMonth));
  if (state.filter === 'all') return monthTx;
  return monthTx.filter((t) => t.type === state.filter);
}

// ===== 日历 =====
function renderCalendar() {
  const { year, month } = mkToObj(state.currentMonth);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const today = todayKey();

  // 当月交易按日聚合
  const dayMap = {};
  state.transactions.filter((t) => t.date.startsWith(state.currentMonth)).forEach((t) => {
    if (!dayMap[t.date]) dayMap[t.date] = { income: 0, expense: 0 };
    if (t.type === 'income') dayMap[t.date].income += t.amount;
    else dayMap[t.date].expense += t.amount;
  });

  let html = '';
  ['日', '一', '二', '三', '四', '五', '六'].forEach((w) => {
    html += `<div class="cal-weekday">${w}</div>`;
  });
  // 空白
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= days; d++) {
    const dateKey = `${state.currentMonth}-${String(d).padStart(2, '0')}`;
    const dat = dayMap[dateKey];
    const isToday = dateKey === today;
    const isSelected = dateKey === state.selectedDate;
    const cls = ['cal-day'];
    if (isToday) cls.push('today');
    if (isSelected) cls.push('selected');
    html += `<div class="${cls.join(' ')}" data-date="${dateKey}">
      <div class="cal-day-num">${d}</div>
      ${dat && dat.income > 0 ? `<div class="cal-day-inc">+${fmtShortMoney(dat.income)}</div>` : ''}
      ${dat && dat.expense > 0 ? `<div class="cal-day-exp">-${fmtShortMoney(dat.expense)}</div>` : ''}
    </div>`;
  }
  const cal = $('calendar');
  cal.innerHTML = html;
  cal.querySelectorAll('.cal-day:not(.empty)').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedDate = el.dataset.date;
      renderCalendar();
      renderDayTx();
    });
  });

  if (!state.selectedDate || !state.selectedDate.startsWith(state.currentMonth)) {
    state.selectedDate = today;
  }
  renderDayTx();
}

function renderDayTx() {
  const txs = state.transactions.filter((t) => t.date === state.selectedDate);
  $('selectedDayTitle').textContent = `${state.selectedDate} 的交易（${txs.length} 笔）`;
  renderTxList($('dayTxList'), txs);
}

// ===== 明细 =====
function renderTransactions() {
  renderTxList($('allTxList'), filterTx(state.transactions));
}

// ===== 统计 =====
function renderStats() {
  const monthTx = state.transactions.filter((t) => t.date.startsWith(state.currentMonth));
  let income = 0, expense = 0;
  monthTx.forEach((t) => {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  });
  $('statsIncome').textContent = '¥' + fmtMoney(income);
  $('statsExpense').textContent = '¥' + fmtMoney(expense);
  $('statsBalance').textContent = '¥' + fmtMoney(income - expense);

  renderBarList($('expenseBars'), monthTx, 'expense');
  renderBarList($('incomeBars'), monthTx, 'income');
}

function renderBarList(container, monthTx, type) {
  const map = {};
  monthTx.filter((t) => t.type === type).forEach((t) => {
    map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
  });
  const list = Object.entries(map).map(([id, amount]) => ({ cat: getCatById(id), amount }))
    .sort((a, b) => b.amount - a.amount);
  const total = list.reduce((s, x) => s + x.amount, 0);

  if (list.length === 0) {
    container.innerHTML = `<div class="tx-empty"><span class="emoji">📊</span>暂无${type === 'income' ? '收入' : '支出'}数据</div>`;
    return;
  }

  const html = list.map(({ cat, amount }) => {
    const pct = total > 0 ? (amount / total * 100) : 0;
    return `<div class="bar-item">
      <div class="bar-head">
        <span class="bar-name"><span class="icon">${cat.icon}</span>${escapeHtml(cat.name)}</span>
        <span class="bar-amount">¥${fmtMoney(amount)} · ${pct.toFixed(1)}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%;background:${cat.color};"></div>
      </div>
    </div>`;
  }).join('');
  container.innerHTML = html;
}

// ===== 预算 =====
async function renderBudget() {
  $('budgetMonthLabel').textContent = monthKeyToLabel(state.currentMonth);
  const budget = await API.getBudget(state.currentMonth);
  $('budgetInput').value = budget > 0 ? budget : '';

  const monthTx = state.transactions.filter((t) => t.date.startsWith(state.currentMonth));
  let expense = 0;
  monthTx.forEach((t) => { if (t.type === 'expense') expense += t.amount; });

  const percent = budget > 0 ? Math.min(100, (expense / budget) * 100) : 0;
  const remaining = budget - expense;
  const over = expense > budget && budget > 0;

  $('budgetPercent').textContent = budget > 0 ? Math.round(percent) + '%' : '—';
  $('bsBudget').textContent = '¥' + fmtMoney(budget);
  $('bsUsed').textContent = '¥' + fmtMoney(expense);
  $('bsRemaining').textContent = '¥' + fmtMoney(remaining);

  // 环形进度
  const ring = $('budgetRing');
  const C = 2 * Math.PI * 86;
  ring.setAttribute('stroke-dasharray', C);
  ring.setAttribute('stroke-dashoffset', C * (1 - percent / 100));
  if (over) ring.setAttribute('stroke', '#ff3b30');
  else if (percent >= 80) ring.setAttribute('stroke', '#ff9500');
  else ring.setAttribute('stroke', '#007aff');

  const statusEl = $('bsStatus');
  statusEl.className = 'bs-status';
  if (budget === 0) {
    statusEl.textContent = '未设置预算，点击上方设置';
    statusEl.classList.add('warning');
  } else if (over) {
    statusEl.textContent = `已超支 ¥${fmtMoney(expense - budget)}，请控制支出`;
    statusEl.classList.add('danger');
  } else if (percent >= 80) {
    statusEl.textContent = `预算即将用完，请谨慎消费`;
    statusEl.classList.add('warning');
  } else {
    statusEl.textContent = `预算使用良好，继续保持`;
  }

  // 小贴士
  const tips = [];
  if (budget === 0) {
    tips.push('设置月度预算可以帮助你更好地控制支出。');
    tips.push('建议预算设置为月度收入的 70-80%，留出储蓄空间。');
  } else {
    const daysInMonth = new Date(...state.currentMonth.split('-').map((n) => parseInt(n, 10)), 0).getDate();
    const today = new Date();
    const isCurrentMonth = state.currentMonth === thisMonthKey();
    if (isCurrentMonth) {
      const dayPassed = today.getDate();
      const daysLeft = daysInMonth - dayPassed + 1;
      const dailyAvg = expense / dayPassed;
      const predict = dailyAvg * daysInMonth;
      tips.push(`本月已过 ${dayPassed} 天，日均支出 ¥${fmtMoney(dailyAvg)}。`);
      tips.push(`按当前节奏，预计本月总支出 ¥${fmtMoney(predict)}，${predict > budget ? '将超出预算' : '在预算范围内'}。`);
      if (daysLeft > 0) {
        const dailyLeft = remaining / daysLeft;
        tips.push(`剩余 ${daysLeft} 天，日均可用 ¥${fmtMoney(dailyLeft)}。`);
      }
    } else {
      tips.push(`本月总支出 ¥${fmtMoney(expense)}，${over ? '已超出预算' : '在预算范围内'}。`);
    }
    // 找出最大支出分类
    const catMap = {};
    monthTx.filter((t) => t.type === 'expense').forEach((t) => { catMap[t.categoryId] = (catMap[t.categoryId] || 0) + t.amount; });
    const top = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const cat = getCatById(top[0]);
      tips.push(`最大支出分类：${cat.icon} ${cat.name}，占比 ${((top[1] / expense) * 100).toFixed(1)}%。`);
    }
  }
  $('budgetTips').innerHTML = tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
}

async function saveBudget() {
  const v = parseFloat($('budgetInput').value);
  if (!isFinite(v) || v < 0) {
    toast('请输入有效预算金额', 'error');
    return;
  }
  await API.setBudget(state.currentMonth, v);
  toast('预算已保存', 'success');
  renderBudget();
}

// ===== 模态框 =====
function openModal(txId = null) {
  state.editingTxId = txId;
  state.modalCategoryId = null;
  state.modalAccountId = null;
  if (txId) {
    const t = state.transactions.find((x) => x.id === txId);
    if (!t) return;
    $('modalTitle').textContent = '编辑交易';
    state.modalType = t.type;
    state.modalCategoryId = t.categoryId;
    state.modalAccountId = t.accountId;
    $('amountInput').value = t.amount;
    $('dateInput').value = t.date;
    $('noteInput').value = t.note || '';
    $('modalDelete').style.display = '';
  } else {
    $('modalTitle').textContent = '记一笔';
    state.modalType = 'expense';
    $('amountInput').value = '';
    $('dateInput').value = todayKey();
    $('noteInput').value = '';
    $('modalDelete').style.display = 'none';
  }
  // 渲染分类和账户
  renderCategoryGrid();
  renderAccountGrid();
  // 类型切换
  $$('.type-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === state.modalType));
  $('modalMask').classList.add('active');
  setTimeout(() => $('amountInput').focus(), 100);
}

function closeModal() {
  $('modalMask').classList.remove('active');
  state.editingTxId = null;
}

function switchModalType(type) {
  state.modalType = type;
  state.modalCategoryId = null;
  $$('.type-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  renderCategoryGrid();
}

function renderCategoryGrid() {
  const list = state.categories[state.modalType === 'income' ? 'income' : 'expense'];
  $('categoryGrid').innerHTML = list.map((c) => {
    const active = c.id === state.modalCategoryId ? 'active' : '';
    return `<div class="cat-item ${active}" data-id="${c.id}">
      <span class="icon">${c.icon}</span>
      <span>${escapeHtml(c.name)}</span>
    </div>`;
  }).join('');
  $('categoryGrid').querySelectorAll('.cat-item').forEach((el) => {
    el.addEventListener('click', () => {
      state.modalCategoryId = el.dataset.id;
      $('categoryGrid').querySelectorAll('.cat-item').forEach((x) => x.classList.remove('active'));
      el.classList.add('active');
    });
  });
}

function renderAccountGrid() {
  if (!state.modalAccountId) state.modalAccountId = state.accounts[0]?.id;
  $('accountGrid').innerHTML = state.accounts.map((a) => {
    const active = a.id === state.modalAccountId ? 'active' : '';
    return `<div class="acc-item ${active}" data-id="${a.id}">
      <span class="icon">${a.icon}</span>
      <span>${escapeHtml(a.name)}</span>
    </div>`;
  }).join('');
  $('accountGrid').querySelectorAll('.acc-item').forEach((el) => {
    el.addEventListener('click', () => {
      state.modalAccountId = el.dataset.id;
      $('accountGrid').querySelectorAll('.acc-item').forEach((x) => x.classList.remove('active'));
      el.classList.add('active');
    });
  });
}

async function saveTx() {
  const amount = parseFloat($('amountInput').value);
  if (!isFinite(amount) || amount <= 0) {
    toast('请输入有效金额', 'error');
    return;
  }
  const data = {
    type: state.modalType,
    amount,
    categoryId: state.modalCategoryId,
    accountId: state.modalAccountId,
    date: $('dateInput').value || todayKey(),
    note: $('noteInput').value,
  };
  try {
    if (state.editingTxId) {
      await API.updateTx(state.editingTxId, data);
      toast('已更新', 'success');
    } else {
      await API.createTx(data);
      toast('已记账', 'success');
    }
    closeModal();
    await refresh();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteTx() {
  if (!state.editingTxId) return;
  const t = state.transactions.find((x) => x.id === state.editingTxId);
  const cat = t ? getCatById(t.categoryId).name : '该交易';
  const amt = t ? fmtMoney(t.amount) : '';
  const ok = await confirmDialog({
    title: '删除交易？',
    message: `确认删除「${cat} ¥${amt}」？删除后无法恢复。`,
    confirmText: '删除',
    cancelText: '取消',
    danger: true,
  });
  if (!ok) return;
  await API.removeTx(state.editingTxId);
  toast('已删除', 'success');
  closeModal();
  await refresh();
}

async function exportData() {
  // 提供两种格式：JSON / CSV
  const choice = await showExportChoice();
  if (!choice) return;
  const path = await API.saveExport(choice);
  if (path) toast('已导出到 ' + path, 'success');
}

async function showExportChoice() {
  // 简单弹窗选择 JSON / CSV
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'modal-mask active';
    mask.innerHTML = `
      <div class="modal" style="width:340px;">
        <div class="modal-head"><h3>选择导出格式</h3></div>
        <div class="modal-body" style="display:flex;gap:10px;">
          <button class="ghost-btn" data-fmt="json" style="flex:1;padding:18px;font-size:14px;">JSON（含分类/预算）</button>
          <button class="ghost-btn" data-fmt="csv" style="flex:1;padding:18px;font-size:14px;">CSV（适合 Excel）</button>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" data-cancel>取消</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    mask.querySelector('[data-cancel]').addEventListener('click', () => { mask.remove(); resolve(null); });
    mask.querySelector('[data-fmt="json"]').addEventListener('click', () => { mask.remove(); resolve('json'); });
    mask.querySelector('[data-fmt="csv"]').addEventListener('click', () => { mask.remove(); resolve('csv'); });
    mask.addEventListener('click', (e) => { if (e.target === mask) { mask.remove(); resolve(null); } });
  });
}

async function importData() {
  const r = await API.pickImport();
  if (!r) return;
  if (r.ok) {
    toast('导入成功', 'success');
    await loadCategories();
    await loadAccounts();
    await refresh();
  } else {
    toast('导入失败：' + r.error, 'error');
  }
}

async function clearData() {
  const count = state.transactions.length;
  const ok = await confirmDialog({
    title: '清空所有数据？',
    message: `将永久删除全部 ${count} 笔交易及所有预算记录，分类与账户保留。此操作无法撤销。`,
    confirmText: '清空',
    cancelText: '取消',
    danger: true,
  });
  if (!ok) return;
  const r = await API.clearAll();
  if (r && r.ok) {
    toast('数据已清空', 'success');
    await refresh();
  } else {
    toast('清空失败', 'error');
  }
}

// 启动
init();
