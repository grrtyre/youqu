// ========== 图片压缩器 · 渲染层逻辑 ==========

const state = {
  files: [],            // [{ path, name, size, width, height, format, thumb }]
  results: [],          // 压缩结果
  quality: 75,
  format: 'keep',
  outputDir: null,      // null 表示同源目录
  isCompressing: false
};

// ========== DOM 引用 ==========
const $ = (id) => document.getElementById(id);

const dropzone = $('dropzone');
const addBtn = $('addBtn');
const clearBtn = $('clearBtn');
const qualitySlider = $('qualitySlider');
const qualityValue = $('qualityValue');
const formatGroup = $('formatGroup');
const dirPicker = $('dirPicker');
const dirLabel = $('dirLabel');
const fileListWrap = $('fileListWrap');
const fileList = $('fileList');
const actionBar = $('actionBar');
const actionInfo = $('actionInfo');
const compressBtn = $('compressBtn');
const progressWrap = $('progressWrap');
const progressFill = $('progressFill');
const progressText = $('progressText');
const toast = $('toast');
const versionText = $('versionText');

const statCount = $('statCount');
const statOriginal = $('statOriginal');
const statCompressed = $('statCompressed');
const statSaving = $('statSaving');

// ========== 初始化 ==========

async function init() {
  // 加载版本号
  try {
    if (window.api && window.api.getAppVersion) {
      const v = await window.api.getAppVersion();
      versionText.textContent = 'v' + v;
    }
  } catch (e) {}

  bindEvents();
  updateSliderTrack();

  // 演示模式：用于截图展示
  if (location.search.indexOf('demo=1') !== -1) {
    loadDemoData();
  }
}

function loadDemoData() {
  const demoFiles = [
    { name: '风景_山顶日出.jpg', size: 4587520, width: 4032, height: 3024, format: 'jpeg' },
    { name: '产品图_蓝牙耳机.png', size: 2891000, width: 2000, height: 2000, format: 'png' },
    { name: '截图_仪表盘.png', size: 1204320, width: 1920, height: 1080, format: 'png' },
    { name: '海报_夏季促销.jpg', size: 6312000, width: 3508, height: 4961, format: 'jpeg' },
    { name: '头像_用户.png', size: 480200, width: 512, height: 512, format: 'png' },
    { name: '壁纸_极光.webp', size: 3420000, width: 3840, height: 2160, format: 'webp' },
    { name: '证件照_蓝底.jpg', size: 856000, width: 1000, height: 1400, format: 'jpeg' }
  ];
  state.files = demoFiles.map((f) => ({ ...f, path: f.name, thumb: '' }));
  // 模拟压缩结果
  state.results = demoFiles.map((f) => {
    const compressed = Math.round(f.size * (0.2 + Math.random() * 0.15));
    const reduction = Math.round(((f.size - compressed) / f.size) * 100);
    return { success: true, originalSize: f.size, compressedSize: compressed, reduction };
  });
  renderList();
  updateStats();
}

function bindEvents() {
  // 质量滑块
  qualitySlider.addEventListener('input', (e) => {
    state.quality = parseInt(e.target.value, 10);
    qualityValue.textContent = state.quality;
    updateSliderTrack();
    updatePresetButtons();
  });

  // 质量预设
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = parseInt(btn.dataset.q, 10);
      state.quality = q;
      qualitySlider.value = q;
      qualityValue.textContent = q;
      updateSliderTrack();
      updatePresetButtons();
    });
  });

  // 格式选择
  formatGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.format-btn');
    if (!btn) return;
    state.format = btn.dataset.format;
    document.querySelectorAll('.format-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // 输出目录选择
  dirPicker.addEventListener('click', async () => {
    const dir = await window.api.selectDirectory();
    if (dir) {
      state.outputDir = dir;
      dirLabel.textContent = shortenPath(dir);
    }
  });

  // 选择图片按钮
  addBtn.addEventListener('click', async () => {
    const paths = await window.api.selectImages();
    if (paths && paths.length) await addFiles(paths);
  });

  // 清空按钮
  clearBtn.addEventListener('click', () => {
    clearFiles();
  });

  // 拖拽
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files || []);
    const paths = files.map((f) => f.path).filter(Boolean);
    const valid = paths.filter((p) => /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(p));
    if (valid.length) await addFiles(valid);
    else if (paths.length) showToast('不支持的图片格式', 'error');
  });

  // 压缩按钮
  compressBtn.addEventListener('click', () => startCompress());
}

function updateSliderTrack() {
  const v = state.quality;
  qualitySlider.style.background =
    `linear-gradient(to right, var(--accent) 0%, var(--accent) ${v}%, #e5e5ea ${v}%, #e5e5ea 100%)`;
}

function updatePresetButtons() {
  document.querySelectorAll('.preset-btn').forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.q, 10) === state.quality);
  });
}

function shortenPath(p) {
  if (!p) return '同源目录';
  const parts = p.split(/[\\/]/);
  if (parts.length <= 3) return p;
  return '.../' + parts.slice(-2).join('/');
}

// ========== 文件管理 ==========

async function addFiles(paths) {
  for (const p of paths) {
    // 去重
    if (state.files.find((f) => f.path === p)) continue;
    const info = await window.api.getImageInfo(p);
    if (info.error || info.size === 0) {
      showToast(`无法读取：${info.name}`, 'error');
      continue;
    }
    // 生成缩略图
    let thumb = '';
    try {
      thumb = await createThumb(p);
    } catch (e) {}
    state.files.push({
      path: info.path,
      name: info.name,
      size: info.size,
      width: info.width,
      height: info.height,
      format: info.format,
      thumb
    });
  }
  renderList();
  updateStats();
}

function createThumb(filePath) {
  // 渲染层无法直接 require fs，留作后续通过 preload 扩展接口生成
  return Promise.resolve('');
}

function clearFiles() {
  state.files = [];
  state.results = [];
  renderList();
  updateStats();
  showWorkspace('dropzone');
}

function showWorkspace(mode) {
  if (mode === 'list') {
    dropzone.style.display = 'none';
    fileListWrap.style.display = 'flex';
    fileListWrap.style.flexDirection = 'column';
    actionBar.style.display = 'flex';
  } else {
    dropzone.style.display = 'flex';
    fileListWrap.style.display = 'none';
    actionBar.style.display = 'none';
  }
}

function renderList() {
  if (!state.files.length) {
    showWorkspace('dropzone');
    return;
  }
  showWorkspace('list');

  fileList.innerHTML = '';
  state.files.forEach((f, i) => {
    const result = state.results[i];
    const li = document.createElement('li');

    // 文件名
    const nameCell = document.createElement('div');
    nameCell.className = 'file-name';
    if (f.thumb) {
      const img = document.createElement('img');
      img.className = 'file-thumb';
      img.src = f.thumb;
      nameCell.appendChild(img);
    } else {
      // 格式色标占位
      const badge = document.createElement('div');
      badge.className = 'file-thumb fmt-badge';
      let fmt = (f.format || '').toUpperCase().slice(0, 4);
      if (!fmt) {
        const dot = f.name.lastIndexOf('.');
        fmt = dot >= 0 ? f.name.slice(dot + 1).toUpperCase().slice(0, 4) : 'IMG';
      }
      badge.textContent = fmt;
      badge.dataset.fmt = fmt.toLowerCase();
      nameCell.appendChild(badge);
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name-text';
    nameSpan.textContent = f.name;
    nameSpan.title = f.path;
    nameCell.appendChild(nameSpan);

    // 原始大小
    const origCell = document.createElement('div');
    origCell.className = 'file-size';
    origCell.textContent = formatBytes(f.size);

    // 压缩后大小
    const compCell = document.createElement('div');
    compCell.className = 'file-size';
    if (result && result.success) {
      compCell.classList.add('compressed');
      compCell.textContent = formatBytes(result.compressedSize);
    } else {
      compCell.textContent = '—';
    }

    // 节省比例
    const redCell = document.createElement('div');
    if (result && result.success) {
      const badge = document.createElement('span');
      badge.className = 'reduction-badge';
      const r = result.reduction;
      if (r > 0) {
        badge.classList.add('good');
        badge.textContent = '-' + r + '%';
      } else if (r === 0) {
        badge.classList.add('none');
        badge.textContent = '0%';
      } else {
        badge.classList.add('warn');
        badge.textContent = '+' + Math.abs(r) + '%';
      }
      redCell.appendChild(badge);
    } else {
      redCell.textContent = '—';
      redCell.style.color = 'var(--text-tertiary)';
    }

    // 状态
    const statusCell = document.createElement('div');
    const status = document.createElement('span');
    if (!result) {
      status.className = 'status-dot pending';
      status.textContent = '待处理';
    } else if (result.success) {
      status.className = 'status-dot success';
      status.textContent = '完成';
    } else {
      status.className = 'status-dot error';
      status.textContent = '失败';
      status.title = result.error || '';
    }
    statusCell.appendChild(status);

    li.append(nameCell, origCell, compCell, redCell, statusCell);
    fileList.appendChild(li);
  });

  const totalSize = state.files.reduce((s, f) => s + f.size, 0);
  actionInfo.textContent = `已选 ${state.files.length} 张图片 · 共 ${formatBytes(totalSize)}`;
}

function updateStats() {
  statCount.textContent = state.files.length;
  const totalOriginal = state.files.reduce((s, f) => s + f.size, 0);
  statOriginal.textContent = formatBytes(totalOriginal);

  if (state.results.length) {
    const totalCompressed = state.results.reduce((s, r) => s + (r.success ? r.compressedSize : 0), 0);
    const successCount = state.results.filter((r) => r.success).length;
    if (successCount === state.files.length) {
      statCompressed.textContent = formatBytes(totalCompressed);
      const saving = totalOriginal - totalCompressed;
      const savingPct = totalOriginal > 0 ? Math.round((saving / totalOriginal) * 100) : 0;
      statSaving.textContent = savingPct + '%';
    } else {
      statCompressed.textContent = '—';
      statSaving.textContent = '—';
    }
  } else {
    statCompressed.textContent = '—';
    statSaving.textContent = '—';
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

// ========== 压缩流程 ==========

async function startCompress() {
  if (state.isCompressing) return;
  if (!state.files.length) {
    showToast('请先添加图片', 'error');
    return;
  }

  state.isCompressing = true;
  state.results = [];
  compressBtn.disabled = true;
  progressWrap.style.display = 'flex';
  progressFill.style.width = '0%';
  progressText.textContent = '准备中...';

  // 输出目录：null 表示交给主进程使用同源目录
  const outputDir = state.outputDir;

  // 进度回调
  const off = window.api.onProgress((data) => {
    const pct = Math.round(((data.index + 1) / data.total) * 100);
    progressFill.style.width = pct + '%';
    progressText.textContent = `压缩中 (${data.index + 1}/${data.total}) · ${data.current}`;
  });

  try {
    const results = await window.api.compressBatch({
      files: state.files.map((f) => f.path),
      options: {
        quality: state.quality,
        format: state.format
      },
      outputDir
    });
    state.results = results;
    renderList();
    updateStats();

    const ok = results.filter((r) => r.success).length;
    if (ok === results.length) {
      showToast(`全部压缩完成 · ${ok} 张`, 'success');
    } else {
      showToast(`完成 ${ok}/${results.length}，部分失败`, 'error');
    }
  } catch (err) {
    showToast('压缩失败：' + err.message, 'error');
  } finally {
    off && off();
    state.isCompressing = false;
    compressBtn.disabled = false;
    setTimeout(() => {
      progressWrap.style.display = 'none';
    }, 800);
  }
}

// ========== Toast ==========
let toastTimer = null;
function showToast(msg, type) {
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

// 启动
init();
