// 截图选区逻辑
const { api } = window;
const overlay = document.getElementById('overlay');
const bgLayer = document.getElementById('bgLayer');
const selection = document.getElementById('selection');
const selSize = document.getElementById('selSize');
const toolbar = document.getElementById('toolbar');
const btnOk = document.getElementById('btnOk');
const btnCancel = document.getElementById('btnCancel');

let rawPath = null;
let scaleFactor = 1;
let dragging = false;
let startX = 0, startY = 0;
let rect = null;

api.onPickerInit((args) => {
  rawPath = args.rawPath;
  scaleFactor = args.scaleFactor || 1;
  bgLayer.style.backgroundImage = `url(file:///${rawPath.replace(/\\/g, '/')})`;
});

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

// 确定
btnOk.onclick = async () => {
  if (!rect) return;
  // 把 CSS 像素坐标转为物理像素（乘 scaleFactor）
  const physRect = {
    x: Math.round(rect.x * scaleFactor),
    y: Math.round(rect.y * scaleFactor),
    w: Math.round(rect.w * scaleFactor),
    h: Math.round(rect.h * scaleFactor)
  };
  await api.openEditor({
    rawPath: rawPath,
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
