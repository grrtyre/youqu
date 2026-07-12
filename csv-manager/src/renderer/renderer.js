'use strict';

// 表格管家渲染层逻辑
const csv = window.CsvCore;

const $ = (id) => document.getElementById(id);

const state = {
  rawText: '',
  fileName: '未命名',
  filePath: '',
  delimiter: 'auto',
  headers: [],
  rows: [],
  cols: [],
  filteredIdx: [],
  sortCol: -1,
  sortDir: 'asc',
  search: '',
  pageSize: 500,
  rendered: 0,
  chartOpen: false,
  chartCol: -1,
  chartType: 'auto'
};

const DEMO_CSV = `产品名称,类别,单价,库存,上架日期,地区
MacBook Pro,笔记本电脑,14999,32,2024-03-15,北京
iPhone 15 Pro,手机,8999,128,2023-09-22,上海
AirPods Pro,耳机,1899,256,2022-10-26,广州
iPad Air,平板,4799,64,2024-05-07,深圳
Magic Mouse,配件,599,512,2021-07-12,北京
Apple Watch S9,穿戴,2999,96,2023-09-12,上海
Mac Studio,台式机,39999,12,2023-06-13,广州
HomePod mini,音箱,749,200,2020-11-16,深圳
MacBook Air,笔记本电脑,9499,48,2024-02-20,北京
iPhone 15,手机,5999,200,2023-09-22,上海
Studio Display,显示器,11499,18,2022-03-18,广州
AirPods Max,耳机,3999,24,2020-12-15,深圳
Mac mini,台式机,4499,80,2024-01-19,北京
Apple TV 4K,影音盒,1299,150,2022-05-04,上海
Magic Keyboard,配件,899,300,2021-08-10,广州`;

// ---------- 初始化 ----------
async function init() {
  bindWindowControls();
  bindButtons();
  bindSearch();
  bindDropZone();
  bindAbout();
  // 截图演示模式：自动加载示例数据
  if (window.cm.demoMode && window.cm.demoMode()) {
    loadFromText(DEMO_CSV, '示例数据.csv', '');
    // 演示模式填充示例最近文件
    renderDemoRecent();
  } else {
    await refreshRecent();
  }
}

// 演示模式下的示例最近文件
function renderDemoRecent() {
  const wrap = $('recentList');
  const demos = ['销售数据_2024Q1.csv', '用户行为分析.tsv', '库存明细.csv'];
  wrap.innerHTML = '';
  demos.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'recent-item';
    btn.innerHTML = '<svg viewBox="0 0 20 20" width="13" height="13"><path d="M6 4h6l3 3v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span>' + escapeHtml(name) + '</span>';
    wrap.appendChild(btn);
  });
}

function bindWindowControls() {
  $('winMin').addEventListener('click', () => window.cm.winMinimize());
  $('winMax').addEventListener('click', () => window.cm.winToggleMaximize());
  $('winClose').addEventListener('click', () => window.cm.winClose());
  window.cm.onMaximizeChange((v) => document.body.classList.toggle('maximized', v));
  window.cm.isMaximized().then(v => { if (v) document.body.classList.add('maximized'); });
}

function bindButtons() {
  $('btnOpen').addEventListener('click', openFile);
  $('openAfdian').addEventListener('click', () => window.cm.openExternal('https://www.ifdian.net/a/giquwei'));
  $('btnLoadDemo').addEventListener('click', () => loadFromText(DEMO_CSV, '示例数据.csv', ''));
  $('exportCSV').addEventListener('click', () => exportData('csv'));
  $('exportJSON').addEventListener('click', () => exportData('json'));
  $('exportMD').addEventListener('click', () => exportData('md'));
  $('copyMD').addEventListener('click', copyMarkdown);
  $('delSelect').addEventListener('change', (e) => {
    state.delimiter = e.target.value;
    reparse();
  });
  $('btnChart').addEventListener('click', toggleChart);
  $('chartColSelect').addEventListener('change', (e) => {
    state.chartCol = parseInt(e.target.value, 10);
    renderChart();
  });
  $('chartTypeToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.chart-type-btn');
    if (!btn) return;
    state.chartType = btn.dataset.type;
    $('chartTypeToggle').querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChart();
  });
}

function bindSearch() {
  let timer = null;
  $('searchInput').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.search = e.target.value;
      applyFilter();
    }, 120);
  });
}

function bindDropZone() {
  const zone = $('dropZone');
  if (!zone) return;
  ;['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.add('dragover');
  }));
  ;['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.remove('dragover');
  }));
  zone.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      const f = files[0];
      const reader = new FileReader();
      reader.onload = () => loadFromText(String(reader.result), f.name, '');
      reader.readAsText(f, 'utf-8');
    }
  });
  // 整个 main 区域也支持拖拽
  const main = $('mainArea');
  ;['dragenter', 'dragover'].forEach(ev => main.addEventListener(ev, (e) => {
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) e.preventDefault();
  }));
  main.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      e.preventDefault();
      const f = files[0];
      const reader = new FileReader();
      reader.onload = () => loadFromText(String(reader.result), f.name, '');
      reader.readAsText(f, 'utf-8');
    }
  });
}

function bindAbout() {
  window.cm.onShowAbout(showAbout);
  $('aboutClose').addEventListener('click', hideAbout);
  $('aboutMask').addEventListener('click', (e) => { if (e.target.id === 'aboutMask') hideAbout(); });
  window.cm.appInfo().then(info => { $('aboutVersion').textContent = '版本 ' + info.version; });
}

function showAbout() { $('aboutMask').hidden = false; }
function hideAbout() { $('aboutMask').hidden = true; }

// ---------- 文件 ----------
async function openFile() {
  const res = await window.cm.openFile();
  if (res.canceled) return;
  if (res.error) { showToast('打开失败：' + res.error); return; }
  loadFromText(res.content, res.name, res.path);
  await refreshRecent();
}

async function refreshRecent() {
  const list = await window.cm.listRecent();
  const wrap = $('recentList');
  if (!list || list.length === 0) {
    wrap.innerHTML = '<div class="recent-empty"><svg viewBox="0 0 20 20" width="16" height="16" style="opacity:0.4;flex-shrink:0"><path d="M6 4h6l3 3v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span>暂无最近文件</span></div>';
    return;
  }
  wrap.innerHTML = '';
  list.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'recent-item';
    const name = p.split(/[\\/]/).pop();
    btn.innerHTML = '<svg viewBox="0 0 20 20" width="13" height="13"><path d="M6 4h6l3 3v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span>' + escapeHtml(name) + '</span>';
    btn.title = p;
    btn.addEventListener('click', () => openRecent(p));
    wrap.appendChild(btn);
  });
}

async function openRecent(p) {
  const res = await window.cm.openRecent(p);
  if (res.error) { showToast('打开失败：' + res.error); await refreshRecent(); return; }
  loadFromText(res.content, res.name, res.path);
}

// ---------- 加载与解析 ----------
function loadFromText(text, name, filePath) {
  state.rawText = text;
  state.fileName = name;
  state.filePath = filePath || '';
  state.sortCol = -1;
  state.sortDir = 'asc';
  state.search = '';
  state.chartCol = -1;
  $('searchInput').value = '';
  parse();
  render();
  // 数据更新后刷新图表
  if (state.chartOpen) {
    populateChartColumns();
    renderChart();
  }
}

function parse() {
  const opts = {};
  if (state.delimiter !== 'auto') {
    opts.delimiter = state.delimiter === '\\t' ? '\t' : state.delimiter;
  }
  const r = csv.parseCSV(state.rawText, opts);
  state.headers = r.headers;
  state.rows = r.rows;
  state.detectedDelimiter = r.delimiter;
  state.cols = csv.analyzeColumns(state.headers, state.rows);
  applyFilter(true);
}

function reparse() {
  if (!state.rawText) return;
  parse();
  render();
  if (state.chartOpen) {
    populateChartColumns();
    renderChart();
  }
}

function applyFilter(silent) {
  state.filteredIdx = csv.filterRows(state.rows, state.search);
  if (!silent) renderTable();
  else renderTable();
}

// ---------- 渲染 ----------
function render() {
  if (!state.headers.length) {
    $('emptyState').hidden = false;
    $('dataView').hidden = true;
    return;
  }
  $('emptyState').hidden = true;
  $('dataView').hidden = false;
  $('fileName').textContent = state.fileName;
  $('metaPill').textContent = fmtNum(state.rows.length) + ' 行 · ' + fmtSize(state.rawText.length);
  $('delWrap').hidden = false;
  $('delSelect').value = state.delimiter;
  $('btnChart').disabled = false;

  renderStatCards();
  renderTable();
  renderStatus();
  enableExport(true);
}

function enableExport(on) {
  ['exportCSV', 'exportJSON', 'exportMD', 'copyMD'].forEach(id => { $(id).disabled = !on; });
}

// ---------- 图表可视化 ----------
function toggleChart() {
  state.chartOpen = !state.chartOpen;
  $('chartPanel').hidden = !state.chartOpen;
  $('btnChart').classList.toggle('active', state.chartOpen);
  if (state.chartOpen) {
    populateChartColumns();
    renderChart();
  }
}

function populateChartColumns() {
  const sel = $('chartColSelect');
  sel.innerHTML = '';
  state.headers.forEach((h, i) => {
    const col = state.cols[i] || { type: 'text' };
    const typeLabel = col.type === 'number' || col.type === 'mixed-number' ? '数值' : col.type === 'date' ? '日期' : '文本';
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = h + '（' + typeLabel + '）';
    sel.appendChild(opt);
  });
  // 默认选第一个数值列，没有则第一列
  if (state.chartCol < 0 || state.chartCol >= state.headers.length) {
    let numIdx = -1;
    for (let i = 0; i < state.cols.length; i++) {
      if (state.cols[i].type === 'number' || state.cols[i].type === 'mixed-number') { numIdx = i; break; }
    }
    state.chartCol = numIdx >= 0 ? numIdx : 0;
  }
  sel.value = String(state.chartCol);
}

function renderChart() {
  if (!state.chartOpen) return;
  const body = $('chartBody');
  const col = state.chartCol;
  if (col < 0 || col >= state.headers.length) {
    body.innerHTML = '<div class="chart-empty">请选择列</div>';
    return;
  }
  const colInfo = state.cols[col] || { type: 'text' };
  const isNumeric = colInfo.type === 'number' || colInfo.type === 'mixed-number';

  // 决定图表类型：auto 时数值列用直方图、其他用计数图
  let type = state.chartType;
  if (type === 'auto') {
    type = isNumeric ? 'histogram' : 'counts';
  }
  // 文本列不支持直方图，回退到计数图
  if (type === 'histogram' && !isNumeric) {
    type = 'counts';
  }

  if (type === 'histogram') {
    renderHistogram(col, colInfo);
  } else {
    renderValueCounts(col);
  }
}

function renderHistogram(col, colInfo) {
  const body = $('chartBody');
  const values = csv.numericSeries(state.rows, col, 5000);
  if (values.length === 0) {
    body.innerHTML = '<div class="chart-empty">该列无数值数据</div>';
    return;
  }
  const bins = 10;
  const hRaw = csv.histogram(values, bins);
  // 过滤掉零值区间，避免浪费纵向空间
  const h = hRaw.filter(function (b) { return b.count > 0; });
  let maxCount = 0;
  for (let i = 0; i < h.length; i++) { if (h[i].count > maxCount) maxCount = h[i].count; }
  const stats = colInfo.stats || {};
  const subtitle = '分布直方图 · ' + values.length + ' 个数值 · 平均 ' +
    (stats.avg !== undefined ? stats.avg : '—') + ' · 范围 [' +
    (stats.min !== undefined ? stats.min : '—') + ', ' +
    (stats.max !== undefined ? stats.max : '—') + ']';

  let html = '<div class="chart-subtitle">' + escapeHtml(subtitle) + '</div>';
  if (h.length === 0) {
    body.innerHTML = '<div class="chart-empty">无有效分布区间</div>';
    return;
  }
  html += '<div class="chart-bars">';
  for (let i = 0; i < h.length; i++) {
    const pct = maxCount > 0 ? (h[i].count / maxCount * 100) : 0;
    const label = h[i].from === h[i].to ? String(h[i].from) : (h[i].from + ' ~ ' + h[i].to);
    // 平滑色阶渐变：从深蓝到浅蓝，逐行递减
    const lightness = 55 + Math.round(15 * (i / Math.max(h.length - 1, 1)));
    const bg = 'linear-gradient(90deg, hsl(210,85%,' + lightness + '%) 0%, hsl(205,80%,' + (lightness + 7) + '%) 100%)';
    html += '<div class="chart-bar-row">' +
      '<div class="chart-bar-label" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</div>' +
      '<div class="chart-bar-track"><div class="chart-bar-fill" style="width:' + pct.toFixed(1) + '%;background:' + bg + '"></div></div>' +
      '<div class="chart-bar-count">' + h[i].count + '</div>' +
      '</div>';
  }
  html += '</div>';
  body.innerHTML = html;
}

function renderValueCounts(col) {
  const body = $('chartBody');
  const vc = csv.valueCounts(state.rows, col, 15);
  if (vc.length === 0) {
    body.innerHTML = '<div class="chart-empty">该列无数据</div>';
    return;
  }
  const maxCount = vc[0].count;
  const total = state.rows.length;
  const subtitle = '值计数图 · 前 ' + vc.length + ' 个 · 共 ' + total + ' 行';

  let html = '<div class="chart-subtitle">' + escapeHtml(subtitle) + '</div>';
  html += '<div class="chart-bars">';
  for (let i = 0; i < vc.length; i++) {
    const pct = maxCount > 0 ? (vc[i].count / maxCount * 100) : 0;
    const pctTotal = total > 0 ? (vc[i].count / total * 100).toFixed(1) : '0';
    const lightness = 55 + Math.round(15 * (i / Math.max(vc.length - 1, 1)));
    const bg = 'linear-gradient(90deg, hsl(210,85%,' + lightness + '%) 0%, hsl(205,80%,' + (lightness + 7) + '%) 100%)';
    html += '<div class="chart-bar-row">' +
      '<div class="chart-bar-label" title="' + escapeHtml(vc[i].value) + '">' + escapeHtml(vc[i].value) + '</div>' +
      '<div class="chart-bar-track"><div class="chart-bar-fill" style="width:' + pct.toFixed(1) + '%;background:' + bg + '"></div></div>' +
      '<div class="chart-bar-count">' + vc[i].count + ' <span class="chart-pct">(' + pctTotal + '%)</span></div>' +
      '</div>';
  }
  html += '</div>';
  body.innerHTML = html;
}

function renderStatCards() {
  const wrap = $('statCards');
  wrap.innerHTML = '';
  const rowCount = state.rows.length;
  const colCount = state.headers.length;
  const numCols = state.cols.filter(c => c.type === 'number' || c.type === 'mixed-number').length;
  const dateCols = state.cols.filter(c => c.type === 'date').length;
  const textCols = colCount - numCols - dateCols;

  // 4 个核心卡片，统一蓝色系，仅用图标区分功能
  const cards = [
    { label: '数据行数', value: fmtNum(rowCount), icon: '<path d="M4 16V9M10 16V4M16 16v-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { label: '数据列数', value: colCount, icon: '<path d="M4 5h12M4 10h12M4 15h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { label: '数值列', value: numCols, icon: '<path d="M7 5L3 10l4 5M13 5l4 5-4 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' },
    { label: '日期列', value: dateCols, icon: '<rect x="4" y="5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 9h12M7 3v4M13 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' }
  ];
  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = 'stat-card';
    el.innerHTML = '<div class="stat-icon"><svg viewBox="0 0 20 20" width="16" height="16">' + c.icon + '</svg></div>' +
      '<div class="stat-body"><div class="label">' + c.label + '</div><div class="value">' + c.value + '</div></div>';
    wrap.appendChild(el);
  });

  // 侧边栏数据概览（填充空白）
  renderSidebarOverview(rowCount, colCount, numCols, dateCols, textCols);
}

function renderSidebarOverview(rowCount, colCount, numCols, dateCols, textCols) {
  const wrap = $('sideOverview');
  if (!wrap) return;
  if (!state.headers.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  const items = [
    { label: '总单元格', value: fmtNum(rowCount * colCount) },
    { label: '文本列', value: textCols },
    { label: '分隔符', value: delLabel(state.detectedDelimiter) },
    { label: '文件大小', value: fmtSize(state.rawText.length) }
  ];
  wrap.innerHTML = '<div class="side-title">数据概览</div>' +
    items.map(it => '<div class="overview-row"><span class="overview-label">' + it.label + '</span><span class="overview-value">' + it.value + '</span></div>').join('');
}

function delLabel(d) {
  if (d === ',') return '逗号';
  if (d === '\t') return 'Tab';
  if (d === ';') return '分号';
  if (d === '|') return '竖线';
  return d || '—';
}

function renderTable() {
  const thead = $('tableHead');
  const tbody = $('tableBody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  // 表头
  const tr = document.createElement('tr');
  const idxTh = document.createElement('th');
  idxTh.innerHTML = '<span class="th-content">#</span>';
    idxTh.style.width = '56px';
  idxTh.style.cursor = 'default';
  tr.appendChild(idxTh);
  state.headers.forEach((h, i) => {
    const th = document.createElement('th');
    const col = state.cols[i] || { type: 'text' };
    const sorted = state.sortCol === i;
    if (sorted) th.classList.add('sorted');
    const arrow = state.sortDir === 'asc' ? '▲' : '▼';
    th.innerHTML = '<span class="th-content">' +
      '<span>' + escapeHtml(h) + '</span>' +
      '<span class="sort-arrow">' + arrow + '</span>' +
      '</span>';
    th.title = col.stats ? (h + '\n总和: ' + col.stats.sum + '\n平均: ' + col.stats.avg + '\n最小: ' + col.stats.min + '\n最大: ' + col.stats.max) : h;
    th.addEventListener('click', () => sortByCol(i));
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // 表体：虚拟分页渲染，避免大表卡顿
  const idxList = state.filteredIdx;
  const limit = Math.min(state.pageSize, idxList.length);
  const frag = document.createDocumentFragment();
  for (let k = 0; k < limit; k++) {
    const i = idxList[k];
    const row = state.rows[i];
    const r = document.createElement('tr');
    const idxTd = document.createElement('td');
    idxTd.textContent = String(i + 1);
    idxTd.style.color = 'var(--text-tertiary)';
    idxTd.style.textAlign = 'right';
    r.appendChild(idxTd);
    state.headers.forEach((_, j) => {
      const td = document.createElement('td');
      let v = row[j] === undefined ? '' : row[j];
      const col = state.cols[j] || { type: 'text' };
      if (v === '') {
        td.classList.add('empty');
        td.textContent = '';
      } else if (col.type === 'number' || col.type === 'mixed-number') {
        td.classList.add('num');
        td.textContent = highlight(v, state.search);
      } else {
        td.innerHTML = highlight(v, state.search);
      }
      r.appendChild(td);
    });
    frag.appendChild(r);
  }
  tbody.appendChild(frag);
  state.rendered = limit;

  // 滚动加载更多
  const wrap = $('tableWrap');
  wrap.onscroll = () => {
    if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 200 && state.rendered < idxList.length) {
      loadMore();
    }
  };
}

function loadMore() {
  const idxList = state.filteredIdx;
  const start = state.rendered;
  const end = Math.min(start + state.pageSize, idxList.length);
  const frag = document.createDocumentFragment();
  for (let k = start; k < end; k++) {
    const i = idxList[k];
    const row = state.rows[i];
    const r = document.createElement('tr');
    const idxTd = document.createElement('td');
    idxTd.textContent = String(i + 1);
    idxTd.style.color = 'var(--text-tertiary)';
    idxTd.style.textAlign = 'right';
    r.appendChild(idxTd);
    state.headers.forEach((_, j) => {
      const td = document.createElement('td');
      let v = row[j] === undefined ? '' : row[j];
      const col = state.cols[j] || { type: 'text' };
      if (v === '') { td.classList.add('empty'); td.textContent = ''; }
      else if (col.type === 'number' || col.type === 'mixed-number') { td.classList.add('num'); td.textContent = highlight(v, state.search); }
      else { td.innerHTML = highlight(v, state.search); }
      r.appendChild(td);
    });
    frag.appendChild(r);
  }
  $('tableBody').appendChild(frag);
  state.rendered = end;
}

function renderStatus() {
  const shown = Math.min(state.rendered, state.filteredIdx.length);
  const total = fmtNum(state.filteredIdx.length);
  const left = state.headers.length + ' 列' + (shown < total ? ' · 已显示 ' + shown + '/' + total : '');
  const right = state.search
    ? '搜索命中 ' + fmtNum(state.filteredIdx.length) + ' 行'
    : delLabel(state.detectedDelimiter);
  $('statusInfo').textContent = left;
  $('filterInfo').textContent = right;
}

function sortByCol(i) {
  if (state.sortCol === i) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortCol = i;
    state.sortDir = 'asc';
  }
  state.rows = csv.sortRows(state.rows, i, state.sortDir);
  state.filteredIdx = csv.filterRows(state.rows, state.search);
  renderTable();
  renderStatus();
}

// ---------- 导出 ----------
function exportData(type) {
  let content = '';
  let name = state.fileName.replace(/\.(csv|tsv|txt)$/i, '') || '导出';
  if (type === 'csv') {
    content = csv.toCSV(state.headers, state.rows, state.detectedDelimiter || ',');
    name += '-导出.csv';
  } else if (type === 'json') {
    content = JSON.stringify(csv.toJSON(state.headers, state.rows), null, 2);
    name += '-导出.json';
  } else if (type === 'md') {
    content = csv.toMarkdown(state.headers, state.rows);
    name += '-导出.md';
  }
  window.cm.saveFile({ content, suggestedName: name }).then(res => {
    if (!res.canceled) {
      if (res.error) showToast('保存失败：' + res.error);
      else showToast('已保存到：' + res.path);
    }
  });
}

function copyMarkdown() {
  const md = csv.toMarkdown(state.headers, state.rows);
  window.cm.writeClipboard(md).then(() => showToast('Markdown 表格已复制到剪贴板'));
}

// ---------- 工具 ----------
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlight(text, q) {
  const s = escapeHtml(text);
  if (!q) return s;
  const ql = String(q).toLowerCase();
  const tl = s.toLowerCase();
  const idx = tl.indexOf(ql);
  if (idx === -1) return s;
  return s.slice(0, idx) + '<span class="hit">' + s.slice(idx, idx + ql.length) + '</span>' + s.slice(idx + ql.length);
}

function fmtNum(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// 简易 toast
let toastTimer = null;
function showToast(msg) {
  let t = document.getElementById('__toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '__toast';
    t.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:rgba(29,29,31,0.92);color:#fff;padding:10px 18px;border-radius:8px;font-size:12.5px;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,0.2);opacity:0;transition:opacity .2s;max-width:80%;text-align:center';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 2400);
}

document.addEventListener('DOMContentLoaded', init);
