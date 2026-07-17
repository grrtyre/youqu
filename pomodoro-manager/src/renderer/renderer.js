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
  cycleLabel: document.getElementById('cycleLabel'),
  ringProgress: document.getElementById('ringProgress'),
  ringWrap: document.querySelector('.timer-ring-wrap'),
  ringRipple: document.getElementById('ringRipple'),
  startBtn: document.getElementById('startBtn'),
  startIcon: document.getElementById('startIcon'),
  startText: document.getElementById('startText'),
  resetBtn: document.getElementById('resetBtn'),
  skipBtn: document.getElementById('skipBtn'),
  phaseTabs: document.getElementById('phaseTabs'),
  todayCount: document.getElementById('todayCount'),
  todayGoal: document.getElementById('todayGoal'),
  todayMinutes: document.getElementById('todayMinutes'),
  totalMinutes: document.getElementById('totalMinutes'),
  todayBar: document.getElementById('todayBar'),
  todayPct: document.getElementById('todayPct'),
  todayDate: document.getElementById('todayDate'),
  weekCount: document.getElementById('weekCount'),
  streakNum: document.getElementById('streakNum'),
  weekChart: document.getElementById('weekChart'),
  weekTotal: document.getElementById('weekTotal'),
  currentTaskName: document.getElementById('currentTaskName'),
  currentTask: document.getElementById('currentTask'),
  heatmap: document.getElementById('heatmap'),
  heatMonths: document.getElementById('heatMonths'),
  heatTotal: document.getElementById('heatTotal'),
  weekNowCount: document.getElementById('weekNowCount'),
  weekGoalNum: document.getElementById('weekGoalNum'),
  weekGoalFill: document.getElementById('weekGoalFill'),
  taskList: document.getElementById('taskList'),
  taskInput: document.getElementById('taskInput'),
  taskEstimate: document.getElementById('taskEstimate'),
  taskAddBtn: document.getElementById('taskAddBtn'),
  taskCount: document.getElementById('taskCount'),
  taskFooter: document.getElementById('taskFooter'),
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
let wantWhiteNoise = false;   // 期望的白噪音状态（受自动播放策略影响可能延迟生效）
let audioUnlocked = false;    // 首次用户手势后置 true

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
  // 浏览器自动播放策略：ctx 仍 suspended（无用户手势）时暂不创建音源，
  // 等首次交互解锁后再启动，避免「开关已开却无声」的静默失败。
  if (ctx.state !== 'running') return;
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

// 统一应用白噪音期望状态
function applyWhiteNoise(on) {
  wantWhiteNoise = !!on;
  if (wantWhiteNoise) startWhiteNoise(); else stopWhiteNoise();
}

// 自动播放策略：首次用户手势解锁 AudioContext，并按需补启白噪音
['pointerdown', 'keydown'].forEach(function (evName) {
  document.addEventListener(evName, function () {
    if (audioUnlocked) return;
    const ctx = ensureAudio();
    if (ctx && ctx.state === 'running') {
      audioUnlocked = true;
      if (wantWhiteNoise && !noiseSource) startWhiteNoise();
    }
  });
});

// ---- 渲染 ----
function render(state) {
  current = state;
  renderTimer(state);
  renderStats(state);
  renderTasks(state);
  renderWeekChart(state.weekDaily || []);
  renderHeatmap(state.heatmap);
  renderWeekGoal(state);
  el.streakNum.textContent = state.streak || 0;
  el.todayGoal.textContent = (state.config && state.config.dailyGoal) || 8;
}

// 专注热力图：13 周 × 7 天网格，颜色深浅表示当日番茄数
function renderHeatmap(hm) {
  if (!hm || !hm.weeks || hm.weeks.length === 0) {
    el.heatmap.innerHTML = '';
    if (el.heatMonths) el.heatMonths.innerHTML = '';
    el.heatTotal.textContent = '近 13 周 · 0 \u{1F345}';
    return;
  }
  el.heatTotal.textContent = '近 ' + hm.weeks.length + ' 周 · ' + (hm.totalSessions || 0) + ' \u{1F345}';
  // 月份标签行：与周列对齐
  if (el.heatMonths) {
    el.heatMonths.innerHTML = hm.weeks.map((col, idx) => {
      const m = col[0].month;
      const prev = idx > 0 ? hm.weeks[idx - 1][0].month : -1;
      return '<span class="heat-month' + (m !== prev ? ' has-text' : '') + '">' + (m !== prev ? (m + '月') : '') + '</span>';
    }).join('');
  }
  el.heatmap.innerHTML = hm.weeks.map(col => {
    const cells = col.map(c => {
      const cls = ['heat-cell'];
      if (c.isFuture) cls.push('future');
      else cls.push('level-' + (c.level || 0));
      if (c.isToday) cls.push('today');
      const tip = c.date + ' · ' + c.workSessions + ' 个番茄';
      return '<span class="' + cls.join(' ') + '" title="' + tip + '"></span>';
    }).join('');
    return '<div class="heat-col">' + cells + '</div>';
  }).join('');
}

// 周目标进度条（本自然周已完成 / 每周目标）
function renderWeekGoal(state) {
  const tw = state.thisWeek || { workSessions: 0 };
  const goal = (state.config && state.config.weeklyGoal) || 30;
  el.weekNowCount.textContent = tw.workSessions || 0;
  el.weekGoalNum.textContent = goal;
  const pct = goal > 0 ? Math.min(100, Math.round((tw.workSessions / goal) * 100)) : 0;
  el.weekGoalFill.style.width = pct + '%';
}

function renderTimer(state) {
  const remaining = state.remainingMs;
  const phase = state.state === 'paused' ? state.pausedState : state.state;
  el.timerTime.textContent = formatTime(remaining);
  // 暂停时保留阶段上下文，避免用户忘记正在暂停的是哪个阶段
  if (state.state === 'paused' && state.pausedState) {
    el.timerPhase.textContent = `已暂停 · ${PHASE_TAB_LABEL[state.pausedState] || ''}`;
  } else {
    el.timerPhase.textContent = PHASE_LABEL[state.state] || '准备开始';
  }

  // 圆环
  const pct = state.progress || 0;
  el.ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - pct);
  el.ringProgress.classList.remove('short_break', 'long_break');
  if (phase === 'short_break') el.ringProgress.classList.add('short_break');
  else if (phase === 'long_break') el.ringProgress.classList.add('long_break');

  // 呼吸光晕：运行中（非暂停/空闲）才脉动，并同步阶段颜色到 wrap
  const running = state.state === 'working' || state.state === 'short_break' || state.state === 'long_break';
  el.ringWrap.classList.toggle('breathing', running);
  el.ringWrap.classList.remove('short_break', 'long_break');
  if (running && phase === 'short_break') el.ringWrap.classList.add('short_break');
  else if (running && phase === 'long_break') el.ringWrap.classList.add('long_break');

  // 周期点
  const interval = (state.config && state.config.longBreakInterval) || 4;
  const cycle = state.cycleCount || 0;
  const inCycle = cycle % interval;
  let dots = '';
  for (let i = 0; i < interval; i++) {
    dots += `<span class="cycle-dot ${i < inCycle ? 'filled' : ''}"></span>`;
  }
  el.timerCycle.innerHTML = dots;
  // 周期文字标签：让用户清楚当前在第几轮、共几轮
  el.cycleLabel.textContent = `第 ${Math.min(inCycle + 1, interval)} 轮 · 共 ${interval} 轮`;

  // 阶段标签高亮
  const activePhase = phase || 'working';
  el.phaseTabs.querySelectorAll('.phase-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.phase === activePhase);
  });

  // 按钮状态（running 已在上方声明，复用）
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
  // 累计专注时长（全量历史）
  const total = state.total || { workSessions: 0, totalMinutes: 0 };
  el.totalMinutes.textContent = formatHours(total.totalMinutes || 0);
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
  const doneCount = tasks.length - active.length;
  el.taskCount.textContent = `${active.length} 项`;
  // 当前任务显示
  const cur = tasks.find(t => t.id === state.currentTaskId && !t.completed);
  el.currentTaskName.textContent = cur ? cur.title : '未选择任务';
  el.currentTaskName.style.color = cur ? 'var(--text)' : 'var(--text-3)';
  // 有当前任务时给容器加 has-task 类，触发左侧蓝色细条 + 浅蓝背景
  if (el.currentTask) el.currentTask.classList.toggle('has-task', !!cur);
  // 底部统计条带：已完成数 + 投入/预估番茄
  const totalEst = tasks.reduce((s, t) => s + (t.estimate || 1), 0);
  const totalPomo = tasks.reduce((s, t) => s + (t.pomodoros || 0), 0);
  el.taskFooter.innerHTML = tasks.length === 0
    ? `<span class="tf-label">暂无任务，开始添加吧</span>`
    : `<span class="tf-label">已完成 <span class="tf-done">${doneCount}</span><span class="tf-sep">/</span><span class="tf-total">${tasks.length}</span></span><span class="tf-label">番茄 <span class="tf-total">${totalPomo}</span><span class="tf-sep">/</span><span class="tf-total">${totalEst}</span></span>`;
  if (tasks.length === 0) {
    el.taskList.innerHTML = '<li class="task-empty">还没有任务，添加一个开始专注吧</li>';
    return;
  }
  // 未完成在前（排序副本，避免就地修改 state.tasks 顺序）
  const sorted = tasks.slice().sort((a, b) => (a.completed - b.completed) || (a.createdAt - b.createdAt));
  el.taskList.innerHTML = sorted.map(t => {
    const isCurrent = state.currentTaskId === t.id && !t.completed;
    const pomo = t.pomodoros || 0;
    const est = t.estimate || 1;
    // 进度条百分比：已完成任务满格，未完成按 pomodoros/estimate
    const pct = t.completed ? 100 : Math.min(100, Math.round((pomo / est) * 100));
    return `
      <li class="task-item ${t.completed ? 'done' : ''} ${isCurrent ? 'current' : ''}" data-id="${t.id}">
        <div class="task-radio" data-action="complete"></div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-progress">
            <div class="task-progress-bar"><div class="task-progress-fill" style="width:${pct}%"></div></div>
            <span class="task-meta">${pomo} / ${est}</span>
          </div>
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
  el.weekTotal.textContent = `共 ${total}`;
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const maxBarPx = 48; // 固定像素高度，保持柱状图比例平衡
  el.weekChart.innerHTML = daily.map(d => {
    const h = Math.round((d.workSessions / max) * maxBarPx);
    const isToday = d.date === todayKey;
    const empty = !d.workSessions;
    return `
      <div class="week-bar-wrap ${isToday ? 'today' : ''}">
        <span class="week-bar-count">${d.workSessions || ''}</span>
        <div class="week-bar ${empty ? 'empty' : ''} ${isToday ? 'today' : ''}" style="height:${Math.max(10, h)}px"></div>
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

// 累计专注时长格式化：整数小时不带小数，否则保留一位
function formatHours(min) {
  const h = (min || 0) / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

// 番茄完成庆祝动效：圆环波纹扩散 + 时间数字弹跳
function celebrate() {
  el.ringRipple.classList.remove('celebrate');
  void el.ringRipple.offsetWidth; // 强制重排以重置动画
  el.ringRipple.classList.add('celebrate');
  el.timerTime.classList.remove('bounce');
  void el.timerTime.offsetWidth;
  el.timerTime.classList.add('bounce');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function toast(msg, actionLabel, actionFn) {
  el.toast.textContent = msg;
  // 清除旧的 action 按钮
  const oldAction = el.toast.querySelector('.toast-action');
  if (oldAction) oldAction.remove();
  if (actionLabel && typeof actionFn === 'function') {
    const btn = document.createElement('span');
    btn.className = 'toast-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      el.toast.classList.remove('show');
      try { actionFn(); } catch (e) {}
    });
    el.toast.appendChild(btn);
    el.toast._undoTimer = setTimeout(() => el.toast.classList.remove('show'), 4500);
  } else {
    el.toast._undoTimer = setTimeout(() => el.toast.classList.remove('show'), 1800);
  }
  el.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = el.toast._undoTimer;
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
  if (!ev) {
    if (current && (current.state === 'idle' || current.state === 'paused')) toast('计时未开始');
    else toast('严格模式下休息不可跳过');
  }
});

el.phaseTabs.addEventListener('click', async (e) => {
  const tab = e.target.closest('.phase-tab');
  if (!tab) return;
  const phase = tab.dataset.phase;
  if (!phase) return;
  // 防误触：当前阶段进行中且已有进度时，首次点击给提示，再次点击同标签才确认切换
  const curPhase = current && (current.state === 'paused' ? current.pausedState : current.state);
  const running = current && (current.state === 'working' || current.state === 'short_break' || current.state === 'long_break');
  if (running && curPhase !== phase && (current.progress || 0) > 0.1 && tab.dataset.confirm !== '1') {
    tab.dataset.confirm = '1';
    toast(`当前阶段进度 ${(Math.round((current.progress||0)*100))}%，再次点击确认切换`);
    setTimeout(() => { tab.dataset.confirm = '0'; }, 3000);
    return;
  }
  tab.dataset.confirm = '0';
  await window.api.switchPhase(phase);
  const label = PHASE_TAB_LABEL[phase] || '';
  toast(`已切换到「${label}」`);
});

el.taskAddBtn.addEventListener('click', addTask);
el.taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });
// 字符计数器：实时更新 X/80，临近上限时高亮
const _taskCounter = document.getElementById('taskCounter');
function updateTaskCounter() {
  if (!_taskCounter) return;
  const len = el.taskInput.value.length;
  _taskCounter.textContent = `${len}/80`;
  _taskCounter.classList.toggle('near', len >= 70);
}
el.taskInput.addEventListener('input', updateTaskCounter);

async function addTask() {
  const title = el.taskInput.value.trim();
  if (!title) { toast('请输入任务名称'); el.taskInput.focus(); return; }
  const est = clamp(parseInt(el.taskEstimate.value, 10) || 1, 1, 20);
  await window.api.addTask(title, est);
  el.taskInput.value = '';
  updateTaskCounter();
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
    // 删除前缓存任务快照，提供撤销
    const snapshot = (current && current.tasks || []).find(t => t.id === id) || null;
    await window.api.deleteTask(id);
    if (snapshot) {
      toast(`已删除「${snapshot.title.length > 12 ? snapshot.title.slice(0,12)+'…' : snapshot.title}」`, '撤销', async () => {
        const restored = await window.api.addTaskRaw(snapshot);
        if (restored) toast('已恢复');
      });
    }
  } else if (action === 'current') {
    await window.api.setCurrentTask(id);
  } else {
    // 点击整行也设为当前任务
    await window.api.setCurrentTask(id);
  }
});

// 双击任务标题进入 inline 编辑（已完成任务不可编辑）
el.taskList.addEventListener('dblclick', (e) => {
  const item = e.target.closest('.task-item');
  if (!item || item.classList.contains('done')) return;
  if (e.target.closest('.task-radio') || e.target.closest('.task-del') || e.target.closest('.task-current-dot')) return;
  const id = item.dataset.id;
  const task = ((current && current.tasks) || []).find(t => t.id === id);
  if (!task) return;
  enterTaskEdit(item, task);
});

function enterTaskEdit(item, task) {
  const body = item.querySelector('.task-body');
  if (!body || body.classList.contains('editing')) return;
  const origTitle = task.title;
  const origEst = task.estimate || 1;
  body.classList.add('editing');
  body.innerHTML = `<input class="task-edit-input" type="text" maxlength="80" value="${escapeHtml(origTitle)}"><input class="task-edit-est" type="number" min="1" max="20" value="${origEst}" title="预估番茄数">`;
  const titleInput = body.querySelector('.task-edit-input');
  const estInput = body.querySelector('.task-edit-est');
  titleInput.focus();
  titleInput.select();
  let settled = false;
  async function save() {
    if (settled) return;
    settled = true;
    const newTitle = titleInput.value.trim();
    const newEst = Math.max(1, parseInt(estInput.value, 10) || 1);
    if (newTitle && (newTitle !== origTitle || newEst !== origEst)) {
      await window.api.updateTask(task.id, { title: newTitle, estimate: newEst });
      toast('任务已更新');
    } else {
      loadState(); // 无变化或空标题，还原
    }
  }
  function cancel() { if (settled) return; settled = true; loadState(); }
  titleInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); save(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
  });
  estInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); save(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
  });
  titleInput.addEventListener('blur', () => { setTimeout(save, 150); });
}

// 设置
el.settingsBtn.addEventListener('click', openSettings);
el.settingsClose.addEventListener('click', () => el.settingsMask.classList.remove('show'));
document.getElementById('settingsCancel').addEventListener('click', () => el.settingsMask.classList.remove('show'));
el.settingsMask.addEventListener('click', (e) => { if (e.target === el.settingsMask) el.settingsMask.classList.remove('show'); });

function openSettings() {
  if (!current || !current.config) return;
  document.getElementById('cfgWork').value = current.config.workDuration;
  document.getElementById('cfgShort').value = current.config.shortBreak;
  document.getElementById('cfgLong').value = current.config.longBreak;
  document.getElementById('cfgInterval').value = current.config.longBreakInterval;
  document.getElementById('cfgGoal').value = current.config.dailyGoal;
  document.getElementById('cfgWeekGoal').value = current.config.weeklyGoal || 30;
  document.getElementById('cfgStrict').checked = !!current.config.strictMode;
  document.getElementById('cfgSound').checked = !!current.config.soundEnabled;
  document.getElementById('cfgNoise').checked = !!current.config.whiteNoise;
  document.getElementById('cfgAutoBreak').checked = current.config.autoStartBreak !== false;
  document.getElementById('cfgAutoWork').checked = !!current.config.autoStartWork;
  el.settingsMask.classList.add('show');
}

el.settingsSave.addEventListener('click', async () => {
  const raw = {
    workDuration: parseInt(document.getElementById('cfgWork').value,10),
    shortBreak: parseInt(document.getElementById('cfgShort').value,10),
    longBreak: parseInt(document.getElementById('cfgLong').value,10),
    longBreakInterval: parseInt(document.getElementById('cfgInterval').value,10),
    dailyGoal: parseInt(document.getElementById('cfgGoal').value,10),
    weeklyGoal: parseInt(document.getElementById('cfgWeekGoal').value,10)
  };
  const cfg = {
    workDuration: clamp(raw.workDuration, 1, 90),
    shortBreak: clamp(raw.shortBreak, 1, 30),
    longBreak: clamp(raw.longBreak, 1, 60),
    longBreakInterval: clamp(raw.longBreakInterval, 2, 12),
    dailyGoal: clamp(raw.dailyGoal, 1, 30),
    weeklyGoal: clamp(raw.weeklyGoal, 1, 100),
    strictMode: document.getElementById('cfgStrict').checked,
    soundEnabled: document.getElementById('cfgSound').checked,
    whiteNoise: document.getElementById('cfgNoise').checked,
    autoStartBreak: document.getElementById('cfgAutoBreak').checked,
    autoStartWork: document.getElementById('cfgAutoWork').checked
  };
  // 检测是否有数值被自动修正，提示用户
  const limits = { workDuration:[1,90], shortBreak:[1,30], longBreak:[1,60], longBreakInterval:[2,12], dailyGoal:[1,30], weeklyGoal:[1,100] };
  const adjusted = [];
  const nameMap = {workDuration:'专注',shortBreak:'短休息',longBreak:'长休息',longBreakInterval:'长休息间隔',dailyGoal:'每日目标',weeklyGoal:'每周目标'};
  for (const k in limits) {
    const v = raw[k], [lo, hi] = limits[k];
    if (isNaN(v)) { adjusted.push(nameMap[k] + '已填默认值'); }
    else if (v < lo) { adjusted.push(nameMap[k] + '已调整为最小 ' + lo); }
    else if (v > hi) { adjusted.push(nameMap[k] + '已调整为最大 ' + hi); }
  }
  await window.api.saveConfig(cfg);
  applyWhiteNoise(cfg.whiteNoise);
  el.settingsMask.classList.remove('show');
  if (adjusted.length) toast(`已保存（${adjusted.join('、')}）`);
  else toast('设置已保存');
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

// ---- 键盘快捷键 ----
// Space 开始/暂停，R 重置，S 跳过；输入框中不触发
document.addEventListener('keydown', async (e) => {
  // 设置弹层打开时：Escape 关闭弹层，其余快捷键不触发
  if (el.settingsMask.classList.contains('show')) {
    if (e.key === 'Escape') el.settingsMask.classList.remove('show');
    return;
  }
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
  const key = e.key.toLowerCase();
  if (key === ' ' || key === 'spacebar') {
    e.preventDefault();
    ensureAudio();
    if (current && (current.state === 'working' || current.state === 'short_break' || current.state === 'long_break')) {
      await window.api.pause();
    } else {
      await window.api.start();
    }
  } else if (key === 'r') {
    e.preventDefault();
    await window.api.reset();
    toast('已重置');
  } else if (key === 's') {
    e.preventDefault();
    const ev = await window.api.skip();
    if (!ev) {
      if (current && (current.state === 'idle' || current.state === 'paused')) toast('计时未开始');
      else toast('严格模式下休息不可跳过');
    }
  } else if (key === '1' || key === '2' || key === '3') {
    // 数字键 1/2/3 切换 专注/短休息/长休息
    e.preventDefault();
    const map = { '1': 'working', '2': 'short_break', '3': 'long_break' };
    const ph = map[key];
    const curPhase = current && (current.state === 'paused' ? current.pausedState : current.state);
    if (curPhase === ph) return; // 已在该阶段，不操作
    await window.api.switchPhase(ph);
    toast(`已切换到「${PHASE_TAB_LABEL[ph] || ''}」`);
  } else if (key === 'n') {
    // N 键快速聚焦任务输入框，便于键盘党快速添加任务
    e.preventDefault();
    el.taskInput.focus();
  }
});

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
      celebrate();
      toast(`完成第 ${data.event.workSessionsToday} 个番茄`);
    } else {
      renderTimer(current);
    }
    // 阶段切换后若因关闭自动开始而暂停，提示用户
    if (data.pausedForAutoStart) {
      toast('已暂停，按空格继续');
    }
  }
});

window.api.onNotify((data) => {
  if (data.type === 'chime') playChime();
});

async function loadState() {
  const state = await window.api.getState();
  render(state);
  applyWhiteNoise(state.config && state.config.whiteNoise);
}

// 初始化
loadState();
