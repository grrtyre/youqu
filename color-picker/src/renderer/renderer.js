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

// WCAG 相对亮度（与 core/color-utils 保持一致）
function relativeLuminance(r, g, b) {
  const toLinear = (c) => {
    const s = clamp(c, 0, 255) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function wcagGrade(ratio) {
  const r = Math.max(0, Number(ratio) || 0);
  return {
    ratio: Math.round(r * 100) / 100,
    aaNormal: r >= 4.5,
    aaLarge: r >= 3,
    aaaNormal: r >= 7,
    aaaLarge: r >= 4.5,
  };
}

// Electron Accelerator 修饰键映射（keydown -> accelerator）
const MOD_MAP = {
  'Control': 'CommandOrControl',
  'Ctrl': 'CommandOrControl',
  'Alt': 'Alt',
  'Shift': 'Shift',
  'Meta': 'Super',
  'Command': 'Command',
};
const KEY_MAP = {
  ' ': 'Space',
  'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'ArrowUp': 'Up', 'ArrowDown': 'Down',
  'Enter': 'Return', 'Escape': 'Esc', 'Backspace': 'Backspace',
  'Insert': 'Insert', 'Delete': 'Delete', 'Home': 'Home', 'End': 'End',
  'PageUp': 'PageUp', 'PageDown': 'PageDown',
  'Tab': 'Tab',
};

// ---------- 状态 ----------
let store = null;
let currentColor = { r: 0, g: 122, b: 255, hex: '#007aff' };
let activeFormat = 'hex';
let recordingShortcut = false;
let pendingShortcut = null;

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
const pickShortcut = $('pickShortcut');
const toast = $('toast');
const addToPaletteBtn = $('addToPaletteBtn');
const newPaletteBtn = $('newPaletteBtn');
const delPaletteBtn = $('delPaletteBtn');
const renamePaletteBtn = $('renamePaletteBtn');
const settingsBtn = $('settingsBtn');
const settingsModal = $('settingsModal');
const closeSettings = $('closeSettings');
const shortcutInput = $('shortcutInput');
const recordShortcutBtn = $('recordShortcutBtn');
const resetShortcutBtn = $('resetShortcutBtn');
const saveSettingsBtn = $('saveSettingsBtn');
const exportBtns = document.querySelectorAll('[data-export]');
const fgColor = $('fgColor');
const fgHex = $('fgHex');
const bgColor = $('bgColor');
const bgHex = $('bgHex');
const swapColorsBtn = $('swapColorsBtn');
const useCurrentAsFg = $('useCurrentAsFg');
const ratioValue = $('ratioValue');
const previewText = $('previewText');
const gradeIds = ['gradeAaNormal', 'gradeAaLarge', 'gradeAaaNormal', 'gradeAaaLarge'];

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
  fmtBtns.forEach((btn) => {
    const f = btn.dataset.fmt;
    btn.textContent = formatBy(color, f);
  });
}

async function copyText(text) {
  await window.api.clipboard.write(text);
  showToast(`已复制：${text}`);
}

/** 把存储里的快捷键（CommandOrControl+Shift+C）格式化为展示文本（Ctrl+Shift+C） */
function formatShortcutLabel(sc) {
  return (sc || '').replace(/CommandOrControl|CmdOrCtrl/g, 'Ctrl');
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

let currentPaletteId = null;

function renderPaletteSelect() {
  paletteSelect.innerHTML = '';
  (store.palettes || []).forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.colors.length})`;
    paletteSelect.appendChild(opt);
  });
  if (currentPaletteId) paletteSelect.value = currentPaletteId;
}

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

// ---------- 对比度检查器 ----------
function updateContrast() {
  const fg = hexToRgb(fgHex.value) || { r: 0, g: 0, b: 0 };
  const bg = hexToRgb(bgHex.value) || { r: 255, g: 255, b: 255 };
  // 同步原生 color picker
  fgColor.value = fgHex.value;
  bgColor.value = bgHex.value;
  const ratio = contrastRatio(fg, bg);
  const grade = wcagGrade(ratio);
  ratioValue.textContent = grade.ratio.toFixed(2);
  const map = { gradeAaNormal: grade.aaNormal, gradeAaLarge: grade.aaLarge, gradeAaaNormal: grade.aaaNormal, gradeAaaLarge: grade.aaaLarge };
  gradeIds.forEach((id) => {
    const el = $(id);
    el.textContent = map[id] ? '通过' : '不通过';
    el.className = `grade-tag ${map[id] ? 'pass' : 'fail'}`;
  });
  // 预览
  previewText.style.color = fgHex.value;
  previewText.style.background = bgHex.value;
}

// ---------- 设置弹层 ----------
function openSettings() {
  shortcutInput.value = formatShortcutLabel(store.settings.shortcut);
  pendingShortcut = store.settings.shortcut;
  shortcutInput.classList.remove('recording');
  recordingShortcut = false;
  recordShortcutBtn.textContent = '录制';
  settingsModal.classList.add('show');
}
function closeSettingsModal() {
  settingsModal.classList.remove('show');
  recordingShortcut = false;
  shortcutInput.classList.remove('recording');
  recordShortcutBtn.textContent = '录制';
}

function startRecording() {
  recordingShortcut = true;
  pendingShortcut = null;
  shortcutInput.value = '';
  shortcutInput.classList.add('recording');
  shortcutInput.placeholder = '请按下组合键…';
  recordShortcutBtn.textContent = '停止';
}
function stopRecording() {
  recordingShortcut = false;
  shortcutInput.classList.remove('recording');
  shortcutInput.placeholder = '点击录制';
  recordShortcutBtn.textContent = '录制';
  if (!pendingShortcut) {
    shortcutInput.value = formatShortcutLabel(store.settings.shortcut);
  }
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

// 导出按钮
exportBtns.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const p = currentPalette();
    if (!p) return;
    if (!p.colors.length) {
      showToast('当前调色板为空，无可导出内容');
      return;
    }
    const fmt = btn.dataset.export;
    const res = await window.api.palette.export(p, fmt);
    if (res && res.ok) {
      showToast(`已导出 ${fmt.toUpperCase()}：${res.path}`);
    } else if (res && res.error) {
      showToast(`导出失败：${res.error}`);
    }
  });
});

// 对比度检查器
[fgColor, fgHex, bgColor, bgHex].forEach((el) => {
  el.addEventListener('input', () => {
    // 文本框输入时同步另一方
    if (el === fgColor) fgHex.value = fgColor.value.toLowerCase();
    else if (el === bgColor) bgHex.value = bgColor.value.toLowerCase();
    else if (el === fgHex) { const v = fgHex.value.trim(); if (/^#?[0-9a-fA-F]{6}$/.test(v)) fgColor.value = v.startsWith('#') ? v : '#' + v; }
    else if (el === bgHex) { const v = bgHex.value.trim(); if (/^#?[0-9a-fA-F]{6}$/.test(v)) bgColor.value = v.startsWith('#') ? v : '#' + v; }
    updateContrast();
  });
});
swapColorsBtn.addEventListener('click', () => {
  const tmp = fgHex.value;
  fgHex.value = bgHex.value;
  bgHex.value = tmp;
  updateContrast();
});
useCurrentAsFg.addEventListener('click', () => {
  fgHex.value = currentColor.hex;
  updateContrast();
});

// 设置弹层
settingsBtn.addEventListener('click', openSettings);
closeSettings.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});

recordShortcutBtn.addEventListener('click', () => {
  if (recordingShortcut) stopRecording();
  else startRecording();
});
resetShortcutBtn.addEventListener('click', () => {
  pendingShortcut = 'CommandOrControl+Shift+C';
  shortcutInput.value = formatShortcutLabel(pendingShortcut);
  shortcutInput.classList.remove('recording');
  recordingShortcut = false;
  recordShortcutBtn.textContent = '录制';
});

// 录制快捷键：全局 keydown
document.addEventListener('keydown', (e) => {
  if (!recordingShortcut) return;
  e.preventDefault();
  e.stopPropagation();
  // 单独的修饰键按下不算
  if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return;
  const mods = new Set();
  if (e.ctrlKey) mods.add('CommandOrControl');
  if (e.altKey) mods.add('Alt');
  if (e.shiftKey) mods.add('Shift');
  if (e.metaKey) mods.add('Super');
  if (mods.size === 0) return; // 至少一个修饰键
  let key = KEY_MAP[e.key] || e.key;
  // 单字符统一大写
  if (key.length === 1) key = key.toUpperCase();
  const acc = Array.from(mods).join('+') + '+' + key;
  pendingShortcut = acc;
  shortcutInput.value = formatShortcutLabel(acc);
  stopRecording();
});

saveSettingsBtn.addEventListener('click', async () => {
  if (!pendingShortcut || pendingShortcut === store.settings.shortcut) {
    closeSettingsModal();
    return;
  }
  const res = await window.api.settings.setShortcut(pendingShortcut);
  if (res && res.ok) {
    store.settings.shortcut = res.shortcut;
    pickShortcut.textContent = formatShortcutLabel(res.shortcut);
    showToast(`快捷键已更新：${formatShortcutLabel(res.shortcut)}`);
    closeSettingsModal();
  } else {
    showToast(res && res.error ? res.error : '快捷键保存失败');
  }
});

// 取色结果回调
window.api.picker.onResult((color) => {
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
  // 顶部快捷键标签
  pickShortcut.textContent = formatShortcutLabel(store.settings.shortcut);
  // 对比度初始化
  updateContrast();
})();
