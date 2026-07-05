// 编辑器核心：截图标注 Canvas
const { api } = window;

// 标题栏
document.getElementById('btnMin').onclick = () => api.winMinimize();
document.getElementById('btnMax').onclick = () => api.winMaximize();
document.getElementById('btnClose').onclick = () => api.winClose();

const bgCanvas = document.getElementById('bgCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const previewCanvas = document.getElementById('previewCanvas');
const canvasWrap = document.getElementById('canvasWrap');
const textEditor = document.getElementById('textEditor');
const statusEl = document.getElementById('status');
const toast = document.getElementById('toast');

const bgCtx = bgCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');
const previewCtx = previewCanvas.getContext('2d');

let state = {
  tool: 'rect',
  color: '#ff3b30',
  size: 2,
  shapes: [],   // 已确认的标注
  redoStack: [], // 重做栈：undo 时把 pop 出的 shape 压入这里
  current: null, // 正在绘制的标注
  numberIdx: 1,
  image: null,    // Image 对象
  rect: null,
  scaleFactor: 1,
  displayW: 0,
  displayH: 0
};

let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1500);
}
function setStatus(s) { statusEl.textContent = s; }

// 工具切换
document.querySelectorAll('.tool[data-tool]').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tool[data-tool]').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    setStatus('工具：' + btn.title);
    if (state.tool !== 'text') hideTextEditor();
  });
});
// 颜色
document.querySelectorAll('.color').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.color').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.color = btn.dataset.color;
  };
});
// 线宽
document.querySelectorAll('.size').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.size').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.size = parseInt(btn.dataset.size, 10);
  };
});
// 撤销 / 重做
document.getElementById('btnUndo').onclick = undo;
document.getElementById('btnRedo').onclick = redo;
function undo() {
  if (state.shapes.length === 0) return;
  const last = state.shapes.pop();
  state.redoStack.push(last);
  if (last.type === 'number') state.numberIdx = Math.max(1, state.numberIdx - 1);
  redraw();
  updateUndoRedoState();
}
function redo() {
  if (state.redoStack.length === 0) return;
  const s = state.redoStack.pop();
  state.shapes.push(s);
  if (s.type === 'number') state.numberIdx = Math.max(state.numberIdx, s.num + 1);
  redraw();
  updateUndoRedoState();
}
// 撤销/重做按钮可用状态反馈
function updateUndoRedoState() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.classList.toggle('disabled', state.shapes.length === 0);
  if (btnRedo) btnRedo.classList.toggle('disabled', state.redoStack.length === 0);
}
// 添加新标注：清空 redo 栈（标准行为：新操作后无法 redo）
function pushShape(s) {
  state.shapes.push(s);
  state.redoStack = [];
  updateUndoRedoState();
}
document.addEventListener('keydown', (e) => {
  // Ctrl+Z 撤销，Ctrl+Shift+Z 或 Ctrl+Y 重做
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  } else if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
    e.preventDefault();
    redo();
  }
  if (e.key === 'Escape') hideTextEditor();
});

// 初始化：接收主进程消息
api.onEditorInit(async (args) => {
  state.rect = args.rect;
  state.scaleFactor = args.scaleFactor || 1;
  if (args.existingItem) {
    // 从历史打开：整张图就是裁剪好的，rect 为 null
    state.rect = null;
  }
  // 读取图片
  const r = await api.readImage({ path: args.imagePath });
  if (!r.ok) { showToast('图片加载失败'); return; }
  const img = new Image();
  img.onload = () => {
    state.image = img;
    setupCanvas();
  };
  img.src = 'data:image/png;base64,' + r.base64;
});

function setupCanvas() {
  let physW, physH;
  if (state.rect) {
    physW = state.rect.w;
    physH = state.rect.h;
  } else {
    physW = state.image.naturalWidth;
    physH = state.image.naturalHeight;
  }
  // 显示尺寸：按物理像素 1:1（已是 CSS 像素 * scale 后的），显示用 1:1
  // 但若太大，按可用空间缩放
  const availW = window.innerWidth - 64 - 48;
  const availH = window.innerHeight - 40 - 56 - 48;
  let dispW = physW, dispH = physH;
  const scaleDown = Math.min(1, availW / physW, availH / physH);
  dispW = Math.round(physW * scaleDown);
  dispH = Math.round(physH * scaleDown);
  state.displayW = dispW;
  state.displayH = dispH;
  state.displayScale = scaleDown; // 物理像素 → 显示像素

  [bgCanvas, drawCanvas, previewCanvas].forEach(c => {
    c.width = physW;
    c.height = physH;
    c.style.width = dispW + 'px';
    c.style.height = dispH + 'px';
  });
  canvasWrap.style.width = dispW + 'px';
  canvasWrap.style.height = dispH + 'px';

  // 画底图
  if (state.rect) {
    bgCtx.drawImage(
      state.image,
      state.rect.x, state.rect.y, state.rect.w, state.rect.h,
      0, 0, physW, physH
    );
  } else {
    bgCtx.drawImage(state.image, 0, 0, physW, physH);
  }
  redraw();
  setStatus('图片已加载 · ' + physW + ' × ' + physH);
}

// 坐标转换：鼠标 CSS 坐标 → 画布物理像素
function getPos(e) {
  const r = previewCanvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / state.displayW * previewCanvas.width;
  const y = (e.clientY - r.top) / state.displayH * previewCanvas.height;
  return { x, y };
}

// 鼠标交互
let drawing = false;
previewCanvas.addEventListener('mousedown', (e) => {
  if (state.tool === 'text') {
    showTextEditor(e);
    return;
  }
  if (state.tool === 'number') {
    const p = getPos(e);
    pushShape({
      type: 'number',
      x: p.x, y: p.y,
      color: state.color,
      size: state.size,
      num: state.numberIdx++
    });
    redraw();
    return;
  }
  drawing = true;
  const p = getPos(e);
  state.current = {
    type: state.tool,
    color: state.color,
    size: state.size,
    points: [p]
  };
});
previewCanvas.addEventListener('mousemove', (e) => {
  if (!drawing || !state.current) return;
  const p = getPos(e);
  if (state.current.type === 'pen' || state.current.type === 'mosaic') {
    state.current.points.push(p);
  } else {
    // rect/arrow：只保留起点和当前点
    state.current.points = [state.current.points[0], p];
  }
  drawPreview();
});
previewCanvas.addEventListener('mouseup', () => {
  if (!drawing || !state.current) return;
  drawing = false;
  // 至少有 2 个点或拖拽距离够
  const pts = state.current.points;
  if (pts.length >= 2) {
    pushShape(state.current);
  }
  state.current = null;
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  redraw();
});
previewCanvas.addEventListener('mouseleave', () => {
  if (drawing && state.current) {
    drawing = false;
    state.current = null;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }
});

// 文字输入
function showTextEditor(e) {
  const p = getPos(e);
  const r = previewCanvas.getBoundingClientRect();
  const cssX = (p.x / previewCanvas.width) * state.displayW;
  const cssY = (p.y / previewCanvas.height) * state.displayH;
  textEditor.style.left = cssX + 'px';
  textEditor.style.top = (cssY - 14) + 'px';
  textEditor.style.color = state.color;
  textEditor.style.fontSize = Math.max(14, state.size * 6) + 'px';
  textEditor.textContent = '';
  textEditor.classList.add('show');
  textEditor.dataset.x = p.x;
  textEditor.dataset.y = p.y;
  setTimeout(() => textEditor.focus(), 10);
}
function hideTextEditor() {
  textEditor.classList.remove('show');
}
textEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const txt = textEditor.textContent.trim();
    if (txt) {
      state.shapes.push({
        type: 'text',
        x: parseFloat(textEditor.dataset.x),
        y: parseFloat(textEditor.dataset.y),
        text: txt,
        color: state.color,
        size: state.size
      });
      redraw();
    }
    hideTextEditor();
  }
});
textEditor.addEventListener('blur', () => {
  // 失焦时也提交
  const txt = textEditor.textContent.trim();
  if (txt) {
    pushShape({
      type: 'text',
      x: parseFloat(textEditor.dataset.x),
      y: parseFloat(textEditor.dataset.y),
      text: txt,
      color: state.color,
      size: state.size
    });
    redraw();
  }
  hideTextEditor();
});

// 预览
function drawPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  if (state.current) drawShape(previewCtx, state.current);
}

// 重绘所有标注
function redraw() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  state.shapes.forEach(s => drawShape(drawCtx, s));
}

function drawShape(ctx, s) {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.type === 'rect') {
    const [a, b] = [s.points[0], s.points[1]];
    ctx.strokeRect(
      Math.min(a.x, b.x), Math.min(a.y, b.y),
      Math.abs(b.x - a.x), Math.abs(b.y - a.y)
    );
  } else if (s.type === 'arrow') {
    const [a, b] = [s.points[0], s.points[1]];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) { ctx.restore(); return; }
    const headLen = Math.max(10, s.size * 4);
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // 箭头
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(
      b.x - headLen * Math.cos(angle - Math.PI / 6),
      b.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      b.x - headLen * Math.cos(angle + Math.PI / 6),
      b.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  } else if (s.type === 'pen') {
    ctx.beginPath();
    s.points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  } else if (s.type === 'text') {
    const fontSize = Math.max(14, s.size * 6);
    ctx.font = `600 ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(s.text, s.x, s.y);
  } else if (s.type === 'number') {
    const r = Math.max(14, s.size * 5);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(r * 1.1)}px -apple-system, "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(s.num), s.x, s.y + 1);
    ctx.textAlign = 'start';
  } else if (s.type === 'mosaic') {
    drawMosaic(ctx, s);
  }
  ctx.restore();
}

// 马赛克：从 bgCanvas 取像素块状化
function drawMosaic(ctx, s) {
  const [a, b] = [s.points[0], s.points[1]];
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
  if (w < 2 || h < 2) return;
  const blockSize = Math.max(6, s.size * 3);
  // 从 bgCanvas 取像素
  try {
    const data = bgCtx.getImageData(
      Math.max(0, Math.floor(x)),
      Math.max(0, Math.floor(y)),
      Math.min(bgCanvas.width - x, Math.ceil(w)),
      Math.min(bgCanvas.height - y, Math.ceil(h))
    );
    // 块状绘制到 drawCtx
    for (let by = 0; by < h; by += blockSize) {
      for (let bx = 0; bx < w; bx += blockSize) {
        const sx = Math.min(bx, data.width - 1);
        const sy = Math.min(by, data.height - 1);
        const idx = (sy * data.width + sx) * 4;
        const r = data.data[idx], g = data.data[idx + 1], bl = data.data[idx + 2];
        ctx.fillStyle = `rgb(${r},${g},${bl})`;
        ctx.fillRect(x + bx, y + by, blockSize, blockSize);
      }
    }
  } catch (e) {
    // 跨域可能取不到，降级为半透明色块
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
}

// 合成最终图片：bg + draw
function composeFinal() {
  const out = document.createElement('canvas');
  out.width = bgCanvas.width;
  out.height = bgCanvas.height;
  const octx = out.getContext('2d');
  octx.drawImage(bgCanvas, 0, 0);
  octx.drawImage(drawCanvas, 0, 0);
  return out;
}

// 操作按钮
document.getElementById('btnCopy').onclick = async () => {
  const canvas = composeFinal();
  const base64 = canvas.toDataURL('image/png').split(',')[1];
  const r = await api.copyToClipboard({ base64 });
  if (r.ok) showToast('已复制到剪贴板');
  else showToast('复制失败');
};
document.getElementById('btnSave').onclick = async () => {
  const canvas = composeFinal();
  const base64 = canvas.toDataURL('image/png').split(',')[1];
  const r = await api.saveScreenshot({ base64, width: canvas.width, height: canvas.height });
  if (r.ok) showToast('已保存到历史');
  else showToast('保存失败');
};
document.getElementById('btnSaveAs').onclick = async () => {
  const canvas = composeFinal();
  const base64 = canvas.toDataURL('image/png').split(',')[1];
  const r = await api.saveAs({ base64 });
  if (r.ok) showToast('已保存');
  else if (!r.canceled) showToast('保存失败');
};
document.getElementById('btnPin').onclick = async () => {
  const canvas = composeFinal();
  const base64 = canvas.toDataURL('image/png').split(',')[1];
  const win = await electronScreenPos();
  const r = await api.pinScreenshot({
    base64,
    x: win.x, y: win.y,
    width: state.displayW, height: state.displayH
  });
  if (r.ok) {
    showToast('已贴图');
    setTimeout(() => api.winClose(), 400);
  } else showToast('贴图失败');
};

// 获取编辑器窗口在屏幕上的位置，贴图定位到编辑器右侧（不够则下方/左侧）
async function electronScreenPos() {
  const r = await api.getEditorBounds();
  if (!r.ok) return { x: 100, y: 100 };
  const pinW = state.displayW || 400;
  const pinH = state.displayH || 300;
  const gap = 16;
  // 优先右侧
  let x = r.x + r.w + gap;
  let y = r.y;
  // 右侧放不下，试下方
  if (x + pinW > screen.availWidth) {
    x = r.x;
    y = r.y + r.h + gap;
  }
  // 下方也放不下，试左侧
  if (y + pinH > screen.availHeight) {
    x = Math.max(0, r.x - pinW - gap);
    y = r.y;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

setStatus('就绪');
updateUndoRedoState();
