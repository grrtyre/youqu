/* ============================================================
   Markdown 预览器 · 渲染进程逻辑
   - 实时预览（input 事件）
   - 导出独立 HTML 文件（内联样式，含代码高亮）
   - 复制渲染 HTML
   - 清空
   - 字符/字数/行数统计
   - localStorage 自动保存
   - 视图模式切换（分屏/仅编辑/仅预览）
   - 拖动 gutter 调整左右宽度
   - v2 新增：目录大纲、暗色/亮色切换、拖拽打开文件、导出 PDF、代码块语法高亮
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'markdown-preview:content';
  var MODE_KEY = 'markdown-preview:mode';
  var RATIO_KEY = 'markdown-preview:ratio';
  var THEME_KEY = 'markdown-preview:theme';
  var TOC_KEY = 'markdown-preview:toc';

  var editor = document.getElementById('editor');
  var preview = document.getElementById('preview');
  var editorMeta = document.getElementById('editor-meta');
  var previewMeta = document.getElementById('preview-meta');
  var statChars = document.getElementById('stat-chars');
  var statWords = document.getElementById('stat-words');
  var statLines = document.getElementById('stat-lines');
  var statReading = document.getElementById('stat-reading');
  var statusTip = document.getElementById('status-tip');
  var main = document.getElementById('main');
  var app = document.querySelector('.app');
  var gutter = document.getElementById('gutter');
  var tocPane = document.getElementById('toc-pane');
  var tocList = document.getElementById('toc-list');
  var tocMeta = document.getElementById('toc-meta');
  var fileInput = document.getElementById('file-input');

  // ======================== 渲染 ========================
  function render() {
    var text = editor.value;
    if (!text || !text.trim()) {
      preview.innerHTML = '<div class="empty-hint">预览区将在此显示渲染结果</div>';
      previewMeta.textContent = '就绪';
      buildToc(text);
      return;
    }
    try {
      var html = MarkdownParser.parseMarkdown(text, { highlight: true });
      preview.innerHTML = html;
      // 给标题加 id（用于目录跳转）
      assignHeadingIds();
      previewMeta.textContent = '已渲染';
    } catch (e) {
      preview.innerHTML = '<div class="empty-hint" style="color:#c41a4a">渲染出错：' + escapeText(e.message) + '</div>';
      previewMeta.textContent = '出错';
    }
    buildToc(text);
  }

  function escapeText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * 给预览区所有 h1-h6 加 id，按 slug + 序号去重
   */
  function assignHeadingIds() {
    var heads = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    var used = {};
    for (var i = 0; i < heads.length; i++) {
      var slug = MarkdownParser.slugify(heads[i].textContent);
      if (!slug) slug = 'heading';
      if (used[slug] !== undefined) {
        used[slug]++;
        slug = slug + '-' + used[slug];
      } else {
        used[slug] = 0;
      }
      heads[i].id = slug;
    }
  }

  // ======================== 目录大纲 ========================
  function buildToc(text) {
    var toc = MarkdownParser.extractToc(text || '');
    tocMeta.textContent = toc.length;
    if (toc.length === 0) {
      tocList.innerHTML = '<div class="empty-hint">无标题</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < toc.length; i++) {
      html += '<button class="toc-item level-' + toc[i].level + '" data-slug="' + escapeAttr(toc[i].slug) + '" title="' + escapeAttr(toc[i].text) + '">' + escapeText(toc[i].text) + '</button>';
    }
    tocList.innerHTML = html;
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * 点击目录跳转到对应标题
   * 由于 slug 可能有重复，先按出现顺序找第 N 个匹配 slug 的标题
   */
  function onTocClick(e) {
    var target = e.target.closest('.toc-item');
    if (!target) return;
    var slug = target.dataset.slug;
    if (!slug) return;
    // 在预览区找第一个 id 等于 slug 或以 slug-数字 开头的标题
    var heads = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    var matched = null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].id === slug) { matched = heads[i]; break; }
    }
    if (!matched) {
      // 回退：找 id 以 slug 开头的
      matched = preview.querySelector('#' + CSS.escape(slug) + ', [id^="' + CSS.escape(slug) + '-"]');
    }
    if (matched) {
      matched.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 高亮当前 toc 项
      var items = tocList.querySelectorAll('.toc-item');
      items.forEach(function (el) { el.classList.remove('active'); });
      target.classList.add('active');
    }
  }

  // ======================== 主题切换 ========================
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    toast(current === 'dark' ? '已切换到亮色主题' : '已切换到暗色主题');
  }

  // ======================== TOC 显隐 ========================
  function applyTocVisible(visible) {
    tocPane.hidden = !visible;
    try { localStorage.setItem(TOC_KEY, visible ? '1' : '0'); } catch (e) {}
  }

  function toggleToc() {
    applyTocVisible(tocPane.hidden);
  }

  // ======================== 统计 ========================
  function updateStats() {
    var text = editor.value;
    var chars = text.length;
    var cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    var en = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
    var words = cjk + en;
    var lines = text === '' ? 1 : text.split('\n').length;

    statChars.textContent = '字符 ' + chars;
    statWords.textContent = '字数 ' + words;
    statLines.textContent = '行数 ' + lines;
    editorMeta.textContent = words + ' 字';

    // 阅读时长估算：中文 300 字/分钟，英文 200 词/分钟
    var minutes = cjk / 300 + en / 200;
    var readingText;
    if (minutes < 1 && minutes > 0) {
      // 不足 1 分钟按秒显示
      readingText = '阅读 ' + Math.max(1, Math.round(minutes * 60)) + ' 秒';
    } else if (minutes === 0) {
      readingText = '阅读 0 分钟';
    } else {
      readingText = '阅读 ' + Math.round(minutes) + ' 分钟';
    }
    statReading.textContent = readingText;
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
    setTimeout(function () { editor.blur(); editor.focus(); editor.blur(); }, 0);
  }

  // ======================== 导出 HTML（含高亮） ========================
  function buildExportHtml(markdownText) {
    var rendered = MarkdownParser.parseMarkdown(markdownText, { highlight: true });
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

  // ======================== 保存为 .md 文件 ========================
  function saveMarkdown() {
    var text = editor.value;
    if (!text.trim()) {
      toast('编辑区为空，无可保存内容');
      return;
    }
    var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var ts = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : n; };
    var name = 'markdown-' + ts.getFullYear() + pad(ts.getMonth() + 1) + pad(ts.getDate()) +
      '-' + pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds()) + '.md';
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已保存 ' + name);
  }

  // ======================== 导出 PDF / 打印 ========================
  function exportPdf() {
    var text = editor.value;
    if (!text.trim()) {
      toast('编辑区为空，无可打印内容');
      return;
    }
    // 临时切到预览模式确保只显示预览区，再触发打印
    var prevMode = app.classList.contains('mode-edit') ? 'edit'
      : (app.classList.contains('mode-preview') ? 'preview' : 'split');
    var prevTocVisible = !tocPane.hidden;
    applyTocVisible(false);
    setMode('preview');
    // 等浏览器重绘
    setTimeout(function () {
      window.print();
      // 打印对话框关闭后恢复
      setTimeout(function () {
        setMode(prevMode);
        applyTocVisible(prevTocVisible);
      }, 300);
    }, 200);
  }

  // ======================== 复制 ========================
  function copyHtml() {
    var text = editor.value;
    if (!text.trim()) {
      toast('编辑区为空');
      return;
    }
    var html = MarkdownParser.parseMarkdown(text, { highlight: true });
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

  // ======================== 打开文件 ========================
  function openFile() {
    fileInput.click();
  }

  function onFileChange(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    readFileIntoEditor(files[0]);
    e.target.value = ''; // 允许再次选同一文件
  }

  function readFileIntoEditor(file) {
    if (!file) return;
    // 大小限制 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast('文件过大（>5MB），已取消打开');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      editor.value = String(ev.target.result || '');
      render();
      updateStats();
      saveDelayed();
      toast('已打开 ' + file.name);
      statusTip.textContent = '已打开文件：' + file.name;
    };
    reader.onerror = function () {
      toast('读取文件失败');
    };
    reader.readAsText(file, 'utf-8');
  }

  // ======================== 拖拽打开 ========================
  function initDragDrop() {
    var overlay = document.createElement('div');
    overlay.className = 'drop-overlay';
    overlay.textContent = '松开以打开 .md 文件';
    document.body.appendChild(overlay);
    var dragCounter = 0;

    window.addEventListener('dragenter', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.types || e.dataTransfer.types.indexOf('Files') === -1) return;
      e.preventDefault();
      dragCounter++;
      overlay.classList.add('show');
    });
    window.addEventListener('dragover', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.types || e.dataTransfer.types.indexOf('Files') === -1) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', function (e) {
      if (!e.dataTransfer) return;
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.classList.remove('show');
      }
    });
    window.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('show');
      var file = e.dataTransfer.files[0];
      var name = file.name.toLowerCase();
      var okExt = /\.(md|markdown|txt)$/.test(name);
      if (!okExt) {
        toast('仅支持 .md / .markdown / .txt 文件');
        return;
      }
      readFileIntoEditor(file);
    });
  }

  // ======================== 事件绑定 ========================
  editor.addEventListener('input', function () {
    render();
    updateStats();
    saveDelayed();
  });

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
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      exportHtml();
    }
    // Ctrl/Cmd + P 打印
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      exportPdf();
    }
  });

  document.getElementById('btn-copy').addEventListener('click', copyHtml);
  document.getElementById('btn-export').addEventListener('click', exportHtml);
  document.getElementById('btn-save-md').addEventListener('click', saveMarkdown);
  document.getElementById('btn-clear').addEventListener('click', clearAll);
  document.getElementById('btn-pdf').addEventListener('click', exportPdf);
  document.getElementById('btn-open').addEventListener('click', openFile);
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);
  document.getElementById('btn-toggle-toc').addEventListener('click', toggleToc);
  fileInput.addEventListener('change', onFileChange);
  tocList.addEventListener('click', onTocClick);

  document.querySelectorAll('.switch-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setMode(btn.dataset.mode);
    });
  });

  // ======================== 导出文档内联样式（含代码高亮配色） ========================
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
    'pre code { background:transparent; padding:0; color:#1d1d1f; font-size:1em; }',
    'blockquote { border-left:3px solid #007aff; background:rgba(0,122,255,0.08); padding:0.6em 1em; margin:1em 0; border-radius:0 6px 6px 0; color:#6e6e73; }',
    'ul,ol { margin:0.8em 0; padding-left:1.8em; }',
    'li { margin:0.3em 0; }',
    'hr { border:none; border-top:1px solid #ededf0; margin:2em 0; }',
    'img { max-width:100%; border-radius:8px; }',
    'table { border-collapse:collapse; width:100%; margin:1em 0; }',
    'th,td { border:1px solid #ededf0; padding:8px 12px; text-align:left; }',
    'th { background:#fbfbfd; font-weight:600; }',
    'tbody tr:nth-child(even) { background:#fbfbfd; }',
    '/* 代码高亮 token 配色 */',
    '.tok-comment { color:#6e6e73; font-style:italic; }',
    '.tok-string { color:#c41a4a; }',
    '.tok-keyword { color:#a82d8a; font-weight:500; }',
    '.tok-number { color:#1a7f37; }',
    '.tok-function { color:#6f42c1; }',
    '.tok-tag { color:#c41a4a; }',
    '.tok-attr { color:#a82d8a; }',
    '.tok-key { color:#1a7f37; }',
    '.tok-atom { color:#0066d6; }',
    '.tok-selector { color:#6f42c1; }',
    '.tok-variable { color:#0066d6; }'
  ].join('\n');

  // ======================== 初始化 ========================
  function init() {
    var hasSaved = loadSaved();
    if (!hasSaved) {
      editor.value = DEFAULT_CONTENT;
    }
    var mode = 'split';
    try { mode = localStorage.getItem(MODE_KEY) || 'split'; } catch (e) {}
    setMode(mode);
    try {
      var r = parseFloat(localStorage.getItem(RATIO_KEY));
      if (!isNaN(r) && r > 0.2 && r < 0.8) setRatio(r);
    } catch (e) {}
    // 主题
    var theme = 'light';
    try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) {}
    applyTheme(theme);
    // TOC 显隐（默认显示）
    var tocVisible = true;
    try { tocVisible = localStorage.getItem(TOC_KEY) !== '0'; } catch (e) {}
    applyTocVisible(tocVisible);

    render();
    updateStats();
    initGutter();
    initDragDrop();
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
    '- **目录大纲**：左侧自动生成可点击 TOC',
    '- **暗色 / 亮色主题切换**：右上角按钮',
    '- **拖拽打开** `.md` 文件直接载入',
    '- **导出 PDF**：`Ctrl + P` 调用浏览器打印',
    '- **代码块语法高亮**：JS / Python / JSON / HTML / CSS / Bash / Java / Go / SQL',
    '- 一键导出独立 HTML 文件',
    '- 内容自动保存到本地，刷新不丢失',
    '- `Ctrl + S` 快捷导出 HTML',
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
    '### 代码块（语法高亮）',
    '',
    '```javascript',
    'function hello(name) {',
    '  // 问候函数',
    '  const message = "你好, " + name;',
    '  console.log(message);',
    '  return message;',
    '}',
    "hello('世界');",
    '```',
    '',
    '```python',
    'def greet(name):',
    '    # 问候函数',
    '    return f"Hello, {name}!"',
    '',
    'print(greet("Python"))',
    '```',
    '',
    '```json',
    '{',
    '  "name": "markdown-preview",',
    '  "version": "2.0",',
    '  "features": ["toc", "dark-mode", "highlight"]',
    '}',
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
