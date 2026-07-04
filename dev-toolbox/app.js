/* ==================== 开发者工具箱 · 交互逻辑 ==================== */
(function () {
  'use strict';

  var core = window.ToolboxCore;

  // 工具元信息
  var TOOL_META = {
    color: { title: '颜色转换', desc: 'HEX / RGB / HSL / CSS 互转，支持透明度' },
    json: { title: 'JSON 格式化', desc: '美化、压缩、校验 JSON 文本' },
    timestamp: { title: '时间戳转换', desc: 'Unix 时间戳与日期互转，支持相对时间' },
    regex: { title: '正则测试', desc: '实时测试正则表达式，查看所有匹配' },
    diff: { title: '文本 Diff', desc: '逐行对比两段文本差异（LCS 算法）' },
    base64: { title: 'Base64 编解码', desc: '支持 UTF-8 的 Base64 编码与解码' },
    url: { title: 'URL 编解码', desc: 'URL 安全编码与解码' }
  };

  // ==================== 侧边栏切换 ====================
  var navItems = document.querySelectorAll('.nav-item');
  var panels = document.querySelectorAll('.panel');
  var toolTitle = document.getElementById('toolTitle');
  var toolDesc = document.getElementById('toolDesc');

  navItems.forEach(function (item) {
    item.addEventListener('click', function () {
      switchTool(item.getAttribute('data-tool'));
    });
  });

  // 切换工具
  function switchTool(tool) {
    var item = document.querySelector('.nav-item[data-tool="' + tool + '"]');
    if (!item) return;
    navItems.forEach(function (n) { n.classList.remove('active'); });
    item.classList.add('active');
    panels.forEach(function (p) { p.classList.remove('active'); });
    var panel = document.querySelector('.panel[data-panel="' + tool + '"]');
    if (panel) panel.classList.add('active');
    var meta = TOOL_META[tool];
    if (meta) {
      toolTitle.textContent = meta.title;
      toolDesc.textContent = meta.desc;
    }
    // 记忆上次工具
    try { localStorage.setItem('dev-toolbox:last', tool); } catch (e) {}
    // 切换后自动执行一次该工具（首次进入有内容）
    autoRun(tool);
  }

  // 各工具主按钮 id 映射，用于自动执行
  var AUTO_RUN = {
    color: 'colorBtn', json: 'jsonBtn', timestamp: 'tsBtn',
    regex: 'reBtn', diff: 'diffBtn', base64: 'b64Btn', url: 'urlBtn'
  };
  function autoRun(tool) {
    var id = AUTO_RUN[tool];
    if (id) {
      var btn = document.getElementById(id);
      if (btn) btn.click();
    }
  }

  // ==================== Toast ====================
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  // 复制到剪贴板
  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        toast('已复制到剪贴板');
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
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

  // 复制按钮
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-copy');
      var el = document.getElementById(id);
      if (el && el.value) copyText(el.value);
      else toast('内容为空');
    });
  });

  // 结果项点击复制
  function bindResultClick(container) {
    container.addEventListener('click', function (e) {
      var item = e.target.closest('.ri-value');
      if (item) {
        var text = item.getAttribute('data-raw') || item.textContent;
        copyText(text);
      }
    });
  }

  // ==================== 颜色转换 ====================
  var colorInput = document.getElementById('colorInput');
  var colorPicker = document.getElementById('colorPicker');
  var colorPreview = document.getElementById('colorPreview');
  var colorResult = document.getElementById('colorResult');
  bindResultClick(colorResult);

  function runColor() {
    var input = colorInput.value.trim();
    try {
      var r = core.colorConvert(input);
      colorPreview.style.background = r.cssRgba;
      var items = [
        { label: 'HEX', value: r.hex },
        { label: 'RGB', value: 'rgb(' + r.rgb.r + ', ' + r.rgb.g + ', ' + r.rgb.b + (r.rgb.a < 1 ? ', ' + r.rgb.a : '') + ')' },
        { label: 'HSL', value: 'hsl(' + r.hsl.h + ', ' + r.hsl.s + '%, ' + r.hsl.l + '%)' },
        { label: 'CSS', value: r.cssRgba },
        { label: 'R', value: r.rgb.r },
        { label: 'G', value: r.rgb.g },
        { label: 'B', value: r.rgb.b },
        { label: 'A', value: r.rgb.a }
      ];
      colorResult.innerHTML = items.map(function (it) {
        return '<div class="result-item"><div class="ri-label">' + it.label +
          '</div><div class="ri-value" data-raw="' + escapeAttr(it.value) + '">' + escapeHtml(it.value) + '</div></div>';
      }).join('');
      // 同步颜色选择器
      var hex6 = '#' + padHex(r.rgb.r) + padHex(r.rgb.g) + padHex(r.rgb.b);
      if (colorPicker.value.toLowerCase() !== hex6.toLowerCase()) colorPicker.value = hex6;
    } catch (e) {
      colorResult.innerHTML = '<div class="error-tip">' + escapeHtml(e.message) + '</div>';
      colorPreview.style.background = '#ffe5e5';
    }
  }

  colorPicker.addEventListener('input', function () {
    colorInput.value = colorPicker.value;
    runColor();
  });

  document.getElementById('colorBtn').addEventListener('click', runColor);
  colorInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') runColor(); });

  // ==================== JSON 格式化 ====================
  var jsonInput = document.getElementById('jsonInput');
  var jsonOutput = document.getElementById('jsonOutput');
  var jsonIndent = 2;

  document.querySelectorAll('.panel[data-panel="json"] .seg-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.panel[data-panel="json"] .seg-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      jsonIndent = parseInt(btn.getAttribute('data-indent'), 10);
    });
  });

  document.getElementById('jsonBtn').addEventListener('click', function () {
    var r = core.jsonFormat(jsonInput.value, jsonIndent);
    if (r.ok) {
      jsonOutput.value = r.result;
      jsonOutput.style.color = '';
    } else {
      jsonOutput.value = r.error;
      jsonOutput.style.color = 'var(--red)';
    }
  });

  // ==================== 时间戳转换 ====================
  var tsInput = document.getElementById('tsInput');
  var tsResult = document.getElementById('tsResult');
  bindResultClick(tsResult);

  document.getElementById('tsBtn').addEventListener('click', function () {
    var input = tsInput.value.trim();
    if (!input) { tsResult.innerHTML = '<div class="empty-tip">请输入时间戳或日期</div>'; return; }
    try {
      var r = core.timestampConvert(input);
      var items = [
        { label: 'Unix 秒', value: r.unix },
        { label: '毫秒', value: r.ms },
        { label: '本地时间', value: r.local },
        { label: 'ISO 8601', value: r.iso },
        { label: '格式化', value: r.date },
        { label: '相对时间', value: r.relative }
      ];
      tsResult.innerHTML = items.map(function (it) {
        return '<div class="result-item"><div class="ri-label">' + it.label +
          '</div><div class="ri-value" data-raw="' + escapeAttr(String(it.value)) + '">' + escapeHtml(String(it.value)) + '</div></div>';
      }).join('');
    } catch (e) {
      tsResult.innerHTML = '<div class="error-tip">' + escapeHtml(e.message) + '</div>';
    }
  });

  tsInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('tsBtn').click(); });

  // ==================== 正则测试 ====================
  var rePattern = document.getElementById('rePattern');
  var reFlags = document.getElementById('reFlags');
  var reText = document.getElementById('reText');
  var reResult = document.getElementById('reResult');

  document.getElementById('reBtn').addEventListener('click', function () {
    var p = rePattern.value;
    var f = reFlags.value;
    var t = reText.value;
    if (!p) { reResult.innerHTML = '<div class="empty-tip">请输入正则表达式</div>'; return; }
    var r = core.regexTest(p, f, t);
    if (!r.ok) {
      reResult.innerHTML = '<div class="error-tip">' + escapeHtml(r.error) + '</div>';
      return;
    }
    if (r.matches.length === 0) {
      reResult.innerHTML = '<div class="empty-tip">无匹配结果</div>';
      return;
    }
    reResult.innerHTML = r.matches.map(function (m, i) {
      var groups = m.groups && m.groups.length
        ? ' · 捕获组: ' + m.groups.map(function (g) { return '"' + escapeHtml(g) + '"'; }).join(', ')
        : '';
      return '<div class="match-item"><span class="mi-index">#' + (i + 1) + '</span>' +
        '<span class="mi-match">' + escapeHtml(m.match) + '</span>' +
        '<span class="mi-pos">位置 ' + m.index + groups + '</span></div>';
    }).join('');
  });

  // ==================== 文本 Diff ====================
  var diffA = document.getElementById('diffA');
  var diffB = document.getElementById('diffB');
  var diffResult = document.getElementById('diffResult');
  var diffStats = document.getElementById('diffStats');

  document.getElementById('diffBtn').addEventListener('click', function () {
    var r = core.textDiff(diffA.value, diffB.value);
    diffStats.innerHTML =
      '<span class="stat-add">+ ' + r.added.length + ' 新增</span>' +
      '<span class="stat-del">- ' + r.removed.length + ' 删除</span>' +
      '<span class="stat-same">= ' + r.same.length + ' 相同</span>';

    // 逐行重建带标记的 diff（保留顺序）
    var linesA = diffA.value.split('\n');
    var linesB = diffB.value.split('\n');
    var html = [];
    var iA = 0, iB = 0;
    // 用 LCS 表重新走一遍以保持顺序
    var dp = buildLcs(linesA, linesB);
    var ia = linesA.length, ib = linesB.length;
    var ordered = [];
    while (ia > 0 || ib > 0) {
      if (ia > 0 && ib > 0 && linesA[ia - 1] === linesB[ib - 1]) {
        ordered.unshift({ type: 'same', text: linesA[ia - 1] });
        ia--; ib--;
      } else if (ib > 0 && (ia === 0 || dp[ia][ib - 1] >= dp[ia - 1][ib])) {
        ordered.unshift({ type: 'add', text: linesB[ib - 1] });
        ib--;
      } else {
        ordered.unshift({ type: 'del', text: linesA[ia - 1] });
        ia--;
      }
    }
    ordered.forEach(function (ln) {
      var sign = ln.type === 'add' ? '+' : ln.type === 'del' ? '-' : ' ';
      html.push('<span class="diff-line ' + ln.type + '"><span class="sign">' + sign + '</span>' + escapeHtml(ln.text) + '</span>');
    });
    diffResult.innerHTML = html.join('');
  });

  function buildLcs(a, b) {
    var m = a.length, n = b.length;
    var dp = [];
    for (var i = 0; i <= m; i++) {
      dp[i] = [];
      for (var j = 0; j <= n; j++) {
        if (i === 0 || j === 0) dp[i][j] = 0;
        else if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp;
  }

  // ==================== Base64 ====================
  var b64Input = document.getElementById('b64Input');
  var b64Output = document.getElementById('b64Output');
  var b64Mode = 'encode';

  document.querySelectorAll('.panel[data-panel="base64"] .seg-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.panel[data-panel="base64"] .seg-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      b64Mode = btn.getAttribute('data-mode');
    });
  });

  document.getElementById('b64Btn').addEventListener('click', function () {
    var r = core.base64Code(b64Input.value, b64Mode);
    if (r.ok) {
      b64Output.value = r.result;
      b64Output.style.color = '';
    } else {
      b64Output.value = r.error;
      b64Output.style.color = 'var(--red)';
    }
  });

  // ==================== URL ====================
  var urlInput = document.getElementById('urlInput');
  var urlOutput = document.getElementById('urlOutput');
  var urlMode = 'encode';

  document.querySelectorAll('.panel[data-panel="url"] .seg-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.panel[data-panel="url"] .seg-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      urlMode = btn.getAttribute('data-mode');
    });
  });

  document.getElementById('urlBtn').addEventListener('click', function () {
    var r = core.urlCode(urlInput.value, urlMode);
    if (r.ok) {
      urlOutput.value = r.result;
      urlOutput.style.color = '';
    } else {
      urlOutput.value = r.error;
      urlOutput.style.color = 'var(--red)';
    }
  });

  // ==================== 工具函数 ====================
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
  function padHex(n) {
    var s = n.toString(16);
    return s.length === 1 ? '0' + s : s;
  }

  // ==================== 键盘快捷键 ====================
  // Ctrl/Cmd + 1~7 切换工具，Ctrl/Cmd + Enter 执行当前工具
  var TOOL_ORDER = ['color', 'json', 'timestamp', 'regex', 'diff', 'base64', 'url'];
  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    // Ctrl/Cmd + 1~7 切换工具
    var num = parseInt(e.key, 10);
    if (num >= 1 && num <= 7) {
      e.preventDefault();
      switchTool(TOOL_ORDER[num - 1]);
      return;
    }
    // Ctrl/Cmd + Enter 执行当前工具
    if (e.key === 'Enter') {
      e.preventDefault();
      var activePanel = document.querySelector('.panel.active');
      if (activePanel) {
        var tool = activePanel.getAttribute('data-panel');
        var btnId = AUTO_RUN[tool];
        if (btnId) {
          var btn = document.getElementById(btnId);
          if (btn) btn.click();
        }
      }
    }
  });

  // ==================== JSON 下载 ====================
  document.getElementById('jsonDownloadBtn').addEventListener('click', function () {
    var text = jsonOutput.value;
    if (!text) { toast('内容为空'); return; }
    downloadFile(text, 'dev-toolbox.json', 'application/json');
    toast('已下载 JSON 文件');
  });

  // ==================== Diff 交换 A/B ====================
  document.getElementById('diffSwapBtn').addEventListener('click', function () {
    var a = diffA.value;
    diffA.value = diffB.value;
    diffB.value = a;
    toast('已交换 A / B');
  });

  // ==================== Diff 导出 HTML ====================
  document.getElementById('diffExportBtn').addEventListener('click', function () {
    var stats = diffStats.textContent;
    var html = diffResult.innerHTML;
    if (!html) { toast('请先执行对比差异'); return; }
    var full = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
      '<title>文本 Diff 对比结果</title><style>' +
      'body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:#f5f5f7;padding:32px;}' +
      '.diff-stats{display:flex;gap:14px;font-weight:600;margin-bottom:16px;font-size:14px;}' +
      '.stat-add{color:#34c759}.stat-del{color:#ff3b30}.stat-same{color:#8e8e93}' +
      '.diff-view{background:#fff;border-radius:8px;border:1px solid #e5e5ea;padding:16px;font-family:"SF Mono",Menlo,Consolas,monospace;font-size:13px;line-height:1.8;}' +
      '.diff-line{display:block;padding:2px 8px;border-radius:4px;white-space:pre-wrap;word-break:break-all;}' +
      '.diff-line.add{background:rgba(52,199,89,0.12);color:#1a7a3a}' +
      '.diff-line.del{background:rgba(255,59,48,0.10);color:#b3261a;text-decoration:line-through;text-decoration-color:rgba(255,59,48,0.4)}' +
      '.diff-line.same{color:#8e8e93}' +
      '.diff-line .sign{display:inline-block;width:18px;opacity:0.7}' +
      '</style></head><body><div class="diff-stats">' + escapeHtml(stats) + '</div><div class="diff-view">' + html + '</div></body></html>';
    downloadFile(full, 'diff-result.html', 'text/html');
    toast('已导出 HTML 文件');
  });

  // ==================== 拖拽文件上传到 Diff ====================
  function bindDropTarget(textarea) {
    textarea.addEventListener('dragover', function (e) {
      e.preventDefault();
      textarea.classList.add('drag-over');
    });
    textarea.addEventListener('dragleave', function () {
      textarea.classList.remove('drag-over');
    });
    textarea.addEventListener('drop', function (e) {
      e.preventDefault();
      textarea.classList.remove('drag-over');
      var file = e.dataTransfer.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) { toast('文件过大（>1MB）'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        textarea.value = reader.result;
        toast('已导入 ' + file.name);
      };
      reader.readAsText(file);
    });
  }
  bindDropTarget(diffA);
  bindDropTarget(diffB);

  // ==================== 文件下载工具函数 ====================
  function downloadFile(content, filename, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ==================== PWA 安装提示 ====================
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var btn = document.getElementById('installBtn');
    if (btn) btn.hidden = false;
  });
  var installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) { toast('当前浏览器不支持安装'); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        installBtn.hidden = true;
      });
    });
  }

  // ==================== Service Worker 注册 ====================
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // 注册失败静默处理，不影响应用正常使用
      });
    });
  }

  // ==================== 初始化 ====================
  runColor();

  // 支持 hash 路由：#json #diff 等，便于深链与截图
  function applyHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (h && TOOL_META[h]) {
      switchTool(h);
      return;
    }
    // 无 hash 时恢复上次工具
    try {
      var last = localStorage.getItem('dev-toolbox:last');
      if (last && TOOL_META[last] && last !== 'color') {
        switchTool(last);
      }
    } catch (e) {}
  }
  applyHash();
  window.addEventListener('hashchange', applyHash);
})();
