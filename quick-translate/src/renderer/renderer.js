// 渲染进程：语言填充、翻译、历史、快捷键、持久化
// 兼容 Electron（window.qtAPI）与浏览器（Edge headless 截图）环境

'use strict';

const hasQt = typeof window.qtAPI !== 'undefined';
const { LANGUAGES, translate } = window.qtTranslator || {};

const $ = (id) => document.getElementById(id);

const sourceLang = $('sourceLang');
const targetLang = $('targetLang');
const engineSelect = $('engineSelect');
const sourceText = $('sourceText');
const targetText = $('targetText');
const charCount = $('charCount');
const targetMeta = $('targetMeta');
const btnSwap = $('btnSwap');
const btnClear = $('btnClear');
const btnCopy = $('btnCopy');
const btnMinimize = $('btnMinimize');
const btnClose = $('btnClose');
const watchToggle = $('watchToggle');
const statusBar = $('statusBar');
const statusText = $('statusText');
const historyList = $('historyList');
const historyCount = $('historyCount');
const historyToggle = $('historyToggle');
const historySection = $('historySection');

// 浏览器环境下隐藏窗口控制按钮（保留底部新设计）
if (!hasQt) {
  document.getElementById('titlebar').querySelector('.titlebar-right').style.display = 'none';
}

// 填充语言下拉（幂等：先清空再填充，兼容 HTML 预置选项）
function fillLangs() {
  sourceLang.innerHTML = '';
  targetLang.innerHTML = '';
  for (const l of LANGUAGES) {
    const o1 = document.createElement('option');
    o1.value = l.code; o1.textContent = l.name;
    sourceLang.appendChild(o1);
    if (l.code !== 'auto') {
      const o2 = document.createElement('option');
      o2.value = l.code; o2.textContent = l.name;
      targetLang.appendChild(o2);
    }
  }
}

// 持久化
async function loadSettings() {
  let s;
  if (hasQt) s = await window.qtAPI.loadStore();
  else s = JSON.parse(localStorage.getItem('qt-store') || 'null');
  if (!s) s = { settings: { from: 'auto', to: 'zh', clipboardWatch: false, engine: 'auto' }, history: [] };
  sourceLang.value = s.settings.from || 'auto';
  targetLang.value = s.settings.to || 'zh';
  engineSelect.value = s.settings.engine || 'auto';
  watchToggle.checked = !!s.settings.clipboardWatch;
  state.history = Array.isArray(s.history) ? s.history : [];
  renderHistory();
}
async function saveSettings() {
  const s = {
    settings: {
      from: sourceLang.value, to: targetLang.value,
      clipboardWatch: watchToggle.checked, engine: engineSelect.value
    },
    history: state.history.slice(0, 100)
  };
  if (hasQt) await window.qtAPI.saveStore(s);
  else localStorage.setItem('qt-store', JSON.stringify(s));
}

const state = { history: [], translating: false, lastResult: '' };

function setStatus(on, text) {
  statusBar.hidden = !on;
  if (on) statusText.textContent = text || '翻译中…';
}
function setMeta(text) { targetMeta.textContent = text; }

// 翻译主流程
async function doTranslate(text) {
  const q = (text !== undefined ? text : sourceText.value).trim();
  if (!q) { targetText.textContent = ''; setMeta('就绪'); updateCharCount(); return; }
  if (sourceLang.value === targetLang.value) {
    targetText.textContent = q;
    setMeta('源与目标相同');
    return;
  }
  if (state.translating) return;
  state.translating = true;
  setStatus(true, '翻译中…');
  targetText.classList.add('loading');
  targetText.textContent = '翻译中…';
  const from = sourceLang.value, to = targetLang.value, engine = engineSelect.value;
  try {
    const r = await translate({ text: q, from, to, engine });
    targetText.classList.remove('loading');
    targetText.textContent = r.text;
    state.lastResult = r.text;
    const det = r.detectedSource ? ('检测: ' + langName(r.detectedSource) + ' · ') : '';
    setMeta(det + '引擎: ' + engineLabel(r.engine));
    addHistory(q, r.text, from, to, r.detectedSource, r.engine);
  } catch (e) {
    targetText.classList.remove('loading');
    targetText.textContent = '翻译失败：' + (e && e.message ? e.message : '网络错误');
    setMeta('失败');
  } finally {
    state.translating = false;
    setStatus(false);
    saveSettings();
  }
}

function langName(code) {
  const l = LANGUAGES.find(x => x.code === code);
  return l ? l.name : code;
}
function engineLabel(e) {
  return e === 'google' ? 'Google' : (e === 'mymemory' ? 'MyMemory' : '智能');
}

// 字数
function updateCharCount() {
  charCount.textContent = sourceText.value.length + ' 字';
}

// 历史
function addHistory(src, tgt, from, to, det, engine) {
  // 去重：相同源+目标+文本则前置
  state.history = state.history.filter(h => !(h.src === src && h.tgt === tgt && h.to === to));
  state.history.unshift({ src, tgt, from, to, det, engine, ts: Date.now() });
  state.history = state.history.slice(0, 100);
  renderHistory();
}
function renderHistory() {
  historyCount.textContent = state.history.length;
  if (state.history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
    return;
  }
  historyList.innerHTML = '';
  for (const h of state.history.slice(0, 30)) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML =
      '<span class="hi-src"></span>' +
      '<span class="hi-arrow">→</span>' +
      '<span class="hi-tgt"></span>' +
      '<span class="hi-lang"></span>';
    item.querySelector('.hi-src').textContent = h.src;
    item.querySelector('.hi-tgt').textContent = h.tgt;
    item.querySelector('.hi-lang').textContent = langName(h.from === 'auto' ? (h.det || 'auto') : h.from) + ' → ' + langName(h.to);
    item.addEventListener('click', () => {
      sourceText.value = h.src;
      sourceLang.value = h.from || 'auto';
      targetLang.value = h.to;
      updateCharCount();
      doTranslate();
    });
    historyList.appendChild(item);
  }
}

// 事件绑定
sourceText.addEventListener('input', updateCharCount);
sourceText.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doTranslate(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) { e.preventDefault(); swapLangs(); }
});

btnSwap.addEventListener('click', swapLangs);
function swapLangs() {
  // 交换语言并交换文本（若源为 auto，则用检测结果）
  const f = sourceLang.value;
  let t = targetLang.value;
  if (f === 'auto') {
    // 自动检测时，交换后把目标设为检测到的语言（若可知）
    const det = /检测: ([^·]+)/.exec(targetMeta.textContent);
    if (det) { const m = LANGUAGES.find(l => l.name === det[1].trim()); if (m) f2(m.code); }
  }
  sourceLang.value = t;
  targetLang.value = (f === 'auto') ? targetLang.value : f;
  const tmp = sourceText.value;
  sourceText.value = targetText.textContent && !targetText.classList.contains('loading') ? targetText.textContent : tmp;
  targetText.textContent = '';
  updateCharCount();
  setMeta('已交换');
  saveSettings();
  function f2(c){ /* placeholder used above */ }
}

btnClear.addEventListener('click', () => {
  sourceText.value = '';
  targetText.textContent = '';
  updateCharCount();
  setMeta('就绪');
  sourceText.focus();
});

btnCopy.addEventListener('click', async () => {
  const text = targetText.textContent;
  if (!text || text === '翻译中…') return;
  if (hasQt) await window.qtAPI.writeClipboard(text);
  else { try { await navigator.clipboard.writeText(text); } catch (e) {} }
  const orig = btnCopy.innerHTML;
  btnCopy.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13"><path d="M3 6.5l2.2 2.2L10 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> 已复制';
  btnCopy.style.color = 'var(--success)';
  btnCopy.style.borderColor = 'var(--success)';
  setTimeout(() => { btnCopy.innerHTML = orig; btnCopy.style.color = ''; btnCopy.style.borderColor = ''; }, 1200);
});

if (hasQt) {
  btnMinimize.addEventListener('click', () => window.qtAPI.minimize());
  btnClose.addEventListener('click', () => window.qtAPI.close());
  window.qtAPI.onTranslateClipboard((text) => {
    sourceText.value = text;
    updateCharCount();
    doTranslate();
  });
  window.qtAPI.onWindowShown(() => { sourceText.focus(); });
}

watchToggle.addEventListener('change', () => {
  if (hasQt) window.qtAPI.setWatch(watchToggle.checked);
  saveSettings();
});
[sourceLang, targetLang, engineSelect].forEach(el => el.addEventListener('change', saveSettings));

historyToggle.addEventListener('click', () => {
  historySection.classList.toggle('collapsed');
  historyToggle.setAttribute('aria-expanded', !historySection.classList.contains('collapsed'));
});

// 初始化
fillLangs();

function applySettings(s) {
  sourceLang.value = (s && s.settings && s.settings.from) || 'auto';
  targetLang.value = (s && s.settings && s.settings.to) || 'zh';
  engineSelect.value = (s && s.settings && s.settings.engine) || 'auto';
  watchToggle.checked = !!(s && s.settings && s.settings.clipboardWatch);
  state.history = (s && Array.isArray(s.history)) ? s.history : [];
  renderHistory();
}

if (hasQt) {
  // Electron 环境：异步读取持久化数据，自动翻译
  loadSettings().then(() => {
    updateCharCount();
    if (!sourceText.value) {
      sourceText.value = 'Hello, this is Quick Translate — a fast, elegant translator that lives in your tray.';
      updateCharCount();
      doTranslate();
    }
    sourceText.focus();
  });
} else {
  // 浏览器/截图环境：同步预填示例数据，不触发网络翻译（避免 loading 态与网络依赖）
  const s = JSON.parse(localStorage.getItem('qt-store') || 'null');
  applySettings(s);
  // 保留 HTML 硬编码的长示例文本与译文（渐进增强），仅同步字数
  updateCharCount();
  state.history = [
    { src: 'Hello, this is Quick Translate — a fast, elegant translator that lives in your tray.', tgt: '你好，这是快速翻译器 —— 一款驻留托盘的快速、优雅的翻译工具。', from: 'auto', to: 'zh', det: 'en', engine: 'google', ts: Date.now() - 60000 },
    { src: 'Copy any text from anywhere, press Ctrl+Shift+T, and get the translation instantly.', tgt: '从任何地方复制文本，按下 Ctrl+Shift+T，即可立即获得翻译。', from: 'auto', to: 'zh', det: 'en', engine: 'google', ts: Date.now() - 120000 },
    { src: 'Thank you', tgt: '谢谢你', from: 'auto', to: 'zh', det: 'en', engine: 'google', ts: Date.now() - 180000 },
    { src: '今天天气真好', tgt: 'The weather is really nice today', from: 'auto', to: 'en', det: 'zh', engine: 'google', ts: Date.now() - 240000 },
    { src: 'Good morning', tgt: '早上好', from: 'auto', to: 'zh', det: 'en', engine: 'mymemory', ts: Date.now() - 300000 }
  ];
  renderHistory();
  sourceText.focus();
}
