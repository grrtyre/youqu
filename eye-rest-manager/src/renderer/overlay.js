// overlay.js — 休息覆盖层逻辑
'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
let countdownSec = 0;
let totalSec = 0;
let tickHandle = null;
let exercises = [];
let exerciseIdx = 0;
let exerciseHandle = null;
let strictMode = false;

const EXERCISE_LIBRARY = {
  micro: [
    { id: 'blink',     title: '轻柔眨眼',     instruction: '缓慢闭合双眼，停顿 2 秒，再缓缓睁开。重复数次，让泪膜重新滋润眼球。', durationSec: 20, icon: '👁' },
    { id: 'far-focus', title: '远眺 20 英尺',  instruction: '将视线移向 6 米以外的远处景物，放松睫状肌，持续约 20 秒。', durationSec: 20, icon: '🌅' }
  ],
  short: [
    { id: 'blink',     title: '轻柔眨眼',     instruction: '缓慢闭合双眼，停顿 2 秒，再缓缓睁开。', durationSec: 20, icon: '👁' },
    { id: 'rotate',    title: '眼球转动',     instruction: '保持头部不动，眼球顺时针缓慢转动 5 圈，再逆时针 5 圈。', durationSec: 30, icon: '🔄' },
    { id: 'far-focus', title: '远眺',         instruction: '望向窗外远处景物 30 秒，让睫状肌彻底放松。', durationSec: 30, icon: '🌅' },
    { id: 'water',     title: '起身喝水',     instruction: '站起身走动几步，喝一口温水。', durationSec: 30, icon: '💧' }
  ],
  long: [
    { id: 'palming',     title: '掌心捂眼',     instruction: '双手搓热，掌心轻覆于闭合的双眼上，感受温热与黑暗，深呼吸放松。', durationSec: 40, icon: '🤲' },
    { id: 'rotate',      title: '眼球转动',     instruction: '保持头部不动，眼球顺时针缓慢转动 5 圈，再逆时针 5 圈。', durationSec: 30, icon: '🔄' },
    { id: 'focus-shift', title: '远近聚焦',     instruction: '先看鼻尖 3 秒，再望远处 3 秒，反复数次。', durationSec: 30, icon: '🔁' },
    { id: 'blink',       title: '轻柔眨眼',     instruction: '缓慢闭合双眼，停顿 2 秒，再缓缓睁开。', durationSec: 20, icon: '👁' },
    { id: 'water',       title: '起身喝水',     instruction: '站起身走动几步，喝一口温水。', durationSec: 30, icon: '💧' },
    { id: 'far-focus',   title: '远眺',         instruction: '望向窗外远处景物，让眼睛彻底放松。', durationSec: 30, icon: '🌅' }
  ]
};

function startBreak(info) {
  exercises = EXERCISE_LIBRARY[info.type] || EXERCISE_LIBRARY.micro;
  totalSec = info.durationSec;
  countdownSec = info.durationSec;
  strictMode = !!info.strictMode;

  const titleMap = { micro: '微休息', short: '短休息', long: '长休息' };
  $('#overlay-title').textContent = titleMap[info.type] || '休息一下';
  $('#overlay-sub').textContent = `共 ${info.durationSec} 秒，跟着引导放松眼睛`;

  // 严格模式：隐藏跳过/延后，禁用完成按钮，显示徽章
  if (strictMode) {
    $('#btn-skip').classList.add('hidden');
    $('#btn-snooze').classList.add('hidden');
    $('#btn-complete').classList.add('disabled');
    $('#btn-complete').disabled = true;
    $('#btn-complete').textContent = '请等待倒计时结束';
    $('#strict-badge').classList.remove('hidden');
  }

  // 渲染动作指示点
  const dots = $('#exercise-dots');
  dots.innerHTML = '';
  exercises.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'exercise-dot' + (i === 0 ? ' active' : '');
    dots.appendChild(d);
  });

  showExercise(0);
  startCountdown();
  startExerciseRotation();
}

function showExercise(idx) {
  exerciseIdx = idx;
  const e = exercises[idx];
  $('#exercise-icon').textContent = e.icon;
  $('#exercise-title').textContent = e.title;
  $('#exercise-instruction').textContent = e.instruction;
  $$('.exercise-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
}

function startExerciseRotation() {
  if (exerciseHandle) clearInterval(exerciseHandle);
  if (exercises.length <= 1) return;
  const perSec = Math.max(15, Math.floor(totalSec / exercises.length));
  exerciseHandle = setInterval(() => {
    const next = (exerciseIdx + 1) % exercises.length;
    showExercise(next);
  }, perSec * 1000);
}

function startCountdown() {
  updateCountdown();
  tickHandle = setInterval(() => {
    countdownSec -= 1;
    if (countdownSec <= 0) {
      finish('completed');
      return;
    }
    updateCountdown();
  }, 1000);
}

function updateCountdown() {
  $('#overlay-count').textContent = countdownSec;
  const ratio = Math.max(0, countdownSec / totalSec);
  const circumference = 2 * Math.PI * 98; // 615.75
  $('#overlay-ring-progress').setAttribute('stroke-dashoffset', circumference * (1 - ratio));
  // 倒计时变色
  if (countdownSec <= 5) {
    $('#overlay-ring-progress').setAttribute('stroke', '#ff9500');
  } else {
    $('#overlay-ring-progress').setAttribute('stroke', '#34c759');
  }
}

async function finish(action) {
  if (tickHandle) clearInterval(tickHandle);
  if (exerciseHandle) clearInterval(exerciseHandle);
  const durationSec = action === 'completed' ? totalSec : Math.max(0, totalSec - countdownSec);
  await window.api.breakFinished({ action, durationSec });
  // 关闭窗口
  window.close();
}

document.addEventListener('DOMContentLoaded', () => {
  $('#btn-complete').addEventListener('click', () => finish('completed'));
  $('#btn-skip').addEventListener('click', () => finish('skipped'));
  $('#btn-snooze').addEventListener('click', () => finish('snoozed'));

  window.api.onBreakStart((info) => startBreak(info));
});
