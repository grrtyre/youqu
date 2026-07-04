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

  // ===== 字段元信息 =====
  var FIELD_META = [
    { key: 'minute', name: '分钟', min: 0, max: 59, full: 60 },
    { key: 'hour',   name: '小时', min: 0, max: 23, full: 24 },
    { key: 'dom',    name: '日',   min: 1, max: 31, full: 31 },
    { key: 'month',  name: '月',   min: 1, max: 12, full: 12 },
    { key: 'dow',    name: '周',   min: 0, max: 6,  full: 7 }
  ];
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
    // raw 未受限（即 *）
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
    return values.join(',');
  }

  // ===== 渲染字段可视化 =====
  function renderFields(parsed) {
    var html = '';
    for (var i = 0; i < FIELD_META.length; i++) {
      var meta = FIELD_META[i];
      var f = parsed.fields[meta.key];
      var restricted = Array.isArray(f) && f.length < meta.full;
      var valDisplay, descDisplay, isActive;

      if (!parsed.ok) {
        valDisplay = '—';
        descDisplay = '';
        isActive = false;
      } else if (!Array.isArray(f)) {
        valDisplay = '*';
        descDisplay = '任意';
        isActive = false;
      } else {
        // 紧凑展示值
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

      html += '<div class="field-box' + (isActive ? ' is-active' : '') + '">' +
                '<div class="field-name">' + meta.name + (meta.key === 'dom' ? '(日)' : '') + '</div>' +
                '<div class="field-value">' + escapeHtml(valDisplay) + '</div>' +
                '<div class="field-desc">' + escapeHtml(descDisplay) + '</div>' +
              '</div>';
    }
    fieldsGrid.innerHTML = html;
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

  function fullTime(date) {
    var y = date.getFullYear();
    var mo = pad(date.getMonth() + 1);
    var d = pad(date.getDate());
    var h = pad(date.getHours());
    var mi = pad(date.getMinutes());
    var week = '周' + DOW_LABEL[date.getDay()];
    return y + '-' + mo + '-' + d + ' ' + h + ':' + mi + ' ' + week;
  }

  // ===== 渲染下次执行 =====
  function renderNext(expr) {
    try {
      var now = new Date();
      var runs = CronUtils.nextRun(expr, now, 5);
      if (!runs || runs.length === 0) {
        nextList.innerHTML = '<div class="next-empty">暂无下次执行时间</div>';
        return;
      }
      nextFrom.textContent = '从 ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' 开始';
      var html = '';
      for (var i = 0; i < runs.length; i++) {
        html += '<div class="next-item">' +
                  '<div class="next-index">' + (i + 1) + '</div>' +
                  '<div class="next-main">' +
                    '<div class="next-time">' + fullTime(runs[i]) + '</div>' +
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

  // ===== 主更新 =====
  function update() {
    var expr = exprInput.value.trim();
    if (!expr) {
      exprStatus.className = 'expr-status';
      exprStatus.textContent = '请输入表达式';
      describeEl.textContent = '—';
      fieldsGrid.innerHTML = '';
      nextList.innerHTML = '<div class="next-empty">输入有效表达式后显示</div>';
      return;
    }
    var parsed = CronUtils.parse(expr);
    if (!parsed.ok) {
      exprStatus.className = 'expr-status status-err';
      exprStatus.textContent = '✗ ' + parsed.error;
      describeEl.textContent = '无效表达式';
      // 字段仍尝试展示
      renderFields({ ok: false, fields: { minute: '*', hour: '*', dom: '*', month: '*', dow: '*' } });
      nextList.innerHTML = '<div class="next-empty">表达式无效</div>';
      return;
    }
    exprStatus.className = 'expr-status status-ok';
    exprStatus.textContent = '✓ 表达式有效';
    describeEl.textContent = CronUtils.describe(expr);
    renderFields(parsed);
    renderNext(expr);
    // 同步 URL
    var u = new URL(location);
    u.searchParams.set('cron', expr);
    history.replaceState(null, '', u);
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

  // 预设
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

  // 初始化：URL 参数优先
  var params = new URLSearchParams(location.search);
  var cronParam = params.get('cron');
  if (cronParam) exprInput.value = cronParam;

  update();
})();
