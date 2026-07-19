// renderer.js - 渲染进程逻辑
const $ = (id) => document.getElementById(id);

// 浏览器/截图环境回退（非 Electron 时使用本地 mock，便于 Edge headless 截图）
if (!window.pg) {
  const _mockChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const _mockWords = ['River', 'Stone', 'Cloud', 'Light', 'Moon', 'Star', 'Tiger', 'Eagle', 'Silver', 'Golden', 'Crystal', 'Thunder'];
  const _rand = (n) => Math.floor(Math.random() * n);
  window.pg = {
    generate: async (opts) => {
      const len = opts && opts.length || 16;
      let pwd = '';
      for (let i = 0; i < len; i++) pwd += _mockChars[_rand(_mockChars.length)];
      return pwd;
    },
    passphrase: async (opts) => {
      const n = opts && opts.words || 4;
      const sep = opts && opts.separator || '-';
      const parts = [];
      for (let i = 0; i < n; i++) parts.push(_mockWords[_rand(_mockWords.length)]);
      if (opts && opts.includeNumber) parts.push(String(_rand(100)));
      return parts.join(sep);
    },
    evaluate: async (pwd) => {
      if (!pwd) return { score: 0, label: '无', entropy: 0, suggestions: [] };
      const ent = pwd.length * 5.5;
      let score = Math.min(6, Math.max(1, Math.floor(ent / 20)));
      return { score, label: ['无','极弱','弱','一般','强','很强','极强'][score], entropy: Math.round(ent), suggestions: [] };
    },
    batch: async (opts) => {
      const count = opts && opts.count || 10;
      const len = opts && opts.length || 16;
      const list = [];
      for (let i = 0; i < count; i++) {
        let pwd = '';
        for (let j = 0; j < len; j++) pwd += _mockChars[_rand(_mockChars.length)];
        list.push(pwd);
      }
      return list;
    },
    evaluateBatch: async (pwds) => pwds.map(() => ({ score: 5, label: '很强', entropy: 88, suggestions: [] })),
    copy: async () => true,
    openExternal: () => {}
  };
}

const state = {
  history: [],
  lastBatch: [],
  currentSeparator: '-'
};

function loadHistory() {
  try {
    const raw = localStorage.getItem('pg_history');
    if (raw) state.history = JSON.parse(raw);
  } catch (e) { state.history = []; }
}
function saveHistory() {
  localStorage.setItem('pg_history', JSON.stringify(state.history.slice(0, 50)));
}
function addHistory(text, type) {
  if (!text) return;
  state.history.unshift({ text, type, time: Date.now() });
  state.history = state.history.slice(0, 50);
  saveHistory();
}

let toastTimer = null;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function setStatus(text) { $('statusText').textContent = text; }

// ============ 复制按钮短暂视觉反馈（✓ 闪现 900ms）============
// 在按钮上临时叠加 .copied 类，切换图标为 ✓，900ms 后恢复原 SVG
function flashCopyFeedback(btn) {
  if (!btn) return;
  const original = btn.innerHTML;
  btn.classList.add('copied');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>';
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = original;
  }, 900);
}

// ============ 复制按钮 disabled 态管理 ============
// 密码/口令未生成时，复制按钮置 disabled 视觉禁用
function syncCopyDisabled() {
  const pwdText = $('pwdDisplay').textContent;
  const pwdEmpty = !pwdText || pwdText === '点击生成开始';
  $('copyPwd').disabled = pwdEmpty;
  const phraseText = $('phraseDisplay').textContent;
  const phraseEmpty = !phraseText || phraseText === '点击生成开始';
  $('copyPhrase').disabled = phraseEmpty;
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    $('panel-' + target).classList.add('active');
    if (target === 'history') renderHistory();
    // 切换 Tab 时复位清空历史的 armed 态，避免跨 Tab 来回误确认
    resetClearHistoryArmed();
  });
});

// ============ 清空历史 armed 态复位（切换 Tab / 点击其他区域时调用）============
function resetClearHistoryArmed() {
  if (clearHistoryArmed) {
    clearHistoryArmed = false;
    clearTimeout(clearHistoryTimer);
    const btn = $('clearHistory');
    if (btn) {
      btn.textContent = '清空历史';
      btn.classList.remove('armed');
    }
  }
}

function clampInt(v, dft, min, max) {
  let n = parseInt(v);
  if (Number.isNaN(n)) n = dft;
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}

function syncNumberInput(inputEl, sliderEl, min, max, dft) {
  const v = clampInt(inputEl.value, dft, min, max);
  if (String(inputEl.value) !== '' && parseInt(inputEl.value) !== v) inputEl.value = v;
  sliderEl.value = v;
  updateSliderFill(sliderEl);
}

function getPwdOpts() {
  return {
    length: clampInt($('lengthInput').value, 16, 4, 64),
    lower: $('chkLower').checked,
    upper: $('chkUpper').checked,
    digits: $('chkDigits').checked,
    symbols: $('chkSymbols').checked,
    excludeAmbiguous: $('chkExcludeAmb').checked
  };
}

// 计算字符池大小(与主进程 evaluateStrength 口径一致)
function computePoolSize(pwd) {
  let pool = 0;
  if (/[a-z]/.test(pwd)) pool += 26;
  if (/[A-Z]/.test(pwd)) pool += 26;
  if (/[0-9]/.test(pwd)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pwd)) pool += 26;
  return pool;
}

// 渲染密码到展示区:字符按类型高亮(数字蓝/符号橙/字母默认)
function renderPasswordDisplay(pwd) {
  const display = $('pwdDisplay');
  display.textContent = '';
  if (!pwd) {
    display.classList.add('empty');
    display.textContent = '点击生成开始';
    return;
  }
  display.classList.remove('empty');
  const frag = document.createDocumentFragment();
  for (const ch of pwd) {
    const span = document.createElement('span');
    let cls = 'char ';
    if (/[0-9]/.test(ch)) cls += 'char-digit';
    else if (/[a-zA-Z]/.test(ch)) cls += 'char-letter';
    else cls += 'char-symbol';
    span.className = cls;
    span.textContent = ch;
    frag.appendChild(span);
  }
  display.appendChild(frag);
}

// 更新密码卡片元信息行(长度/字符池/熵/破解耗时)
function updatePwdMeta(pwd, result) {
  if (!pwd) {
    $('pwdLen').textContent = '—';
    $('pwdPool').textContent = '—';
    $('pwdEntropy').textContent = '—';
    $('pwdCrack').textContent = '—';
    return;
  }
  $('pwdLen').textContent = pwd.length + ' 位';
  $('pwdPool').textContent = computePoolSize(pwd);
  $('pwdEntropy').textContent = result.entropy + ' bits';
  $('pwdCrack').textContent = estimateCrackTime(result.entropy);
}

// 快速预设配置
const PRESETS = {
  pin:       { length: 4,  lower: false, upper: false, digits: true,  symbols: false, excludeAmbiguous: false },
  wifi:      { length: 12, lower: true,  upper: true,  digits: true,  symbols: false, excludeAmbiguous: true  },
  standard:  { length: 16, lower: true,  upper: true,  digits: true,  symbols: true,  excludeAmbiguous: false },
  strong:    { length: 24, lower: true,  upper: true,  digits: true,  symbols: true,  excludeAmbiguous: true  },
  max:       { length: 32, lower: true,  upper: true,  digits: true,  symbols: true,  excludeAmbiguous: true  }
};

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  $('lengthInput').value = p.length;
  $('lengthSlider').value = p.length;
  updateSliderFill($('lengthSlider'));
  $('chkLower').checked = p.lower;
  $('chkUpper').checked = p.upper;
  $('chkDigits').checked = p.digits;
  $('chkSymbols').checked = p.symbols;
  $('chkExcludeAmb').checked = p.excludeAmbiguous;
  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('active', b.dataset.preset === name));
  genPassword();
}

document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

async function genPassword(silent) {
  const opts = getPwdOpts();
  if (!opts.lower && !opts.upper && !opts.digits && !opts.symbols) {
    if (!silent) showToast('至少选择一种字符类型');
    else setStatus('请至少选择一种字符类型');
    return;
  }
  // 弱密码配置警告：长度<8 或 仅数字 + 长度<10 视为高风险配置
  if (!silent) {
    const warn = weakConfigWarning(opts);
    if (warn) showToast(warn);
  }
  if (!silent) setStatus('生成中…');
  const pwd = await window.pg.generate(opts);
  renderPasswordDisplay(pwd);
  syncCopyDisabled();
  if (!silent) addHistory(pwd, '密码');
  const result = await window.pg.evaluate(pwd);
  updateStrengthMeter('strengthFill', 'strengthLabel', null, result);
  const hint = $('strengthHint');
  if (hint) hint.textContent = result.entropy > 0 ? `熵 ${result.entropy} bits · 破解 ${estimateCrackTime(result.entropy)}` : '实时评估';
  updatePwdMeta(pwd, result);
  if (!silent) setStatus('已生成');
  else setStatus('就绪');
}

// 弱密码配置警告：返回非空字符串表示有警告
function weakConfigWarning(opts) {
  if (opts.length < 8) return '当前长度<8，密码强度极弱，仅用于PIN等场景';
  const onlyDigits = opts.digits && !opts.lower && !opts.upper && !opts.symbols;
  if (onlyDigits && opts.length < 10) return '纯数字+短长度易被暴力破解，建议加字母/符号或增加长度';
  return '';
}

function updateStrengthMeter(fillId, labelId, entropyId, result) {
  const fill = $(fillId);
  fill.className = 'strength-fill s' + result.score;
  const label = $(labelId);
  label.textContent = result.label;
  label.className = 'c-s' + result.score;
  if (entropyId) {
    const e = $(entropyId);
    if (e) e.textContent = result.entropy > 0 ? `熵 ${result.entropy} bits` : '';
  }
}

$('genBtn').addEventListener('click', genPassword);
$('regenPwd').addEventListener('click', genPassword);
$('copyPwd').addEventListener('click', async (e) => {
  const text = $('pwdDisplay').textContent;
  if (!text || text === '点击生成开始') { showToast('暂无内容可复制'); return; }
  await window.pg.copy(text);
  flashCopyFeedback(e.currentTarget);
  showToast('已复制 ' + text.length + ' 位');
});

// ============ 滑块拖动期间防抖刷新密码（150ms 节流）============
// 解决：拖动滑块时数字输入框已变，但密码展示区/强度条/元信息仍显示旧密码的视觉错位
let sliderPreviewTimer = null;
function debouncedGenPassword() {
  clearTimeout(sliderPreviewTimer);
  sliderPreviewTimer = setTimeout(() => genPassword(true), 150);
}

$('lengthSlider').addEventListener('input', (e) => {
  $('lengthInput').value = e.target.value;
  updateSliderFill(e.target);
  debouncedGenPassword();
});
$('lengthSlider').addEventListener('change', () => { genPassword(true); });
$('lengthInput').addEventListener('input', (e) => { syncNumberInput(e.target, $('lengthSlider'), 4, 64, 16); debouncedGenPassword(); });
$('lengthInput').addEventListener('change', (e) => { syncNumberInput(e.target, $('lengthSlider'), 4, 64, 16); genPassword(true); });
// 长度输入框 Enter 键直接生成（非静默，写入历史 + 状态栏更新）
$('lengthInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); genPassword(); }
});

// ============ 字符类型勾选改变后自动重新生成（与滑块 change 行为一致）============
['chkUpper','chkLower','chkDigits','chkSymbols','chkExcludeAmb'].forEach(id => {
  $(id).addEventListener('change', () => genPassword(true));
});

function updateSliderFill(slider) {
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 100;
  const val = parseFloat(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty('--fill', pct + '%');
}
document.querySelectorAll('.slider').forEach(s => { updateSliderFill(s); s.addEventListener('input', () => updateSliderFill(s)); });

function getPhraseOpts() {
  return {
    words: parseInt($('wordInput').value) || 4,
    separator: state.currentSeparator,
    capitalize: $('chkCapitalize').checked,
    includeNumber: $('chkNumber').checked
  };
}

async function genPassphrase(silent) {
  if (!silent) setStatus('生成中…');
  const phrase = await window.pg.passphrase(getPhraseOpts());
  const display = $('phraseDisplay');
  display.textContent = phrase;
  display.classList.remove('empty');
  syncCopyDisabled();
  if (!silent) addHistory(phrase, '口令');
  if (!silent) setStatus('已生成');
  else setStatus('就绪');
}

$('phraseBtn').addEventListener('click', genPassphrase);
$('regenPhrase').addEventListener('click', genPassphrase);
$('copyPhrase').addEventListener('click', async (e) => {
  const text = $('phraseDisplay').textContent;
  if (!text || text === '点击生成开始') { showToast('暂无内容可复制'); return; }
  await window.pg.copy(text);
  flashCopyFeedback(e.currentTarget);
  showToast('已复制 ' + text.length + ' 字符');
});

$('wordSlider').addEventListener('input', (e) => { $('wordInput').value = e.target.value; updateSliderFill(e.target); });
$('wordSlider').addEventListener('change', () => { genPassphrase(true); });
$('wordInput').addEventListener('input', (e) => { syncNumberInput(e.target, $('wordSlider'), 3, 8, 4); });
$('wordInput').addEventListener('change', (e) => { syncNumberInput(e.target, $('wordSlider'), 3, 8, 4); genPassphrase(true); });
// 单词数量输入框 Enter 触发口令生成
$('wordInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); genPassphrase(); }
});

document.querySelectorAll('.seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentSeparator = btn.dataset.sep;
    // 切换分隔符后立即重新生成口令，避免"切了分隔符但展示不变"的视觉错位
    genPassphrase(true);
  });
});
// 口令选项勾选后自动重新生成
['chkCapitalize','chkNumber'].forEach(id => {
  $(id).addEventListener('change', () => genPassphrase(true));
});

function estimateCrackTime(entropy) {
  if (entropy <= 0) return '—';
  const guesses = Math.pow(2, entropy) / 2;
  const seconds = guesses / 1e10;
  if (seconds < 1) return '即时';
  if (seconds < 60) return Math.round(seconds) + ' 秒';
  if (seconds < 3600) return Math.round(seconds / 60) + ' 分钟';
  if (seconds < 86400) return Math.round(seconds / 3600) + ' 小时';
  if (seconds < 86400 * 365) return Math.round(seconds / 86400) + ' 天';
  const years = seconds / (86400 * 365);
  if (years < 1000) return Math.round(years) + ' 年';
  if (years < 1e6) return Math.round(years / 1000) + ' 千年';
  if (years < 1e9) return Math.round(years / 1e6) + ' 百万年';
  if (years < 1e12) return Math.round(years / 1e9) + ' 十亿年';
  return '宇宙级';
}

$('strengthInput').addEventListener('input', async (e) => {
  const pwd = e.target.value;
  const result = await window.pg.evaluate(pwd);
  updateStrengthMeter('chkStrengthFill', 'chkStrengthLabel', 'chkEntropyInfo', result);

  $('metaLength').textContent = pwd.length;
  let poolSize = 0;
  if (/[a-z]/.test(pwd)) poolSize += 26;
  if (/[A-Z]/.test(pwd)) poolSize += 26;
  if (/[0-9]/.test(pwd)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(pwd)) poolSize += 26;
  $('metaPool').textContent = poolSize;
  $('metaEntropy').textContent = result.entropy + ' bits';
  $('metaCrack').textContent = estimateCrackTime(result.entropy);

  const sug = $('suggestions');
  sug.innerHTML = '';
  if (result.suggestions.length === 0 && pwd.length > 0) {
    const ok = document.createElement('div');
    ok.className = 'suggestion-item ok';
    ok.textContent = '密码强度良好，无明显弱点';
    sug.appendChild(ok);
  } else {
    result.suggestions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = s;
      sug.appendChild(item);
    });
  }
});

// 显隐切换
$('toggleStrengthView').addEventListener('click', () => {
  const i = $('strengthInput');
  i.type = i.type === 'password' ? 'text' : 'password';
  i.focus();
});
// 清空
$('clearStrength').addEventListener('click', () => {
  const i = $('strengthInput');
  i.value = '';
  i.dispatchEvent(new Event('input', { bubbles: true }));
  i.focus();
});

$('batchSlider').addEventListener('input', (e) => { $('batchInput').value = e.target.value; updateSliderFill(e.target); });
$('batchInput').addEventListener('input', (e) => { syncNumberInput(e.target, $('batchSlider'), 5, 50, 10); });
$('batchInput').addEventListener('change', (e) => { syncNumberInput(e.target, $('batchSlider'), 5, 50, 10); });
$('batchLenSlider').addEventListener('input', (e) => { $('batchLenInput').value = e.target.value; updateSliderFill(e.target); });
$('batchLenInput').addEventListener('input', (e) => { syncNumberInput(e.target, $('batchLenSlider'), 4, 64, 16); });
$('batchLenInput').addEventListener('change', (e) => { syncNumberInput(e.target, $('batchLenSlider'), 4, 64, 16); });

$('batchBtn').addEventListener('click', async () => {
  const count = clampInt($('batchInput').value, 10, 5, 50);
  const length = clampInt($('batchLenInput').value, 16, 4, 64);
  const lower = $('batchChkLower').checked;
  const upper = $('batchChkUpper').checked;
  const digits = $('batchChkDigits').checked;
  const symbols = $('batchChkSymbols').checked;
  const excludeAmbiguous = $('batchChkExcludeAmb').checked;
  if (!lower && !upper && !digits && !symbols) { showToast('至少选择一种字符类型'); return; }
  setStatus('批量生成中…');
  const list = await window.pg.batch({ count, length, lower, upper, digits, symbols, excludeAmbiguous });
  state.lastBatch = list;
  renderBatch(list);
  setStatus(`已生成 ${list.length} 个密码`);
});

function renderBatch(list) {
  const container = $('batchList');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">点击「生成批量」开始</div>';
    return;
  }
  container.innerHTML = '';
  list.forEach((pwd, i) => {
    const item = document.createElement('div');
    item.className = 'batch-item';
    const idx = document.createElement('span');
    idx.className = 'batch-item-index';
    idx.textContent = String(i + 1);
    const txt = document.createElement('span');
    txt.className = 'batch-item-text';
    txt.textContent = pwd; // textContent 杜绝 <> & 破坏 DOM
    const btn = document.createElement('button');
    btn.className = 'copy-mini';
    btn.textContent = '复制';
    btn.addEventListener('click', async (e) => {
      await window.pg.copy(pwd);
      // 复制按钮短暂 ✓ 反馈
      const orig = btn.textContent;
      btn.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 800);
      showToast('已复制 ' + pwd.length + ' 位');
    });
    item.appendChild(idx);
    item.appendChild(txt);
    item.appendChild(btn);
    container.appendChild(item);
  });
}

$('batchCopyAll').addEventListener('click', async () => {
  if (!state.lastBatch.length) { showToast('暂无内容可复制'); return; }
  await window.pg.copy(state.lastBatch.join('\n'));
  showToast('已复制全部 ' + state.lastBatch.length + ' 个');
});

function formatHistoryTime(ts) {
  const t = new Date(ts);
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const sameDay = t.toDateString() === now.toDateString();
  if (sameDay) {
    return `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
  }
  return `${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

function renderHistory() {
  const container = $('historyList');
  if (!state.history.length) {
    container.innerHTML = '<div class="empty-state">暂无历史记录</div>';
    return;
  }
  container.innerHTML = '';
  state.history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const txt = document.createElement('span');
    txt.className = 'history-item-text';
    txt.textContent = item.text; // textContent 防止 <> 破坏 DOM
    const meta = document.createElement('div');
    meta.className = 'history-item-meta';
    const typeEl = document.createElement('span');
    typeEl.className = 'history-item-type';
    typeEl.textContent = item.type;
    const timeEl = document.createElement('span');
    timeEl.className = 'history-item-time';
    timeEl.textContent = formatHistoryTime(item.time);
    meta.appendChild(typeEl);
    meta.appendChild(timeEl);
    const btn = document.createElement('button');
    btn.className = 'copy-mini';
    btn.textContent = '复制';
    btn.addEventListener('click', async () => {
      await window.pg.copy(item.text);
      const orig = btn.textContent;
      btn.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 800);
      showToast('已复制 ' + item.text.length + ' 字符');
    });
    div.appendChild(txt);
    div.appendChild(meta);
    div.appendChild(btn);
    container.appendChild(div);
  });
}

let clearHistoryArmed = false;
let clearHistoryTimer = null;
$('clearHistory').addEventListener('click', () => {
  if (!state.history.length) { showToast('历史为空'); return; }
  const btn = $('clearHistory');
  if (!clearHistoryArmed) {
    clearHistoryArmed = true;
    btn.textContent = '再次点击确认清空';
    btn.classList.add('armed');
    clearTimeout(clearHistoryTimer);
    clearHistoryTimer = setTimeout(() => {
      clearHistoryArmed = false;
      btn.textContent = '清空历史';
      btn.classList.remove('armed');
    }, 3000);
    return;
  }
  clearTimeout(clearHistoryTimer);
  clearHistoryArmed = false;
  btn.textContent = '清空历史';
  btn.classList.remove('armed');
  state.history = [];
  saveHistory();
  renderHistory();
  showToast('已清空');
});

$('openGithub').addEventListener('click', (e) => {
  e.preventDefault();
  window.pg.openExternal('https://github.com/grrtyre/youqu/tree/main/password-generator');
});

// ============ 键盘快捷键 ============
const TAB_KEYS = ['password', 'passphrase', 'strength', 'batch', 'history'];
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) return;
  // Ctrl+1..5 切换 Tab
  if (e.key >= '1' && e.key <= '5' && !e.shiftKey && !e.altKey) {
    const idx = parseInt(e.key) - 1;
    if (idx < TAB_KEYS.length) {
      const tab = document.querySelector('.tab[data-tab="' + TAB_KEYS[idx] + '"]');
      if (tab) { tab.click(); e.preventDefault(); }
    }
    return;
  }
  // Ctrl+G 在当前 Tab 生成 / 重新生成
  if (e.key.toLowerCase() === 'g' && !e.shiftKey && !e.altKey) {
    const active = document.querySelector('.tab.active');
    if (!active) return;
    const t = active.dataset.tab;
    if (t === 'password') { genPassword(); e.preventDefault(); }
    else if (t === 'passphrase') { genPassphrase(); e.preventDefault(); }
    else if (t === 'batch') { $('batchBtn').click(); e.preventDefault(); }
    else { showToast('当前页不支持 Ctrl+G 生成'); e.preventDefault(); }
    return;
  }
  // Ctrl+Shift+C 复制当前结果
  if (e.key.toLowerCase() === 'c' && e.shiftKey && !e.altKey) {
    const active = document.querySelector('.tab.active');
    if (!active) return;
    const t = active.dataset.tab;
    if (t === 'password') { $('copyPwd').click(); e.preventDefault(); }
    else if (t === 'passphrase') { $('copyPhrase').click(); e.preventDefault(); }
    else if (t === 'batch' && state.lastBatch.length) {
      window.pg.copy(state.lastBatch.join('\n'));
      showToast('已复制全部 ' + state.lastBatch.length + ' 个');
      e.preventDefault();
    } else { showToast('当前页无内容可复制'); e.preventDefault(); }
    return;
  }
  // Ctrl+L 聚焦强度输入
  if (e.key.toLowerCase() === 'l' && !e.shiftKey && !e.altKey) {
    const tab = document.querySelector('.tab[data-tab="strength"]');
    if (tab) { tab.click(); $('strengthInput').focus(); e.preventDefault(); }
    return;
  }
});

loadHistory();
syncCopyDisabled();
setTimeout(() => genPassword(true), 200);
