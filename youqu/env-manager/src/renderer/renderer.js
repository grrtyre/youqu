// renderer.js - 环境变量管家 · 渲染层逻辑

'use strict';

const api = window.envAPI;

// ===== 状态 =====
const state = {
  userVars: [],
  systemVars: [],
  scope: 'user',           // 'user' | 'system'
  query: '',
  isAdmin: false,
  // PATH 编辑器临时状态
  pathEditing: { scope: null, paths: [] },
  // 恢复备份临时状态
  restoreData: null
};

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const el = {
  searchInput: $('searchInput'),
  refreshBtn: $('refreshBtn'),
  backupBtn: $('backupBtn'),
  restoreBtn: $('restoreBtn'),
  newBtn: $('newBtn'),
  adminBanner: $('adminBanner'),
  relaunchAdminBtn: $('relaunchAdminBtn'),
  userCount: $('userCount'),
  systemCount: $('systemCount'),
  tableBody: $('tableBody'),
  afdianLink: $('afdianLink'),
  toast: $('toast'),
  // 编辑模态框
  editModal: $('editModal'),
  editTitle: $('editTitle'),
  editName: $('editName'),
  editValue: $('editValue'),
  editExpand: $('editExpand'),
  editNameHint: $('editNameHint'),
  editSave: $('editSave'),
  // PATH 模态框
  pathModal: $('pathModal'),
  pathScopeLabel: $('pathScopeLabel'),
  pathNewInput: $('pathNewInput'),
  pathAddBtn: $('pathAddBtn'),
  pathList: $('pathList'),
  pathSaveBtn: $('pathSaveBtn'),
  // 恢复模态框
  restoreModal: $('restoreModal'),
  restoreSummary: $('restoreSummary'),
  restoreUserChk: $('restoreUserChk'),
  restoreSystemChk: $('restoreSystemChk'),
  restoreUserDiff: $('restoreUserDiff'),
  restoreSystemDiff: $('restoreSystemDiff'),
  restoreApplyBtn: $('restoreApplyBtn')
};

let editMode = { isNew: true, originalName: null, scope: 'user' };

// ===== 工具函数 =====
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(v, max) {
  const s = String(v == null ? '' : v);
  return s.length <= max ? s : s.slice(0, max) + '…';
}

let toastTimer = null;
function toast(msg, type) {
  el.toast.textContent = msg;
  el.toast.className = 'toast' + (type ? ' ' + type : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.add('hidden');
  }, 2600);
}

// ===== 数据加载 =====
async function loadAll() {
  el.tableBody.innerHTML = '<div class="empty"><div class="empty-spin"></div><p>正在加载环境变量…</p></div>';
  const [u, s, a] = await Promise.all([
    api.read('user'),
    api.read('system'),
    api.isAdmin()
  ]);
  if (u.ok) {
    state.userVars = u.data || [];
  } else {
    state.userVars = [];
    toast('用户变量读取失败：' + u.error, 'error');
  }
  if (s.ok) {
    state.systemVars = s.data || [];
  } else {
    state.systemVars = [];
    // 系统变量读取失败通常静默处理
  }
  state.isAdmin = a.ok ? !!a.data : false;
  el.userCount.textContent = state.userVars.length;
  el.systemCount.textContent = state.systemVars.length;
  if (!state.isAdmin) {
    el.adminBanner.classList.remove('hidden');
  } else {
    el.adminBanner.classList.add('hidden');
  }
  renderTable();
}

function currentVars() {
  return state.scope === 'system' ? state.systemVars : state.userVars;
}

// ===== 渲染表格 =====
function renderTable() {
  const all = currentVars();
  const q = state.query.trim().toLowerCase();
  const list = q ? all.filter((v) => {
    return (v.name || '').toLowerCase().indexOf(q) !== -1 ||
           (v.value || '').toLowerCase().indexOf(q) !== -1;
  }) : all;

  if (list.length === 0) {
    el.tableBody.innerHTML = `
      <div class="empty">
        <p>${q ? '没有匹配的变量' : (all.length === 0 ? '暂无环境变量' : '没有匹配的变量')}</p>
      </div>`;
    return;
  }

  const html = list.map((v) => {
    const isPath = /^path$/i.test(v.name);
    const isExpand = v.type === 'REG_EXPAND_SZ';
    const canEdit = state.scope === 'user' || state.isAdmin;
    const pathBtn = isPath ? `
      <button class="icon-btn path" title="PATH 可视化编辑" data-act="path" data-name="${escapeHtml(v.name)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>` : '';
    const editBtn = canEdit ? `
      <button class="icon-btn edit" title="编辑" data-act="edit" data-name="${escapeHtml(v.name)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>` : `
      <button class="icon-btn" title="查看（只读）" data-act="edit" data-name="${escapeHtml(v.name)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
      </button>`;
    const copyBtn = `
      <button class="icon-btn" title="复制值" data-act="copy" data-name="${escapeHtml(v.name)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>`;
    const delBtn = canEdit ? `
      <button class="icon-btn del" title="删除" data-act="del" data-name="${escapeHtml(v.name)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>` : '';
    return `
      <div class="table-row">
        <div class="col-name ${isPath ? 'is-path' : ''}" title="${escapeHtml(v.name)}"><span class="name-text">${escapeHtml(v.name)}</span></div>
        <div class="col-type"><span class="type-tag ${isExpand ? 'expand' : ''}">${escapeHtml(v.type)}</span></div>
        <div class="col-value" title="${escapeHtml(v.value)}">${escapeHtml(truncate(v.value, 120))}</div>
        <div class="col-ops">
          ${pathBtn}${editBtn}${copyBtn}${delBtn}
        </div>
      </div>`;
  }).join('');

  el.tableBody.innerHTML = html;
}

// ===== 表格事件委托 =====
el.tableBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.getAttribute('data-act');
  const name = btn.getAttribute('data-name');
  const vars = currentVars();
  const v = vars.find((x) => x.name === name);
  if (!v) return;

  if (act === 'copy') {
    const r = await api.copy(v.value);
    if (r.ok) toast('已复制 ' + name + ' 的值', 'success');
    else toast('复制失败：' + r.error, 'error');
  } else if (act === 'edit') {
    openEditModal(false, v);
  } else if (act === 'del') {
    if (!confirm('确认删除变量「' + name + '」？\n\n此操作会立即修改注册表，请确保已备份。')) return;
    const r = await api.delete({ scope: state.scope, name: name });
    if (r.ok) {
      toast('已删除 ' + name, 'success');
      await loadAll();
    } else {
      toast('删除失败：' + r.error, 'error');
    }
  } else if (act === 'path') {
    openPathEditor(v);
  }
});

// ===== 标签切换 =====
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.scope = tab.getAttribute('data-scope');
    renderTable();
  });
});

// ===== 搜索 =====
el.searchInput.addEventListener('input', () => {
  state.query = el.searchInput.value;
  renderTable();
});

// ===== 刷新 =====
el.refreshBtn.addEventListener('click', async () => {
  el.refreshBtn.querySelector('svg').style.animation = 'spin 0.6s linear';
  await loadAll();
  setTimeout(() => { el.refreshBtn.querySelector('svg').style.animation = ''; }, 600);
  toast('已刷新', 'success');
});

// ===== 管理员重启 =====
el.relaunchAdminBtn.addEventListener('click', async () => {
  const r = await api.relaunchAsAdmin();
  if (!r.ok) toast('重启失败：' + r.error, 'error');
});

// ===== 新建变量 =====
el.newBtn.addEventListener('click', () => {
  if (state.scope === 'system' && !state.isAdmin) {
    toast('系统变量为只读，请先以管理员身份重启', 'error');
    return;
  }
  openEditModal(true, null);
});

// ===== 编辑模态框 =====
function openEditModal(isNew, v) {
  editMode = { isNew: !!isNew, originalName: isNew ? null : v.name, scope: state.scope };
  el.editTitle.textContent = isNew ? '新建变量' : ('编辑变量 · ' + v.name);
  el.editName.value = isNew ? '' : v.name;
  el.editValue.value = isNew ? '' : v.value;
  el.editExpand.checked = isNew ? false : (v.type === 'REG_EXPAND_SZ');
  el.editNameHint.textContent = '';
  el.editName.disabled = !isNew ? true : false;
  // 系统变量只读时也允许查看（字段只读）
  const canEdit = state.scope === 'user' || state.isAdmin;
  el.editName.readOnly = !isNew || !canEdit;
  el.editValue.readOnly = !canEdit;
  el.editExpand.disabled = !canEdit;
  el.editSave.style.display = canEdit ? '' : 'none';
  // 自动检测 %VAR% 引用
  toggleExpandSuggestion();
  el.editModal.classList.remove('hidden');
  if (isNew) setTimeout(() => el.editName.focus(), 60);
}

function toggleExpandSuggestion() {
  const val = el.editValue.value;
  const hasRef = /%[A-Za-z0-9_().$\-]+%/.test(val);
  const hint = document.getElementById('expandHint');
  if (hasRef && !el.editExpand.checked) {
    hint.textContent = '检测到 %...% 引用，建议勾选可扩展类型';
    hint.style.color = 'var(--accent)';
  } else {
    hint.textContent = '含 %...% 引用时建议勾选';
    hint.style.color = 'var(--text-3)';
  }
}

el.editValue.addEventListener('input', toggleExpandSuggestion);

el.editName.addEventListener('input', () => {
  const name = el.editName.value;
  if (!name) { el.editNameHint.textContent = ''; return; }
  // 简单校验
  if (!/^[A-Za-z0-9_().$\-]+$/.test(name)) {
    el.editNameHint.textContent = '仅允许字母、数字、_ () . $ -';
  } else if (/^\d/.test(name)) {
    el.editNameHint.textContent = '名称不能以数字开头';
  } else {
    el.editNameHint.textContent = '';
  }
});

el.editSave.addEventListener('click', async () => {
  const name = el.editName.value.trim();
  const value = el.editValue.value;
  const expand = el.editExpand.checked;
  if (!name) { el.editNameHint.textContent = '名称不能为空'; return; }
  if (!/^[A-Za-z0-9_().$\-]+$/.test(name)) { el.editNameHint.textContent = '仅允许字母、数字、_ () . $ -'; return; }
  if (/^\d/.test(name)) { el.editNameHint.textContent = '名称不能以数字开头'; return; }

  // 重命名检查：新建时若已存在
  if (editMode.isNew) {
    const exists = currentVars().some((x) => x.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      el.editNameHint.textContent = '该变量已存在';
      return;
    }
  }

  const type = expand ? 'REG_EXPAND_SZ' : 'REG_SZ';
  el.editSave.disabled = true;
  el.editSave.textContent = '保存中…';
  const r = await api.set({ scope: editMode.scope, name: name, value: value, type: type });
  el.editSave.disabled = false;
  el.editSave.textContent = '保存';
  if (r.ok) {
    el.editModal.classList.add('hidden');
    toast(editMode.isNew ? '已创建 ' + name : '已更新 ' + name, 'success');
    await loadAll();
  } else {
    toast('保存失败：' + r.error, 'error');
  }
});

// ===== PATH 编辑器 =====
function openPathEditor(v) {
  state.pathEditing.scope = state.scope;
  state.pathEditing.paths = (v.value || '').split(';').filter((p) => p !== undefined);
  // 保留空段以便标红
  el.pathScopeLabel.textContent = state.scope === 'system' ? '系统变量' : '用户变量';
  renderPathList();
  el.pathNewInput.value = '';
  el.pathModal.classList.remove('hidden');
  setTimeout(() => el.pathNewInput.focus(), 60);
}

function renderPathList() {
  const paths = state.pathEditing.paths;
  if (paths.length === 0) {
    el.pathList.innerHTML = '<div class="diff-empty">PATH 为空，在上方输入路径并添加</div>';
    return;
  }
  el.pathList.innerHTML = paths.map((p, i) => {
    const empty = p === '';
    return `
      <div class="path-item ${empty ? 'empty-seg' : ''}" draggable="true" data-idx="${i}">
        <span class="path-drag" title="拖动排序">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="6" r="1.5" fill="currentColor"/><circle cx="15" cy="6" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="18" r="1.5" fill="currentColor"/><circle cx="15" cy="18" r="1.5" fill="currentColor"/></svg>
        </span>
        <span class="path-index">${i + 1}</span>
        <span class="path-text" title="${escapeHtml(p)}">${empty ? '(空段 - 可能是拼写错误)' : escapeHtml(p)}</span>
        <button class="path-del" data-del="${i}" title="删除">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </button>
      </div>`;
  }).join('');
}

el.pathAddBtn.addEventListener('click', addPath);
el.pathNewInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addPath(); }
});

function addPath() {
  const v = el.pathNewInput.value.trim();
  if (!v) return;
  state.pathEditing.paths.push(v);
  el.pathNewInput.value = '';
  renderPathList();
  el.pathNewInput.focus();
}

el.pathList.addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (!del) return;
  const idx = parseInt(del.getAttribute('data-del'), 10);
  state.pathEditing.paths.splice(idx, 1);
  renderPathList();
});

// 拖拽排序
let dragIdx = null;
el.pathList.addEventListener('dragstart', (e) => {
  const item = e.target.closest('.path-item');
  if (!item) return;
  dragIdx = parseInt(item.getAttribute('data-idx'), 10);
  item.classList.add('dragging');
});
el.pathList.addEventListener('dragend', (e) => {
  const item = e.target.closest('.path-item');
  if (item) item.classList.remove('dragging');
  el.pathList.querySelectorAll('.path-item').forEach((i) => i.classList.remove('drag-over'));
});
el.pathList.addEventListener('dragover', (e) => {
  e.preventDefault();
  const item = e.target.closest('.path-item');
  if (!item) return;
  el.pathList.querySelectorAll('.path-item').forEach((i) => i.classList.remove('drag-over'));
  item.classList.add('drag-over');
});
el.pathList.addEventListener('drop', (e) => {
  e.preventDefault();
  const item = e.target.closest('.path-item');
  if (!item || dragIdx === null) return;
  const targetIdx = parseInt(item.getAttribute('data-idx'), 10);
  const paths = state.pathEditing.paths;
  const moved = paths.splice(dragIdx, 1)[0];
  paths.splice(targetIdx, 0, moved);
  dragIdx = null;
  renderPathList();
});

el.pathSaveBtn.addEventListener('click', async () => {
  const paths = state.pathEditing.paths;
  const value = paths.filter((p) => p !== undefined && p !== null).join(';');
  // PATH 通常是 REG_EXPAND_SZ
  const hasRef = /%[A-Za-z0-9_().$\-]+%/.test(value);
  const type = 'REG_EXPAND_SZ';
  el.pathSaveBtn.disabled = true;
  el.pathSaveBtn.textContent = '保存中…';
  const r = await api.set({ scope: state.pathEditing.scope, name: 'Path', value: value, type: type });
  el.pathSaveBtn.disabled = false;
  el.pathSaveBtn.textContent = '保存 PATH';
  if (r.ok) {
    el.pathModal.classList.add('hidden');
    toast('PATH 已更新（共 ' + paths.length + ' 项）', 'success');
    await loadAll();
  } else {
    toast('保存失败：' + r.error, 'error');
  }
});

// ===== 备份导出 =====
el.backupBtn.addEventListener('click', async () => {
  const r = await api.exportBackup({ user: state.userVars, system: state.systemVars });
  if (r.ok) {
    toast('已导出备份到：' + r.path, 'success');
  } else if (r.canceled) {
    // 用户取消，静默
  } else {
    toast('导出失败：' + r.error, 'error');
  }
});

// ===== 备份导入 =====
el.restoreBtn.addEventListener('click', async () => {
  const r = await api.importBackup();
  if (r.canceled) return;
  if (!r.ok) { toast('导入失败：' + r.error, 'error'); return; }
  state.restoreData = r.data;
  renderRestorePreview();
  el.restoreModal.classList.remove('hidden');
});

function computeDiff(before, after) {
  const beforeMap = new Map(before.map((v) => [v.name, v]));
  const afterMap = new Map(after.map((v) => [v.name, v]));
  const added = [], removed = [], modified = [];
  for (const [name, v] of afterMap.entries()) {
    if (!beforeMap.has(name)) added.push({ name, value: v.value });
    else if (beforeMap.get(name).value !== v.value) modified.push({ name, value: v.value, oldValue: beforeMap.get(name).value });
  }
  for (const [name] of beforeMap.entries()) {
    if (!afterMap.has(name)) removed.push({ name, value: beforeMap.get(name).value });
  }
  added.sort((a, b) => a.name.localeCompare(b.name));
  removed.sort((a, b) => a.name.localeCompare(b.name));
  modified.sort((a, b) => a.name.localeCompare(b.name));
  return { added, removed, modified };
}

function renderRestorePreview() {
  const data = state.restoreData;
  if (!data) return;
  const userDiff = computeDiff(state.userVars, data.user);
  const sysDiff = computeDiff(state.systemVars, data.system);

  const total = userDiff.added.length + userDiff.removed.length + userDiff.modified.length +
                sysDiff.added.length + sysDiff.removed.length + sysDiff.modified.length;

  el.restoreSummary.textContent = '备份包含 用户变量 ' + data.user.length + ' 项 · 系统变量 ' + data.system.length + ' 项 · 与当前差异共 ' + total + ' 处';

  el.restoreUserDiff.innerHTML = renderDiffList(userDiff);
  el.restoreSystemDiff.innerHTML = renderDiffList(sysDiff);

  // 系统变量恢复需管理员
  if (!state.isAdmin) {
    el.restoreSystemChk.disabled = true;
    el.restoreSystemChk.checked = false;
    document.querySelector('#restoreSystemTitle').textContent = '恢复系统变量（需管理员重启后操作）';
  } else {
    el.restoreSystemChk.disabled = false;
    document.querySelector('#restoreSystemTitle').textContent = '恢复系统变量';
  }
}

function renderDiffList(diff) {
  const items = [];
  diff.added.forEach((d) => items.push(`<div class="diff-item added"><span class="diff-tag">新增</span><span class="diff-name">${escapeHtml(d.name)}</span><span>${escapeHtml(truncate(d.value, 60))}</span></div>`));
  diff.removed.forEach((d) => items.push(`<div class="diff-item removed"><span class="diff-tag">删除</span><span class="diff-name">${escapeHtml(d.name)}</span><span>${escapeHtml(truncate(d.value, 60))}</span></div>`));
  diff.modified.forEach((d) => items.push(`<div class="diff-item modified"><span class="diff-tag">修改</span><span class="diff-name">${escapeHtml(d.name)}</span><span>${escapeHtml(truncate(d.oldValue, 30))} → ${escapeHtml(truncate(d.value, 30))}</span></div>`));
  if (items.length === 0) return '<div class="diff-empty">无差异</div>';
  return items.join('');
}

el.restoreApplyBtn.addEventListener('click', async () => {
  const doUser = el.restoreUserChk.checked;
  const doSystem = el.restoreSystemChk.checked && !el.restoreSystemChk.disabled;
  if (!doUser && !doSystem) { toast('请至少选择一项恢复范围', 'error'); return; }
  if (!confirm('确认执行恢复？\n\n此操作会覆盖选定的环境变量，修改立即生效。建议先导出当前备份。')) return;

  el.restoreApplyBtn.disabled = true;
  el.restoreApplyBtn.textContent = '恢复中…';
  let okCount = 0, failCount = 0;
  const tasks = [];
  if (doUser) {
    state.restoreData.user.forEach((v) => {
      tasks.push({ scope: 'user', name: v.name, value: v.value, type: v.type });
    });
  }
  if (doSystem) {
    state.restoreData.system.forEach((v) => {
      tasks.push({ scope: 'system', name: v.name, value: v.value, type: v.type });
    });
  }
  for (const t of tasks) {
    const r = await api.set(t);
    if (r.ok) okCount++;
    else failCount++;
  }
  el.restoreApplyBtn.disabled = false;
  el.restoreApplyBtn.textContent = '执行恢复';
  if (failCount === 0) {
    el.restoreModal.classList.add('hidden');
    toast('恢复完成，共写入 ' + okCount + ' 项', 'success');
    await loadAll();
  } else {
    toast('恢复完成，成功 ' + okCount + ' 项，失败 ' + failCount + ' 项', 'error');
    await loadAll();
  }
});

// ===== 模态框关闭 =====
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close]') || e.target.matches('.modal-mask')) {
    // 点击遮罩或关闭按钮
    const mask = e.target.closest('.modal-mask');
    if (mask) {
      // 仅当点击的就是遮罩本身或关闭按钮时关闭
      if (e.target === mask || e.target.matches('[data-close]')) {
        mask.classList.add('hidden');
      }
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-mask:not(.hidden)').forEach((m) => m.classList.add('hidden'));
  }
});

// ===== 爱发电 =====
el.afdianLink.addEventListener('click', async () => {
  await api.openExternal('https://www.ifdian.net/a/giquwei');
});

// ===== 启动 =====
loadAll();
