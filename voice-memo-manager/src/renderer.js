// renderer.js - 语音备忘录管理器 渲染进程逻辑
// 苹果白风格 / iOS Voice Memos 风格交互

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ========== 状态 ==========
const state = {
  recordings: [],            // 全部录音元数据
  filtered: [],              // 过滤后的列表
  expandedId: null,          // 当前展开的录音 id
  playingId: null,           // 当前播放的录音 id
  audioEl: null,             // 当前 <audio>
  currentlyEditingId: null,  // 当前在重命名的 id
  // 录音状态
  isRecording: false,
  mediaRecorder: null,
  chunks: [],
  startTime: 0,
  timerInterval: null,
  analyser: null,
  audioContext: null,
  stream: null,
  waveInterval: null,
  searchQuery: ''
};

// ========== UI 工具 ==========
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function fmtDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return '今天 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return '昨天 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ========== 波形（录音时） ==========
function buildWaveBars(n) {
  const wave = $('#wave');
  wave.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const b = document.createElement('div');
    b.className = 'wave-bar';
    wave.appendChild(b);
  }
}

function startWaveAnimation() {
  const bars = $$('.wave-bar');
  // 用 AnalyserNode 实时驱动
  if (state.analyser) {
    const bufLen = state.analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    state.waveInterval = setInterval(() => {
      state.analyser.getByteFrequencyData(data);
      // 取 32 个分段
      bars.forEach((bar, i) => {
        const idx = Math.floor(i * bufLen / bars.length);
        const v = data[idx] || 0;
        const h = 6 + (v / 255) * 40;
        bar.style.height = h + 'px';
      });
    }, 80);
  } else {
    // 兜底：随机起伏
    state.waveInterval = setInterval(() => {
      bars.forEach((bar) => {
        const h = 6 + Math.random() * 36;
        bar.style.height = h + 'px';
      });
    }, 100);
  }
}

function stopWaveAnimation() {
  clearInterval(state.waveInterval);
  state.waveInterval = null;
  $$('.wave-bar').forEach((b) => b.style.height = '6px');
}

// ========== 录音 ==========
async function toggleRecord() {
  if (state.isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.stream = stream;
    state.chunks = [];

    // AudioContext + AnalyserNode 用于波形
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = state.audioContext.createMediaStreamSource(stream);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;
    source.connect(state.analyser);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
                   : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                   : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg'
                   : '';
    const mr = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined);
    state.mediaRecorder = mr;
    mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) state.chunks.push(e.data); };
    mr.onstop = onRecorderStop;
    mr.start();

    state.isRecording = true;
    state.startTime = Date.now();
    $('#recordBtn').classList.add('recording');
    $('#timer').classList.add('recording');
    $('#recordHint').textContent = '录音中... 再次点击结束';
    $('#wave').classList.add('recording');

    buildWaveBars(32);
    startWaveAnimation();

    state.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      $('#timer').textContent = fmtTime(elapsed);
    }, 250);
  } catch (e) {
    console.error(e);
    toast('无法访问麦克风：' + (e.message || e.name));
  }
}

function stopRecording() {
  if (!state.isRecording) return;
  try { state.mediaRecorder && state.mediaRecorder.stop(); } catch (e) {}
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  stopWaveAnimation();
  // 关闭 mic 流
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  if (state.audioContext) {
    try { state.audioContext.close(); } catch (e) {}
    state.audioContext = null;
  }
  state.analyser = null;
  state.isRecording = false;
  $('#recordBtn').classList.remove('recording');
  $('#timer').classList.remove('recording');
  $('#recordHint').textContent = '点击开始录音';
  $('#wave').classList.remove('recording');
  $('#timer').textContent = '00:00';
}

async function onRecorderStop() {
  const duration = Math.floor((Date.now() - state.startTime) / 1000);
  const blob = new Blob(state.chunks, { type: state.mediaRecorder.mimeType || 'audio/webm' });
  // 转 base64
  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64 = reader.result.split(',')[1];
    const mimeType = blob.type;
    const res = await window.api.saveRecording({
      bufferBase64: base64,
      mimeType,
      title: '录音 ' + new Date().toLocaleString('zh-CN', { hour12: false })
    });
    if (res.ok) {
      // 写入时长
      await window.api.updateDuration({ id: res.item.id, duration });
      toast('录音已保存 · ' + fmtTime(duration));
      await loadList();
    } else {
      toast('保存失败：' + res.error);
    }
  };
  reader.readAsDataURL(blob);
}

// ========== 列表 ==========
async function loadList() {
  const res = await window.api.list();
  if (!res.ok) {
    toast('加载失败：' + res.error);
    return;
  }
  state.recordings = res.recordings || [];
  applyFilter();
}

function applyFilter() {
  const q = state.searchQuery.trim().toLowerCase();
  state.filtered = q
    ? state.recordings.filter((r) => (r.title || '').toLowerCase().includes(q))
    : state.recordings.slice();
  renderList();
}

function renderList() {
  const list = $('#list');
  const empty = $('#empty');
  $('#count').textContent = state.filtered.length + ' 条';

  if (state.filtered.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = state.filtered.map((r) => renderItem(r)).join('');
  // 绑定事件
  list.querySelectorAll('.memo-item').forEach((item) => {
    const id = item.dataset.id;
    item.querySelector('.memo-row').addEventListener('click', (e) => {
      if (e.target.closest('.memo-play') || e.target.closest('.title-edit') || e.target.closest('.memo-chevron')) return;
      toggleExpand(id);
    });
    item.querySelector('.memo-play').addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay(id);
    });
    const pb = item.querySelector('.progress-bar');
    if (pb) {
      pb.addEventListener('click', (e) => {
        if (state.playingId !== id || !state.audioEl) return;
        const rect = pb.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        if (state.audioEl.duration) state.audioEl.currentTime = ratio * state.audioEl.duration;
      });
    }
    // 展开操作按钮（使用 if 防御 null）
    const renameBtn = item.querySelector('.act-rename');
    if (renameBtn) renameBtn.addEventListener('click', (e) => { e.stopPropagation(); startRename(id); });
    const revealBtn2 = item.querySelector('.expand-reveal');
    if (revealBtn2) revealBtn2.addEventListener('click', (e) => { e.stopPropagation(); window.api.reveal({ id }); });
    const saveBtn = item.querySelector('.expand-save');
    if (saveBtn) saveBtn.addEventListener('click', (e) => { e.stopPropagation(); commitRename(id); });
    const cancelBtn = item.querySelector('.expand-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); cancelRename(id); });
    const playBtn2 = item.querySelector('.expand-play');
    if (playBtn2) playBtn2.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(id); });
    const delBtn2 = item.querySelector('.expand-delete');
    if (delBtn2) delBtn2.addEventListener('click', (e) => { e.stopPropagation(); confirmDelete(id); });
  });
}

function renderItem(r) {
  const expanded = state.expandedId === r.id;
  const playing = state.playingId === r.id;
  const editing = state.currentlyEditingId === r.id;
  const playIcon = playing
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

  const titleHtml = editing
    ? `<input class="title-edit" id="edit-${r.id}" value="${escapeHtml(r.title)}" />`
    : `<div class="memo-title">${escapeHtml(r.title)}</div>`;

  let expandHtml = '';
  if (expanded) {
    expandHtml = `
      <div class="memo-expand">
        <div class="progress-row">
          <span class="progress-time" id="cur-${r.id}">00:00</span>
          <div class="progress-bar"><div class="progress-fill" id="fill-${r.id}"></div></div>
          <span class="progress-time" id="dur-${r.id}">${fmtTime(r.duration)}</span>
        </div>
        <div class="expand-actions">
          ${editing
            ? `<button class="expand-btn expand-save"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>保存</button>
               <button class="expand-btn expand-cancel">取消</button>`
            : `<button class="expand-btn expand-play">${playIcon}播放</button>
               <button class="expand-btn act-rename"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>重命名</button>
               <button class="expand-btn expand-reveal"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>文件夹</button>
               <button class="expand-btn danger expand-delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>删除</button>`
          }
        </div>
      </div>`;
  }

  return `
    <div class="memo-item ${expanded ? 'expanded' : ''}" data-id="${r.id}">
      <div class="memo-row">
        <button class="memo-play" title="${playing ? '暂停' : '播放'}">${playIcon}</button>
        <div class="memo-info">${titleHtml}
          <div class="memo-meta">
            <span>${fmtDate(r.createdAt)}</span>
            <span>${fmtTime(r.duration)}</span>
            <span>${fmtSize(r.size)}</span>
          </div>
        </div>
        <div class="memo-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${expanded ? 'chev-expanded' : ''}"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
      ${expandHtml}
    </div>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function toggleExpand(id) {
  if (state.expandedId === id) {
    state.expandedId = null;
    state.currentlyEditingId = null;
  } else {
    state.expandedId = id;
    state.currentlyEditingId = null;
  }
  renderList();
  // 如果在播放且切换到其它项，保持播放
}

// ========== 播放 ==========
async function togglePlay(id) {
  // 同一项：暂停 / 继续
  if (state.playingId === id && state.audioEl) {
    if (state.audioEl.paused) {
      state.audioEl.play();
    } else {
      state.audioEl.pause();
    }
    return;
  }
  // 切换到新项
  if (state.audioEl) {
    state.audioEl.pause();
    state.audioEl.src = '';
    state.audioEl = null;
  }
  const res = await window.api.read({ id });
  if (!res.ok) {
    toast('读取失败：' + res.error);
    return;
  }
  const blob = new Blob([base64ToBuffer(res.base64)], { type: res.mimeType });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.mime = res.mimeType;
  state.audioEl = audio;
  state.playingId = id;
  state.expandedId = id; // 自动展开
  renderList();

  const curEl = $('#cur-' + id);
  const durEl = $('#dur-' + id);
  const fillEl = $('#fill-' + id);

  audio.addEventListener('timeupdate', () => {
    if (curEl) curEl.textContent = fmtTime(audio.currentTime);
    if (fillEl && audio.duration) fillEl.style.width = (audio.currentTime / audio.duration * 100) + '%';
  });
  audio.addEventListener('loadedmetadata', () => {
    if (durEl && audio.duration && !isNaN(audio.duration)) durEl.textContent = fmtTime(audio.duration);
  });
  audio.addEventListener('ended', () => {
    state.playingId = null;
    state.audioEl = null;
    renderList();
  });
  audio.play().catch((e) => toast('播放失败：' + e.message));
}

function base64ToBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ========== 重命名 ==========
function startRename(id) {
  state.currentlyEditingId = id;
  state.expandedId = id;
  renderList();
  const input = $('#edit-' + id);
  if (input) {
    input.focus();
    input.select();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitRename(id);
      else if (e.key === 'Escape') cancelRename(id);
    });
  }
}

async function commitRename(id) {
  const input = $('#edit-' + id);
  if (!input) return;
  const title = input.value.trim() || '未命名录音';
  const res = await window.api.rename({ id, title });
  if (res.ok) {
    const r = state.recordings.find((x) => x.id === id);
    if (r) r.title = title;
    state.currentlyEditingId = null;
    renderList();
    toast('已重命名');
  } else {
    toast('重命名失败：' + res.error);
  }
}

function cancelRename(id) {
  state.currentlyEditingId = null;
  renderList();
}

// ========== 删除 ==========
async function confirmDelete(id) {
  const r = state.recordings.find((x) => x.id === id);
  if (!r) return;
  // 简化：直接删除（避免引入 confirm 弹窗打断）
  if (state.playingId === id) {
    if (state.audioEl) { state.audioEl.pause(); state.audioEl = null; }
    state.playingId = null;
  }
  const res = await window.api.delete({ id });
  if (res.ok) {
    state.recordings = state.recordings.filter((x) => x.id !== id);
    if (state.expandedId === id) state.expandedId = null;
    applyFilter();
    toast('已删除');
  } else {
    toast('删除失败：' + res.error);
  }
}

// ========== 事件绑定 ==========
$('#recordBtn').addEventListener('click', toggleRecord);
$('#openDirBtn').addEventListener('click', () => window.api && window.api.openDir && window.api.openDir());
$('#searchInput').addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  applyFilter();
});

// 全局快捷键（在渲染进程内捕获，仅当窗口聚焦时）
document.addEventListener('keydown', (e) => {
  // 空格：开始/停止录音（无输入聚焦时）
  if (e.code === 'Space' && !e.target.matches('input, textarea')) {
    e.preventDefault();
    toggleRecord();
  }
  // ESC：取消重命名
  if (e.key === 'Escape' && state.currentlyEditingId) {
    cancelRename(state.currentlyEditingId);
  }
});

// ========== Demo 数据（仅 MIMO_CAPTURE 截图模式使用，展示填充效果） ==========
const DEMO_RECORDINGS = [
  { id: 'demo1', title: '产品周会 · 需求评审', fileName: 'demo1.webm', size: 1843200, createdAt: Date.now() - 1000 * 60 * 35, duration: 1842 },
  { id: 'demo2', title: '英语口语练习 - 第 12 课', fileName: 'demo2.webm', size: 956000, createdAt: Date.now() - 1000 * 60 * 60 * 3, duration: 632 },
  { id: 'demo3', title: '凌晨灵感 · 想到的播客选题', fileName: 'demo3.webm', size: 412000, createdAt: Date.now() - 1000 * 60 * 60 * 26, duration: 248 },
  { id: 'demo4', title: '采访录音 · 张老师', fileName: 'demo4.webm', size: 2864000, createdAt: Date.now() - 1000 * 60 * 60 * 49, duration: 2956 },
  { id: 'demo5', title: '读书笔记 ·《思考快与慢》', fileName: 'demo5.webm', size: 678000, createdAt: Date.now() - 1000 * 60 * 60 * 72, duration: 412 }
];

// 初始化
buildWaveBars(48);
const isStandalone = !window.api;
const isCapture = window.api && window.api.isCaptureMode;
if (isStandalone || isCapture) {
  // 截图模式或独立 HTML 渲染：使用 demo 数据，不调用真实 IPC
  state.recordings = DEMO_RECORDINGS.slice();
  applyFilter();
  // 自动展开第一个，让截图更丰富
  setTimeout(() => {
    state.expandedId = 'demo1';
    applyFilter();
  }, 300);
} else {
  loadList();
}
