// overlay.js — 覆盖层渲染与交互
// 使用 window.ruler 暴露的 IPC 接口，复用 RulerCore 纯函数（与测试同源）

// 几何/颜色/格式化函数来自 ../core/ruler-core.js（UMD 挂在 window.RulerCore）
const { distance, angle, rgbToHex, rgbToHsl, pixelAt, formatMeasure } = window.RulerCore;

const bgCanvas = document.getElementById('bg');
const drawCanvas = document.getElementById('draw');
const bgCtx = bgCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');
const coordEl = document.getElementById('coord');
const colorInfoEl = document.getElementById('colorInfo');
const colorSwatchEl = document.getElementById('colorSwatch');

let mode = 'rect'; // rect | line | pick
let snapshotImg = null;     // Image 对象（含桌面截图）
let imageData = null;       // 像素数据用于取色
let scaleFactor = 1;
let cursor = { x: 0, y: 0 };
let dragging = false;
let startPt = null;
let endPt = null;
let lastMeasure = null;     // 当前测量结果

// 接收主进程发来的截图
window.ruler.onSnapshot((data) => {
  scaleFactor = data.scaleFactor || 1;
  const w = window.innerWidth, h = window.innerHeight;
  bgCanvas.width = w; bgCanvas.height = h;
  drawCanvas.width = w; drawCanvas.height = h;
  // 截图失败时 dataURL 为 null：保持透明背景，imageData 不初始化（取色会返回 null）
  if (!data.dataURL) {
    snapshotImg = null;
    imageData = null;
    return;
  }
  const img = new Image();
  img.onload = () => {
    snapshotImg = img;
    bgCtx.drawImage(img, 0, 0, w, h);
    imageData = bgCtx.getImageData(0, 0, w, h);
  };
  img.src = data.dataURL;
});

// ============ 模式切换 ============
document.querySelectorAll('.seg[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

function setMode(m) {
  mode = m;
  document.querySelectorAll('.seg[data-mode]').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === m);
  });
  document.body.style.cursor = (m === 'pick') ? 'cell' : 'crosshair';
  redraw();
}

// ============ 取色 ============
// colorAt 复用 RulerCore.pixelAt，但只返回 r/g/b（取色场景不需要 alpha）
function colorAt(x, y) {
  if (!imageData) return null;
  const p = pixelAt(imageData, x, y);
  return { r: p.r, g: p.g, b: p.b };
}

// ============ 鼠标交互 ============
window.addEventListener('mousemove', (e) => {
  cursor = { x: e.clientX, y: e.clientY };
  coordEl.textContent = `x: ${e.clientX}, y: ${e.clientY}`;
  // 取色实时显示
  const c = colorAt(e.clientX, e.clientY);
  if (c) {
    const hex = rgbToHex(c.r, c.g, c.b);
    colorInfoEl.textContent = hex;
    colorSwatchEl.style.background = hex;
  }
  if (dragging && startPt) {
    endPt = { x: e.clientX, y: e.clientY };
    redraw();
  } else {
    redraw();
  }
});

window.addEventListener('mousedown', (e) => {
  // 忽略工具栏点击
  if (e.target.closest('#toolbar') || e.target.closest('#hint')) return;
  if (mode === 'pick') {
    // 取色模式：单击复制颜色
    const c = colorAt(e.clientX, e.clientY);
    if (c) {
      const hex = rgbToHex(c.r, c.g, c.b);
      window.ruler.copyText(hex);
      flashHint(`已复制 ${hex}`);
    }
    return;
  }
  dragging = true;
  startPt = { x: e.clientX, y: e.clientY };
  endPt = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  if (startPt && endPt) {
    computeMeasure();
  }
});

// ============ 绘制 ============
function redraw() {
  const w = drawCanvas.width, h = drawCanvas.height;
  drawCtx.clearRect(0, 0, w, h);
  // 十字线（取色模式不画十字）
  if (mode !== 'pick') {
    drawCrosshair(cursor.x, cursor.y);
  } else {
    drawMagnifier(cursor.x, cursor.y);
  }
  // 拖拽测量
  if (startPt && endPt) {
    drawMeasure(startPt, endPt);
  } else {
    // 空闲态视觉提示：让用户明确感知当前处于测量模式
    drawIdleHint();
  }
}

// 空闲态居中提示（脉冲呼吸效果，不挡视线）
let idlePhase = 0;
let idleAnimId = null;
function drawIdleHint() {
  if (dragging || (startPt && endPt)) {
    if (idleAnimId) { cancelAnimationFrame(idleAnimId); idleAnimId = null; }
    return;
  }
  const w = drawCanvas.width, h = drawCanvas.height;
  const cx = w / 2, cy = h / 2;
  idlePhase = (idlePhase + 0.02) % (Math.PI * 2);
  const alpha = 0.45 + Math.sin(idlePhase) * 0.18; // 0.27 ~ 0.63
  drawCtx.save();
  drawCtx.font = '600 18px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  drawCtx.textAlign = 'center';
  drawCtx.textBaseline = 'middle';
  // 半透明黑底圆角胶囊
  const hint = '拖拽鼠标开始测量';
  const sub = mode === 'rect' ? '矩形模式 · R/L/P 切换' : (mode === 'line' ? '直线模式 · R/L/P 切换' : '取色模式 · 单击复制 HEX');
  const m1 = drawCtx.measureText(hint);
  const m2 = drawCtx.measureText(sub);
  const padX = 18, padY = 10;
  const boxW = Math.max(m1.width, m2.width) + padX * 2;
  const boxH = 56;
  const bx = cx - boxW / 2, by = cy - boxH / 2;
  drawCtx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.78})`;
  drawCtx.beginPath();
  drawCtx.roundRect(bx, by, boxW, boxH, 12);
  drawCtx.fill();
  // 主提示
  drawCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  drawCtx.fillText(hint, cx, cy - 8);
  // 副提示（更小更淡）
  drawCtx.font = '12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  drawCtx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.72})`;
  drawCtx.fillText(sub, cx, cy + 12);
  drawCtx.restore();
  // 持续动画
  idleAnimId = requestAnimationFrame(drawIdleHint);
}

function drawCrosshair(x, y) {
  drawCtx.save();
  drawCtx.strokeStyle = 'rgba(0, 122, 255, 0.65)';
  drawCtx.lineWidth = 1;
  drawCtx.setLineDash([4, 4]);
  drawCtx.beginPath();
  drawCtx.moveTo(0, y); drawCtx.lineTo(x - 4, y);
  drawCtx.moveTo(x + 4, y); drawCtx.lineTo(drawCanvas.width, y);
  drawCtx.moveTo(x, 0); drawCtx.lineTo(x, y - 4);
  drawCtx.moveTo(x, y + 4); drawCtx.lineTo(x, drawCanvas.height);
  drawCtx.stroke();
  drawCtx.restore();
}

function drawMagnifier(x, y) {
  const size = 9; // 取 9x9 区域
  const half = Math.floor(size / 2);
  const box = 100;
  const px = x + 16, py = y + 16;
  drawCtx.save();
  // 边框
  drawCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  drawCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  drawCtx.lineWidth = 1;
  drawCtx.beginPath();
  drawCtx.roundRect(px, py, box, box, 8);
  drawCtx.fill();
  drawCtx.stroke();
  // 放大像素
  if (imageData) {
    const ps = box / size;
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const c = colorAt(x + dx, y + dy);
        if (!c) continue;
        drawCtx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
        drawCtx.fillRect(px + (dx + half) * ps, py + (dy + half) * ps, ps, ps);
      }
    }
    // 中心十字
    drawCtx.strokeStyle = '#007aff';
    drawCtx.lineWidth = 1.5;
    drawCtx.beginPath();
    drawCtx.moveTo(px + box / 2, py + box / 2 - 6);
    drawCtx.lineTo(px + box / 2, py + box / 2 + 6);
    drawCtx.moveTo(px + box / 2 - 6, py + box / 2);
    drawCtx.lineTo(px + box / 2 + 6, py + box / 2);
    drawCtx.stroke();
  }
  drawCtx.restore();
}

function drawMeasure(a, b) {
  drawCtx.save();
  drawCtx.strokeStyle = '#007aff';
  drawCtx.fillStyle = 'rgba(0, 122, 255, 0.10)';
  drawCtx.lineWidth = 1.5;
  if (mode === 'rect') {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    drawCtx.fillRect(x, y, w, h);
    drawCtx.strokeRect(x, y, w, h);
    // 标尺刻度
    drawRuler(x, y, w, h);
    // 尺寸标签
    drawLabel(`${Math.round(w)} × ${Math.round(h)} px`, x + w / 2, y + h + 14);
    drawLabel(`宽 ${Math.round(w)}`, x + w / 2, y - 10);
    drawLabel(`高 ${Math.round(h)}`, x + w + 24, y + h / 2, true);
  } else if (mode === 'line') {
    drawCtx.beginPath();
    drawCtx.moveTo(a.x, a.y);
    drawCtx.lineTo(b.x, b.y);
    drawCtx.stroke();
    // 端点
    drawCtx.fillStyle = '#007aff';
    drawCtx.beginPath(); drawCtx.arc(a.x, a.y, 3, 0, Math.PI * 2); drawCtx.fill();
    drawCtx.beginPath(); drawCtx.arc(b.x, b.y, 3, 0, Math.PI * 2); drawCtx.fill();
    // 距离/角度标签（复用 RulerCore.distance / angle，与测试同源）
    const d = distance(a, b);
    const ang = angle(a, b);
    drawLabel(`${Math.round(d)} px · ${Math.round(ang)}°`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 14);
  }
  drawCtx.restore();
}

function drawRuler(x, y, w, h) {
  drawCtx.save();
  drawCtx.strokeStyle = 'rgba(0, 122, 255, 0.45)';
  drawCtx.fillStyle = 'rgba(0, 122, 255, 0.7)';
  drawCtx.lineWidth = 1;
  drawCtx.font = '10px -apple-system, "PingFang SC"';
  // 顶部刻度
  for (let i = 0; i <= w; i += 10) {
    const tall = i % 100 === 0;
    drawCtx.beginPath();
    drawCtx.moveTo(x + i, y);
    drawCtx.lineTo(x + i, y + (tall ? 6 : 3));
    drawCtx.stroke();
    if (tall && i > 0 && i < w) drawCtx.fillText(`${i}`, x + i + 2, y + 14);
  }
  // 左侧刻度
  for (let i = 0; i <= h; i += 10) {
    const tall = i % 100 === 0;
    drawCtx.beginPath();
    drawCtx.moveTo(x, y + i);
    drawCtx.lineTo(x + (tall ? 6 : 3), y + i);
    drawCtx.stroke();
    if (tall && i > 0 && i < h) drawCtx.fillText(`${i}`, x + 8, y + i + 10);
  }
  drawCtx.restore();
}

function drawLabel(text, x, y, vertical) {
  drawCtx.save();
  drawCtx.font = '12px -apple-system, "PingFang SC"';
  const padX = 6, padY = 4;
  const m = drawCtx.measureText(text);
  const tw = m.width + padX * 2, th = 18;
  let lx = x - tw / 2, ly = y - th / 2;
  if (vertical) { lx = x; ly = y - th / 2; }
  drawCtx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  drawCtx.beginPath();
  drawCtx.roundRect(lx, ly, tw, th, 6);
  drawCtx.fill();
  drawCtx.fillStyle = '#fff';
  drawCtx.textBaseline = 'middle';
  drawCtx.fillText(text, lx + padX, ly + th / 2 + 0.5);
  drawCtx.restore();
}

function computeMeasure() {
  if (!startPt || !endPt) return null;
  // 复用 RulerCore.formatMeasure，保证运行时与测试同源
  const result = formatMeasure(mode, startPt, endPt);
  if (!result) return null;
  result.start = startPt;
  result.end = endPt;
  result.ts = Date.now();
  lastMeasure = result;
  return result;
}

// ============ 工具按钮 ============
document.getElementById('closeBtn').addEventListener('click', () => window.ruler.exitOverlay());
document.getElementById('copyBtn').addEventListener('click', () => {
  const m = lastMeasure || computeMeasure();
  if (!m) { flashHint('请先拖拽测量'); return; }
  window.ruler.copyText(m.detail);
  flashHint('已复制 ' + m.detail);
});
document.getElementById('saveBtn').addEventListener('click', () => {
  const m = lastMeasure || computeMeasure();
  if (!m) { flashHint('请先拖拽测量'); return; }
  window.ruler.saveHistory(m);
  flashHint('已保存到历史');
});

// ============ 键盘 ============
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.ruler.exitOverlay();
  else if (e.key.toLowerCase() === 'r') setMode('rect');
  else if (e.key.toLowerCase() === 'l') setMode('line');
  else if (e.key.toLowerCase() === 'p') setMode('pick');
  else if (e.key.toLowerCase() === 'c') document.getElementById('copyBtn').click();
  else if (e.key.toLowerCase() === 's') document.getElementById('saveBtn').click();
});

// ============ 临时提示 ============
let flashTimer = null;
function flashHint(text) {
  let el = document.getElementById('flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flash';
    el.style.cssText = `
      position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
      z-index: 100; padding: 8px 14px; background: rgba(0,0,0,0.82);
      color: #fff; font-size: 12px; border-radius: 8px; pointer-events: none;
      transition: opacity 0.3s; font-family: -apple-system, "PingFang SC";
    `;
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.style.opacity = '0'; }, 1500);
}

// Canvas roundRect polyfill（老版本 Electron 兼容）
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}
