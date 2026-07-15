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

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    $('panel-' + target).classList.add('active');
    if (target === 'history') renderHistory();
  });
});

function getPwdOpts() {
  return {
    length: parseInt($('lengthInput').value) || 16,
    lower: $('chkLower').checked,
    upper: $('chkUpper').checked,
    digits: $('chkDigits').checked,
    symbols: $('chkSymbols').checked,
    excludeAmbiguous: $('chkExcludeAmb').checked
  };
}

async function genPassword() {
  const opts = getPwdOpts();
  if (!opts.lower && !opts.upper && !opts.digits && !opts.symbols) {
    showToast('至少选择一种字符类型');
    return;
  }
  setStatus('生成中…');
  const pwd = await window.pg.generate(opts);
  const display = $('pwdDisplay');
  display.textContent = pwd;
  display.classList.remove('empty');
  addHistory(pwd, '密码');
  const result = await window.pg.evaluate(pwd);
  updateStrengthMeter('strengthFill', 'strengthLabel', 'entropyInfo', result);
  setStatus('已生成');
}

function updateStrengthMeter(fillId, labelId, entropyId, result) {
  const fill = $(fillId);
  fill.className = 'strength-fill s' + result.score;
  const label = $(labelId);
  label.textContent = result.label;
  label.className = 'c-s' + result.score;
  $(entropyId).textContent = result.entropy > 0 ? `熵 ${result.entropy} bits` : '';
}

$('genBtn').addEventListener('click', genPassword);
$('regenPwd').addEventListener('click', genPassword);
$('copyPwd').addEventListener('click', async () => {
  const text = $('pwdDisplay').textContent;
  if (!text || text === '点击生成开始') { showToast('暂无内容'); return; }
  await window.pg.copy(text);
  showToast('已复制到剪贴板');
});

$('lengthSlider').addEventListener('input', (e) => { $('lengthInput').value = e.target.value; updateSliderFill(e.target); });
$('lengthInput').addEventListener('input', (e) => {
  let v = parseInt(e.target.value) || 16;
  v = Math.max(4, Math.min(64, v));
  $('lengthSlider').value = v;
  updateSliderFill($('lengthSlider'));
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

async function genPassphrase() {
  setStatus('生成中…');
  const phrase = await window.pg.passphrase(getPhraseOpts());
  const display = $('phraseDisplay');
  display.textContent = phrase;
  display.classList.remove('empty');
  addHistory(phrase, '口令');
  setStatus('已生成');
}

$('phraseBtn').addEventListener('click', genPassphrase);
$('regenPhrase').addEventListener('click', genPassphrase);
$('copyPhrase').addEventListener('click', async () => {
  const text = $('phraseDisplay').textContent;
  if (!text || text === '点击生成开始') { showToast('暂无内容'); return; }
  await window.pg.copy(text);
  showToast('已复制到剪贴板');
});

$('wordSlider').addEventListener('input', (e) => { $('wordInput').value = e.target.value; updateSliderFill(e.target); });
$('wordInput').addEventListener('input', (e) => {
  let v = parseInt(e.target.value) || 4;
  v = Math.max(3, Math.min(8, v));
  $('wordSlider').value = v;
  updateSliderFill($('wordSlider'));
});

document.querySelectorAll('.seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentSeparator = btn.dataset.sep;
  });
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
    sug.innerHTML = '<div class="suggestion-item" style="background:rgba(52,199,89,0.06);border-color:rgba(52,199,89,0.15)">密码强度良好，无明显弱点</div>';
  } else {
    result.suggestions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = s;
      sug.appendChild(item);
    });
  }
});

$('batchSlider').addEventListener('input', (e) => { $('batchInput').value = e.target.value; updateSliderFill(e.target); });
$('batchInput').addEventListener('input', (e) => {
  let v = parseInt(e.target.value) || 10;
  v = Math.max(5, Math.min(50, v));
  $('batchSlider').value = v;
  updateSliderFill($('batchSlider'));
});
$('batchLenSlider').addEventListener('input', (e) => { $('batchLenInput').value = e.target.value; updateSliderFill(e.target); });
$('batchLenInput').addEventListener('input', (e) => {
  let v = parseInt(e.target.value) || 16;
  v = Math.max(4, Math.min(64, v));
  $('batchLenSlider').value = v;
  updateSliderFill($('batchLenSlider'));
});

$('batchBtn').addEventListener('click', async () => {
  const count = parseInt($('batchInput').value) || 10;
  const length = parseInt($('batchLenInput').value) || 16;
  setStatus('批量生成中…');
  const list = await window.pg.batch({
    count, length,
    lower: true, upper: true, digits: true, symbols: true
  });
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
    item.innerHTML = `
      <span class="batch-item-index">${i + 1}</span>
      <span class="batch-item-text">${pwd}</span>
      <button class="batch-item-copy">复制</button>
    `;
    item.querySelector('.batch-item-copy').addEventListener('click', async () => {
      await window.pg.copy(pwd);
      showToast('已复制');
    });
    container.appendChild(item);
  });
}

$('batchCopyAll').addEventListener('click', async () => {
  if (!state.lastBatch.length) { showToast('暂无内容'); return; }
  await window.pg.copy(state.lastBatch.join('\n'));
  showToast('已复制全部');
});

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
    const time = new Date(item.time);
    const timeStr = `${time.getHours().toString().padStart(2,'0')}:${time.getMinutes().toString().padStart(2,'0')}:${time.getSeconds().toString().padStart(2,'0')}`;
    div.innerHTML = `
      <span class="history-item-text">${item.text}</span>
      <div class="history-item-meta">
        <span class="history-item-type">${item.type}</span>
        <span class="history-item-time">${timeStr}</span>
      </div>
      <button class="batch-item-copy">复制</button>
    `;
    div.querySelector('.batch-item-copy').addEventListener('click', async () => {
      await window.pg.copy(item.text);
      showToast('已复制');
    });
    container.appendChild(div);
  });
}

$('clearHistory').addEventListener('click', () => {
  if (!state.history.length) { showToast('历史为空'); return; }
  state.history = [];
  saveHistory();
  renderHistory();
  showToast('已清空');
});

$('openGithub').addEventListener('click', (e) => {
  e.preventDefault();
  window.pg.openExternal('https://github.com/grrtyre/youqu/tree/main/password-generator');
});

loadHistory();
setTimeout(() => genPassword(), 200);
