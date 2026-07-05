// renderer.js — 前端逻辑
// 用 IIFE 包裹，避免顶层 const api 与 contextBridge 暴露的 window.api 全局属性冲突
(function () {
const api = window.api;

let state = {
  dir: null,
  result: null,            // { groups, stats }
  selectedGroupId: null,   // 当前查看的组
  toDelete: new Set(),     // 选中的文件路径集合
  scannedFileStats: {}     // 缓存预览数据
};

// ===== 工具函数 =====
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function typeLabel(t) {
  return ({
    image: '图片', video: '视频', audio: '音频', pdf: 'PDF',
    doc: '文档', sheet: '表格', slide: '幻灯片',
    archive: '压缩包', code: '代码', text: '文本', other: '其他'
  })[t] || '其他';
}

function shortPath(p) {
  if (!p) return '';
  const parts = p.split(/[\\/]/);
  if (parts.length <= 3) return p;
  return '…/' + parts.slice(-3).join('/');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

let toastTimer = null;
function toast(msg) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = `<div class="toast">${escapeHtml(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { wrap.innerHTML = ''; }, 2200);
}

// ===== 事件绑定 =====
document.getElementById('pickBtn').addEventListener('click', onPick);
document.getElementById('cancelBtn').addEventListener('click', onCancel);
document.getElementById('deleteSelectedBtn').addEventListener('click', onDeleteSelected);
document.getElementById('rescanBtn').addEventListener('click', onPick);
document.getElementById('afdianBtn').addEventListener('click', async () => {
  const url = await api.getAfdianUrl();
  api.openExternal(url);
});

api.onScanProgress(onProgress);
api.onDemoResult(onDemoResult);

// demo 模式：直接接收主进程推送的扫描结果
async function onDemoResult(data) {
  if (!data || !data.result) return;
  state.dir = data.dir;
  state.result = data.result;
  document.getElementById('dirChip').textContent = data.dir;
  document.getElementById('dirChip').classList.remove('hidden');
  document.getElementById('progressBar').classList.add('hidden');
  document.getElementById('emptyState').classList.add('hidden');
  renderSummary();
  renderGroupList();
  document.getElementById('content').classList.remove('hidden');
  document.getElementById('rescanBtn').classList.remove('hidden');
  document.getElementById('footerStatus').textContent = `扫描完成 · 共 ${data.result.stats.duplicateGroups} 组重复`;
  // 自动选中第一组，让详情区也有内容
  if (state.result.groups.length > 0) {
    setTimeout(() => selectGroup('g-0'), 200);
  }
}

// ===== 选择目录并扫描 =====
async function onPick() {
  const dir = await api.pickDirectory();
  if (!dir) return;
  state.dir = dir;
  document.getElementById('dirChip').textContent = dir;
  document.getElementById('dirChip').classList.remove('hidden');
  await startScan(dir);
}

async function startScan(dir) {
  // 重置 UI
  state.result = null;
  state.selectedGroupId = null;
  state.toDelete.clear();
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('content').classList.add('hidden');
  document.getElementById('summaryBar').classList.add('hidden');
  document.getElementById('progressBar').classList.remove('hidden');
  document.getElementById('cancelBtn').classList.remove('hidden');
  document.getElementById('pickBtn').disabled = true;
  document.getElementById('pickBtn').style.opacity = 0.6;

  setProgress(0, '正在扫描目录…');
  document.getElementById('footerStatus').textContent = '扫描中…';

  const opts = { minSize: 1, followSymlinks: false };
  const res = await api.scanDirectory(dir, opts);

  document.getElementById('pickBtn').disabled = false;
  document.getElementById('pickBtn').style.opacity = '';
  document.getElementById('progressBar').classList.add('hidden');
  document.getElementById('cancelBtn').classList.add('hidden');

  if (res.cancelled) {
    document.getElementById('footerStatus').textContent = '已取消扫描';
    document.getElementById('emptyState').classList.remove('hidden');
    return;
  }
  if (res.error) {
    toast('扫描出错：' + res.error);
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('footerStatus').textContent = '扫描出错';
    return;
  }

  state.result = res;
  renderSummary();
  renderGroupList();
  document.getElementById('content').classList.remove('hidden');
  document.getElementById('rescanBtn').classList.remove('hidden');
  document.getElementById('footerStatus').textContent = `扫描完成 · 共 ${res.stats.duplicateGroups} 组重复`;
}

function onCancel() {
  api.scanCancel();
}

function onProgress(p) {
  if (!p) return;
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  let pct = 0, label = '';
  switch (p.phase) {
    case 'scan':
      label = `遍历目录中… 已扫描 ${p.scanned} 个文件`;
      pct = 20;
      break;
    case 'size-done':
      label = `目录扫描完成 · 共 ${p.scanned} 个文件，${p.candidates} 个候选`;
      pct = 35;
      break;
    case 'partial':
      pct = 35 + Math.min(35, (p.processed / Math.max(1, p.total)) * 35);
      label = `部分哈希校验 ${p.processed}/${p.total}`;
      break;
    case 'partial-done':
      label = `部分哈希完成 · ${p.groups} 组待确认`;
      pct = 70;
      break;
    case 'full':
      pct = 70 + Math.min(28, (p.done / Math.max(1, p.total)) * 28);
      label = `完整哈希校验 ${p.done}/${p.total}`;
      break;
    case 'done':
      pct = 100;
      label = '完成';
      break;
  }
  fill.style.width = pct + '%';
  text.textContent = label;
}

function setProgress(pct, label) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = label;
}

// ===== 渲染统计 =====
function renderSummary() {
  const s = state.result.stats;
  document.getElementById('summaryBar').classList.remove('hidden');
  document.getElementById('statScanned').textContent = s.scanned.toLocaleString();
  document.getElementById('statGroups').textContent = s.duplicateGroups.toLocaleString();
  document.getElementById('statFiles').textContent = s.duplicateFiles.toLocaleString();
  document.getElementById('statWaste').textContent = s.wasteText;
  updateSelectedStat();
}

function updateSelectedStat() {
  const el = document.getElementById('statSelected');
  el.textContent = state.toDelete.size + ' 项';
  const btn = document.getElementById('deleteSelectedBtn');
  btn.disabled = state.toDelete.size === 0;
}

// ===== 渲染组列表 =====
function renderGroupList() {
  const list = document.getElementById('groupList');
  const groups = state.result.groups;
  document.getElementById('groupCount').textContent = groups.length;
  list.innerHTML = '';
  groups.forEach((g, idx) => {
    const id = 'g-' + idx;
    const item = document.createElement('div');
    item.className = 'group-item';
    item.dataset.id = id;
    const sample = g.files[0];
    item.innerHTML = `
      <div class="group-thumb" data-ext="${escapeHtml(sample.ext)}">${escapeHtml(sample.ext.replace('.', '').toUpperCase() || '?')}</div>
      <div class="group-info">
        <div class="group-name">${escapeHtml(sample.name)}</div>
        <div class="group-meta">
          <span class="group-type">${typeLabel(sample.type)}</span>
          <span>· ${g.files.length} 份 · ${formatBytes(g.size)}</span>
        </div>
      </div>
      <div class="group-waste">${formatBytes(g.waste)}</div>
    `;
    item.addEventListener('click', () => selectGroup(id));
    list.appendChild(item);
    // 异步加载图片缩略图
    if (sample.type === 'image') {
      api.readImageDataUrl(sample.path).then(url => {
        if (typeof url === 'string' && url.startsWith('data:')) {
          const thumb = item.querySelector('.group-thumb');
          thumb.innerHTML = `<img src="${url}" alt="">`;
        }
      }).catch(() => {});
    }
  });
}

// ===== 选中组，渲染详情 =====
function selectGroup(id) {
  state.selectedGroupId = id;
  document.querySelectorAll('.group-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
  const idx = parseInt(id.replace('g-', ''), 10);
  const group = state.result.groups[idx];
  renderDetail(group, idx);
}

function renderDetail(group, idx) {
  const title = document.getElementById('detailTitle');
  const meta = document.getElementById('detailMeta');
  const body = document.getElementById('detailBody');
  const sample = group.files[0];
  title.textContent = sample.name;
  meta.innerHTML = `<span class="group-type">${typeLabel(sample.type)}</span> · ${group.files.length} 份相同文件 · 每份 ${formatBytes(group.size)} · 可释放 <span style="color:var(--danger);font-weight:600">${formatBytes(group.waste)}</span>`;

  body.innerHTML = `<div class="compare-grid" id="grid-${idx}"></div>`;
  const grid = document.getElementById('grid-' + idx);

  // 推荐保留：最早的（按 mtime 最早）或路径最短
  const sorted = [...group.files].sort((a, b) => a.mtime - b.mtime);
  const keepPath = sorted[0].path;

  group.files.forEach(f => {
    const card = document.createElement('div');
    card.className = 'file-card';
    if (f.path === keepPath) card.classList.add('recommended');
    if (state.toDelete.has(f.path)) card.classList.add('to-delete');

    const recTag = (f.path === keepPath)
      ? `<span class="recommend-tag">建议保留</span>` : '';

    card.innerHTML = `
      <div class="file-card-head">
        <span>${shortPath(f.dir)}</span>
        ${recTag}
      </div>
      <div class="file-preview" data-path="${escapeHtml(f.path)}" data-type="${f.type}">
        <div class="preview-placeholder">加载中…</div>
      </div>
      <div class="file-info">
        <div class="file-name">${escapeHtml(f.name)}</div>
        <div class="file-path">${escapeHtml(f.path)}</div>
        <div class="file-meta">
          <span>${formatBytes(f.size)}</span>
          <span>·</span>
          <span>${formatDate(f.mtime)}</span>
        </div>
      </div>
      <div class="file-actions"></div>
    `;

    // 预览
    loadPreview(card.querySelector('.file-preview'), f);

    // 操作按钮
    const actions = card.querySelector('.file-actions');
    const isKeep = f.path === keepPath;
    const isDel = state.toDelete.has(f.path);

    const revealBtn = document.createElement('button');
    revealBtn.className = 'btn-mini';
    revealBtn.textContent = '打开目录';
    revealBtn.addEventListener('click', () => api.revealFile(f.path));

    const openBtn = document.createElement('button');
    openBtn.className = 'btn-mini';
    openBtn.textContent = '打开';
    openBtn.addEventListener('click', () => api.openFile(f.path));

    const actionBtn = document.createElement('button');
    if (isKeep) {
      actionBtn.className = 'btn-mini success';
      actionBtn.textContent = '建议保留';
      actionBtn.disabled = true;
    } else {
      actionBtn.className = 'btn-mini danger';
      actionBtn.textContent = isDel ? '取消删除' : '标记删除';
      actionBtn.addEventListener('click', () => {
        if (state.toDelete.has(f.path)) {
          state.toDelete.delete(f.path);
        } else {
          state.toDelete.add(f.path);
        }
        renderDetail(group, idx);  // 局部重渲染
        updateSelectedStat();
      });
    }

    actions.appendChild(revealBtn);
    actions.appendChild(openBtn);
    actions.appendChild(actionBtn);

    grid.appendChild(card);
  });
}

async function loadPreview(container, f) {
  try {
    if (f.type === 'image') {
      const url = await api.readImageDataUrl(f.path);
      if (typeof url === 'string' && url.startsWith('data:')) {
        container.innerHTML = `<img src="${url}" alt="">`;
      } else {
        container.innerHTML = `<div class="preview-placeholder">无法预览</div>`;
      }
    } else if (f.type === 'text' || f.type === 'code') {
      const r = await api.readTextPreview(f.path, 2048);
      if (r && !r.error) {
        container.innerHTML = `<pre class="preview-text">${escapeHtml(r.text)}</pre>`;
      }
    } else {
      const label = ({
        video: '视频文件', audio: '音频文件', pdf: 'PDF 文档',
        doc: 'Word 文档', sheet: '表格', slide: '演示',
        archive: '压缩包', other: '文件'
      })[f.type] || '文件';
      container.innerHTML = `<div class="preview-placeholder">${label} · ${f.ext}<br>暂无可视预览</div>`;
    }
  } catch (e) {
    container.innerHTML = `<div class="preview-placeholder">预览失败</div>`;
  }
}

// ===== 删除已选 =====
async function onDeleteSelected() {
  const paths = Array.from(state.toDelete);
  if (paths.length === 0) return;
  if (!confirm(`确认将选中的 ${paths.length} 个文件移到回收站？\n\n回收站可恢复，但请确保不会误删系统文件。`)) return;

  document.getElementById('footerStatus').textContent = '正在移到回收站…';
  const results = await api.trashFiles(paths);
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  toast(`已移到回收站 ${ok} 个${fail ? '，失败 ' + fail + ' 个' : ''}`);

  // 从结果中移除已删除文件，重新计算
  const deleted = new Set(results.filter(r => r.ok).map(r => r.path));
  state.toDelete.clear();

  // 重算 groups：把已删文件移除，组若剩 1 个则整组移除
  const newGroups = [];
  for (const g of state.result.groups) {
    const remain = g.files.filter(f => !deleted.has(f.path));
    if (remain.length >= 2) {
      const waste = remain[0].size * (remain.length - 1);
      newGroups.push({ ...g, files: remain, waste, size: remain[0].size });
    }
  }
  state.result.groups = newGroups;
  // 重算 stats
  const totalWaste = newGroups.reduce((s, g) => s + g.waste, 0);
  const totalFiles = newGroups.reduce((s, g) => s + g.files.length, 0);
  state.result.stats.duplicateGroups = newGroups.length;
  state.result.stats.duplicateFiles = totalFiles;
  state.result.stats.wasteBytes = totalWaste;
  state.result.stats.wasteText = formatBytes(totalWaste);

  renderSummary();
  renderGroupList();
  document.getElementById('detailBody').innerHTML = `<div class="detail-empty">已清理 ${deleted.size} 个文件。${newGroups.length === 0 ? '当前目录无重复文件了 🎉' : '继续处理其他组'}</div>`;
  document.getElementById('footerStatus').textContent = `已清理 ${deleted.size} 个文件 · 剩余 ${newGroups.length} 组`;
}

// 启动时显示空状态
document.getElementById('emptyState').classList.remove('hidden');

})(); // IIFE 闭合

