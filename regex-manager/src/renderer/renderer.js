// 正则管家 - 渲染层逻辑
// 处理用户交互、正则匹配、结果渲染、历史记录

'use strict';

(function () {
  // ========== DOM 元素引用 ==========
  const patternInput = document.getElementById('pattern-input');
  const flagsInput = document.getElementById('flags-input');
  const testString = document.getElementById('test-string');
  const patternStatus = document.getElementById('pattern-status');
  const highlightOutput = document.getElementById('highlight-output');
  const matchCount = document.getElementById('match-count');
  const matchDetails = document.getElementById('match-details');
  const detailCard = document.getElementById('detail-card');
  const replacementInput = document.getElementById('replacement-input');
  const replaceOutput = document.getElementById('replace-output');
  const toast = document.getElementById('toast');
  const btnFavorite = document.getElementById('btn-favorite');
  const btnCopyPattern = document.getElementById('btn-copy-pattern');

  // ========== 状态 ==========
  let historyData = { history: [], favorites: [] };
  let saveTimer = null;
  let historyTimer = null;
  let currentMatches = [];
  let selectedMatchIndex = -1;

  // ========== 工具函数 ==========
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ========== 标志同步 ==========
  function syncFlagsFromCheckboxes() {
    const checks = document.querySelectorAll('.flag-chip input[type="checkbox"]');
    let flags = '';
    checks.forEach(cb => {
      if (cb.checked) {
        flags += cb.dataset.flag;
        cb.closest('.flag-chip').classList.add('active');
      } else {
        cb.closest('.flag-chip').classList.remove('active');
      }
    });
    flagsInput.value = flags;
  }

  function syncCheckboxesFromInput() {
    const flags = flagsInput.value;
    const checks = document.querySelectorAll('.flag-chip input[type="checkbox"]');
    checks.forEach(cb => {
      const f = cb.dataset.flag;
      cb.checked = flags.includes(f);
      if (cb.checked) {
        cb.closest('.flag-chip').classList.add('active');
      } else {
        cb.closest('.flag-chip').classList.remove('active');
      }
    });
  }

  // ========== 核心匹配与渲染 ==========
  function runMatch() {
    const pattern = patternInput.value;
    const flags = flagsInput.value;
    const text = testString.value;

    // 清空状态
    patternStatus.className = 'pattern-status';
    patternStatus.textContent = '';

    if (!pattern) {
      highlightOutput.innerHTML = '<div class="placeholder-text">输入正则和文本后，匹配结果将在此高亮显示</div>';
      matchCount.textContent = '0 个匹配';
      matchCount.style.color = '';
      detailCard.style.display = 'none';
      replaceOutput.innerHTML = '<div class="placeholder-text">输入替换文本后在此预览结果</div>';
      currentMatches = [];
      return;
    }

    const result = window.regexApi.executeRegex(pattern, flags, text);

    if (!result.ok) {
      patternStatus.className = 'pattern-status error';
      patternStatus.textContent = result.error;
      highlightOutput.innerHTML = '<div class="placeholder-text" style="color:var(--error);">' + escapeHtml(result.error) + '</div>';
      matchCount.textContent = '错误';
      matchCount.style.color = 'var(--error)';
      detailCard.style.display = 'none';
      currentMatches = [];
      runReplace();
      return;
    }

    currentMatches = result.matches;
    selectedMatchIndex = -1;

    // 更新匹配计数
    const count = result.matches.length;
    matchCount.textContent = count + ' 个匹配';
    matchCount.style.color = count > 0 ? 'var(--accent)' : 'var(--text-secondary)';

    if (result.error === null) {
      patternStatus.className = 'pattern-status ok';
      patternStatus.textContent = count > 0 ? `✓ 正则有效，共匹配 ${count} 处` : '✓ 正则有效，无匹配';
    }

    // 渲染高亮
    renderHighlight(text, result.matches);

    // 渲染匹配详情
    renderMatchDetails(result.matches, result.groupCount);

    // 渲染替换
    runReplace();

    // 记录历史（防抖）
    scheduleHistorySave(pattern, flags);
  }

  function renderHighlight(text, matches) {
    if (!text) {
      highlightOutput.innerHTML = '<div class="placeholder-text">测试文本为空</div>';
      return;
    }
    if (matches.length === 0) {
      highlightOutput.textContent = text;
      return;
    }

    const segments = window.regexApi.buildHighlightSegments(text, matches);
    let html = '';
    segments.forEach(seg => {
      if (seg.isMatch) {
        const idx = seg.matchIndex;
        html += `<span class="match-highlight${idx === selectedMatchIndex ? ' selected' : ''}" data-match-index="${idx}">${escapeHtml(seg.text)}</span>`;
      } else {
        html += escapeHtml(seg.text);
      }
    });
    highlightOutput.innerHTML = html;

    // 点击匹配项高亮详情
    highlightOutput.querySelectorAll('.match-highlight').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.matchIndex, 10);
        selectMatch(idx);
      });
    });
  }

  function selectMatch(idx) {
    selectedMatchIndex = idx;
    // 重新渲染高亮
    const text = testString.value;
    renderHighlight(text, currentMatches);
    // 滚动详情到对应项
    const detailEl = matchDetails.querySelector(`[data-detail-index="${idx}"]`);
    if (detailEl) {
      detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      detailEl.style.borderColor = 'var(--accent)';
      setTimeout(() => { detailEl.style.borderColor = ''; }, 1500);
    }
  }

  function renderMatchDetails(matches, groupCount) {
    if (matches.length === 0) {
      detailCard.style.display = 'none';
      return;
    }

    // 始终显示匹配详情（即使没有捕获组也显示匹配值）
    detailCard.style.display = 'flex';
    let html = '';
    const maxShow = Math.min(matches.length, 50);
    for (let i = 0; i < maxShow; i++) {
      const m = matches[i];
      html += `<div class="match-detail-item" data-detail-index="${i}">`;
      html += `<div class="match-detail-header">`;
      html += `<span class="match-detail-index">#${i + 1}</span>`;
      html += `<span class="match-detail-value">${escapeHtml(m.value)}</span>`;
      html += `</span></div>`;

      if (m.groups.length > 0) {
        html += '<div class="match-detail-groups">';
        m.groups.forEach((g, gi) => {
          const val = g === null ? '(未匹配)' : escapeHtml(g);
          const cls = g === null ? 'match-detail-group-value null' : 'match-detail-group-value';
          html += `<div class="match-detail-group">`;
          html += `<span class="match-detail-group-label">组 ${gi + 1}</span>`;
          html += `<span class="${cls}">${val}</span>`;
          html += `</div>`;
        });
        html += '</div>';
      }

      if (m.namedGroups && Object.keys(m.namedGroups).length > 0) {
        if (m.groups.length === 0) html += '<div class="match-detail-groups">';
        for (const key of Object.keys(m.namedGroups)) {
          const val = m.namedGroups[key] === null ? '(未匹配)' : escapeHtml(m.namedGroups[key]);
          const cls = m.namedGroups[key] === null ? 'match-detail-group-value null' : 'match-detail-group-value';
          html += `<div class="match-detail-group">`;
          html += `<span class="match-detail-group-label">${escapeHtml(key)}</span>`;
          html += `<span class="${cls}">${val}</span>`;
          html += `</div>`;
        }
        if (m.groups.length === 0) html += '</div>';
      }

      html += '</div>';
    }
    if (matches.length > maxShow) {
      html += `<div style="text-align:center;color:var(--text-tertiary);font-size:12px;padding:8px;">仅显示前 ${maxShow} 条，共 ${matches.length} 条</div>`;
    }
    matchDetails.innerHTML = html;
  }

  function runReplace() {
    const pattern = patternInput.value;
    const flags = flagsInput.value;
    const text = testString.value;
    const replacement = replacementInput.value;

    if (!pattern || !replacement) {
      replaceOutput.innerHTML = '<div class="placeholder-text">输入替换文本后在此预览结果</div>';
      return;
    }

    const result = window.regexApi.executeReplace(pattern, flags, text, replacement);
    if (!result.ok) {
      replaceOutput.innerHTML = '<div class="placeholder-text" style="color:var(--error);">' + escapeHtml(result.error) + '</div>';
      return;
    }

    if (result.replacements === 0) {
      replaceOutput.innerHTML = '<div class="placeholder-text">无替换（未匹配到内容）</div>';
      return;
    }

    // 渲染替换结果，高亮变化部分
    const escaped = escapeHtml(result.result);
    replaceOutput.innerHTML = escaped + `<div class="replace-count">已替换 ${result.replacements} 处</div>`;
  }

  // ========== 历史记录 ==========
  function scheduleHistorySave(pattern, flags) {
    if (historyTimer) clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      if (!pattern) return;
      // 去重：如果最近一条和当前一样就不加
      const last = historyData.history[0];
      if (last && last.pattern === pattern && last.flags === flags) return;
      historyData.history.unshift({
        pattern,
        flags,
        time: Date.now()
      });
      // 只保留最近 50 条
      if (historyData.history.length > 50) {
        historyData.history = historyData.history.slice(0, 50);
      }
      renderHistory();
      saveData();
    }, 1500);
  }

  function renderHistory() {
    const container = document.getElementById('history-content');
    if (historyData.history.length === 0) {
      container.innerHTML = '<div class="placeholder-text">暂无历史记录</div>';
      return;
    }
    let html = '';
    historyData.history.forEach((item, i) => {
      html += `<div class="history-item" data-index="${i}">`;
      html += `<span class="history-item-pattern">/${escapeHtml(item.pattern)}/</span>`;
      html += `<span class="history-item-flags">${escapeHtml(item.flags)}</span>`;
      html += `<span class="history-item-time">${formatTime(item.time)}</span>`;
      html += `</div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index, 10);
        const item = historyData.history[idx];
        patternInput.value = item.pattern;
        flagsInput.value = item.flags;
        syncCheckboxesFromInput();
        runMatch();
        showToast('已加载历史记录');
      });
    });
  }

  function renderFavorites() {
    const container = document.getElementById('favorites-content');
    if (historyData.favorites.length === 0) {
      container.innerHTML = '<div class="placeholder-text">暂无收藏，点击右上角星标收藏当前正则</div>';
      return;
    }
    let html = '';
    historyData.favorites.forEach((item, i) => {
      html += `<div class="favorite-item" data-index="${i}">`;
      html += `<span class="favorite-item-pattern">/${escapeHtml(item.pattern)}/</span>`;
      html += `<span class="favorite-item-flags">${escapeHtml(item.flags)}</span>`;
      html += `<span class="favorite-item-time">${formatTime(item.time)}</span>`;
      html += `<button class="favorite-item-delete" data-del-index="${i}" title="删除">`;
      html += `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>`;
      html += `</button>`;
      html += `</div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.favorite-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.favorite-item-delete')) return;
        const idx = parseInt(el.dataset.index, 10);
        const item = historyData.favorites[idx];
        patternInput.value = item.pattern;
        flagsInput.value = item.flags;
        syncCheckboxesFromInput();
        runMatch();
        showToast('已加载收藏');
      });
    });

    container.querySelectorAll('.favorite-item-delete').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.delIndex, 10);
        historyData.favorites.splice(idx, 1);
        renderFavorites();
        saveData();
        showToast('已删除收藏');
      });
    });
  }

  function saveData() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      window.storeApi.save(historyData);
    }, 500);
  }

  async function loadData() {
    try {
      const data = await window.storeApi.load();
      if (data && data.history) {
        historyData = data;
      }
    } catch (e) {
      console.error('加载历史失败:', e);
    }
    renderHistory();
    renderFavorites();
  }

  // ========== 收藏 ==========
  function toggleFavorite() {
    const pattern = patternInput.value;
    const flags = flagsInput.value;
    if (!pattern) {
      showToast('请先输入正则表达式');
      return;
    }
    // 检查是否已存在
    const existIdx = historyData.favorites.findIndex(f => f.pattern === pattern && f.flags === flags);
    if (existIdx >= 0) {
      historyData.favorites.splice(existIdx, 1);
      btnFavorite.classList.remove('active');
      showToast('已取消收藏');
    } else {
      historyData.favorites.unshift({
        pattern,
        flags,
        time: Date.now()
      });
      btnFavorite.classList.add('active');
      showToast('已收藏');
    }
    renderFavorites();
    saveData();
  }

  function updateFavoriteButton() {
    const pattern = patternInput.value;
    const flags = flagsInput.value;
    const exists = historyData.favorites.some(f => f.pattern === pattern && f.flags === flags);
    if (exists) {
      btnFavorite.classList.add('active');
    } else {
      btnFavorite.classList.remove('active');
    }
  }

  // ========== 模式库 ==========
  function renderLibrary() {
    const container = document.getElementById('library-content');
    const patterns = window.patternApi.getPatterns();
    let html = '';
    patterns.forEach(cat => {
      html += '<div class="library-category">';
      html += `<div class="library-category-title">${escapeHtml(cat.category)}</div>`;
      html += '<div class="library-items">';
      cat.items.forEach((item, i) => {
        html += `<div class="library-item" data-pattern="${escapeHtml(item.pattern)}" data-flags="${escapeHtml(item.flags)}" data-example="${escapeHtml(item.example)}">`;
        html += `<div class="library-item-name">${escapeHtml(item.name)}</div>`;
        html += `<div class="library-item-desc">${escapeHtml(item.description)}</div>`;
        html += `<div class="library-item-pattern">/${escapeHtml(item.pattern)}/${escapeHtml(item.flags)}</div>`;
        html += `</div>`;
      });
      html += '</div></div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.library-item').forEach(el => {
      el.addEventListener('click', () => {
        patternInput.value = el.dataset.pattern;
        flagsInput.value = el.dataset.flags || 'g';
        syncCheckboxesFromInput();
        // 如果测试文本为空或用户想看示例，填入示例
        if (!testString.value || testString.value.trim() === '') {
          testString.value = el.dataset.example || '';
        }
        runMatch();
        showToast('已加载模式：' + el.querySelector('.library-item-name').textContent);
      });
    });
  }

  // ========== 标签切换 ==========
  function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.tab-panel');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + tab).classList.add('active');
      });
    });
  }

  // ========== 标志复选框 ==========
  function setupFlagCheckboxes() {
    const checks = document.querySelectorAll('.flag-chip input[type="checkbox"]');
    checks.forEach(cb => {
      cb.addEventListener('change', () => {
        syncFlagsFromCheckboxes();
        runMatch();
      });
    });

    // 点击 label 也能切换
    document.querySelectorAll('.flag-chip').forEach(label => {
      label.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        e.preventDefault();
        const cb = label.querySelector('input');
        cb.checked = !cb.checked;
        syncFlagsFromCheckboxes();
        runMatch();
      });
    });
  }

  // ========== 事件绑定 ==========
  function bindEvents() {
    // 输入实时匹配
    patternInput.addEventListener('input', () => {
      runMatch();
      updateFavoriteButton();
    });
    flagsInput.addEventListener('input', () => {
      syncCheckboxesFromInput();
      runMatch();
      updateFavoriteButton();
    });
    testString.addEventListener('input', () => {
      runMatch();
    });
    replacementInput.addEventListener('input', () => {
      runReplace();
    });

    // 收藏按钮
    btnFavorite.addEventListener('click', toggleFavorite);

    // 复制正则
    btnCopyPattern.addEventListener('click', async () => {
      const pattern = patternInput.value;
      const flags = flagsInput.value;
      if (!pattern) {
        showToast('正则为空');
        return;
      }
      await window.storeApi.writeClipboard(pattern);
      showToast('已复制：' + (pattern.length > 30 ? pattern.slice(0, 30) + '...' : pattern));
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter 执行匹配
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runMatch();
      }
    });
  }

  // ========== 初始化 ==========
  function init() {
    setupFlagCheckboxes();
    setupTabs();
    bindEvents();
    renderLibrary();
    loadData().then(() => {
      updateFavoriteButton();
    });

    // 设置默认示例 - 多行丰富内容展示
    patternInput.value = '(\\d+)|([a-zA-Z]+@\\w+\\.\\w+)';
    flagsInput.value = 'g';
    syncCheckboxesFromInput();
    testString.value = '订单号：20260712001\n金额：￥1,299.00\n手机：13812345678\n邮箱：test@example.com\nIP地址：192.168.1.1\n日期：2026-07-12\n备注：contact admin@site.org for details';
    runMatch();
    patternInput.focus();
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
