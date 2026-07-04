// 截图选区逻辑（支持多屏拼接）
const { api } = window;
const overlay = document.getElementById('overlay');
const bgLayer = document.getElementById('bgLayer');
const selection = document.getElementById('selection');
const selSize = document.getElementById('selSize');
const toolbar = document.getElementById('toolbar');
const btnOk = document.getElementById('btnOk');
const btnCancel = document.getElementById('btnCancel');

let sources = [];           // [{rawPath, bounds, scaleFactor, physW, physH}]
let desktopBounds = null;   // 虚拟桌面 bounds {x, y, width, height}
let composedRawPath = null; // 拼接后的整屏图路径，传给 editor
let scaleFactor = 1;        // 假设所有屏 scaleFactor 一致（绝大多数情况）
let dragging = false;
let startX = 0, startY = 0;
let rect = null;            // 选区 CSS 像素坐标（相对 picker 窗口左上角）

// 加载图片（base64 → Image）
function loadImage(base64) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = 'data:image/png;base64,' + base64;
  });
}

api.onPickerInit(async (args) => {
  sources = args.sources || [];
  desktopBounds = args.desktopBounds;
  if (!sources.length || !desktopBounds) return;
  scaleFactor = sources[0].scaleFactor || 1;
  await composeBackground();
});

// 多屏拼接：在 canvas 上把所有 display 的图按物理像素位置画到一起
async function composeBackground() {
  const physW = Math.round(desktopBounds.width * scaleFactor);
  const physH = Math.round(desktopBounds.height * scaleFactor);
  const canvas = document.createElement('canvas');
  canvas.width = physW;
  canvas.height = physH;
  const ctx = canvas.getContext('2d');

  for (const s of sources) {
    const r = await api.readImage({ path: s.rawPath });
    if (!r.ok) continue;
    let img;
    try { img = await loadImage(r.base64); } catch (e) { continue; }
    // 物理像素位置：相对虚拟桌面的偏移 × scaleFactor
    const dx = Math.round((s.bounds.x - desktopBounds.x) * scaleFactor);
    const dy = Math.round((s.bounds.y - desktopBounds.y) * scaleFactor);
    ctx.drawImage(img, dx, dy, s.physW, s.physH);
  }

  // 拼接结果存为临时文件，供 editor 读取
  const dataURL = canvas.toDataURL('image/png');
  const base64 = dataURL.split(',')[1];
  const saveR = await api.saveTempRaw({ base64 });
  if (!saveR.ok) return;
  composedRawPath = saveR.path;

  // 清理原始单屏 raw 文件（拼接已完成，不再需要）
  for (const s of sources) {
    api.cleanupTempFile({ path: s.rawPath });
  }

  // 用 data URL 作为背景，避免 file:// 路径含空格/中文括号/% 时被破坏
  bgLayer.style.backgroundImage = `url("${dataURL}")`;
  bgLayer.style.backgroundSize = `${desktopBounds.width}px ${desktopBounds.height}px`;
}

function startDrag(x, y) {
  dragging = true;
  startX = x;
  startY = y;
  selection.style.left = x + 'px';
  selection.style.top = y + 'px';
  selection.style.width = '0px';
  selection.style.height = '0px';
  selection.classList.add('active');
  toolbar.classList.remove('show');
}

function updateDrag(x, y) {
  if (!dragging) return;
  const left = Math.min(startX, x);
  const top = Math.min(startY, y);
  const w = Math.abs(x - startX);
  const h = Math.abs(y - startY);
  selection.style.left = left + 'px';
  selection.style.top = top + 'px';
  selection.style.width = w + 'px';
  selection.style.height = h + 'px';
  selSize.textContent = `${Math.round(w * scaleFactor)} × ${Math.round(h * scaleFactor)}`;
  rect = { x: left, y: top, w, h };
}

function endDrag() {
  if (!dragging) return;
  dragging = false;
  if (rect && rect.w > 4 && rect.h > 4) {
    // 显示工具栏在选区右下
    const tbW = 180;
    const tbH = 40;
    let tx = rect.x + rect.w - tbW;
    let ty = rect.y + rect.h + 8;
    if (tx < 4) tx = 4;
    if (ty + tbH > window.innerHeight - 4) ty = rect.y - tbH - 8;
    toolbar.style.left = tx + 'px';
    toolbar.style.top = ty + 'px';
    toolbar.classList.add('show');
  } else {
    selection.classList.remove('active');
    rect = null;
  }
}

overlay.addEventListener('mousedown', (e) => {
  if (e.target.closest('.toolbar')) return;
  startDrag(e.clientX, e.clientY);
});
overlay.addEventListener('mousemove', (e) => {
  updateDrag(e.clientX, e.clientY);
});
overlay.addEventListener('mouseup', () => endDrag());

// 确定：把 CSS 像素选区转为物理像素选区，传给 editor
btnOk.onclick = async () => {
  if (!rect || !composedRawPath) return;
  const physRect = {
    x: Math.round(rect.x * scaleFactor),
    y: Math.round(rect.y * scaleFactor),
    w: Math.round(rect.w * scaleFactor),
    h: Math.round(rect.h * scaleFactor)
  };
  await api.openEditor({
    rawPath: composedRawPath,
    rect: physRect,
    scaleFactor: scaleFactor
  });
};
btnCancel.onclick = () => api.pickerCancel();

// Esc 取消
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') api.pickerCancel();
});

// 防止文本选中
document.addEventListener('selectstart', (e) => e.preventDefault());
