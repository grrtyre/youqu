// 许可证管理器 - 渲染进程逻辑
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  licenses: [],
  filter: { status: 'all', category: 'all', keyword: '' },
  editingId: null
};

const CATEGORY_LABELS = {
  productivity: '生产力', development: '开发工具', design: '设计',
  games: '游戏', system: '系统工具', security: '安全', other: '其他'
};

// ============ 工具 ============
function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 250);
  }, 1800);
}

function uuid() {
  return 'L-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return key.slice(0, 4) + ' •••••••• ' + key.slice(-4);
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function getStatus(license) {
  if (license.perpetual) return 'perpetual';
  if (!license.expiryDate) return 'active';
  const exp = new Date(license.expiryDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = daysBetween(now, exp);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'active';
}

function statusBadge(status) {
  const map = {
    active: { text: '有效', cls: 'badge-active' },
    expiring: { text: '即将到期', cls: 'badge-expiring' },
    expired: { text: '已过期', cls: 'badge-expired' },
    perpetual: { text: '永久', cls: 'badge-perpetual' }
  };
  const m = map[status] || map.active;
  return `<span class="card-badge ${m.cls}">${m.text}</span>`;
}

function formatCurrency(n) {
  if (!n || isNaN(n)) return '¥0';
  return '¥' + Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('zh-CN'); } catch (e) { return d; }
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板');
  } catch (e) {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('已复制到剪贴板');
  }
}

// ============ 锁屏逻辑 ============
async function initLockScreen() {
  const status = await window.api.vault.status();
  if (!status.initialized) {
    $('#setupForm').classList.remove('hidden');
    $('#unlockForm').classList.add('hidden');
    $('#lockTitle').textContent = '创建保险库';
    $('#lockSubtitle').textContent = '设置主密码，开始安全管理你的许可证';
    setTimeout(() => $('#setupPwd').focus(), 50);
  } else {
    $('#setupForm').classList.add('hidden');
    $('#unlockForm').classList.remove('hidden');
    $('#lockTitle').textContent = '解锁保险库';
    $('#lockSubtitle').textContent = '请输入主密码继续';
    setTimeout(() => $('#unlockPwd').focus(), 50);
  }
}

$('#setupBtn').addEventListener('click', async () => {
  const p1 = $('#setupPwd').value;
  const p2 = $('#setupPwd2').value;
  if (p1.length < 6) { showToast('密码至少 6 位'); return; }
  if (p1 !== p2) { showToast('两次输入不一致'); return; }
  try {
    await window.api.vault.setup(p1);
    showToast('保险库已创建');
    enterApp();
  } catch (e) {
    showToast('创建失败：' + e.message);
  }
});

$('#unlockBtn').addEventListener('click', async () => {
  const pwd = $('#unlockPwd').value;
  try {
    await window.api.vault.unlock(pwd);
    enterApp();
  } catch (e) {
    const err = $('#unlockError');
    err.textContent = e.message;
    err.classList.remove('hidden');
    $('#unlockPwd').value = '';
  }
});

$('#unlockPwd').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#unlockBtn').click();
});
$('#setupPwd2').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#setupBtn').click();
});

async function enterApp() {
  $('#lockScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await loadLicenses();
}

async function lockApp() {
  await window.api.vault.lock();
  $('#app').classList.add('hidden');
  $('#lockScreen').classList.remove('hidden');
  $('#unlockPwd').value = '';
  $('#unlockError').classList.add('hidden');
  $('#setupForm').classList.add('hidden');
  $('#unlockForm').classList.remove('hidden');
  $('#lockTitle').textContent = '解锁保险库';
  $('#lockSubtitle').textContent = '请输入主密码继续';
  setTimeout(() => $('#unlockPwd').focus(), 50);
}

window.api.app.onAutoLocked(() => {
  showToast('已自动锁定');
  lockApp();
});

// ============ 数据加载 ============
async function loadLicenses() {
  try {
    state.licenses = await window.api.licenses.list();
    renderAll();
  } catch (e) {
    if (e.message === 'VAULT_LOCKED') {
      lockApp();
    } else {
      showToast('加载失败：' + e.message);
    }
  }
}

function getFiltered() {
  const kw = state.filter.keyword.trim().toLowerCase();
  return state.licenses.filter(l => {
    if (state.filter.status !== 'all') {
      const s = getStatus(l);
      if (state.filter.status === 'perpetual') {
        if (s !== 'perpetual') return false;
      } else if (s !== state.filter.status) return false;
    }
    if (state.filter.category !== 'all' && l.category !== state.filter.category) return false;
    if (kw) {
      const haystack = [l.name, l.vendor, l.licenseKey, l.notes].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    return true;
  });
}

function renderAll() {
  renderStats();
  renderList();
}

function renderStats() {
  const list = state.licenses;
  $('#statTotal').textContent = list.length;
  const expiring = list.filter(l => getStatus(l) === 'expiring').length;
  $('#statExpiring').textContent = expiring;
  const totalValue = list.reduce((sum, l) => sum + (parseFloat(l.price) || 0), 0);
  $('#statValue').textContent = formatCurrency(totalValue);
}

function renderList() {
  const filtered = getFiltered();
  const listEl = $('#licenseList');
  const emptyEl = $('#emptyState');

  if (state.licenses.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:var(--text-tertiary); font-size:13px;">没有符合条件的许可证</div>`;
    return;
  }

  // 按到期日期升序，无到期日的排后
  filtered.sort((a, b) => {
    if (a.perpetual && b.perpetual) return (a.name || '').localeCompare(b.name || '');
    if (a.perpetual) return 1;
    if (b.perpetual) return -1;
    return new Date(a.expiryDate || '9999-12-31') - new Date(b.expiryDate || '9999-12-31');
  });

  listEl.innerHTML = filtered.map(l => {
    const status = getStatus(l);
    const initial = (l.name || '?').charAt(0).toUpperCase();
    const daysLeft = l.expiryDate ? daysBetween(new Date(), new Date(l.expiryDate)) : null;
    let daysText = '';
    if (l.perpetual) daysText = '永久';
    else if (daysLeft !== null) {
      if (daysLeft < 0) daysText = `已过期 ${-daysLeft} 天`;
      else if (daysLeft === 0) daysText = '今天到期';
      else daysText = `剩余 ${daysLeft} 天`;
    }
    const activationText = (l.maxActivations || l.usedActivations) ?
      `${l.usedActivations || 0} / ${l.maxActivations || '∞'}` : '—';

    return `
      <div class="license-card" data-id="${l.id}">
        <div class="card-head">
          <div class="card-icon">${initial}</div>
          <div class="card-title-wrap">
            <div class="card-title">${escapeHtml(l.name || '未命名')}</div>
            <div class="card-vendor">${escapeHtml(l.vendor || '未知厂商')}</div>
          </div>
          ${statusBadge(status)}
        </div>
        <div class="card-row"><span class="label">分类</span><span class="value">${CATEGORY_LABELS[l.category] || '其他'}</span></div>
        <div class="card-row"><span class="label">到期</span><span class="value">${formatDate(l.expiryDate)}${daysText ? ' · ' + daysText : ''}</span></div>
        <div class="card-row"><span class="label">激活</span><span class="value">${activationText}</span></div>
        <div class="card-row"><span class="label">价格</span><span class="value">${formatCurrency(l.price)}</span></div>
        <div class="card-key">
          <code>${escapeHtml(maskKey(l.licenseKey))}</code>
          <button data-action="copy" data-key="${escapeHtml(l.licenseKey || '')}" title="复制完整密钥">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M6 1.5h5a1.5 1.5 0 011.5 1.5v5" stroke="currentColor" stroke-width="1.3"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.license-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="copy"]')) return;
      const id = card.dataset.id;
      openEdit(id);
    });
  });
  listEl.querySelectorAll('[data-action="copy"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyText(btn.dataset.key);
    });
  });
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============ 过滤 ============
$('#statusFilters').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  $$('#statusFilters li').forEach(x => x.classList.remove('active'));
  li.classList.add('active');
  state.filter.status = li.dataset.status;
  renderList();
  window.api.app.resetActivity();
});

$('#categoryFilters').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  $$('#categoryFilters li').forEach(x => x.classList.remove('active'));
  li.classList.add('active');
  state.filter.category = li.dataset.category;
  renderList();
  window.api.app.resetActivity();
});

$('#searchInput').addEventListener('input', (e) => {
  state.filter.keyword = e.target.value;
  renderList();
  window.api.app.resetActivity();
});

// ============ 新增/编辑 ============
$('#addBtn').addEventListener('click', () => openEdit(null));

function openEdit(id) {
  state.editingId = id;
  const modal = $('#editModal');
  const license = id ? state.licenses.find(l => l.id === id) : null;
  if (license) {
    $('#modalTitle').textContent = '编辑许可证';
    $('#fName').value = license.name || '';
    $('#fVendor').value = license.vendor || '';
    $('#fKey').value = license.licenseKey || '';
    $('#fCategory').value = license.category || 'productivity';
    $('#fPurchase').value = license.purchaseDate || '';
    $('#fExpiry').value = license.expiryDate || '';
    $('#fPerpetual').checked = !!license.perpetual;
    $('#fPrice').value = license.price || '';
    $('#fMaxAct').value = license.maxActivations || '';
    $('#fUsedAct').value = license.usedActivations || '';
    $('#fNotes').value = license.notes || '';
    $('#deleteBtn').classList.remove('hidden');
    updatePerpetualUI();
  } else {
    $('#modalTitle').textContent = '新增许可证';
    ['fName','fVendor','fKey','fPurchase','fExpiry','fPrice','fMaxAct','fUsedAct','fNotes'].forEach(id => $('#' + id).value = '');
    $('#fCategory').value = 'productivity';
    $('#fPerpetual').checked = false;
    $('#deleteBtn').classList.add('hidden');
    updatePerpetualUI();
  }
  modal.classList.remove('hidden');
  setTimeout(() => $('#fName').focus(), 50);
}

function updatePerpetualUI() {
  const checked = $('#fPerpetual').checked;
  $('#fExpiry').disabled = checked;
  if (checked) $('#fExpiry').value = '';
}

$('#fPerpetual').addEventListener('change', updatePerpetualUI);

$('#modalClose').addEventListener('click', () => closeModal());
$('#cancelBtn').addEventListener('click', () => closeModal());
$('#editModal .modal-backdrop').addEventListener('click', () => closeModal());

function closeModal() {
  $('#editModal').classList.add('hidden');
  state.editingId = null;
}

$('#saveBtn').addEventListener('click', async () => {
  const name = $('#fName').value.trim();
  const key = $('#fKey').value.trim();
  if (!name) { showToast('请填写软件名称'); return; }
  if (!key) { showToast('请填写许可证密钥'); return; }

  const data = {
    name,
    vendor: $('#fVendor').value.trim(),
    licenseKey: key,
    category: $('#fCategory').value,
    purchaseDate: $('#fPurchase').value || null,
    expiryDate: $('#fPerpetual').checked ? null : ($('#fExpiry').value || null),
    perpetual: $('#fPerpetual').checked,
    price: $('#fPrice').value ? parseFloat($('#fPrice').value) : null,
    maxActivations: $('#fMaxAct').value ? parseInt($('#fMaxAct').value) : null,
    usedActivations: $('#fUsedAct').value ? parseInt($('#fUsedAct').value) : null,
    notes: $('#fNotes').value.trim() || null
  };

  if (state.editingId) {
    const idx = state.licenses.findIndex(l => l.id === state.editingId);
    if (idx >= 0) {
      state.licenses[idx] = { ...state.licenses[idx], ...data, updatedAt: Date.now() };
    }
  } else {
    state.licenses.push({ id: uuid(), ...data, createdAt: Date.now(), updatedAt: Date.now() });
  }

  try {
    await window.api.licenses.save(state.licenses);
    closeModal();
    renderAll();
    showToast(state.editingId ? '已更新' : '已添加');
  } catch (e) {
    showToast('保存失败：' + e.message);
  }
});

$('#deleteBtn').addEventListener('click', async () => {
  if (!state.editingId) return;
  if (!confirm('确认删除此许可证？此操作不可撤销。')) return;
  state.licenses = state.licenses.filter(l => l.id !== state.editingId);
  try {
    await window.api.licenses.save(state.licenses);
    closeModal();
    renderAll();
    showToast('已删除');
  } catch (e) {
    showToast('删除失败：' + e.message);
  }
});

$('#copyKeyBtn').addEventListener('click', () => {
  copyText($('#fKey').value);
});

// ============ 菜单 ============
$('#menuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#menuDropdown').classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#menuBtn') && !e.target.closest('#menuDropdown')) {
    $('#menuDropdown').classList.add('hidden');
  }
});

$('#menuDropdown').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  $('#menuDropdown').classList.add('hidden');
  if (action === 'lock') {
    await lockApp();
  } else if (action === 'export') {
    const r = await window.api.vault.exportBackup();
    if (r.ok) showToast('已导出到：' + r.path);
  } else if (action === 'import') {
    const pwd = prompt('请输入备份文件的密码：');
    if (pwd === null) return;
    try {
      const r = await window.api.vault.importBackup(pwd);
      if (r.ok) {
        showToast(`导入完成：新增 ${r.added} 条，共 ${r.total} 条`);
        await loadLicenses();
      }
    } catch (err) {
      showToast('导入失败：' + err.message);
    }
  } else if (action === 'changePwd') {
    ['oldPwd','newPwd','newPwd2'].forEach(id => $('#' + id).value = '');
    $('#pwdModal').classList.remove('hidden');
  } else if (action === 'about') {
    $('#aboutModal').classList.remove('hidden');
  }
});

// 关闭关于/改密弹窗
document.addEventListener('click', (e) => {
  const target = e.target;
  if (target.dataset && target.dataset.action === 'closeAbout') {
    $('#aboutModal').classList.add('hidden');
  }
  if (target.dataset && target.dataset.action === 'closePwd') {
    $('#pwdModal').classList.add('hidden');
  }
  if (target.classList && target.classList.contains('modal-backdrop')) {
    if (target.parentElement.id === 'aboutModal') $('#aboutModal').classList.add('hidden');
    if (target.parentElement.id === 'pwdModal') $('#pwdModal').classList.add('hidden');
  }
});

// 关于 - 爱发电链接
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-url]');
  if (a) {
    e.preventDefault();
    window.api.app.openExternal(a.dataset.url);
  }
});

// 修改密码
$('#changePwdBtn').addEventListener('click', async () => {
  const oldP = $('#oldPwd').value;
  const newP = $('#newPwd').value;
  const newP2 = $('#newPwd2').value;
  if (newP.length < 6) { showToast('新密码至少 6 位'); return; }
  if (newP !== newP2) { showToast('两次新密码不一致'); return; }
  try {
    await window.api.vault.changePassword(oldP, newP);
    $('#pwdModal').classList.add('hidden');
    showToast('密码已修改');
  } catch (err) {
    showToast(err.message);
  }
});

// ============ 启动 ============
initLockScreen();

// demo 模式：自动解锁进入主界面
window.api.app.onDemoReady(async () => {
  try {
    await window.api.vault.unlock('demo123456');
    await enterApp();
  } catch (e) {
    console.error('demo unlock failed', e);
  }
});
