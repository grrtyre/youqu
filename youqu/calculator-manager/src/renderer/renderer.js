// 科学计算器管家 · 渲染进程逻辑
// 苹果白高端风格，纯本地隐私优先

'use strict';

(function () {
  // ============ 状态 ============
  const state = {
    mode: 'scientific',   // basic | scientific | programmer
    currentExpr: '',
    history: [],
    variables: {},
    historyCursor: -1,   // 用于 ↑/↓ 浏览历史
    lastValidResult: '0',
  };

  // ============ DOM 引用 ============
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const exprEl = $('#display-expr');
  const resultEl = $('#result-value');
  const metaErrorEl = $('#meta-error');
  const metaHintEl = $('#meta-hint');
  const keypadEl = $('#keypad');
  const basePanel = $('#base-panel');
  const baseHex = $('#base-hex');
  const baseDec = $('#base-dec');
  const baseOct = $('#base-oct');
  const baseBin = $('#base-bin');
  const historyListEl = $('#history-list');
  const historyEmptyEl = $('#history-empty');
  const varsListEl = $('#vars-list');
  const varsEmptyEl = $('#vars-empty');
  const toastEl = $('#toast');

  // ============ 键盘布局 ============
  // key: { label, insert, cls, action }
  // insert: 要在光标处插入的文本
  // action: 特殊动作 clear/backspace/equals/assign

  const LAYOUTS = {
    basic: [
      [
        { label: 'AC', action: 'clear', cls: 'danger' },
        { label: '(', insert: '(' },
        { label: ')', insert: ')' },
        { label: '÷', insert: '/', cls: 'op' },
      ],
      [
        { label: '7', insert: '7' },
        { label: '8', insert: '8' },
        { label: '9', insert: '9' },
        { label: '×', insert: '*', cls: 'op' },
      ],
      [
        { label: '4', insert: '4' },
        { label: '5', insert: '5' },
        { label: '6', insert: '6' },
        { label: '−', insert: '-', cls: 'op' },
      ],
      [
        { label: '1', insert: '1' },
        { label: '2', insert: '2' },
        { label: '3', insert: '3' },
        { label: '+', insert: '+', cls: 'op' },
      ],
      [
        { label: '0', insert: '0', cls: 'wide-2' },
        { label: '.', insert: '.' },
        { label: '=', action: 'equals', cls: 'accent' },
      ],
    ],
    scientific: [
      [
        { label: 'sin', insert: 'sin(', cls: 'fn' },
        { label: 'cos', insert: 'cos(', cls: 'fn' },
        { label: 'tan', insert: 'tan(', cls: 'fn' },
        { label: 'π', insert: 'pi', cls: 'fn' },
        { label: 'e', insert: 'e', cls: 'fn' },
      ],
      [
        { label: 'log', insert: 'log(', cls: 'fn' },
        { label: 'ln', insert: 'ln(', cls: 'fn' },
        { label: '√', insert: 'sqrt(', cls: 'fn' },
        { label: 'x²', insert: '^2', cls: 'fn' },
        { label: 'x^y', insert: '^', cls: 'fn' },
      ],
      [
        { label: 'AC', action: 'clear', cls: 'danger' },
        { label: '(', insert: '(' },
        { label: ')', insert: ')' },
        { label: '%', insert: '%', cls: 'op' },
        { label: '÷', insert: '/', cls: 'op' },
      ],
      [
        { label: '7', insert: '7' },
        { label: '8', insert: '8' },
        { label: '9', insert: '9' },
        { label: '×', insert: '*', cls: 'op' },
        { label: 'n!', insert: '!', cls: 'fn' },
      ],
      [
        { label: '4', insert: '4' },
        { label: '5', insert: '5' },
        { label: '6', insert: '6' },
        { label: '−', insert: '-', cls: 'op' },
        { label: '1/x', insert: '1/(', cls: 'fn' },
      ],
      [
        { label: '1', insert: '1' },
        { label: '2', insert: '2' },
        { label: '3', insert: '3' },
        { label: '+', insert: '+', cls: 'op' },
        { label: 'abs', insert: 'abs(', cls: 'fn' },
      ],
      [
        { label: '0', insert: '0', cls: 'wide-2' },
        { label: '.', insert: '.' },
        { label: '=', action: 'equals', cls: 'accent', wide: 2 },
      ],
    ],
    programmer: [
      [
        { label: 'AND', insert: ' and ', cls: 'fn' },
        { label: 'OR', insert: ' or ', cls: 'fn' },
        { label: 'XOR', insert: ' xor ', cls: 'fn' },
        { label: 'NOT', insert: 'not ', cls: 'fn' },
        { label: 'MOD', insert: ' % ', cls: 'fn' },
      ],
      [
        { label: '<<', insert: ' shl ', cls: 'fn' },
        { label: '>>', insert: ' shr ', cls: 'fn' },
        { label: 'AC', action: 'clear', cls: 'danger' },
        { label: '(', insert: '(' },
        { label: ')', insert: ')' },
      ],
      [
        { label: 'A', insert: '0xA', cls: 'op' },
        { label: 'B', insert: '0xB', cls: 'op' },
        { label: 'C', insert: '0xC', cls: 'op' },
        { label: 'D', insert: '0xD', cls: 'op' },
        { label: '÷', insert: '/', cls: 'op' },
      ],
      [
        { label: 'E', insert: '0xE', cls: 'op' },
        { label: 'F', insert: '0xF', cls: 'op' },
        { label: '9', insert: '9' },
        { label: '8', insert: '8' },
        { label: '×', insert: '*', cls: 'op' },
      ],
      [
        { label: '7', insert: '7' },
        { label: '6', insert: '6' },
        { label: '5', insert: '5' },
        { label: '4', insert: '4' },
        { label: '−', insert: '-', cls: 'op' },
      ],
      [
        { label: '3', insert: '3' },
        { label: '2', insert: '2' },
        { label: '1', insert: '1' },
        { label: '0', insert: '0' },
        { label: '+', insert: '+', cls: 'op' },
      ],
      [
        { label: '=', action: 'equals', cls: 'accent', wide: 5 },
      ],
    ],
  };

  // ============ 渲染键盘 ============
  function renderKeypad() {
    const layout = LAYOUTS[state.mode] || LAYOUTS.basic;
    keypadEl.innerHTML = '';
    // 计算最大列数
    const maxCols = Math.max(...layout.map(row => row.length));
    keypadEl.style.gridTemplateColumns = `repeat(${maxCols}, 1fr)`;

    layout.forEach(row => {
      row.forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'key' + (k.cls ? ' ' + k.cls : '');
        if (k.wide) btn.classList.add('wide-' + k.wide);
        btn.textContent = k.label;
        btn.addEventListener('click', () => handleKey(k));
        keypadEl.appendChild(btn);
      });
    });
  }

  // ============ 按键处理 ============
  function handleKey(k) {
    if (k.action === 'clear') {
      clearExpr();
      return;
    }
    if (k.action === 'backspace') {
      backspace();
      return;
    }
    if (k.action === 'equals') {
      doEvaluate();
      return;
    }
    if (k.insert) {
      insertText(k.insert);
    }
  }

  // ============ 显示区操作 ============
  function insertText(text) {
    exprEl.focus();
    const sel = window.getSelection();
    if (sel.rangeCount === 0 || !exprEl.contains(sel.anchorNode)) {
      // 光标不在表达式里，追加到末尾
      exprEl.appendChild(document.createTextNode(text));
    } else {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    syncExpr();
    previewEvaluate();
  }

  function backspace() {
    exprEl.focus();
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && exprEl.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        // 光标处向前删一字符
        const node = range.startContainer;
        const offset = range.startOffset;
        if (node.nodeType === Node.TEXT_NODE && offset > 0) {
          node.deleteData(offset - 1, 1);
        } else if (offset > 0 && exprEl.childNodes[offset - 1]) {
          exprEl.removeChild(exprEl.childNodes[offset - 1]);
        }
      } else {
        range.deleteContents();
      }
    } else if (exprEl.lastChild) {
      exprEl.removeChild(exprEl.lastChild);
    }
    syncExpr();
    previewEvaluate();
  }

  function clearExpr() {
    exprEl.textContent = '';
    state.currentExpr = '';
    setResultText('0');
    setError('');
    exprEl.focus();
  }

  function syncExpr() {
    state.currentExpr = exprEl.textContent || '';
  }

  function setResultText(text, isError) {
    resultEl.textContent = text;
    resultEl.classList.toggle('error', !!isError);
  }

  function setError(msg) {
    metaErrorEl.textContent = msg || '';
    metaHintEl.style.display = msg ? 'none' : '';
  }

  // ============ 实时预览 ============
  let previewTimer = null;
  function previewEvaluate() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      const expr = state.currentExpr.trim();
      if (!expr) {
        setResultText('0');
        setError('');
        return;
      }
      // 跳过赋值表达式
      if (/^[a-zA-Z_]\w*\s*=/.test(expr) && !expr.includes('==')) {
        setError('');
        setResultText('赋值', false);
        return;
      }
      // 程序员模式的位运算交给引擎解析
      try {
        const res = await window.calcAPI.evaluate(expr);
        if (res.ok) {
          setResultText(res.formatted, false);
          state.lastValidResult = res.formatted;
          setError('');
          if (state.mode === 'programmer') {
            updateBasePanel(res.value);
          }
        } else {
          // 不显示错误（避免输入过程抖动），仅清空进制面板
          if (state.mode === 'programmer') clearBasePanel();
        }
      } catch (err) {
        // 忽略
      }
    }, 120);
  }

  function clearBasePanel() {
    baseHex.textContent = baseDec.textContent = baseOct.textContent = baseBin.textContent = '0';
  }

  async function updateBasePanel(num) {
    try {
      const res = await window.calcAPI.convertBase(num);
      if (res.ok) {
        baseHex.textContent = res.hex;
        baseDec.textContent = res.dec;
        baseOct.textContent = res.oct;
        baseBin.textContent = res.bin;
      }
    } catch (_) {}
  }

  // ============ 求值 ============
  async function doEvaluate() {
    const expr = state.currentExpr.trim();
    if (!expr) return;

    // 赋值表达式
    if (/^[a-zA-Z_]\w*\s*=/.test(expr) && !expr.includes('==')) {
      try {
        const res = await window.calcAPI.assign(expr);
        if (res.ok) {
          setResultText(res.formatted, false);
          state.lastValidResult = res.formatted;
          setError('');
          showToast(`已设置 ${res.name} = ${res.formatted}`);
          await refreshVariables();
          appendHistoryItem({ expr, result: res.formatted, mode: state.mode });
          state.historyCursor = -1;
        } else {
          setResultText(res.error || '赋值失败', true);
          setError(res.error || '');
        }
      } catch (err) {
        setResultText(String(err), true);
      }
      return;
    }

    // 普通求值
    try {
      const res = await window.calcAPI.evaluate(expr);
      if (res.ok) {
        setResultText(res.formatted, false);
        state.lastValidResult = res.formatted;
        setError('');
        appendHistoryItem({ expr, result: res.formatted, mode: state.mode });
        state.historyCursor = -1;
      } else {
        setResultText(res.error || '计算错误', true);
        setError(res.error || '');
      }
    } catch (err) {
      setResultText(String(err), true);
    }
  }

  // ============ 历史 ============
  async function refreshHistory() {
    try {
      const res = await window.calcAPI.historyList();
      if (res.ok) {
        state.history = res.items || [];
        renderHistory();
      }
    } catch (_) {}
  }

  async function appendHistoryItem(item) {
    try {
      const res = await window.calcAPI.historyAppend(item);
      if (res.ok) {
        state.history = res.items || [];
        renderHistory();
      }
    } catch (_) {}
  }

  function renderHistory() {
    historyListEl.innerHTML = '';
    if (!state.history || state.history.length === 0) {
      historyEmptyEl.style.display = '';
      historyListEl.style.display = 'none';
      return;
    }
    historyEmptyEl.style.display = 'none';
    historyListEl.style.display = '';

    // 倒序显示（最新在上）
    const reversed = [...state.history].reverse();
    reversed.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      const modeTag = item.mode && item.mode !== 'basic'
        ? `<span class="h-mode">${({scientific: '科学', programmer: '程序员', basic: '基础'})[item.mode] || item.mode}</span>`
        : '';

      li.innerHTML = `
        <div class="h-expr">${escapeHtml(item.expr)}${modeTag}</div>
        <div class="h-result"><span class="h-eq">=</span>${escapeHtml(item.result)}</div>
        <div class="h-time">${formatTime(item.createdAt)}</div>
        <button class="h-del" title="删除">×</button>
      `;

      // 点击复用表达式
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('h-del')) return;
        setExprText(item.expr);
        showToast('已载入表达式');
      });

      // 删除
      li.querySelector('.h-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await window.calcAPI.historyDelete(item.id);
        if (res.ok) {
          state.history = res.items || [];
          renderHistory();
          showToast('已删除');
        }
      });

      historyListEl.appendChild(li);
    });
  }

  function setExprText(text) {
    exprEl.textContent = text;
    syncExpr();
    previewEvaluate();
    exprEl.focus();
    // 光标移到末尾
    placeCursorEnd();
  }

  function placeCursorEnd() {
    const range = document.createRange();
    range.selectNodeContents(exprEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ============ 变量 ============
  async function refreshVariables() {
    try {
      const res = await window.calcAPI.varsList();
      if (res.ok) {
        state.variables = res.variables || {};
        renderVariables();
      }
    } catch (_) {}
  }

  function renderVariables() {
    varsListEl.innerHTML = '';
    const entries = Object.entries(state.variables || {});
    if (entries.length === 0) {
      varsEmptyEl.style.display = '';
      varsListEl.style.display = 'none';
      return;
    }
    varsEmptyEl.style.display = 'none';
    varsListEl.style.display = '';

    entries.forEach(([name, value]) => {
      const li = document.createElement('li');
      li.className = 'vars-item';
      const formatted = formatNumber(value);
      li.innerHTML = `
        <span class="v-name">${escapeHtml(name)}</span>
        <span class="v-eq">=</span>
        <span class="v-val">${escapeHtml(formatted)}</span>
        <button class="v-del" title="删除变量">×</button>
      `;
      li.querySelector('.v-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await window.calcAPI.varsDelete(name);
        if (res.ok) {
          state.variables = res.variables || {};
          renderVariables();
          showToast(`已删除变量 ${name}`);
        }
      });
      varsListEl.appendChild(li);
    });
  }

  function formatNumber(num) {
    if (typeof num !== 'number') return String(num);
    if (Number.isInteger(num) && Math.abs(num) < 1e15) return String(num);
    return String(num);
  }

  // ============ 模式切换 ============
  function switchMode(mode) {
    if (!LAYOUTS[mode]) return;
    state.mode = mode;
    $$('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    // 程序员模式显示进制面板
    basePanel.classList.toggle('hidden', mode !== 'programmer');
    renderKeypad();
    previewEvaluate();
  }

  // ============ 侧边栏切换 ============
  function switchSide(name) {
    $$('.side-tab').forEach(t => t.classList.toggle('active', t.dataset.side === name));
    $$('.side-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + name));
  }

  // ============ 工具函数 ============
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400 && d.getDate() === now.getDate()) {
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  // ============ 历史光标浏览 ============
  function browseHistory(direction) {
    if (!state.history || state.history.length === 0) return;
    if (state.historyCursor === -1) {
      state.historyCursor = state.history.length; // 从末尾开始
    }
    state.historyCursor += direction;
    if (state.historyCursor < 0) state.historyCursor = 0;
    if (state.historyCursor >= state.history.length) {
      state.historyCursor = state.history.length - 1;
    }
    const item = state.history[state.historyCursor];
    if (item) setExprText(item.expr);
  }

  // ============ 事件绑定 ============
  function bindEvents() {
    // 模式 tab
    $$('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    // 侧边 tab
    $$('.side-tab').forEach(tab => {
      tab.addEventListener('click', () => switchSide(tab.dataset.side));
    });

    // 表达式输入
    exprEl.addEventListener('input', () => {
      syncExpr();
      previewEvaluate();
    });

    // 键盘事件
    exprEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doEvaluate();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        clearExpr();
        return;
      }
      // ↑/↓ 浏览历史（只有在表达式为空或光标在开头时）
      if (e.key === 'ArrowUp') {
        if (exprEl.textContent.trim() === '' || getCaretOffset() === 0) {
          e.preventDefault();
          browseHistory(-1);
          return;
        }
      }
      if (e.key === 'ArrowDown') {
        if (getCaretOffset() >= exprEl.textContent.length) {
          e.preventDefault();
          browseHistory(1);
          return;
        }
      }
      // 全局快捷键（即使焦点不在表达式）
      if (e.key === 'Tab') {
        e.preventDefault();
        const modes = ['basic', 'scientific', 'programmer'];
        const idx = modes.indexOf(state.mode);
        const next = e.shiftKey ? (idx - 1 + modes.length) % modes.length : (idx + 1) % modes.length;
        switchMode(modes[next]);
        return;
      }
    });

    // 全局键盘：数字和运算符直接输入到表达式
    document.addEventListener('keydown', (e) => {
      // 焦点在表达式里时不重复处理
      if (document.activeElement === exprEl) return;
      // 焦点在按钮或输入框时不拦截
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        doEvaluate();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        clearExpr();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const modes = ['basic', 'scientific', 'programmer'];
        const idx = modes.indexOf(state.mode);
        const next = e.shiftKey ? (idx - 1 + modes.length) % modes.length : (idx + 1) % modes.length;
        switchMode(modes[next]);
        return;
      }
      // 数字、运算符、点
      if (/^[0-9+\-*/().%^!]$/.test(e.key)) {
        e.preventDefault();
        exprEl.focus();
        insertText(e.key);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        exprEl.focus();
        backspace();
        return;
      }
    });

    // 进制面板复制按钮
    $$('.base-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const base = btn.dataset.base;
        const text = ({ hex: baseHex, dec: baseDec, oct: baseOct, bin: baseBin })[base].textContent;
        try {
          await navigator.clipboard.writeText(text);
          showToast(`已复制 ${base.toUpperCase()}`);
        } catch (_) {
          showToast('复制失败');
        }
      });
    });

    // 操作栏按钮
    $('#btn-assign').addEventListener('click', () => {
      showToast('在表达式区输入 x = 5 形式即可定义变量');
      setExprText('');
    });

    $('#btn-copy-result').addEventListener('click', async () => {
      const text = resultEl.textContent;
      try {
        await navigator.clipboard.writeText(text);
        showToast('已复制结果');
      } catch (_) {
        showToast('复制失败');
      }
    });

    $('#btn-clear-history').addEventListener('click', async () => {
      if (state.history.length === 0) {
        showToast('历史为空');
        return;
      }
      if (!confirm('确定要清空全部历史记录吗？此操作不可撤销。')) return;
      await window.calcAPI.historyClear();
      state.history = [];
      renderHistory();
      showToast('已清空历史');
    });

    // 帮助按钮
    $('#btn-help').addEventListener('click', () => {
      switchSide('help');
    });
  }

  function getCaretOffset() {
    const sel = window.getSelection();
    if (sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(exprEl);
    preRange.setEnd(range.endContainer, range.endOffset);
    return preRange.toString().length;
  }

  // ============ 初始化 ============
  async function init() {
    renderKeypad();
    bindEvents();
    syncExpr(); // 从 DOM 同步初始表达式
    await refreshHistory();
    await refreshVariables();
    exprEl.focus();
    placeCursorEnd();
    // 触发一次预览
    previewEvaluate();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
