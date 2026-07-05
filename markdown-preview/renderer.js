/* ============================================================
   Markdown 预览器 · 渲染进程逻辑
   - 实时预览（input 事件）
   - 导出独立 HTML 文件（内联样式）
   - 复制渲染 HTML
   - 清空
   - 字符/字数/行数统计
   - localStorage 自动保存
   - 视图模式切换（分屏/仅编辑/仅预览）
   - 拖动 gutter 调整左右宽度
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'markdown-preview:content';
  var MODE_KEY = 'markdown-preview:mode';
  var RATIO_KEY = 'markdown-preview:ratio';

  var editor = document.getElementById('editor');
  var preview = document.getElementById('preview');
  var editorMeta = document.getElementById('editor-meta');
  var previewMeta = document.getElementById('preview-meta');
  var statChars = document.getElementById('stat-chars');
  var statWords = document.getElementById('stat-words');
  var statLines = document.getElementById('stat-lines');
  var statusTip = document.getElementById('status-tip');
  var main = document.getElementById('main');
  var app = document.querySelector('.app');
  var gutter = document.getElementById('gutter');

  // ======================== 渲染 ========================
  function render() {
    var text = editor.value;
    if (!text || !text.trim()) {
      preview.innerHTML = '<div class="empty-hint">预览区将在此显示渲染结果</div>';
      previewMeta.textContent = '就绪';
      return;
    }
    try {
      var html = MarkdownParser.parseMarkdown(text);
      preview.innerHTML = html;
      previewMeta.textContent = '已渲染';
    } catch (e) {
      preview.innerHTML = '<div class="empty-hint" style="color:#c41a4a">渲染出错：' + escapeText(e.message) + '</div>';
      previewMeta.textContent = '出错';
    }
  }

  function escapeText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ======================== 统计 ========================
  function updateStats() {
    var text = editor.value;
    var chars = text.length;
    // 字数：中文每字算 1，英文按单词算
    var cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    var en = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
    var words = cjk + en;
    var lines = text === '' ? 1 : text.split('\n').length;

    statChars.textContent = '字符 ' + chars;
    statWords.textContent = '字数 ' + words;
    statLines.textContent = '行数 ' + lines;
    editorMeta.textContent = words + ' 字';
  }

  // ======================== 本地存储 ========================
  var saveTimer = null;
  function saveDelayed() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_KEY, editor.value);
        statusTip.textContent = '已自动保存到本地';
        setTimeout(function () { statusTip.textContent = '就绪 · 内容自动保存到本地'; }, 1500);
      } catch (e) {
        statusTip.textContent = '保存失败：' + e.message;
      }
    }, 600);
  }

  function loadSaved() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.length > 0) {
        editor.value = saved;
        return true;
      }
    } catch (e) {}
    return false;
  }

  // ======================== 视图模式 ========================
  function setMode(mode) {
    app.classList.remove('mode-split', 'mode-edit', 'mode-preview');
    app.classList.add('mode-' + mode);
    document.querySelectorAll('.switch-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
    // 切换后让编辑器重新获得焦点布局
    setTimeout(function () { editor.blur(); editor.focus(); editor.blur(); }, 0);
  }

  // ======================== 导出 HTML ========================
  function buildExportHtml(markdownText) {
    var rendered = MarkdownParser.parseMarkdown(markdownText);
    // 提取本文件 styles.css 内容是不现实的，这里用精简内联样式
    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '<title>Markdown 导出文档</title>',
      '<style>',
      EXPORT_CSS,
      '</style>',
      '</head>',
      '<body>',
      '<article class="markdown-body">',
      rendered,
      '</article>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  function exportHtml() {
    var text = editor.value;
    if (!text.trim()) {
      toast('编辑区为空，无可导出内容');
      return;
    }
    var html = buildExportHtml(text);
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var ts = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : n; };
    var name = 'markdown-' + ts.getFullYear() + pad(ts.getMonth() + 1) + pad(ts.getDate()) +
      '-' + pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds()) + '.html';
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已导出 ' + name);
  }

  // ======================== 复制 ========================
  function copyHtml() {
    var text = editor.value;
    if (!text.trim()) {
      toast('编辑区为空');
      return;
    }
    var html = MarkdownParser.parseMarkdown(text);
    // 优先写入富文本剪贴板，回退到纯文本
    var done = false;
    if (navigator.clipboard && navigator.clipboard.write) {
      var item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([html], { type: 'text/plain' })
      });
      navigator.clipboard.write([item]).then(function () {
        toast('已复制渲染 HTML 到剪贴板');
      }).catch(function () {
        fallbackCopy(html);
      });
      done = true;
    }
    if (!done) fallbackCopy(html);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('已复制到剪贴板');
    } catch (e) {
      toast('复制失败');
    }
    document.body.removeChild(ta);
  }

  // ======================== 清空 ========================
  function clearAll() {
    if (!editor.value.trim()) {
      toast('已经是空的');
      return;
    }
    if (!confirm('确定清空编辑区？此操作不可撤销。')) return;
    editor.value = '';
    render();
    updateStats();
    saveDelayed();
    editor.focus();
    toast('已清空');
  }

  // ======================== Toast ========================
  var toastEl = null;
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 1800);
  }

  // ======================== 拖动调整宽度 ========================
  function initGutter() {
    var dragging = false;
    var startX = 0;
    var startRatio = 0.5;
    var containerWidth = 0;

    gutter.addEventListener('mousedown', function (e) {
      dragging = true;
      startX = e.clientX;
      startRatio = getRatio();
      containerWidth = main.getBoundingClientRect().width - 8;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var ratio = startRatio + dx / containerWidth;
      ratio = Math.max(0.2, Math.min(0.8, ratio));
      setRatio(ratio);
    });

    document.addEventListener('mouseup', function () {
      if (dragging) {
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        try { localStorage.setItem(RATIO_KEY, String(getRatio())); } catch (e) {}
      }
    });
  }

  function getRatio() {
    var total = main.getBoundingClientRect().width - 8;
    if (total <= 0) return 0.5;
    return editorPane().getBoundingClientRect().width / total;
  }

  function setRatio(r) {
    var pct = (r * 100) + '%';
    editorPane().style.flex = '1 1 ' + pct;
    previewPane().style.flex = '1 1 ' + (100 - r * 100) + '%';
  }

  function editorPane() { return document.getElementById('editor-pane'); }
  function previewPane() { return document.getElementById('preview-pane'); }

  // ======================== 事件绑定 ========================
  editor.addEventListener('input', function () {
    render();
    updateStats();
    saveDelayed();
  });

  // Tab 键插入两个空格
  editor.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      var start = editor.selectionStart;
      var end = editor.selectionEnd;
      editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      render();
      updateStats();
      saveDelayed();
    }
    // Ctrl/Cmd + S 导出
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      exportHtml();
    }
  });

  document.getElementById('btn-copy').addEventListener('click', copyHtml);
  document.getElementById('btn-export').addEventListener('click', exportHtml);
  document.getElementById('btn-clear').addEventListener('click', clearAll);

  document.querySelectorAll('.switch-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setMode(btn.dataset.mode);
    });
  });

  // ======================== 导出文档内联样式 ========================
  var EXPORT_CSS = [
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'body { font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif; color:#1d1d1f; background:#fff; line-height:1.75; padding:40px 20px; }',
    '.markdown-body { max-width:760px; margin:0 auto; font-size:15px; }',
    'h1,h2,h3,h4,h5,h6 { font-weight:600; line-height:1.3; margin:1.6em 0 0.6em; }',
    'h1 { font-size:1.9em; padding-bottom:0.3em; border-bottom:1px solid #ededf0; }',
    'h2 { font-size:1.5em; padding-bottom:0.3em; border-bottom:1px solid #ededf0; }',
    'h3 { font-size:1.25em; }',
    'p { margin:0.8em 0; }',
    'a { color:#007aff; text-decoration:none; }',
    'a:hover { text-decoration:underline; }',
    'strong { font-weight:600; }',
    'code { font-family:"SF Mono",Menlo,Consolas,monospace; font-size:0.88em; background:rgba(0,0,0,0.05); padding:0.15em 0.4em; border-radius:4px; color:#c41a4a; }',
    'pre { background:#f6f8fa; border:1px solid #ededf0; border-radius:8px; padding:14px 16px; overflow-x:auto; margin:1em 0; }',
    'pre code { background:transparent; padding:0; color:#1d1d1f; }',
    'blockquote { border-left:3px solid #007aff; background:rgba(0,122,255,0.08); padding:0.6em 1em; margin:1em 0; border-radius:0 6px 6px 0; color:#6e6e73; }',
    'ul,ol { margin:0.8em 0; padding-left:1.8em; }',
    'li { margin:0.3em 0; }',
    'hr { border:none; border-top:1px solid #ededf0; margin:2em 0; }',
    'img { max-width:100%; border-radius:8px; }',
    'table { border-collapse:collapse; width:100%; margin:1em 0; }',
    'th,td { border:1px solid #ededf0; padding:8px 12px; text-align:left; }',
    'th { background:#fbfbfd; font-weight:600; }',
    'tbody tr:nth-child(even) { background:#fbfbfd; }'
  ].join('\n');

  // ======================== 初始化 ========================
  function init() {
    // 恢复内容
    var hasSaved = loadSaved();
    if (!hasSaved) {
      editor.value = DEFAULT_CONTENT;
    }
    // 恢复视图模式
    var mode = 'split';
    try { mode = localStorage.getItem(MODE_KEY) || 'split'; } catch (e) {}
    setMode(mode);
    // 恢复宽度比例
    try {
      var r = parseFloat(localStorage.getItem(RATIO_KEY));
      if (!isNaN(r) && r > 0.2 && r < 0.8) setRatio(r);
    } catch (e) {}
    render();
    updateStats();
    initGutter();
    statusTip.textContent = '就绪 · 内容自动保存到本地';
  }

  // 默认示例内容
  var DEFAULT_CONTENT = [
    '# 欢迎使用 Markdown 预览器',
    '',
    '一个 **苹果白风格** 的本地 Markdown 预览工具，左侧编辑、右侧实时渲染。',
    '',
    '## 功能特性',
    '',
    '- 实时预览，输入即渲染',
    '- 支持 GFM 语法：表格、任务列表、代码块、引用',
    '- 中文排版优化：中英文之间自动加空格',
    '- 一键导出独立 HTML 文件',
    '- 内容自动保存到本地，刷新不丢失',
    '- `Ctrl + S` 快捷导出',
    '',
    '## 语法示例',
    '',
    '> 引用块：这是一段引用文字，带蓝色左边框。',
    '',
    '1. 有序列表第一项',
    '2. 有序列表第二项',
    '',
    '- [x] 已完成任务',
    '- [ ] 未完成任务',
    '',
    '### 表格',
    '',
    '| 工具 | 简介 | 状态 |',
    '|---|---|---|',
    '| Cron 中文可视化 | 定时任务表达式 | ✅ |',
    '| 剪贴板管家 | 剪贴板历史管理 | ✅ |',
    '| Markdown 预览器 | 本工具 | ✅ |',
    '',
    '### 代码块',
    '',
    '```javascript',
    'function hello(name) {',
    '  console.log("你好, " + name);',
    '}',
    'hello("世界");',
    '```',
    '',
    '### 行内格式',
    '',
    '这是 **粗体**、*斜体*、~~删除线~~、`行内代码`，以及一个 [链接](https://www.ifdian.net/a/giquwei)。',
    '',
    '中文与English混排时，会自动在中文和英文之间加上空格，让排版更美观。例如 iPhone15 价格 5999 元。',
    '',
    '---',
    '',
    '隐私优先：所有内容都在本地处理，不联网、不上传。'
  ].join('\n');

  init();
})();
