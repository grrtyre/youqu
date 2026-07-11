// 时间管家 - 渲染层逻辑
'use strict';

// api 由 preload.js 的 contextBridge 暴露为全局变量，无需重新声明
const utils = {
  formatDuration(ms) {
    if (!ms || ms < 0) return '0分';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return `${h}小时${m}分`;
    if (m > 0) return `${m}分`;
    return `${totalSec}秒`;
  },
  formatTimer(ms) {
    if (!ms || ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  },
  formatTime(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },
  formatDateCN(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  },
};

// 状态
let projects = [];
let selectedProjectId = null;
let active = null;
let timerInterval = null;
let currentStatsRange = 'today';
let allRecords = [];

// ===== 初始化 =====
async function init() {
  allRecords = await api.listRecords();
  await loadProjects();
  // 默认选中第一个项目，让开始按钮可用（蓝色）
  if (projects.length > 0 && !selectedProjectId) {
    selectedProjectId = projects[0].id;
    renderProjects();
  }
  await refreshActive();
  await refreshOverview();
  await renderRecent();
  bindEvents();
  startTicker();
  api.onTimerChanged(() => {
    refreshActive();
    refreshOverview();
    renderRecent();
  });
}

async function loadProjects() {
  projects = await api.listProjects();
  renderProjects();
}

function renderProjects() {
  const list = document.getElementById('projectList');
  if (projects.length === 0) {
    list.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:8px 12px;">点击 + 新建项目</div>';
    return;
  }
  // 计算今日各项目时长
  const todayKey = new Date();
  const todayStart = new Date(todayKey.getFullYear(), todayKey.getMonth(), todayKey.getDate()).getTime();
  const todayEnd = todayStart + 86400000;
  const totals = {};
  for (const r of allRecords) {
    if (r.start >= todayStart && r.end <= todayEnd) {
      totals[r.projectId] = (totals[r.projectId] || 0) + (r.end - r.start);
    }
  }
  const totalToday = Object.values(totals).reduce((s, v) => s + v, 0);
  list.innerHTML = projects
    .map(
      (p) => {
        const dur = totals[p.id] || 0;
        const durText = dur > 0 ? utils.formatDuration(dur) : '';
        const pct = totalToday > 0 ? Math.round((dur / totalToday) * 100) : 0;
        return `
    <div class="project-item ${p.id === selectedProjectId ? 'selected' : ''}" data-id="${p.id}">
      <span class="project-dot" style="background:${p.color}"></span>
      <span class="project-name">${escapeHtml(p.name)}</span>
      ${durText ? `<span class="project-dur">${durText}</span>` : ''}
      <button class="project-del" data-del="${p.id}" title="删除">×</button>
      <div class="project-bar"><div class="project-bar-fill" style="width:${pct}%;background:${p.color}"></div></div>
    </div>`;
      }
    )
    .join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== 计时 =====
async function refreshActive() {
  active = await api.getActive();
  const hero = document.querySelector('.timer-hero');
  const status = document.getElementById('timerStatus');
  const display = document.getElementById('timerDisplay');
  const projLabel = document.getElementById('timerProject');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const btnCancel = document.getElementById('btnCancel');

  if (active) {
    const proj = projects.find((p) => p.id === active.projectId);
    hero.classList.add('running');
    status.textContent = '计时中';
    projLabel.textContent = proj ? proj.name : '未知项目';
    btnStart.style.display = 'none';
    btnStop.style.display = 'inline-flex';
    btnCancel.style.display = 'inline-flex';
    updateTimerDisplay();
  } else {
    hero.classList.remove('running');
    status.textContent = '未开始计时';
    display.textContent = '00:00:00';
    projLabel.textContent = selectedProjectId
      ? '已选择项目，点击开始'
      : '选择左侧项目开始';
    btnStart.style.display = 'inline-flex';
    btnStop.style.display = 'none';
    btnCancel.style.display = 'none';
    btnStart.disabled = !selectedProjectId;
  }
}

function updateTimerDisplay() {
  if (!active) return;
  const elapsed = Date.now() - active.start;
  document.getElementById('timerDisplay').textContent = utils.formatTimer(elapsed);
}

function startTicker() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (active) updateTimerDisplay();
  }, 1000);
}

// ===== 概览 =====
async function refreshOverview() {
  const ov = await api.overview();
  document.getElementById('todayTotal').textContent = utils.formatDuration(ov.today);
  document.getElementById('weekTotal').textContent = utils.formatDuration(ov.week);
  document.getElementById('monthTotal').textContent = utils.formatDuration(ov.month);
  // 今日记录数
  allRecords = await api.listRecords();
  const todayKey = formatDateKey(Date.now());
  const todayCount = allRecords.filter((r) => formatDateKey(r.start) === todayKey).length;
  document.getElementById('todaySub').textContent = `${todayCount} 条记录`;
  renderProjects();
}

function formatDateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===== 今日记录预览 =====
async function renderRecent() {
  const records = await api.listRecords();
  const todayKey = formatDateKey(Date.now());
  const todayRecords = records.filter((r) => formatDateKey(r.start) === todayKey);
  const container = document.getElementById('recentList');
  if (todayRecords.length === 0) {
    container.innerHTML = '<div class="empty-state-sm">今天还没有记录，开始计时吧</div>';
    return;
  }
  container.innerHTML = todayRecords
    .map((r) => {
      const proj = projects.find((p) => p.id === r.projectId);
      const color = proj ? proj.color : '#aeaeb2';
      const name = proj ? proj.name : '已删除';
      const timeStr = `${utils.formatTime(r.start)} - ${utils.formatTime(r.end)}`;
      return `
        <div class="recent-item">
          <div class="recent-bar" style="background:${color}"></div>
          <span class="recent-name">${escapeHtml(name)}</span>
          <span class="recent-time">${timeStr}</span>
          <span class="recent-dur">${utils.formatDuration(r.duration)}</span>
        </div>`;
    })
    .join('');
}

// ===== 记录 =====
async function renderRecords() {
  const records = await api.listRecords();
  const container = document.getElementById('recordsList');
  document.getElementById('recordCount').textContent = records.length > 0 ? `共 ${records.length} 条` : '';
  if (records.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无记录，开始计时吧</div>';
    return;
  }
  container.innerHTML = records
    .map((r) => {
      const proj = projects.find((p) => p.id === r.projectId);
      const color = proj ? proj.color : '#aeaeb2';
      const name = proj ? proj.name : '已删除';
      const dateStr = utils.formatDateCN(r.start);
      const timeStr = `${utils.formatTime(r.start)} - ${utils.formatTime(r.end)}`;
      return `
        <div class="record-item">
          <div class="record-bar" style="background:${color}"></div>
          <div class="record-main">
            <div class="record-project">${escapeHtml(name)}</div>
            <div class="record-time">${dateStr} ${timeStr}</div>
          </div>
          <div class="record-duration">${utils.formatDuration(r.duration)}</div>
          <button class="record-del" data-rec="${r.id}" title="删除">×</button>
        </div>`;
    })
    .join('');
}

// ===== 统计 =====
async function renderStats() {
  await renderDonut();
  await renderBars();
}

async function renderDonut() {
  const dist = await api.distribution(currentStatsRange);
  const donut = document.getElementById('donutChart');
  const center = document.getElementById('donutCenter');
  const legend = document.getElementById('donutLegend');

  if (dist.length === 0) {
    donut.style.background = 'rgba(0,0,0,0.05)';
    center.innerHTML = '<div class="donut-total">0分</div><div class="donut-label">暂无数据</div>';
    legend.innerHTML = '<div style="color:var(--text-3);font-size:13px;">暂无记录</div>';
    return;
  }

  const total = dist.reduce((s, d) => s + d.duration, 0);
  // 用 conic-gradient 画环形图
  let acc = 0;
  const stops = dist.map((d) => {
    const start = (acc / total) * 100;
    acc += d.duration;
    const end = (acc / total) * 100;
    return `${d.color} ${start}% ${end}%`;
  });
  donut.style.background = `conic-gradient(${stops.join(', ')})`;

  center.innerHTML = `<div class="donut-total">${utils.formatDuration(total)}</div><div class="donut-label">总时长</div>`;

  legend.innerHTML = dist
    .map(
      (d) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${d.color}"></span>
      <span class="legend-name">${escapeHtml(d.name)}</span>
      <span class="legend-pct">${d.percent}% · ${utils.formatDuration(d.duration)}</span>
    </div>`
    )
    .join('');
}

async function renderBars() {
  const trend = await api.trend(7);
  const container = document.getElementById('barChart');
  const max = Math.max(...trend.map((t) => t.duration), 1);
  container.innerHTML = trend
    .map((t) => {
      const pct = (t.duration / max) * 100;
      const val = t.duration > 0 ? utils.formatDuration(t.duration) : '';
      return `
        <div class="bar-col">
          <div class="bar" style="height:${Math.max(pct, 1)}%">
            ${val ? `<span class="bar-value">${val}</span>` : ''}
          </div>
          <div class="bar-label">${t.label}</div>
        </div>`;
    })
    .join('');
}

// ===== 事件绑定 =====
function bindEvents() {
  // 标签切换
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
      document.getElementById('pane-' + tab).classList.add('active');
      if (tab === 'records') renderRecords();
      if (tab === 'stats') renderStats();
    });
  });

  // 项目选择
  document.getElementById('projectList').addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      const id = delBtn.dataset.del;
      if (confirm('删除该项目及其所有记录？')) {
        await api.removeProject(id);
        if (selectedProjectId === id) selectedProjectId = null;
        await loadProjects();
        await refreshActive();
        await refreshOverview();
        showToast('项目已删除');
      }
      return;
    }
    const item = e.target.closest('.project-item');
    if (item) {
      selectedProjectId = item.dataset.id;
      renderProjects();
      await refreshActive();
    }
  });

  // 计时按钮
  document.getElementById('btnStart').addEventListener('click', async () => {
    if (!selectedProjectId) return;
    active = await api.startTimer(selectedProjectId);
    await refreshActive();
    showToast('开始计时');
  });

  document.getElementById('btnStop').addEventListener('click', async () => {
    await api.stopTimer();
    active = null;
    await refreshActive();
    await refreshOverview();
    showToast('已保存记录');
  });

  document.getElementById('btnCancel').addEventListener('click', async () => {
    await api.cancelTimer();
    active = null;
    await refreshActive();
    showToast('已取消计时');
  });

  // 新建项目
  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal());
  document.getElementById('modalCancel').addEventListener('click', closeProjectModal);
  document.getElementById('modalConfirm').addEventListener('click', confirmProject);

  // 颜色选择
  document.getElementById('colorPicker').addEventListener('click', (e) => {
    const dot = e.target.closest('.color-dot');
    if (!dot) return;
    document.querySelectorAll('.color-dot').forEach((d) => d.classList.remove('active'));
    dot.classList.add('active');
  });

  // 统计范围
  document.querySelectorAll('.range-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatsRange = btn.dataset.range;
      renderDonut();
    });
  });

  // 查看全部记录
  document.getElementById('viewAllRecords').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    const recBtn = document.querySelector('.nav-item[data-tab="records"]');
    recBtn.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    document.getElementById('pane-records').classList.add('active');
    renderRecords();
  });

  // 数据导入导出下拉菜单
  const exportBtn = document.getElementById('exportBtn');
  const exportMenu = document.getElementById('exportMenu');
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportBtn.classList.toggle('open');
    exportMenu.classList.toggle('open');
  });
  // 点击外部关闭菜单
  document.addEventListener('click', () => {
    exportBtn.classList.remove('open');
    exportMenu.classList.remove('open');
  });
  exportMenu.addEventListener('click', (e) => e.stopPropagation());
  exportMenu.querySelectorAll('.menu-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const act = item.dataset.act;
      exportBtn.classList.remove('open');
      exportMenu.classList.remove('open');
      if (act === 'importJSON') {
        try {
          const path = await api.importJSON();
          if (path) {
            await loadProjects();
            selectedProjectId = projects.length > 0 ? projects[0].id : null;
            await refreshActive();
            await refreshOverview();
            await renderRecent();
            showToast('数据已导入');
          }
        } catch (err) {
          showToast('导入失败：' + (err && err.message ? err.message : '文件格式错误'));
        }
        return;
      }
      // 导出
      let path;
      if (act === 'exportCSV') {
        path = await api.exportCSV();
      } else if (act === 'exportJSON') {
        path = await api.exportJSON();
      }
      if (path) showToast('已导出到 ' + path);
    });
  });
}

// 项目弹窗
let editingProjectId = null;
let selectedColor = '#007aff';

function openProjectModal(id) {
  editingProjectId = id || null;
  document.getElementById('modalTitle').textContent = id ? '编辑项目' : '新建项目';
  const nameInput = document.getElementById('projectName');
  if (id) {
    const p = projects.find((x) => x.id === id);
    nameInput.value = p ? p.name : '';
    selectedColor = p ? p.color : '#007aff';
  } else {
    nameInput.value = '';
    selectedColor = '#007aff';
  }
  document.querySelectorAll('.color-dot').forEach((d) => {
    d.classList.toggle('active', d.dataset.color === selectedColor);
  });
  document.getElementById('projectModal').style.display = 'flex';
  setTimeout(() => nameInput.focus(), 50);
}

function closeProjectModal() {
  document.getElementById('projectModal').style.display = 'none';
}

async function confirmProject() {
  const name = document.getElementById('projectName').value.trim();
  const activeDot = document.querySelector('.color-dot.active');
  const color = activeDot ? activeDot.dataset.color : '#007aff';
  if (!name) {
    showToast('请输入项目名称');
    return;
  }
  if (editingProjectId) {
    await api.updateProject(editingProjectId, { name, color });
    showToast('项目已更新');
  } else {
    const p = await api.createProject({ name, color });
    selectedProjectId = p.id;
    showToast('项目已创建');
  }
  closeProjectModal();
  await loadProjects();
  await refreshActive();
}

// Toast
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// 启动
init().catch((e) => console.error('[init] error:', e));
