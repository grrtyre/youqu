// renderer.js - 环境音播放器界面逻辑
// 注意：必须用 IIFE 包裹。synth.js 在脚本顶层声明了 const SOUNDS，
// 若这里再用 `const { SOUNDS } = window.AmbientSynth` 会触发
// "Identifier 'SOUNDS' has already been declared" SyntaxError，
// 导致整文件无法解析、界面完全不渲染。
(function () {
  'use strict';
  window.__rendererLoaded = true;

  const { SOUNDS } = window.AmbientSynth;
  const SoundEngine = window.AmbientEngine;

// 声音图标（统一线性描边风格，stroke-width 1.7，linecap/linejoin 全部 round）
const ICONS = {
  white:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="10.5"/></svg>',
  pink:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 18 0"/><path d="M3 12a9 9 0 0 0 9 9" stroke-dasharray="2 2.5"/></svg>',
  brown:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 3 3 4.5 0"/></svg>',
  rain:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14a4 4 0 0 1 .5-7.97 5 5 0 0 1 9.4 1.4A3.5 3.5 0 0 1 16.5 14"/><path d="M9 17l-1 3.5M13 17l-1 3.5M16 17l-1 3.5"/></svg>',
  waves:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>',
  wind:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 14h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 20h8"/></svg>',
  // 篝火：开放线条风格（两条主火焰 + 一根木柴），避免闭合形状看起来像填充
  fire:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.6 2.4 2.8 3.8 2.8 7.2 0 1.4-.6 2.6-1.6 3.3.3-1.4-.2-2.8-1.2-3.6-.2 1.6-1 2.4-1.6 3-.4-1.2-.1-2.4.4-3.4-1.2.6-2 2-2 3.6 0 .3 0 .6.1.9-1.2-.7-2-2-2-3.6 0-3.4 2.3-5 3.1-7.4z"/><path d="M7 19h10"/><path d="M9 19l-1 2M15 19l1 2"/></svg>',
  // 溪流：开放水滴 + 三道波纹，避免闭合水滴看起来像填充
  stream: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2 2.8 4.5 5.2 4.5 8.5"/><path d="M12 3c-2 2.8-4.5 5.2-4.5 8.5"/><path d="M7 14c1.5 1.5 3.5 1.5 5 0s3.5-1.5 5 0"/><path d="M7 18c1.5 1.5 3.5 1.5 5 0s3.5-1.5 5 0"/></svg>',
};

const DEFAULT_PRESETS = [
  { name: '深度专注', sounds: { rain: 0.55, brown: 0.30 } },
  { name: '安心助眠', sounds: { waves: 0.55, pink: 0.30 } },
  { name: '冥想放松', sounds: { stream: 0.50, wind: 0.30 } },
  { name: '雨夜书房', sounds: { rain: 0.60, fire: 0.40 } },
];

let engine = null;
let spectrumCanvas, spectrumCtx, spectrumDpr = 1;
let timerEnd = null, timerInterval = null;
let activePresetIdx = -1;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

async function init() {
  window.__initStarted = true;
  try {
    engine = new SoundEngine();
    window.__afterEngine = true;
    // 先渲染界面（便于截图与即时响应），再后台准备音频缓冲区
    renderSounds();
    window.__afterRender = true;
    renderPresets();
    bindControls();
    initSpectrum();
    updateStatus();
    // 演示模式（仅用于截图展示）：激活若干卡片 + 模拟频谱，不真正播放音频
    if (new URLSearchParams(location.search).get('demo') === '1') {
      if (engine) engine._demoMode = true;
      const demoIds = ['rain', 'fire', 'waves'];
      demoIds.forEach((id) => {
        const card = document.querySelector(`.sound-card[data-id="${id}"]`);
        if (card) {
          card.classList.add('active');
          // 重新计算滑块填充色以反映激活态
          const slider = card.querySelector('input[type=range]');
          if (slider) updateSliderFill(slider);
        }
      });
      const demoNames = demoIds.map((id) => {
        const s = SOUNDS.find((x) => x.id === id);
        return s ? s.name : id;
      }).join('、');
      const st = $('#status');
      st.textContent = '播放中 · ' + demoNames;
      st.classList.add('playing');
      // 频谱在无引擎时也启用 demo 视觉
      window.__demoMode = true;
    }
    await engine.prepare();
  } catch (e) {
    window.__initError = String(e);
    // Even if engine fails, still render the UI
    if (engine === null) {
      renderSounds();
      renderPresets();
      bindControls();
      initSpectrum();
      updateStatus();
    }
  }
}

function renderSounds() {
  const grid = $('#soundGrid');
  grid.innerHTML = SOUNDS.map((s) => `
    <div class="sound-card" data-id="${s.id}">
      <button class="card-toggle" type="button">
        <div class="card-icon">${ICONS[s.id] || ''}</div>
        <div class="card-text">
          <div class="card-name">${s.name}</div>
          <div class="card-desc">${s.desc}</div>
        </div>
      </button>
      <div class="card-volume">
        <input type="range" min="0" max="100" value="60" data-id="${s.id}" aria-label="${s.name}音量">
      </div>
    </div>
  `).join('');

  $$('.sound-card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.card-toggle').addEventListener('click', () => toggleSound(id));
    const slider = card.querySelector('input[type=range]');
    slider.addEventListener('input', () => {
      const v = slider.value / 100;
      engine.setVolume(id, v);
      updateSliderFill(slider);
      if (!engine.isPlaying(id) && v > 0.01) {
        ensureResume();
        engine.play(id);
        card.classList.add('active');
        clearPresetActive();
        updateStatus();
      } else if (engine.isPlaying(id) && v < 0.01) {
        engine.stop(id);
        card.classList.remove('active');
        updateStatus();
      }
    });
    updateSliderFill(slider);
  });
}

function toggleSound(id) {
  ensureResume();
  const card = document.querySelector(`.sound-card[data-id="${id}"]`);
  if (engine.isPlaying(id)) {
    engine.stop(id);
    card.classList.remove('active');
  } else {
    engine.play(id);
    card.classList.add('active');
  }
  // 重新计算滑块填充色（激活/非激活态颜色不同）
  const slider = card.querySelector('input[type=range]');
  if (slider) updateSliderFill(slider);
  clearPresetActive();
  updateStatus();
}

function ensureResume() {
  if (engine && engine.ctx.state !== 'running') engine.resume();
}

function updateSliderFill(slider) {
  const v = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  // 激活卡片的滑块未填充部分使用浅蓝，强化"正在播放"反馈
  const card = slider.closest('.sound-card');
  const isActive = card && card.classList.contains('active');
  const unfilled = isActive ? 'rgba(0, 122, 255, 0.15)' : '#e5e5ea';
  slider.style.background = `linear-gradient(to right, #007aff ${v}%, ${unfilled} ${v}%)`;
}

function bindControls() {
  const master = $('#masterVol');
  master.addEventListener('input', () => {
    engine.setMaster(master.value / 100);
    updateSliderFill(master);
  });
  updateSliderFill(master);

  $$('.timer-btn').forEach((b) => {
    b.addEventListener('click', () => setTimer(parseInt(b.dataset.min, 10)));
  });

  $('#stopAll').addEventListener('click', () => {
    engine.stopAll();
    $$('.sound-card').forEach((c) => c.classList.remove('active'));
    setTimer(0);
    clearPresetActive();
    updateStatus();
    toast('已停止所有声音');
  });

  $('#savePreset').addEventListener('click', savePreset);
}

function setTimer(minutes) {
  $$('.timer-btn').forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.min, 10) === minutes);
  });
  clearInterval(timerInterval);
  const display = $('#timerDisplay');
  if (minutes <= 0) {
    timerEnd = null;
    display.textContent = '未启用';
    display.classList.remove('running');
    return;
  }
  timerEnd = Date.now() + minutes * 60000;
  display.classList.add('running');
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    if (Date.now() >= timerEnd) {
      engine.stopAll();
      $$('.sound-card').forEach((c) => c.classList.remove('active'));
      clearInterval(timerInterval);
      timerEnd = null;
      display.textContent = '已停止';
      display.classList.remove('running');
      updateStatus();
      toast('定时结束，已停止播放');
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  if (!timerEnd) return;
  const remain = Math.max(0, timerEnd - Date.now());
  const m = Math.floor(remain / 60000);
  const s = Math.floor((remain % 60000) / 1000);
  $('#timerDisplay').textContent = `${m}:${String(s).padStart(2, '0')} 后停止`;
}

function renderPresets() {
  const list = $('#presetList');
  const presets = loadPresets();
  list.innerHTML = presets.map((p, i) => `
    <button class="preset-chip" data-idx="${i}" type="button" title="左键应用 · 右键重命名/删除">
      <span class="preset-name">${escapeHtml(p.name)}</span>
    </button>
  `).join('');
  $$('.preset-chip').forEach((b) => {
    const idx = parseInt(b.dataset.idx, 10);
    b.addEventListener('click', () => {
      if (b.classList.contains('editing')) return;
      applyPreset(idx);
    });
    // 右键打开管理菜单（重命名 / 删除）—— UX 报告 #10 未完成项
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showPresetMenu(b, idx);
    });
  });
}

// 预设右键菜单：重命名 + 删除
function showPresetMenu(chip, idx) {
  hidePresetMenu();
  const menu = document.createElement('div');
  menu.className = 'preset-menu';
  menu.innerHTML =
    '<button class="preset-menu-item" data-action="rename" type="button">重命名</button>' +
    '<button class="preset-menu-item danger" data-action="delete" type="button">删除</button>';
  document.body.appendChild(menu);
  const rect = chip.getBoundingClientRect();
  // 防止菜单超出右边界
  const menuW = 120;
  menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - menuW - 8)) + 'px';
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.querySelectorAll('.preset-menu-item').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = b.dataset.action;
      hidePresetMenu();
      if (action === 'rename') startRenamePreset(idx);
      else if (action === 'delete') deletePreset(idx);
    });
  });
  // 点击其他区域关闭菜单（下一帧生效，避免立即触发）
  setTimeout(() => document.addEventListener('click', hidePresetMenu, { once: true }), 0);
  // Esc 关闭
  setTimeout(() => document.addEventListener('keydown', hidePresetMenuOnEsc, { once: true }), 0);
}

function hidePresetMenuOnEsc(e) {
  if (e.key === 'Escape') hidePresetMenu();
}

function hidePresetMenu() {
  const m = document.querySelector('.preset-menu');
  if (m) m.remove();
}

function startRenamePreset(idx) {
  const presets = loadPresets();
  const p = presets[idx];
  if (!p) return;
  const chip = document.querySelector('.preset-chip[data-idx="' + idx + '"]');
  if (!chip) return;
  chip.classList.add('editing');
  chip.innerHTML = '<input class="preset-rename-input" type="text" maxlength="16" aria-label="预设名称">';
  const input = chip.querySelector('input');
  input.value = p.name;
  input.focus();
  input.select();
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (name && name !== p.name) {
      p.name = name;
      savePresets(presets);
      toast('已重命名：' + name);
    }
    renderPresets();
  };
  const cancel = () => {
    if (done) return;
    done = true;
    renderPresets();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
}

function deletePreset(idx) {
  const presets = loadPresets();
  const p = presets[idx];
  if (!p) return;
  presets.splice(idx, 1);
  savePresets(presets);
  if (activePresetIdx === idx) activePresetIdx = -1;
  else if (activePresetIdx > idx) activePresetIdx -= 1;
  renderPresets();
  toast('已删除预设：' + p.name);
}

function loadPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem('ambient-presets') || '[]');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (e) {}
  return DEFAULT_PRESETS.slice();
}

function savePresets(arr) {
  localStorage.setItem('ambient-presets', JSON.stringify(arr));
}

function applyPreset(idx) {
  const presets = loadPresets();
  const p = presets[idx];
  if (!p) return;
  ensureResume();
  engine.stopAll();
  $$('.sound-card').forEach((c) => c.classList.remove('active'));
  for (const [id, vol] of Object.entries(p.sounds)) {
    engine.setVolume(id, vol);
    engine.play(id);
    const card = document.querySelector(`.sound-card[data-id="${id}"]`);
    if (card) {
      card.classList.add('active');
      const slider = card.querySelector('input[type=range]');
      slider.value = Math.round(vol * 100);
      updateSliderFill(slider);
    }
  }
  activePresetIdx = idx;
  $$('.preset-chip').forEach((b, i) => b.classList.toggle('active', i === idx));
  updateStatus();
  toast('已切换：' + p.name);
}

function clearPresetActive() {
  activePresetIdx = -1;
  $$('.preset-chip').forEach((b) => b.classList.remove('active'));
}

function savePreset() {
  const active = engine.activeIds();
  if (active.length === 0) { toast('请先播放至少一个声音'); return; }
  const presets = loadPresets();
  const customCount = presets.filter((p) => /^自定义/.test(p.name)).length;
  const sounds = {};
  active.forEach((id) => { sounds[id] = +(engine.volumes[id] ?? 0.6).toFixed(2); });
  const preset = { name: `自定义 ${customCount + 1}`, sounds };
  presets.push(preset);
  savePresets(presets);
  renderPresets();
  toast('已保存预设：' + preset.name);
}

function updateStatus() {
  const n = engine ? engine.activeCount() : 0;
  const st = $('#status');
  if (n === 0) {
    st.textContent = '空闲';
    st.classList.remove('playing');
  } else {
    // 显示具体声音名，让用户知道正在播放什么（修复原死代码：names 计算后未使用）
    const names = engine.activeIds().map((id) => {
      const s = SOUNDS.find((x) => x.id === id);
      return s ? s.name : id;
    }).join('、');
    st.textContent = `播放中 · ${names}`;
    st.classList.add('playing');
  }
}

/* ---------- 频谱可视化 ---------- */
function initSpectrum() {
  spectrumCanvas = $('#spectrum');
  spectrumCtx = spectrumCanvas.getContext('2d');
  resizeSpectrum();
  window.addEventListener('resize', resizeSpectrum);
  drawSpectrum();
}

function resizeSpectrum() {
  spectrumDpr = window.devicePixelRatio || 1;
  const w = spectrumCanvas.clientWidth;
  const h = spectrumCanvas.clientHeight;
  spectrumCanvas.width = Math.max(1, Math.floor(w * spectrumDpr));
  spectrumCanvas.height = Math.max(1, Math.floor(h * spectrumDpr));
  spectrumCtx.setTransform(spectrumDpr, 0, 0, spectrumDpr, 0, 0);
}

function drawSpectrum() {
  requestAnimationFrame(drawSpectrum);
  const ctx = spectrumCtx;
  const w = spectrumCanvas.clientWidth;
  const h = spectrumCanvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  if (!engine) return;

  const data = engine.getFrequencyData();
  const bars = 24;
  const usable = Math.floor(data.length * 0.7); // 只取低中频段（更有动感）
  const step = Math.max(1, Math.floor(usable / bars));
  const gap = 4;
  const barW = (w - gap * (bars - 1)) / bars;
  const active = engine.activeCount() > 0;
  const demo = engine._demoMode === true || window.__demoMode === true;
  const radius = Math.min(barW / 2, 2.2); // 统一圆角半径，避免锯齿

  for (let i = 0; i < bars; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
    let v = (sum / step) / 255;
    if (!active && demo) {
      // 多频段叠加，模拟更真实的频谱律动
      const t = Date.now() * 0.0015;
      const base = 0.18
        + 0.38 * Math.abs(Math.sin(i * 0.35 + t))
        + 0.20 * Math.abs(Math.sin(i * 0.18 + t * 0.7 + 0.4))
        + 0.12 * Math.abs(Math.sin(i * 0.62 + t * 1.3));
      // 低频更高，高频衰减（更像真实音乐频谱）
      const positional = 1 - Math.pow(i / bars, 1.4) * 0.55;
      v = Math.min(1, base * positional);
    } else if (!active) {
      v = 0;
    }
    // 提高最小高度，避免极小值导致圆角失真
    const bh = Math.max(3, v * h);
    const x = i * (barW + gap);
    const y = h - bh;
    // 三段渐变：深蓝 → 青蓝 → 暖紫，增加层次感与动态感
    const grad = ctx.createLinearGradient(0, h, 0, y);
    grad.addColorStop(0, 'rgba(0,122,255,0.92)');
    grad.addColorStop(0.5, 'rgba(90,200,250,0.95)');
    grad.addColorStop(1, 'rgba(175,160,255,0.98)');
    ctx.fillStyle = (active || demo) ? grad : '#ececf0';
    // 只圆角顶部，底部保持平直，避免极小高度时四角圆化失真
    roundRectTop(ctx, x, y, barW, bh, radius);
    ctx.fill();
  }
}

// 只圆角顶部的圆角矩形 —— 频谱条底部贴底，顶部圆润，视觉更精致一致
function roundRectTop(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// 保留通用 roundRect（其他场景备用）
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- 工具 ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer = null;
function toast(msg) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

  // 标准模式：如果 DOM 已加载完成直接执行，否则等待 DOMContentLoaded
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 键盘快捷键：Space 切换全部播放/停止，Esc 隐藏窗口到托盘
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (engine && engine.activeCount() > 0) {
        engine.stopAll();
        document.querySelectorAll('.sound-card').forEach((c) => c.classList.remove('active'));
        clearPresetActive();
        updateStatus();
        toast('已停止所有声音');
      } else if (engine) {
        ensureResume();
        ['rain', 'brown'].forEach((id) => {
          engine.setVolume(id, 0.5);
          engine.play(id);
          const card = document.querySelector('.sound-card[data-id="' + id + '"]');
          if (card) {
            card.classList.add('active');
            const sl = card.querySelector('input[type=range]');
            if (sl) { sl.value = 50; updateSliderFill(sl); }
          }
        });
        updateStatus();
        toast('快速开始：雨声 + 棕噪音');
      }
    } else if (e.code === 'Escape') {
      if (window.ambient && typeof window.ambient.hideWindow === 'function') {
        window.ambient.hideWindow();
      }
    }
  });
})();
