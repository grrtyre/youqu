// 闹钟管家 - 触发窗口逻辑
// 接收主进程的 trigger:fire 事件，显示闹钟信息，播放合成铃声（循环 + 渐强）

const triggerApi = window.alarmAPI;

let currentAlarm = null;
let currentSettings = null;
let audioCtx = null;
let activeNodes = [];   // 当前播放中的节点，关闭闹钟时停止
let fadeInTimer = null;
let loopTimer = null;
let clockTimer = null;

// 接收触发事件
triggerApi.onTriggerFire((payload) => {
  currentAlarm = payload.alarm;
  currentSettings = payload.settings || {};
  renderAlarm();
  startRinging();
  startClock();
});

function renderAlarm() {
  const a = currentAlarm;
  if (!a) return;
  document.getElementById('title').textContent = a.label || '闹钟';
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('time').textContent = hh + ':' + mm;

  const snoozeBtn = document.getElementById('btnSnooze');
  snoozeBtn.textContent = '贪睡 ' + (a.snoozeMinutes || 5) + ' 分钟';

  // 已贪睡次数显示
  const snoozeInfo = document.getElementById('snoozeInfo');
  if (a.snoozeCount > 0) {
    snoozeInfo.textContent = '已贪睡 ' + a.snoozeCount + ' 次 / 最多 ' + (a.maxSnoozeCount === 99 ? '无限' : (a.maxSnoozeCount || 3) + ' 次');
  } else {
    snoozeInfo.textContent = '';
  }
}

function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('time').textContent = hh + ':' + mm;
  }, 1000);
}

// 铃声：循环播放，每次循环播放一次 sound，间隔 0.8 秒
function startRinging() {
  stopRinging();
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const sound = currentAlarm.sound || 'chime';
  const maxVolume = currentSettings.maxVolume != null ? currentSettings.maxVolume : 0.9;
  const fadeIn = currentSettings.volumeFadeIn;
  const fadeInDur = currentSettings.volumeFadeInDuration || 15;

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = fadeIn ? 0 : maxVolume;
  masterGain.connect(audioCtx.destination);
  activeNodes.push(masterGain);

  // 渐强
  if (fadeIn) {
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(maxVolume, audioCtx.currentTime + fadeInDur);
  }

  const playOnce = () => {
    playSoundPattern(sound, masterGain, 2.5);
  };
  playOnce();
  // 循环：每 3.3 秒重播一次
  loopTimer = setInterval(playOnce, 3300);
  activeNodes.push({ disconnect: () => clearInterval(loopTimer) });
}

function stopRinging() {
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  if (fadeInTimer) { clearInterval(fadeInTimer); fadeInTimer = null; }
  activeNodes.forEach(n => {
    try { n.disconnect && n.disconnect(); } catch (e) {}
    try { n.stop && n.stop(); } catch (e) {}
  });
  activeNodes = [];
}

// 铃声合成（与 renderer.js 的版本相同，但用于持续循环）
function playSoundPattern(type, dest, duration) {
  const ctx = audioCtx;
  const now = ctx.currentTime;
  switch (type) {
    case 'chime': {
      const notes = [880, 988, 1175, 1319, 1568];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        const start = now + i * 0.18;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.5, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, start + 1.5);
        osc.connect(g); g.connect(dest);
        osc.start(start); osc.stop(start + 1.6);
      });
      break;
    }
    case 'bell': {
      const base = 220;
      [1, 2, 3, 5.4].forEach((mult, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = base * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.35 / (idx + 1), now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
        osc.connect(g); g.connect(dest);
        osc.start(now); osc.stop(now + 2.6);
      });
      break;
    }
    case 'marimba': {
      const notes = [523, 659, 784, 659, 523];
      notes.forEach((freq, i) => {
        const start = now + i * 0.25;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.5, start + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
        osc.connect(g); g.connect(dest);
        osc.start(start); osc.stop(start + 0.6);
      });
      break;
    }
    case 'beep': {
      for (let i = 0; i < 4; i++) {
        const start = now + i * 0.4;
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 1000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.25, start + 0.01);
        g.gain.setValueAtTime(0.25, start + 0.2);
        g.gain.linearRampToValueAtTime(0, start + 0.25);
        osc.connect(g); g.connect(dest);
        osc.start(start); osc.stop(start + 0.3);
      }
      break;
    }
    case 'birds': {
      for (let i = 0; i < 8; i++) {
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
        osc.connect(g); g.connect(dest);
        osc.start(start); osc.stop(start + 0.25);
      }
      break;
    }
  }
}

// 贪睡按钮
document.getElementById('btnSnooze').addEventListener('click', async () => {
  if (!currentAlarm) return;
  const ok = await triggerApi.snoozeAlarm(currentAlarm.id);
  if (ok) {
    stopRinging();
    if (clockTimer) clearInterval(clockTimer);
    await triggerApi.closeTrigger();
  } else {
    // 贪睡次数用尽
    const btn = document.getElementById('btnSnooze');
    btn.disabled = true;
    btn.textContent = '贪睡次数已用尽';
    document.getElementById('snoozeInfo').textContent = '请关闭闹钟';
  }
});

// 关闭按钮
document.getElementById('btnDismiss').addEventListener('click', async () => {
  if (!currentAlarm) return;
  await triggerApi.dismissAlarm(currentAlarm.id);
  stopRinging();
  if (clockTimer) clearInterval(clockTimer);
  await triggerApi.closeTrigger();
});
