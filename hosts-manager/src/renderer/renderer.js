'use strict';
// Hosts管家 - 渲染层逻辑

// 当前状态
let state = {
  items: [],          // 解析后的条目数组
  content: '',        // 原始文本
  canWrite: false,    // 是否有写入权限
  mode: 'list',       // 'list' | 'raw'
  profiles: [],        // 已保存方案
  searchQuery: '',    // 搜索词
  editingIndex: -1,   // 正在编辑的条目索引
  rawEdited: false    // 源码模式是否已编辑
};

// DOM 引用
const $ = (id) => document.getElementById(id);
const entryList = $('entryList');
const rawMode = $('rawMode');
const rawTextarea = $('rawTextarea');
const searchInput = $('searchInput');
const statsEl = $('stats');
const footerText = $('footerText');
const footerHostsPath = $('footerHostsPath');
const statusBadge = $('statusBadge');
const profileList = $('profileList');
const templateList = $('templateList');
const backupList = $('backupList');
const toast = $('toast');

// ==================== 初始化 ====================

async function init() {
  showToast('正在加载…');
  try {
    // 加载 hosts 内容
    const result = await window.hostsAPI.readHosts();
    state.content = result.content;
    state.items = result.items;
    state.canWrite = result.canWrite;
    // 如果 hosts 内容太少，加载演示数据使界面更充实
    const entryCount = state.items.filter(i => i.type === 'entry').length;
    if (entryCount < 3) {
      const templates = await window.hostsAPI.getTemplates();
      // 组合多个模板使界面更充实
      const demoContent = templates[0].content + '\n' + templates[1].content;
      state.content = demoContent;
      state.items = parseHostsLocal(demoContent);
    }
    updateStatusBadge();
    renderEntries();
    updateStats();
    footerHostsPath.textContent = 'hosts: ' + (result.canWrite ? '可读写' : '只读');

    // 加载方案
    state.profiles = await window.hostsAPI.loadProfiles();
    renderProfiles();

    // 加载模板
    const templates = await window.hostsAPI.getTemplates();
    renderTemplates(templates);

    // 加载备份列表
    const backups = await window.hostsAPI.listBackups();
    renderBackups(backups);

    showToast('已加载 hosts 文件', 'success');
  } catch (err) {
    showToast('加载失败: ' + err.message, 'error');
  }
}

// ==================== 状态显示 ====================

function updateStatusBadge() {
  if (state.canWrite) {
    statusBadge.className = 'status-badge ok';
    statusBadge.querySelector('.status-text').textContent = '管理员权限';
  } else {
    statusBadge.className = 'status-badge warn';
    statusBadge.querySelector('.status-text').textContent = '需提权写入';
  }
}

// ==================== 渲染条目列表 ====================

function renderEntries() {
  const query = state.searchQuery.toLowerCase().trim();
  const items = state.items;

  // 过滤
  let displayItems = items.map((item, index) => ({ item, index }));
  if (query) {
    displayItems = displayItems.filter(({ item }) => {
      if (item.type !== 'entry') return false;
      const text = (item.ip + ' ' + item.hostnames.join(' ') + ' ' + (item.comment || '')).toLowerCase();
      return text.includes(query);
    });
  }

  if (displayItems.length === 0) {
    entryList.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-tertiary);font-size:13px">' +
      (query ? '没有匹配的条目' : 'hosts 文件为空，点击「添加」开始编辑') +
      '</div>';
    return;
  }

  let html = '';
  let entryAltIndex = 0;
  for (const { item, index } of displayItems) {
    if (item.type === 'blank') {
      html += '<div class="entry-blank-row"></div>';
    } else if (item.type === 'comment') {
      html += '<div class="entry-comment-row">' +
        '<svg class="comment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '<span class="comment-text">' + escapeHtml(item.text) + '</span>' +
        '</div>';
      entryAltIndex = 0; // 重置交替计数
    } else if (item.type === 'entry') {
      const altClass = (entryAltIndex % 2 === 1) ? ' alt' : '';
      html += renderEntryCard(item, index, altClass);
      entryAltIndex++;
    }
  }
  entryList.innerHTML = html;
  attachEntryEvents();
}

function renderEntryCard(item, index, altClass) {
  altClass = altClass || '';
  const editing = state.editingIndex === index;
  const disabledClass = item.enabled ? '' : ' disabled';

  if (editing) {
    return '<div class="entry-card editing' + disabledClass + altClass + '" data-index="' + index + '">' +
      '<label class="toggle"><input type="checkbox" ' + (item.enabled ? 'checked' : '') + ' data-action="toggle" data-index="' + index + '"><span class="toggle-slider"></span></label>' +
      '<div class="entry-content">' +
      '<input class="edit-input ip" data-field="ip" value="' + escapeAttr(item.ip) + '" placeholder="IP地址" />' +
      '<input class="edit-input host" data-field="hostnames" value="' + escapeAttr(item.hostnames.join(' ')) + '" placeholder="域名（空格分隔）" />' +
      '<input class="edit-input comment" data-field="comment" value="' + escapeAttr(item.comment || '') + '" placeholder="注释" />' +
      '</div>' +
      '<div class="entry-actions">' +
      '<button class="icon-btn" data-action="save" data-index="' + index + '" title="保存"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></button>' +
      '<button class="icon-btn" data-action="cancel" data-index="' + index + '" title="取消"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      '</div>';
  }

  let hostHtml = '';
  for (let i = 0; i < item.hostnames.length; i++) {
    if (i > 0) hostHtml += '<span class="entry-host-sep">·</span>';
    hostHtml += '<span class="entry-host">' + escapeHtml(item.hostnames[i]) + '</span>';
  }

  let commentHtml = '';
  if (item.comment) {
    commentHtml = '<span class="entry-comment"># ' + escapeHtml(item.comment) + '</span>';
  }

  return '<div class="entry-card' + disabledClass + altClass + '" data-index="' + index + '">' +
    '<label class="toggle"><input type="checkbox" ' + (item.enabled ? 'checked' : '') + ' data-action="toggle" data-index="' + index + '"><span class="toggle-slider"></span></label>' +
    '<div class="entry-content">' +
    '<span class="entry-ip">' + escapeHtml(item.ip) + '</span>' +
    hostHtml +
    commentHtml +
    '</div>' +
    '<div class="entry-actions">' +
    '<button class="icon-btn" data-action="edit" data-index="' + index + '" title="编辑"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>' +
    '<button class="icon-btn" data-action="delete" data-index="' + index + '" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
    '</div>' +
    '</div>';
}

function attachEntryEvents() {
  const cards = entryList.querySelectorAll('.entry-card');
  cards.forEach(card => {
    const index = parseInt(card.dataset.index, 10);

    // 双击编辑
    card.addEventListener('dblclick', (e) => {
      if (e.target.closest('.toggle') || e.target.closest('button') || e.target.closest('input')) return;
      state.editingIndex = index;
      renderEntries();
    });

    // 开关
    const toggle = card.querySelector('[data-action="toggle"]');
    if (toggle) {
      toggle.addEventListener('change', () => {
        toggleEntry(index);
      });
    }

    // 编辑/删除按钮
    card.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      if (action === 'toggle') return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleEntryAction(action, index);
      });
    });

    // 编辑模式输入框
    if (state.editingIndex === index) {
      const inputs = card.querySelectorAll('.edit-input');
      inputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') handleEntryAction('save', index);
          if (e.key === 'Escape') handleEntryAction('cancel', index);
        });
      });
      // 自动聚焦第一个输入框
      const firstInput = card.querySelector('.edit-input');
      if (firstInput) firstInput.focus();
    }
  });
}

// ==================== 条目操作 ====================

function toggleEntry(index) {
  const item = state.items[index];
  if (!item || item.type !== 'entry') return;
  item.enabled = !item.enabled;
  item.raw = serializeLine(item);
  renderEntries();
  updateStats();
  updateRawFromItems();
}

function handleEntryAction(action, index) {
  const item = state.items[index];
  if (!item) return;

  if (action === 'toggle') return; // 已在 change 事件处理

  if (action === 'edit') {
    state.editingIndex = index;
    renderEntries();
  } else if (action === 'cancel') {
    state.editingIndex = -1;
    renderEntries();
  } else if (action === 'save') {
    const card = entryList.querySelector('.entry-card[data-index="' + index + '"]');
    if (!card) return;
    const ip = card.querySelector('[data-field="ip"]').value.trim();
    const hostnames = card.querySelector('[data-field="hostnames"]').value.trim().split(/\s+/).filter(Boolean);
    const comment = card.querySelector('[data-field="comment"]').value.trim();

    if (!ip) { showToast('请输入 IP 地址', 'warn'); return; }
    if (hostnames.length === 0) { showToast('请输入至少一个域名', 'warn'); return; }

    item.ip = ip;
    item.hostnames = hostnames;
    item.comment = comment;
    item.raw = serializeLine(item);
    state.editingIndex = -1;
    renderEntries();
    updateStats();
    updateRawFromItems();
    showToast('已更新条目', 'success');
  } else if (action === 'delete') {
    state.items.splice(index, 1);
    state.editingIndex = -1;
    renderEntries();
    updateStats();
    updateRawFromItems();
    showToast('已删除条目', 'success');
  }
}

// 序列化单行（与 core 一致，用于本地更新）
function serializeLine(item) {
  if (item.type === 'blank') return '';
  if (item.type === 'comment') return '# ' + (item.text || '');
  if (item.type === 'entry') {
    const prefix = item.enabled ? '' : '# ';
    const hostPart = [item.ip, ...item.hostnames].join(' ');
    const commentPart = item.comment ? '  # ' + item.comment : '';
    return prefix + hostPart + commentPart;
  }
  return item.raw || '';
}

// ==================== 添加条目 ====================

function addNewEntry() {
  const newEntry = {
    type: 'entry',
    ip: '127.0.0.1',
    hostnames: ['example.com'],
    comment: '',
    enabled: true,
    raw: ''
  };
  newEntry.raw = serializeLine(newEntry);
  state.items.push(newEntry);
  state.editingIndex = state.items.length - 1;
  renderEntries();
  updateStats();
  updateRawFromItems();
  // 滚动到底部
  entryList.scrollTop = entryList.scrollHeight;
}

// ==================== 统计 ====================

function updateStats() {
  let enabled = 0, disabled = 0;
  for (const item of state.items) {
    if (item.type === 'entry') {
      if (item.enabled) enabled++;
      else disabled++;
    }
  }
  const total = enabled + disabled;
  const pct = total > 0 ? Math.round((enabled / total) * 100) : 0;
  statsEl.innerHTML = '<span class="stats-bar"><span class="stats-bar-fill" style="width:' + pct + '%"></span></span><span><span class="num">' + enabled + '</span> 启用 · <span class="num">' + disabled + '</span> 禁用</span>';
}

// ==================== 模式切换 ====================

function switchMode(mode) {
  if (mode === state.mode) return;

  // 从列表切到源码：更新源码文本
  if (mode === 'raw' && state.mode === 'list') {
    updateRawFromItems();
  }
  // 从源码切到列表：重新解析
  if (mode === 'list' && state.mode === 'raw') {
    const content = rawTextarea.value;
    state.content = content;
    state.items = parseHostsLocal(content);
    renderEntries();
    updateStats();
  }

  state.mode = mode;
  // 更新分段按钮
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  // 显示/隐藏
  if (mode === 'list') {
    entryList.style.display = '';
    rawMode.style.display = 'none';
  } else {
    entryList.style.display = 'none';
    rawMode.style.display = 'flex';
    rawTextarea.value = state.content;
  }
}

// 本地解析（渲染层简化版，与 core 一致）
function parseHostsLocal(text) {
  const lines = String(text || '').split(/\r?\n/);
  const items = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === '') { items.push({ type: 'blank', raw: '' }); continue; }
    if (trimmed.startsWith('#')) {
      const afterHash = trimmed.substring(1).trim();
      const m = matchEntryLocal(afterHash);
      if (m) {
        items.push({ type: 'entry', ip: m.ip, hostnames: m.hostnames, comment: m.comment, enabled: false, raw });
      } else {
        items.push({ type: 'comment', text: trimmed.substring(1).trim(), raw });
      }
      continue;
    }
    const m = matchEntryLocal(trimmed);
    if (m) {
      items.push({ type: 'entry', ip: m.ip, hostnames: m.hostnames, comment: m.comment, enabled: true, raw });
    } else {
      items.push({ type: 'comment', text: trimmed, raw });
    }
  }
  return items;
}

function matchEntryLocal(line) {
  const match = line.match(/^(\S+)\s+(.+?)(?:\s*#\s*(.*))?$/);
  if (!match) return null;
  let rest = match[2] || '';
  let comment = match[3] || '';
  if (!match[3] && rest.includes('#')) {
    const idx = rest.indexOf('#');
    comment = rest.substring(idx + 1).trim();
    rest = rest.substring(0, idx);
  }
  const hostnames = rest.trim().split(/\s+/).filter(Boolean);
  if (hostnames.length === 0) return null;
  const ip = match[1].trim();
  if (!isValidAddr(ip)) return null;
  return { ip, hostnames, comment: comment.trim() };
}

function isValidAddr(str) {
  if (!str) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(str)) return true;
  if (/^[0-9a-fA-F:]+$/.test(str) && str.includes(':')) return true;
  if (str === '255.255.255.255' || str === '0.0.0.0') return true;
  return false;
}

function updateRawFromItems() {
  state.content = state.items.map(serializeLine).join('\n');
}

// ==================== 应用到系统 ====================

async function applyToSystem() {
  // 确保从当前模式获取最新内容
  if (state.mode === 'raw') {
    state.content = rawTextarea.value;
    state.items = parseHostsLocal(state.content);
  } else {
    updateRawFromItems();
  }

  showToast('正在应用…');
  const result = await window.hostsAPI.writeHosts(state.content);
  if (result.success) {
    if (result.elevated) {
      showToast('已通过权限提升写入 hosts 文件', 'success');
    } else {
      showToast('hosts 文件已更新', 'success');
    }
    footerText.textContent = '上次应用: ' + new Date().toLocaleTimeString();
    // 刷新备份列表
    const backups = await window.hostsAPI.listBackups();
    renderBackups(backups);
    // 更新权限状态
    state.canWrite = await window.hostsAPI.canWrite();
    updateStatusBadge();
  } else {
    showToast('应用失败: ' + (result.error || '未知错误'), 'error');
  }
}

// ==================== 方案管理 ====================

function renderProfiles() {
  if (state.profiles.length === 0) {
    profileList.innerHTML = '<div class="empty-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;display:block;margin:0 auto 2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15l3-3 3 3"/></svg><span class="empty-title">暂无方案</span><span class="empty-sub">点击 + 保存当前配置</span></div>';
    return;
  }
  let html = '';
  for (let i = 0; i < state.profiles.length; i++) {
    const p = state.profiles[i];
    html += '<div class="side-item" data-profile-index="' + i + '">' +
      '<svg class="side-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>' +
      '<div style="flex:1;min-width:0">' +
      '<div class="side-item-label">' + escapeHtml(p.name) + '</div>' +
      (p.description ? '<div class="side-item-sub">' + escapeHtml(p.description) + '</div>' : '') +
      '</div>' +
      '<div class="side-item-actions">' +
      '<button class="icon-btn" data-profile-action="apply" data-index="' + i + '" title="加载"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></button>' +
      '<button class="icon-btn" data-profile-action="delete" data-index="' + i + '" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>' +
      '</div>' +
      '</div>';
  }
  profileList.innerHTML = html;

  // 绑定事件
  profileList.querySelectorAll('.side-item').forEach(item => {
    const index = parseInt(item.dataset.profileIndex, 10);
    item.addEventListener('click', (e) => {
      if (e.target.closest('[data-profile-action]')) return;
      applyProfile(index);
    });
    item.querySelectorAll('[data-profile-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.profileAction;
        if (action === 'apply') applyProfile(index);
        if (action === 'delete') deleteProfile(index);
      });
    });
  });
}

function applyProfile(index) {
  const p = state.profiles[index];
  if (!p) return;
  state.content = p.content;
  state.items = parseHostsLocal(p.content);
  if (state.mode === 'raw') rawTextarea.value = p.content;
  renderEntries();
  updateStats();
  showToast('已加载方案: ' + p.name, 'success');
}

function deleteProfile(index) {
  state.profiles.splice(index, 1);
  saveProfiles();
  renderProfiles();
  showToast('已删除方案', 'success');
}

async function saveProfiles() {
  await window.hostsAPI.saveProfiles(state.profiles);
}

// 保存当前内容为新方案
function showProfileModal() {
  $('profileModal').style.display = 'flex';
  $('profileNameInput').value = '';
  $('profileDescInput').value = '';
  $('profileNameInput').focus();
}

function saveCurrentAsProfile() {
  const name = $('profileNameInput').value.trim();
  const desc = $('profileDescInput').value.trim();
  if (!name) { showToast('请输入方案名称', 'warn'); return; }

  // 获取当前内容
  if (state.mode === 'raw') {
    state.content = rawTextarea.value;
  } else {
    updateRawFromItems();
  }

  state.profiles.push({ name, description: desc, content: state.content });
  saveProfiles();
  renderProfiles();
  $('profileModal').style.display = 'none';
  showToast('方案已保存: ' + name, 'success');
}

// ==================== 模板 ====================

function renderTemplates(templates) {
  let html = '';
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const activeClass = i === 0 ? ' active' : '';
    html += '<div class="side-item' + activeClass + '" data-template-index="' + i + '">' +
      '<svg class="side-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 6 6 .9-4.5 4.4 1 6.4L12 17.8 6.5 19.7l1-6.4L3 8.9 9 8z"/></svg>' +
      '<div style="flex:1;min-width:0">' +
      '<div class="side-item-label">' + escapeHtml(t.name) + '</div>' +
      (t.description ? '<div class="side-item-sub">' + escapeHtml(t.description) + '</div>' : '') +
      '</div>' +
      '</div>';
  }
  templateList.innerHTML = html;

  templateList.querySelectorAll('.side-item').forEach(item => {
    const index = parseInt(item.dataset.templateIndex, 10);
    item.addEventListener('click', () => {
      // 移除所有选中态
      templateList.querySelectorAll('.side-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      applyTemplate(index, templates);
    });
  });
}

function applyTemplate(index, templates) {
  const t = templates[index];
  if (!t) return;
  state.content = t.content;
  state.items = parseHostsLocal(t.content);
  if (state.mode === 'raw') rawTextarea.value = t.content;
  renderEntries();
  updateStats();
  showToast('已应用模板: ' + t.name, 'success');
}

// ==================== 备份 ====================

function renderBackups(backups) {
  if (!backups || backups.length === 0) {
    backupList.innerHTML = '<div class="empty-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;display:block;margin:0 auto 2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg><span class="empty-title">暂无备份</span><span class="empty-sub">应用后自动备份</span></div>';
    return;
  }
  let html = '';
  for (const b of backups) {
    const time = new Date(b.mtime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    html += '<div class="side-item" data-backup-name="' + escapeAttr(b.name) + '">' +
      '<svg class="side-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>' +
      '<div style="flex:1;min-width:0">' +
      '<div class="side-item-label">' + time + '</div>' +
      '<div class="side-item-sub">' + formatSize(b.size) + '</div>' +
      '</div>' +
      '<div class="side-item-actions">' +
      '<button class="icon-btn" data-backup-action="restore" title="恢复"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/></svg></button>' +
      '</div>' +
      '</div>';
  }
  backupList.innerHTML = html;

  backupList.querySelectorAll('.side-item').forEach(item => {
    const name = item.dataset.backupName;
    item.querySelector('[data-backup-action]').addEventListener('click', async (e) => {
      e.stopPropagation();
      const content = await window.hostsAPI.readBackup(name);
      state.content = content;
      state.items = parseHostsLocal(content);
      if (state.mode === 'raw') rawTextarea.value = content;
      renderEntries();
      updateStats();
      showToast('已恢复备份', 'success');
    });
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// ==================== 搜索 ====================

function handleSearch(query) {
  state.searchQuery = query;
  renderEntries();
}

// ==================== Toast ====================

let toastTimer = null;
function showToast(msg, type) {
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast' + (type ? ' ' + type : '');
  }, 2500);
}

// ==================== 工具函数 ====================

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==================== 事件绑定 ====================

$('applyBtn').addEventListener('click', applyToSystem);
$('addEntryBtn').addEventListener('click', addNewEntry);
$('listModeBtn').addEventListener('click', () => switchMode('list'));
$('rawModeBtn').addEventListener('click', () => switchMode('raw'));
$('openLocationBtn').addEventListener('click', () => window.hostsAPI.openHostsLocation());
$('openBackupDirBtn').addEventListener('click', () => window.hostsAPI.openBackupDir());
$('newProfileBtn').addEventListener('click', showProfileModal);
$('profileModalConfirm').addEventListener('click', saveCurrentAsProfile);
$('profileModalCancel').addEventListener('click', () => $('profileModal').style.display = 'none');
$('profileModalClose').addEventListener('click', () => $('profileModal').style.display = 'none');
searchInput.addEventListener('input', (e) => handleSearch(e.target.value));

// 列表滚动时给 toolbar 加阴影
entryList.addEventListener('scroll', () => {
  const toolbar = document.querySelector('.toolbar');
  if (entryList.scrollTop > 4) {
    toolbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
  } else {
    toolbar.style.boxShadow = '';
  }
});

// 源码模式编辑监听
rawTextarea.addEventListener('input', () => {
  state.rawEdited = true;
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + S: 应用到系统
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    applyToSystem();
  }
  // Esc: 取消编辑
  if (e.key === 'Escape' && state.editingIndex >= 0) {
    state.editingIndex = -1;
    renderEntries();
  }
});

// 启动
init();
