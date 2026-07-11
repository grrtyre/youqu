// renderer.js — 主仪表盘渲染逻辑
'use strict';

const BREAK_META = {
  micro: { name: '微休息', desc: '20-20-20 法则，看远处 6 米外' },
  short: { name: '短休息', desc: '站起身活动、喝水、远眺' },
  long:  { name: '长休息', desc: '离开屏幕，做完整眼保健操' }
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let cachedSettings = null;
let countdownRingCircumference = 2 * Math.PI * 86; // 540.35

// 初始化
async function init() {
  cachedSettings = await window.api.getSettings();
  renderBreakRows(cachedSettings);
  renderPrefs(cachedSettings);
  await refreshStats();
  await refreshState();
  bindActions();
  bindLiveEvents();
  const info = await window.api.getAppInfo();
  $('#footer-version').textContent = `${info.name} v${info.version}`;
}

function fmtTime(sec) {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// === 倒计时与状态 ===
async function refreshState() {
  const st = await window.api.getState();
  applyState(st);
}

function applyState(payload) {
  const status = $('#hero-status');
  const time = $('#hero-time');
  const desc = $('#hero-desc');
  const ring = $('#ring-progress');
  const btnPause = $('#btn-pause');
  const btnResume = $('#btn-resume');

  if (payload.paused) {
    status.textContent = '已暂停';
    status.style.background = '#fff4e0';
    status.style.color = '#ff9500';
    status.style.borderColor = '#ffd9a8';
    time.textContent = `${payload.pauseMinutesLeft}m`;
    desc.textContent = '恢复提醒后将自动继续计时';
    ring.setAttribute('stroke-dashoffset', countdownRingCircumference);
    btnPause.classList.add('hidden');
    btnResume.classList.remove('hidden');
    return;
  }

  if (payload.state === 'break') {
    status.textContent = '休息中…';
    status.style.background = '#e8f8ec';
    status.style.color = '#34c759';
    status.style.borderColor = '#bde8c6';
    time.textContent = '休息';
    desc.textContent = '请放下手头工作，跟着引导放松眼睛';
    btnPause.classList.remove('hidden');
    btnResume.classList.add('hidden');
    return;
  }

  // 默认蓝色态
  status.style.background = '#eef5ff';
  status.style.color = '#007aff';
  status.style.borderColor = '#d8e8ff';
  btnPause.classList.remove('hidden');
  btnResume.classList.add('hidden');

  if (!payload.nextType) {
    status.textContent = '未启用休息周期';
    time.textContent = '—';
    desc.textContent = '请在下方"休息周期"中开启一种休息';
    ring.setAttribute('stroke-dashoffset', countdownRingCircumference);
    return;
  }

  const meta = BREAK_META[payload.nextType];
  status.textContent = `下一项 · ${meta.name}`;
  time.textContent = fmtTime(payload.secondsToBreak);
  desc.textContent = meta.desc;

  // 环形倒计时：满圆逐渐消耗（蓝色始终可见，时间到时耗尽）
  const cfg = cachedSettings.breaks[payload.nextType];
  const total = cfg ? cfg.interval * 60 : 1200;
  const ratio = Math.max(0, Math.min(1, payload.secondsToBreak / total));
  ring.setAttribute('stroke-dashoffset', countdownRingCircumference * (1 - ratio));
}

function bindLiveEvents() {
  window.api.onCountdown((p) => applyState(p));
  window.api.onStateChanged(() => { refreshState(); refreshStats(); });
  window.api.onStatsUpdated(() => refreshStats());
}

// === 统计 ===
async function refreshStats() {
  const s = await window.api.getStats();
  $('#stat-today-completed').textContent = s.today.completed;
  $('#stat-today-skipped').textContent = s.today.skipped;
  $('#stat-today-seconds').textContent = Math.round(s.today.totalSec / 60);
  $('#stat-streak').textContent = s.streak;
  renderBars(s.weekly);
}

function renderBars(weekly) {
  const container = $('#bars');
  const yaxis = $('#chart-yaxis');
  container.innerHTML = '';
  yaxis.innerHTML = '';
  const todayKey = new Date().toISOString().slice(0, 10);
  const allZero = weekly.every(d => d.completed === 0 && d.skipped === 0);
  if (allZero) {
    const empty = document.createElement('div');
    empty.className = 'bars-empty';
    empty.textContent = '暂无数据，完成第一次休息后这里会显示近 7 天记录';
    container.appendChild(empty);
    return;
  }
  const rawMax = Math.max(...weekly.map(d => d.completed + d.skipped), 4);
  // 取整到 4 的倍数，确保 Y 轴刻度均匀
  const maxVal = Math.ceil(rawMax / 4) * 4;
  // Y 轴刻度：5 档均匀分布
  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    yTicks.push(Math.round((maxVal * i) / 4));
  }
  yTicks.forEach(t => {
    const lab = document.createElement('div');
    lab.textContent = t;
    yaxis.appendChild(lab);
  });
  weekly.forEach(d => {
    const col = document.createElement('div');
    col.className = 'bar-col';
    const valLab = document.createElement('div');
    valLab.className = 'bar-value';
    valLab.textContent = (d.completed + d.skipped) > 0 ? (d.completed + d.skipped) : '';
    const stack = document.createElement('div');
    stack.className = 'bar-stack';
    stack.title = `${d.date} · 完成 ${d.completed} / 跳过 ${d.skipped}`;
    const done = document.createElement('div');
    done.className = 'bar-done';
    done.style.height = `${(d.completed / maxVal) * 104}px`;
    const skip = document.createElement('div');
    skip.className = 'bar-skip';
    skip.style.height = `${(d.skipped / maxVal) * 104}px`;
    stack.appendChild(done);
    stack.appendChild(skip);
    const day = document.createElement('div');
    day.className = 'bar-day' + (d.date === todayKey ? ' bar-today' : '');
    const dt = new Date(d.date);
    day.textContent = ['日','一','二','三','四','五','六'][dt.getDay()];
    col.appendChild(valLab);
    col.appendChild(stack);
    col.appendChild(day);
    container.appendChild(col);
  });
}

// === 设置渲染 ===
function renderBreakRows(s) {
  const container = $('#break-rows');
  container.innerHTML = '';
  ['micro', 'short', 'long'].forEach(type => {
    const meta = BREAK_META[type];
    const cfg = s.breaks[type];
    const row = document.createElement('div');
    row.className = 'break-row' + (cfg.enabled ? '' : ' break-row-disabled');
    row.innerHTML = `
      <div class="br-head">
        <div>
          <div class="br-name">${meta.name}</div>
          <div class="br-desc">${meta.desc}</div>
        </div>
        <input type="checkbox" class="switch br-enabled" data-type="${type}" ${cfg.enabled ? 'checked' : ''}>
      </div>
      <div class="br-fields">
        <div class="br-field">
          <label>间隔（分钟）</label>
          <input type="number" class="num-input br-interval" data-type="${type}" min="1" max="240" value="${cfg.interval}"${cfg.enabled ? '' : ' disabled'}>
        </div>
        <div class="br-field">
          <label>时长（秒）</label>
          <input type="number" class="num-input br-duration" data-type="${type}" min="5" max="3600" value="${cfg.duration}"${cfg.enabled ? '' : ' disabled'}>
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  // 绑定变更
  $$('.br-enabled').forEach(el => {
    el.addEventListener('change', async (e) => {
      const type = e.target.dataset.type;
      const enabled = e.target.checked;
      // 同步切换输入框的禁用状态与卡片灰显
      const row = e.target.closest('.break-row');
      row.classList.toggle('break-row-disabled', !enabled);
      row.querySelectorAll('.br-interval, .br-duration').forEach(input => {
        input.disabled = !enabled;
      });
      const patch = { breaks: {} };
      patch.breaks[type] = { enabled };
      cachedSettings = await window.api.saveSettings(patch);
      await refreshState();
    });
  });
  $$('.br-interval, .br-duration').forEach(el => {
    el.addEventListener('change', async (e) => {
      const type = e.target.dataset.type;
      const field = e.target.classList.contains('br-interval') ? 'interval' : 'duration';
      const patch = { breaks: {} };
      patch.breaks[type] = {};
      patch.breaks[type][field] = Number(e.target.value);
      cachedSettings = await window.api.saveSettings(patch);
      await refreshState();
    });
  });
}

function renderPrefs(s) {
  $('#pref-warning').checked = s.warning.enabled;
  $('#pref-warning-lead').value = s.warning.leadTime;
  $('#pref-sound').checked = s.sound;
  $('#pref-fullscreen').checked = s.fullscreenSuppress;
  $('#pref-launch').checked = s.launchAtLogin;
  $('#pref-dnd').checked = s.dnd.enabled;
  $('#pref-dnd-start').value = s.dnd.start;
  $('#pref-dnd-end').value = s.dnd.end;
}

function bindActions() {
  $('#btn-rest-now').addEventListener('click', async () => {
    await window.api.triggerBreak(null);
  });
  $('#btn-pause').addEventListener('click', async () => {
    await window.api.pause(30);
    await refreshState();
  });
  $('#btn-resume').addEventListener('click', async () => {
    await window.api.resume();
    await refreshState();
  });

  // 偏好变更
  $('#pref-warning').addEventListener('change', async (e) => {
    cachedSettings = await window.api.saveSettings({ warning: { enabled: e.target.checked } });
  });
  $('#pref-warning-lead').addEventListener('change', async (e) => {
    cachedSettings = await window.api.saveSettings({ warning: { leadTime: Number(e.target.value) } });
  });
  $('#pref-sound').addEventListener('change', async (e) => {
    cachedSettings = await window.api.saveSettings({ sound: e.target.checked });
  });
  $('#pref-fullscreen').addEventListener('change', async (e) => {
    cachedSettings = await window.api.saveSettings({ fullscreenSuppress: e.target.checked });
  });
  $('#pref-launch').addEventListener('change', async (e) => {
    await window.api.setLaunchAtLogin(e.target.checked);
    cachedSettings = await window.api.getSettings();
  });
  $('#pref-dnd').addEventListener('change', async (e) => {
    cachedSettings = await window.api.saveSettings({ dnd: { enabled: e.target.checked } });
  });
  $('#pref-dnd-start').addEventListener('change', async (e) => {
    cachedSettings = await window.api.saveSettings({ dnd: { start: e.target.value } });
  });
  $('#pref-dnd-end').addEventListener('change', async (e) => {
    cachedSettings = await window.api.saveSettings({ dnd: { end: e.target.value } });
  });

  // 顶栏
  $('#btn-export').addEventListener('click', async () => {
    const r = await window.api.exportData();
    if (r.ok) alert(`已导出到：\n${r.path}`);
  });
  $('#btn-import').addEventListener('click', async () => {
    const r = await window.api.importData();
    if (r.ok) {
      alert(`导入成功：${r.historyCount} 条历史记录`);
      cachedSettings = await window.api.getSettings();
      renderBreakRows(cachedSettings);
      renderPrefs(cachedSettings);
      await refreshStats();
      await refreshState();
    } else if (r.error) {
      alert(`导入失败：${r.error}`);
    }
  });
  $('#link-afdian').addEventListener('click', async (e) => {
    e.preventDefault();
    const url = await window.api.getAfdianUrl();
    await window.api.openExternal(url);
  });
  $('#link-quit').addEventListener('click', async (e) => {
    e.preventDefault();
    await window.api.quitApp();
  });
  $('#btn-clear').addEventListener('click', async () => {
    if (!confirm('确定清空所有休息记录吗？此操作不可撤销。')) return;
    await window.api.clearHistory();
    await refreshStats();
  });
}

document.addEventListener('DOMContentLoaded', init);
