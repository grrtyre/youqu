(function () {
  'use strict';

  // ===== DOM =====
  var $ = function (id) { return document.getElementById(id); };
  var exprInput = $('expr');
  var exprStatus = $('exprStatus');
  var describeEl = $('describe');
  var fieldsGrid = $('fieldsGrid');
  var nextList = $('nextList');
  var nextFrom = $('nextFrom');
  var toastEl = $('toast');
  var themeToggle = $('themeToggle');
  var modeBadge = $('modeBadge');
  var recentWrap = $('recentWrap');
  var recentList = $('recentList');
  var recentClear = $('recentClear');
  var cheatToggle = $('cheatToggle');
  var cheatBody = $('cheatBody');
  var cheatArrow = $('cheatArrow');

  // ===== 最近使用历史 =====
  var HISTORY_KEY = 'cron-history';
  var HISTORY_MAX = 8;

  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function addHistory(expr) {
    if (!expr) return;
    var list = loadHistory();
    // 去重：移除已存在的相同表达式
    var idx = list.indexOf(expr);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(expr);
    if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
    saveHistory(list);
    renderHistory();
  }

  function renderHistory() {
    var list = loadHistory();
    if (list.length === 0) {
      recentWrap.style.display = 'none';
      return;
    }
    recentWrap.style.display = '';
    var html = '';
    for (var i = 0; i < list.length; i++) {
      html += '<button class="recent-chip" data-cron="' + escapeHtml(list[i]) + '" title="点击使用">' +
              escapeHtml(list[i]) + '</button>';
    }
    recentList.innerHTML = html;
  }

  // 历史点击复用
  recentList.addEventListener('click', function (e) {
    var target = e.target;
    if (target && target.classList.contains('recent-chip')) {
      exprInput.value = target.getAttribute('data-cron');
      update();
    }
  });

  // 清空历史
  recentClear.addEventListener('click', function () {
    saveHistory([]);
    renderHistory();
    showToast('已清空历史');
  });

  // ===== 字段元信息（5 个标准字段，秒字段按需前置） =====
  var FIELD_META = [
    { key: 'minute', name: '分钟', min: 0, max: 59, full: 60 },
    { key: 'hour',   name: '小时', min: 0, max: 23, full: 24 },
    { key: 'dom',    name: '日',   min: 1, max: 31, full: 31 },
    { key: 'month',  name: '月',   min: 1, max: 12, full: 12 },
    { key: 'dow',    name: '周',   min: 0, max: 6,  full: 7 }
  ];
  var SECOND_META = { key: 'second', name: '秒', min: 0, max: 59, full: 60 };
  var DOW_LABEL = ['日', '一', '二', '三', '四', '五', '六'];

  // ===== 工具 =====
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast('已复制'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('已复制'); } catch (e) { showToast('复制失败'); }
      document.body.removeChild(ta);
    }
  }

  // ===== 字段简短中文描述 =====
  function fieldDesc(meta, values, raw) {
    if (!Array.isArray(values)) return '任意';
    if (values.length >= meta.full) return '任意';
    if (meta.key === 'dow') {
      if (values.length === 1) return '周' + DOW_LABEL[values[0]];
      return values.map(function (v) { return DOW_LABEL[v]; }).join('、');
    }
    if (meta.key === 'month') {
      if (values.length === 1) return values[0] + '月';
      return values.map(function (v) { return v + '月'; }).join('、');
    }
    if (meta.key === 'dom') {
      if (values.length === 1) return values[0] + '号';
      return values.join('、');
    }
    if (meta.key === 'hour') {
      if (values.length === 1) return pad(values[0]) + '点';
      return values.map(function (v) { return pad(v); }).join('、');
    }
    if (meta.key === 'minute') {
      if (values.length === 1) return pad(values[0]) + '分';
      return values.map(function (v) { return pad(v); }).join('、');
    }
    if (meta.key === 'second') {
      if (values.length === 1) return pad(values[0]) + '秒';
      return values.map(function (v) { return pad(v); }).join('、');
    }
    return values.join(',');
  }

  // ===== 渲染字段可视化 =====
  function renderFields(parsed) {
    // 根据是否带秒，构建字段元信息列表
    var metas = parsed.hasSeconds ? [SECOND_META].concat(FIELD_META) : FIELD_META;
    var html = '';
    for (var i = 0; i < metas.length; i++) {
      var meta = metas[i];
      var f = parsed.fields[meta.key];
      var restricted = Array.isArray(f) && f.length < meta.full;
      var unspecified = parsed.unspecified && parsed.unspecified[meta.key];
      var valDisplay, descDisplay, isActive;

      if (!parsed.ok) {
        valDisplay = '—';
        descDisplay = '';
        isActive = false;
      } else if (!Array.isArray(f)) {
        valDisplay = '*';
        descDisplay = '任意';
        isActive = false;
      } else if (unspecified) {
        // Quartz "?" 标记：展示为 ?，描述为"不指定"
        valDisplay = '?';
        descDisplay = '不指定';
        isActive = false;
      } else {
        if (f.length >= meta.full) {
          valDisplay = '*';
          descDisplay = '任意';
          isActive = false;
        } else if (f.length > 6) {
          valDisplay = f[0] + '…' + f[f.length - 1];
          descDisplay = fieldDesc(meta, f, false);
          isActive = restricted;
        } else {
          valDisplay = f.join(',');
          descDisplay = fieldDesc(meta, f, false);
          isActive = restricted;
        }
      }

      // 通配符(*)/不指定(?)卡片标记为 is-wildcard，视觉降权
      var isWildcard = (valDisplay === '*' || valDisplay === '?');
      html += '<div class="field-box' + (isActive ? ' is-active' : '') + (isWildcard ? ' is-wildcard' : '') + '">' +
                '<div class="field-name">' + meta.name + '</div>' +
                '<div class="field-value">' + escapeHtml(valDisplay) + '</div>' +
                '<div class="field-desc">' + escapeHtml(descDisplay) + '</div>' +
              '</div>';
    }
    fieldsGrid.innerHTML = html;
    // 6 字段时给网格加 has-seconds 类，触发 6 列布局
    fieldsGrid.classList.toggle('has-seconds', parsed.hasSeconds === true);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ===== 相对时间 =====
  function relativeTime(date, now) {
    var diff = date.getTime() - now.getTime();
    var abs = Math.abs(diff);
    var min = Math.floor(abs / 60000);
    var hour = Math.floor(min / 60);
    var day = Math.floor(hour / 24);

    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟后';
    if (hour < 24) return hour + ' 小时 ' + (min % 60) + ' 分后';
    if (day === 1) return '明天 ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
    if (day < 7) return day + ' 天后';
    return day + ' 天后';
  }

  function fullTime(date, withSeconds) {
    var y = date.getFullYear();
    var mo = pad(date.getMonth() + 1);
    var d = pad(date.getDate());
    var h = pad(date.getHours());
    var mi = pad(date.getMinutes());
    var week = '周' + DOW_LABEL[date.getDay()];
    if (withSeconds) {
      var s = pad(date.getSeconds());
      return y + '-' + mo + '-' + d + ' ' + h + ':' + mi + ':' + s + ' ' + week;
    }
    return y + '-' + mo + '-' + d + ' ' + h + ':' + mi + ' ' + week;
  }

  // ===== 渲染下次执行 =====
  function renderNext(expr, hasSeconds) {
    try {
      var now = new Date();
      var runs = CronUtils.nextRun(expr, now, 5);
      if (!runs || runs.length === 0) {
        nextList.innerHTML = '<div class="next-empty">暂无下次执行时间</div>';
        return;
      }
      nextFrom.textContent = '从 ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + (hasSeconds ? ':' + pad(now.getSeconds()) : '') + ' 开始';
      var html = '';
      for (var i = 0; i < runs.length; i++) {
        html += '<div class="next-item">' +
                  '<div class="next-index">' + (i + 1) + '</div>' +
                  '<div class="next-main">' +
                    '<div class="next-time">' + fullTime(runs[i], hasSeconds) + '</div>' +
                    '<div class="next-relative">' + relativeTime(runs[i], now) + '</div>' +
                  '</div>' +
                  '<div class="next-day">' + ['日','一','二','三','四','五','六'][runs[i].getDay()] + '</div>' +
                '</div>';
      }
      nextList.innerHTML = html;
    } catch (e) {
      nextList.innerHTML = '<div class="next-empty">无法计算：' + escapeHtml(e.message) + '</div>';
    }
  }

  // ===== 模式徽标 =====
  function updateModeBadge(hasSeconds, ok) {
    if (!modeBadge) return;
    if (!ok) {
      modeBadge.textContent = '—';
      modeBadge.className = 'mode-badge mode-unknown';
      return;
    }
    if (hasSeconds) {
      modeBadge.textContent = 'Quartz · 6 字段';
      modeBadge.className = 'mode-badge mode-6';
    } else {
      modeBadge.textContent = '标准 · 5 字段';
      modeBadge.className = 'mode-badge mode-5';
    }
  }

  // ===== 主更新 =====
  var historyTimer = null;
  function update() {
    var expr = exprInput.value.trim();
    if (!expr) {
      exprStatus.className = 'expr-status';
      exprStatus.textContent = '请输入表达式';
      describeEl.textContent = '—';
      fieldsGrid.innerHTML = '';
      nextList.innerHTML = '<div class="next-empty">输入有效表达式后显示</div>';
      updateModeBadge(false, false);
      clearTimeout(historyTimer);
      return;
    }
    var parsed = CronUtils.parse(expr);
    if (!parsed.ok) {
      exprStatus.className = 'expr-status status-err';
      exprStatus.textContent = '✗ ' + parsed.error;
      describeEl.textContent = '无效表达式';
      renderFields({ ok: false, fields: { minute: '*', hour: '*', dom: '*', month: '*', dow: '*' } });
      nextList.innerHTML = '<div class="next-empty">表达式无效</div>';
      updateModeBadge(false, false);
      clearTimeout(historyTimer);
      return;
    }
    exprStatus.className = 'expr-status status-ok';
    exprStatus.textContent = '✓ 表达式有效';
    describeEl.textContent = CronUtils.describe(expr);
    renderFields(parsed);
    renderNext(expr, parsed.hasSeconds);
    updateModeBadge(parsed.hasSeconds, true);
    // 同步 URL
    var u = new URL(location);
    u.searchParams.set('cron', expr);
    history.replaceState(null, '', u);
    // 防抖记录历史：表达式稳定 1.2 秒后写入
    clearTimeout(historyTimer);
    historyTimer = setTimeout(function () { addHistory(expr); }, 1200);
  }

  // ===== 事件 =====
  exprInput.addEventListener('input', update);

  $('copyBtn').addEventListener('click', function () {
    if (exprInput.value.trim()) {
      copyText(exprInput.value.trim());
    } else {
      showToast('表达式为空');
    }
  });

  $('shareBtn').addEventListener('click', function () {
    var expr = exprInput.value.trim();
    if (!expr) { showToast('表达式为空'); return; }
    var url = location.origin + location.pathname + '?cron=' + encodeURIComponent(expr);
    copyText(url);
  });

  $('clearBtn').addEventListener('click', function () {
    exprInput.value = '';
    update();
    exprInput.focus();
  });

  // 预设：支持 5 字段 / 6 字段两组切换
  var presetTabs = document.querySelectorAll('.preset-tab');
  for (var t = 0; t < presetTabs.length; t++) {
    presetTabs[t].addEventListener('click', function () {
      var mode = this.getAttribute('data-mode');
      // 切换 tab 激活态
      for (var j = 0; j < presetTabs.length; j++) {
        presetTabs[j].classList.toggle('active', presetTabs[j] === this);
      }
      // 切换预设组显示
      var groups = document.querySelectorAll('.presets-group');
      for (var g = 0; g < groups.length; g++) {
        groups[g].classList.toggle('active', groups[g].getAttribute('data-mode') === mode);
      }
    });
  }

  // 预设点击填入
  var presets = document.querySelectorAll('.preset');
  for (var i = 0; i < presets.length; i++) {
    presets[i].addEventListener('click', function () {
      exprInput.value = this.getAttribute('data-cron');
      update();
    });
  }

  // 主题
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('cron-theme', t); } catch (e) {}
  }
  themeToggle.addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
  try {
    var saved = localStorage.getItem('cron-theme');
    if (saved) applyTheme(saved);
  } catch (e) {}

  // 语法速查折叠
  cheatToggle.addEventListener('click', function () {
    var expanded = cheatBody.classList.toggle('open');
    cheatToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    cheatArrow.textContent = expanded ? '⌄' : '›';
  });

  // 初始化：URL 参数优先
  var params = new URLSearchParams(location.search);
  var cronParam = params.get('cron');
  if (cronParam) exprInput.value = cronParam;

  // demo 模式：预置历史 + 展开语法速查（仅用于截图展示）
  if (params.get('demo') === '1') {
    saveHistory(['0 9 * * 1-5', '*/5 * * * *', '0 0 1 * *', '0 0 * * 0', '0 18 * * 5']);
    cheatBody.classList.add('open');
    cheatToggle.setAttribute('aria-expanded', 'true');
    cheatArrow.textContent = '⌄';
  }

  renderHistory();
  update();
})();
