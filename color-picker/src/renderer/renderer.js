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

// ---------- 颜色名称识别（与 core/color-utils 保持一致） ----------
// RGB → XYZ → Lab，最近邻匹配内置中文颜色字典
function rgbToXyzLocal(r, g, b) {
  const toLinear = (c) => {
    const s = clamp(c, 0, 255) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  return {
    x: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    y: R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
    z: R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
  };
}
function xyzToLabLocal(x, y, z) {
  const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116));
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
function rgbToLabLocal(r, g, b) {
  const xyz = rgbToXyzLocal(r, g, b);
  return xyzToLabLocal(xyz.x, xyz.y, xyz.z);
}
function labDistLocal(lab1, lab2) {
  const dL = lab1.L - lab2.L, da = lab1.a - lab2.a, db = lab1.b - lab2.b;
  return Math.sqrt(dL*dL + da*da + db*db);
}
// 内置颜色字典（与 core/color-utils 一致）
const COLOR_DICT = [
  ['#ffffff','纯白'],['#f5f5f7','苹果灰白'],['#e8e8ed','浅银灰'],['#d1d1d6','银灰'],['#a8a8ad','中灰'],
  ['#8e8e93','系统灰'],['#6e6e73','深灰'],['#3a3a3c','炭灰'],['#1d1d1f','墨黑'],['#000000','纯黑'],
  ['#fff5f5','樱粉白'],['#ffe3e3','浅珊瑚'],['#ffd1d1','薄红'],['#ffcccb','婴儿粉'],['#ff7eb6','蜜桃粉'],
  ['#ff5ba7','玫红'],['#ff375f','玫粉'],['#ff2d55','苹果红'],['#ff3b30','系统红'],['#d70015','正红'],
  ['#c8232c','胭脂红'],['#a8201a','酒红'],['#8b0000','暗红'],['#5c0a0a','枣红'],
  ['#fff8e1','象牙白'],['#ffecb3','浅米黄'],['#ffe4b5','莫卡辛'],['#ffd60a','明黄'],['#ffcc00','金黄'],
  ['#ff9500','苹果橙'],['#ff8c00','深橙'],['#ff6b00','南瓜橙'],['#e8590c','焦橙'],['#c94f00','砖橙'],
  ['#fff9c4','柠檬白'],['#fff59d','浅黄'],['#ffee58','亮黄'],['#ffeb3b','正黄'],['#fbc02d','芥末黄'],
  ['#f9a825','金黄'],['#b8860b','暗金'],
  ['#f0fff0','薄荷白'],['#c8e6c9','浅绿'],['#a5d6a7','嫩绿'],['#81c784','春绿'],['#66bb6a','草绿'],
  ['#43a047','正绿'],['#2e7d32','森林绿'],['#1b5e20','墨绿'],['#34c759','苹果绿'],['#30b0c7','青绿'],
  ['#00897b','鸭青'],['#00695c','松绿'],
  ['#e0f7fa','浅水蓝'],['#b2ebf2','冰蓝'],['#80deea','青蓝'],['#4dd0e1','湖蓝'],['#00bcd4','青色'],
  ['#00acc1','深青'],['#0097a7','孔雀蓝'],['#006064','深海蓝'],
  ['#e3f2fd','浅天蓝'],['#bbdefb','晨蓝'],['#90caf9','霜蓝'],['#64b5f6','天蓝'],['#42a5f5','亮蓝'],
  ['#2196f3','材料蓝'],['#1e88e5','正蓝'],['#1976d2','强蓝'],['#1565c0','深蓝'],['#0d47a1','海军蓝'],
  ['#007aff','苹果蓝'],['#0a84ff','iOS 蓝'],
  ['#ede7f6','浅紫白'],['#d1c4e9','薰衣草'],['#b39ddb','浅紫'],['#9575cd','中紫'],['#7e57c2','葡萄紫'],
  ['#673ab7','深紫'],['#5e35b1','深紫罗兰'],['#4527a0','暗紫'],['#af52de','苹果紫'],['#bf5af2','亮紫'],
  ['#fbe9e7','浅粉橙'],['#ffccbc','浅鲑鱼'],['#ffab91','鲑鱼粉'],['#ff8a65','深鲑鱼'],['#ff7043','橙红'],
  ['#f4511e','番茄红'],
  ['#fce4ec','浅粉白'],['#f8bbd0','樱粉'],['#f48fb1','浅玫粉'],['#ec407a','玫粉'],['#d81b60','深玫红'],
  ['#ad1457','暗玫红'],['#880e4f','酒紫红'],
  ['#efebe9','米白'],['#d7ccc8','浅棕'],['#bcaaa4','灰棕'],['#a1887f','咖啡'],['#8d6e63','驼色'],
  ['#6d4c41','棕色'],['#4e342e','深棕'],['#3e2723','巧克力'],
  ['#efe5b8','米色'],['#e6c200','麦穗黄'],['#a67c00','橄榄'],['#735400','深橄榄'],['#585800','橄榄绿'],
  ['#80c0ff','天空蓝'],['#aedff0','婴儿蓝'],['#c2d3e6','雾蓝'],['#a9b7d6','钢蓝'],['#7d8ba6','灰蓝'],
  ['#4b6584','岩灰蓝'],
  ['#ddbbdd','丁香紫'],['#aa88aa','紫罗兰'],['#885588','深紫罗兰'],['#553355','暗梅'],
  ['#d0e8a0','黄绿'],['#9ab040','橄榄黄绿'],['#6b8e23','橄榄褐'],
  ['#cd853f','秘鲁色'],['#daa520','金菊黄'],['#b8860b','暗金菊'],['#bdb76b','卡其'],
  ['#1abc9c','绿松石'],['#16a085','深绿松石'],['#008b8b','暗青'],
  ['#ff69b4','热粉'],['#ff1493','深粉'],['#c71585','中紫红'],
  ['#4b0082','靛蓝'],['#483d8b','暗靛'],['#6a5acd','板岩蓝'],
];
const _DICT_LAB_LOCAL = COLOR_DICT.map(([hex, name]) => {
  const r = hexToRgb(hex);
  return { hex, name, lab: rgbToLabLocal(r.r, r.g, r.b) };
});
function nameColorLocal(rgb) {
  if (!rgb) return { name: '未知颜色', hex: '#000000' };
  const lab = rgbToLabLocal(rgb.r, rgb.g, rgb.b);
  let best = _DICT_LAB_LOCAL[0], bestDist = Infinity;
  for (let i = 0; i < _DICT_LAB_LOCAL.length; i++) {
    const d = labDistLocal(lab, _DICT_LAB_LOCAL[i].lab);
    if (d < bestDist) { bestDist = d; best = _DICT_LAB_LOCAL[i]; }
  }
  return { name: best.name, hex: best.hex };
}

// ---------- 配色推荐（与 core/color-utils 保持一致） ----------
function harmoniesLocal(rgb) {
  if (!rgb) return { complementary: null, analogous: [], triadic: [], tetradic: [], splitComplementary: [] };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const rotate = (deg) => {
    const newH = ((hsl.h + deg) % 360 + 360) % 360;
    const c = hslToRgbLocal(newH, hsl.s, hsl.l);
    return { r: c.r, g: c.g, b: c.b, hex: rgbToHex(c.r, c.g, c.b) };
  };
  return {
    complementary: rotate(180),
    analogous: [rotate(-30), rotate(30)],
    triadic: [rotate(120), rotate(240)],
    tetradic: [rotate(90), rotate(180), rotate(270)],
    splitComplementary: [rotate(150), rotate(210)],
  };
}
function hslToRgbLocal(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return { r: Math.round((r1+m)*255), g: Math.round((g1+m)*255), b: Math.round((b1+m)*255) };
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
const colorName = $('colorName');
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
const previewLarge = $('previewLarge');
const previewBody = $('previewBody');
const previewSmall = $('previewSmall');
const harmonyList = $('harmonyList');
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
  // 颜色名称识别
  const named = nameColorLocal(color);
  colorName.textContent = named.name;
  fmtBtns.forEach((btn) => {
    const f = btn.dataset.fmt;
    btn.textContent = formatBy(color, f);
  });
  // 配色推荐
  renderHarmonies(color);
}

// ---------- 渲染配色推荐 ----------
function renderHarmonies(color) {
  const h = harmoniesLocal(color);
  harmonyList.innerHTML = '';
  const rows = [
    { label: '互补色', sub: '180°', items: h.complementary ? [h.complementary] : [] },
    { label: '类似色', sub: '±30°', items: h.analogous },
    { label: '三元色', sub: '±120°', items: h.triadic },
    { label: '四元色', sub: '90/180/270°', items: h.tetradic },
    { label: '分裂互补', sub: '150/210°', items: h.splitComplementary },
  ];
  rows.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'harmony-row';
    const labelEl = document.createElement('div');
    labelEl.className = 'harmony-label';
    labelEl.innerHTML = `${row.label}<span class="harmony-sub">${row.sub}</span>`;
    rowEl.appendChild(labelEl);
    const swatchesEl = document.createElement('div');
    swatchesEl.className = 'harmony-swatches';
    row.items.forEach((c) => {
      const sw = document.createElement('div');
      sw.className = 'harm-swatch';
      sw.style.background = c.hex;
      sw.title = `${c.hex.toUpperCase()} · 点击加入调色板 · 右键复制`;
      sw.innerHTML = `<span class="harm-hex">${c.hex.toUpperCase()}</span>`;
      sw.addEventListener('click', () => {
        addCurrentToPalette(c.hex);
      });
      sw.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        copyText(c.hex);
      });
      swatchesEl.appendChild(sw);
    });
    rowEl.appendChild(swatchesEl);
    harmonyList.appendChild(rowEl);
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
    // 使用 swatch-wrap 结构：色块 + 下方独立标签（白底黑字，可读性强）
    const wrap = document.createElement('div');
    wrap.className = 'swatch-wrap';
    const div = document.createElement('div');
    div.className = 'swatch';
    div.style.background = c.hex;
    div.title = `${c.hex.toUpperCase()} · 点击复制 · 右键加入调色板`;
    const label = document.createElement('div');
    label.className = 'swatch-label';
    label.textContent = c.hex.toUpperCase();
    div.addEventListener('click', () => {
      updateCurrentColor({ r: c.r, g: c.g, b: c.b, hex: c.hex });
      copyText(formatBy({ r: c.r, g: c.g, b: c.b, hex: c.hex }, activeFormat));
    });
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      addCurrentToPalette(c.hex);
    });
    wrap.appendChild(div);
    wrap.appendChild(label);
    historyGrid.appendChild(wrap);
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
    // 使用 swatch-wrap 结构：色块（含删除按钮）+ 下方独立标签
    const wrap = document.createElement('div');
    wrap.className = 'swatch-wrap';
    const div = document.createElement('div');
    div.className = 'swatch';
    div.style.background = hex;
    div.title = `${hex.toUpperCase()} · 点击复制 · × 删除`;
    div.innerHTML = `<button class="remove" title="移除">×</button>`;
    const label = document.createElement('div');
    label.className = 'swatch-label';
    label.textContent = hex.toUpperCase();
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
    wrap.appendChild(div);
    wrap.appendChild(label);
    paletteGrid.appendChild(wrap);
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
  // 多字号预览：大标题 / 正文 / 小字
  [previewLarge, previewBody, previewSmall].forEach((el) => {
    el.style.color = fgHex.value;
    el.style.background = bgHex.value;
  });
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
