// 闹钟管家 - 主窗口渲染逻辑
// 负责：时钟、闹钟列表渲染、模态框、设置、导入导出、铃声试听

const api = window.alarmAPI;

let appData = null;       // {alarms, settings, logs}
let editingId = null;     // 当前编辑的闹钟 ID（null 表示新增）
let tickTimer = null;     // 每秒更新倒计时

// ============ 启动 ============
async function init() {
  appData = await api.loadData();
  renderAll();
  startClock();
  startTick();
  bindEvents();
  bindIPCEvents();
}

// ============ 时钟 ============
function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  document.querySelector('.clock-time').textContent = hh + ':' + mm;
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  document.querySelector('.clock-date').textContent =
    now.getMonth() + 1 + '月' + now.getDate() + '日 周' + weekday;
}

// 每秒更新倒计时（状态卡片 + 卡片下次时间）
function startTick() {
  tickTimer = setInterval(() => {
    updateNextAlarm();
    updateCardNextTimes();
  }, 1000);
}

// ============ 渲染 ============
function renderAll() {
  renderAlarmList();
  updateNextAlarm();
}

function renderAlarmList() {
  const list = document.getElementById('alarmList');
  const empty = document.getElementById('emptyState');
  // 清空除了 emptyState 之外的元素
  Array.from(list.children).forEach(c => {
    if (c.id !== 'emptyState') c.remove();
  });

  const alarms = (appData.alarms || []).slice().sort((a, b) => {
    // 按启用状态优先，再按下次触发时间，再按小时分钟
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    if (a.nextTrigger && b.nextTrigger) return a.nextTrigger - b.nextTrigger;
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
  });

  if (alarms.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const alarm of alarms) {
    list.appendChild(createAlarmCard(alarm));
  }
}

function createAlarmCard(alarm) {
  const card = document.createElement('div');
  card.className = 'alarm-card' + (alarm.enabled ? '' : ' disabled');
  card.dataset.id = alarm.id;

  const time = String(alarm.hour).padStart(2, '0') + ':' + String(alarm.minute).padStart(2, '0');
  const repeatText = describeRepeat(alarm.repeat);
  const nextText = describeNextTime(alarm.nextTrigger);

  card.innerHTML = `
    <div class="card-time">${time}</div>
    <div class="card-label">${escapeHtml(alarm.label || '闹钟')}</div>
    <div><span class="card-repeat">${escapeHtml(repeatText)}</span></div>
    <div class="card-next">下次：${escapeHtml(nextText)}</div>
    <div class="card-footer">
      <div class="card-actions">
        <button class="btn-card btn-edit" title="编辑">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M5 19h2.5L17 9.5 14.5 7 5 16.5V19Zm12-13l2 2-2 2-2-2 2-2Z"/></svg>
        </button>
        <button class="btn-card btn-test" title="测试">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7L8 5Z"/></svg>
        </button>
        <button class="btn-card danger btn-delete" title="删除">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 7h12v2H6V7Zm2 3h8l-1 11H9L8 10Zm2-6h4l1 2H7l1-2Z"/></svg>
        </button>
      </div>
      <label class="switch">
        <input type="checkbox" class="card-toggle" ${alarm.enabled ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>
  `;

  // 事件
  card.querySelector('.btn-edit').addEventListener('click', () => openEditModal(alarm.id));
  card.querySelector('.btn-test').addEventListener('click', async () => {
    await api.testAlarm(alarm.id);
    showToast('已触发测试');
  });
  card.querySelector('.btn-delete').addEventListener('click', async () => {
    if (confirm('确定删除该闹钟？')) {
      await api.deleteAlarm(alarm.id);
      appData.alarms = appData.alarms.filter(a => a.id !== alarm.id);
      renderAll();
      showToast('已删除');
    }
  });
  card.querySelector('.card-toggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    const updated = await api.toggleAlarm(alarm.id, enabled);
    if (updated) {
      const idx = appData.alarms.findIndex(a => a.id === alarm.id);
      appData.alarms[idx] = updated;
      renderAll();
    }
  });

  return card;
}

// 更新状态卡片：下一闹钟信息
function updateNextAlarm() {
  const alarms = (appData.alarms || []).filter(a => a.enabled && a.nextTrigger);
  const next = alarms.sort((a, b) => a.nextTrigger - b.nextTrigger)[0];
  const nameEl = document.getElementById('nextAlarmName');
  const timeEl = document.getElementById('nextAlarmTime');
  const cdEl = document.getElementById('nextAlarmCountdown');
  if (!next) {
    nameEl.textContent = '无活动闹钟';
    timeEl.textContent = '—';
    cdEl.textContent = '点击 + 添加';
    return;
  }
  nameEl.textContent = next.label || '闹钟';
  timeEl.textContent = describeNextTime(next.nextTrigger);
  cdEl.textContent = describeCountdown(next.nextTrigger);
}

// 更新每张卡片的下次时间
function updateCardNextTimes() {
  document.querySelectorAll('.alarm-card').forEach(card => {
    const id = card.dataset.id;
    const alarm = appData.alarms.find(a => a.id === id);
    if (!alarm) return;
    const nextEl = card.querySelector('.card-next');
    if (nextEl) {
      nextEl.textContent = '下次：' + describeNextTime(alarm.nextTrigger);
    }
  });
}

// ============ 模态框：添加/编辑闹钟 ============
function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = '添加闹钟';
  resetForm();
  // 默认时间：当前时间向上取 5 分钟
  const now = new Date();
  let h = now.getHours();
  let m = Math.ceil(now.getMinutes() / 5) * 5;
  if (m >= 60) { m = 0; h = (h + 1) % 24; }
  document.getElementById('inpHour').value = h;
  document.getElementById('inpMinute').value = m;
  document.getElementById('inpLabel').value = '';
  document.getElementById('inpRepeat').value = 'once';
  document.getElementById('inpSound').value = appData.settings.defaultSound || 'chime';
  document.getElementById('inpSnoozeMin').value = String(appData.settings.defaultSnoozeMinutes || 5);
  document.getElementById('inpMaxSnooze').value = String(appData.settings.maxSnoozeCount || 3);
  document.getElementById('inpVolume').value = String(Math.round((appData.settings.maxVolume || 0.9) * 100));
  document.getElementById('volumeValue').textContent = document.getElementById('inpVolume').value + '%';
  document.getElementById('inpEnabled').checked = true;
  toggleRepeatFields();
  document.getElementById('modalBackdrop').classList.add('show');
  setTimeout(() => document.getElementById('inpLabel').focus(), 100);
}

function openEditModal(id) {
  const alarm = appData.alarms.find(a => a.id === id);
  if (!alarm) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = '编辑闹钟';
  document.getElementById('inpLabel').value = alarm.label || '';
  document.getElementById('inpHour').value = alarm.hour;
  document.getElementById('inpMinute').value = alarm.minute;
  document.getElementById('inpRepeat').value = alarm.repeat.type;
  document.getElementById('inpSound').value = alarm.sound || 'chime';
  document.getElementById('inpSnoozeMin').value = String(alarm.snoozeMinutes || 5);
  document.getElementById('inpMaxSnooze').value = String(alarm.maxSnoozeCount || 3);
  document.getElementById('inpVolume').value = String(Math.round((alarm.volume || 0.9) * 100));
  document.getElementById('volumeValue').textContent = document.getElementById('inpVolume').value + '%';
  document.getElementById('inpEnabled').checked = !!alarm.enabled;

  // 周几选择
  document.querySelectorAll('#weekdayPicker button').forEach(b => {
    b.classList.toggle('active', (alarm.repeat.weekdays || []).includes(parseInt(b.dataset.wd)));
  });
  // 农历选择
  if (alarm.repeat.lunarYear) document.getElementById('inpLunarYear').value = String(alarm.repeat.lunarYear);
  if (alarm.repeat.lunarMonth) document.getElementById('inpLunarMonth').value = String(alarm.repeat.lunarMonth);
  if (alarm.repeat.lunarDay) document.getElementById('inpLunarDay').value = String(alarm.repeat.lunarDay);
  document.getElementById('inpLunarLeap').checked = !!alarm.repeat.isLeap;

  toggleRepeatFields();
  document.getElementById('modalBackdrop').classList.add('show');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('show');
  editingId = null;
}

function resetForm() {
  document.querySelectorAll('#weekdayPicker button').forEach(b => b.classList.remove('active'));
}

function toggleRepeatFields() {
  const type = document.getElementById('inpRepeat').value;
  document.getElementById('weekdaysRow').style.display = type === 'custom' ? 'flex' : 'none';
  document.getElementById('lunarRow').style.display = (type === 'lunar-annual' || type === 'lunar-once') ? 'flex' : 'none';
  // lunar-once 显示年份；lunar-annual 隐藏年份
  const yearSel = document.getElementById('inpLunarYear');
  yearSel.parentElement.style.display = (type === 'lunar-once') ? 'flex' : 'flex';
  yearSel.style.display = (type === 'lunar-once') ? 'inline-block' : 'none';
  yearSel.nextElementSibling.style.display = (type === 'lunar-once') ? 'inline' : 'none';
}

async function saveAlarmFromForm() {
  const label = document.getElementById('inpLabel').value.trim() || '闹钟';
  const hour = parseInt(document.getElementById('inpHour').value);
  const minute = parseInt(document.getElementById('inpMinute').value);
  const repeatType = document.getElementById('inpRepeat').value;
  const sound = document.getElementById('inpSound').value;
  const snoozeMinutes = parseInt(document.getElementById('inpSnoozeMin').value);
  const maxSnoozeCount = parseInt(document.getElementById('inpMaxSnooze').value);
  const volume = parseInt(document.getElementById('inpVolume').value) / 100;
  const enabled = document.getElementById('inpEnabled').checked;

  const repeat = { type: repeatType };
  if (repeatType === 'custom') {
    repeat.weekdays = Array.from(document.querySelectorAll('#weekdayPicker button.active'))
      .map(b => parseInt(b.dataset.wd));
    if (repeat.weekdays.length === 0) {
      showToast('请至少选择一个星期', 'warn');
      return;
    }
  } else if (repeatType === 'lunar-annual' || repeatType === 'lunar-once') {
    if (repeatType === 'lunar-once') {
      repeat.lunarYear = parseInt(document.getElementById('inpLunarYear').value);
    }
    repeat.lunarMonth = parseInt(document.getElementById('inpLunarMonth').value);
    repeat.lunarDay = parseInt(document.getElementById('inpLunarDay').value);
    repeat.isLeap = document.getElementById('inpLunarLeap').checked;
  }

  const alarm = {
    id: editingId || undefined,
    label: label,
    hour: hour,
    minute: minute,
    enabled: enabled,
    repeat: repeat,
    sound: sound,
    snoozeMinutes: snoozeMinutes,
    maxSnoozeCount: maxSnoozeCount,
    volume: volume
  };

  const saved = await api.upsertAlarm(alarm);
  if (editingId) {
    const idx = appData.alarms.findIndex(a => a.id === editingId);
    if (idx >= 0) appData.alarms[idx] = saved;
  } else {
    appData.alarms.push(saved);
  }
  renderAll();
  closeModal();
  showToast(editingId ? '已保存修改' : '已添加闹钟');
}

// ============ 设置面板 ============
function openSettings() {
  const s = appData.settings;
  document.getElementById('setDefSound').value = s.defaultSound || 'chime';
  document.getElementById('setDefSnooze').value = String(s.defaultSnoozeMinutes || 5);
  document.getElementById('setDefMaxSnooze').value = String(s.maxSnoozeCount || 3);
  document.getElementById('setFadeIn').checked = !!s.volumeFadeIn;
  document.getElementById('setFadeInDur').value = String(s.volumeFadeInDuration || 15);
  document.getElementById('setMaxVol').value = String(Math.round((s.maxVolume || 0.9) * 100));
  document.getElementById('setMaxVolValue').textContent = document.getElementById('setMaxVol').value + '%';
  document.getElementById('setNotif').checked = !!s.notificationEnabled;
  document.getElementById('setFront').checked = !!s.bringToFront;
  document.getElementById('settingsBackdrop').classList.add('show');
}

function closeSettings() {
  document.getElementById('settingsBackdrop').classList.remove('show');
}

async function saveSettings() {
  const settings = {
    defaultSound: document.getElementById('setDefSound').value,
    defaultSnoozeMinutes: parseInt(document.getElementById('setDefSnooze').value),
    maxSnoozeCount: parseInt(document.getElementById('setDefMaxSnooze').value),
    volumeFadeIn: document.getElementById('setFadeIn').checked,
    volumeFadeInDuration: parseInt(document.getElementById('setFadeInDur').value) || 15,
    maxVolume: parseInt(document.getElementById('setMaxVol').value) / 100,
    notificationEnabled: document.getElementById('setNotif').checked,
    bringToFront: document.getElementById('setFront').checked
  };
  appData.settings = await api.updateSettings(settings);
  closeSettings();
  showToast('设置已保存');
}

// ============ 导入导出 ============
async function exportData() {
  const json = await api.exportData();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'alarm-manager-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 JSON 备份');
}

async function importData() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) { resolve(); return; }
      const text = await file.text();
      const ok = await api.importData(text);
      if (ok) {
        appData = await api.loadData();
        renderAll();
        showToast('导入成功');
      } else {
        showToast('导入失败：文件格式错误', 'warn');
      }
      resolve();
    };
    input.click();
  });
}

// ============ 铃声试听（Web Audio 合成）============
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playSound(type, volume, duration) {
  const ctx = getAudioCtx();
  volume = volume != null ? volume : 0.7;
  duration = duration || 3;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  if (type === 'chime') {
    playChime(ctx, masterGain, duration);
  } else if (type === 'bell') {
    playBell(ctx, masterGain, duration);
  } else if (type === 'marimba') {
    playMarimba(ctx, masterGain, duration);
  } else if (type === 'beep') {
    playBeep(ctx, masterGain, duration);
  } else if (type === 'birds') {
    playBirds(ctx, masterGain, duration);
  }
}

function playChime(ctx, dest, duration) {
  // 风铃：5 个高频音符，依次出现
  const notes = [880, 988, 1175, 1319, 1568];
  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const start = now + i * 0.18;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.6, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + 1.5);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + 1.6);
  });
}

function playBell(ctx, dest, duration) {
  // 钟声：基频 + 5 倍频谐波
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const start = now + i * 1.0;
    const base = 220 * (i === 0 ? 1 : 1.2);
    [1, 2, 3, 5.4].forEach((mult, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.4 / (idx + 1), start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 2.5);
      osc.connect(g);
      g.connect(dest);
      osc.start(start);
      osc.stop(start + 2.6);
    });
  }
}

function playMarimba(ctx, dest, duration) {
  // 马林巴：温和衰减的正弦
  const notes = [523, 659, 784, 659, 523];
  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const start = now + i * 0.25;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.5, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + 0.6);
  });
}

function playBeep(ctx, dest, duration) {
  // 蜂鸣：方波，高频
  const now = ctx.currentTime;
  for (let i = 0; i < 4; i++) {
    const start = now + i * 0.4;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.3, start + 0.01);
    g.gain.setValueAtTime(0.3, start + 0.2);
    g.gain.linearRampToValueAtTime(0, start + 0.25);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + 0.3);
  }
}

function playBirds(ctx, dest, duration) {
  // 鸟鸣：高频扫频
  const now = ctx.currentTime;
  for (let i = 0; i < 6; i++) {
    const start = now + i * 0.3 + Math.random() * 0.1;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000 + Math.random() * 500, start);
    osc.frequency.linearRampToValueAtTime(3000 + Math.random() * 1000, start + 0.08);
    osc.frequency.linearRampToValueAtTime(1500, start + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.3, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + 0.25);
  }
}

// ============ 工具函数 ============
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function describeRepeat(rep) {
  if (!rep || !rep.type) return '一次性';
  const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'];
  const lunarDayName = (d) => {
    const p = ['初', '十', '廿', '卅'];
    const s = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    if (d === 10) return '初十';
    if (d === 20) return '二十';
    if (d === 30) return '三十';
    return p[Math.floor((d - 1) / 10)] + s[d % 10];
  };
  switch (rep.type) {
    case 'once': return '一次性';
    case 'daily': return '每天';
    case 'weekdays': return '工作日';
    case 'weekend': return '周末';
    case 'custom': {
      if (!rep.weekdays || rep.weekdays.length === 0) return '自定义';
      return '每周 ' + rep.weekdays.slice().sort().map(w => WEEKDAY_CN[w]).join('、');
    }
    case 'lunar-annual':
      return '农历每年 ' + (rep.isLeap ? '闰' : '') + rep.lunarMonth + '月' + lunarDayName(rep.lunarDay);
    case 'lunar-once':
      return '农历 ' + (rep.lunarYear || '') + '年' + (rep.isLeap ? '闰' : '') + rep.lunarMonth + '月' + lunarDayName(rep.lunarDay);
    default: return '未知';
  }
}

function describeNextTime(nextTs) {
  if (nextTs == null) return '—';
  const d = new Date(nextTs);
  const now = new Date();
  const sameD = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameD) return '今天 ' + hh + ':' + mm;
  if (isTomorrow) return '明天 ' + hh + ':' + mm;
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh + ':' + mm;
}

function describeCountdown(nextTs) {
  if (nextTs == null) return '—';
  let diff = nextTs - Date.now();
  if (diff < 0) diff = 0;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (days > 0) return '还有 ' + days + ' 天 ' + hours + ' 小时';
  if (hours > 0) return '还有 ' + hours + ' 时 ' + mins + ' 分';
  if (mins > 0) return '还有 ' + mins + ' 分 ' + secs + ' 秒';
  return '还有 ' + secs + ' 秒';
}

let toastTimer = null;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = type === 'warn' ? 'rgba(255, 149, 0, 0.92)' : 'rgba(29, 29, 31, 0.92)';
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ============ 事件绑定 ============
function bindEvents() {
  // 顶部按钮
  document.getElementById('btnAdd').addEventListener('click', openAddModal);
  document.getElementById('btnSettings').addEventListener('click', openSettings);

  // 模态框
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnSave').addEventListener('click', saveAlarmFromForm);
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
  document.getElementById('inpRepeat').addEventListener('change', toggleRepeatFields);

  // 周几选择
  document.querySelectorAll('#weekdayPicker button').forEach(b => {
    b.addEventListener('click', () => b.classList.toggle('active'));
  });

  // 音量显示
  document.getElementById('inpVolume').addEventListener('input', (e) => {
    document.getElementById('volumeValue').textContent = e.target.value + '%';
  });

  // 试听铃声
  document.getElementById('btnTestSound').addEventListener('click', () => {
    const sound = document.getElementById('inpSound').value;
    const vol = parseInt(document.getElementById('inpVolume').value) / 100;
    playSound(sound, vol, 2);
  });

  // 设置面板
  document.getElementById('btnCloseSettings').addEventListener('click', closeSettings);
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('settingsBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'settingsBackdrop') closeSettings();
  });
  document.getElementById('setMaxVol').addEventListener('input', (e) => {
    document.getElementById('setMaxVolValue').textContent = e.target.value + '%';
  });
  document.getElementById('btnExport').addEventListener('click', exportData);
  document.getElementById('btnImport').addEventListener('click', importData);

  // 快捷键：Ctrl+N 添加
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openAddModal();
    }
    if (e.key === 'Escape') {
      closeModal();
      closeSettings();
    }
  });
}

function bindIPCEvents() {
  // 闹钟触发后刷新列表
  api.onAlarmFired((alarm) => {
    const idx = appData.alarms.findIndex(a => a.id === alarm.id);
    if (idx >= 0) {
      appData.alarms[idx] = alarm;
      renderAll();
    }
    showToast('⏰ 闹钟响铃：' + (alarm.label || ''));
  });

  // 主进程 tick（每分钟一次）
  api.onTick(() => {
    updateNextAlarm();
    updateCardNextTimes();
  });

  // 触发"快速添加"
  api.onTrigger(() => {
    setTimeout(openAddModal, 200);
  });
}

// ============ 初始化下拉选项 ============
function initSelects() {
  const hourSel = document.getElementById('inpHour');
  for (let i = 0; i < 24; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = String(i).padStart(2, '0');
    hourSel.appendChild(opt);
  }
  const minSel = document.getElementById('inpMinute');
  for (let i = 0; i < 60; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = String(i).padStart(2, '0');
    minSel.appendChild(opt);
  }
  // 农历年：1900-2100
  const lunarYearSel = document.getElementById('inpLunarYear');
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y <= thisYear + 10; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = String(y);
    lunarYearSel.appendChild(opt);
  }
  // 农历月 1..12
  const lunarMonthSel = document.getElementById('inpLunarMonth');
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = String(m);
    lunarMonthSel.appendChild(opt);
  }
  // 农历日 1..30
  const lunarDaySel = document.getElementById('inpLunarDay');
  for (let d = 1; d <= 30; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = String(d);
    lunarDaySel.appendChild(opt);
  }
}

// 启动
initSelects();
init();
