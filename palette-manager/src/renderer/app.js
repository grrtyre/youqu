// app.js
// 调色板管理器渲染器逻辑

const CT = window.ColorTheory;

// ---------- 状态 ----------
const state = {
  colors: [],          // 当前调色板 HEX 数组
  locks: [],           // 每个色块的锁定状态
  mode: 'analogous',   // 当前色彩理论模式
  favorites: [],       // 收藏的调色板
};

const FAV_KEY = 'palette-manager-favorites';

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const paletteEl = $('#palette');
const modeListEl = $('#modeList');
const generateBtn = $('#generateBtn');
const imageBtn = $('#imageBtn');
const imageInput = $('#imageInput');
const hintText = $('#hintText');
const paletteNameEl = $('#paletteName');
const toastEl = $('#toast');

// ---------- 初始化模式选择 ----------
function initModes() {
  const modes = [
    { key: 'analogous', label: '类比' },
    { key: 'monochromatic', label: '同色' },
    { key: 'complementary', label: '互补' },
    { key: 'splitComplementary', label: '分裂互补' },
    { key: 'triadic', label: '三元' },
    { key: 'tetradic', label: '四元' },
    { key: 'random', label: '随机' },
  ];
  modeListEl.innerHTML = modes.map((m) =>
    `<button class="mode-pill ${m.key === state.mode ? 'active' : ''}" data-mode="${m.key}">${m.label}</button>`
  ).join('');
  modeListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-pill');
    if (!btn) return;
    $$('.mode-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    generate();
  });
}

// ---------- 渲染调色板 ----------
function render() {
  paletteEl.innerHTML = state.colors.map((hex, i) => {
    const hsl = CT.hexToHsl(hex);
    const dark = CT.relativeLuminance(hex) <= 0.4;
    const text = dark ? '#ffffff' : '#1d1d1f';
    const locked = state.locks[i];
    return `
      <div class="swatch" data-index="${i}" data-dark="${!dark}" style="background:${hex}; color:${text};">
        <span class="swatch-index">${String(i + 1).padStart(2, '0')}</span>
        <div class="swatch-actions left">
          <button class="swatch-btn lock-btn ${locked ? 'locked' : ''}" data-act="lock" title="${locked ? '解锁' : '锁定'}">
            ${locked ? lockedIcon() : unlockedIcon()}
          </button>
        </div>
        <div class="swatch-actions right">
          <button class="swatch-btn" data-act="copy" title="复制 HEX">
            ${copyIcon()}
          </button>
          <button class="swatch-btn" data-act="adjust" title="微调">
            ${adjustIcon()}
          </button>
        </div>
        <div class="swatch-info">
          <div class="swatch-hex">${hex.toUpperCase()}</div>
          <div class="swatch-meta">RGB ${hexToRgbStr(hex)} · HSL ${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%</div>
        </div>
      </div>
    `;
  }).join('');
}

function hexToRgbStr(hex) {
  const c = CT.hexToRgb(hex);
  return `${c.r}, ${c.g}, ${c.b}`;
}

// ---------- 图标 ----------
function lockedIcon() {
  return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
}
function unlockedIcon() {
  return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 7.5-2"></path></svg>';
}
function copyIcon() {
  return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path></svg>';
}
function adjustIcon() {
  return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"></path></svg>';
}

// ---------- 生成调色板 ----------
function generate() {
  if (state.mode === 'random') {
    // 纯随机：每个色块独立生成和谐随机色
    const n = state.colors.length || 5;
    state.colors = Array.from({ length: n }, () => CT.randomBaseHex());
    state.locks = state.locks.map((l, i) => l);
  } else {
    const baseHex = CT.randomBaseHex();
    const hsl = CT.hexToHsl(baseHex);
    const palette = CT.generatePalette(baseHex, state.mode);
    // 对于锁定项保持原色，非锁定项使用生成结果
    const n = state.colors.length || 5;
    const result = [];
    for (let i = 0; i < n; i++) {
      if (state.locks[i]) {
        result.push(state.colors[i]);
      } else {
        const p = palette[i % palette.length];
        result.push(CT.hslToHex(p.h, p.s, p.l));
      }
    }
    state.colors = result;
  }
  render();
  updatePaletteName();
}

// 完全重置为 5 个色块并生成
function freshGenerate() {
  state.colors = new Array(5).fill('#ffffff');
  state.locks = new Array(5).fill(false);
  generate();
}

function updatePaletteName() {
  const now = new Date();
  const stamp = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  paletteNameEl.textContent = `配色 ${stamp}`;
}

// ---------- 色块交互 ----------
paletteEl.addEventListener('click', (e) => {
  const swatch = e.target.closest('.swatch');
  if (!swatch) return;
  const idx = parseInt(swatch.dataset.index, 10);
  const actBtn = e.target.closest('[data-act]');
  if (actBtn) {
    const act = actBtn.dataset.act;
    if (act === 'lock') {
      state.locks[idx] = !state.locks[idx];
      render();
      showToast(state.locks[idx] ? '已锁定' : '已解锁');
    } else if (act === 'copy') {
      copyText(state.colors[idx]);
    } else if (act === 'adjust') {
      adjustColor(idx);
    }
    return;
  }
  // 点击空白区域 = 复制 HEX
  copyText(state.colors[idx]);
});

// 微调颜色：在 HSL 空间做小幅随机扰动
function adjustColor(idx) {
  const hsl = CT.hexToHsl(state.colors[idx]);
  hsl.h = (hsl.h + (Math.random() * 16 - 8) + 360) % 360;
  hsl.s = Math.max(20, Math.min(95, hsl.s + (Math.random() * 14 - 7)));
  hsl.l = Math.max(20, Math.min(85, hsl.l + (Math.random() * 14 - 7)));
  state.colors[idx] = CT.hslToHex(hsl.h, hsl.s, hsl.l);
  render();
}

// ---------- 复制 ----------
async function copyText(text) {
  try {
    if (window.paletteAPI && window.paletteAPI.writeClipboard) {
      await window.paletteAPI.writeClipboard(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
    showToast(`已复制 ${text.toUpperCase()}`);
  } catch (err) {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast(`已复制 ${text.toUpperCase()}`); }
    catch (e2) { showToast('复制失败'); }
    document.body.removeChild(ta);
  }
}

// ---------- 图片取色 ----------
imageBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 200;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hexes = CT.extractPaletteFromImageData(data, 5);
      if (hexes.length > 0) {
        state.colors = hexes;
        state.locks = new Array(hexes.length).fill(false);
        render();
        updatePaletteName();
        showToast('已从图片提取 5 个主色');
      }
      URL.revokeObjectURL(img.src);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  imageInput.value = '';
});

// ---------- 对比度检查 ----------
const contrastPanel = $('#contrastPanel');
const contrastBtn = $('#contrastBtn');
const contrastClose = $('#contrastClose');
const contrastFg = $('#contrastFg');
const contrastBg = $('#contrastBg');
const contrastResult = $('#contrastResult');
const contrastPreview = $('#contrastPreview');

contrastBtn.addEventListener('click', () => {
  const visible = contrastPanel.hasAttribute('hidden') === false;
  closeAllPanels();
  if (!visible) {
    contrastPanel.hidden = false;
    contrastBtn.classList.add('active');
    // 默认取调色板首尾色
    if (state.colors.length >= 2) {
      contrastFg.value = state.colors[state.colors.length - 1];
      contrastBg.value = state.colors[0];
    }
    updateContrast();
  }
});

contrastClose.addEventListener('click', () => closeAllPanels());

[contrastFg, contrastBg].forEach((el) => el.addEventListener('input', updateContrast));

function updateContrast() {
  const fg = contrastFg.value;
  const bg = contrastBg.value;
  const ratio = CT.contrastRatio(fg, bg);
  const rounded = Math.round(ratio * 100) / 100;
  const aa = ratio >= 4.5;
  const aaa = ratio >= 7;
  let grade = '<span class="fail">不达标</span>';
  if (aaa) grade = '<span class="pass">AAA 达标</span>';
  else if (aa) grade = '<span class="pass">AA 达标</span>';
  contrastResult.innerHTML = `<div class="ratio">${rounded}:1</div><div class="grade">${grade} · ${ratio >= 3 ? '大文字可用' : '不可用'}</div>`;
  contrastPreview.style.color = fg;
  contrastPreview.style.background = bg;
}

// ---------- 收藏 ----------
const favoritesPanel = $('#favoritesPanel');
const favoritesBtn = $('#favoritesBtn');
const favoritesClose = $('#favoritesClose');
const favoritesList = $('#favoritesList');
const saveCurrentBtn = $('#saveCurrentBtn');

function loadFavorites() {
  try {
    state.favorites = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  } catch (e) {
    state.favorites = [];
  }
}

function saveFavorites() {
  localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites));
}

favoritesBtn.addEventListener('click', () => {
  const visible = favoritesPanel.hasAttribute('hidden') === false;
  closeAllPanels();
  if (!visible) {
    favoritesPanel.hidden = false;
    favoritesBtn.classList.add('active');
    renderFavorites();
  }
});

favoritesClose.addEventListener('click', () => closeAllPanels());

saveCurrentBtn.addEventListener('click', () => {
  if (state.colors.length === 0) return;
  state.favorites.unshift({ colors: state.colors.slice(), time: Date.now() });
  if (state.favorites.length > 50) state.favorites = state.favorites.slice(0, 50);
  saveFavorites();
  renderFavorites();
  showToast('已收藏当前调色板');
});

function renderFavorites() {
  if (state.favorites.length === 0) {
    favoritesList.innerHTML = '<div class="empty-state">暂无收藏<br>点击「收藏当前」保存喜欢的配色</div>';
    return;
  }
  favoritesList.innerHTML = state.favorites.map((f, i) => `
    <div class="fav-item" data-index="${i}">
      <div class="fav-strip">
        ${f.colors.map((c) => `<span style="background:${c}"></span>`).join('')}
      </div>
      <button class="fav-del" data-del="${i}" title="删除">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
      </button>
    </div>
  `).join('');
}

favoritesList.addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    const idx = parseInt(del.dataset.del, 10);
    state.favorites.splice(idx, 1);
    saveFavorites();
    renderFavorites();
    return;
  }
  const item = e.target.closest('.fav-item');
  if (item) {
    const idx = parseInt(item.dataset.index, 10);
    state.colors = state.favorites[idx].colors.slice();
    state.locks = new Array(state.colors.length).fill(false);
    render();
    updatePaletteName();
    closeAllPanels();
    showToast('已应用收藏的调色板');
  }
});

// ---------- 导出 ----------
const exportPanel = $('#exportPanel');
const exportBtn = $('#exportBtn');
const exportClose = $('#exportClose');
const exportCode = $('#exportCode');
const exportTabs = $('#exportTabs');
const copyExportBtn = $('#copyExportBtn');
const downloadPngBtn = $('#downloadPngBtn');
let currentExportFormat = 'css';

exportBtn.addEventListener('click', () => {
  const visible = exportPanel.hasAttribute('hidden') === false;
  closeAllPanels();
  if (!visible) {
    exportPanel.hidden = false;
    exportBtn.classList.add('active');
    updateExport();
  }
});

exportClose.addEventListener('click', () => closeAllPanels());

exportTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.export-tab');
  if (!tab) return;
  $$('.export-tab').forEach((t) => t.classList.remove('active'));
  tab.classList.add('active');
  currentExportFormat = tab.dataset.format;
  updateExport();
});

function updateExport() {
  exportCode.textContent = buildExport(currentExportFormat);
}

function buildExport(format) {
  const names = state.colors.map((c, i) => `color${i + 1}`);
  switch (format) {
    case 'css':
      return ':root {\n' + state.colors.map((c, i) => `  --${names[i]}: ${c};`).join('\n') + '\n}';
    case 'scss':
      return state.colors.map((c, i) => `$${names[i]}: ${c};`).join('\n');
    case 'json':
      return JSON.stringify({ palette: state.colors }, null, 2);
    case 'tailwind':
      return '// tailwind.config.js theme.extend.colors\n' + state.colors.map((c, i) => `  ${names[i]}: "${c}",`).join('\n');
    default:
      return '';
  }
}

copyExportBtn.addEventListener('click', () => copyText(exportCode.textContent));

downloadPngBtn.addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  const w = canvas.width / state.colors.length;
  state.colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * w, 0, w, canvas.height);
  });
  const link = document.createElement('a');
  link.download = 'palette.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('已导出 PNG 预览图');
});

// ---------- 面板管理 ----------
function closeAllPanels() {
  contrastPanel.hidden = true;
  favoritesPanel.hidden = true;
  exportPanel.hidden = true;
  contrastBtn.classList.remove('active');
  favoritesBtn.classList.remove('active');
  exportBtn.classList.remove('active');
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  // 强制重排以触发动画
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => { toastEl.hidden = true; }, 300);
  }, 1800);
}

// ---------- 键盘快捷键 ----------
document.addEventListener('keydown', (e) => {
  // 空格生成新调色板（非输入框聚焦时）
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    generate();
  }
  // Cmd/Ctrl + C 复制（无选区时复制首色）
  // Escape 关闭面板
  if (e.key === 'Escape') closeAllPanels();
});

// ---------- 托盘菜单事件 ----------
if (window.paletteAPI) {
  window.paletteAPI.onMenuRandom(() => generate());
  window.paletteAPI.onMenuImportClipboard(async () => {
    const text = await window.paletteAPI.readClipboard();
    const hexes = text.match(/#[0-9a-fA-F]{6}/g);
    if (hexes && hexes.length > 0) {
      state.colors = hexes.slice(0, 8);
      state.locks = new Array(state.colors.length).fill(false);
      render();
      updatePaletteName();
      showToast(`已从剪贴板导入 ${state.colors.length} 个颜色`);
    } else {
      showToast('剪贴板未找到有效 HEX 颜色');
    }
  });
}

// ---------- 启动 ----------
function init() {
  initModes();
  loadFavorites();
  freshGenerate();
}

init();
