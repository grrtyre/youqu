'use strict';
// 水印管家 - 渲染层逻辑（优化版）
// 苹果白风格控制面板交互

let config = null;
let templates = [];
let systemVars = {};

const $ = (id) => document.getElementById(id);

const enableSwitch = $('enableSwitch');
const switchLabel = $('switchLabel');
const contentInput = $('contentInput');
const templateGrid = $('templateGrid');
const fontSize = $('fontSize');
const fontSizeVal = $('fontSizeVal');
const color = $('color');
const opacity = $('opacity');
const opacityVal = $('opacityVal');
const rotation = $('rotation');
const rotationVal = $('rotationVal');
const gapX = $('gapX');
const gapXVal = $('gapXVal');
const gapY = $('gapY');
const gapYVal = $('gapYVal');
const autoStart = $('autoStart');
const minimizeToTray = $('minimizeToTray');
const scheduleEnabled = $('scheduleEnabled');
const scheduleBody = $('scheduleBody');
const scheduleStart = $('scheduleStart');
const scheduleEnd = $('scheduleEnd');
const dayChips = $('dayChips');
const statusDot = $('statusDot');
const statusText = $('statusText');
const previewCanvas = $('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');

// 星期 chips：周一~周日，值为 0=周日 .. 6=周六
const DAY_DEFS = [
  { day: 1, label: '一' },
  { day: 2, label: '二' },
  { day: 3, label: '三' },
  { day: 4, label: '四' },
  { day: 5, label: '五' },
  { day: 6, label: '六' },
  { day: 0, label: '日' }
];

// ==================== 初始化 ====================

async function init() {
  config = await window.waterAPI.getConfig();
  templates = await window.waterAPI.getTemplates();
  systemVars = await window.waterAPI.getSystemVars();

  applyConfigToUI();
  renderTemplates();
  renderDayChips();

  bindEvents();
  bindVarTags();
  bindColorPresets();

  // 确保 DOM 完全布局后再绘制预览
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      drawPreview();
      // 预览绘制完成后通知主进程渲染层已就绪（供截图脚本使用）
      try { window.waterAPI.ready(); } catch (_) {}
    });
  });

  window.waterAPI.onConfigUpdated((updatedConfig) => {
    config = updatedConfig;
    applyConfigToUI();
    drawPreview();
  });
}

function applyConfigToUI() {
  if (!config) return;
  enableSwitch.checked = config.enabled;
  updateSwitchLabel();
  contentInput.value = config.content;
  fontSize.value = config.fontSize;
  fontSizeVal.textContent = config.fontSize + 'px';
  color.value = config.color;
  updateColorPresetActive();
  opacity.value = Math.round(config.opacity * 100);
  opacityVal.textContent = Math.round(config.opacity * 100) + '%';
  rotation.value = config.rotation;
  rotationVal.textContent = config.rotation + '°';
  gapX.value = config.gapX;
  gapXVal.textContent = config.gapX + 'px';
  gapY.value = config.gapY;
  gapYVal.textContent = config.gapY + 'px';
  autoStart.checked = config.autoStart;
  minimizeToTray.checked = config.minimizeToTray;
  // 定时水印
  scheduleEnabled.checked = !!config.scheduleEnabled;
  scheduleStart.value = config.scheduleStart || '09:00';
  scheduleEnd.value = config.scheduleEnd || '18:00';
  updateScheduleBodyState();
  updateDayChipsActive();
  updateStatus();
}

function updateScheduleBodyState() {
  if (scheduleEnabled.checked) {
    scheduleBody.classList.remove('disabled');
  } else {
    scheduleBody.classList.add('disabled');
  }
}

function renderDayChips() {
  dayChips.innerHTML = '';
  for (const d of DAY_DEFS) {
    const chip = document.createElement('span');
    chip.className = 'day-chip';
    chip.setAttribute('data-day', String(d.day));
    chip.textContent = d.label;
    chip.addEventListener('click', () => {
      const day = parseInt(chip.getAttribute('data-day'), 10);
      const days = Array.isArray(config.scheduleDays) ? config.scheduleDays.slice() : [];
      const idx = days.indexOf(day);
      if (idx === -1) {
        days.push(day);
        days.sort((a, b) => a - b);
      } else {
        days.splice(idx, 1);
      }
      if (days.length === 0) {
        // 至少保留一天，避免空集导致水印永远不显示
        days.push(day);
      }
      config.scheduleDays = days;
      updateDayChipsActive();
      debouncedSave();
    });
    dayChips.appendChild(chip);
  }
  updateDayChipsActive();
}

function updateDayChipsActive() {
  const days = Array.isArray(config.scheduleDays) ? config.scheduleDays : [];
  dayChips.querySelectorAll('.day-chip').forEach(chip => {
    const d = parseInt(chip.getAttribute('data-day'), 10);
    if (days.indexOf(d) !== -1) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

function updateColorPresetActive() {
  document.querySelectorAll('.color-preset').forEach(p => {
    if (p.getAttribute('data-color').toLowerCase() === config.color.toLowerCase()) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}

function renderTemplates() {
  templateGrid.innerHTML = '';
  for (const tpl of templates) {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = '<div class="template-name">' + tpl.name + '</div>' +
      '<div class="template-preview">' + tpl.content + '</div>';
    card.addEventListener('click', async () => {
      const result = await window.waterAPI.applyTemplate(tpl.id);
      if (result.success) {
        config = result.config;
        applyConfigToUI();
        drawPreview();
      }
    });
    templateGrid.appendChild(card);
  }
}

function bindEvents() {
  enableSwitch.addEventListener('change', async () => {
    config.enabled = enableSwitch.checked;
    updateSwitchLabel();
    updateStatus();
    await window.waterAPI.toggleWatermark(config.enabled);
    collectAndSave();
  });

  contentInput.addEventListener('input', () => {
    config.content = contentInput.value;
    drawPreview();
    debouncedSave();
  });

  fontSize.addEventListener('input', () => {
    config.fontSize = parseInt(fontSize.value, 10);
    fontSizeVal.textContent = config.fontSize + 'px';
    drawPreview();
    debouncedSave();
  });
  opacity.addEventListener('input', () => {
    config.opacity = parseInt(opacity.value, 10) / 100;
    opacityVal.textContent = Math.round(config.opacity * 100) + '%';
    drawPreview();
    debouncedSave();
  });
  rotation.addEventListener('input', () => {
    config.rotation = parseInt(rotation.value, 10);
    rotationVal.textContent = config.rotation + '°';
    drawPreview();
    debouncedSave();
  });
  gapX.addEventListener('input', () => {
    config.gapX = parseInt(gapX.value, 10);
    gapXVal.textContent = config.gapX + 'px';
    drawPreview();
    debouncedSave();
  });
  gapY.addEventListener('input', () => {
    config.gapY = parseInt(gapY.value, 10);
    gapYVal.textContent = config.gapY + 'px';
    drawPreview();
    debouncedSave();
  });

  color.addEventListener('input', () => {
    config.color = color.value;
    updateColorPresetActive();
    drawPreview();
    debouncedSave();
  });

  autoStart.addEventListener('change', () => {
    config.autoStart = autoStart.checked;
    collectAndSave();
  });
  minimizeToTray.addEventListener('change', () => {
    config.minimizeToTray = minimizeToTray.checked;
    collectAndSave();
  });

  // 定时水印
  scheduleEnabled.addEventListener('change', () => {
    config.scheduleEnabled = scheduleEnabled.checked;
    updateScheduleBodyState();
    updateStatus();
    collectAndSave();
  });
  scheduleStart.addEventListener('change', () => {
    config.scheduleStart = scheduleStart.value || '09:00';
    collectAndSave();
  });
  scheduleEnd.addEventListener('change', () => {
    config.scheduleEnd = scheduleEnd.value || '18:00';
    collectAndSave();
  });
}

function bindVarTags() {
  document.querySelectorAll('.var-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const varText = tag.getAttribute('data-var');
      const start = contentInput.selectionStart;
      const end = contentInput.selectionEnd;
      const val = contentInput.value;
      contentInput.value = val.substring(0, start) + varText + val.substring(end);
      contentInput.focus();
      contentInput.selectionStart = contentInput.selectionEnd = start + varText.length;
      config.content = contentInput.value;
      drawPreview();
      debouncedSave();
    });
  });
}

function bindColorPresets() {
  document.querySelectorAll('.color-preset').forEach(preset => {
    preset.addEventListener('click', () => {
      const c = preset.getAttribute('data-color');
      color.value = c;
      config.color = c;
      updateColorPresetActive();
      drawPreview();
      debouncedSave();
    });
  });
}

function updateSwitchLabel() {
  switchLabel.textContent = enableSwitch.checked ? '水印已开启' : '水印关闭中';
}

// 判断当前时刻是否在定时区间内（与 core 中 isInSchedule 逻辑一致）
function isNowInSchedule() {
  if (!config || !config.scheduleEnabled) return true;
  const days = Array.isArray(config.scheduleDays) ? config.scheduleDays : [];
  const now = new Date();
  if (days.indexOf(now.getDay()) === -1) return false;
  const parseHM = (hm, fb) => {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(hm || '').trim());
    if (!m) return fb;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };
  const start = parseHM(config.scheduleStart, 9 * 60);
  const end = parseHM(config.scheduleEnd, 18 * 60);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start <= end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

function updateStatus() {
  if (!config.enabled) {
    statusDot.classList.remove('active');
    statusText.textContent = '水印未开启';
    return;
  }
  if (config.scheduleEnabled) {
    if (isNowInSchedule()) {
      statusDot.classList.add('active');
      statusText.textContent = '水印运行中（定时）';
    } else {
      statusDot.classList.remove('active');
      statusText.textContent = '定时未到·已隐藏';
    }
  } else {
    statusDot.classList.add('active');
    statusText.textContent = '水印运行中';
  }
}

let saveTimer = null;
function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { collectAndSave(); }, 300);
}

async function collectAndSave() {
  await window.waterAPI.saveConfig(config);
}

// ==================== 预览渲染 ====================

function resolveVariables(content) {
  if (!content) return '';
  let result = content;
  const replacements = {
    '{USERNAME}': systemVars.username || '用户',
    '{IP}': systemVars.ip || '127.0.0.1',
    '{TIME}': formatTimeNow(),
    '{DATE}': systemVars.date || '2026-07-12',
    '{MACHINE}': systemVars.machine || 'PC'
  };
  for (const [key, val] of Object.entries(replacements)) {
    result = result.split(key).join(val);
  }
  return result;
}

function formatTimeNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = config ? (config.timeFormat || 'YYYY-MM-DD HH:mm') : 'YYYY-MM-DD HH:mm';
  let result = fmt;
  const map = {
    'YYYY': now.getFullYear(),
    'MM': pad(now.getMonth() + 1),
    'DD': pad(now.getDate()),
    'HH': pad(now.getHours()),
    'mm': pad(now.getMinutes()),
    'ss': pad(now.getSeconds())
  };
  for (const [key, val] of Object.entries(map)) {
    result = result.split(key).join(val);
  }
  return result;
}

function drawPreview() {
  if (!config) return;
  const box = $('previewBox');
  if (!box) return;
  const w = box.clientWidth;
  const h = box.clientHeight;
  if (w === 0 || h === 0) {
    // 尺寸还没准备好，下一帧重试
    requestAnimationFrame(drawPreview);
    return;
  }
  // 使用 devicePixelRatio 提升预览清晰度
  const dpr = window.devicePixelRatio || 1;
  previewCanvas.width = w * dpr;
  previewCanvas.height = h * dpr;
  previewCanvas.style.width = w + 'px';
  previewCanvas.style.height = h + 'px';
  previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  previewCtx.clearRect(0, 0, w, h);

  // 模拟真实桌面背景（简洁渐变 + 单一窗口）
  const grad = previewCtx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#eef2f7');
  grad.addColorStop(1, '#dbe4f0');
  previewCtx.fillStyle = grad;
  previewCtx.fillRect(0, 0, w, h);

  // 模拟桌面顶部菜单栏
  previewCtx.fillStyle = 'rgba(255,255,255,0.85)';
  previewCtx.fillRect(0, 0, w, 20);
  previewCtx.fillStyle = 'rgba(0,0,0,0.4)';
  previewCtx.font = '11px -apple-system, sans-serif';
  previewCtx.textAlign = 'left';
  previewCtx.textBaseline = 'middle';
  previewCtx.fillText('桌面', 10, 10);

  // 模拟主窗口（白色卡片 + 标题栏 + 内容行）
  const winX = w * 0.28, winY = 32, winW = w * 0.66, winH = h - 50;
  previewCtx.fillStyle = 'rgba(255,255,255,0.92)';
  previewCtx.fillRect(winX, winY, winW, winH);
  // 窗口标题栏
  previewCtx.fillStyle = 'rgba(0,0,0,0.04)';
  previewCtx.fillRect(winX, winY, winW, 18);
  // 窗口标题栏红绿黄按钮
  previewCtx.fillStyle = '#ff5f57';
  previewCtx.beginPath(); previewCtx.arc(winX + 9, winY + 9, 3.5, 0, Math.PI * 2); previewCtx.fill();
  previewCtx.fillStyle = '#ffbd2e';
  previewCtx.beginPath(); previewCtx.arc(winX + 20, winY + 9, 3.5, 0, Math.PI * 2); previewCtx.fill();
  previewCtx.fillStyle = '#28ca42';
  previewCtx.beginPath(); previewCtx.arc(winX + 31, winY + 9, 3.5, 0, Math.PI * 2); previewCtx.fill();
  // 窗口内容行（模拟文本行）
  previewCtx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 5; i++) {
    previewCtx.fillRect(winX + 12, winY + 28 + i * 16, winW * 0.65, 4);
  }
  // 模拟右侧数据区
  previewCtx.fillStyle = 'rgba(0,122,255,0.08)';
  previewCtx.fillRect(winX + winW * 0.55, winY + 28, winW * 0.4, winH * 0.35);
  previewCtx.fillStyle = 'rgba(52,199,89,0.08)';
  previewCtx.fillRect(winX + winW * 0.55, winY + 28 + winH * 0.4, winW * 0.4, winH * 0.2);

  const content = resolveVariables(config.content);
  if (!content) return;

  const fontSizePx = Math.max(9, config.fontSize * 0.55);
  previewCtx.font = '600 ' + fontSizePx + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  previewCtx.fillStyle = config.color;
  previewCtx.globalAlpha = Math.min(config.opacity * 3, 0.85);
  previewCtx.textAlign = 'center';
  previewCtx.textBaseline = 'middle';

  // 预览区比真实桌面小，间距按比例放大避免文字过密
  const gapXPreview = Math.max(120, config.gapX * 0.65);
  const gapYPreview = Math.max(80, config.gapY * 0.7);

  previewCtx.save();
  previewCtx.translate(w / 2, h / 2);
  previewCtx.rotate(config.rotation * Math.PI / 180);

  const diag = Math.sqrt(w * w + h * h);
  for (let y = -diag / 2; y < diag / 2; y += gapYPreview) {
    for (let x = -diag / 2; x < diag / 2; x += gapXPreview) {
      previewCtx.fillText(content, x, y);
    }
  }
  previewCtx.restore();
  previewCtx.globalAlpha = 1;
}

window.addEventListener('resize', () => { drawPreview(); });

// 启动
init();
