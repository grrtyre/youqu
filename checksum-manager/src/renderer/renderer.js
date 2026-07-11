'use strict';
// 校验管家 - 渲染进程
// 处理视图切换、拖放、哈希计算、校验、历史记录

const ALG_LABELS = {
  md5: 'MD5', sha1: 'SHA1', sha256: 'SHA256', sha512: 'SHA512', crc32: 'CRC32'
};
const ALG_ORDER = ['md5', 'sha1', 'sha256', 'sha512', 'crc32'];

const state = {
  mode: 'single',        // single | batch
  view: 'compute',       // compute | verify | history | help
  files: [],             // [{filePath, name, size, hashes, progress, error, expected, algorithm, result}]
  history: []
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ====== 工具函数 ======
function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : (v >= 10 ? 1 : 2))} ${units[i]}`;
}

function formatTime(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function compareHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function guessAlgorithm(hash) {
  if (typeof hash !== 'string') return null;
  const len = hash.trim().length;
  switch (len) {
    case 8: return 'crc32';
    case 32: return 'md5';
    case 40: return 'sha1';
    case 64: return 'sha256';
    case 128: return 'sha512';
    default: return null;
  }
}

function extractHashFromText(text) {
  if (typeof text !== 'string') return null;
  const re = /\b([0-9a-fA-F]{8}|[0-9a-fA-F]{32}|[0-9a-fA-F]{40}|[0-9a-fA-F]{64}|[0-9a-fA-F]{128})\b/;
  const m = text.match(re);
  if (!m) return null;
  return { hash: m[1], algorithm: guessAlgorithm(m[1]) };
}

function toast(msg) {
  const wrap = $('#toastWrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'all 0.25s ease';
    setTimeout(() => el.remove(), 280);
  }, 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) { }
    ta.remove();
    return true;
  }
}

// ====== 图标 SVG ======
const ICONS = {
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" opacity="0.9"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
};

// ====== 渲染入口 ======
function render() {
  const main = $('#main');
  main.innerHTML = '';

  if (state.view === 'compute' || state.view === 'verify') {
    renderCompute(main);
  } else if (state.view === 'history') {
    renderHistory(main);
  } else if (state.view === 'help') {
    renderHelp(main);
  }

  // 更新导航激活态
  $$('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === state.view);
  });
}

// ====== 计算视图 ======
function renderCompute(main) {
  if (state.files.length === 0) {
    main.innerHTML = `
      <div class="dropzone" id="dropzone">
        <div class="icon">${ICONS.upload}</div>
        <div class="dz-title">拖放文件到这里</div>
        <div class="dz-hint">或点击下方按钮选择文件 · 支持任意类型与大小</div>
        <div class="dz-btn">选择文件</div>
      </div>
    `;
    const dz = $('#dropzone', main);
    dz.addEventListener('click', () => pickFiles());
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files || []);
      handleDroppedFiles(files);
    });
    return;
  }

  // 批量工具栏
  const toolbar = document.createElement('div');
  toolbar.className = 'batch-toolbar';
  toolbar.innerHTML = `
    <div class="count">共 <b>${state.files.length}</b> 个文件</div>
    <div class="spacer"></div>
    <button class="btn primary" id="addMoreBtn">+ 添加文件</button>
    <button class="btn ghost" id="copyAllBtn">复制全部哈希</button>
    <button class="btn ghost" id="exportBtn">导出结果</button>
    <button class="btn ghost danger" id="clearBtn">清空</button>
  `;
  main.appendChild(toolbar);

  // 文件卡片列表
  const list = document.createElement('div');
  list.className = 'file-list';
  main.appendChild(list);

  for (let i = 0; i < state.files.length; i++) {
    list.appendChild(renderFileCard(state.files[i], i));
  }

  // 提示卡片（填充空白 + 引导）
  const tips = document.createElement('div');
  tips.className = 'tips-card';
  tips.innerHTML = `
    <div class="tips-title">使用提示</div>
    <div class="tips-list">
      <div class="tip-item"><span class="tip-num">1</span><span>拖放文件到窗口任意位置即可开始计算</span></div>
      <div class="tip-item"><span class="tip-num">2</span><span>切换到「哈希校验」视图，粘贴官方哈希值自动比对</span></div>
      <div class="tip-item"><span class="tip-num">3</span><span>点击 SHA512 等长哈希值可展开/收起完整内容</span></div>
      <div class="tip-item"><span class="tip-num">4</span><span>所有计算在本地完成，文件内容不会上传</span></div>
    </div>
  `;
  main.appendChild(tips);

  // 绑定工具栏事件
  $('#addMoreBtn', main).addEventListener('click', () => pickFiles());
  $('#clearBtn', main).addEventListener('click', () => {
    state.files = [];
    render();
  });
  $('#exportBtn', main).addEventListener('click', () => exportResults());
  $('#copyAllBtn', main).addEventListener('click', async () => {
    const lines = [];
    for (const it of state.files) {
      if (!it.hashes) continue;
      lines.push(`# ${it.name}`);
      for (const alg of ALG_ORDER) {
        if (it.hashes[alg]) lines.push(`${alg.toUpperCase()}: ${it.hashes[alg]}`);
      }
      lines.push('');
    }
    if (lines.length === 0) { toast('暂无可复制的哈希'); return; }
    await copyText(lines.join('\n'));
    toast('已复制全部哈希值');
  });
}

function renderFileCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.dataset.idx = idx;

  const hasHashes = item.hashes && !item.error;
  const verifying = state.view === 'verify';

  let hashRows = '';
  if (item.error) {
    hashRows = `<div class="hash-row"><div class="hash-value muted" style="color:var(--danger)">读取失败：${item.error}</div></div>`;
  } else if (!hasHashes) {
    hashRows = `
      <div class="hash-list">
        <div class="hash-row"><div class="hash-value muted">计算中…</div></div>
        <div class="progress-bar"><div class="fill" style="width:${Math.round((item.progress || 0) * 100)}%"></div></div>
      </div>`;
  } else {
    hashRows = '<div class="hash-section-label">哈希结果</div><div class="hash-list">';
    for (const alg of ALG_ORDER) {
      if (!item.hashes[alg]) continue;
      const isMatchTarget = verifying && item.algorithm === alg;
      let extra = '';
      if (isMatchTarget && item.result === 'pass') extra = ' style="color:#1c8b3d;font-weight:600"';
      if (isMatchTarget && item.result === 'fail') extra = ' style="color:#c8281d;font-weight:600"';
      const val = item.hashes[alg];
      const isLong = val.length > 64;
      const collapsed = isLong ? ' collapsed' : '';
      hashRows += `
        <div class="hash-row alg-${alg}">
          <div class="hash-label">${ALG_LABELS[alg]}</div>
          <div class="hash-value${collapsed}"${extra} title="${isLong ? '点击展开/收起完整内容' : ''}">${val}</div>
          <button class="copy-btn" data-alg="${alg}" title="复制">${ICONS.copy}</button>
        </div>`;
    }
    hashRows += '</div>';

    // 进度条（已完成的去掉）
    if (item.progress !== undefined && item.progress < 1) {
      hashRows = `<div class="progress-bar"><div class="fill" style="width:${Math.round(item.progress * 100)}%"></div></div>` + hashRows;
    }

    // 校验视图：追加输入框
    if (verifying) {
      const detected = item.expected ? '' : (item.algorithm ? `（自动识别：${ALG_LABELS[item.algorithm]}）` : '（粘贴哈希值，自动识别算法）');
      hashRows += `
        <div class="verify-box">
          <div class="vlabel">
            <span>输入期望哈希值进行比对</span>
            <span class="auto" id="autoHint${idx}">${detected}</span>
          </div>
          <input class="verify-input" placeholder="粘贴期望的 MD5 / SHA1 / SHA256 / SHA512 / CRC32..." value="${item.expected || ''}" />
          ${renderVerifyResult(item)}
        </div>`;
    }
  }

  card.innerHTML = `
    <div class="file-head">
      <div class="file-icon">${ICONS.file}</div>
      <div class="file-meta">
        <div class="file-name" title="${item.name}">${item.name}</div>
        <div class="file-info">
          <span>${formatSize(item.size || 0)}</span>
          <span class="dot"></span>
          <span>${item.filePath || ''}</span>
        </div>
      </div>
      <div class="file-actions">
        <button class="icon-btn" data-act="remove" title="移除">${ICONS.trash}</button>
      </div>
    </div>
    ${hashRows}
  `;

  // 绑定复制
  $$('.copy-btn', card).forEach(btn => {
    btn.addEventListener('click', async () => {
      const alg = btn.dataset.alg;
      const v = item.hashes[alg];
      if (!v) return;
      await copyText(v);
      const old = btn.innerHTML;
      btn.innerHTML = ICONS.check;
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = old; btn.classList.remove('copied'); }, 1200);
    });
  });

  // 长哈希点击展开/收起
  $$('.hash-value.collapsed', card).forEach(val => {
    val.addEventListener('click', () => {
      val.classList.toggle('collapsed');
    });
  });

  // 移除
  $('[data-act="remove"]', card).addEventListener('click', () => {
    state.files.splice(idx, 1);
    render();
  });

  // 校验输入
  const input = $('.verify-input', card);
  if (input) {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      item.expected = val;
      const detected = guessAlgorithm(val);
      if (detected) {
        item.algorithm = detected;
        const hint = $(`#autoHint${idx}`, card);
        if (hint) hint.textContent = `（自动识别：${ALG_LABELS[detected]}）`;
        if (item.hashes && item.hashes[detected]) {
          item.result = compareHash(val, item.hashes[detected]) ? 'pass' : 'fail';
        } else {
          item.result = null;
        }
      } else {
        item.algorithm = null;
        item.result = null;
        const hint = $(`#autoHint${idx}`, card);
        if (hint) hint.textContent = '（粘贴哈希值，自动识别算法）';
      }
      // 局部刷新结果区
      const oldRes = $('.verify-result', card);
      const newRes = document.createElement('div');
      newRes.innerHTML = renderVerifyResult(item);
      if (oldRes) oldRes.replaceWith(newRes.firstElementChild);
      else {
        const box = $('.verify-box', card);
        if (box) box.appendChild(newRes.firstElementChild);
      }
      // 高亮对应算法行
      $$('.hash-row', card).forEach(row => {
        const lbl = $('.hash-label', row);
        if (!lbl) return;
        const alg = Object.keys(ALG_LABELS).find(k => ALG_LABELS[k] === lbl.textContent);
        const val = $('.hash-value', row);
        if (!val) return;
        val.style.color = '';
        val.style.fontWeight = '';
        if (detected === alg && item.result === 'pass') {
          val.style.color = '#1c8b3d'; val.style.fontWeight = '600';
        } else if (detected === alg && item.result === 'fail') {
          val.style.color = '#c8281d'; val.style.fontWeight = '600';
        }
      });
    });
    // 支持粘贴整段文本（含文件名），自动抽取 hash
    input.addEventListener('paste', () => {
      setTimeout(() => {
        const val = input.value;
        if (!guessAlgorithm(val)) {
          const ex = extractHashFromText(val);
          if (ex) { input.value = ex.hash; input.dispatchEvent(new Event('input')); }
        }
      }, 0);
    });
  }

  return card;
}

function renderVerifyResult(item) {
  if (!item.result) return '';
  if (item.result === 'pass') {
    return `<div class="verify-result pass">${ICONS.check}<span>校验通过 · 哈希完全匹配</span></div>`;
  }
  return `<div class="verify-result fail">${ICONS.cross}<span>校验失败 · 哈希不匹配</span></div>`;
}

// ====== 历史视图 ======
function renderHistory(main) {
  if (state.history.length === 0) {
    main.innerHTML = `
      <div class="empty-state">
        ${ICONS.empty}
        <div class="es-title">暂无历史记录</div>
        <div class="es-hint">完成文件校验后会自动保存到这里</div>
      </div>`;
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'history-list';
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    const item = document.createElement('div');
    item.className = 'history-item';
    const sha = h.hashes && (h.hashes.sha256 || h.hashes.md5 || '');
    item.innerHTML = `
      <div class="h-icon">${ICONS.file}</div>
      <div class="h-info">
        <div class="h-name" title="${h.name}">${h.name}</div>
        <div class="h-sub">
          <span>${formatSize(h.size || 0)}</span>
          <span class="dot" style="width:3px;height:3px;border-radius:50%;background:var(--text-3)"></span>
          <span>${formatTime(h.time || 0)}</span>
          ${sha ? `<code>${sha.slice(0, 16)}…</code>` : ''}
        </div>
      </div>
      <button class="icon-btn" data-act="copy" title="复制 SHA256">${ICONS.copy}</button>
      <button class="icon-btn" data-act="remove" title="删除">${ICONS.trash}</button>
    `;
    $('[data-act="copy"]', item).addEventListener('click', async () => {
      const v = (h.hashes && (h.hashes.sha256 || h.hashes.md5)) || '';
      if (v) { await copyText(v); toast('已复制 ' + (h.hashes.sha256 ? 'SHA256' : 'MD5')); }
    });
    $('[data-act="remove"]', item).addEventListener('click', () => {
      state.history.splice(i, 1);
      saveHistory();
      render();
    });
    wrap.appendChild(item);
  }
  main.appendChild(wrap);

  const clearBar = document.createElement('div');
  clearBar.className = 'batch-toolbar';
  clearBar.style.marginTop = '16px';
  clearBar.innerHTML = `
    <div class="spacer"></div>
    <button class="btn danger-ghost" id="clearHistory">清空全部历史</button>
  `;
  main.appendChild(clearBar);
  $('#clearHistory', main).addEventListener('click', () => {
    state.history = [];
    saveHistory();
    render();
  });
}

// ====== 帮助视图 ======
function renderHelp(main) {
  main.innerHTML = `
    <div style="max-width:680px;line-height:1.7;color:var(--text)">
      <h2 style="font-size:20px;font-weight:600;margin-bottom:16px">使用帮助</h2>
      <div style="background:var(--panel-2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px">1. 计算哈希</div>
        <div style="color:var(--text-2);font-size:13.5px">
          在「计算校验」视图，拖放文件或点击选择，软件会自动计算 MD5、SHA1、SHA256、SHA512、CRC32 五种哈希值。
          点击右侧「复制」按钮可复制到剪贴板。
        </div>
      </div>
      <div style="background:var(--panel-2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px">2. 校验文件完整性</div>
        <div style="color:var(--text-2);font-size:13.5px">
          切换到「哈希校验」视图，添加文件后，在期望哈希值输入框中粘贴官方提供的哈希。
          软件会自动识别算法类型（依据长度）并实时比对，绿色表示匹配，红色表示不匹配。
        </div>
      </div>
      <div style="background:var(--panel-2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px">3. 批量处理</div>
        <div style="color:var(--text-2);font-size:13.5px">
          顶部切换到「批量」模式，可同时添加多个文件，统一计算与导出。支持导出为纯文本结果。
        </div>
      </div>
      <div style="background:var(--panel-2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:16px">
        <div style="font-weight:600;margin-bottom:8px">4. 算法长度对照</div>
        <div style="color:var(--text-2);font-size:13px;font-family:'SF Mono',Menlo,monospace">
          CRC32 → 8 位　MD5 → 32 位　SHA1 → 40 位　SHA256 → 64 位　SHA512 → 128 位
        </div>
      </div>
      <div style="background:var(--accent-soft);border:1px solid rgba(0,122,255,0.15);border-radius:12px;padding:16px 20px;font-size:13px;color:var(--text-2)">
        所有计算在本地完成，文件内容不会上传到任何服务器。
      </div>
    </div>
  `;
}

// ====== 文件选择与计算 ======
async function pickFiles() {
  if (state.mode === 'single') {
    const p = await window.checksumAPI.openFile();
    if (p) await addFiles([p]);
  } else {
    const ps = await window.checksumAPI.openFiles();
    if (ps && ps.length) await addFiles(ps);
  }
}

async function handleDroppedFiles(fileList) {
  // Electron 拖放：file.path 在新版可用 file.filePath
  const paths = [];
  for (const f of fileList) {
    const p = f.path || f.filePath;
    if (p) paths.push(p);
  }
  if (paths.length === 0) {
    // 降级到对话框
    await pickFiles();
    return;
  }
  await addFiles(paths);
}

async function addFiles(paths) {
  if (state.mode === 'single' && paths.length > 0) {
    state.files = [];
  }
  for (const p of paths) {
    const stat = await window.checksumAPI.statFile(p);
    if (!stat) continue;
    const item = {
      filePath: p,
      name: stat.name,
      size: stat.size,
      mtime: stat.mtime,
      hashes: null,
      progress: 0,
      error: null,
      expected: '',
      algorithm: null,
      result: null
    };
    state.files.push(item);
  }
  render();
  // 依次计算（避免高并发抢 IO）
  for (const item of state.files) {
    if (item.hashes || item.error) continue;
    computeOne(item);
  }
}

async function computeOne(item) {
  try {
    const res = await window.checksumAPI.computeHash(item.filePath);
    if (res && res.error) {
      item.error = res.error;
    } else if (res) {
      item.hashes = res.hashes;
      item.size = res.size;
      // 写入历史
      pushHistory({
        name: res.name,
        filePath: res.filePath,
        size: res.size,
        time: Date.now(),
        hashes: res.hashes
      });
    }
  } catch (e) {
    item.error = String(e && e.message ? e.message : e);
  }
  render();
}

// ====== 历史持久化 ======
async function loadHistory() {
  try {
    const arr = await window.checksumAPI.loadHistory();
    state.history = Array.isArray(arr) ? arr : [];
  } catch (_) { state.history = []; }
  updateHistoryBadge();
}

async function saveHistory() {
  try { await window.checksumAPI.saveHistory(state.history); } catch (_) { }
  updateHistoryBadge();
}

function pushHistory(rec) {
  // 去重：同路径同 size 覆盖
  const idx = state.history.findIndex(h => h.filePath === rec.filePath && h.size === rec.size);
  if (idx !== -1) state.history.splice(idx, 1);
  state.history.push(rec);
  if (state.history.length > 50) state.history = state.history.slice(-50);
  saveHistory();
}

function updateHistoryBadge() {
  const b = $('#historyBadge');
  if (!b) return;
  if (state.history.length > 0) {
    b.style.display = 'inline-block';
    b.textContent = state.history.length;
  } else {
    b.style.display = 'none';
  }
}

// ====== 导出 ======
function exportResults() {
  if (state.files.length === 0) { toast('没有可导出的结果'); return; }
  const lines = [];
  for (const it of state.files) {
    lines.push('----------------------------------------------');
    lines.push(`文件: ${it.name}`);
    lines.push(`路径: ${it.filePath}`);
    lines.push(`大小: ${formatSize(it.size || 0)}`);
    if (it.hashes) {
      for (const alg of ALG_ORDER) {
        if (it.hashes[alg]) lines.push(`${ALG_LABELS[alg]}: ${it.hashes[alg]}`);
      }
      if (state.view === 'verify' && it.expected && it.algorithm) {
        const ok = compareHash(it.expected, it.hashes[it.algorithm]);
        lines.push(`校验(${ALG_LABELS[it.algorithm]}): ${ok ? '✓ 通过' : '✗ 不匹配'}`);
      }
    } else if (it.error) {
      lines.push(`错误: ${it.error}`);
    }
    lines.push('');
  }
  const text = lines.join('\n');
  // 复制到剪贴板
  copyText(text).then(() => toast('结果已复制到剪贴板'));
}

// ====== 事件绑定 ======
function bindEvents() {
  // 模式标签
  $('#modeTabs').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    state.mode = t.dataset.mode;
    $$('#modeTabs .tab').forEach(x => x.classList.toggle('active', x.dataset.mode === state.mode));
    // 切换模式时清空，避免混淆
    if (state.mode === 'single' && state.files.length > 1) {
      state.files = state.files.slice(0, 1);
    }
    render();
  });

  // 左侧导航
  $$('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const v = el.dataset.view;
      state.view = v;
      // verify 视图复用 compute 的文件，但显示输入框
      render();
    });
  });

  // 进度
  window.checksumAPI.onProgress((payload) => {
    const item = state.files.find(f => f.filePath === payload.filePath);
    if (item) {
      item.progress = payload.ratio;
      // 局部更新进度条
      const idx = state.files.indexOf(item);
      const card = $(`.file-card[data-idx="${idx}"]`);
      if (card) {
        const fill = $('.progress-bar .fill', card);
        if (fill) fill.style.width = `${Math.round(payload.ratio * 100)}%`;
      }
    }
  });

  // 全局拖放（在 dropzone 之外也接收）
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
      e.preventDefault();
    }
  });
  document.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      e.preventDefault();
      handleDroppedFiles(Array.from(e.dataTransfer.files));
    }
  });
}

// ====== 演示数据（首次启动展示，用户清空后不再出现） ======
function seedDemoIfEmpty() {
  if (state.files.length > 0) return;
  state.mode = 'batch';
  state.files = [
    {
      filePath: 'C:\\Users\\Demo\\Downloads\\ubuntu-24.04-desktop-amd64.iso',
      name: 'ubuntu-24.04-desktop-amd64.iso',
      size: 5368709120,
      mtime: Date.now(),
      hashes: {
        md5: 'b3da4d8ef0cf4bedb827ac629bb8cda0',
        sha1: 'cbda14bb10bb02aa4e389425d2cfe78db203434c',
        sha256: 'be0ed1394fd7f748fa39742616a3463dbe6a57a551a558e4287ae946d13e7c00',
        sha512: '386b7862b45f750a36e2d2d8b8bc37a9ba62cf53d93973b01527cde62a8b361414b9f4cd188a4bed37327c60ce588166a87bee1ec5d5fa7eb167cfa758b86e8c',
        crc32: '3c60e3b9'
      },
      progress: 1,
      error: null,
      expected: '',
      algorithm: null,
      result: null
    },
    {
      filePath: 'D:\\Tools\\HashCheck.exe',
      name: 'HashCheck.exe',
      size: 2456320,
      mtime: Date.now() - 86400000,
      hashes: {
        md5: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
        sha1: '0123456789abcdef0123456789abcdef01234567',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        sha512: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
        crc32: 'd87f7e0c'
      },
      progress: 1,
      error: null,
      expected: '',
      algorithm: null,
      result: null
    }
  ];
}

// ====== 启动 ======
(async function init() {
  bindEvents();
  await loadHistory();
  seedDemoIfEmpty();
  // 同步模式标签激活态
  $$('#modeTabs .tab').forEach(x => x.classList.toggle('active', x.dataset.mode === state.mode));
  render();
})();
