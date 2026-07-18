// 渲染进程逻辑 - 本地音乐播放器
// 处理播放列表、播放控制、UI 交互

const audio = document.getElementById('audio');
const playlist = document.getElementById('playlist');
const emptyState = document.getElementById('emptyState');
const songCount = document.getElementById('songCount');
const nowTitle = document.getElementById('nowTitle');
const nowArtist = document.getElementById('nowArtist');
const albumArt = document.getElementById('albumArt');
const artPlaceholder = document.getElementById('artPlaceholder');
const timeCurrent = document.getElementById('timeCurrent');
const timeTotal = document.getElementById('timeTotal');
const progressFill = document.getElementById('progressFill');
const progressThumb = document.getElementById('progressThumb');
const progressTrack = document.getElementById('progressTrack');
const volumeFill = document.getElementById('volumeFill');
const volumeTrack = document.getElementById('volumeTrack');
const btnPlay = document.getElementById('btnPlay');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnShuffle = document.getElementById('btnShuffle');
const btnRepeat = document.getElementById('btnRepeat');
const btnAddFiles = document.getElementById('btnAddFiles');
const btnAddFolder = document.getElementById('btnAddFolder');
const iconPlay = document.getElementById('iconPlay');
const iconPause = document.getElementById('iconPause');

// 状态
let tracks = [];           // 播放列表 [{path, title, artist, duration}]
let currentIndex = -1;     // 当前播放索引
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0;        // 0:不循环 1:列表循环 2:单曲循环
let isSeeking = false;

// 持久化键
const STORAGE_KEY = 'music-player:playlist';

// ===== 工具函数 =====
function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function basename(p) {
  const name = p.split(/[\\/]/).pop();
  return name.replace(/\.[^.]+$/, '');
}

function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// 从文件名推断标题和艺术家 "Artist - Title.mp3"
function parseMetadata(filePath) {
  const name = basename(filePath);
  const parts = name.split(/\s*-\s*/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { title: name, artist: '未知艺术家' };
}

// 为没有封面的歌曲生成渐变色
function gradientFor(title) {
  const palettes = [
    ['#FF6B6B', '#FFA1A1'],
    ['#4ECDC4', '#7FE3DC'],
    ['#FFD93D', '#FFE680'],
    ['#A29BFE', '#C8C2FF'],
    ['#FD79A8', '#FDC2D8'],
    ['#00B894', '#5FD9B5'],
    ['#0984E3', '#5AB0F0'],
    ['#6C5CE7', '#9B8FF0']
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash << 5) - hash + title.charCodeAt(i);
  return palettes[Math.abs(hash) % palettes.length];
}

// ===== 播放列表渲染 =====
function renderPlaylist() {
  playlist.innerHTML = '';
  if (tracks.length === 0) {
    playlist.appendChild(emptyState);
    emptyState.style.display = 'flex';
    songCount.textContent = '0 首';
    return;
  }
  emptyState.style.display = 'none';
  songCount.textContent = `${tracks.length} 首`;
  tracks.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'track' + (i === currentIndex ? ' active' : '');
    el.innerHTML = `
      <div class="track-index">${i === currentIndex && isPlaying ? '♪' : (i + 1)}</div>
      <div class="track-info">
        <div class="track-title">${escapeHtml(t.title)}</div>
        <div class="track-artist">${escapeHtml(t.artist)}</div>
      </div>
      <div class="track-duration">${t.duration || '—'}</div>
    `;
    el.addEventListener('click', () => playIndex(i));
    playlist.appendChild(el);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ===== 播放控制 =====
function playIndex(i) {
  if (i < 0 || i >= tracks.length) return;
  currentIndex = i;
  const t = tracks[i];
  audio.src = 'file://' + encodeURIComponent(t.path).replace(/%2F/g, '/').replace(/%5C/g, '\\');
  // 简单方式: audio.src = file URL; 但中文路径需要编码
  // 实际使用 file:// + path，Electron 支持中文
  audio.src = 'file://' + t.path.replace(/\\/g, '/');
  audio.play().then(() => {
    isPlaying = true;
    updatePlayIcon();
    albumArt.classList.add('playing');
  }).catch(err => {
    showToast('无法播放此文件');
    console.error(err);
  });
  nowTitle.textContent = t.title;
  nowArtist.textContent = t.artist;
  updateAlbumArt(t);
  renderPlaylist();
}

function updateAlbumArt(t) {
  // 清除旧内容
  albumArt.innerHTML = '';
  const [c1, c2] = gradientFor(t.title);
  const gradient = document.createElement('div');
  gradient.style.cssText = `
    width: 100%; height: 100%;
    background: linear-gradient(135deg, ${c1} 0%, ${c2} 100%);
    display: flex; align-items: center; justify-content: center;
  `;
  const note = document.createElement('div');
  note.innerHTML = `<svg width="100" height="100" viewBox="0 0 24 24" fill="none">
    <path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,0.85)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="6" cy="18" r="3" stroke="rgba(255,255,255,0.85)" stroke-width="1.4"/>
    <circle cx="18" cy="16" r="3" stroke="rgba(255,255,255,0.85)" stroke-width="1.4"/>
  </svg>`;
  gradient.appendChild(note);
  albumArt.appendChild(gradient);
}

function togglePlay() {
  if (currentIndex === -1) {
    if (tracks.length > 0) playIndex(0);
    return;
  }
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    albumArt.classList.remove('playing');
  } else {
    audio.play();
    isPlaying = true;
    albumArt.classList.add('playing');
  }
  updatePlayIcon();
  renderPlaylist();
}

function updatePlayIcon() {
  iconPlay.style.display = isPlaying ? 'none' : 'block';
  iconPause.style.display = isPlaying ? 'block' : 'none';
}

function playNext() {
  if (tracks.length === 0) return;
  let next;
  if (isShuffle) {
    do { next = Math.floor(Math.random() * tracks.length); }
    while (next === currentIndex && tracks.length > 1);
  } else {
    next = currentIndex + 1;
    if (next >= tracks.length) next = 0;
  }
  playIndex(next);
}

function playPrev() {
  if (tracks.length === 0) return;
  let prev = currentIndex - 1;
  if (prev < 0) prev = tracks.length - 1;
  playIndex(prev);
}

// ===== 进度 =====
audio.addEventListener('timeupdate', () => {
  if (isSeeking) return;
  const pct = (audio.currentTime / audio.duration) * 100 || 0;
  progressFill.style.width = pct + '%';
  progressThumb.style.left = pct + '%';
  timeCurrent.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatTime(audio.duration);
  // 更新当前曲目的时长显示
  if (currentIndex >= 0 && tracks[currentIndex]) {
    tracks[currentIndex].duration = formatTime(audio.duration);
    renderPlaylist();
  }
});

audio.addEventListener('ended', () => {
  if (repeatMode === 2) {
    audio.currentTime = 0;
    audio.play();
  } else if (repeatMode === 1 || currentIndex < tracks.length - 1 || isShuffle) {
    playNext();
  } else {
    isPlaying = false;
    albumArt.classList.remove('playing');
    updatePlayIcon();
    renderPlaylist();
  }
});

// 进度条点击/拖拽
function seekFromEvent(e) {
  const rect = progressTrack.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const pct = x / rect.width;
  if (audio.duration) {
    audio.currentTime = pct * audio.duration;
    progressFill.style.width = (pct * 100) + '%';
    progressThumb.style.left = (pct * 100) + '%';
  }
}

progressTrack.addEventListener('mousedown', e => {
  isSeeking = true;
  seekFromEvent(e);
});
window.addEventListener('mousemove', e => {
  if (isSeeking) seekFromEvent(e);
});
window.addEventListener('mouseup', () => { isSeeking = false; });

// 音量
let isVolSeeking = false;
function volFromEvent(e) {
  const rect = volumeTrack.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const pct = x / rect.width;
  audio.volume = pct;
  volumeFill.style.width = (pct * 100) + '%';
}
volumeTrack.addEventListener('mousedown', e => {
  isVolSeeking = true;
  volFromEvent(e);
});
window.addEventListener('mousemove', e => {
  if (isVolSeeking) volFromEvent(e);
});
window.addEventListener('mouseup', () => { isVolSeeking = false; });

// ===== 添加文件 =====
async function addFiles() {
  const files = await window.api.selectMusicFiles();
  if (files.length === 0) return;
  let added = 0;
  for (const f of files) {
    if (tracks.some(t => t.path === f)) continue;
    const meta = parseMetadata(f);
    tracks.push({ path: f, title: meta.title, artist: meta.artist, duration: '—' });
    added++;
  }
  savePlaylist();
  renderPlaylist();
  if (added > 0) showToast(`已添加 ${added} 首音乐`);
  if (currentIndex === -1 && tracks.length > 0) {
    // 不自动播放，仅高亮第一首
  }
}

async function addFolder() {
  const folders = await window.api.selectMusicFolder();
  if (folders.length === 0) return;
  const exts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
  let added = 0;
  for (const folder of folders) {
    // 通过 input 元素让 Electron 自动遍历？不行，需要在主进程做
    // 简化：这里仅提示用户用"添加文件"
    // 实际：我们通过 file input 的 webkitdirectory 在渲染进程也可
  }
  // 使用隐藏的 input[webkitdirectory] 让用户选文件夹
  const input = document.createElement('input');
  input.type = 'file';
  input.setAttribute('webkitdirectory', '');
  input.multiple = true;
  input.addEventListener('change', e => {
    const files = Array.from(e.target.files);
    for (const f of files) {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!exts.includes(ext)) continue;
      const path = f.path;
      if (!path || tracks.some(t => t.path === path)) continue;
      const meta = parseMetadata(path);
      tracks.push({ path, title: meta.title, artist: meta.artist, duration: '—' });
      added++;
    }
    savePlaylist();
    renderPlaylist();
    if (added > 0) showToast(`已从文件夹添加 ${added} 首音乐`);
  });
  input.click();
}

// ===== 持久化 =====
function savePlaylist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks.map(t => t.path)));
  } catch (e) { /* 忽略 */ }
}

function loadPlaylist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const paths = JSON.parse(raw);
    for (const p of paths) {
      const meta = parseMetadata(p);
      tracks.push({ path: p, title: meta.title, artist: meta.artist, duration: '—' });
    }
  } catch (e) { /* 忽略 */ }
}

// ===== 事件绑定 =====
btnPlay.addEventListener('click', togglePlay);
btnNext.addEventListener('click', playNext);
btnPrev.addEventListener('click', playPrev);
btnShuffle.addEventListener('click', () => {
  isShuffle = !isShuffle;
  btnShuffle.classList.toggle('active', isShuffle);
  showToast(isShuffle ? '随机播放：开' : '随机播放：关');
});
btnRepeat.addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3;
  btnRepeat.classList.toggle('active', repeatMode > 0);
  const labels = ['循环：关', '列表循环', '单曲循环'];
  showToast(labels[repeatMode]);
});
btnAddFiles.addEventListener('click', addFiles);
btnAddFolder.addEventListener('click', addFolder);

// 键盘快捷键
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.code) {
    case 'Space': e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': if (e.shiftKey) { audio.currentTime += 5; } break;
    case 'ArrowLeft': if (e.shiftKey) { audio.currentTime -= 5; } break;
    case 'KeyN': if (e.ctrlKey || e.metaKey) playNext(); break;
    case 'KeyP': if (e.ctrlKey || e.metaKey) playPrev(); break;
  }
});

// 拖拽支持
document.addEventListener('dragover', e => { e.preventDefault(); });
document.addEventListener('drop', e => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  const exts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
  let added = 0;
  for (const f of files) {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!exts.includes(ext)) continue;
    if (tracks.some(t => t.path === f.path)) continue;
    const meta = parseMetadata(f.path);
    tracks.push({ path: f.path, title: meta.title, artist: meta.artist, duration: '—' });
    added++;
  }
  if (added > 0) {
    savePlaylist();
    renderPlaylist();
    showToast(`已添加 ${added} 首音乐`);
  }
});

// ===== 初始化 =====
loadPlaylist();

// Demo 模式：URL 含 ?demo=1 时注入示例曲目，仅用于截图展示
const isDemo = new URLSearchParams(location.search).get('demo') === '1';
if (isDemo && tracks.length === 0) {
  tracks = [
    { path: '/demo/track1.mp3', title: '晴天', artist: '周杰伦', duration: '4:32' },
    { path: '/demo/track2.mp3', title: '稻香', artist: '周杰伦', duration: '3:43' },
    { path: '/demo/track3.mp3', title: '七里香', artist: '周杰伦', duration: '4:59' },
    { path: '/demo/track4.mp3', title: '夜曲', artist: '周杰伦', duration: '4:35' },
    { path: '/demo/track5.mp3', title: '青花瓷', artist: '周杰伦', duration: '3:58' },
    { path: '/demo/track6.mp3', title: '简单爱', artist: '周杰伦', duration: '4:30' },
    { path: '/demo/track7.mp3', title: '本草纲目', artist: '周杰伦', duration: '4:02' },
    { path: '/demo/track8.mp3', title: '听妈妈的话', artist: '周杰伦', duration: '4:25' }
  ];
  // 模拟"正在播放"第一首
  currentIndex = 0;
  isPlaying = true;
  nowTitle.textContent = tracks[0].title;
  nowArtist.textContent = tracks[0].artist;
  updateAlbumArt(tracks[0]);
  albumArt.classList.add('playing');
  iconPlay.style.display = 'none';
  iconPause.style.display = 'block';
  timeCurrent.textContent = '1:24';
  timeTotal.textContent = '4:32';
  progressFill.style.width = '30%';
  progressThumb.style.left = '30%';
  btnShuffle.classList.add('active');
  btnRepeat.classList.add('active');
}

renderPlaylist();
audio.volume = 0.7;
volumeFill.style.width = '70%';
