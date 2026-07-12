'use strict';
// 启动项管家 - 渲染逻辑
const { list, toggle, delete: del, add, openLocation, openExternal } = window.api;

// 来源 → 中性文字标签（不再用彩色 badge，减少视觉噪音）
function sourceLabel(entry) {
  const src = entry.source || '';
  if (entry.regPath) {
    if (entry.hive === 'HKLM') return '注册表 · 所有用户';
    return '注册表 · 当前用户';
  }
  if (/启动文件夹·所有用户/.test(src)) return '启动文件夹 · 所有用户';
  if (/启动文件夹/.test(src)) return '启动文件夹 · 当前用户';
  return src || '未知';
}

let allEntries = [];
let currentFilter = 'all';
let currentKw = '';

// 渲染列表
function render() {
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  let items = allEntries;
  // 状态过滤
  if (currentFilter === 'enabled') items = items.filter(e => e.status !== 'disabled');
  else if (currentFilter === 'disabled') items = items.filter(e => e.status === 'disabled');
  // 关键字过滤
  if (currentKw) {
    const kw = currentKw.toLowerCase();
    items = items.filter(e =>
      (e.name && e.name.toLowerCase().includes(kw)) ||
      (e.value && e.value.toLowerCase().includes(kw)) ||
      (e.source && e.source.toLowerCase().includes(kw))
    );
  }
  // 排序：启用在前，禁用在后；同类按名称
  items.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'disabled' ? 1 : -1;
    return (a.name || '').localeCompare(b.name || '', 'zh');
  });

  listEl.innerHTML = '';
  if (items.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  for (const e of items) {
    const disabled = e.status === 'disabled';
    const src = sourceLabel(e);
    const first = (e.name || '?').trim().charAt(0).toUpperCase();
    const cmd = e.value || '';

    const row = document.createElement('div');
    row.className = 'item' + (disabled ? ' disabled' : '');
    row.innerHTML = `
      <div class="item-ico">${escapeHtml(first)}</div>
      <div class="item-main">
        <div class="item-name">
          ${escapeHtml(e.name || '(未命名)')}
          <span class="badge ${disabled ? 'badge-off' : 'badge-on'}">${disabled ? '已禁用' : '已启用'}</span>
        </div>
        <div class="item-cmd" title="${escapeAttr(cmd)}">${escapeHtml(cmd) || '<span style="color:#c7c7cc">无命令</span>'}</div>
        <div class="item-src">${escapeHtml(src)}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" title="打开文件位置" data-act="open">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </button>
        <button class="icon-btn danger" title="删除" data-act="del">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
        <div class="switch ${disabled ? '' : 'on'}" data-act="toggle" title="${disabled ? '启用' : '禁用'}"></div>
      </div>
    `;
    // 事件
    row.querySelector('[data-act="toggle"]').addEventListener('click', () => onToggle(e));
    row.querySelector('[data-act="del"]').addEventListener('click', () => onDelete(e));
    row.querySelector('[data-act="open"]').addEventListener('click', () => onOpen(e));
    listEl.appendChild(row);
  }
}

// 统计
function renderStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-enabled').textContent = stats.enabled;
  document.getElementById('stat-disabled').textContent = stats.disabled;
  document.getElementById('stat-sources').textContent = Object.keys(stats.bySource || {}).length;
}

// 加载
async function load() {
  showLoading(true);
  const res = await list();
  showLoading(false);
  if (!res.ok) {
    toast('加载失败：' + (res.error || '未知错误'));
    allEntries = [];
    renderStats({ total: 0, enabled: 0, disabled: 0, bySource: {} });
    render();
    return;
  }
  allEntries = res.data || [];
  renderStats(res.stats);
  render();
}

function showLoading(b) {
  document.getElementById('loading').classList.toggle('hidden', !b);
  document.getElementById('list').classList.toggle('hidden', b);
  document.getElementById('empty').classList.add('hidden');
}

// 切换启用/禁用
async function onToggle(entry) {
  const disable = entry.status !== 'disabled';
  const res = await toggle(entry, disable);
  if (!res.ok) {
    toast(res.error || '操作失败');
    return;
  }
  entry.status = disable ? 'disabled' : 'enabled';
  renderStats(computeStatsLocal());
  render();
  toast(disable ? '已禁用 ' + entry.name : '已启用 ' + entry.name);
}

// 删除
let pendingDelete = null;
function onDelete(entry) {
  pendingDelete = entry;
  document.getElementById('confirm-name').textContent = entry.name || '';
  document.getElementById('confirm').classList.remove('hidden');
}
async function doDelete() {
  if (!pendingDelete) return;
  const entry = pendingDelete;
  document.getElementById('confirm').classList.add('hidden');
  pendingDelete = null;
  const res = await del(entry);
  if (!res.ok) { toast(res.error || '删除失败'); return; }
  allEntries = allEntries.filter(e => e !== entry);
  renderStats(computeStatsLocal());
  render();
  toast('已删除 ' + entry.name);
}

// 打开位置
async function onOpen(entry) {
  const res = await openLocation(entry);
  if (!res.ok) toast(res.error || '无法打开');
}

function computeStatsLocal() {
  return {
    total: allEntries.length,
    enabled: allEntries.filter(e => e.status !== 'disabled').length,
    disabled: allEntries.filter(e => e.status === 'disabled').length,
    bySource: allEntries.reduce((m, e) => { const s = e.source || '未知'; m[s] = (m[s]||0)+1; return m; }, {})
  };
}

// 新增弹窗
function openAddModal() {
  document.getElementById('f-name').value = '';
  document.getElementById('f-command').value = '';
  document.getElementById('modal-error').classList.add('hidden');
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('f-name').focus(), 50);
}
async function doAdd() {
  const input = {
    name: document.getElementById('f-name').value.trim(),
    command: document.getElementById('f-command').value.trim()
  };
  const errEl = document.getElementById('modal-error');
  if (!input.name) { errEl.textContent = '请填写名称'; errEl.classList.remove('hidden'); return; }
  if (!input.command) { errEl.textContent = '请填写启动命令'; errEl.classList.remove('hidden'); return; }
  const res = await add(input);
  if (!res.ok) { errEl.textContent = res.error || '新增失败'; errEl.classList.remove('hidden'); return; }
  document.getElementById('modal').classList.add('hidden');
  toast('已添加 ' + input.name);
  load();
}

// toast
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 220);
  }, 1900);
}

// 转义
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// 事件绑定
document.getElementById('btn-refresh').addEventListener('click', load);
document.getElementById('btn-add').addEventListener('click', openAddModal);
document.getElementById('search').addEventListener('input', (e) => { currentKw = e.target.value.trim(); render(); });
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    currentFilter = t.dataset.filter;
    render();
  });
});
document.getElementById('modal-ok').addEventListener('click', doAdd);
document.getElementById('modal-cancel').addEventListener('click', () => document.getElementById('modal').classList.add('hidden'));
document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal').classList.add('hidden'));
document.getElementById('confirm-ok').addEventListener('click', doDelete);
document.getElementById('confirm-cancel').addEventListener('click', () => { document.getElementById('confirm').classList.add('hidden'); pendingDelete = null; });
document.getElementById('afdian').addEventListener('click', (e) => { e.preventDefault(); openExternal('https://www.ifdian.net/a/giquwei'); });

// 回车提交新增
document.getElementById('f-command').addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
document.getElementById('f-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('f-command').focus(); });

// 启动
load();
