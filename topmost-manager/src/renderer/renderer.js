// 渲染层逻辑 - 置顶管家
const $ = (s) => document.querySelector(s);

const el = {
  list: $('#list'),
  listWrap: $('#listWrap'),
  empty: $('#empty'),
  loading: $('#loading'),
  search: $('#search'),
  autoRefresh: $('#autoRefresh'),
  btnRefresh: $('#btnRefresh'),
  btnTopFg: $('#btnTopFg'),
  count: $('#count'),
  status: $('#status'),
  // 侧栏
  statTotal: $('#statTotal'),
  statTop: $('#statTop'),
  autoPinSwitch: $('#autoPinSwitch'),
  ruleInput: $('#ruleInput'),
  btnAddRule: $('#btnAddRule'),
  ruleList: $('#ruleList'),
};

// 头像配色（柔和、Apple 风）
const AVATAR_COLORS = [
  '#007aff', '#34c759', '#ff9500', '#af52de', '#ff2d55',
  '#5ac8fa', '#5856d6', '#ff3b30', '#30b0c7', '#a2845e',
  '#bf5af2', '#ff6482', '#00c6be', '#ac8e68',
];
function colorFor(name) {
  const s = (name || '?').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initialOf(name) {
  const s = (name || '?').trim();
  if (!s) return '?';
  // 取第一个字母（支持中文取首字）
  return s.charAt(0).toUpperCase();
}

// 星标 SVG（填充 vs 描边）
const STAR_FILLED = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.6l1.9 4.05 4.45.42-3.35 2.96 1 4.37L8 11.25l-4 2.15 1-4.37L1.65 6.07l4.45-.42L8 1.6z"/></svg>';
const STAR_OUTLINE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.6l1.9 4.05 4.45.42-3.35 2.96 1 4.37L8 11.25l-4 2.15 1-4.37L1.65 6.07l4.45-.42L8 1.6z"/></svg>';

// 状态
let state = {
  windows: [],
  rules: { rules: [], autoPin: false },
  search: '',
  bridgeReady: false,
  refreshing: false,
};
let timer = null;
const REFRESH_INTERVAL = 2500;

// ---- 状态栏 ----
function setStatus(text, isErr) {
  el.status.textContent = text;
  el.status.classList.toggle('err', !!isErr);
}

// ---- 列表加载 ----
async function refresh() {
  if (state.refreshing) return;
  state.refreshing = true;
  try {
    const res = await window.api.listWindows();
    if (res && res.ok && Array.isArray(res.data)) {
      state.windows = res.data;
      state.bridgeReady = true;
      setStatus('就绪');
    } else {
      state.windows = [];
      setStatus(res && res.error ? ('错误：' + res.error) : '未获取到窗口', true);
    }
  } catch (e) {
    state.windows = [];
    setStatus('加载失败：' + (e.message || ''), true);
  } finally {
    state.refreshing = false;
    render();
  }
}

function startTimer() {
  stopTimer();
  timer = setInterval(() => { if (el.autoRefresh.checked) refresh(); }, REFRESH_INTERVAL);
}
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

// ---- 渲染 ----
function filtered() {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.windows;
  return state.windows.filter((w) =>
    (w.title || '').toLowerCase().includes(q) || (w.proc || '').toLowerCase().includes(q));
}

function isRule(proc) {
  const p = (proc || '').toLowerCase();
  return state.rules.rules.some((r) => r.proc === p && r.enabled);
}

function render() {
  const items = filtered();
  // 置顶的排前面
  items.sort((a, b) => (b.topmost ? 1 : 0) - (a.topmost ? 1 : 0));

  el.count.textContent = items.length + ' 个窗口';
  // 更新侧栏统计（基于全部窗口，不受搜索影响）
  if (el.statTotal) el.statTotal.textContent = state.windows.length;
  if (el.statTop) el.statTop.textContent = state.windows.filter((w) => w.topmost).length;

  if (!state.bridgeReady && state.windows.length === 0) {
    el.loading.classList.remove('hidden');
    el.empty.classList.add('hidden');
    el.list.innerHTML = '';
    return;
  }
  el.loading.classList.add('hidden');

  if (items.length === 0) {
    el.empty.classList.remove('hidden');
    el.list.innerHTML = '';
    return;
  }
  el.empty.classList.add('hidden');

  const frag = document.createDocumentFragment();
  for (const w of items) {
    frag.appendChild(renderCard(w));
  }
  el.list.innerHTML = '';
  el.list.appendChild(frag);
}

function renderCard(w) {
  const card = document.createElement('div');
  card.className = 'win-card' + (w.topmost ? ' is-top' : '');

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = initialOf(w.proc);

  const info = document.createElement('div');
  info.className = 'win-info';
  const titleRow = document.createElement('div');
  titleRow.className = 'win-title-row';
  const proc = document.createElement('span');
  proc.className = 'win-proc';
  proc.textContent = w.proc || '未知';
  proc.title = (w.proc || '') + ' (PID ' + w.pid + ')';
  titleRow.appendChild(proc);
  const desc = document.createElement('span');
  desc.className = 'win-desc';
  desc.textContent = w.title || '';
  desc.title = w.title || '';
  info.appendChild(titleRow);
  info.appendChild(desc);

  const controls = document.createElement('div');
  controls.className = 'win-controls';

  // 星标（加入规则）
  const star = document.createElement('button');
  star.className = 'star-btn' + (isRule(w.proc) ? ' active' : '');
  star.title = isRule(w.proc) ? '已在自动置顶规则中，点击移除' : '加入自动置顶规则';
  star.innerHTML = isRule(w.proc) ? STAR_FILLED : STAR_OUTLINE;
  star.addEventListener('click', () => onStar(w, star));
  controls.appendChild(star);

  // 内联透明度控件（仅置顶时显示）
  const alphaInline = document.createElement('div');
  alphaInline.className = 'alpha-inline' + (w.topmost ? ' show' : '');
  const aRange = document.createElement('input');
  aRange.type = 'range';
  aRange.className = 'alpha-range';
  aRange.min = 10; aRange.max = 100; aRange.step = 1;
  const startPct = w.topmost && w.alpha < 255 ? Math.round(w.alpha / 255 * 100) : 100;
  aRange.value = startPct;
  aRange.style.setProperty('--val', startPct + '%');
  const aVal = document.createElement('span');
  aVal.className = 'alpha-value';
  aVal.textContent = startPct + '%';
  aRange.addEventListener('input', () => {
    const v = parseInt(aRange.value, 10);
    aVal.textContent = v + '%';
    aRange.style.setProperty('--val', v + '%');
  });
  // 节流发送
  let alphaTimer = null;
  aRange.addEventListener('input', () => {
    if (alphaTimer) clearTimeout(alphaTimer);
    alphaTimer = setTimeout(() => {
      window.api.setAlpha(w.hwnd, parseInt(aRange.value, 10));
    }, 120);
  });
  alphaInline.appendChild(aRange);
  alphaInline.appendChild(aVal);
  controls.appendChild(alphaInline);

  // 置顶开关
  const sw = document.createElement('label');
  sw.className = 'switch';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!w.topmost;
  cb.addEventListener('change', () => onToggleTop(w, cb.checked, alphaInline, cb));
  const sl = document.createElement('span');
  sl.className = 'slider';
  sw.appendChild(cb);
  sw.appendChild(sl);
  controls.appendChild(sw);

  card.appendChild(avatar);
  card.appendChild(info);
  card.appendChild(controls);

  return card;
}

// ---- 交互 ----
async function onToggleTop(w, on, alphaInline, cb) {
  const res = await window.api.setTopmost(w.hwnd, on);
  if (res && res.ok) {
    w.topmost = on;
    // 更新视觉
    const card = alphaInline.closest('.win-card');
    if (card) card.classList.toggle('is-top', on);
    alphaInline.classList.toggle('show', on);
    if (!on) {
      // 取消置顶：重置透明度显示
      const r = alphaInline.querySelector('.alpha-range');
      const v = alphaInline.querySelector('.alpha-value');
      if (r) { r.value = 100; r.style.setProperty('--val', '100%'); }
      if (v) v.textContent = '100%';
    }
    // 置顶的排到前面，重新排序渲染
    setTimeout(() => render(), 60);
  } else {
    // 失败回滚
    cb.checked = !on;
    window.api.showToast(on ? '置顶失败' : '取消置顶失败');
  }
}

async function onStar(w, starBtn) {
  const proc = (w.proc || '').toLowerCase();
  if (!proc) return;
  if (isRule(w.proc)) {
    await window.api.removeRule(proc);
  } else {
    await window.api.addRule(proc);
  }
  await loadRules();
  // 更新所有同进程卡片星标
  document.querySelectorAll('.win-card').forEach((card) => {
    const p = card.querySelector('.win-proc');
    if (p && (p.textContent || '').toLowerCase() === proc) {
      const sb = card.querySelector('.star-btn');
      if (sb) {
        const active = isRule(proc);
        sb.classList.toggle('active', active);
        sb.title = active ? '已在自动置顶规则中，点击移除' : '加入自动置顶规则';
        sb.innerHTML = active ? STAR_FILLED : STAR_OUTLINE;
      }
    }
  });
}

// ---- 规则面板 ----
async function loadRules() {
  const res = await window.api.getRules();
  if (res && res.ok && res.data) {
    state.rules = res.data;
    el.autoPinSwitch.checked = !!res.data.autoPin;
    renderRules();
  }
}

function renderRules() {
  const rules = state.rules.rules || [];
  if (rules.length === 0) {
    el.ruleList.innerHTML = '<div class="rule-empty">暂无规则</div>';
    return;
  }
  el.ruleList.innerHTML = '';
  rules.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'rule-item' + (r.enabled ? '' : ' off');
    const name = document.createElement('span');
    name.className = 'rule-name';
    name.textContent = r.proc;
    name.title = r.proc;
    const sw = document.createElement('label');
    sw.className = 'rule-mini-switch';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!r.enabled;
    cb.addEventListener('change', async () => {
      await window.api.toggleRule(r.proc, cb.checked);
      await loadRules();
    });
    const sl = document.createElement('span');
    sl.className = 'slider';
    sw.appendChild(cb);
    sw.appendChild(sl);
    const del = document.createElement('button');
    del.className = 'rule-del';
    del.title = '删除规则';
    del.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    del.addEventListener('click', async () => {
      await window.api.removeRule(r.proc);
      await loadRules();
      render();
    });
    item.appendChild(name);
    item.appendChild(sw);
    item.appendChild(del);
    el.ruleList.appendChild(item);
  });
}

// ---- 事件绑定 ----
el.search.addEventListener('input', () => {
  state.search = el.search.value;
  render();
});

el.btnRefresh.addEventListener('click', () => refresh());

el.autoRefresh.addEventListener('change', () => {
  if (el.autoRefresh.checked) startTimer();
  else stopTimer();
});

el.btnTopFg.addEventListener('click', async () => {
  el.btnTopFg.disabled = true;
  try {
    const res = await window.api.toggleForeground();
    if (res && res.ok) {
      window.api.showToast(res.topmost ? ('已置顶：' + (res.title || '当前窗口')) : ('已取消置顶：' + (res.title || '当前窗口')));
      setTimeout(() => refresh(), 200);
    } else {
      window.api.showToast('未获取到前台窗口');
    }
  } catch (e) {
    window.api.showToast('操作失败');
  } finally {
    el.btnTopFg.disabled = false;
  }
});

el.btnAddRule.addEventListener('click', async () => {
  const v = el.ruleInput.value.trim();
  if (!v) return;
  await window.api.addRule(v);
  el.ruleInput.value = '';
  await loadRules();
  render();
});
el.ruleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el.btnAddRule.click();
});

el.autoPinSwitch.addEventListener('change', async () => {
  await window.api.setAutoPin(el.autoPinSwitch.checked);
  await loadRules();
});

// 桥接就绪
window.api.onBridgeReady((ok) => {
  state.bridgeReady = ok;
  if (ok) {
    setStatus('就绪');
    refresh();
  } else {
    setStatus('窗口桥接启动失败，请重试', true);
    el.loading.classList.add('hidden');
    el.empty.classList.remove('hidden');
  }
});

// ---- 初始化 ----
async function init() {
  await loadRules();
  await refresh();
  startTimer();
  // 1.5 秒后若仍在 loading 且无数据，再强制刷新一次（应对桥接慢启动）
  setTimeout(() => {
    if (!state.bridgeReady && state.windows.length === 0) refresh();
  }, 1800);
}
init();
