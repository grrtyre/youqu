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
  var btnTheme = $('btnTheme');
  var optIgnoreCase = $('optIgnoreCase');
  var optTrimWs = $('optTrimWs');
  var optLive = $('optLive');
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

  // ---------- 持久化 key ----------
  var THEME_KEY = 'diff-checker:theme';
  var LIVE_KEY = 'diff-checker:live';

  // ---------- 主题切换 ----------
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    showToast(current === 'dark' ? '已切换到亮色主题' : '已切换到暗色主题');
  }

  // ---------- 实时对比开关 ----------
  function isLiveEnabled() {
    return optLive.classList.contains('active');
  }

  function setLive(on) {
    if (on) optLive.classList.add('active');
    else optLive.classList.remove('active');
    try { localStorage.setItem(LIVE_KEY, on ? '1' : '0'); } catch (e) {}
  }

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

  // 安全剪贴板访问：file:// 协议下 navigator.clipboard 可能为 undefined
  // 此前直接访问 .readText/.writeText 会同步抛 TypeError 且不被 .catch 捕获
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // 降级：临时 textarea + execCommand
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve(); else reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  function pasteFromClipboard() {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return navigator.clipboard.readText();
    }
    return Promise.reject(new Error('clipboard read unavailable'));
  }

  function updateMeta() {
    var lLines = DiffEngine.splitLines(textLeft.value);
    var rLines = DiffEngine.splitLines(textRight.value);
    metaLeft.textContent = lLines.length + ' 行 · ' + textLeft.value.length + ' 字';
    metaRight.textContent = rLines.length + ' 行 · ' + textRight.value.length + ' 字';
    autoResize(textLeft);
    autoResize(textRight);
  }

  // textarea 高度自适应内容（上限 320px，超出滚动），避免内容少时大面积留白
  function autoResize(el) {
    el.style.height = 'auto';
    var h = Math.max(160, Math.min(el.scrollHeight, 320));
    el.style.height = h + 'px';
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
      // 对侧无对应行的占位：纯视觉色条提示，无文字避免重复噪音
      content = '<span class="line-content empty-hint" data-side="' + (side || '') + '"></span>';
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
  // opts.silent：实时对比时不弹 toast、不显示「请先填写」提示
  function doCompare(opts) {
    opts = opts || {};
    var a = textLeft.value;
    var b = textRight.value;
    if (!a && !b) {
      if (!opts.silent) showToast('请先填写左右文本');
      // 清空之前的结果
      currentResult = null;
      statsBar.hidden = true;
      btnCopySummary.hidden = true;
      btnCopyUnified.hidden = true;
      resultEmpty.hidden = false;
      viewSplit.innerHTML = '';
      viewInline.innerHTML = '';
      viewUnified.innerHTML = '';
      resultMeta.textContent = '';
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

    // 同步滚动：渲染后立即同步一次纵向滚动位置
    syncScrollAfterRender();
  }

  // ---------- 实时对比（防抖） ----------
  var liveTimer = null;
  function scheduleLiveCompare() {
    if (!isLiveEnabled()) return;
    if (liveTimer) clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      liveTimer = null;
      doCompare({ silent: true });
    }, 300);
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
    if (currentResult) {
      renderCurrent();
      syncScrollAfterRender();
    }
  }

  // ---------- 并排视图同步滚动 ----------
  // 滚动左列时同步右列，反之亦然。用 flag 防止互相触发死循环。
  var syncScrollLock = false;
  function initSyncScroll() {
    var cols = viewSplit.querySelectorAll('.diff-col');
    if (cols.length < 2) return;
    cols.forEach(function (col, idx) {
      col.addEventListener('scroll', function () {
        if (syncScrollLock) return;
        syncScrollLock = true;
        var other = cols[idx === 0 ? 1 : 0];
        if (other) {
          other.scrollTop = col.scrollTop;
          // 横向也同步
          other.scrollLeft = col.scrollLeft;
        }
        // 解锁放在下一事件循环，避免相互触发
        setTimeout(function () { syncScrollLock = false; }, 0);
      }, { passive: true });
    });
  }

  // 渲染后调用：重新绑定同步滚动 + 恢复滚动位置
  function syncScrollAfterRender() {
    if (currentView !== 'split') return;
    // 等下一帧 DOM 完成布局
    requestAnimationFrame(function () {
      initSyncScroll();
      // 让两列都回到顶部对齐
      var cols = viewSplit.querySelectorAll('.diff-col');
      cols.forEach(function (c) { c.scrollTop = 0; c.scrollLeft = 0; });
    });
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
  btnCompare.addEventListener('click', function () { doCompare(); });

  btnTheme.addEventListener('click', toggleTheme);

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
    // 交换后无论是否已有结果，都重新对比（实时模式下也立即响应）
    if (isLiveEnabled() || currentResult) doCompare({ silent: true });
  });

  optIgnoreCase.addEventListener('click', function (e) {
    e.preventDefault();
    optIgnoreCase.classList.toggle('active');
    // 选项变化时，实时模式自动重算；非实时模式仅当已有结果时重算
    if (isLiveEnabled()) doCompare({ silent: true });
    else if (currentResult) doCompare();
  });

  optTrimWs.addEventListener('click', function (e) {
    e.preventDefault();
    optTrimWs.classList.toggle('active');
    if (isLiveEnabled()) doCompare({ silent: true });
    else if (currentResult) doCompare();
  });

  optLive.addEventListener('click', function (e) {
    e.preventDefault();
    var on = !optLive.classList.contains('active');
    setLive(on);
    showToast(on ? '已开启实时对比' : '已关闭实时对比');
    if (on) doCompare({ silent: true });
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
      pasteFromClipboard().then(function (text) {
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
    copyToClipboard(currentSummary).then(function () {
      showToast('摘要已复制');
    }).catch(function () { showToast('复制失败'); });
  });

  btnCopyUnified.addEventListener('click', function () {
    copyToClipboard(currentUnified).then(function () {
      showToast('unified diff 已复制');
    }).catch(function () { showToast('复制失败'); });
  });

  // 输入更新 meta + 触发实时对比
  textLeft.addEventListener('input', function () {
    updateMeta();
    scheduleLiveCompare();
  });
  textRight.addEventListener('input', function () {
    updateMeta();
    scheduleLiveCompare();
  });

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

  // 恢复主题偏好（默认 light）
  (function () {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(saved === 'dark' ? 'dark' : 'light');
  })();

  // 恢复实时对比偏好（默认开启）
  (function () {
    var saved = null;
    try { saved = localStorage.getItem(LIVE_KEY); } catch (e) {}
    // saved === '0' 表示用户主动关闭；其他情况（null/1）默认开启
    setLive(saved !== '0');
  })();

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
