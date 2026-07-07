// PDF管家 - 渲染层逻辑
const api = window.pdfAPI;

// 全局阻止默认拖拽行为，防止 Electron 把拖入的文件当成"在窗口里打开"
// 各 dropzone 的 drop 事件会单独 preventDefault + 处理
['dragover', 'drop'].forEach(evt => {
  window.addEventListener(evt, (e) => {
    if (!e.target.closest('.dropzone') && !e.target.closest('.row')) {
      e.preventDefault();
    }
  });
});

// ---------- 通用工具 ----------

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function basename(p) {
  if (!p) return '';
  const parts = String(p).replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

function extname(p) {
  const b = basename(p);
  const idx = b.lastIndexOf('.');
  return idx >= 0 ? b.slice(idx).toLowerCase() : '';
}

// 拖拽支持：Electron 的 drop 事件里 file.path 是真实文件系统路径（浏览器不给）
function setupDropzone(el, onFiles, opts) {
  const accept = (opts && opts.accept) || null;   // ['.pdf'] 或 ['.jpg','.png']
  const multiple = !(opts && opts.multiple === false);
  if (!el) return;
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('dragover');
  });
  el.addEventListener('dragleave', (e) => {
    e.preventDefault();
    el.classList.remove('dragover');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files || []);
    let paths = files.map(f => f.path).filter(Boolean);
    if (accept) {
      paths = paths.filter(p => accept.includes(extname(p)));
    }
    if (!multiple) paths = paths.slice(0, 1);
    if (paths.length > 0) onFiles(paths);
  });
}

function formatSize(bytes) {
  if (typeof bytes !== 'number' || !isFinite(bytes)) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// 状态栏
function setStatus(text) {
  $('#status-text').textContent = text;
}
function setProgress(text) {
  $('#status-progress').textContent = text || '';
}

// Toast
function toast(message, type = 'info', duration = 2800) {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const iconMap = { success: '✓', error: '✕', warning: '!', info: 'i' };
  el.innerHTML = `<span class="toast-icon">${iconMap[type] || ''}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.25s ease forwards';
    setTimeout(() => el.remove(), 250);
  }, duration);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// 模态框
function showModal(title, bodyHtml, opts = {}) {
  const mask = $('#modal-mask');
  $('#modal-ico').textContent = opts.icon || '✓';
  $('#modal-ico').className = 'modal-ico' + (opts.error ? ' error' : '');
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-open-folder').style.display = opts.openFolder ? 'inline-block' : 'none';
  if (opts.openFolder) {
    $('#modal-open-folder').dataset.path = opts.openFolder;
  }
  mask.classList.add('show');
}
function hideModal() {
  $('#modal-mask').classList.remove('show');
}

$('#modal-close').onclick = hideModal;
$('#modal-open-folder').onclick = async () => {
  const p = $('#modal-open-folder').dataset.path;
  if (p) await api.openInFolder(p);
  hideModal();
};

// 爱发电
$('#btn-afdian').onclick = async () => {
  const url = await api.getAfdianUrl();
  api.openExternal(url);
};

// 进度回调
api.onProgress((p) => {
  if (p && p.total) {
    setProgress(`${p.index + 1}/${p.total} · ${p.file}`);
  }
});

// ---------- 标签切换 ----------

$$('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const tab = item.dataset.tab;
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('#panel-' + tab).classList.add('active');
    setStatus('就绪');
    setProgress('');
  });
});

// 按钮加载状态
function setLoading(btn, loading) {
  if (loading) {
    if (!btn.dataset.origText) btn.dataset.origText = btn.textContent;
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
    if (btn.dataset.origText) btn.textContent = btn.dataset.origText;
  }
}

// 通用错误处理
async function runOp(btn, fn, okTitle, okStats) {
  if (btn) setLoading(btn, true);
  setStatus('处理中...');
  try {
    const result = await fn();
    setProgress('');
    setStatus('完成');
    if (btn) setLoading(btn, false);
    return result;
  } catch (e) {
    setProgress('');
    setStatus('出错');
    if (btn) setLoading(btn, false);
    toast(e.message || '操作失败', 'error', 4000);
    showModal('操作失败', `<div style="color:#ff3b30">${escapeHtml(e.message || '未知错误')}</div>`, { error: true, icon: '✕' });
    return null;
  }
}

// ========== 1. 合并 PDF ==========

const mergeState = { files: [], output: '' };

function renderMergeList() {
  const list = $('#merge-list');
  list.innerHTML = '';
  mergeState.files.forEach((f, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="fidx">${i + 1}</span>
      <span class="fname" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
      <span class="fsize">${formatSize(f.size)}</span>
      <button class="fmove" data-act="up" data-idx="${i}" title="上移" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="fmove" data-act="down" data-idx="${i}" title="下移" ${i === mergeState.files.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="fremove" data-idx="${i}" title="移除">×</button>
    `;
    list.appendChild(li);
  });
  list.querySelectorAll('.fremove').forEach(b => {
    b.onclick = () => {
      const idx = parseInt(b.dataset.idx, 10);
      mergeState.files.splice(idx, 1);
      renderMergeList();
      checkMergeReady();
    };
  });
  list.querySelectorAll('.fmove').forEach(b => {
    b.onclick = () => {
      if (b.disabled) return;
      const idx = parseInt(b.dataset.idx, 10);
      const act = b.dataset.act;
      const target = act === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= mergeState.files.length) return;
      const tmp = mergeState.files[idx];
      mergeState.files[idx] = mergeState.files[target];
      mergeState.files[target] = tmp;
      renderMergeList();
    };
  });
  checkMergeReady();
}

function checkMergeReady() {
  $('#merge-run').disabled = !(mergeState.files.length >= 2 && mergeState.output);
}

$('#merge-add').onclick = async () => {
  const paths = await api.selectPDFs();
  if (paths.length === 0) return;
  await addMergeFiles(paths);
};

async function addMergeFiles(paths) {
  // 去重
  const exist = new Set(mergeState.files.map(f => f.path));
  for (const p of paths) {
    if (exist.has(p)) continue;
    const info = await api.getFileInfo(p);
    mergeState.files.push({ path: p, name: basename(p), size: info ? info.size : 0 });
    exist.add(p);
  }
  renderMergeList();
}

// 拖拽支持：把 PDF 拖到合并区
setupDropzone($('#merge-dropzone'), (paths) => addMergeFiles(paths), { accept: ['.pdf'], multiple: true });

$('#merge-clear').onclick = () => {
  mergeState.files = [];
  renderMergeList();
};

$('#merge-choose-output').onclick = async () => {
  const p = await api.savePDF('合并结果.pdf');
  if (p) {
    mergeState.output = p;
    $('#merge-output').value = p;
    checkMergeReady();
  }
};

$('#merge-run').onclick = async () => {
  const btn = $('#merge-run');
  const paths = mergeState.files.map(f => f.path);
  const result = await runOp(btn, () => api.mergePDFs(paths, mergeState.output));
  if (result) {
    showModal('合并完成', `
      <div class="stat"><span class="stat-label">总页数</span><span class="stat-value">${result.pages} 页</span></div>
      <div class="stat"><span class="stat-label">合并文件</span><span class="stat-value">${paths.length} 个</span></div>
      <div class="stat"><span class="stat-label">输出大小</span><span class="stat-value">${formatSize(result.size)}</span></div>
      <div class="stat"><span class="stat-label">保存到</span><span class="stat-value" style="max-width:240px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(basename(result.outputPath))}</span></div>
    `, { openFolder: result.outputPath });
    toast('合并完成', 'success');
  }
};

// ========== 2. 拆分 PDF ==========

const splitState = { input: '', outputDir: '', pages: 0 };

function checkSplitReady() {
  $('#split-run').disabled = !(splitState.input && splitState.outputDir);
}

$('#split-choose').onclick = async () => {
  const p = await api.selectPDF();
  if (p) await setSplitSource(p);
};

async function setSplitSource(p) {
  splitState.input = p;
  $('#split-input').value = p;
  // 拉取页数，便于用户写有效页码范围
  const info = await api.getPageCount(p);
  if (info && info.pages > 0) {
    splitState.pages = info.pages;
    $('#split-page-count').textContent = info.pages;
    $('#split-page-max').textContent = info.pages;
    $('#split-page-info').style.display = 'block';
  } else {
    splitState.pages = 0;
    $('#split-page-info').style.display = 'none';
  }
  checkSplitReady();
}

// 拖拽支持：把单个 PDF 拖到拆分源文件行
setupDropzone($('#split-input').parentElement, (paths) => setSplitSource(paths[0]), { accept: ['.pdf'], multiple: false });

$('#split-choose-dir').onclick = async () => {
  const p = await api.selectDir();
  if (p) {
    splitState.outputDir = p;
    $('#split-output-dir').value = p;
    checkSplitReady();
  }
};

$$('input[name="split-mode"]').forEach(r => {
  r.onchange = () => {
    const v = document.querySelector('input[name="split-mode"]:checked').value;
    $('#split-ranges-field').style.display = (v === 'ranges' || v === 'extract') ? 'block' : 'none';
  };
});

$('#split-run').onclick = async () => {
  const btn = $('#split-run');
  const mode = document.querySelector('input[name="split-mode"]:checked').value;
  const ranges = $('#split-ranges').value;
  const opts = { mode, ranges };
  const result = await runOp(btn, () => api.splitPDF(splitState.input, splitState.outputDir, opts));
  if (result) {
    showModal('拆分完成', `
      <div class="stat"><span class="stat-label">源文件页数</span><span class="stat-value">${result.total} 页</span></div>
      <div class="stat"><span class="stat-label">输出文件</span><span class="stat-value">${result.outFiles.length} 个</span></div>
      <div class="stat"><span class="stat-label">输出目录</span><span class="stat-value" style="max-width:240px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(basename(splitState.outputDir))}/</span></div>
    `, { openFolder: splitState.outputDir });
    toast(`拆分完成，共生成 ${result.outFiles.length} 个文件`, 'success');
  }
};

// ========== 3. 压缩 PDF ==========

const compressState = { input: '', output: '' };

function checkCompressReady() {
  $('#compress-run').disabled = !(compressState.input && compressState.output);
}

$('#compress-choose').onclick = async () => {
  const p = await api.selectPDF();
  if (p) {
    compressState.input = p;
    $('#compress-input').value = p;
    const info = await api.getFileInfo(p);
    if (info) {
      $('#compress-orig-size').textContent = formatSize(info.size);
      $('#compress-orig-info').style.display = 'block';
    }
    checkCompressReady();
  }
};

$('#compress-choose-output').onclick = async () => {
  const p = await api.savePDF('压缩结果.pdf');
  if (p) {
    compressState.output = p;
    $('#compress-output').value = p;
    checkCompressReady();
  }
};

$('#compress-run').onclick = async () => {
  const btn = $('#compress-run');
  const result = await runOp(btn, () => api.compressPDF(compressState.input, compressState.output));
  if (result) {
    const ratioPct = (result.ratio * 100).toFixed(1);
    const ratioText = result.ratio > 0 ? `减小 ${ratioPct}%` : '基本无变化';
    showModal('压缩完成', `
      <div class="stat"><span class="stat-label">原始大小</span><span class="stat-value">${formatSize(result.origSize)}</span></div>
      <div class="stat"><span class="stat-label">压缩后</span><span class="stat-value">${formatSize(result.newSize)}</span></div>
      <div class="stat"><span class="stat-label">节省</span><span class="stat-value">${formatSize(result.saved)}</span></div>
      <div class="stat"><span class="stat-label">压缩率</span><span class="stat-value">${ratioText}</span></div>
    `, { openFolder: result.outputPath || compressState.output });
    toast(`压缩完成，${ratioText}`, 'success');
  }
};

// ========== 4. 加密 PDF ==========

const encryptState = { input: '', output: '' };

function checkEncryptReady() {
  $('#encrypt-run').disabled = !(encryptState.input && encryptState.output && $('#encrypt-user-pwd').value);
}

$('#encrypt-choose').onclick = async () => {
  const p = await api.selectPDF();
  if (p) {
    encryptState.input = p;
    $('#encrypt-input').value = p;
    checkEncryptReady();
  }
};

$('#encrypt-choose-output').onclick = async () => {
  const p = await api.savePDF('加密结果.pdf');
  if (p) {
    encryptState.output = p;
    $('#encrypt-output').value = p;
    checkEncryptReady();
  }
};

$('#encrypt-user-pwd').addEventListener('input', checkEncryptReady);

$('#encrypt-run').onclick = async () => {
  const btn = $('#encrypt-run');
  const userPwd = $('#encrypt-user-pwd').value;
  const ownerPwd = $('#encrypt-owner-pwd').value;
  const perms = {
    printing: $('#perm-print').checked ? 'highResolution' : false,
    modifying: $('#perm-modify').checked,
    copying: $('#perm-copy').checked,
    annotating: $('#perm-annotate').checked
  };
  const opts = { userPassword: userPwd, ownerPassword: ownerPwd, permissions: perms };
  const result = await runOp(btn, () => api.encryptPDF(encryptState.input, encryptState.output, opts));
  if (result) {
    showModal('加密完成', `
      <div class="stat"><span class="stat-label">总页数</span><span class="stat-value">${result.pages} 页</span></div>
      <div class="stat"><span class="stat-label">输出大小</span><span class="stat-value">${formatSize(result.size)}</span></div>
      <div class="stat"><span class="stat-label">保存到</span><span class="stat-value" style="max-width:240px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(basename(result.outputPath))}</span></div>
      <div style="margin-top:10px;color:#86868b;font-size:12px;line-height:1.5">已设置打开密码。请妥善保管密码，丢失后无法找回。</div>
    `, { openFolder: result.outputPath });
    toast('加密完成', 'success');
  }
};

// ========== 5. 解密 PDF ==========

const decryptState = { input: '', output: '' };

function checkDecryptReady() {
  $('#decrypt-run').disabled = !(decryptState.input && decryptState.output && $('#decrypt-pwd').value);
}

$('#decrypt-choose').onclick = async () => {
  const p = await api.selectPDF();
  if (p) {
    decryptState.input = p;
    $('#decrypt-input').value = p;
    checkDecryptReady();
  }
};

$('#decrypt-choose-output').onclick = async () => {
  const p = await api.savePDF('解密结果.pdf');
  if (p) {
    decryptState.output = p;
    $('#decrypt-output').value = p;
    checkDecryptReady();
  }
};

$('#decrypt-pwd').addEventListener('input', checkDecryptReady);

$('#decrypt-run').onclick = async () => {
  const btn = $('#decrypt-run');
  const pwd = $('#decrypt-pwd').value;
  const result = await runOp(btn, () => api.decryptPDF(decryptState.input, decryptState.output, pwd));
  if (result) {
    showModal('解密完成', `
      <div class="stat"><span class="stat-label">总页数</span><span class="stat-value">${result.pages} 页</span></div>
      <div class="stat"><span class="stat-label">输出大小</span><span class="stat-value">${formatSize(result.size)}</span></div>
      <div class="stat"><span class="stat-label">保存到</span><span class="stat-value" style="max-width:240px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(basename(result.outputPath))}</span></div>
    `, { openFolder: result.outputPath });
    toast('解密完成', 'success');
  }
};

// ========== 6. 加水印 ==========

const wmState = { input: '', output: '' };

function checkWmReady() {
  $('#wm-run').disabled = !(wmState.input && wmState.output && $('#wm-text').value.trim());
}

$('#wm-choose').onclick = async () => {
  const p = await api.selectPDF();
  if (p) {
    wmState.input = p;
    $('#wm-input').value = p;
    checkWmReady();
  }
};

$('#wm-choose-output').onclick = async () => {
  const p = await api.savePDF('加水印结果.pdf');
  if (p) {
    wmState.output = p;
    $('#wm-output').value = p;
    checkWmReady();
  }
};

$('#wm-text').addEventListener('input', checkWmReady);

// 颜色 #rrggbb → [r,g,b] (0-1)
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

$('#wm-run').onclick = async () => {
  const btn = $('#wm-run');
  const text = $('#wm-text').value.trim();
  const opts = {
    text,
    fontSize: parseFloat($('#wm-size').value) || 60,
    opacity: parseFloat($('#wm-opacity').value) || 0.15,
    rotation: parseFloat($('#wm-rotation').value) || -45,
    density: $('#wm-density').value,
    color: hexToRgb($('#wm-color').value)
  };
  const result = await runOp(btn, () => api.addWatermark(wmState.input, wmState.output, opts));
  if (result) {
    showModal('加水印完成', `
      <div class="stat"><span class="stat-label">总页数</span><span class="stat-value">${result.pages} 页</span></div>
      <div class="stat"><span class="stat-label">水印文字</span><span class="stat-value">${escapeHtml(text)}</span></div>
      <div class="stat"><span class="stat-label">输出大小</span><span class="stat-value">${formatSize(result.size)}</span></div>
    `, { openFolder: result.outputPath });
    toast('加水印完成', 'success');
  }
};

// ========== 7. 图片转 PDF ==========

const imgState = { files: [], output: '' };

function renderImgList() {
  const list = $('#img-list');
  list.innerHTML = '';
  imgState.files.forEach((f, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="fidx">${i + 1}</span>
      <span class="fname" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
      <span class="fsize">${formatSize(f.size)}</span>
      <button class="fremove" data-idx="${i}" title="移除">×</button>
    `;
    list.appendChild(li);
  });
  list.querySelectorAll('.fremove').forEach(b => {
    b.onclick = () => {
      const idx = parseInt(b.dataset.idx, 10);
      imgState.files.splice(idx, 1);
      renderImgList();
      checkImgReady();
    };
  });
  checkImgReady();
}

function checkImgReady() {
  $('#img-run').disabled = !(imgState.files.length >= 1 && imgState.output);
}

$('#img-add').onclick = async () => {
  const paths = await api.selectImages();
  if (paths.length === 0) return;
  await addImgFiles(paths);
};

async function addImgFiles(paths) {
  const exist = new Set(imgState.files.map(f => f.path));
  for (const p of paths) {
    if (exist.has(p)) continue;
    const info = await api.getFileInfo(p);
    imgState.files.push({ path: p, name: basename(p), size: info ? info.size : 0 });
    exist.add(p);
  }
  renderImgList();
}

// 拖拽支持：把图片拖到图片转 PDF 区
setupDropzone($('#img-dropzone'), (paths) => addImgFiles(paths), { accept: ['.jpg', '.jpeg', '.png'], multiple: true });

$('#img-clear').onclick = () => {
  imgState.files = [];
  renderImgList();
};

$('#img-choose-output').onclick = async () => {
  const p = await api.savePDF('图片转PDF.pdf');
  if (p) {
    imgState.output = p;
    $('#img-output').value = p;
    checkImgReady();
  }
};

$('#img-run').onclick = async () => {
  const btn = $('#img-run');
  const paths = imgState.files.map(f => f.path);
  const opts = {
    pageSize: $('#img-page-size').value,
    orientation: $('#img-orientation').value,
    margin: 0
  };
  const result = await runOp(btn, () => api.imagesToPDF(paths, imgState.output, opts));
  if (result) {
    showModal('转换完成', `
      <div class="stat"><span class="stat-label">图片数量</span><span class="stat-value">${paths.length} 张</span></div>
      <div class="stat"><span class="stat-label">PDF 页数</span><span class="stat-value">${result.pages} 页</span></div>
      <div class="stat"><span class="stat-label">输出大小</span><span class="stat-value">${formatSize(result.size)}</span></div>
      <div class="stat"><span class="stat-label">保存到</span><span class="stat-value" style="max-width:240px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(basename(result.outputPath))}</span></div>
    `, { openFolder: result.outputPath });
    toast('转换完成', 'success');
  }
};

// 拖拽支持：把单个 PDF 拖到各功能源文件行（压缩/加密/解密/水印）
setupDropzone($('#compress-input').parentElement, (paths) => {
  const p = paths[0];
  compressState.input = p;
  $('#compress-input').value = p;
  api.getFileInfo(p).then(info => {
    if (info) {
      $('#compress-orig-size').textContent = formatSize(info.size);
      $('#compress-orig-info').style.display = 'block';
    }
    checkCompressReady();
  });
}, { accept: ['.pdf'], multiple: false });

setupDropzone($('#encrypt-input').parentElement, (paths) => {
  encryptState.input = paths[0];
  $('#encrypt-input').value = paths[0];
  checkEncryptReady();
}, { accept: ['.pdf'], multiple: false });

setupDropzone($('#decrypt-input').parentElement, (paths) => {
  decryptState.input = paths[0];
  $('#decrypt-input').value = paths[0];
  checkDecryptReady();
}, { accept: ['.pdf'], multiple: false });

setupDropzone($('#wm-input').parentElement, (paths) => {
  wmState.input = paths[0];
  $('#wm-input').value = paths[0];
  checkWmReady();
}, { accept: ['.pdf'], multiple: false });

// 初始化
setStatus('就绪');
