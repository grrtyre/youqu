// 习惯管家 - 渲染层逻辑
// 工具函数内联（与 src/core/habit-utils.js 同步），避免在 contextIsolation 下 require

const Utils = {
  toDateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  fromDateKey(key) {
    const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d);
  },
  shiftDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  },
  diffDays(aKey, bKey) {
    const a = this.fromDateKey(aKey).getTime();
    const b = this.fromDateKey(bKey).getTime();
    return Math.round((a - b) / 86400000);
  },
  currentStreak(records, today = new Date()) {
    if (!records || records.length === 0) return 0;
    const set = new Set(records);
    const todayKey = this.toDateKey(today);
    let cursor = set.has(todayKey) ? today : this.shiftDays(this.fromDateKey(todayKey), -1);
    let streak = 0;
    for (let i = 0; i < 365 * 5; i++) {
      if (set.has(this.toDateKey(cursor))) {
        streak += 1;
        cursor = this.shiftDays(cursor, -1);
      } else break;
    }
    return streak;
  },
  longestStreak(records) {
    if (!records || records.length === 0) return 0;
    const sorted = [...new Set(records)].sort();
    let longest = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (this.diffDays(sorted[i], sorted[i - 1]) === 1) run += 1;
      else run = 1;
      if (run > longest) longest = run;
    }
    return longest;
  },
  monthGrid(year, month, records, today = new Date()) {
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = this.toDateKey(today);
    const set = new Set(records || []);
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = this.toDateKey(date);
      cells.push({ key, day: d, inMonth: true, isToday: key === todayKey, done: set.has(key) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  },
  weekStats(records, today = new Date()) {
    const set = new Set(records || []);
    const todayKey = this.toDateKey(today);
    const t = this.fromDateKey(todayKey);
    const start = this.shiftDays(t, -t.getDay());
    let done = 0;
    for (let i = 0; i < 7; i++) if (set.has(this.toDateKey(this.shiftDays(start, i)))) done += 1;
    return { done, total: 7, rate: done / 7 };
  },
  monthStats(records, today = new Date()) {
    const set = new Set(records || []);
    const t = new Date(today);
    const year = t.getFullYear();
    const month = t.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let done = 0;
    for (let d = 1; d <= daysInMonth; d++) if (set.has(this.toDateKey(new Date(year, month, d)))) done += 1;
    return { done, total: daysInMonth, rate: done / daysInMonth };
  },
};

const ICONS = [
  { key: 'check', svg: '<path d="M5 12.5l5 5L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
  { key: 'book', svg: '<path d="M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2V4z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 4v14M10 9h5M10 13h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
  { key: 'run', svg: '<circle cx="13" cy="5" r="2" stroke="currentColor" stroke-width="1.6"/><path d="M13 7l-3 4 3 3v5M13 14l4 2M9 11l-4 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' },
  { key: 'drop', svg: '<path d="M12 3s5 5 5 9a5 5 0 11-10 0c0-4 5-9 5-9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' },
  { key: 'lotus', svg: '<path d="M12 14a3 3 0 100-6 3 3 0 000 6zM5 14c0-3 2-5 4-5M19 14c0-3-2-5-4-5M3 18c2 2 6 3 9 3s7-1 9-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' },
  { key: 'pill', svg: '<rect x="3" y="8" width="18" height="8" rx="4" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v8" stroke="currentColor" stroke-width="1.6"/>' },
  { key: 'pencil', svg: '<path d="M14 4l6 6-11 11H3v-6L14 4z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 5l6 6" stroke="currentColor" stroke-width="1.6"/>' },
  { key: 'target', svg: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>' },
  { key: 'bowl', svg: '<path d="M3 11h18a8 8 0 01-8 8h-2a8 8 0 01-8-8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 7c0-1 1-2 2-2M14 7c0-1 1-2 2-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
  { key: 'moon', svg: '<path d="M20 13a8 8 0 11-9-9 6 6 0 009 9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' },
  { key: 'music', svg: '<path d="M9 18V5l11-2v13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="16" r="3" stroke="currentColor" stroke-width="1.6"/>' },
  { key: 'laptop', svg: '<rect x="4" y="5" width="16" height="11" rx="1" stroke="currentColor" stroke-width="1.6"/><path d="M2 20h20M9 20l1-2h4l1 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' },
];
const COLORS = ['#007aff', '#34c759', '#ff9500', '#ff3b30', '#af52de', '#5856d6', '#ff2d55', '#00c7be'];

// 状态
const state = {
  habits: [],
  selectedId: null,
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  modalState: { mode: 'create', name: '', icon: ICONS[0].key, color: COLORS[0] },
  manageState: { icon: ICONS[0].key, color: COLORS[0] },
};

// 图标查找：返回 SVG innerHTML
function iconSvg(key, size = 18) {
  const found = ICONS.find((i) => i.key === key) || ICONS[0];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">${found.svg}</svg>`;
}

// DOM
const $ = (id) => document.getElementById(id);

// ============ 渲染 ============
async function reload() {
  state.habits = await window.habitAPI.list();
  renderSidebar();
  renderDetail();
  renderSidebarFoot();
}

function renderSidebar() {
  const list = $('habitList');
  list.innerHTML = '';
  if (state.habits.length === 0) {
    list.innerHTML = '<div style="padding:24px 12px;text-align:center;color:var(--text-3);font-size:12px;">还没有习惯，点击 + 创建</div>';
    return;
  }
  state.habits.forEach((h) => {
    const streak = Utils.currentStreak(h.records);
    const item = document.createElement('div');
    item.className = 'habit-item' + (h.id === state.selectedId ? ' active' : '');
    item.dataset.id = h.id;
    item.innerHTML = `
      <div class="habit-icon" style="color:${h.color}">${iconSvg(h.icon, 18)}</div>
      <div class="habit-meta">
        <div class="habit-name">${escapeHtml(h.name)}</div>
        <div class="habit-sub">连续 ${streak} 天</div>
      </div>
      <div class="habit-streak ${streak === 0 ? 'zero' : ''}">${streak}</div>
    `;
    item.onclick = () => selectHabit(h.id);
    list.appendChild(item);
  });
  // 底部"添加新习惯"引导卡（填充空白）
  const addCard = document.createElement('div');
  addCard.className = 'habit-add-card';
  addCard.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>添加新习惯</span>`;
  addCard.onclick = () => openModal('create');
  list.appendChild(addCard);
}

function renderSidebarFoot() {
  $('totalCount').textContent = state.habits.length;
  const todayKey = Utils.toDateKey(new Date());
  let done = 0;
  state.habits.forEach((h) => { if (h.records.includes(todayKey)) done += 1; });
  $('todayDone').textContent = done;
  $('todayTotal').textContent = state.habits.length;
  const pct = state.habits.length === 0 ? 0 : (done / state.habits.length) * 100;
  $('todayProgress').style.width = pct + '%';
}

function renderDetail() {
  const empty = $('emptyState');
  const detail = $('detailView');
  const sel = state.habits.find((h) => h.id === state.selectedId);
  if (!sel) {
    empty.hidden = false;
    detail.hidden = true;
    return;
  }
  empty.hidden = true;
  detail.hidden = false;

  // 今日卡
  const todayKey = Utils.toDateKey(new Date());
  const isDoneToday = sel.records.includes(todayKey);
  const check = $('todayCheck');
  check.classList.toggle('done', isDoneToday);
  $('todayCard').classList.toggle('done', isDoneToday);
  check.style.background = isDoneToday ? sel.color : '#fff';
  check.style.borderColor = isDoneToday ? sel.color : 'var(--line-strong)';
  check.style.boxShadow = isDoneToday ? `0 6px 16px ${hexToRgba(sel.color, 0.35)}` : 'none';
  $('todayName').textContent = sel.name;
  $('todayHint').textContent = isDoneToday ? '今日已完成，继续保持 ✨' : '点击圆圈完成今日打卡';
  $('todayHint').style.color = isDoneToday ? sel.color : 'var(--text-3)';
  const streak = Utils.currentStreak(sel.records);
  $('todayStreak').textContent = streak;
  $('todayEyebrow').style.color = sel.color;

  // 统计
  $('statCurrent').textContent = streak;
  $('statLongest').textContent = Utils.longestStreak(sel.records);
  const w = Utils.weekStats(sel.records);
  $('statWeek').textContent = Math.round(w.rate * 100);
  const m = Utils.monthStats(sel.records);
  $('statMonth').textContent = Math.round(m.rate * 100);

  // 月历
  renderCalendar(sel);

  // 管理卡
  $('inputName').value = sel.name;
  state.manageState.icon = sel.icon;
  state.manageState.color = sel.color;
  renderIconPicker($('iconPicker'), state.manageState, sel.color);
  renderColorPicker($('colorPicker'), state.manageState, sel.color);
}

function renderCalendar(sel) {
  $('calTitle').textContent = `${state.viewYear} 年 ${state.viewMonth + 1} 月`;
  const grid = $('calGrid');
  grid.innerHTML = '';
  const weeks = Utils.monthGrid(state.viewYear, state.viewMonth, sel.records);
  weeks.forEach((week) => {
    week.forEach((cell) => {
      const el = document.createElement('div');
      if (!cell) {
        el.className = 'cal-cell empty';
        grid.appendChild(el);
        return;
      }
      el.className = 'cal-cell';
      const todayKey = Utils.toDateKey(new Date());
      if (Utils.diffDays(cell.key, todayKey) > 0) el.classList.add('future');
      if (cell.isToday) el.classList.add('today');
      if (cell.done) {
        el.classList.add('done');
      }
      el.textContent = cell.day;
      el.title = `${cell.key} · ${cell.done ? '已完成' : '未完成'}`;
      el.onclick = async () => {
        // 仅允许今天及之前切换；未来不可打卡
        const today = new Date();
        const todayKey = Utils.toDateKey(today);
        if (Utils.diffDays(cell.key, todayKey) > 0) {
          toast('未来日期不可打卡');
          return;
        }
        await window.habitAPI.toggle(sel.id, cell.key);
        await reload();
      };
      grid.appendChild(el);
    });
  });
}

function renderIconPicker(container, manageState, activeColor) {
  container.innerHTML = '';
  ICONS.forEach((ic) => {
    const el = document.createElement('div');
    el.className = 'icon-opt' + (ic.key === manageState.icon ? ' active' : '');
    el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">${ic.svg}</svg>`;
    el.style.color = manageState.color;
    el.dataset.key = ic.key;
    el.onclick = () => {
      manageState.icon = ic.key;
      renderIconPicker(container, manageState, activeColor);
    };
    container.appendChild(el);
  });
}

function renderColorPicker(container, manageState, activeColor) {
  container.innerHTML = '';
  COLORS.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'color-opt' + (c === manageState.color ? ' active' : '');
    el.style.background = c;
    el.onclick = () => {
      manageState.color = c;
      renderColorPicker(container, manageState, activeColor);
      if (container.id === 'iconPicker') renderIconPicker(container, manageState);
      // 同步刷新图标 picker 颜色
      if (container.id === 'colorPicker') {
        renderIconPicker($('iconPicker'), manageState);
      }
    };
    container.appendChild(el);
  });
}

// ============ 行为 ============
function selectHabit(id) {
  state.selectedId = id;
  const sel = state.habits.find((h) => h.id === id);
  if (sel) {
    state.viewYear = new Date().getFullYear();
    state.viewMonth = new Date().getMonth();
  }
  renderSidebar();
  renderDetail();
}

async function toggleToday() {
  if (!state.selectedId) return;
  await window.habitAPI.toggle(state.selectedId);
  await reload();
}

function openModal(mode) {
  state.modalState = { mode, name: '', icon: ICONS[0], color: COLORS[0] };
  $('modalTitle').textContent = mode === 'create' ? '新建习惯' : '编辑习惯';
  $('modalName').value = '';
  $('modalOk').textContent = mode === 'create' ? '创建' : '保存';
  renderIconPicker($('modalIconPicker'), state.modalState);
  renderColorPicker($('modalColorPicker'), state.modalState);
  $('modalMask').hidden = false;
  setTimeout(() => $('modalName').focus(), 50);
}

function closeModal() {
  $('modalMask').hidden = true;
}

async function modalOk() {
  const name = $('modalName').value.trim();
  if (!name) { toast('请输入习惯名称'); return; }
  await window.habitAPI.create({
    name,
    icon: state.modalState.icon,
    color: state.modalState.color,
  });
  closeModal();
  await reload();
  // 选中新创建的
  if (state.habits.length > 0) selectHabit(state.habits[state.habits.length - 1].id);
  toast('已创建');
}

async function deleteHabit() {
  if (!state.selectedId) return;
  if (!confirm('确认删除该习惯及其所有打卡记录？此操作不可撤销。')) return;
  await window.habitAPI.remove(state.selectedId);
  state.selectedId = null;
  await reload();
  toast('已删除');
}

async function onNameInput(value) {
  if (!state.selectedId) return;
  await window.habitAPI.update(state.selectedId, { name: value });
  await reload();
}

async function onIconChange(icon) {
  if (!state.selectedId) return;
  await window.habitAPI.update(state.selectedId, { icon });
  await reload();
}

async function onColorChange(color) {
  if (!state.selectedId) return;
  await window.habitAPI.update(state.selectedId, { color });
  await reload();
}

// ============ Toast ============
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  // 重启动画
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.hidden = true; }, 320);
  }, 2200);
}

// ============ 工具 ============
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function hexToRgba(hex, alpha) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ============ 顶部今日标签 ============
function updateTodayLabel() {
  const d = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  $('todayLabel').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${week}`;
}

// ============ 事件绑定 ============
function bindEvents() {
  $('btnAdd').onclick = () => openModal('create');
  $('modalCancel').onclick = closeModal;
  $('modalOk').onclick = modalOk;
  $('modalMask').onclick = (e) => { if (e.target.id === 'modalMask') closeModal(); };
  $('modalName').addEventListener('keydown', (e) => { if (e.key === 'Enter') modalOk(); });

  $('todayCheck').onclick = toggleToday;
  $('btnDelete').onclick = deleteHabit;

  // 名称输入防抖
  let nameTimer;
  $('inputName').addEventListener('input', (e) => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => onNameInput(e.target.value), 500);
  });

  // 图标/颜色 picker 在 manage 卡里
  $('iconPicker').addEventListener('click', (e) => {
    const opt = e.target.closest('.icon-opt');
    if (!opt) return;
    const ic = opt.dataset.key;
    state.manageState.icon = ic;
    renderIconPicker($('iconPicker'), state.manageState);
    onIconChange(ic);
  });
  $('colorPicker').addEventListener('click', (e) => {
    const opt = e.target.closest('.color-opt');
    if (!opt) return;
    const c = opt.style.background;
    // 取 rgb → hex
    const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    let hex = c;
    if (m) hex = '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    state.manageState.color = hex;
    renderColorPicker($('colorPicker'), state.manageState);
    renderIconPicker($('iconPicker'), state.manageState);
    onColorChange(hex);
  });

  // 月份导航
  $('prevMonth').onclick = () => {
    state.viewMonth -= 1;
    if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear -= 1; }
    renderDetail();
  };
  $('nextMonth').onclick = () => {
    state.viewMonth += 1;
    if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear += 1; }
    renderDetail();
  };
  $('goToday').onclick = () => {
    state.viewYear = new Date().getFullYear();
    state.viewMonth = new Date().getMonth();
    renderDetail();
  };

  // 导入/导出
  $('btnExport').onclick = async () => {
    const p = await window.habitAPI.saveExport();
    if (p) toast(`已导出到 ${p}`);
  };
  $('btnImport').onclick = async () => {
    const r = await window.habitAPI.pickImport();
    if (!r) return;
    if (r.ok) { await reload(); toast(`已导入 ${r.count} 个习惯`); }
    else toast('导入失败：' + (r.error || '格式错误'));
  };

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('modalMask').hidden) closeModal();
    }
    // 空格切换今日打卡
    if (e.code === 'Space' && state.selectedId && $('modalMask').hidden) {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        e.preventDefault();
        toggleToday();
      }
    }
  });
}

// ============ 启动 ============
async function init() {
  updateTodayLabel();
  bindEvents();
  await reload();
  // 默认选中第一个
  if (state.habits.length > 0 && !state.selectedId) {
    selectHabit(state.habits[0].id);
  } else if (state.habits.length === 0) {
    // 首次启动：内置示例习惯 + 历史打卡记录（让统计有数据可看）
    const h1 = await window.habitAPI.create({ name: '每日阅读 20 分钟', icon: 'book', color: '#007aff' });
    const h2 = await window.habitAPI.create({ name: '喝水 8 杯', icon: 'drop', color: '#34c759' });
    const h3 = await window.habitAPI.create({ name: '晨跑 30 分钟', icon: 'run', color: '#ff9500' });
    // 读书：过去 7 天连续打卡（含今天）
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      await window.habitAPI.toggle(h1.id, Utils.toDateKey(d));
    }
    // 喝水：过去 5 天打卡
    for (let i = 0; i < 5; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      await window.habitAPI.toggle(h2.id, Utils.toDateKey(d));
    }
    // 晨跑：过去 10 天里 6 天打卡（顺序 await 避免数据竞争）
    for (const i of [0, 1, 3, 4, 6, 7]) {
      const d = new Date(); d.setDate(d.getDate() - i);
      await window.habitAPI.toggle(h3.id, Utils.toDateKey(d));
    }
    await reload();
    if (state.habits.length > 0) selectHabit(state.habits[0].id);
  }
}

document.addEventListener('DOMContentLoaded', init);
