// 取色覆盖层逻辑：一次性接收屏幕截图，本地采样、放大显示
'use strict';

const lens = document.getElementById('lens');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const infoCard = document.getElementById('infoCard');
const infoSwatch = document.getElementById('infoSwatch');
const infoHex = document.getElementById('infoHex');
const infoRgb = document.getElementById('infoRgb');
const hint = document.querySelector('.hint');

const LENS = 220;     // 放大镜像素尺寸
const ZOOM = 13;      // 放大倍数（奇数，便于中心像素对齐）
const HALF = Math.floor(ZOOM / 2);

// 屏幕截图离屏 canvas
let snapshotCanvas = document.createElement('canvas');
let snapshotCtx = snapshotCanvas.getContext('2d', { willReadFrequently: true });
let snapshotReady = false;
let snapshotWidth = 0;
let snapshotHeight = 0;
// 缩放比：截图分辨率 / 屏幕逻辑分辨率
let scaleX = 1;
let scaleY = 1;

let currentColor = null;

window.api.picker.onReady(async (info) => {
  snapshotWidth = info.width;
  snapshotHeight = info.height;
  // 加载 dataURL 到 Image，再画到 snapshotCanvas
  const img = new Image();
  img.onload = () => {
    snapshotCanvas.width = img.width;
    snapshotCanvas.height = img.height;
    snapshotCtx.drawImage(img, 0, 0);
    snapshotReady = true;
    // 计算缩放比（屏幕逻辑像素 vs 截图像素）
    scaleX = img.width / window.innerWidth;
    scaleY = img.height / window.innerHeight;
  };
  img.src = info.dataUrl;
});

function sampleAt(mx, my) {
  if (!snapshotReady) return null;
  // 鼠标坐标是逻辑屏幕坐标，需要换算到截图坐标
  const sx = Math.floor(mx * scaleX);
  const sy = Math.floor(my * scaleY);
  if (sx < 0 || sy < 0 || sx >= snapshotWidth || sy >= snapshotHeight) return null;
  const p = snapshotCtx.getImageData(sx, sy, 1, 1).data;
  return { r: p[0], g: p[1], b: p[2] };
}

function rgbToHex(r, g, b) {
  const t = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${t(r)}${t(g)}${t(b)}`;
}

function positionLens(mx, my) {
  let x = mx + 24;
  let y = my + 24;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (x + LENS + 220 > vw) x = mx - LENS - 24;
  if (y + LENS + 30 > vh) y = my - LENS - 30;
  lens.style.left = x + 'px';
  lens.style.top = y + 'px';
  infoCard.style.left = (x + LENS + 12) + 'px';
  infoCard.style.top = y + 'px';
  hint.style.left = x + 'px';
  hint.style.top = (y + LENS + 8) + 'px';
}

function drawMagnifier(mx, my) {
  if (!snapshotReady) return;
  // 取一个 ZOOM x ZOOM 的区域并放大到 LENS x LENS
  const sx = Math.floor(mx * scaleX) - HALF;
  const sy = Math.floor(my * scaleY) - HALF;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, LENS, LENS);
  // 边界处理：超出的部分保持透明（黑底），先填充一个深色底
  ctx.fillStyle = '#1d1d1f';
  ctx.fillRect(0, 0, LENS, LENS);
  // 只画在截图范围内的部分
  const dxClamp = Math.max(0, -sx);
  const dyClamp = Math.max(0, -sy);
  const sxClamp = Math.max(0, sx);
  const syClamp = Math.max(0, sy);
  const wClamp = Math.min(ZOOM, snapshotWidth - sxClamp);
  const hClamp = Math.min(ZOOM, snapshotHeight - syClamp);
  if (wClamp > 0 && hClamp > 0) {
    ctx.drawImage(
      snapshotCanvas,
      sxClamp, syClamp, wClamp, hClamp,
      dxClamp * (LENS / ZOOM), dyClamp * (LENS / ZOOM), wClamp * (LENS / ZOOM), hClamp * (LENS / ZOOM)
    );
  }
}

// 鼠标移动：更新放大镜位置、采样、绘制
document.addEventListener('mousemove', (e) => {
  positionLens(e.clientX, e.clientY);
  drawMagnifier(e.clientX, e.clientY);
  const c = sampleAt(e.clientX, e.clientY);
  if (c) {
    const hex = rgbToHex(c.r, c.g, c.b);
    currentColor = { r: c.r, g: c.g, b: c.b, hex };
    infoSwatch.style.background = hex;
    infoHex.textContent = hex.toUpperCase();
    infoRgb.textContent = `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
});

// 点击：确认取色
document.addEventListener('click', async () => {
  if (!currentColor) {
    window.api.picker.cancel();
    return;
  }
  await window.api.picker.done(currentColor);
});

// ESC：取消
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.api.picker.cancel();
});

// 鼠标右键也取消
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.api.picker.cancel();
});
