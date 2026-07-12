'use strict';

/* 日志管家 · 渲染层逻辑 */

(function () {
  const C = window.LogCore;
  const $ = (id) => document.getElementById(id);

  // ---------- 状态 ----------
  const state = {
    view: 'log',              // log | recent | stats
    file: null,               // { path, name, size, encoding, content, truncated }
    lines: [],                // 解析后的全量行
    filtered: [],             // 过滤后的行（引用 lines 中的对象 + 原始索引）
    levelFilter: { TRACE: true, DEBUG: true, INFO: true, WARN: true, ERROR: true, FATAL: true },
    search: { query: '', useRegex: false, caseSensitive: false, matches: [], current: -1, regex: null },
    tail: true,               // 实时跟踪
    autoScroll: true,         // 自动滚动到底部
    wrap: false,              // 换行
    counts: null,             // 各级别计数
    // 虚拟滚动
    rowHeight: 22,
    viewport: null,
    scrollTop: 0,
    visibleStart: 0,
    visibleEnd: 0,
    buffer: 8
  };

  const ROW_HEIGHT_NORMAL = 38;
  const ROW_HEIGHT_WRAP = 86;
  const MAX_RENDER_LINES = 200000; // 单文件最大渲染行数保护

  // ---------- DOM ----------
  const dom = {
    logViewport: $('logViewport'),
    logSpacer: $('logSpacer'),
    logList: $('logList'),
    emptyState: $('emptyState'),
    recentList: $('recentList'),
    statsSection: $('statsSection'),
    toolbar: $('toolbar'),
    searchInput: $('searchInput'),
    searchCount: $('searchCount'),
    searchPrev: $('searchPrev'),
    searchNext: $('searchNext'),
    levelChips: $('levelChips'),
    wrapToggle: $('wrapToggle'),
    autoScrollToggle: $('autoScrollToggle'),
    tailBtn: $('tailBtn'),
    exportBtn: $('exportBtn'),
    openBtn: $('openBtn'),
    emptyOpenBtn: $('emptyOpenBtn'),
    pageTitle: $('pageTitle'),
    pageDesc: $('pageDesc'),
    content: $('content'),
    contentHead: $('contentHead'),
    fileBadge: $('fileBadge'),
    liveDot: $('liveDot'),
    liveStatus: $('liveStatus'),
    liveText: $('liveText'),
    lineCountText: $('lineCountText'),
    encodingText: $('encodingText'),
    aboutMask: $('aboutMask'),
    aboutClose: $('aboutClose'),
    aboutVersion: $('aboutVersion'),
    versionText: $('versionText'),
    afdianBtn: $('afdianBtn')
  };

  // ---------- 窗口控制 ----------
  $('winMin').addEventListener('click', () => window.lm.winMinimize());
  $('winMax').addEventListener('click', () => window.lm.winToggleMaximize());
  $('winClose').addEventListener('click', () => window.lm.winClose());
  window.lm.onMaximizeChange((maximized) => {
    $('winMax').classList.toggle('maximized', maximized);
  });
  window.lm.isMaximized().then(m => $('winMax').classList.toggle('maximized', m));

  // ---------- 应用信息 ----------
  window.lm.appInfo().then(info => {
    const v = 'v' + info.version;
    dom.versionText.textContent = v;
    dom.aboutVersion.textContent = v;
  });

  // ---------- 视图切换 ----------
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  function switchView(view) {
    state.view = view;
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    if (view === 'log') {
      dom.pageTitle.textContent = '日志查看';
      dom.pageDesc.textContent = state.file
        ? `${state.file.name} · ${formatBytes(state.file.size)} · ${state.file.encoding.toUpperCase()}`
        : '打开日志文件，实时跟踪、按级别过滤、全文搜索';
      dom.toolbar.hidden = false;
      showContentArea('log');
    } else if (view === 'recent') {
      dom.pageTitle.textContent = '最近打开';
      dom.pageDesc.textContent = '快速重新打开最近查看过的日志文件';
      dom.toolbar.hidden = true;
      renderRecent();
      showContentArea('recent');
    } else if (view === 'stats') {
      dom.pageTitle.textContent = '统计分析';
      dom.pageDesc.textContent = state.file ? `${state.file.name} 的级别分布与统计` : '打开日志文件后查看统计';
      dom.toolbar.hidden = true;
      renderStats();
      showContentArea('stats');
    }
  }

  function showContentArea(area) {
    dom.emptyState.hidden = true;
    dom.logViewport.hidden = true;
    dom.recentList.hidden = true;
    dom.statsSection.hidden = true;
    dom.contentHead.hidden = true;
    if (area === 'log') {
      if (state.lines.length === 0) {
        dom.emptyState.hidden = false;
      } else {
        dom.contentHead.hidden = false;
        dom.logViewport.hidden = false;
      }
    } else if (area === 'recent') {
      dom.recentList.hidden = false;
    } else if (area === 'stats') {
      if (state.file) dom.contentHead.hidden = false;
      dom.statsSection.hidden = false;
    }
  }

  // ---------- 打开文件 ----------
  dom.openBtn.addEventListener('click', openFile);
  dom.emptyOpenBtn.addEventListener('click', openFile);
  window.lm.onMenuOpen(() => openFile());

  async function openFile() {
    const res = await window.lm.openFile();
    if (res.canceled) return;
    if (res.error) { toast('打开失败：' + res.error, 'error'); return; }
    loadFile(res.data);
    if (res.recent) { /* 最近列表会刷新 */ }
  }

  async function openPath(p) {
    const res = await window.lm.openPath(p);
    if (res.error) { toast('打开失败：' + res.error, 'error'); return; }
    loadFile(res.data);
  }

  function loadFile(data) {
    // 停止旧文件监听（主进程会自动管理，但保险）
    state.file = data;
    const lines = C.parseContent(data.content, 1);
    // 超过最大行数截断
    if (lines.length > MAX_RENDER_LINES) {
      const cut = lines.length - MAX_RENDER_LINES;
      state.lines = lines.slice(cut);
      toast(`文件过大，仅显示最后 ${MAX_RENDER_LINES.toLocaleString()} 行（共 ${lines.length.toLocaleString()} 行）`, 'error');
    } else {
      state.lines = lines;
    }
    if (data.truncated) {
      toast(`文件较大（${formatBytes(data.size)}），已加载末尾 ${formatBytes(TAIL_DISPLAY_SIZE)} 内容`, 'error');
    }
    state.counts = C.countByLevel(state.lines);
    updateLevelCounts();
    applyFilters();
    // 切换到日志视图
    switchView('log');
    dom.exportBtn.disabled = false;
    // 滚动到底部（若自动滚动）
    if (state.autoScroll) {
      requestAnimationFrame(() => scrollToBottom());
    }
    // 更新文件名显示
    updateFileBadge();
  }

  const TAIL_DISPLAY_SIZE = 20 * 1024 * 1024;

  function updateFileBadge() {
    if (!state.file) return;
    dom.pageDesc.textContent = `${state.file.name} · ${formatBytes(state.file.size)} · ${state.file.encoding.toUpperCase()} · ${state.lines.length.toLocaleString()} 行`;
    dom.fileBadge.textContent = state.file.name;
    dom.lineCountText.textContent = state.lines.length.toLocaleString() + ' 行';
    dom.encodingText.textContent = state.file.encoding.toUpperCase();
    updateLiveStatus();
  }

  function updateLiveStatus() {
    const live = state.tail && !!state.file;
    dom.liveDot.classList.toggle('paused', !live);
    dom.liveStatus.classList.toggle('paused', !live);
    dom.liveText.textContent = live ? '跟踪中' : '已暂停';
  }

  // ---------- 拖拽打开 ----------
  dom.content.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.emptyState.classList.add('dragover');
  });
  dom.content.addEventListener('dragleave', () => {
    dom.emptyState.classList.remove('dragover');
  });
  dom.content.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.emptyState.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const f = files[0];
      // Electron File 对象包含 path 属性
      const p = f.path || (f.filepath) ;
      if (p) openPath(p);
    }
  });

  // ---------- 级别过滤 ----------
  dom.levelChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const lvl = chip.dataset.level;
    state.levelFilter[lvl] = !state.levelFilter[lvl];
    chip.classList.toggle('active', state.levelFilter[lvl]);
    applyFilters();
  });

  function updateLevelCounts() {
    if (!state.counts) return;
    document.querySelectorAll('.chip-count').forEach(el => {
      const lvl = el.dataset.count;
      el.textContent = (state.counts[lvl] || 0).toLocaleString();
    });
  }

  // ---------- 搜索 ----------
  let searchTimer = null;
  dom.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 200);
  });
  dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) gotoMatch(-1); else gotoMatch(1);
    } else if (e.key === 'Escape') {
      dom.searchInput.value = '';
      runSearch();
      dom.searchInput.blur();
    }
  });
  dom.searchNext.addEventListener('click', () => gotoMatch(1));
  dom.searchPrev.addEventListener('click', () => gotoMatch(-1));
  window.lm.onMenuSearch(() => dom.searchInput.focus());

  function runSearch() {
    const q = dom.searchInput.value;
    state.search.query = q;
    const { matches, regex } = C.searchLines(state.filtered, q, {
      useRegex: state.search.useRegex,
      caseSensitive: state.search.caseSensitive
    });
    state.search.matches = matches;
    state.search.regex = regex;
    state.search.current = matches.length > 0 ? 0 : -1;
    updateSearchUI();
    renderVisible(true);
  }

  function updateSearchUI() {
    const total = state.search.matches.length;
    const cur = state.search.current;
    dom.searchCount.textContent = total > 0 ? `${cur + 1} / ${total}` : `0 / ${total}`;
    dom.searchNext.disabled = total === 0;
    dom.searchPrev.disabled = total === 0;
  }

  function gotoMatch(dir) {
    const matches = state.search.matches;
    if (matches.length === 0) return;
    let idx = state.search.current + dir;
    if (idx >= matches.length) idx = 0;
    if (idx < 0) idx = matches.length - 1;
    state.search.current = idx;
    updateSearchUI();
    // 滚动到匹配行
    const lineIdx = matches[idx];
    const targetTop = lineIdx * state.rowHeight;
    dom.logViewport.scrollTop = Math.max(0, targetTop - dom.logViewport.clientHeight / 2);
    renderVisible(true);
  }

  // ---------- 选项开关 ----------
  dom.wrapToggle.addEventListener('click', () => {
    state.wrap = !state.wrap;
    dom.wrapToggle.classList.toggle('active', state.wrap);
    state.rowHeight = state.wrap ? ROW_HEIGHT_WRAP : ROW_HEIGHT_NORMAL;
    renderVisible(true);
  });
  dom.autoScrollToggle.addEventListener('click', () => {
    state.autoScroll = !state.autoScroll;
    dom.autoScrollToggle.classList.toggle('active', state.autoScroll);
  });
  dom.tailBtn.addEventListener('click', () => {
    state.tail = !state.tail;
    dom.tailBtn.classList.toggle('active', state.tail);
    if (state.tail && state.file) {
      window.lm.watch(state.file.path);
    } else if (state.file) {
      window.lm.unwatch(state.file.path);
    }
    updateLiveStatus();
  });

  // ---------- 应用过滤 ----------
  function applyFilters() {
    const filtered = C.filterByLevel(state.lines, state.levelFilter);
    state.filtered = filtered;
    // 重新搜索
    runSearch();
    renderVisible(true);
  }

  // ---------- 虚拟滚动渲染 ----------
  function setupViewport() {
    dom.logViewport.addEventListener('scroll', () => {
      state.scrollTop = dom.logViewport.scrollTop;
      renderVisible(false);
    }, { passive: true });
  }
  setupViewport();

  function renderVisible(fullRedraw) {
    if (state.filtered.length === 0) {
      dom.logSpacer.style.height = '0px';
      dom.logList.innerHTML = '';
      return;
    }
    const vp = dom.logViewport;
    const vh = vp.clientHeight;
    const total = state.filtered.length;
    const rowH = state.rowHeight;
    const totalH = total * rowH;
    dom.logSpacer.style.height = totalH + 'px';

    const start = Math.max(0, Math.floor(state.scrollTop / rowH) - state.buffer);
    const end = Math.min(total, Math.ceil((state.scrollTop + vh) / rowH) + state.buffer);

    state.visibleStart = start;
    state.visibleEnd = end;

    // 定位列表容器
    dom.logList.style.transform = `translateY(${start * rowH}px)`;

    // 构建可见行 HTML
    const matchSet = new Set(state.search.matches);
    const curMatch = state.search.current >= 0 ? state.search.matches[state.search.current] : -1;
    const regex = state.search.regex;
    const wrap = state.wrap;
    const html = [];
    for (let i = start; i < end; i++) {
      const line = state.filtered[i];
      const isMatch = matchSet.has(i);
      const isCurrent = i === curMatch;
      const lvl = line.level || 'UNKNOWN';
      const textHtml = regex ? C.highlightMatches(line.raw, regex) : C.escapeHtml(line.raw);
      const cls = ['log-row'];
      if (i % 2 === 1) cls.push('row-even');
      if (lvl === 'ERROR') cls.push('error-row');
      if (lvl === 'FATAL') cls.push('fatal-row');
      if (lvl === 'WARN') cls.push('warn-row');
      if (isMatch) cls.push('matched');
      if (isCurrent) cls.push('current');
      html.push(
        `<div class="${cls.join(' ')}" style="height:${rowH}px" data-idx="${i}">` +
        `<span class="line-no">${line.lineNo}</span>` +
        `<span class="level-badge lvl-${lvl}">${lvl}</span>` +
        `<span class="log-text${wrap ? ' wrap' : ''}">${textHtml}</span>` +
        `</div>`
      );
    }
    dom.logList.innerHTML = html.join('');
  }

  function scrollToBottom() {
    const total = state.filtered.length;
    if (total === 0) return;
    dom.logViewport.scrollTop = total * state.rowHeight;
    renderVisible(true);
  }

  // ---------- 文件监听事件 ----------
  window.lm.onAppended((evt) => {
    if (!state.file || state.file.path !== evt.path) return;
    // 解析新增文本（可能多行）
    const startLineNo = state.lines.length + 1;
    const newLines = C.parseContent(evt.text, startLineNo);
    // 限制总行数
    const overflow = (state.lines.length + newLines.length) - MAX_RENDER_LINES;
    if (overflow > 0) {
      state.lines = state.lines.slice(overflow).concat(newLines);
      // 重新编号
      for (let i = 0; i < state.lines.length; i++) state.lines[i].lineNo = i + 1;
    } else {
      state.lines = state.lines.concat(newLines);
    }
    state.counts = C.countByLevel(state.lines);
    updateLevelCounts();
    applyFilters();
    if (state.autoScroll) {
      requestAnimationFrame(() => scrollToBottom());
    }
    updateFileBadge();
  });

  window.lm.onRotated((evt) => {
    if (!state.file || state.file.path !== evt.path) return;
    loadFile(evt.data);
  });

  window.lm.onRemoved((evt) => {
    if (!state.file || state.file.path !== evt.path) return;
    toast('日志文件已被移除或重命名', 'error');
  });

  // ---------- 最近文件 ----------
  async function renderRecent() {
    const list = await window.lm.getRecent();
    if (list.length === 0) {
      dom.recentList.innerHTML = `
        <div class="recent-empty">
          <h2>暂无最近打开记录</h2>
          <p>打开过的日志文件会显示在这里，方便快速重新查看。</p>
        </div>`;
      return;
    }
    const items = list.map((p) => {
      const name = p.split(/[\\/]/).pop();
      let sizeStr = '';
      try {
        // 无法在渲染层访问 fs，仅显示路径
      } catch (e) {}
      return `
        <div class="recent-item" data-path="${escapeAttr(p)}">
          <div class="recent-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 4h10l4 4v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 4v5h5M8 13h8M8 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </div>
          <div class="recent-info">
            <div class="recent-name">${escapeHtml(name)}</div>
            <div class="recent-path">${escapeHtml(p)}</div>
          </div>
          <div class="recent-meta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>`;
    }).join('');
    dom.recentList.innerHTML = items + `
      <div style="margin-top:14px;text-align:center">
        <button class="ghost-btn" id="clearRecentBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M7 7l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>清空记录</span>
        </button>
      </div>`;
    dom.recentList.querySelectorAll('.recent-item').forEach(el => {
      el.addEventListener('click', () => openPath(el.dataset.path));
    });
    const clearBtn = $('clearRecentBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        await window.lm.clearRecent();
        renderRecent();
        toast('已清空最近记录', 'success');
      });
    }
  }

  // ---------- 统计 ----------
  function renderStats() {
    if (!state.file) {
      dom.statsSection.innerHTML = `
        <div class="recent-empty">
          <h2>暂无统计数据</h2>
          <p>打开日志文件后，这里会显示级别分布、行数统计等分析信息。</p>
        </div>`;
      return;
    }
    const c = state.counts;
    const total = c.total || 0;
    const levelColors = {
      TRACE: '#8e8e93', DEBUG: '#5856d6', INFO: '#007aff',
      WARN: '#ff9500', ERROR: '#ff3b30', FATAL: '#af52de', UNKNOWN: '#c7c7cc'
    };
    const order = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'UNKNOWN'];
    const segs = order.filter(l => c[l] > 0).map(l => {
      const pct = total > 0 ? (c[l] / total * 100) : 0;
      return `<div class="dist-segment" style="width:${pct}%;background:${levelColors[l]}" title="${l}: ${c[l]}"></div>`;
    }).join('');
    const legend = order.filter(l => c[l] > 0).map(l => {
      const pct = total > 0 ? (c[l] / total * 100).toFixed(1) : '0.0';
      return `<div class="dist-legend-item"><span class="dist-legend-dot" style="background:${levelColors[l]}"></span>${l}<span class="dist-pct">${c[l].toLocaleString()} · ${pct}%</span></div>`;
    }).join('');

    dom.statsSection.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${total.toLocaleString()}</div><div class="stat-label">总行数</div></div>
        <div class="stat-card"><div class="stat-value">${formatBytes(state.file.size)}</div><div class="stat-label">文件大小</div></div>
        <div class="stat-card warn"><div class="stat-value">${(c.WARN || 0).toLocaleString()}</div><div class="stat-label">警告 WARN</div></div>
        <div class="stat-card error"><div class="stat-value">${(c.ERROR || 0).toLocaleString()}</div><div class="stat-label">错误 ERROR</div></div>
        <div class="stat-card fatal"><div class="stat-value">${(c.FATAL || 0).toLocaleString()}</div><div class="stat-label">致命 FATAL</div></div>
        <div class="stat-card"><div class="stat-value">${state.file.encoding.toUpperCase()}</div><div class="stat-label">编码</div></div>
      </div>
      <div class="level-distribution">
        <h3>级别分布</h3>
        <div class="dist-bar">${segs}</div>
        <div class="dist-legend">${legend}</div>
      </div>`;
  }

  // ---------- 导出 ----------
  dom.exportBtn.addEventListener('click', async () => {
    if (!state.filtered.length) { toast('没有可导出的内容', 'error'); return; }
    const content = state.filtered.map(l => l.raw).join('\n');
    const name = state.file ? state.file.name.replace(/\.[^.]+$/, '') + '_filtered' : '日志导出';
    const res = await window.lm.exportFile({ content, suggestedName: name });
    if (res.canceled) return;
    if (res.error) { toast('导出失败：' + res.error, 'error'); return; }
    toast('已导出 ' + state.filtered.length.toLocaleString() + ' 行', 'success');
  });

  // ---------- 关于 ----------
  window.lm.onShowAbout(() => dom.aboutMask.hidden = false);
  dom.aboutClose.addEventListener('click', () => dom.aboutMask.hidden = true);
  dom.aboutMask.addEventListener('click', (e) => {
    if (e.target === dom.aboutMask) dom.aboutMask.hidden = true;
  });

  // ---------- 爱发电 ----------
  dom.afdianBtn.addEventListener('click', () => window.lm.openExternal('https://www.ifdian.net/a/giquwei'));

  // ---------- 工具函数 ----------
  function formatBytes(bytes) {
    return C.formatBytes(bytes);
  }
  function escapeHtml(s) { return C.escapeHtml(s); }
  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  let toastTimer = null;
  function toast(msg, type) {
    let el = document.querySelector('.toast');
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 3200);
  }

  // ---------- 窗口大小变化时重绘 ----------
  window.addEventListener('resize', () => {
    if (state.view === 'log' && state.filtered.length > 0) {
      renderVisible(false);
    }
  });

  // ---------- 初始化 ----------
  // 默认显示空状态
  showContentArea('log');
  // 初始化 tailBtn 状态（state.tail 默认 true）
  dom.tailBtn.classList.toggle('active', state.tail);

  // 演示模式：自动加载文件
  window.lm.onDemoLoad((evt) => {
    if (evt && evt.data) loadFile(evt.data);
  });

})();
