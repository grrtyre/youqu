// 录屏管家 - 渲染进程逻辑
// 注意：用 var 而非 const，避免与 contextBridge 暴露的 window.api 在全局作用域冲突
var api = window.api;

// 状态
// 通过 URL hash 同步检测 demo 模式（main.js 通过 loadFile({hash:'demo'}) 传入）
let demoMode = (location.hash === '#demo');
let sources = [];
let selectedSource = null;
let sourceType = 'screen';        // 'screen' | 'window'
let fps = 24;
let qualityLabel = '标准';
let isRecording = false;
let isPaused = false;
let mediaRecorder = null;
let chunks = [];
let timerStart = 0;
let timerInterval = null;
let elapsedBeforePause = 0;       // 暂停前累计秒数
let pauseStart = 0;
let audioContext = null;
let videoStream = null;
let micStream = null;
let systemStream = null;
let currentPreviewId = null;

// DOM
const $ = (id) => document.getElementById(id);
const sourceGrid = $('sourceGrid');
const optSystemAudio = $('optSystemAudio');
const optMic = $('optMic');
const timerEl = $('timer');
const recDot = $('recDot');
const recState = $('recState');
const statusHint = $('statusHint');
const btnRecord = $('btnRecord');
const btnPause = $('btnPause');
const btnCancel = $('btnCancel');
const hint = $('hint');
const historyList = $('historyList');
const historyCount = $('historyCount');
const previewModal = $('previewModal');
const previewVideo = $('previewVideo');
const previewTitle = $('previewTitle');

// ========== 工具函数 ==========
function fmtTime(sec) {
  sec = Math.floor(sec);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function fmtDate(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// ========== 源列表 ==========
async function loadSources() {
  sourceGrid.innerHTML = '<div class="source-loading">正在获取画面…</div>';
  const result = await api.getSources();
  if (result && result.ok === false) {
    sourceGrid.innerHTML = '<div class="source-loading">获取画面失败：' + (result.error || '') + '</div>';
    return;
  }
  sources = Array.isArray(result) ? result : [];
  renderSources();
}

function renderSources() {
  const list = sources.filter(s => {
    if (sourceType === 'screen') return s.id.startsWith('screen') || s.display_id;
    return s.id.startsWith('window') || !s.display_id;
  });
  // screen 类型可能都按 desktopCapturer 返回顺序，screen 在前 window 在后
  // 用名字兜底过滤
  let filtered;
  if (sourceType === 'screen') {
    filtered = sources.filter(s => /^screen/i.test(s.id) || s.display_id);
  } else {
    filtered = sources.filter(s => /^window/i.test(s.id) && !s.display_id);
  }
  if (!filtered.length) filtered = list;  // 兜底

  if (!filtered.length) {
    sourceGrid.innerHTML = '<div class="source-loading">未找到可用画面</div>';
    btnRecord.disabled = true;
    return;
  }
  sourceGrid.innerHTML = '';
  filtered.forEach(s => {
    const card = document.createElement('div');
    card.className = 'source-card' + (selectedSource && selectedSource.id === s.id ? ' selected' : '');
    const thumb = document.createElement('img');
    thumb.className = 'source-thumb';
    thumb.src = 'data:image/png;base64,' + s.thumbnail;
    thumb.alt = s.name;
    const name = document.createElement('div');
    name.className = 'source-name';
    if (s.icon) {
      const iconImg = document.createElement('img');
      iconImg.src = 'data:image/png;base64,' + s.icon;
      name.appendChild(iconImg);
    }
    const nameText = document.createElement('span');
    nameText.textContent = s.name;
    nameText.style.overflow = 'hidden';
    nameText.style.textOverflow = 'ellipsis';
    name.appendChild(nameText);
    const check = document.createElement('div');
    check.className = 'source-check';
    check.innerHTML = '<svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    card.appendChild(thumb);
    card.appendChild(name);
    card.appendChild(check);
    card.addEventListener('click', () => {
      selectedSource = s;
      renderSources();
      btnRecord.disabled = false;
    });
    sourceGrid.appendChild(card);
  });
  // 默认选第一个
  if (!selectedSource || !filtered.find(s => s.id === selectedSource.id)) {
    selectedSource = filtered[0];
    renderSources();
    btnRecord.disabled = false;
  }
}

// 切换 screen/window 标签
document.querySelectorAll('.source-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.source-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    sourceType = tab.dataset.type;
    selectedSource = null;
    renderSources();
  });
});

// 画质切换
document.querySelectorAll('.q-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    fps = parseInt(btn.dataset.fps, 10);
    qualityLabel = btn.dataset.label;
  });
});

// ========== 录制 ==========
function updateTimer() {
  let total = elapsedBeforePause;
  if (!isPaused) {
    total += Math.floor((Date.now() - timerStart) / 1000);
  }
  timerEl.textContent = fmtTime(total);
}

async function startRecording() {
  if (!selectedSource) {
    hint.textContent = '请先选择要录制的画面';
    return;
  }
  if (isRecording) return;
  try {
    chunks = [];
    elapsedBeforePause = 0;
    const sysAudio = optSystemAudio.checked;
    const mic = optMic.checked;

    // 1. 视频流（屏幕/窗口）
    videoStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedSource.id,
          maxWidth: 3840,
          maxHeight: 2160,
          maxFrameRate: fps
        }
      }
    });

    // 2. 音频流
    let mixedAudioTracks = [];
    audioContext = new AudioContext();
    const dest = audioContext.createMediaStreamDestination();
    let hasAudio = false;

    if (sysAudio) {
      try {
        systemStream = await navigator.mediaDevices.getUserMedia({
          audio: { mandatory: { chromeMediaSource: 'desktop' } },
          video: false
        });
        const sysSrc = audioContext.createMediaStreamSource(systemStream);
        sysSrc.connect(dest);
        hasAudio = true;
      } catch (e) {
        // 系统音频采集失败不致命，继续录制视频
        console.warn('系统音频采集失败：', e);
      }
    }
    if (mic) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const micSrc = audioContext.createMediaStreamSource(micStream);
        micSrc.connect(dest);
        hasAudio = true;
      } catch (e) {
        console.warn('麦克风采集失败：', e);
      }
    }
    if (hasAudio) {
      mixedAudioTracks = dest.stream.getAudioTracks();
    }

    // 3. 组合流
    const tracks = [...videoStream.getVideoTracks(), ...mixedAudioTracks];
    const combinedStream = new MediaStream(tracks);

    // 4. 选择 mimeType
    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    let mimeType = '';
    for (const m of mimeCandidates) {
      if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
    }

    mediaRecorder = new MediaRecorder(combinedStream, mimeType ? { mimeType, videoBitsPerSecond: 4_000_000 } : undefined);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      const duration = elapsedBeforePause + Math.floor((Date.now() - timerStart) / 1000);
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const buffer = await blob.arrayBuffer();
      const result = await api.saveRecording({
        buffer: buffer,
        duration: duration,
        size: blob.size,
        sourceName: selectedSource ? selectedSource.name : '屏幕',
        mimeType: mimeType
      });
      cleanupStreams();
      if (result && result.ok) {
        hint.textContent = '录制已保存到历史（' + fmtSize(blob.size) + '）';
        statusHint.textContent = '就绪';
      } else {
        hint.textContent = '保存失败：' + (result && result.error ? result.error : '未知错误');
        statusHint.textContent = '就绪';
      }
      resetRecordUI();
    };
    mediaRecorder.onerror = (e) => {
      hint.textContent = '录制出错：' + (e.error ? e.error.message : '未知');
    };

    mediaRecorder.start(1000);  // 每秒一个数据片
    isRecording = true;
    isPaused = false;
    timerStart = Date.now();
    timerInterval = setInterval(updateTimer, 250);
    api.setRecordingState(true);

    // UI 切换
    btnRecord.classList.add('recording');
    btnRecord.querySelector('.btn-rec-text').textContent = '停止录制';
    btnRecord.disabled = false;
    btnPause.disabled = false;
    btnCancel.disabled = false;
    btnPause.textContent = '暂停';
    recDot.classList.add('recording');
    recDot.classList.remove('paused');
    recState.textContent = '录制中';
    recState.classList.add('recording');
    recState.classList.remove('paused');
    statusHint.textContent = '录制中…';
    hint.textContent = '正在录制，再次点击「停止录制」或按 Ctrl+Shift+R 结束';
    // 录制中禁用源切换
    setControlsDisabled(true);
  } catch (e) {
    hint.textContent = '无法开始录制：' + (e && e.message ? e.message : e);
    cleanupStreams();
  }
}

function pauseRecording() {
  if (!mediaRecorder || !isRecording) return;
  if (!isPaused) {
    mediaRecorder.pause();
    isPaused = true;
    elapsedBeforePause += Math.floor((Date.now() - timerStart) / 1000);
    timerStart = 0;
    btnPause.textContent = '继续';
    recDot.classList.remove('recording');
    recDot.classList.add('paused');
    recState.textContent = '已暂停';
    recState.classList.remove('recording');
    recState.classList.add('paused');
    statusHint.textContent = '已暂停';
  } else {
    mediaRecorder.resume();
    isPaused = false;
    timerStart = Date.now();
    btnPause.textContent = '暂停';
    recDot.classList.add('recording');
    recDot.classList.remove('paused');
    recState.textContent = '录制中';
    recState.classList.add('recording');
    recState.classList.remove('paused');
    statusHint.textContent = '录制中…';
  }
}

function stopRecording() {
  if (!mediaRecorder || !isRecording) return;
  try {
    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  } catch (e) {}
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  isRecording = false;
  isPaused = false;
  api.setRecordingState(false);
}

function cancelRecording() {
  if (!mediaRecorder || !isRecording) return;
  // 取消：停止录制但不保存
  try {
    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = null;  // 阻止保存
      mediaRecorder.stop();
    }
  } catch (e) {}
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  cleanupStreams();
  isRecording = false;
  isPaused = false;
  api.setRecordingState(false);
  hint.textContent = '已取消本次录制';
  statusHint.textContent = '就绪';
  resetRecordUI();
}

function cleanupStreams() {
  try { if (videoStream) videoStream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { if (micStream) micStream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { if (systemStream) systemStream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { if (audioContext) audioContext.close(); } catch (e) {}
  videoStream = null;
  micStream = null;
  systemStream = null;
  audioContext = null;
  mediaRecorder = null;
  chunks = [];
}

function resetRecordUI() {
  btnRecord.classList.remove('recording');
  btnRecord.querySelector('.btn-rec-text').textContent = '开始录制';
  btnRecord.disabled = !selectedSource;
  btnPause.disabled = true;
  btnCancel.disabled = true;
  btnPause.textContent = '暂停';
  recDot.classList.remove('recording', 'paused');
  recState.textContent = '未开始';
  recState.classList.remove('recording', 'paused');
  timerEl.textContent = '00:00';
  setControlsDisabled(false);
}

function setControlsDisabled(disabled) {
  // 录制中禁用源切换、音频、画质
  document.querySelectorAll('.source-tabs .tab').forEach(t => { t.disabled = disabled; t.style.opacity = disabled ? 0.5 : 1; });
  optSystemAudio.disabled = disabled;
  optMic.disabled = disabled;
  document.querySelectorAll('.q-btn').forEach(b => { b.disabled = disabled; b.style.opacity = disabled ? 0.5 : 1; });
}

// 按钮事件
btnRecord.addEventListener('click', () => {
  if (isRecording) stopRecording();
  else startRecording();
});
btnPause.addEventListener('click', pauseRecording);
btnCancel.addEventListener('click', cancelRecording);

// 全局快捷键切换
api.onToggleRecording(() => {
  if (isRecording) stopRecording();
  else startRecording();
});

// ========== 历史（renderHistory 定义在文件末尾，支持 demo 模式）==========

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function openPreview(item) {
  currentPreviewId = item.id;
  previewTitle.textContent = (item.sourceName || '录制') + ' · ' + fmtDate(item.time);
  previewVideo.src = '';
  previewModal.classList.add('show');
  const result = await api.readVideo(item.path);
  if (result && result.ok) {
    const mime = (item.format === 'mp4') ? 'video/mp4' : 'video/webm';
    previewVideo.src = 'data:' + mime + ';base64,' + result.base64;
    previewVideo.play().catch(() => {});
  } else {
    hint.textContent = '无法读取视频：' + (result && result.error ? result.error : '');
  }
}

// 预览弹层
$('previewClose').addEventListener('click', () => {
  previewModal.classList.remove('show');
  previewVideo.pause();
  previewVideo.src = '';
});
$('previewSaveAs').addEventListener('click', async () => {
  const list = await api.getHistory();
  const item = list.find(x => x.id === currentPreviewId);
  if (item) await api.saveAs(item.path);
});
$('previewFolder').addEventListener('click', async () => {
  const list = await api.getHistory();
  const item = list.find(x => x.id === currentPreviewId);
  if (item) await api.showInFolder(item.path);
});
$('previewDelete').addEventListener('click', async () => {
  if (!confirm('确定删除这条录制？文件也会被删除。')) return;
  await api.deleteHistory(currentPreviewId);
  previewModal.classList.remove('show');
  previewVideo.pause();
  previewVideo.src = '';
});
document.querySelector('.modal-mask').addEventListener('click', () => {
  previewModal.classList.remove('show');
  previewVideo.pause();
  previewVideo.src = '';
});

// 窗口控制
$('btnMin').addEventListener('click', () => api.winMinimize());
$('btnMax').addEventListener('click', () => api.winMaximize());
$('btnClose').addEventListener('click', () => api.winClose());

// 历史更新事件
api.onHistoryUpdated(() => renderHistory());

// demo 模式：注入样例历史数据（仅用于截图展示，通过 URL hash 触发）
// demoMode 变量在文件开头已通过 location.hash 初始化

// 渲染历史（demo 模式用样例数据）
async function renderHistory() {
  let list;
  if (demoMode) {
    const now = Date.now();
    list = [
      { id: 'd1', path: '', time: now - 1000*60*5, duration: 142, size: 18*1024*1024, sourceName: '屏幕 1', format: 'webm', demoColor: 'linear-gradient(135deg, #2c3e50, #1a252f)', demoIcon: 'screen' },
      { id: 'd2', path: '', time: now - 1000*60*60*2, duration: 56, size: 8*1024*1024, sourceName: 'VS Code', format: 'webm', demoColor: 'linear-gradient(135deg, #1e3a5f, #0d1f33)', demoIcon: 'code' },
      { id: 'd3', path: '', time: now - 1000*60*60*26, duration: 323, size: 42*1024*1024, sourceName: '浏览器', format: 'mp4', demoColor: 'linear-gradient(135deg, #3a3a5c, #1f1f33)', demoIcon: 'browser' },
      { id: 'd4', path: '', time: now - 1000*60*60*49, duration: 18, size: 2*1024*1024, sourceName: '屏幕 2', format: 'webm', demoColor: 'linear-gradient(135deg, #2c2c2c, #1a1a1a)', demoIcon: 'screen' }
    ];
  } else {
    list = await api.getHistory();
  }
  historyCount.textContent = list.length + ' 条';
  if (!list.length) {
    historyList.innerHTML = '<div class="empty-state"><div class="empty-icon-wrap"><svg width="44" height="44" viewBox="0 0 48 48" fill="none"><rect x="8" y="10" width="32" height="24" rx="3" fill="none" stroke="#a1a1a6" stroke-width="2"/><circle cx="24" cy="22" r="5" fill="none" stroke="#a1a1a6" stroke-width="2"/><path d="M18 38h12" stroke="#a1a1a6" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="22" r="2" fill="#007aff"/></svg></div><p>还没有录制记录</p><p class="empty-sub">选择画面后点击「开始录制」</p><div class="empty-shortcut">快捷键 Ctrl+Shift+R 快速开始</div></div>';
    return;
  }
  historyList.innerHTML = '';
  // 按时间分组：今天 / 昨天 / 更早
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const groups = [
    { title: '今天', filter: t => t >= todayStart },
    { title: '昨天', filter: t => t >= yesterdayStart && t < todayStart },
    { title: '更早', filter: t => t < yesterdayStart }
  ];
  groups.forEach(g => {
    const items = list.filter(item => g.filter(item.time));
    if (!items.length) return;
    const titleEl = document.createElement('div');
    titleEl.className = 'history-group-title';
    titleEl.textContent = g.title;
    historyList.appendChild(titleEl);
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'history-item';
      const thumbStyle = item.demoColor ? `style="background:${item.demoColor};"` : '';
      // demo 模式缩略图图标
      let demoIconSvg = '';
      if (item.demoIcon === 'screen') {
        demoIconSvg = '<svg width="28" height="22" viewBox="0 0 28 22" fill="none"><rect x="1" y="1" width="26" height="18" rx="2" stroke="rgba(255,255,255,0.8)" stroke-width="1.5"/><rect x="9" y="20" width="10" height="1.5" rx="0.75" fill="rgba(255,255,255,0.8)"/></svg>';
      } else if (item.demoIcon === 'code') {
        demoIconSvg = '<svg width="24" height="22" viewBox="0 0 24 22" fill="none"><path d="M8 5l-5 6 5 6M16 5l5 6-5 6" stroke="rgba(255,255,255,0.8)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      } else if (item.demoIcon === 'browser') {
        demoIconSvg = '<svg width="26" height="22" viewBox="0 0 26 22" fill="none"><rect x="1" y="1" width="24" height="20" rx="2" stroke="rgba(255,255,255,0.8)" stroke-width="1.5"/><path d="M1 6h24M5 3.5h0.01M8 3.5h0.01" stroke="rgba(255,255,255,0.8)" stroke-width="1.5" stroke-linecap="round"/></svg>';
      }
      const thumbContent = item.demoColor ? demoIconSvg : '<div class="play-icon"></div>';
      row.innerHTML = `
        <div class="history-thumb" ${thumbStyle}>
          ${thumbContent}
          <div class="duration-tag">${fmtTime(item.duration || 0)}</div>
        </div>
        <div class="history-info">
          <div class="history-name">${escapeHtml(item.sourceName || '录制')} <span class="format-badge format-${item.format || 'webm'}">${item.format || 'webm'}</span></div>
          <div class="history-meta">
            <span>${fmtDate(item.time)}</span>
            <span>${fmtSize(item.size || 0)}</span>
          </div>
        </div>
        <div class="history-actions">
          <button class="icon-btn" title="另存为" data-act="save"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 3h7l3 3v7H3V3z" stroke="currentColor" stroke-width="1.3"/><path d="M5 3v4h5V3" stroke="currentColor" stroke-width="1.3"/></svg></button>
          <button class="icon-btn" title="在文件夹中显示" data-act="folder"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 4h4l1.5 2H14v7H2V4z" stroke="currentColor" stroke-width="1.3"/></svg></button>
          <button class="icon-btn danger" title="删除" data-act="delete"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      `;
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (demoMode) return;
        openPreview(item);
      });
      row.querySelectorAll('.icon-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (demoMode) return;
          const act = btn.dataset.act;
          if (act === 'save') {
            await api.saveAs(item.path);
          } else if (act === 'folder') {
            await api.showInFolder(item.path);
          } else if (act === 'delete') {
            if (confirm('确定删除这条录制？文件也会被删除。')) {
              await api.deleteHistory(item.id);
            }
          }
        });
      });
      historyList.appendChild(row);
    });
  });
}

// 初始化
(async function init() {
  // demoMode 已通过 location.hash 同步初始化
  if (demoMode) {
    renderDemoSources();
  } else {
    await loadSources();
  }
  await renderHistory();
})();

// demo 模式：渲染样例源卡片（无真实截图，用渐变色块代替）
function renderDemoSources() {
  sourceGrid.innerHTML = '';
  const demoSources = [
    { name: '屏幕 1', color: 'linear-gradient(135deg, #4a90d9, #357abd)' },
    { name: '屏幕 2', color: 'linear-gradient(135deg, #5ba8f0, #3d8de0)' }
  ];
  demoSources.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'source-card' + (i === 0 ? ' selected' : '');
    card.innerHTML = `
      <div class="source-thumb" style="height:72px;background:${s.color};display:flex;align-items:center;justify-content:center;">
        <svg width="26" height="20" viewBox="0 0 28 22" fill="none"><rect x="1" y="1" width="26" height="18" rx="2" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/><rect x="9" y="20" width="10" height="1.5" rx="0.75" fill="rgba(255,255,255,0.7)"/></svg>
      </div>
      <div class="source-name"><span style="overflow:hidden;text-overflow:ellipsis;">${s.name}</span></div>
      <div class="source-check"><svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    `;
    sourceGrid.appendChild(card);
  });
  selectedSource = { id: 'demo-screen-1', name: '屏幕 1' };
  btnRecord.disabled = false;
}
