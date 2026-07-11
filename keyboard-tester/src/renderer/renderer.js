// 键鼠管家 - 渲染层逻辑（自包含，不依赖 require）
// 键盘布局数据、打字测试逻辑内联于此，避免 contextIsolation 限制

// ===== 键盘布局（与 core/keyboard-layout.js 一致）=====
const ROWS = [
  [
    { code: 'Escape', label: 'esc', w: 1 },
    { code: 'F1', label: 'F1', w: 1 }, { code: 'F2', label: 'F2', w: 1 },
    { code: 'F3', label: 'F3', w: 1 }, { code: 'F4', label: 'F4', w: 1 },
    { code: 'F5', label: 'F5', w: 1 }, { code: 'F6', label: 'F6', w: 1 },
    { code: 'F7', label: 'F7', w: 1 }, { code: 'F8', label: 'F8', w: 1 },
    { code: 'F9', label: 'F9', w: 1 }, { code: 'F10', label: 'F10', w: 1 },
    { code: 'F11', label: 'F11', w: 1 }, { code: 'F12', label: 'F12', w: 1 },
  ],
  [
    { code: 'Backquote', label: '`', w: 1 },
    { code: 'Digit1', label: '1', w: 1 }, { code: 'Digit2', label: '2', w: 1 },
    { code: 'Digit3', label: '3', w: 1 }, { code: 'Digit4', label: '4', w: 1 },
    { code: 'Digit5', label: '5', w: 1 }, { code: 'Digit6', label: '6', w: 1 },
    { code: 'Digit7', label: '7', w: 1 }, { code: 'Digit8', label: '8', w: 1 },
    { code: 'Digit9', label: '9', w: 1 }, { code: 'Digit0', label: '0', w: 1 },
    { code: 'Minus', label: '-', w: 1 }, { code: 'Equal', label: '=', w: 1 },
    { code: 'Backspace', label: 'Bksp', w: 2 },
  ],
  [
    { code: 'Tab', label: 'Tab', w: 1.5 },
    { code: 'KeyQ', label: 'Q', w: 1 }, { code: 'KeyW', label: 'W', w: 1 },
    { code: 'KeyE', label: 'E', w: 1 }, { code: 'KeyR', label: 'R', w: 1 },
    { code: 'KeyT', label: 'T', w: 1 }, { code: 'KeyY', label: 'Y', w: 1 },
    { code: 'KeyU', label: 'U', w: 1 }, { code: 'KeyI', label: 'I', w: 1 },
    { code: 'KeyO', label: 'O', w: 1 }, { code: 'KeyP', label: 'P', w: 1 },
    { code: 'BracketLeft', label: '[', w: 1 }, { code: 'BracketRight', label: ']', w: 1 },
    { code: 'Backslash', label: '\\', w: 1.5 },
  ],
  [
    { code: 'CapsLock', label: 'Caps', w: 1.75 },
    { code: 'KeyA', label: 'A', w: 1 }, { code: 'KeyS', label: 'S', w: 1 },
    { code: 'KeyD', label: 'D', w: 1 }, { code: 'KeyF', label: 'F', w: 1 },
    { code: 'KeyG', label: 'G', w: 1 }, { code: 'KeyH', label: 'H', w: 1 },
    { code: 'KeyJ', label: 'J', w: 1 }, { code: 'KeyK', label: 'K', w: 1 },
    { code: 'KeyL', label: 'L', w: 1 },
    { code: 'Semicolon', label: ';', w: 1 }, { code: 'Quote', label: "'", w: 1 },
    { code: 'Enter', label: 'Enter', w: 2.25 },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', w: 2.25 },
    { code: 'KeyZ', label: 'Z', w: 1 }, { code: 'KeyX', label: 'X', w: 1 },
    { code: 'KeyC', label: 'C', w: 1 }, { code: 'KeyV', label: 'V', w: 1 },
    { code: 'KeyB', label: 'B', w: 1 }, { code: 'KeyN', label: 'N', w: 1 },
    { code: 'KeyM', label: 'M', w: 1 }, { code: 'Comma', label: ',', w: 1 },
    { code: 'Period', label: '.', w: 1 }, { code: 'Slash', label: '/', w: 1 },
    { code: 'ShiftRight', label: 'Shift', w: 2.75 },
  ],
  [
    { code: 'ControlLeft', label: 'Ctrl', w: 1.25 },
    { code: 'AltLeft', label: 'Alt', w: 1.25 },
    { code: 'Space', label: 'Space', w: 6.25 },
    { code: 'AltRight', label: 'Alt', w: 1.25 },
    { code: 'ControlRight', label: 'Ctrl', w: 1.25 },
  ],
];

const KEY_NAMES = {
  Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab', Enter: 'Enter', Space: '空格',
  ShiftLeft: '左 Shift', ShiftRight: '右 Shift',
  ControlLeft: '左 Ctrl', ControlRight: '右 Ctrl',
  AltLeft: '左 Alt', AltRight: '右 Alt',
  CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};

function keyName(code) {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  for (const row of ROWS) {
    for (const k of row) {
      if (k.code === code) return k.label;
    }
  }
  return code;
}

// ===== 打字测试（与 core/typing-test.js 一致）=====
const SAMPLES = [
  'The quick brown fox jumps over the lazy dog.',
  'Stay hungry, stay foolish. Keep moving forward every day.',
  'Practice makes perfect. The more you type, the faster you become.',
  'Technology is best when it brings people together.',
  'Simplicity is the ultimate sophistication in modern design.',
  '专注当下，把每一件小事做到极致，时间会给你答案。',
  '每一次敲击键盘，都是与计算机的一次对话。',
  '优秀的工具让复杂的事情变简单，让简单的事情更高效。',
];

function randomSample() {
  return SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
}

class TypingTest {
  constructor(text) {
    this.text = text || '';
    this.typed = '';
    this.startTime = null;
    this.endTime = null;
    this.errors = 0;
    this.finished = false;
  }
  start() { if (this.startTime === null) this.startTime = Date.now(); }
  input(ch) {
    if (this.finished) return { ok: false, finished: true, expected: '' };
    this.start();
    const expected = this.text[this.typed.length] || '';
    if (ch === expected) {
      this.typed += ch;
      if (this.typed.length >= this.text.length) {
        this.finished = true;
        this.endTime = Date.now();
      }
      return { ok: true, finished: this.finished, expected };
    }
    this.errors += 1;
    return { ok: false, finished: false, expected };
  }
  backspace() { if (this.typed.length > 0) this.typed = this.typed.slice(0, -1); }
  accuracy() {
    const total = this.typed.length + this.errors;
    if (total === 0) return 100;
    return Math.round((this.typed.length / total) * 100);
  }
  durationSec() {
    if (this.startTime === null) return 0;
    const end = this.endTime || Date.now();
    return Math.max(0.001, (end - this.startTime) / 1000);
  }
  wpm() {
    if (this.startTime === null) return 0;
    const mins = this.durationSec() / 60;
    if (mins <= 0) return 0;
    return Math.round(this.typed.length / 5 / mins);
  }
  reset() {
    this.typed = ''; this.startTime = null; this.endTime = null;
    this.errors = 0; this.finished = false;
  }
}

// ===== 本地统计快照 =====
const stats = {
  keyCount: {},
  mouseClick: { left: 0, right: 0, middle: 0, back: 0, forward: 0 },
  wheel: { up: 0, down: 0 },
  distance: 0,
  totalKeys: 0,
  pressKey(code) {
    if (!code) return;
    this.keyCount[code] = (this.keyCount[code] || 0) + 1;
    this.totalKeys += 1;
  },
  clickMouse(btn) {
    if (this.mouseClick[btn] === undefined) return;
    this.mouseClick[btn] += 1;
  },
  wheelScroll(dir) {
    if (dir !== 'up' && dir !== 'down') return;
    this.wheel[dir] += 1;
  },
  moveMouse(dx, dy) { this.distance += Math.sqrt(dx * dx + dy * dy); },
  topKeys(n = 10) {
    return Object.entries(this.keyCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([code, count]) => ({ code, count }));
  },
  maxCount() {
    const v = Object.values(this.keyCount);
    return v.length === 0 ? 0 : Math.max(...v);
  },
  load(data) {
    if (!data) return;
    this.keyCount = data.keyCount || {};
    this.mouseClick = Object.assign(
      { left: 0, right: 0, middle: 0, back: 0, forward: 0 }, data.mouseClick || {});
    this.wheel = Object.assign({ up: 0, down: 0 }, data.wheel || {});
    this.distance = data.distance || 0;
    this.totalKeys = data.totalKeys || 0;
    const sum = Object.values(this.keyCount).reduce((a, b) => a + b, 0);
    if (this.totalKeys < sum) this.totalKeys = sum;
  },
  toJSON() {
    return {
      keyCount: this.keyCount, mouseClick: this.mouseClick, wheel: this.wheel,
      distance: this.distance, totalKeys: this.totalKeys,
    };
  },
  reset() {
    this.keyCount = {};
    this.mouseClick = { left: 0, right: 0, middle: 0, back: 0, forward: 0 };
    this.wheel = { up: 0, down: 0 };
    this.distance = 0;
    this.totalKeys = 0;
  },
};

let nkroBest = 0;
const heldKeys = new Set();
let typing = new TypingTest(randomSample());
const recentKeys = []; // 最近按下的键流水（最多 24 条）

// ===== 初始化 =====
async function init() {
  try {
    const data = await window.kt.stats.get();
    stats.load(data);
  } catch (e) {}

  renderKeyboard('keyboardWrap', false);
  renderKeyboard('nkroKeyboard', false);
  renderKeyboard('heatmapKeyboard', true);
  updateStatsUI();
  updateMouseUI();
  updateTotalKeysMini();
  renderTypingText();
  renderHistory();

  // 若有统计数据，预填按键流水用于展示
  if (stats.totalKeys > 0) {
    const samples = ['Space', 'KeyA', 'KeyS', 'KeyD', 'Enter', 'Backspace',
      'KeyE', 'KeyT', 'KeyI', 'KeyN', 'KeyO', 'KeyR', 'ShiftLeft', 'KeyH'];
    samples.forEach((c) => recentKeys.push(c));
    renderRecentKeys();
    // 也显示一个最近按键
    const valEl = document.getElementById('lastKeyValue');
    const codeEl = document.getElementById('lastKeyCode');
    if (valEl && codeEl) {
      valEl.textContent = keyName('Space');
      codeEl.textContent = 'Space';
    }
  }
  bindTabs();
  bindKeyboard();
  bindMouse();
  bindTyping();
  bindTopActions();

  // 定时同步统计到主进程（防抖）
  setInterval(() => {
    window.kt.stats.save(stats.toJSON()).catch(() => {});
  }, 4000);

  // 实时刷新打字计时
  setInterval(() => {
    if (typing.startTime && !typing.finished) updateTypingMetrics();
  }, 200);
}

// ===== 渲染虚拟键盘 =====
const FUNCTION_CODES = new Set(['Escape','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12']);
const MODIFIER_CODES = new Set(['Tab','CapsLock','ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','Enter','Backspace']);

function renderKeyboard(targetId, heatmap) {
  const wrap = document.getElementById(targetId);
  if (!wrap) return;
  wrap.innerHTML = '';
  ROWS.forEach((row, rowIdx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kbd-row';
    if (rowIdx === 0) rowEl.classList.add('row-function');
    row.forEach((k) => {
      const keyEl = document.createElement('div');
      keyEl.className = 'kbd-key';
      if (k.label.length > 3) keyEl.classList.add('wide-label');
      if (FUNCTION_CODES.has(k.code)) keyEl.classList.add('key-function');
      if (MODIFIER_CODES.has(k.code)) keyEl.classList.add('key-modifier');
      if (k.code === 'Space') keyEl.classList.add('key-space');
      keyEl.style.flex = `${k.w} 1 0`;
      keyEl.dataset.code = k.code;
      keyEl.textContent = k.label;
      if (heatmap) {
        const count = stats.keyCount[k.code] || 0;
        const level = heatLevel(count, stats.maxCount());
        keyEl.classList.add(`heat-${level}`);
        if (count > 0) {
          const c = document.createElement('span');
          c.className = 'heat-count';
          c.textContent = count;
          keyEl.appendChild(c);
        }
      }
      rowEl.appendChild(keyEl);
    });
    wrap.appendChild(rowEl);
  });
}

function heatLevel(count, max) {
  if (count === 0 || max === 0) return 0;
  const r = count / max;
  if (r < 0.05) return 1;
  if (r < 0.15) return 2;
  if (r < 0.3) return 3;
  if (r < 0.5) return 4;
  if (r < 0.75) return 5;
  return 6;
}

// ===== 标签切换 =====
function bindTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      document.getElementById(`panel-${target}`).classList.add('active');
      if (target === 'stats') {
        renderKeyboard('heatmapKeyboard', true);
        updateStatsUI();
      }
      if (target === 'typing') {
        setTimeout(() => document.getElementById('typingInput').focus(), 50);
      }
    });
  });
}

// ===== 键盘监听 =====
function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.id === 'typingInput') return;
    const code = e.code;
    if (!code) return;

    const block = ['Tab', 'F5', 'F11', 'F12', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Backspace'];
    if (block.includes(code)) e.preventDefault();

    stats.pressKey(code);

    const valEl = document.getElementById('lastKeyValue');
    const codeEl = document.getElementById('lastKeyCode');
    if (valEl && codeEl) {
      valEl.textContent = keyName(code);
      valEl.classList.remove('pulse');
      void valEl.offsetWidth;
      valEl.classList.add('pulse');
      codeEl.textContent = code;
    }

    // 按键流水
    recentKeys.push(code);
    if (recentKeys.length > 24) recentKeys.shift();
    renderRecentKeys();

    highlightKey('keyboardWrap', code, true);
    highlightKey('nkroKeyboard', code, true);

    heldKeys.add(code);
    updateNKRO();

    updateTotalKeysMini();
    if (document.getElementById('panel-stats').classList.contains('active')) {
      updateHeatKey(code);
    }
  });

  document.addEventListener('keyup', (e) => {
    const code = e.code;
    if (!code) return;
    highlightKey('keyboardWrap', code, false);
    highlightKey('nkroKeyboard', code, false);
    heldKeys.delete(code);
    updateNKRO();
  });
}

function highlightKey(wrapId, code, on) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const el = wrap.querySelector(`.kbd-key[data-code="${cssEscape(code)}"]`);
  if (!el) return;
  if (on) el.classList.add('active');
  else el.classList.remove('active');
}

function cssEscape(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

// ===== NKRO =====
function updateNKRO() {
  const count = heldKeys.size;
  const bigEl = document.getElementById('nkroCurrent');
  const keysEl = document.getElementById('nkroKeys');
  const bestEl = document.getElementById('nkroBest');
  if (bigEl) {
    bigEl.textContent = count;
    bigEl.classList.toggle('has-keys', count > 0);
  }
  if (count > nkroBest) {
    nkroBest = count;
    if (bestEl) bestEl.textContent = nkroBest;
  }
  if (keysEl) {
    if (count === 0) {
      keysEl.innerHTML = '<div class="nkro-placeholder">按住多个键试试 →</div>';
    } else {
      keysEl.innerHTML = '';
      heldKeys.forEach((code) => {
        const chip = document.createElement('div');
        chip.className = 'nkro-chip';
        chip.textContent = keyName(code);
        keysEl.appendChild(chip);
      });
    }
  }
  const nkroWrap = document.getElementById('nkroKeyboard');
  if (nkroWrap) {
    nkroWrap.querySelectorAll('.kbd-key').forEach((el) => {
      el.classList.toggle('held', heldKeys.has(el.dataset.code));
    });
  }
}

// ===== 鼠标测试 =====
function bindMouse() {
  document.addEventListener('mousedown', (e) => {
    let btn = 'left';
    if (e.button === 1) btn = 'middle';
    else if (e.button === 2) btn = 'right';
    else if (e.button === 3) btn = 'back';
    else if (e.button === 4) btn = 'forward';
    if (e.button > 4) return;
    stats.clickMouse(btn);

    const card = document.getElementById(`click${cap(btn)}`);
    if (card) {
      card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 120);
    }
    updateMouseUI();
  });

  let lastX = null, lastY = null;
  const zone = document.getElementById('mouseZone');
  if (zone) {
    zone.addEventListener('mouseenter', () => zone.classList.add('active'));
    zone.addEventListener('mouseleave', () => {
      zone.classList.remove('active');
      lastX = null; lastY = null;
    });
    zone.addEventListener('mousemove', (e) => {
      if (lastX !== null) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        stats.moveMouse(dx, dy);
        updateMouseUI();
      }
      lastX = e.clientX;
      lastY = e.clientY;
    });
  }

  const wheelTarget = document.getElementById('panel-mouse');
  if (wheelTarget) {
    wheelTarget.addEventListener('wheel', (e) => {
      if (e.deltaY < 0) stats.wheelScroll('up');
      else if (e.deltaY > 0) stats.wheelScroll('down');
      updateMouseUI();
    }, { passive: true });
  }

  const dblCard = document.querySelector('.dbl-card');
  if (dblCard) {
    let lastClickTs = 0;
    dblCard.addEventListener('click', () => {
      const now = Date.now();
      if (lastClickTs > 0) {
        const diff = now - lastClickTs;
        document.getElementById('cntDbl').textContent = diff;
        document.getElementById('dblHint').textContent = '再次双击以刷新';
      }
      lastClickTs = now;
      setTimeout(() => { lastClickTs = 0; }, 600);
    });
  }

  document.addEventListener('contextmenu', (e) => {
    if (document.getElementById('panel-mouse').classList.contains('active')) {
      e.preventDefault();
    }
  });
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function updateMouseUI() {
  const m = stats.mouseClick;
  const w = stats.wheel;
  setText('cntLeft', m.left);
  setText('cntMiddle', m.middle);
  setText('cntRight', m.right);
  setText('cntWheelUp', w.up);
  setText('cntWheelDown', w.down);
  setText('cntDistance', Math.round(stats.distance));
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ===== 统计 UI =====
function updateStatsUI() {
  setText('statTotalKeys', stats.totalKeys.toLocaleString());
  setText('statUniqueKeys', Object.keys(stats.keyCount).length);
  const clicks = stats.mouseClick.left + stats.mouseClick.right + stats.mouseClick.middle +
    stats.mouseClick.back + stats.mouseClick.forward;
  setText('statMouseClicks', clicks);
  setText('statWheel', stats.wheel.up + stats.wheel.down);
  const list = document.getElementById('topKeysList');
  if (list) {
    const top = stats.topKeys(8);
    if (top.length === 0) {
      list.innerHTML = '<div class="empty">暂无数据，去敲几个键吧。</div>';
    } else {
      list.innerHTML = '';
      const maxCount = top[0].count;
      top.forEach((k, i) => {
        const item = document.createElement('div');
        item.className = 'topkey-item';
        if (i === 0) item.classList.add('rank-gold');
        else if (i === 1) item.classList.add('rank-silver');
        else if (i === 2) item.classList.add('rank-bronze');
        const pct = Math.round((k.count / maxCount) * 100);
        item.innerHTML = `
          <div class="topkey-bar" style="width:${pct}%"></div>
          <span class="topkey-rank">${i + 1}</span>
          <span class="topkey-name">${escapeHtml(keyName(k.code))}</span>
          <span class="topkey-count">${k.count}</span>
        `;
        list.appendChild(item);
      });
    }
  }
}

function updateHeatKey(code) {
  const wrap = document.getElementById('heatmapKeyboard');
  if (!wrap) return;
  const el = wrap.querySelector(`.kbd-key[data-code="${cssEscape(code)}"]`);
  if (!el) return;
  const count = stats.keyCount[code] || 0;
  const max = stats.maxCount();
  for (let i = 0; i <= 6; i++) el.classList.remove(`heat-${i}`);
  el.classList.add(`heat-${heatLevel(count, max)}`);
  const oldCount = el.querySelector('.heat-count');
  if (oldCount) oldCount.remove();
  if (count > 0) {
    const c = document.createElement('span');
    c.className = 'heat-count';
    c.textContent = count;
    el.appendChild(c);
  }
  setText('statTotalKeys', stats.totalKeys);
  setText('statUniqueKeys', Object.keys(stats.keyCount).length);
}

function updateTotalKeysMini() {
  setText('totalKeysMini', stats.totalKeys);
}

function renderRecentKeys() {
  const wrap = document.getElementById('recentKeysList');
  if (!wrap) return;
  if (recentKeys.length === 0) {
    wrap.innerHTML = '<div class="recent-empty">尚无记录</div>';
    return;
  }
  wrap.innerHTML = '';
  // 最新的显示在最后，高亮最后一条
  recentKeys.forEach((code, i) => {
    const chip = document.createElement('span');
    chip.className = 'recent-key-chip';
    if (i === recentKeys.length - 1) chip.classList.add('latest');
    chip.textContent = keyName(code);
    wrap.appendChild(chip);
  });
  // 滚动到底部
  wrap.scrollTop = wrap.scrollHeight;
}

// ===== 打字测试 =====
function bindTyping() {
  const input = document.getElementById('typingInput');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      typing.backspace();
      renderTypingText();
      updateTypingMetrics();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
    }
  });

  input.addEventListener('input', (e) => {
    const val = e.target.value;
    const ch = val.slice(-1);
    if (ch) {
      typing.input(ch);
      e.target.value = '';
      renderTypingText();
      updateTypingMetrics();
      if (typing.finished) finishTyping();
    }
  });

  document.getElementById('typeNew').addEventListener('click', () => {
    typing = new TypingTest(randomSample());
    document.getElementById('typingInput').value = '';
    document.getElementById('typingResult').classList.remove('show');
    renderTypingText();
    updateTypingMetrics();
    document.getElementById('typingInput').focus();
  });

  document.getElementById('typeRetry').addEventListener('click', () => {
    typing.reset();
    document.getElementById('typingInput').value = '';
    document.getElementById('typingResult').classList.remove('show');
    renderTypingText();
    updateTypingMetrics();
    document.getElementById('typingInput').focus();
  });
}

function renderTypingText() {
  const wrap = document.getElementById('typingText');
  if (!wrap) return;
  const text = typing.text;
  const typed = typing.typed;
  wrap.innerHTML = '';
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.className = 'char';
    if (i < typed.length) {
      span.classList.add(typed[i] === text[i] ? 'correct' : 'wrong');
    } else if (i === typed.length) {
      span.classList.add('current');
    }
    span.textContent = text[i];
    wrap.appendChild(span);
  }
}

function updateTypingMetrics() {
  setText('typeWpm', typing.wpm());
  setText('typeAcc', typing.accuracy() + '%');
  setText('typeTime', typing.durationSec().toFixed(1) + 's');
  setText('typeErr', typing.errors);
}

async function finishTyping() {
  updateTypingMetrics();
  const result = document.getElementById('typingResult');
  result.className = 'typing-result show success';
  result.innerHTML = `完成！WPM <b>${typing.wpm()}</b> · 准确率 <b>${typing.accuracy()}%</b> · 用时 <b>${typing.durationSec().toFixed(1)}s</b> · 错误 <b>${typing.errors}</b> 次`;
  try {
    const record = {
      wpm: typing.wpm(),
      accuracy: typing.accuracy(),
      durationSec: Math.round(typing.durationSec() * 10) / 10,
      errors: typing.errors,
      length: typing.text.length,
    };
    const list = await window.kt.history.add(record);
    renderHistoryList(list);
  } catch (e) {}
}

async function renderHistory() {
  try {
    const list = await window.kt.history.list();
    renderHistoryList(list);
  } catch (e) {}
}

function renderHistoryList(list) {
  const wrap = document.getElementById('historyList');
  if (!wrap) return;
  if (!list || list.length === 0) {
    wrap.innerHTML = '<div class="empty">暂无历史，完成一次测试后会显示。</div>';
    return;
  }
  wrap.innerHTML = '';
  list.slice().reverse().forEach((r) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const date = new Date(r.ts);
    const time = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    item.innerHTML = `
      <span>${time}</span>
      <span class="h-wpm">${r.wpm} WPM</span>
      <span class="h-acc">${r.accuracy}%</span>
      <span>${r.durationSec}s</span>
      <span>错 ${r.errors}</span>
    `;
    wrap.appendChild(item);
  });
}

// ===== 顶部操作 =====
function bindTopActions() {
  document.getElementById('exportBtn').addEventListener('click', async () => {
    try {
      await window.kt.stats.save(stats.toJSON());
      const p = await window.kt.data.export();
      if (p) flashStatus('已导出到 ' + p);
    } catch (e) {
      flashStatus('导出失败');
    }
  });

  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (!confirm('确定清空所有统计数据和历史记录？此操作不可撤销。')) return;
    try {
      const r = await window.kt.data.clearAll();
      stats.load(r.stats);
      nkroBest = 0;
      renderKeyboard('heatmapKeyboard', true);
      updateStatsUI();
      updateTotalKeysMini();
      updateMouseUI();
      renderHistoryList(r.history);
      setText('nkroBest', 0);
      flashStatus('已清空所有数据');
    } catch (e) {
      flashStatus('清空失败');
    }
  });
}

function flashStatus(msg) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (dot && text) {
    text.textContent = msg;
    dot.classList.add('active');
    setTimeout(() => {
      dot.classList.remove('active');
      text.textContent = '就绪 · 请聚焦此窗口后按键';
    }, 2200);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// 启动
init();
