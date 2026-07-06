/* ==================== 文本对比管家 · UI 交互 ==================== */
(function () {
  'use strict';

  // ---------- DOM 引用 ----------
  var $ = function (id) { return document.getElementById(id); };
  var textLeft = $('textLeft');
  var textRight = $('textRight');
  var metaLeft = $('metaLeft');
  var metaRight = $('metaRight');
  var btnCompare = $('btnCompare');
  var btnClear = $('btnClear');
  var btnSwap = $('btnSwap');
  var optIgnoreCase = $('optIgnoreCase');
  var optTrimWs = $('optTrimWs');
  var statsBar = $('statsBar');
  var statAdd = $('statAdd');
  var statDel = $('statDel');
  var statEq = $('statEq');
  var resultEmpty = $('resultEmpty');
  var viewSplit = $('viewSplit');
  var viewInline = $('viewInline');
  var viewUnified = $('viewUnified');
  var resultMeta = $('resultMeta');
  var btnCopySummary = $('btnCopySummary');
  var btnCopyUnified = $('btnCopyUnified');
  var fileInput = $('fileInput');
  var toastEl = $('toast');

  var currentView = 'split';
  var currentResult = null;
  var currentUnified = '';
  var currentSummary = '';
  var loadTarget = null; // 'left' | 'right'

  // ---------- 工具 ----------
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 1800);
  }

  function updateMeta() {
    var lLines = DiffEngine.splitLines(textLeft.value);
    var rLines = DiffEngine.splitLines(textRight.value);
    metaLeft.textContent = lLines.length + ' 行 · ' + textLeft.value.length + ' 字';
    metaRight.textContent = rLines.length + ' 行 · ' + textRight.value.length + ' 字';
  }

  function getOptions() {
    return {
      ignoreCase: optIgnoreCase.classList.contains('active'),
      trimWhitespace: optTrimWs.classList.contains('active')
    };
  }

  // ---------- 渲染：并排视图 ----------
  function renderSplit(result) {
    var blocks = result.blocks;
    var html = '';

    // 左列
    html += '<div class="diff-col">';
    html += '<div class="diff-col-header">原文本</div>';
    var leftNo = 0, rightNo = 0;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.type === 'equal') {
        leftNo++;
        rightNo++;
        html += renderRow('equal', leftNo, b.left[0].text, false, 'left');
      } else if (b.type === 'add') {
        rightNo++;
        html += renderRow('empty-row', '', '', true, 'left');
      } else if (b.type === 'del') {
        leftNo++;
        html += renderRow('del', leftNo, b.left[0].text, false, 'left');
      } else if (b.type === 'modify') {
        leftNo++;
        html += renderRow('modify', leftNo, b.left[0].text, false, 'left', b.left[0].charDiffs, 'del');
      }
    }
    html += '</div>';

    // 右列
    html += '<div class="diff-col">';
    html += '<div class="diff-col-header">新文本</div>';
    leftNo = 0; rightNo = 0;
    for (var j = 0; j < blocks.length; j++) {
      var b2 = blocks[j];
      if (b2.type === 'equal') {
        leftNo++;
        rightNo++;
        html += renderRow('equal', rightNo, b2.right[0].text, false, 'right');
      } else if (b2.type === 'add') {
        rightNo++;
        html += renderRow('add', rightNo, b2.right[0].text, false, 'right');
      } else if (b2.type === 'del') {
        leftNo++;
        html += renderRow('empty-row', '', '', true, 'right');
      } else if (b2.type === 'modify') {
        rightNo++;
        html += renderRow('modify', rightNo, b2.right[0].text, false, 'right', b2.right[0].charDiffs, 'add');
      }
    }
    html += '</div>';

    viewSplit.innerHTML = html;
  }

  function renderRow(cls, num, text, isEmpty, side, charDiffs, charSide) {
    var numHtml = isEmpty ? '<span class="line-num"> </span>' : '<span class="line-num">' + num + '</span>';
    var content;
    if (isEmpty) {
      content = '<span class="line-content">—</span>';
    } else if (charDiffs) {
      content = '<span class="line-content">' + renderCharDiff(charDiffs, charSide) + '</span>';
    } else {
      content = '<span class="line-content">' + escapeHtml(text) + '</span>';
    }
    return '<div class="diff-row ' + cls + '">' + numHtml + content + '</div>';
  }

  function renderCharDiff(segments, side) {
    // side='del' 时高亮 del 段；side='add' 时高亮 add 段；equal 段照常显示
    var html = '';
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var text = escapeHtml(s.text);
      if (s.type === 'equal') {
        html += text;
      } else if (s.type === 'del') {
        html += side === 'del' ? '<span class="char-del">' + text + '</span>' : '';
      } else if (s.type === 'add') {
        html += side === 'add' ? '<span class="char-add">' + text + '</span>' : '';
      }
    }
    return html;
  }

  // ---------- 渲染：内联视图 ----------
  function renderInline(result) {
    var inline = result.inline;
    var html = '';
    var leftNo = 0, rightNo = 0;
    for (var i = 0; i < inline.length; i++) {
      var r = inline[i];
      var sign = ' ';
      var cls = 'equal';
      var num = '';
      if (r.type === 'equal') {
        leftNo++; rightNo++;
        sign = ' ';
        cls = 'equal';
        num = rightNo;
      } else if (r.type === 'add') {
        rightNo++;
        sign = '+';
        cls = 'add';
        num = rightNo;
      } else if (r.type === 'del') {
        leftNo++;
        sign = '−';
        cls = 'del';
        num = leftNo;
      }
      html += '<div class="diff-row ' + cls + '">' +
              '<span class="line-sign">' + sign + '</span>' +
              '<span class="line-num">' + num + '</span>' +
              '<span class="line-content">' + escapeHtml(r.text) + '</span>' +
              '</div>';
    }
    viewInline.innerHTML = html;
  }

  // ---------- 渲染：统一格式 ----------
  function renderUnified(textA, textB) {
    var u = DiffEngine.toUnifiedDiff(textA, textB, Object.assign({ headerA: '原文本', headerB: '新文本', context: 3 }, getOptions()));
    var lines = u.split('\n');
    var html = '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var cls = '';
      if (l.indexOf('--- ') === 0 || l.indexOf('+++ ') === 0) cls = 'u-header';
      else if (l.indexOf('@@') === 0) cls = 'u-hunk';
      else if (l.charAt(0) === '+') cls = 'u-add';
      else if (l.charAt(0) === '-') cls = 'u-del';
      html += '<span class="' + cls + '">' + escapeHtml(l) + '</span>\n';
    }
    viewUnified.innerHTML = html;
    return u;
  }

  // ---------- 主对比流程 ----------
  function doCompare() {
    var a = textLeft.value;
    var b = textRight.value;
    if (!a && !b) {
      showToast('请先填写左右文本');
      return;
    }
    var t0 = performance.now();
    var result = DiffEngine.compare(a, b, getOptions());
    var t1 = performance.now();
    currentResult = result;
    currentUnified = DiffEngine.toUnifiedDiff(a, b, Object.assign({ headerA: '原文本', headerB: '新文本', context: 3 }, getOptions()));
    currentSummary = DiffEngine.summaryText(result);

    // 显示统计
    statsBar.hidden = false;
    statAdd.textContent = result.stats.added;
    statDel.textContent = result.stats.deleted;
    statEq.textContent = result.stats.unchanged;
    btnCopySummary.hidden = false;
    btnCopyUnified.hidden = false;

    // 隐藏空状态
    resultEmpty.hidden = true;
    resultMeta.textContent = '耗时 ' + (t1 - t0).toFixed(1) + ' ms';

    // 渲染当前视图
    renderCurrent();
  }

  function renderCurrent() {
    if (!currentResult) return;
    viewSplit.hidden = currentView !== 'split';
    viewInline.hidden = currentView !== 'inline';
    viewUnified.hidden = currentView !== 'unified';
    if (currentView === 'split') renderSplit(currentResult);
    else if (currentView === 'inline') renderInline(currentResult);
    else if (currentView === 'unified') renderUnified(textLeft.value, textRight.value);
  }

  // ---------- 视图切换 ----------
  function setView(v) {
    currentView = v;
    document.querySelectorAll('.view-switch button').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === v);
    });
    if (currentResult) renderCurrent();
  }

  // ---------- 示例 ----------
  var SAMPLES = {
    code: {
      left: 'function add(a, b) {\n  return a + b;\n}\n\nconst result = add(1, 2);',
      right: 'function add(a, b) {\n  return a + b;\n}\n\nfunction sub(a, b) {\n  return a - b;\n}\n\nconst result = add(1, 2);'
    },
    json: {
      left: '{\n  "name": "app",\n  "version": "1.0.0",\n  "port": 3000,\n  "debug": false\n}',
      right: '{\n  "name": "app",\n  "version": "1.1.0",\n  "port": 3000,\n  "debug": true,\n  "logLevel": "info"\n}'
    },
    text: {
      left: '今天天气不错，我们去公园散步。\n路边的小花开了，颜色很漂亮。\n回来时买了一些水果。',
      right: '今天天气很好，我们去公园散步。\n路边的小花都开了，颜色非常漂亮。\n回来时买了一些水果和零食。'
    },
    config: {
      left: '[server]\nhost = 127.0.0.1\nport = 8080\nworkers = 4\n\ndatabase = localhost',
      right: '[server]\nhost = 0.0.0.0\nport = 8080\nworkers = 8\n\n[ssl]\nenabled = true'
    }
  };

  function loadSample(key) {
    var s = SAMPLES[key];
    if (!s) return;
    textLeft.value = s.left;
    textRight.value = s.right;
    updateMeta();
    doCompare();
  }

  // ---------- 文件加载 ----------
  function loadFileInto(target, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('文件过大（限制 5MB）');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      if (target === 'left') textLeft.value = e.target.result;
      else textRight.value = e.target.result;
      updateMeta();
      showToast('已加载 ' + file.name);
    };
    reader.onerror = function () { showToast('读取失败'); };
    reader.readAsText(file, 'utf-8');
  }

  // ---------- 事件绑定 ----------
  btnCompare.addEventListener('click', doCompare);

  btnClear.addEventListener('click', function () {
    textLeft.value = '';
    textRight.value = '';
    updateMeta();
    currentResult = null;
    statsBar.hidden = true;
    btnCopySummary.hidden = true;
    btnCopyUnified.hidden = true;
    resultEmpty.hidden = false;
    viewSplit.innerHTML = '';
    viewInline.innerHTML = '';
    viewUnified.innerHTML = '';
    resultMeta.textContent = '';
  });

  btnSwap.addEventListener('click', function () {
    var tmp = textLeft.value;
    textLeft.value = textRight.value;
    textRight.value = tmp;
    updateMeta();
    if (currentResult) doCompare();
  });

  optIgnoreCase.addEventListener('click', function (e) {
    e.preventDefault();
    optIgnoreCase.classList.toggle('active');
    if (currentResult) doCompare();
  });

  optTrimWs.addEventListener('click', function (e) {
    e.preventDefault();
    optTrimWs.classList.toggle('active');
    if (currentResult) doCompare();
  });

  document.querySelectorAll('.view-switch button').forEach(function (btn) {
    btn.addEventListener('click', function () { setView(btn.dataset.view); });
  });

  document.querySelectorAll('.example-chip').forEach(function (btn) {
    btn.addEventListener('click', function () { loadSample(btn.dataset.sample); });
  });

  // 粘贴按钮
  document.querySelectorAll('[data-paste]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.dataset.paste;
      navigator.clipboard.readText().then(function (text) {
        if (target === 'left') textLeft.value = text;
        else textRight.value = text;
        updateMeta();
        showToast('已粘贴');
      }).catch(function () {
        showToast('剪贴板不可用，请手动 Ctrl+V');
      });
    });
  });

  // 加载文件按钮
  document.querySelectorAll('[data-load]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      loadTarget = btn.dataset.load;
      fileInput.click();
    });
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) {
      loadFileInto(loadTarget, fileInput.files[0]);
      fileInput.value = '';
    }
  });

  // 拖放上传
  ['cardLeft', 'cardRight'].forEach(function (id) {
    var card = $(id);
    var target = id === 'cardLeft' ? 'left' : 'right';
    card.addEventListener('dragover', function (e) {
      e.preventDefault();
      card.classList.add('dragover');
    });
    card.addEventListener('dragleave', function () {
      card.classList.remove('dragover');
    });
    card.addEventListener('drop', function (e) {
      e.preventDefault();
      card.classList.remove('dragover');
      var f = e.dataTransfer.files[0];
      if (f) loadFileInto(target, f);
    });
  });

  // 复制
  btnCopySummary.addEventListener('click', function () {
    navigator.clipboard.writeText(currentSummary).then(function () {
      showToast('摘要已复制');
    }).catch(function () { showToast('复制失败'); });
  });

  btnCopyUnified.addEventListener('click', function () {
    navigator.clipboard.writeText(currentUnified).then(function () {
      showToast('unified diff 已复制');
    }).catch(function () { showToast('复制失败'); });
  });

  // 输入更新 meta
  textLeft.addEventListener('input', updateMeta);
  textRight.addEventListener('input', updateMeta);

  // 快捷键：Ctrl/Cmd + Enter 对比
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      doCompare();
    }
    // Ctrl/Cmd + 1/2/3 切换视图
    if ((e.ctrlKey || e.metaKey) && (e.key === '1' || e.key === '2' || e.key === '3')) {
      e.preventDefault();
      var map = { '1': 'split', '2': 'inline', '3': 'unified' };
      setView(map[e.key]);
    }
  });

  // 初始化
  updateMeta();

  // Demo 自动加载（URL 含 ?demo=xxx 时触发，用于预览/截图）
  (function () {
    var m = /demo=([a-z]+)/i.exec(location.search);
    if (m && SAMPLES[m[1]]) {
      loadSample(m[1]);
    }
  })();

  // PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
