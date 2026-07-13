// src/renderer/app.js — 抽签转盘管家 渲染层逻辑
// 苹果白高端风格，纯原生 JS 实现，无外部依赖
// 负责：名单管理、转盘绘制与动画、条目编辑、历史记录、设置

const $ = (id) => document.getElementById(id);

// 全局状态
const state = {
  data: null,           // 完整后端状态
  activeList: null,     // 当前激活名单的引用（渲染缓存）
  segments: [],          // 当前转盘扇区（带颜色）
  spinning: false,       // 是否正在转动
  currentRot: 0,         // 当前转盘旋转角度（弧度）
  lastTickIdx: -1         // 上次指针所在扇区（用于滴答音效）
};

// 苹果冷色系：蓝-青-靛-紫4色循环，每色明度交替，避免相邻重复
const POOL = [
  [210, 54, 62],  // 浅蓝
  [195, 58, 50],  // 青
  [240, 50, 58],  // 靛
  [275, 48, 50],  // 紫
];

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}
// 略亮的同色相（用于扇区内侧高光）
function lighten(hex, amt) {
  const c = hex.replace('#', '');
  let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  r = Math.min(255, Math.round(r + (255 - r) * amt));
  g = Math.min(255, Math.round(g + (255 - g) * amt));
  b = Math.min(255, Math.round(b + (255 - b) * amt));
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
function colorAt(i) {
  const [h, s, l] = POOL[i % POOL.length];
  return hslToHex(h, s, l);
}

// ============ 启动 ============
document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindLists();
  bindStage();
  bindEntries();
  bindHistory();
  bindSettings();
  bindToast();
  try {
    state.data = await window.api.state.get();
    renderLists();
    renderActiveList();
    renderEntries();
    renderHistory();
    renderSettingsForm();
    renderLeftStats();
    drawWheel();
  } catch (e) {
    showToast('加载失败：' + (e && e.message ? e.message : e));
  }
}

// 左栏统计卡片
function renderLeftStats() {
  const el = $('leftStats');
  if (!el) return;
  const lists = state.data.lists || [];
  const totalEntries = lists.reduce((s, l) => s + l.entries.length, 0);
  el.innerHTML = `
    <div class="stat-cell"><span class="stat-num">${lists.length}</span><span class="stat-label">名单</span></div>
    <div class="stat-cell"><span class="stat-num">${totalEntries}</span><span class="stat-label">条目</span></div>
  `;
}

// ============ 名单（左侧栏） ============
function bindLists() {
  $('btnNewList').addEventListener('click', async () => {
    const name = await promptInline('新建名单', '请输入名单名称', '未命名名单');
    if (name === null) return;
    const list = await window.api.list.create(name);
    if (list) {
      state.data.lists.push(list);
      state.data.activeListId = list.id;
      await window.api.list.setActive(list.id);
      refreshAll();
      showToast('已创建名单');
    }
  });
}

// 渲染左侧名单列表
function renderLists() {
  const wrap = $('listContainer');
  wrap.innerHTML = '';
  const lists = state.data.lists || [];
  if (!lists.length) {
    wrap.innerHTML = '<div class="lists-empty">暂无名单<br>点击右上角 + 新建</div>';
    return;
  }
  lists.forEach(list => {
    const item = document.createElement('div');
    item.className = 'list-item' + (list.id === state.data.activeListId ? ' active' : '');
    item.dataset.id = list.id;
    item.innerHTML = `
      <span class="list-name">${escapeHtml(list.name)}</span>
      <span class="list-count">${list.entries.length}</span>
      <button class="list-del" title="删除名单" aria-label="删除名单">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.list-del')) return;
      if (list.id === state.data.activeListId) return;
      await window.api.list.setActive(list.id);
      state.data.activeListId = list.id;
      refreshAll();
    });
    // 双击重命名
    item.addEventListener('dblclick', async (e) => {
      if (e.target.closest('.list-del')) return;
      const newName = await promptInline('重命名名单', '请输入新名称', list.name, list.name);
      if (newName === null) return;
      const ok = await window.api.list.rename(list.id, newName);
      if (ok) {
        list.name = newName;
        renderLists();
        renderActiveList();
        showToast('已重命名');
      }
    });
    // 删除
    item.querySelector('.list-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirmInline(`确定删除名单「${list.name}」？此操作不可撤销。`)) return;
      const ok = await window.api.list.delete(list.id);
      if (ok) {
        state.data.lists = state.data.lists.filter(l => l.id !== list.id);
        if (state.data.activeListId === list.id) {
          state.data.activeListId = state.data.lists.length ? state.data.lists[0].id : null;
        }
        refreshAll();
        showToast('已删除名单');
      }
    });
    wrap.appendChild(item);
  });
}

// ============ 中间舞台 ============
function bindStage() {
  $('btnSpin').addEventListener('click', onSpin);
  $('btnCopyResult').addEventListener('click', () => {
    const text = $('resultText').textContent;
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text).then(() => showToast('结果已复制'));
  });
}

// 渲染当前激活名单标题与计数
function renderActiveList() {
  const list = getActive();
  state.activeList = list;
  if (!list) {
    $('activeListName').textContent = '未选择名单';
    $('entryCount').textContent = '0 项';
    state.segments = [];
    $('btnSpin').disabled = true;
    return;
  }
  $('activeListName').textContent = list.name;
  $('entryCount').textContent = `${list.entries.length} 项`;
  rebuildSegments();
  $('btnSpin').disabled = state.spinning || state.segments.length === 0;
}

// 重建扇区（带颜色与几何）
function rebuildSegments() {
  const list = state.activeList;
  state.segments = [];
  if (!list) return;
  const pool = list.entries.filter(e => e.enabled && e.text);
  const totalWeight = pool.reduce((s, e) => s + Math.max(1, e.weight), 0);
  if (totalWeight <= 0) return;
  let acc = 0;
  pool.forEach((e, i) => {
    const w = Math.max(1, e.weight);
    const span = (w / totalWeight) * Math.PI * 2;
    state.segments.push({
      entry: e,
      color: colorAt(i),
      start: acc,
      end: acc + span,
      mid: acc + span / 2
    });
    acc += span;
  });
}

// 转盘绘制
function drawWheel() {
  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const radius = Math.max(10, Math.min(W, H) / 2 - 8);

  ctx.clearRect(0, 0, W, H);

  if (!state.segments.length) {
    // 空状态：绘制占位圆环
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f0f3';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.stroke();
    ctx.fillStyle = '#a1a1a6';
    ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('请先添加条目', cx, cy);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.currentRot);

  state.segments.forEach(seg => {
    // 扇形：径向渐变（内侧略亮 → 外侧基色）增加质感
    const grad = ctx.createRadialGradient(0, 0, radius * 0.18, 0, 0, radius);
    grad.addColorStop(0, lighten(seg.color, 0.18));
    grad.addColorStop(1, seg.color);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, seg.start, seg.end);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.stroke();

    // 文字：始终水平正立（抵消转盘旋转），字号随扇区跨度自适应
    const span = seg.end - seg.start;
    const fontSize = Math.max(11, Math.min(16, Math.round(span * radius * 0.5)));
    const textRadius = radius * 0.6;
    ctx.save();
    ctx.rotate(seg.mid);
    ctx.translate(textRadius, 0);
    // 反向旋转抵消扇区角度 + 转盘旋转 → 文字始终水平正立
    ctx.rotate(-seg.mid - state.currentRot);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
    const isLight = luminance(seg.color) > 0.62;
    const fillCol = isLight ? '#1d1d1f' : '#ffffff';
    if (!isLight) {
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 4;
    }
    ctx.fillStyle = fillCol;
    ctx.fillText(truncate(seg.entry.text, 6), 0, 0);
    ctx.restore();
  });

  // 整体光泽：左上高光（球面感）
  const gloss = ctx.createRadialGradient(-radius * 0.35, -radius * 0.35, radius * 0.1, -radius * 0.35, -radius * 0.35, radius * 0.9);
  gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = gloss;
  ctx.fill();

  // 中心装饰圆（与 spin-btn 视觉呼应，留出中心按钮区域）
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.stroke();
  ctx.restore();
}

// 点击开始
async function onSpin() {
  if (state.spinning) return;
  const list = state.activeList;
  if (!list || !list.entries.filter(e => e.enabled && e.text).length) {
    showToast('当前名单没有可用条目');
    return;
  }
  $('btnSpin').disabled = true;
  state.spinning = true;

  let result;
  try {
    result = await window.api.wheel.draw(list.id);
  } catch (e) {
    state.spinning = false;
    $('btnSpin').disabled = false;
    showToast('抽取失败：' + (e && e.message ? e.message : e));
    return;
  }
  if (!result || !result.segments || !result.segments.length) {
    state.spinning = false;
    $('btnSpin').disabled = false;
    showToast('没有可用条目');
    return;
  }

  // 用主进程返回的 segments 重建（保证与后端一致）
  state.segments = result.segments.map((s, i) => ({
    entry: { text: s.text, weight: s.weight },
    color: colorAt(i),
    start: s.start,
    end: s.end,
    mid: s.mid
  }));
  drawWheel();

  // 计算目标旋转角：让中奖扇区中线对准顶部指针
  // 指针在 12 点钟方向 = canvas 角度 -π/2（顺时针为正，因 y 轴向下）
  const winnerMid = result.segments[result.index].mid;
  const pointerAngle = -Math.PI / 2;
  // 目标：currentRot + winnerMid ≡ pointerAngle (mod 2π)
  // → currentRot ≡ pointerAngle - winnerMid
  let targetBase = pointerAngle - winnerMid;
  // 归一化到 [0, 2π) 并叠加额外整圈
  targetBase = ((targetBase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const extraSpins = 6; // 至少转 6 圈
  const startRot = state.currentRot;
  const targetRot = startRot + (Math.PI * 2) * extraSpins + (targetBase - (((startRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)));

  const duration = state.data.settings.spinDuration || 4500;
  await animateSpin(startRot, targetRot, duration);

  state.currentRot = targetRot;

  // 显示结果
  $('resultText').textContent = result.entry.text;
  $('resultText').classList.remove('empty');
  $('resultText').classList.add('has-result');
  $('resultBar').classList.add('has-result');
  $('btnCopyResult').hidden = false;

  // 记录历史
  const mode = state.data.settings.excludeWinner ? 'remove' : 'normal';
  await window.api.history.record(list.id, result.entry.text, mode);

  // 不重复抽奖模式：剔除中奖条目
  if (state.data.settings.excludeWinner) {
    // 找到实际 entry 并删除（通过 text + index 定位）
    const realEntry = list.entries[result.index];
    if (realEntry) {
      await window.api.entry.removeWinner(list.id, realEntry.id);
    }
  }

  // 重新加载状态以同步
  state.data = await window.api.state.get();
  state.spinning = false;
  renderLists();
  renderActiveList();
  renderEntries();
  renderHistory();
  renderLeftStats();
  drawWheel();
  showToast(`中奖：${result.entry.text}`);
}

// 缓动动画
function animateSpin(from, to, duration) {
  return new Promise((resolve) => {
    const start = performance.now();
    const delta = to - from;
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function tickAudio(idx) {
      if (!state.data.settings.soundEnabled) return;
      if (idx !== state.lastTickIdx) {
        state.lastTickIdx = idx;
        playTick();
      }
    }
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      state.currentRot = from + delta * e;
      // 计算当前指针所在扇区（用于滴答音效）
      const idx = segmentUnderPointer(state.currentRot);
      tickAudio(idx);
      drawWheel();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

// 返回当前指针下的扇区序号（-1 表示无）
function segmentUnderPointer(rot) {
  if (!state.segments.length) return -1;
  const pointerAngle = -Math.PI / 2;
  // 扇区 i 在画布上的角度区间为 [start+rot, end+rot]，归一化后判断是否包含 pointerAngle
  for (let i = 0; i < state.segments.length; i++) {
    const s = state.segments[i];
    let a = norm(s.start + rot);
    let b = norm(s.end + rot);
    const p = norm(pointerAngle);
    if (a <= b) {
      if (p >= a && p <= b) return i;
    } else {
      // 跨越 0
      if (p >= a || p <= b) return i;
    }
  }
  return -1;
}
function norm(a) { return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); }

// 计算颜色相对亮度（0~1），用于决定文字用深色还是白色
function luminance(hex) {
  const c = String(hex).replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// 滴答音效（WebAudio 短促 click）
let audioCtx = null;
function playTick() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.value = 1200;
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.06);
  } catch (e) { /* 静默忽略 */ }
}

// ============ 条目（右侧 - 条目面板） ============
function bindEntries() {
  $('btnAddBulk').addEventListener('click', async () => {
    const list = state.activeList;
    if (!list) { showToast('请先选择或新建名单'); return; }
    const text = $('bulkInput').value;
    if (!text.trim()) { showToast('请输入条目内容'); return; }
    const added = await window.api.entry.addBulk(list.id, text);
    if (added && added.length) {
      $('bulkInput').value = '';
      state.data = await window.api.state.get();
      renderLists();
      renderActiveList();
      renderEntries();
      drawWheel();
      showToast(`已导入 ${added.length} 项`);
    } else {
      showToast('没有有效条目');
    }
  });

  $('btnClearEntries').addEventListener('click', async () => {
    const list = state.activeList;
    if (!list) return;
    if (!list.entries.length) return;
    if (!confirmInline(`确定清空名单「${list.name}」的全部条目？`)) return;
    await window.api.entry.clear(list.id);
    state.data = await window.api.state.get();
    renderLists();
    renderActiveList();
    renderEntries();
    drawWheel();
    showToast('已清空条目');
  });
}

function renderEntries() {
  const wrap = $('entriesContainer');
  const stat = $('entriesStat');
  const list = state.activeList;
  if (!list || !list.entries.length) {
    wrap.innerHTML = '<div class="entries-empty">暂无条目<br>在上方批量输入并导入</div>';
    if (stat) stat.textContent = '';
    return;
  }
  wrap.innerHTML = '';
  list.entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'entry-row';
    const disabled = !entry.enabled;
    row.innerHTML = `
      <span class="entry-color" title="启用/禁用"></span>
      <span class="entry-text" title="双击编辑">${escapeHtml(entry.text)}</span>
      <span class="entry-weight" title="点击修改权重">${entry.weight}×</span>
      <button class="entry-del" title="删除" aria-label="删除条目">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;
    if (disabled) row.style.opacity = '0.45';

    // 启用/禁用切换
    row.querySelector('.entry-color').addEventListener('click', async () => {
      await window.api.entry.update(list.id, entry.id, { enabled: !entry.enabled });
      entry.enabled = !entry.enabled;
      renderActiveList();
      renderEntries();
      drawWheel();
    });

    // 文本编辑（双击）
    const textEl = row.querySelector('.entry-text');
    textEl.addEventListener('dblclick', () => {
      textEl.setAttribute('contenteditable', 'true');
      textEl.focus();
      // 选中全部
      const range = document.createRange();
      range.selectNodeContents(textEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    const commitText = async () => {
      textEl.removeAttribute('contenteditable');
      const newText = textEl.textContent.trim();
      if (newText && newText !== entry.text) {
        await window.api.entry.update(list.id, entry.id, { text: newText });
        entry.text = newText;
        renderActiveList();
        drawWheel();
      } else {
        textEl.textContent = entry.text;
      }
    };
    textEl.addEventListener('blur', commitText);
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); textEl.blur(); }
      if (e.key === 'Escape') { textEl.textContent = entry.text; textEl.blur(); }
    });

    // 权重编辑（点击）
    const weightEl = row.querySelector('.entry-weight');
    weightEl.addEventListener('click', () => {
      weightEl.setAttribute('contenteditable', 'true');
      weightEl.focus();
      const range = document.createRange();
      range.selectNodeContents(weightEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    const commitWeight = async () => {
      weightEl.removeAttribute('contenteditable');
      const raw = weightEl.textContent.replace(/[^\d]/g, '');
      const w = Math.max(1, parseInt(raw, 10) || 1);
      weightEl.textContent = w + '×';
      if (w !== entry.weight) {
        await window.api.entry.update(list.id, entry.id, { weight: w });
        entry.weight = w;
        renderActiveList();
        drawWheel();
      }
    };
    weightEl.addEventListener('blur', commitWeight);
    weightEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); weightEl.blur(); }
      if (e.key === 'Escape') { weightEl.textContent = entry.weight + '×'; weightEl.blur(); }
    });

    // 删除
    row.querySelector('.entry-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.entry.delete(list.id, entry.id);
      state.data = await window.api.state.get();
      renderLists();
      renderActiveList();
      renderEntries();
      drawWheel();
    });

    wrap.appendChild(row);
  });

  if (stat) {
    const total = list.entries.length;
    const enabled = list.entries.filter(e => e.enabled).length;
    stat.textContent = `共 ${total} 项 · 启用 ${enabled}`;
  }
}

// ============ 历史（右侧 - 历史面板） ============
function bindHistory() {
  // tab 切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      $('panel' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.add('active');
    });
  });

  $('btnClearHistory').addEventListener('click', async () => {
    if (!state.data.history.length) return;
    if (!confirmInline('确定清空全部历史记录？')) return;
    await window.api.history.clear();
    state.data.history = [];
    renderHistory();
    showToast('历史已清空');
  });
}

function renderHistory() {
  const wrap = $('historyContainer');
  const countEl = $('historyCount');
  const history = state.data.history || [];
  if (countEl) countEl.textContent = `${history.length} 条记录`;
  if (!history.length) {
    wrap.innerHTML = '<div class="history-empty">暂无抽签记录</div>';
    return;
  }
  wrap.innerHTML = '';
  history.forEach(rec => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const tag = rec.mode === 'remove' ? '不重复' : '普通';
    item.innerHTML = `
      <div class="history-winner">${escapeHtml(rec.winner)}</div>
      <div class="history-meta">
        <span>${escapeHtml(rec.listName || '-')} · ${formatTime(rec.timestamp)}</span>
        <span class="history-tag">${tag}</span>
      </div>
      <button class="history-del" title="删除" style="position:absolute;right:8px;top:8px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:4px;color:var(--text-3);opacity:0;transition:opacity .15s,color .15s;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;
    item.style.position = 'relative';
    item.addEventListener('mouseenter', () => { const d = item.querySelector('.history-del'); if (d) d.style.opacity = '1'; });
    item.addEventListener('mouseleave', () => { const d = item.querySelector('.history-del'); if (d) d.style.opacity = '0'; });
    item.querySelector('.history-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.history.delete(rec.id);
      state.data.history = state.data.history.filter(r => r.id !== rec.id);
      renderHistory();
    });
    wrap.appendChild(item);
  });
}

// ============ 设置 ============
function bindSettings() {
  $('btnSettings').addEventListener('click', () => {
    renderSettingsForm();
    $('settingsModal').hidden = false;
  });
  $('btnCloseSettings').addEventListener('click', () => $('settingsModal').hidden = true);
  $('settingsModal').addEventListener('click', (e) => {
    if (e.target === $('settingsModal')) $('settingsModal').hidden = true;
  });

  $('rangeDuration').addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    $('durationVal').textContent = (v / 1000).toFixed(1) + ' 秒';
  });

  $('btnSaveSettings').addEventListener('click', async () => {
    const patch = {
      spinDuration: parseInt($('rangeDuration').value, 10),
      soundEnabled: $('chkSound').checked,
      excludeWinner: $('chkExclude').checked
    };
    await window.api.settings.update(patch);
    Object.assign(state.data.settings, patch);
    $('settingsModal').hidden = true;
    showToast('设置已保存');
  });
}

function renderSettingsForm() {
  const s = state.data.settings;
  $('rangeDuration').value = s.spinDuration;
  $('durationVal').textContent = (s.spinDuration / 1000).toFixed(1) + ' 秒';
  $('chkSound').checked = !!s.soundEnabled;
  $('chkExclude').checked = !!s.excludeWinner;
}

// ============ 工具函数 ============
function getActive() {
  if (!state.data) return null;
  return state.data.lists.find(l => l.id === state.data.activeListId) || null;
}

function refreshAll() {
  renderLists();
  renderActiveList();
  renderEntries();
  renderHistory();
  renderLeftStats();
  drawWheel();
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function truncate(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Toast
let toastTimer = null;
function bindToast() { /* 占位，避免未定义 */ }
function showToast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  // 强制重排以触发过渡
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 250);
  }, 2000);
}

// 轻量内联确认/输入：用原生 confirm/prompt，简单可靠
function confirmInline(msg) { return window.confirm(msg); }
function promptInline(title, msg, def, current) {
  // title 仅作提示用，prompt 一次只接受一个 message
  const r = window.prompt(msg, def != null ? def : '');
  if (r === null) return null;
  const v = r.trim();
  return v;
}
