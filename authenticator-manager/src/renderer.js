// authenticator-manager 渲染进程
// 负责：TOTP 生成（Web Crypto）、列表渲染、倒计时环、复制、增删改查、设置
'use strict';

/* ============ TOTP 核心实现（Web Crypto API，无外部依赖） ============ */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(str) {
  str = String(str || '').toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const c of str) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

const ALG_MAP = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };

async function generateTOTP(secret, period = 30, digits = 6, algorithm = 'SHA1') {
  const keyBytes = base32Decode(secret);
  if (keyBytes.length === 0) return '------';
  const counter = Math.floor(Date.now() / 1000 / period);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  const alg = ALG_MAP[algorithm] || 'SHA-1';
  try {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: alg }, false, ['sign']);
    const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);
    const code = binary % Math.pow(10, digits);
    return code.toString().padStart(digits, '0');
  } catch (e) {
    return '------';
  }
}

// 解析 otpauth:// URI
function parseOtpauth(uri) {
  try {
    if (!/^otpauth:\/\/totp\//i.test(uri)) return null;
    const u = new URL(uri);
    const secret = u.searchParams.get('secret');
    if (!secret) return null;
    const label = decodeURIComponent(u.pathname.replace(/^\/totp\//i, ''));
    let issuer = u.searchParams.get('issuer') || '';
    let displayLabel = label;
    if (!issuer && label.includes(':')) {
      const [i, l] = label.split(':', 2);
      issuer = i.trim();
      displayLabel = l.trim();
    } else if (!issuer) {
      displayLabel = label;
    }
    return {
      issuer: issuer || '',
      label: displayLabel || '',
      secret: secret.toUpperCase().replace(/\s/g, ''),
      period: parseInt(u.searchParams.get('period') || '30', 10) || 30,
      digits: parseInt(u.searchParams.get('digits') || '6', 10) || 6,
      algorithm: (u.searchParams.get('algorithm') || 'SHA1').toUpperCase()
    };
  } catch (_) { return null; }
}

/* ============ 状态 ============ */
const isElectron = !!(window.api && window.api.accounts);
let accounts = [];
let settings = { hotkey: 'CommandOrControl+Shift+A', autoHide: true, hideAfterCopy: true, hideDelayMs: 1200 };
let searchQuery = '';
let editingId = null;
const codeCache = new Map(); // id -> { code, period, generatedAt }

// 头像颜色：统一使用 #007aff 单色系，保持苹果白的克制与干净
const AVATAR_COLOR = '#007aff';
function colorFor() { return AVATAR_COLOR; }
function initialOf(str) {
  const s = (str || '?').trim();
  return s ? s[0].toUpperCase() : '?';
}

/* ============ Demo 数据（非 Electron 环境用于截图） ============ */
const DEMO_ACCOUNTS = [
  { id: 'd1', issuer: 'GitHub', label: 'alice@dev.io', secret: 'JBSWY3DPEHPK3PXP', period: 30, digits: 6, algorithm: 'SHA1', createdAt: Date.now(), order: 0 },
  { id: 'd2', issuer: 'Google', label: 'alice@gmail.com', secret: 'GEZDGNBVGY3TQOJQ', period: 30, digits: 6, algorithm: 'SHA1', createdAt: Date.now(), order: 1 },
  { id: 'd3', issuer: 'Microsoft', label: 'work@outlook.com', secret: 'MFZWIZLTOQ3GK3TF', period: 60, digits: 6, algorithm: 'SHA1', createdAt: Date.now(), order: 2 },
  { id: 'd4', issuer: 'AWS', label: 'iam-root', secret: 'NNSXG43XO7ASECBO', period: 30, digits: 6, algorithm: 'SHA1', createdAt: Date.now(), order: 3 },
  { id: 'd5', issuer: 'Notion', label: 'team workspace', secret: 'OBQXG43XN5ZGI', period: 30, digits: 6, algorithm: 'SHA1', createdAt: Date.now(), order: 4 },
  { id: 'd6', issuer: 'Discord', label: 'alice#1234', secret: 'ONSWG4TFOQQGC3DM', period: 60, digits: 6, algorithm: 'SHA1', createdAt: Date.now(), order: 5 }
];

/* ============ DOM ============ */
const $ = (s) => document.querySelector(s);
const listEl = $('#list');
const emptyEl = $('#empty');
const searchInput = $('#search');
const fab = $('#btn-add');
const modal = $('#modal');
const modalTitle = $('#modal-title');
const form = $('#account-form');
const fId = $('#f-id');
const fIssuer = $('#f-issuer');
const fLabel = $('#f-label');
const fSecret = $('#f-secret');
const fDigits = $('#f-digits');
const fPeriod = $('#f-period');
const fAlgo = $('#f-algo');
const settingsModal = $('#settings-modal');
const toastEl = $('#toast');

/* ============ Toast ============ */
let toastTimer = null;
function toast(msg, withCheck) {
  toastEl.innerHTML = withCheck ? '<span class="check">✓</span>' + msg : msg;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => { toastEl.hidden = true; }, 250);
  }, 1600);
}

/* ============ 渲染 ============ */
function filteredAccounts() {
  if (!searchQuery) return accounts;
  const q = searchQuery.toLowerCase();
  return accounts.filter(a =>
    (a.issuer || '').toLowerCase().includes(q) ||
    (a.label || '').toLowerCase().includes(q)
  );
}

function formatCode(code) {
  // 6 位 -> "123 456"，8 位 -> "1234 5678"，其它原样
  if (code.length === 6) return code.slice(0, 3) + '<span class="group-sep"> </span>' + code.slice(3);
  if (code.length === 8) return code.slice(0, 4) + '<span class="group-sep"> </span>' + code.slice(4);
  if (code.length === 7) return code.slice(0, 3) + '<span class="group-sep"> </span>' + code.slice(3);
  return code;
}

function renderList() {
  const list = filteredAccounts();
  if (list.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = accounts.length > 0; // 全空显示空状态；有账户但搜索无结果显示空
    if (accounts.length > 0 && searchQuery) {
      emptyEl.hidden = false;
      emptyEl.querySelector('h2').textContent = '未找到匹配账户';
      emptyEl.querySelector('p').textContent = '试试其他关键词';
    } else if (accounts.length === 0) {
      emptyEl.querySelector('h2').textContent = '还没有账户';
      emptyEl.querySelector('p').textContent = '点击下方按钮添加你的第一个两步验证账户';
    }
    return;
  }
  emptyEl.hidden = true;
  listEl.innerHTML = list.map(a => {
    const color = colorFor(a.issuer || a.label || '?');
    const init = initialOf(a.issuer || a.label || '?');
    const cached = codeCache.get(a.id);
    const codeHtml = cached ? formatCode(cached.code) : '<span style="color:var(--text-tertiary)">······</span>';
    const remain = cached ? Math.max(0, a.period - Math.floor((Date.now() / 1000) % a.period)) : a.period;
    const dash = 2 * Math.PI * 14; // r=14
    const progress = remain / a.period;
    const offset = dash * (1 - progress);
    const dangerCls = remain <= 5 ? ' danger' : (remain <= 10 ? ' warn' : '');
    return `
      <div class="account-card" data-id="${a.id}" style="--avatar-color:${color}">
        <div class="avatar">${init}</div>
        <div class="account-main">
          <span class="account-issuer">${escapeHtml(a.issuer || '未命名')}</span>
          <span class="account-label">${escapeHtml(a.label || '')}</span>
        </div>
        <div class="account-code">${codeHtml}</div>
        <div class="account-actions">
          <div class="ring" title="剩余 ${remain}s">
            <svg width="34" height="34" viewBox="0 0 34 34">
              <circle class="track" cx="17" cy="17" r="14" fill="none" stroke-width="3"/>
              <circle class="progress${dangerCls}" cx="17" cy="17" r="14" fill="none" stroke-width="3"
                stroke-dasharray="${dash}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
            </svg>
            <span class="count${dangerCls}">${remain}</span>
          </div>
          <div class="actions-hover">
            <button class="icon-btn" data-act="edit" title="编辑" aria-label="编辑">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </button>
            <button class="icon-btn danger" data-act="delete" title="删除" aria-label="删除">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============ 刷新验证码 ============ */
async function refreshCodes() {
  if (accounts.length === 0) return;
  const now = Math.floor(Date.now() / 1000);
  const tasks = accounts.map(async (a) => {
    const cached = codeCache.get(a.id);
    const slot = Math.floor(now / a.period);
    const needRefresh = !cached || cached.slot !== slot;
    if (needRefresh) {
      const code = await generateTOTP(a.secret, a.period, a.digits, a.algorithm);
      codeCache.set(a.id, { code, slot });
    }
  });
  await Promise.all(tasks);
  renderList();
}

// 仅更新倒计时环和数字（轻量，不重渲染整个列表）
function tickRings() {
  const cards = listEl.querySelectorAll('.account-card');
  cards.forEach(card => {
    const id = card.dataset.id;
    const a = accounts.find(x => x.id === id);
    if (!a) return;
    const remain = Math.max(0, a.period - Math.floor((Date.now() / 1000) % a.period));
    const ring = card.querySelector('.ring');
    if (!ring) return;
    const progress = ring.querySelector('.progress');
    const count = ring.querySelector('.count');
    const dash = 2 * Math.PI * 14;
    const offset = dash * (1 - remain / a.period);
    progress.setAttribute('stroke-dashoffset', offset.toFixed(2));
    progress.classList.remove('warn', 'danger');
    count.classList.remove('danger');
    if (remain <= 5) { progress.classList.add('danger'); count.classList.add('danger'); }
    else if (remain <= 10) { progress.classList.add('warn'); }
    count.textContent = remain;
    ring.title = `剩余 ${remain}s`;
  });
}

/* ============ 复制 ============ */
async function copyCode(id) {
  const a = accounts.find(x => x.id === id);
  if (!a) return;
  const cached = codeCache.get(id);
  if (!cached) return;
  try {
    await navigator.clipboard.writeText(cached.code);
  } catch (_) {
    // 回退
    const ta = document.createElement('textarea');
    ta.value = cached.code;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  const card = listEl.querySelector(`.account-card[data-id="${id}"]`);
  if (card) {
    card.classList.add('copied');
    setTimeout(() => card.classList.remove('copied'), 700);
  }
  toast('已复制 ' + a.issuer + ' 的验证码', true);
  if (isElectron && settings.hideAfterCopy) {
    setTimeout(() => { if (window.api) window.api.window.hide(); }, settings.hideDelayMs);
  }
}

/* ============ 增删改 ============ */
function openModal(id) {
  editingId = id || null;
  if (id) {
    const a = accounts.find(x => x.id === id);
    if (!a) return;
    modalTitle.textContent = '编辑账户';
    fId.value = a.id;
    fIssuer.value = a.issuer || '';
    fLabel.value = a.label || '';
    fSecret.value = a.secret || '';
    fDigits.value = String(a.digits || 6);
    fPeriod.value = String(a.period || 30);
    fAlgo.value = (a.algorithm || 'SHA1').toUpperCase();
  } else {
    modalTitle.textContent = '添加账户';
    form.reset();
    fId.value = '';
    fDigits.value = '6';
    fPeriod.value = '30';
    fAlgo.value = 'SHA1';
  }
  modal.hidden = false;
  setTimeout(() => fIssuer.focus(), 50);
}
function closeModal() { modal.hidden = true; editingId = null; }

async function submitForm(e) {
  e.preventDefault();
  let issuer = fIssuer.value.trim();
  let label = fLabel.value.trim();
  let secret = fSecret.value.trim();
  let digits = parseInt(fDigits.value, 10) || 6;
  let period = parseInt(fPeriod.value, 10) || 30;
  let algorithm = fAlgo.value.toUpperCase();

  // 支持 otpauth:// 粘贴：若 secret 字段是 URI，则整体解析
  const parsed = parseOtpauth(secret);
  if (parsed) {
    issuer = parsed.issuer || issuer;
    label = parsed.label || label;
    secret = parsed.secret;
    digits = parsed.digits;
    period = parsed.period;
    algorithm = parsed.algorithm;
  } else {
    secret = secret.replace(/\s/g, '').toUpperCase();
  }
  if (!secret) { toast('请输入密钥'); return; }

  if (isElectron) {
    if (editingId) {
      accounts = await window.api.accounts.update(editingId, { issuer, label, secret, digits, period, algorithm });
    } else {
      accounts = await window.api.accounts.add({ issuer, label, secret, digits, period, algorithm });
    }
  } else {
    // Demo 模式
    if (editingId) {
      const idx = accounts.findIndex(a => a.id === editingId);
      if (idx >= 0) accounts[idx] = { ...accounts[idx], issuer, label, secret, digits, period, algorithm };
    } else {
      accounts.push({ id: 'demo-' + Date.now(), issuer, label, secret, digits, period, algorithm, createdAt: Date.now(), order: accounts.length });
    }
  }
  codeCache.clear();
  await refreshCodes();
  renderList();
  closeModal();
  toast(editingId ? '已更新' : '已添加', true);
}

async function deleteAccount(id) {
  const a = accounts.find(x => x.id === id);
  if (!a) return;
  if (!confirm(`确定删除「${a.issuer || '未命名'}」的验证码？\n此操作不可撤销，请确保你已备份或已关闭该账户的 2FA。`)) return;
  if (isElectron) {
    accounts = await window.api.accounts.delete(id);
  } else {
    accounts = accounts.filter(x => x.id !== id);
  }
  codeCache.delete(id);
  renderList();
  toast('已删除');
}

/* ============ 设置 ============ */
async function openSettings() {
  if (isElectron) settings = await window.api.settings.get();
  $('#set-autohide').checked = !!settings.autoHide;
  $('#set-hide-copy').checked = !!settings.hideAfterCopy;
  $('#set-hotkey').value = settings.hotkey || '';
  settingsModal.hidden = false;
}
async function saveSettings() {
  const patch = {
    autoHide: $('#set-autohide').checked,
    hideAfterCopy: $('#set-hide-copy').checked,
    hotkey: $('#set-hotkey').value.trim() || 'CommandOrControl+Shift+A'
  };
  if (isElectron) settings = await window.api.settings.set(patch);
  else settings = { ...settings, ...patch };
  settingsModal.hidden = false;
}

/* ============ 事件绑定 ============ */
function bindEvents() {
  // 标题栏按钮
  $('#btn-min').addEventListener('click', () => { if (isElectron) window.api.window.minimize(); });
  $('#btn-close').addEventListener('click', () => { if (isElectron) window.api.window.hide(); });
  $('#btn-settings').addEventListener('click', openSettings);

  // 搜索
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    $('#btn-clear-search').hidden = !searchQuery;
    renderList();
  });
  $('#btn-clear-search').addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    $('#btn-clear-search').hidden = true;
    searchInput.focus();
    renderList();
  });

  // FAB
  fab.addEventListener('click', () => openModal(null));

  // 列表点击（事件委托）
  listEl.addEventListener('click', (e) => {
    const card = e.target.closest('.account-card');
    if (!card) return;
    const id = card.dataset.id;
    const btn = e.target.closest('[data-act]');
    if (btn) {
      e.stopPropagation();
      if (btn.dataset.act === 'edit') openModal(id);
      else if (btn.dataset.act === 'delete') deleteAccount(id);
      return;
    }
    copyCode(id);
  });

  // Modal
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  form.addEventListener('submit', submitForm);

  // 设置
  $('#settings-close').addEventListener('click', () => settingsModal.hidden = true);
  $('#settings-done').addEventListener('click', () => { saveSettings(); settingsModal.hidden = true; toast('设置已保存', true); });
  settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.hidden = true; });
  $('#btn-export').addEventListener('click', async () => {
    if (isElectron) { const r = await window.api.backup.export(); toast(r.ok ? (r.note || '已导出') : '已取消'); }
    else toast('演示模式不支持导出');
  });
  $('#btn-import').addEventListener('click', async () => {
    if (isElectron) { const r = await window.api.backup.import(); toast(r.ok ? '已导入' : (r.error || '已取消')); if (r.ok) { accounts = await window.api.accounts.list(); codeCache.clear(); await refreshCodes(); } }
    else toast('演示模式不支持导入');
  });

  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!modal.hidden) closeModal();
      else if (!settingsModal.hidden) settingsModal.hidden = true;
    }
    // Ctrl/Cmd + F 聚焦搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

/* ============ 初始化 ============ */
async function init() {
  bindEvents();
  if (isElectron) {
    accounts = await window.api.accounts.list();
    settings = await window.api.settings.get();
  } else {
    // Edge headless 截图模式：载入示例数据
    accounts = DEMO_ACCOUNTS.slice();
  }
  await refreshCodes();
  renderList();
  // 每秒刷新倒计时环；每 5 秒重生成验证码（实际上 refreshCodes 内部按 slot 判断）
  setInterval(tickRings, 1000);
  setInterval(refreshCodes, 2000);
}

document.addEventListener('DOMContentLoaded', init);
