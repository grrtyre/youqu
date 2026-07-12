// 番茄管家 - 渲染层逻辑
'use strict';

const RING_CIRCUMFERENCE = 2 * Math.PI * 140;
const PHASE_LABEL = {
  idle: '准备开始',
  working: '专注中',
  short_break: '短休息',
  long_break: '长休息',
  paused: '已暂停'
};
const PHASE_TAB_LABEL = {
  working: '专注',
  short_break: '短休息',
  long_break: '长休息'
};

const el = {
  timerTime: document.getElementById('timerTime'),
  timerPhase: document.getElementById('timerPhase'),
  timerCycle: document.getElementById('timerCycle'),
  ringProgress: document.getElementById('ringProgress'),
  startBtn: document.getElementById('startBtn'),
  startIcon: document.getElementById('startIcon'),
  startText: document.getElementById('startText'),
  resetBtn: document.getElementById('resetBtn'),
  skipBtn: document.getElementById('skipBtn'),
  phaseTabs: document.getElementById('phaseTabs'),
  todayCount: document.getElementById('todayCount'),
  todayGoal: document.getElementById('todayGoal'),
  todayMinutes: document.getElementById('todayMinutes'),
  todayBar: document.getElementById('todayBar'),
  todayPct: document.getElementById('todayPct'),
  todayDate: document.getElementById('todayDate'),
  weekCount: document.getElementById('weekCount'),
  streakNum: document.getElementById('streakNum'),
  weekChart: document.getElementById('weekChart'),
  weekTotal: document.getElementById('weekTotal'),
  currentTaskName: document.getElementById('currentTaskName'),
  taskList: document.getElementById('taskList'),
  taskInput: document.getElementById('taskInput'),
  taskEstimate: document.getElementById('taskEstimate'),
  taskAddBtn: document.getElementById('taskAddBtn'),
  taskCount: document.getElementById('taskCount'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsMask: document.getElementById('settingsMask'),
  settingsClose: document.getElementById('settingsClose'),
  settingsSave: document.getElementById('settingsSave'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  toast: document.getElementById('toast')
};

let current = null; // 当前完整状态缓存

// ---- 音频（Web Audio API 合成）----
let audioCtx = null;
let noiseSource = null;
let noiseGain = null;

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playChime() {
  const ctx = ensureAudio();
  if (!ctx) return;
  // 两段清脆的钟声
  const now = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.18;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.3);
  });
}

function startWhiteNoise() {
  const ctx = ensureAudio();
  if (!ctx) return;
  if (noiseSource) return;
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;
  // 低通滤波让白噪音更柔和
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1000;
  noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.08;
  noiseSource.connect(filter).connect(noiseGain).connect(ctx.destination);
  noiseSource.start();
}

function stopWhiteNoise() {
  if (noiseSource) {
    try { noiseSource.stop(); } catch (e) {}
    noiseSource = null;
    noiseGain = null;
  }
}

// ---- 渲染 ----
function render(state) {
  current = state;
  renderTimer(state);
  renderStats(state);
  renderTasks(state);
  renderWeekChart(state.weekDaily || []);
  el.streakNum.textContent = state.streak || 0;
  el.todayGoal.textContent = (state.config && state.config.dailyGoal) || 8;
}

function renderTimer(state) {
  const remaining = state.remainingMs;
  const phase = state.state === 'paused' ? state.pausedState : state.state;
  el.timerTime.textContent = formatTime(remaining);
  el.timerPhase.textContent = PHASE_LABEL[state.state] || '准备开始';

  // 圆环
  const pct = state.progress || 0;
  el.ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - pct);
  el.ringProgress.classList.remove('short_break', 'long_break');
  if (phase === 'short_break') el.ringProgress.classList.add('short_break');
  else if (phase === 'long_break') el.ringProgress.classList.add('long_break');

  // 周期点
  const interval = (state.config && state.config.longBreakInterval) || 4;
  const cycle = state.cycleCount || 0;
  const inCycle = cycle % interval;
  let dots = '';
  for (let i = 0; i < interval; i++) {
    dots += `<span class="cycle-dot ${i < inCycle ? 'filled' : ''}"></span>`;
  }
  el.timerCycle.innerHTML = dots;

  // 阶段标签高亮
  const activePhase = phase || 'working';
  el.phaseTabs.querySelectorAll('.phase-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.phase === activePhase);
  });

  // 按钮状态
  const running = state.state === 'working' || state.state === 'short_break' || state.state === 'long_break';
  el.startBtn.classList.toggle('running', running);
  if (state.state === 'idle') {
    el.startIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    el.startText.textContent = '开始专注';
  } else if (state.state === 'paused') {
    el.startIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    el.startText.textContent = '继续';
  } else {
    el.startIcon.innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
    el.startText.textContent = '暂停';
  }

  // 标题更新
  document.title = `${formatTime(remaining)} · 番茄管家`;
}

function renderStats(state) {
  const today = state.today || { workSessions: 0, totalMinutes: 0 };
  const goal = (state.config && state.config.dailyGoal) || 8;
  el.todayCount.textContent = today.workSessions || 0;
  el.todayMinutes.textContent = today.totalMinutes || 0;
  const week = state.week || { workSessions: 0 };
  el.weekCount.textContent = week.workSessions || 0;
  const pct = goal > 0 ? Math.min(100, Math.round((today.workSessions / goal) * 100)) : 0;
  el.todayBar.style.width = pct + '%';
  el.todayPct.textContent = pct + '%';
  // 日期
  const d = new Date();
  const weekDays = ['日','一','二','三','四','五','六'];
  el.todayDate.textContent = `${d.getMonth()+1}月${d.getDate()}日 周${weekDays[d.getDay()]}`;
}

function renderTasks(state) {
  const tasks = state.tasks || [];
  const active = tasks.filter(t => !t.completed);
  el.taskCount.textContent = `${active.length} 项`;
  // 当前任务显示
  const cur = tasks.find(t => t.id === state.currentTaskId && !t.completed);
  el.currentTaskName.textContent = cur ? cur.title : '未选择任务';
  el.currentTaskName.style.color = cur ? 'var(--text)' : 'var(--text-3)';
  if (tasks.length === 0) {
    el.taskList.innerHTML = '<li class="task-empty">还没有任务，添加一个开始专注吧</li>';
    return;
  }
  // 未完成在前
  tasks.sort((a, b) => (a.completed - b.completed) || (a.createdAt - b.createdAt));
  el.taskList.innerHTML = tasks.map(t => {
    const isCurrent = state.currentTaskId === t.id && !t.completed;
    return `
      <li class="task-item ${t.completed ? 'done' : ''} ${isCurrent ? 'current' : ''}" data-id="${t.id}">
        <div class="task-radio" data-action="complete"></div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">${t.pomodoros || 0} / ${t.estimate || 1} 🍅</div>
        </div>
        <span class="task-current-dot ${isCurrent ? '' : 'empty'}" data-action="current" title="设为当前任务"></span>
        <button class="task-del" data-action="delete" title="删除">×</button>
      </li>`;
  }).join('');
}

function renderWeekChart(daily) {
  if (!daily || daily.length === 0) { el.weekChart.innerHTML = ''; return; }
  const max = Math.max(1, ...daily.map(d => d.workSessions));
  const total = daily.reduce((s, d) => s + (d.workSessions || 0), 0);
  el.weekTotal.textContent = `共 ${total} 🍅`;
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  el.weekChart.innerHTML = daily.map(d => {
    const h = Math.round((d.workSessions / max) * 100);
    const isToday = d.date === todayKey;
    return `
      <div class="week-bar-wrap ${isToday ? 'today' : ''}">
        <span class="week-bar-count">${d.workSessions || ''}</span>
        <div class="week-bar ${d.workSessions ? '' : 'empty'} ${isToday ? 'today' : ''}" style="height:${Math.max(5, h)}%"></div>
        <span class="week-bar-label">${d.label}</span>
      </div>`;
  }).join('');
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.remove('show'), 1800);
}

// ---- 事件 ----
el.startBtn.addEventListener('click', async () => {
  ensureAudio();
  if (current && (current.state === 'working' || current.state === 'short_break' || current.state === 'long_break')) {
    await window.api.pause();
  } else {
    await window.api.start();
  }
});

el.resetBtn.addEventListener('click', async () => {
  await window.api.reset();
  toast('已重置');
});

el.skipBtn.addEventListener('click', async () => {
  const ev = await window.api.skip();
  if (!ev) toast('当前阶段不可跳过');
});

el.phaseTabs.addEventListener('click', (e) => {
  // 仅作为视觉提示，实际阶段由计时器推进；点击切换提示当前选择
  // 这里不强制切换阶段，避免破坏番茄工作法节奏
});

el.taskAddBtn.addEventListener('click', addTask);
el.taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });

async function addTask() {
  const title = el.taskInput.value.trim();
  if (!title) return;
  const est = parseInt(el.taskEstimate.value, 10) || 1;
  await window.api.addTask(title, est);
  el.taskInput.value = '';
  el.taskInput.focus();
}

el.taskList.addEventListener('click', async (e) => {
  const item = e.target.closest('.task-item');
  if (!item) return;
  const id = item.dataset.id;
  const action = e.target.dataset.action;
  if (action === 'complete') {
    await window.api.completeTask(id);
  } else if (action === 'delete') {
    await window.api.deleteTask(id);
  } else if (action === 'current') {
    await window.api.setCurrentTask(id);
  } else {
    // 点击整行也设为当前任务
    await window.api.setCurrentTask(id);
  }
});

// 设置
el.settingsBtn.addEventListener('click', openSettings);
el.settingsClose.addEventListener('click', () => el.settingsMask.classList.remove('show'));
el.settingsMask.addEventListener('click', (e) => { if (e.target === el.settingsMask) el.settingsMask.classList.remove('show'); });

function openSettings() {
  if (!current || !current.config) return;
  document.getElementById('cfgWork').value = current.config.workDuration;
  document.getElementById('cfgShort').value = current.config.shortBreak;
  document.getElementById('cfgLong').value = current.config.longBreak;
  document.getElementById('cfgInterval').value = current.config.longBreakInterval;
  document.getElementById('cfgGoal').value = current.config.dailyGoal;
  document.getElementById('cfgStrict').checked = !!current.config.strictMode;
  document.getElementById('cfgSound').checked = !!current.config.soundEnabled;
  document.getElementById('cfgNoise').checked = !!current.config.whiteNoise;
  el.settingsMask.classList.add('show');
}

el.settingsSave.addEventListener('click', async () => {
  const cfg = {
    workDuration: clamp(parseInt(document.getElementById('cfgWork').value,10), 1, 90),
    shortBreak: clamp(parseInt(document.getElementById('cfgShort').value,10), 1, 30),
    longBreak: clamp(parseInt(document.getElementById('cfgLong').value,10), 1, 60),
    longBreakInterval: clamp(parseInt(document.getElementById('cfgInterval').value,10), 2, 12),
    dailyGoal: clamp(parseInt(document.getElementById('cfgGoal').value,10), 1, 30),
    strictMode: document.getElementById('cfgStrict').checked,
    soundEnabled: document.getElementById('cfgSound').checked,
    whiteNoise: document.getElementById('cfgNoise').checked
  };
  await window.api.saveConfig(cfg);
  if (cfg.whiteNoise) startWhiteNoise(); else stopWhiteNoise();
  el.settingsMask.classList.remove('show');
  toast('设置已保存');
});

el.exportBtn.addEventListener('click', async () => {
  const json = await window.api.exportData();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pomodoro-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('已导出');
});

el.importBtn.addEventListener('click', () => el.importFile.click());
el.importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    await window.api.importData(text);
    toast('导入成功');
  } catch (err) {
    toast('导入失败：' + err.message);
  }
  el.importFile.value = '';
});

function clamp(v, min, max) { return Math.max(min, Math.min(max, isNaN(v) ? min : v)); }

// ---- IPC 接收 ----
window.api.onTick((data) => {
  if (!current) return;
  current.state = data.state;
  current.remainingMs = data.remainingMs;
  current.progress = data.progress;
  current.cycleCount = data.cycleCount;
  renderTimer(current);
});

window.api.onPhase((data) => {
  if (data.full) {
    loadState();
  } else {
    if (!current) { loadState(); return; }
    current.state = data.state;
    current.remainingMs = data.remainingMs;
    current.cycleCount = data.cycleCount;
    if (data.event && data.event.completedWork) {
      // 刷新统计
      loadState();
      toast(`🍅 完成第 ${data.event.workSessionsToday} 个番茄！`);
    } else {
      renderTimer(current);
    }
  }
});

window.api.onNotify((data) => {
  if (data.type === 'chime') playChime();
});

async function loadState() {
  const state = await window.api.getState();
  render(state);
  if (state.config && state.config.whiteNoise) startWhiteNoise(); else stopWhiteNoise();
}

// 初始化
loadState();
