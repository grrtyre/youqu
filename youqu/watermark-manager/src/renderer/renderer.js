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
const statusDot = $('statusDot');
const statusText = $('statusText');
const previewCanvas = $('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');

// ==================== 初始化 ====================

async function init() {
  config = await window.waterAPI.getConfig();
  templates = await window.waterAPI.getTemplates();
  systemVars = await window.waterAPI.getSystemVars();

  applyConfigToUI();
  renderTemplates();

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
  updateStatus();
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

function updateStatus() {
  if (config.enabled) {
    statusDot.classList.add('active');
    statusText.textContent = '水印运行中';
  } else {
    statusDot.classList.remove('active');
    statusText.textContent = '水印未开启';
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
  previewCanvas.width = w;
  previewCanvas.height = h;

  previewCtx.clearRect(0, 0, w, h);

  // 模拟桌面背景
  const grad = previewCtx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#f0f4f8');
  grad.addColorStop(1, '#e8edf3');
  previewCtx.fillStyle = grad;
  previewCtx.fillRect(0, 0, w, h);

  // 模拟窗口内容（增加真实感）
  previewCtx.fillStyle = 'rgba(255,255,255,0.75)';
  previewCtx.fillRect(15, 15, w * 0.45, h - 30);
  previewCtx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 7; i++) {
    previewCtx.fillRect(25, 26 + i * 16, w * 0.35, 4);
  }
  // 模拟右侧图表
  previewCtx.fillStyle = 'rgba(0,122,255,0.12)';
  previewCtx.fillRect(w * 0.55, h * 0.35, w * 0.4, h * 0.55);
  previewCtx.fillStyle = 'rgba(52,199,89,0.1)';
  previewCtx.fillRect(w * 0.55, h * 0.15, w * 0.4, h * 0.15);

  const content = resolveVariables(config.content);
  if (!content) return;

  const fontSizePx = Math.max(9, config.fontSize * 0.6);
  previewCtx.font = '600 ' + fontSizePx + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  previewCtx.fillStyle = config.color;
  previewCtx.globalAlpha = Math.min(config.opacity * 3, 0.85);
  previewCtx.textAlign = 'center';
  previewCtx.textBaseline = 'middle';

  const gapXPreview = Math.max(100, config.gapX * 0.5);
  const gapYPreview = Math.max(60, config.gapY * 0.5);

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
