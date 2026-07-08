// 磁盘管家 - 渲染进程逻辑
'use strict';

// ====== 内嵌纯函数（与 core 模块保持一致，渲染层无 require） ======

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let val = bytes / 1024, idx = 0;
  while (val >= 1024 && idx < units.length - 1) { val /= 1024; idx++; }
  return val.toFixed(val < 10 ? 2 : (val < 100 ? 1 : 0)) + ' ' + units[idx];
}
function formatNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}
function formatPercent(ratio, total) {
  if (!total || total <= 0) return '0.0%';
  const p = (ratio / total) * 100;
  if (p < 0.01) return '<0.01%';
  return p.toFixed(p < 1 ? 2 : 1) + '%';
}
function getExt(name) {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}
function classifyExt(ext) {
  const map = {
    video: ['mp4','mkv','avi','mov','wmv','flv','webm','m4v','mpg','mpeg','ts','rmvb','rm'],
    audio: ['mp3','wav','flac','aac','ogg','wma','m4a','ape','opus','aiff'],
    image: ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','svg','heic','raw','psd','ico'],
    doc: ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','md','rtf','odt','csv','epub'],
    archive: ['zip','rar','7z','tar','gz','bz2','xz','iso','cab'],
    code: ['js','ts','jsx','tsx','py','java','c','cpp','h','hpp','cs','go','rs','rb','php','swift','kt','json','xml','html','css','scss','less','vue','sh','bat','ps1','sql'],
    exe: ['exe','msi','dll','app','deb','rpm','dmg','apk','ipa'],
    db: ['db','sqlite','sqlite3','mdb','accdb'],
  };
  for (const cat of Object.keys(map)) if (map[cat].indexOf(ext) >= 0) return cat;
  return 'other';
}
const CATEGORY_COLORS = {
  video:'#FF9E8A', audio:'#FFC078', image:'#8CE99A', doc:'#74C0FC',
  archive:'#D0BFFF', code:'#99E9F2', exe:'#ADB5BD', db:'#FCC2D7', other:'#DEE2E6',
};
const CATEGORY_NAMES = {
  video:'视频', audio:'音频', image:'图片', doc:'文档',
  archive:'压缩包', code:'代码', exe:'程序', db:'数据库', other:'其他',
};
function categoryColor(cat) { return CATEGORY_COLORS[cat] || CATEGORY_COLORS.other; }

// Squarified treemap
function worst(row, w) {
  if (!row.length) return Infinity;
  let sum = 0, max = -Infinity, min = Infinity;
  for (let i = 0; i < row.length; i++) {
    const a = row[i]; sum += a;
    if (a > max) max = a; if (a < min) min = a;
  }
  const w2 = w * w, s2 = sum * sum;
  if (s2 === 0) return Infinity;
  return Math.max((w2 * max) / s2, s2 / (w2 * min));
}
function layoutRow(row, rect) {
  const { x, y, w, h } = rect;
  const out = [];
  const sum = row.reduce((s, r) => s + r.area, 0);
  if (w <= h) {
    const colW = sum / h;
    let oy = y;
    for (let i = 0; i < row.length; i++) {
      const r = row[i];
      const itemH = h > 0 ? r.area / colW : 0;
      out.push({ node: r.node, x: x, y: oy, w: colW, h: itemH });
      oy += itemH;
    }
    return { rects: out, remaining: { x: x + colW, y: y, w: w - colW, h: h } };
  } else {
    const rowH = sum / w;
    let ox = x;
    for (let i = 0; i < row.length; i++) {
      const r = row[i];
      const itemW = w > 0 ? r.area / rowH : 0;
      out.push({ node: r.node, x: ox, y: y, w: itemW, h: rowH });
      ox += itemW;
    }
    return { rects: out, remaining: { x: x, y: y + rowH, w: w, h: h - rowH } };
  }
}
function squarify(items, rect) {
  if (!items.length || rect.w <= 0 || rect.h <= 0) return [];
  const total = items.reduce((s, it) => s + it.size, 0);
  if (total <= 0) return [];
  const area = rect.w * rect.h;
  const scaled = items.map(it => ({ node: it.node, area: (it.size / total) * area, size: it.size }));
  const result = [];
  let row = [];
  let remaining = scaled.slice();
  let curRect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  function shortSide(r) { return Math.min(r.w, r.h); }
  while (remaining.length > 0) {
    if (curRect.w <= 0 || curRect.h <= 0) break;
    const next = remaining[0];
    const rowAreas = row.map(r => r.area);
    const worstWithNext = worst(rowAreas.concat(next.area), shortSide(curRect));
    const worstWithoutNext = worst(rowAreas, shortSide(curRect));
    if (row.length === 0 || worstWithNext <= worstWithoutNext) {
      row.push(next); remaining.shift();
    } else {
      const { rects, remaining: rem } = layoutRow(row, curRect);
      for (let i = 0; i < rects.length; i++) result.push(rects[i]);
      curRect = rem; row = [];
    }
  }
  if (row.length > 0 && curRect.w > 0 && curRect.h > 0) {
    const { rects } = layoutRow(row, curRect);
    for (let i = 0; i < rects.length; i++) result.push(rects[i]);
  }
  return result;
}

// ====== 状态 ======

const state = {
  tree: null,          // 完整扫描树
  totalBytes: 0,
  totalFiles: 0,
  totalDirs: 0,
  scanStartTs: 0,
  scanDuration: 0,
  topFiles: [],
  stats: null,
  // 当前 treemap 视图焦点：节点数组（从 root 到 current 的路径）
  focusPath: [],
  maxDepth: 2,
  hoverRect: null,
};

// ====== DOM ======

const $ = (id) => document.getElementById(id);
const pathInput = $('pathInput');
const browseBtn = $('browseBtn');
const scanBtn = $('scanBtn');
const cancelBtn = $('cancelBtn');
const progressBar = $('progressBar');
const progressText = $('progressText');
const progressCount = $('progressCount');
const progressFill = $('progressFill');
const canvas = $('treemap');
const ctx = canvas.getContext('2d');
const treemapEmpty = $('treemapEmpty');
const tooltip = $('tooltip');
const depthSelect = $('depthSelect');
const backBtn = $('backBtn');
const breadcrumb = $('breadcrumb');
const confirmModal = $('confirmModal');
const confirmMsg = $('confirmMsg');
const confirmOk = $('confirmOk');
const confirmCancel = $('confirmCancel');
const toastEl = $('toast');

// ====== Toast ======
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2400);
}

// ====== 事件 ======

browseBtn.addEventListener('click', async () => {
  const p = await window.diskAPI.openFolder();
  if (p) {
    pathInput.value = p;
    scanBtn.disabled = false;
  }
});

pathInput.addEventListener('input', () => {
  scanBtn.disabled = !pathInput.value.trim();
});
pathInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && pathInput.value.trim()) startScan();
});

scanBtn.addEventListener('click', startScan);
cancelBtn.addEventListener('click', () => window.diskAPI.cancelScan());
depthSelect.addEventListener('change', () => {
  state.maxDepth = parseInt(depthSelect.value, 10);
  renderTreemap();
});
backBtn.addEventListener('click', () => {
  if (state.focusPath.length > 1) {
    state.focusPath.pop();
    renderTreemap();
    renderBreadcrumb();
  }
});

// 确认弹窗
let pendingDeletePath = null;
confirmCancel.addEventListener('click', () => { confirmModal.classList.add('hidden'); pendingDeletePath = null; });
confirmOk.addEventListener('click', async () => {
  if (!pendingDeletePath) { confirmModal.classList.add('hidden'); return; }
  const p = pendingDeletePath;
  confirmModal.classList.add('hidden');
  pendingDeletePath = null;
  const res = await window.diskAPI.trashItem(p);
  if (res === true) {
    toast('已移到回收站');
    // 从数据中移除
    removeFromTree(state.tree, p);
    // 重算统计
    recomputeTopFiles();
    renderAll();
  } else {
    toast('删除失败：' + (res && res.error ? res.error : '未知错误'));
  }
});

// ====== 扫描 ======

let progressUnsub = null;
async function startScan() {
  const fp = pathInput.value.trim();
  if (!fp) return;
  scanBtn.disabled = true;
  browseBtn.disabled = true;
  cancelBtn.classList.remove('hidden');
  progressBar.classList.remove('hidden');
  treemapEmpty.classList.add('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = '正在扫描…';
  progressCount.textContent = '';
  state.scanStartTs = Date.now();

  if (progressUnsub) progressUnsub();
  progressUnsub = window.diskAPI.onScanProgress((p) => {
    progressText.textContent = '已扫描 ' + formatNumber(p.files) + ' 个文件';
    progressCount.textContent = formatBytes(p.bytes);
    // 模拟进度（无法预知总量，用对数曲线）
    const pct = Math.min(95, 30 + Math.log10(Math.max(1, p.files)) * 12);
    progressFill.style.width = pct + '%';
  });

  const res = await window.diskAPI.startScan(fp);
  if (progressUnsub) { progressUnsub(); progressUnsub = null; }
  cancelBtn.classList.add('hidden');
  browseBtn.disabled = false;
  scanBtn.disabled = false;
  progressBar.classList.add('hidden');

  if (!res || !res.ok) {
    toast('扫描失败：' + (res && res.error ? res.error : '未知错误'));
    treemapEmpty.classList.remove('hidden');
    return;
  }

  state.tree = res.tree;
  state.totalBytes = res.bytes;
  state.totalFiles = res.files;
  state.totalDirs = res.dirs;
  state.scanDuration = Date.now() - state.scanStartTs;
  state.topFiles = res.topFiles || [];
  state.stats = res.stats || { byExt: [], byCategory: [] };
  state.focusPath = [state.tree];

  if (res.stopped) toast('扫描已中止（达到上限或已取消）');
  else progressFill.style.width = '100%';

  renderAll();
}

// ====== 渲染 ======

function renderAll() {
  renderSummary();
  renderCategory();
  renderExt();
  renderTopFiles();
  renderTreemap();
  renderBreadcrumb();
}

function renderSummary() {
  $('sumSize').textContent = formatBytes(state.totalBytes);
  $('sumFiles').textContent = formatNumber(state.totalFiles);
  $('sumDirs').textContent = formatNumber(state.totalDirs);
  const sec = Math.max(0, Math.round(state.scanDuration / 1000));
  $('sumTime').textContent = sec < 60 ? (sec + ' s') : (Math.floor(sec / 60) + 'm ' + (sec % 60) + 's');
}

function renderCategory() {
  const el = $('categoryList');
  if (!state.stats || !state.stats.byCategory.length) { el.innerHTML = '<div class="empty-hint">无数据</div>'; return; }
  const total = state.totalBytes;
  const cats = state.stats.byCategory;
  el.innerHTML = cats.map(c => {
    const color = categoryColor(c.category);
    const name = CATEGORY_NAMES[c.category] || c.category;
    const pct = total > 0 ? (c.size / total * 100) : 0;
    return `
      <div class="category-row">
        <span class="cat-dot" style="background:${color}"></span>
        <span class="cat-name">${name}</span>
        <span class="cat-bar-wrap"><span class="cat-bar" style="width:${pct.toFixed(1)}%;background:${color}"></span></span>
        <span class="cat-size">${formatBytes(c.size)}</span>
      </div>`;
  }).join('');
}

function renderExt() {
  const el = $('extList');
  if (!state.stats || !state.stats.byExt.length) { el.innerHTML = '<div class="empty-hint">无数据</div>'; return; }
  const exts = state.stats.byExt.slice(0, 6);
  el.innerHTML = exts.map(e => `
    <div class="ext-row">
      <span class="ext-name">.${e.ext}</span>
      <span class="ext-meta">${formatNumber(e.count)} 个</span>
      <span class="ext-size">${formatBytes(e.size)}</span>
    </div>`).join('');
}

function renderTopFiles() {
  const el = $('topFiles');
  $('topFilesHint').textContent = state.topFiles.length ? '共 ' + state.topFiles.length + ' 项' : '';
  if (!state.topFiles.length) { el.innerHTML = '<div class="empty-hint">无数据</div>'; return; }
  const total = state.totalBytes;
  el.innerHTML = state.topFiles.slice(0, 8).map((f, i) => {
    const dir = f.path.replace(/\\[^\\]+$/, '');
    return `
      <div class="top-files-row" data-path="${escapeAttr(f.path)}">
        <div class="tf-name" title="${escapeAttr(f.path)}">${escapeHtml(f.name)}<div class="tf-dir">${escapeHtml(dir)}</div></div>
        <div class="tf-size">${formatBytes(f.size)}</div>
        <div class="tf-pct">${formatPercent(f.size, total)}</div>
        <div class="tf-actions">
          <button data-act="open" data-path="${escapeAttr(f.path)}">定位</button>
          <button class="danger" data-act="del" data-path="${escapeAttr(f.path)}">删除</button>
        </div>
      </div>`;
  }).join('');

  // 绑定按钮
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const act = btn.getAttribute('data-act');
      const p = btn.getAttribute('data-path');
      if (act === 'open') {
        await window.diskAPI.showInFolder(p);
      } else if (act === 'del') {
        const node = state.topFiles.find(x => x.path === p);
        if (!node) return;
        pendingDeletePath = p;
        confirmMsg.innerHTML = `确定将文件移到回收站吗？<br><b>${escapeHtml(node.name)}</b><br><span style="color:var(--text-3);font-size:12px">${escapeHtml(node.path)}</span><br><span style="color:var(--danger);font-size:12px">${formatBytes(node.size)}</span>`;
        confirmModal.classList.remove('hidden');
      }
    });
  });
}

function renderBreadcrumb() {
  if (!state.focusPath.length) {
    breadcrumb.innerHTML = '<span class="crumb-root">Treemap 视图</span>';
    backBtn.disabled = true;
    return;
  }
  backBtn.disabled = state.focusPath.length <= 1;
  const parts = [];
  parts.push('<span class="crumb crumb-root" data-idx="0">全部</span>');
  for (let i = 1; i < state.focusPath.length; i++) {
    parts.push('<span class="crumb-sep">›</span>');
    const isLast = i === state.focusPath.length - 1;
    const cls = isLast ? 'crumb current' : 'crumb';
    parts.push(`<span class="${cls}" data-idx="${i}">${escapeHtml(state.focusPath[i].name)}</span>`);
  }
  breadcrumb.innerHTML = parts.join('');
  breadcrumb.querySelectorAll('.crumb').forEach(c => {
    c.addEventListener('click', () => {
      const idx = parseInt(c.getAttribute('data-idx'), 10);
      if (isNaN(idx) || idx >= state.focusPath.length) return;
      state.focusPath = state.focusPath.slice(0, idx + 1);
      renderTreemap();
      renderBreadcrumb();
    });
  });
}

// ====== Treemap 渲染 ======

let rectCache = []; // 当前帧绘制的 [{node, x, y, w, h, depth}]

function resizeCanvas() {
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function renderTreemap() {
  if (!state.tree) { treemapEmpty.classList.remove('hidden'); return; }
  treemapEmpty.classList.add('hidden');
  resizeCanvas();
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const current = state.focusPath[state.focusPath.length - 1];
  if (!current || current.size <= 0) {
    ctx.fillStyle = '#a1a1a6';
    ctx.font = '13px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText('该目录为空', w / 2, h / 2);
    rectCache = [];
    return;
  }

  // 收集要画的节点
  const items = current.children.filter(c => c.size > 0).map(c => ({ node: c, size: c.size }));
  if (!items.length) {
    ctx.fillStyle = '#a1a1a6';
    ctx.font = '13px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText('该目录没有子项', w / 2, h / 2);
    rectCache = [];
    return;
  }
  const rects = squarify(items, { x: 0, y: 0, w: w, h: h });
  rectCache = [];

  // 画第一层
  rects.forEach(r => {
    drawRect(r.node, r.x, r.y, r.w, r.h, 0);
    rectCache.push({ node: r.node, x: r.x, y: r.y, w: r.w, h: r.h, depth: 0 });
    // 递归画子目录
    if (r.node.type === 'dir' && r.node.children && state.maxDepth > 1) {
      drawChildren(r.node, r.x, r.y, r.w, r.h, 1);
    }
  });
}

function drawChildren(node, x, y, w, h, depth) {
  if (depth >= state.maxDepth) return;
  if (w < 4 || h < 4) return;
  const items = (node.children || []).filter(c => c.size > 0).map(c => ({ node: c, size: c.size }));
  if (!items.length) return;
  // 留出 padding 让边界清晰
  const pad = depth === 0 ? 2 : 1;
  const inner = { x: x + pad, y: y + pad, w: Math.max(0, w - pad * 2), h: Math.max(0, h - pad * 2) };
  if (inner.w < 2 || inner.h < 2) return;
  const rects = squarify(items, inner);
  rects.forEach(r => {
    drawRect(r.node, r.x, r.y, r.w, r.h, depth);
    rectCache.push({ node: r.node, x: r.x, y: r.y, w: r.w, h: r.h, depth: depth });
    if (r.node.type === 'dir' && r.node.children && depth + 1 < state.maxDepth) {
      drawChildren(r.node, r.x, r.y, r.w, r.h, depth + 1);
    }
  });
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substr(0, 2), 16),
    g: parseInt(h.substr(2, 2), 16),
    b: parseInt(h.substr(4, 2), 16),
  };
}
function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
}

function drawRect(node, x, y, w, h, depth) {
  if (w < 0.5 || h < 0.5) return;
  // 目录：中性浅灰渐变；文件：类型色 + 较高透明度，整体更柔和统一
  let fill, textColor, subColor;
  if (node.type === 'dir') {
    const shades = ['#f1f3f5', '#eceef1', '#e7eaee', '#e2e5ea'];
    fill = shades[Math.min(depth, shades.length - 1)];
    textColor = '#2c2c2e';
    subColor = '#868e96';
  } else {
    // 文件色块：类型色与白混合，保持柔和但保留辨识度
    const base = hexToRgb(categoryColor(node.category));
    const mix = 0.42; // 与白混合比例
    const r = Math.round(base.r * (1 - mix) + 255 * mix);
    const g = Math.round(base.g * (1 - mix) + 255 * mix);
    const b = Math.round(base.b * (1 - mix) + 255 * mix);
    fill = 'rgb(' + r + ',' + g + ',' + b + ')';
    // 文字色基于混合后亮度
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    textColor = lum > 150 ? '#1d1d1f' : '#ffffff';
    subColor = lum > 150 ? '#6e6e73' : 'rgba(255,255,255,0.85)';
  }
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);

  // 白色分隔线
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));

  // 文字标签
  if (w > 56 && h > 20) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, w - 4, h - 4);
    ctx.clip();
    ctx.font = '600 12px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let displayName = node.name;
    const maxW = w - 12;
    if (ctx.measureText(displayName).width > maxW) {
      while (displayName.length > 1 && ctx.measureText(displayName + '…').width > maxW) {
        displayName = displayName.slice(0, -1);
      }
      displayName = displayName + '…';
    }
    ctx.fillText(displayName, x + 7, y + 6);
    if (h > 38) {
      ctx.font = '500 11px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = subColor;
      ctx.fillText(formatBytes(node.size), x + 7, y + 22);
    }
    ctx.restore();
  }
}

function pickTextColor(bg) {
  const hex = bg.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b);
  return lum > 150 ? '#1d1d1f' : '#ffffff';
}

// ====== 鼠标交互 ======

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // 找到最深的最小矩形
  let hit = null;
  for (let i = rectCache.length - 1; i >= 0; i--) {
    const r = rectCache[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (!hit || (r.w * r.h) < (hit.w * hit.h)) hit = r;
    }
  }
  if (hit) {
    state.hoverRect = hit;
    showTooltip(hit, e.clientX, e.clientY);
    canvas.style.cursor = hit.node.type === 'dir' ? 'pointer' : 'default';
  } else {
    state.hoverRect = null;
    tooltip.classList.add('hidden');
    canvas.style.cursor = 'default';
  }
});

canvas.addEventListener('mouseleave', () => {
  state.hoverRect = null;
  tooltip.classList.add('hidden');
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  let hit = null;
  for (let i = rectCache.length - 1; i >= 0; i--) {
    const r = rectCache[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (!hit || (r.w * r.h) < (hit.w * hit.h)) hit = r;
    }
  }
  if (!hit) return;
  if (hit.node.type === 'dir' && hit.node.children && hit.node.children.length > 0) {
    // 进入该目录
    state.focusPath.push(hit.node);
    renderTreemap();
    renderBreadcrumb();
  } else if (hit.node.type === 'file') {
    // 双击文件可定位——单击仅提示
    // 右键菜单稍后；这里给个 toast
    toast('文件：' + hit.node.name + ' · ' + formatBytes(hit.node.size));
  }
});

canvas.addEventListener('dblclick', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  let hit = null;
  for (let i = rectCache.length - 1; i >= 0; i--) {
    const r = rectCache[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (!hit || (r.w * r.h) < (hit.w * hit.h)) hit = r;
    }
  }
  if (hit && hit.node) {
    window.diskAPI.showInFolder(hit.node.path);
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  let hit = null;
  for (let i = rectCache.length - 1; i >= 0; i--) {
    const r = rectCache[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (!hit || (r.w * r.h) < (hit.w * hit.h)) hit = r;
    }
  }
  if (hit && hit.node) {
    // 简单：定位 + 提示删除去 Top 列表
    window.diskAPI.showInFolder(hit.node.path);
  }
});

function showTooltip(r, mx, my) {
  const node = r.node;
  const isDir = node.type === 'dir';
  let html = `<div class="tooltip-name">${escapeHtml(node.name)}</div>`;
  html += `<div class="tooltip-row">${isDir ? '文件夹' : '文件'} · ${formatBytes(node.size)}`;
  if (state.totalBytes > 0) html += ` · ${formatPercent(node.size, state.totalBytes)}`;
  html += '</div>';
  if (isDir) {
    html += `<div class="tooltip-row">${formatNumber(node.fileCount || 0)} 文件 · ${formatNumber(node.dirCount || 0)} 子目录</div>`;
  }
  html += `<div class="tooltip-row" style="margin-top:2px;opacity:0.6">${escapeHtml(node.path)}</div>`;
  tooltip.innerHTML = html;
  tooltip.classList.remove('hidden');
  // 定位
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let left = mx + 14, top = my + 14;
  if (left + tw > window.innerWidth - 8) left = mx - tw - 14;
  if (top + th > window.innerHeight - 8) top = my - th - 14;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

// ====== 辅助 ======

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// 从树中移除某路径节点（并向上修正 size）
function removeFromTree(root, path) {
  let changed = false;
  function walk(node) {
    if (!node || !node.children) return;
    for (let i = 0; i < node.children.length; i++) {
      const c = node.children[i];
      if (c.path === path) {
        node.children.splice(i, 1);
        changed = true;
        return;
      }
      walk(c);
    }
  }
  walk(root);
  if (changed) recomputeSizes(root);
}
function recomputeSizes(node) {
  if (!node) return 0;
  if (node.type === 'file') return node.size;
  let sum = 0;
  let fc = 0, dc = 0;
  for (const c of node.children || []) {
    const s = recomputeSizes(c);
    sum += s;
    if (c.type === 'file') fc++; else dc++;
  }
  node.size = sum;
  node.fileCount = fc;
  node.dirCount = dc;
  return sum;
}
function recomputeTopFiles() {
  // 重新收集
  const arr = [];
  function walk(n) {
    if (n.type === 'file') { arr.push(n); return; }
    for (const c of n.children || []) walk(c);
  }
  if (state.tree) walk(state.tree);
  arr.sort((a, b) => b.size - a.size);
  state.topFiles = arr.slice(0, 100);
  state.totalBytes = state.tree ? state.tree.size : 0;
  // 重新统计文件数/目录数
  let fc = 0, dc = 0;
  function count(n) {
    if (n.type === 'file') { fc++; return; }
    dc++;
    for (const c of n.children || []) count(c);
  }
  if (state.tree) { count(state.tree); state.totalFiles = fc; state.totalDirs = dc - 1; }
  // 重新统计类型
  state.stats = recomputeStats(state.tree);
}
function recomputeStats(root) {
  const byExt = new Map(), byCategory = new Map();
  function walk(n) {
    if (n.type === 'file') {
      const e = n.ext || '(无扩展名)';
      if (!byExt.has(e)) byExt.set(e, { count: 0, size: 0 });
      byExt.get(e).count++; byExt.get(e).size += n.size;
      const c = n.category || 'other';
      if (!byCategory.has(c)) byCategory.set(c, { count: 0, size: 0 });
      byCategory.get(c).count++; byCategory.get(c).size += n.size;
      return;
    }
    for (const c of n.children || []) walk(c);
  }
  if (root) walk(root);
  const extArr = Array.from(byExt.entries()).map(([k,v]) => ({ ext:k, count:v.count, size:v.size })).sort((a,b)=>b.size-a.size);
  const catArr = Array.from(byCategory.entries()).map(([k,v]) => ({ category:k, count:v.count, size:v.size })).sort((a,b)=>b.size-a.size);
  return { byExt: extArr, byCategory: catArr };
}

// ====== 窗口大小变化 ======
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.tree) renderTreemap(); }, 120);
});

// 初始化
scanBtn.disabled = !pathInput.value.trim();

// 命令行传入初始路径：自动填入并扫描
window.diskAPI.onInitPath((p) => {
  pathInput.value = p;
  scanBtn.disabled = false;
  setTimeout(() => startScan(), 300);
});
