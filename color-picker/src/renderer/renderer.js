// 拾色管家 - 渲染进程逻辑
'use strict';

// 颜色工具（从 core/color-utils 拷贝核心函数，避免 nodeIntegration）
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function rgbToHex(r, g, b) {
  const to2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
function hexToRgb(hex) {
  let h = (hex || '').trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
function rgbToHsl(r, g, b) {
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
  let h = 0;
  if (d) {
    if (max===r) h = ((g-b)/d)%6;
    else if (max===g) h = (b-r)/d+2;
    else h = (r-g)/d+4;
    h *= 60; if (h<0) h+=360;
  }
  const l = (max+min)/2;
  const s = d===0 ? 0 : d/(1-Math.abs(2*l-1));
  return { h: Math.round(h), s: Math.round(s*100), l: Math.round(l*100) };
}
function bestFg(r, g, b) {
  const lum = (0.299*r + 0.587*g + 0.114*b)/255;
  return lum > 0.55 ? '#1d1d1f' : '#ffffff';
}

// ---------- 状态 ----------
let store = null;
let currentColor = { r: 0, g: 122, b: 255, hex: '#007aff' };
let activeFormat = 'hex';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const currentSwatch = $('currentSwatch');
const currentHex = $('currentHex');
const historyGrid = $('historyGrid');
const paletteGrid = $('paletteGrid');
const paletteSelect = $('paletteSelect');
const paletteCurrentHex = $('paletteCurrentHex');
const fmtBtns = document.querySelectorAll('.fmt-btn');
const copyBtn = $('copyCurrent');
const pickBtn = $('pickBtn');
const toast = $('toast');
const addToPaletteBtn = $('addToPaletteBtn');
const newPaletteBtn = $('newPaletteBtn');
const delPaletteBtn = $('delPaletteBtn');
const renamePaletteBtn = $('renamePaletteBtn');

// ---------- 工具 ----------
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1400);
}

function formatBy(color, fmt) {
  const { r, g, b } = color;
  if (fmt === 'rgb') return `rgb(${r}, ${g}, ${b})`;
  if (fmt === 'hsl') { const h = rgbToHsl(r,g,b); return `hsl(${h.h}, ${h.s}%, ${h.l}%)`; }
  if (fmt === 'hexUpper') return color.hex.toUpperCase();
  return color.hex;
}

function updateCurrentColor(color) {
  currentColor = color;
  currentSwatch.style.background = color.hex;
  currentHex.textContent = color.hex.toUpperCase();
  currentHex.style.color = bestFg(color.r, color.g, color.b);
  paletteCurrentHex.textContent = color.hex.toUpperCase();
  // 更新格式按钮显示
  fmtBtns.forEach((btn) => {
    const f = btn.dataset.fmt;
    btn.textContent = formatBy(color, f);
  });
}

async function copyText(text) {
  await window.api.clipboard.write(text);
  showToast(`已复制：${text}`);
}

// ---------- 渲染历史 ----------
function renderHistory() {
  historyGrid.innerHTML = '';
  const list = (store && store.history) || [];
  if (list.length === 0) {
    historyGrid.innerHTML = '<div class="empty"><span class="empty-icon">⊙</span>还没有拾取记录<br>点击右上角「开始取色」</div>';
    return;
  }
  list.forEach((c) => {
    const div = document.createElement('div');
    div.className = 'swatch';
    div.style.background = c.hex;
    div.title = `${c.hex.toUpperCase()} · 点击复制 · 右键加入调色板`;
    div.innerHTML = `<span class="label">${c.hex.toUpperCase()}</span>`;
    div.addEventListener('click', () => {
      updateCurrentColor({ r: c.r, g: c.g, b: c.b, hex: c.hex });
      copyText(formatBy({ r: c.r, g: c.g, b: c.b, hex: c.hex }, activeFormat));
    });
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      addCurrentToPalette(c.hex);
    });
    historyGrid.appendChild(div);
  });
}

// ---------- 渲染调色板 ----------
function currentPalette() {
  if (!store || !store.palettes.length) return null;
  return store.palettes.find((p) => p.id === paletteSelect.value) || store.palettes[0];
}

function renderPaletteSelect() {
  paletteSelect.innerHTML = '';
  (store.palettes || []).forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.colors.length})`;
    paletteSelect.appendChild(opt);
  });
  // 保留当前选中
  if (currentPaletteId) paletteSelect.value = currentPaletteId;
}

let currentPaletteId = null;

function renderPalette() {
  const p = currentPalette();
  if (!p) return;
  currentPaletteId = p.id;
  paletteGrid.innerHTML = '';
  if (p.colors.length === 0) {
    paletteGrid.innerHTML = '<div class="empty"><span class="empty-icon">🎨</span>这个调色板还是空的<br>加入一些颜色吧</div>';
    return;
  }
  p.colors.forEach((hex) => {
    const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
    const div = document.createElement('div');
    div.className = 'swatch';
    div.style.background = hex;
    div.title = `${hex.toUpperCase()} · 点击复制 · × 删除`;
    div.innerHTML = `<span class="label">${hex.toUpperCase()}</span>
      <button class="remove" title="移除">×</button>`;
    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove')) return;
      updateCurrentColor({ r: rgb.r, g: rgb.g, b: rgb.b, hex: hex.toLowerCase() });
      copyText(formatBy({ r: rgb.r, g: rgb.g, b: rgb.b, hex: hex.toLowerCase() }, activeFormat));
    });
    div.querySelector('.remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      store = await window.api.palette.removeColor(p.id, hex);
      renderPalette();
      renderPaletteSelect();
      showToast(`已从调色板移除 ${hex.toUpperCase()}`);
    });
    paletteGrid.appendChild(div);
  });
}

// ---------- 加入调色板 ----------
async function addCurrentToPalette(hexOverride) {
  const hex = (hexOverride || currentColor.hex).toLowerCase();
  const p = currentPalette();
  if (!p) return;
  store = await window.api.palette.addColor(p.id, hex);
  renderPalette();
  renderPaletteSelect();
  showToast(`已加入「${p.name}」：${hex.toUpperCase()}`);
}

// ---------- 事件 ----------
fmtBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    fmtBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFormat = btn.dataset.fmt;
  });
});

copyBtn.addEventListener('click', () => {
  copyText(formatBy(currentColor, activeFormat));
});

pickBtn.addEventListener('click', async () => {
  await window.api.picker.start();
});

paletteSelect.addEventListener('change', () => {
  currentPaletteId = paletteSelect.value;
  renderPalette();
});

addToPaletteBtn.addEventListener('click', () => addCurrentToPalette());

newPaletteBtn.addEventListener('click', async () => {
  const name = prompt('请输入调色板名称：', '新调色板');
  if (!name) return;
  store = await window.api.palette.create(name);
  renderPaletteSelect();
  // 选中新创建的
  const last = store.palettes[store.palettes.length - 1];
  paletteSelect.value = last.id;
  currentPaletteId = last.id;
  renderPalette();
  showToast(`已创建调色板「${name}」`);
});

delPaletteBtn.addEventListener('click', async () => {
  const p = currentPalette();
  if (!p) return;
  if (store.palettes.length <= 1) {
    showToast('至少保留一个调色板');
    return;
  }
  if (!confirm(`确定删除调色板「${p.name}」吗？`)) return;
  store = await window.api.palette.delete(p.id);
  currentPaletteId = store.palettes[0].id;
  renderPaletteSelect();
  renderPalette();
  showToast('已删除');
});

renamePaletteBtn.addEventListener('click', async () => {
  const p = currentPalette();
  if (!p) return;
  const name = prompt('新的调色板名称：', p.name);
  if (!name || name === p.name) return;
  store = await window.api.palette.rename(p.id, name);
  renderPaletteSelect();
  showToast('已重命名');
});

// 取色结果回调
window.api.picker.onResult((color) => {
  // 统一 hex 小写
  color.hex = color.hex.toLowerCase();
  updateCurrentColor(color);
  renderHistory();
  showToast(`已拾取：${color.hex.toUpperCase()}`);
});

// ---------- 初始化 ----------
(async function init() {
  store = await window.api.store.get();
  // 应用当前色（默认第一个历史或 #007AFF）
  if (store.history && store.history.length > 0) {
    const c = store.history[0];
    updateCurrentColor({ r: c.r, g: c.g, b: c.b, hex: c.hex.toLowerCase() });
  } else {
    updateCurrentColor({ r: 0, g: 122, b: 255, hex: '#007aff' });
  }
  renderPaletteSelect();
  currentPaletteId = store.palettes[0]?.id;
  renderPalette();
  renderHistory();
})();
