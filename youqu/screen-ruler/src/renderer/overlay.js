// 测量覆盖层核心逻辑
// renderer 中 contextIsolation=true 无法 require，使用内联纯函数副本
'use strict';

const distance = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
const angleOfLine = (a, b) => Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI;
function angleBetween(v, r1, r2) {
  const v1 = { x: r1.x - v.x, y: -(r1.y - v.y) };
  const v2 = { x: r2.x - v.x, y: -(r2.y - v.y) };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
  if (m1 === 0 || m2 === 0) return 0;
  let cos = dot / (m1 * m2);
  if (cos > 1) cos = 1; if (cos < -1) cos = -1;
  let deg = Math.acos(cos) * 180 / Math.PI;
  const cross = v1.x * v2.y - v1.y * v2.x;
  if (cross < 0) deg = 360 - deg;
  return deg;
}
function pxToPhysical(px, dpi = 96) {
  const inches = px / dpi;
  return { mm: inches * 25.4, cm: inches * 2.54, in: inches };
}

const bgCanvas = document.getElementById('bgCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const bgCtx = bgCanvas.getContext('2d');
const ctx = drawCanvas.getContext('2d');

const hudCoord = document.getElementById('hudCoord');
const hudResult = document.getElementById('hudResult');
const hudPhysical = document.getElementById('hudPhysical');
const hintEl = document.getElementById('hint');

let W = window.innerWidth;
let H = window.innerHeight;
let bgImage = null;
let tool = 'ruler';
let mouse = { x: 0, y: 0 };
let downPoint = null;       // 拖拽起点
let isDragging = false;
let points = [];            // 点击式工具累积的点
let freeStrokes = [];       // 标注笔迹：[[{x,y},...], ...]
let currentStroke = null;
let measurements = [];      // 已确认的测量结果（点击式工具产生的）

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  [bgCanvas, drawCanvas].forEach(c => {
    c.width = W; c.height = H;
  });
  redrawBg();
  redraw();
}
window.addEventListener('resize', resize);

// 接收主进程发来的截图
window.ruler.onScreenshot((b64) => {
  if (!b64) { hintEl.textContent = '未能获取屏幕截图'; return; }
  const img = new Image();
  img.onload = () => {
    bgImage = img;
    redrawBg();
  };
  img.src = 'data:image/png;base64,' + b64;
});

function redrawBg() {
  bgCtx.clearRect(0, 0, W, H);
  if (bgImage) {
    bgCtx.drawImage(bgImage, 0, 0, W, H);
  } else {
    bgCtx.fillStyle = 'rgba(255,255,255,0.6)';
    bgCtx.fillRect(0, 0, W, H);
  }
}

function redraw() {
  ctx.clearRect(0, 0, W, H);

  // 始终绘制十字线（除 magnifier 外）
  drawCrosshair();

  // 已确认的测量
  measurements.forEach(m => drawMeasurement(m, true));

  // 当前工具实时反馈
  switch (tool) {
    case 'ruler':
      drawRulerTicks();
      break;
    case 'rect':
      if (isDragging && downPoint) {
        const r = { x: Math.min(downPoint.x, mouse.x), y: Math.min(downPoint.y, mouse.y),
                    w: Math.abs(mouse.x - downPoint.x), h: Math.abs(mouse.y - downPoint.y) };
        drawRect(r, '#007aff');
      }
      break;
    case 'line':
      if (points.length === 1) {
        drawLine(points[0], mouse, '#007aff', true);
      }
      break;
    case 'angle':
      if (points.length === 1) {
        drawLine(points[0], mouse, 'rgba(0,122,255,0.5)', false);
      } else if (points.length === 2) {
        drawLine(points[0], points[1], 'rgba(0,122,255,0.5)', false);
        drawLine(points[0], mouse, 'rgba(0,122,255,0.5)', false);
        // 实时角度
        const deg = angleBetween(points[0], points[1], mouse);
        drawAngleArc(points[0], points[1], mouse, deg);
      }
      break;
    case 'free':
      // 笔迹由 redraw 直接绘制
      break;
  }

  // 自由标注笔迹
  freeStrokes.forEach(s => drawStroke(s, '#ff3b30'));
  if (currentStroke) drawStroke(currentStroke, '#ff3b30');

  // 放大镜
  if (tool === 'magnifier') drawMagnifier();
}

function drawCrosshair() {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 122, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, mouse.y); ctx.lineTo(W, mouse.y);
  ctx.moveTo(mouse.x, 0); ctx.lineTo(mouse.x, H);
  ctx.stroke();
  ctx.restore();
}

function drawRulerTicks() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.font = '11px ui-monospace, monospace';
  // 顶部
  for (let x = 0; x <= W; x += 10) {
    const major = x % 100 === 0;
    ctx.fillRect(x, 0, 1, major ? 12 : 6);
    if (major && x > 0) ctx.fillText(x, x + 3, 22);
  }
  // 左侧
  for (let y = 0; y <= H; y += 10) {
    const major = y % 100 === 0;
    ctx.fillRect(0, y, major ? 12 : 6, 1);
    if (major && y > 0) ctx.fillText(y, 14, y - 3);
  }
  ctx.restore();
}

function drawRect(r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(0, 122, 255, 0.1)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  // 角标
  ctx.fillStyle = color;
  ctx.font = 'bold 13px ui-monospace, monospace';
  const label = `${Math.round(r.w)} × ${Math.round(r.h)}`;
  drawLabel(label, r.x + r.w + 6, r.y + r.h + 6, color);
  ctx.restore();
}

function drawLine(a, b, color, showInfo) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  ctx.stroke();
  // 端点
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
  if (showInfo) {
    const len = distance(a, b);
    const ang = angleOfLine(a, b);
    drawLabel(`${Math.round(len)} px  ∠ ${ang.toFixed(1)}°`, b.x + 8, b.y - 8, color);
  }
  ctx.restore();
}

function drawAngleArc(v, r1, r2, deg) {
  ctx.save();
  ctx.strokeStyle = '#34c759';
  ctx.fillStyle = 'rgba(52, 199, 89, 0.12)';
  ctx.lineWidth = 2;
  const a1 = Math.atan2(-(r1.y - v.y), r1.x - v.x);
  const a2 = Math.atan2(-(r2.y - v.y), r2.x - v.x);
  ctx.beginPath();
  ctx.moveTo(v.x, v.y);
  ctx.arc(v.x, v.y, 40, -a1, -a2, a2 < a1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 顶点
  ctx.fillStyle = '#34c759';
  ctx.beginPath(); ctx.arc(v.x, v.y, 5, 0, Math.PI * 2); ctx.fill();
  // 标签
  drawLabel(`${deg.toFixed(1)}°`, v.x + 44, v.y - 10, '#34c759');
  ctx.restore();
}

function drawStroke(stroke, color) {
  if (stroke.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke[0].x, stroke[0].y);
  for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawMagnifier() {
  const size = 200;
  const zoom = 6;
  const px = mouse.x - size / 2;
  const py = mouse.y + 30;
  ctx.save();
  // 圆形裁切
  ctx.beginPath();
  ctx.arc(px + size / 2, py + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  // 绘制放大区域
  if (bgImage) {
    const sx = mouse.x - (size / 2) / zoom;
    const sy = mouse.y - (size / 2) / zoom;
    ctx.drawImage(bgImage, sx, sy, size / zoom, size / zoom, px, py, size, size);
  }
  ctx.restore();
  // 边框 + 十字
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(px + size / 2, py + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#007aff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + size / 2 - 12, py + size / 2);
  ctx.lineTo(px + size / 2 + 12, py + size / 2);
  ctx.moveTo(px + size / 2, py + size / 2 - 12);
  ctx.lineTo(px + size / 2, py + size / 2 + 12);
  ctx.stroke();
  ctx.restore();
}

function drawLabel(text, x, y, color) {
  ctx.save();
  ctx.font = 'bold 13px ui-monospace, monospace';
  const w = ctx.measureText(text).width + 12;
  const h = 22;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 6);
  else ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x + 6, y + 15);
  ctx.restore();
}

function drawMeasurement(m, confirmed) {
  const color = confirmed ? '#007aff' : '#34c759';
  if (m.kind === 'rect') drawRect(m.data, color);
  else if (m.kind === 'line') drawLine(m.data.a, m.data.b, color, true);
  else if (m.kind === 'angle') {
    drawLine(m.data.v, m.data.r1, color, false);
    drawLine(m.data.v, m.data.r2, color, false);
    drawAngleArc(m.data.v, m.data.r1, m.data.r2, m.data.deg);
  }
}

// 更新 HUD
function updateHUD() {
  hudCoord.textContent = `${Math.round(mouse.x)}, ${Math.round(mouse.y)}`;
  let result = '—';
  let physical = '—';
  if (tool === 'rect' && isDragging && downPoint) {
    const w = Math.abs(mouse.x - downPoint.x);
    const h = Math.abs(mouse.y - downPoint.y);
    result = `${Math.round(w)} × ${Math.round(h)} px`;
    const p = pxToPhysical((w + h) / 2);
    physical = `约 ${(p.mm).toFixed(1)} mm @ 96DPI`;
  } else if (tool === 'line' && points.length === 1) {
    const len = distance(points[0], mouse);
    const ang = angleOfLine(points[0], mouse);
    result = `${Math.round(len)} px  ∠ ${ang.toFixed(1)}°`;
    physical = `${(pxToPhysical(len).mm).toFixed(1)} mm`;
  } else if (tool === 'angle') {
    if (points.length === 2) {
      const deg = angleBetween(points[0], points[1], mouse);
      result = `${deg.toFixed(1)}°`;
    } else if (points.length === 3) {
      // 已确认，不变
    }
  }
  hudResult.textContent = result;
  hudPhysical.textContent = physical;
}

// 鼠标事件
drawCanvas.addEventListener('mousemove', (e) => {
  mouse = { x: e.clientX, y: e.clientY };
  if (tool === 'free' && isDragging && currentStroke) {
    currentStroke.push({ x: mouse.x, y: mouse.y });
  }
  updateHUD();
  redraw();
});

drawCanvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  downPoint = { x: e.clientX, y: e.clientY };
  if (tool === 'rect') {
    // 拖拽式
  } else if (tool === 'free') {
    currentStroke = [{ x: e.clientX, y: e.clientY }];
  } else if (tool === 'line' || tool === 'angle') {
    // 点击式
    isDragging = false;
  }
});

drawCanvas.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  if (tool === 'rect' && isDragging && downPoint) {
    const r = { x: Math.min(downPoint.x, e.clientX), y: Math.min(downPoint.y, e.clientY),
                w: Math.abs(e.clientX - downPoint.x), h: Math.abs(e.clientY - downPoint.y) };
    if (r.w > 2 || r.h > 2) {
      measurements.push({ kind: 'rect', data: r });
    }
  } else if (tool === 'free' && currentStroke) {
    if (currentStroke.length > 1) freeStrokes.push(currentStroke);
    currentStroke = null;
  }
  isDragging = false;
  downPoint = null;
  updateHUD();
  redraw();
});

drawCanvas.addEventListener('click', (e) => {
  if (tool === 'line') {
    points.push({ x: e.clientX, y: e.clientY });
    if (points.length === 2) {
      measurements.push({ kind: 'line', data: { a: points[0], b: points[1] } });
      points = [];
    }
  } else if (tool === 'angle') {
    points.push({ x: e.clientX, y: e.clientY });
    if (points.length === 3) {
      const deg = angleBetween(points[0], points[1], points[2]);
      measurements.push({ kind: 'angle', data: { v: points[0], r1: points[1], r2: points[2] }, deg });
      points = [];
    }
  }
  updateHUD();
  redraw();
});

// 工具切换
const tBtns = document.querySelectorAll('.t-btn[data-tool]');
tBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setTool(btn.dataset.tool);
  });
});
function setTool(t) {
  tool = t;
  points = [];
  isDragging = false;
  tBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  const hints = {
    ruler: '移动鼠标查看标尺坐标',
    rect: '按住拖拽框选测量区域',
    line: '点击两个点测量距离与角度',
    angle: '依次点击：顶点 → 端点1 → 端点2',
    magnifier: '移动鼠标局部放大',
    free: '按住拖拽自由标注'
  };
  hintEl.textContent = hints[t] + ' · 按 Esc 退出';
  redraw();
  updateHUD();
}

document.getElementById('clearBtn').addEventListener('click', () => {
  measurements = []; freeStrokes = []; points = []; currentStroke = null;
  redraw(); updateHUD();
});

document.getElementById('saveBtn').addEventListener('click', () => {
  saveSnapshot();
});

document.getElementById('closeBtn').addEventListener('click', () => {
  window.ruler.closeOverlay();
});

function saveSnapshot() {
  // 合并 bg + draw 到一个 canvas
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const octx = out.getContext('2d');
  octx.drawImage(bgCanvas, 0, 0);
  octx.drawImage(drawCanvas, 0, 0);
  out.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `屏幕标尺管家_${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// 键盘
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { window.ruler.closeOverlay(); return; }
  if (e.key === 'c' || e.key === 'C') { document.getElementById('clearBtn').click(); return; }
  if (e.key === 's' || e.key === 'S') { saveSnapshot(); return; }
  const map = { '1':'ruler', '2':'rect', '3':'line', '4':'angle', '5':'magnifier', '6':'free' };
  if (map[e.key]) setTool(map[e.key]);
});

// 隐藏 hint 几秒后
setTimeout(() => { hintEl.style.opacity = '0.6'; }, 3000);

resize();
