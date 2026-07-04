// app.js
// 世界时钟 UI 逻辑 —— 状态管理、渲染、交互
// 依赖 timezone-core.js（提供 TimezoneCore 命名空间）

(function () {
  'use strict';

  const C = window.TimezoneCore;

  // ===== 状态 =====
  const STORAGE_KEY = 'world-clock-state-v1';
  const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';

  let state = loadState();

  function defaultState() {
    return {
      zones: C.DEFAULT_ZONES.slice(),
      workHours: { ...C.DEFAULT_WORK_HOURS },
      sortByTime: false,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      return {
        zones: Array.isArray(s.zones) && s.zones.length ? s.zones : C.DEFAULT_ZONES.slice(),
        workHours: s.workHours || { ...C.DEFAULT_WORK_HOURS },
        sortByTime: !!s.sortByTime,
      };
    } catch (e) { return defaultState(); }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ===== 工具函数 =====
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  function showToast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { t.hidden = true; }, 1400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制：' + text);
    } catch (e) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); showToast('已复制'); } catch (_) { showToast('复制失败'); }
      document.body.removeChild(ta);
    }
  }

  // 时区是否已添加
  function hasZone(tz, city) {
    return state.zones.some(z => z.tz === tz && z.city === city);
  }

  // ===== 顶部本地时钟 =====
  function renderLocalNow() {
    const now = new Date();
    const p = C.getZoneParts(LOCAL_TZ, now);
    $('#localNow').textContent = `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} · ${C.formatInZone(LOCAL_TZ, now, 'MM-DD W')}`;
  }

  // ===== 世界时钟面板 =====
  function renderZones() {
    const grid = $('#zoneGrid');
    grid.innerHTML = '';
    let zones = state.zones.slice();

    // 排序：按时间排序
    if (state.sortByTime) {
      zones.sort((a, b) => C.getHoursInZone(a.tz) - C.getHoursInZone(b.tz));
    }

    $('#zoneCount').textContent = zones.length;

    if (!zones.length) {
      grid.appendChild(el('div', 'modal-empty', '还没有时区，点右上「添加时区」开始'));
      return;
    }

    const now = new Date();
    for (const z of zones) {
      const card = el('div', 'zone-card');
      const p = C.getZoneParts(z.tz, now);
      const offset = C.getOffsetMinutes(z.tz, now);
      const day = C.isDaytime(z.tz, now);
      const localOffset = C.getOffsetMinutes(LOCAL_TZ, now);
      const diffH = (offset - localOffset) / 60;

      card.innerHTML = `
        <button class="icon-btn zc-remove" data-remove="${z.tz}|${z.city}" title="移除">✕</button>
        <div class="zc-head">
          <div class="zc-city">
            <span class="zc-dn">${day ? '☀️' : '🌙'}</span>
            ${z.city}
          </div>
        </div>
        <div class="zc-time">${pad(p.hour)}:${pad(p.minute)}<span class="sec">:${pad(p.second)}</span></div>
        <div class="zc-date">${C.formatInZone(z.tz, now, 'YYYY-MM-DD W')}</div>
        <div class="zc-offset">
          ${C.formatOffset(offset)}
          ${diffH === 0 ? '' : `<span class="zc-diff">${diffH > 0 ? '+' : ''}${diffH}h</span> 与本地`}
        </div>
        <div class="zc-bar"><div class="zc-bar-now" style="left:${(C.getHoursInZone(z.tz, now) / 24 * 100).toFixed(2)}%"></div></div>
      `;
      grid.appendChild(card);
    }

    // 绑定移除
    $$('.zc-remove', grid).forEach(btn => {
      btn.addEventListener('click', () => {
        const [tz, city] = btn.dataset.remove.split('|');
        state.zones = state.zones.filter(z => !(z.tz === tz && z.city === city));
        saveState();
        renderZones();
        renderOverlap();
        populateRefTz();
      });
    });
  }

  // ===== 添加时区弹层 =====
  function openAddModal() {
    $('#addModal').hidden = false;
    $('#zoneSearch').value = '';
    $('#zoneSearch').focus();
    renderZoneList('');
  }
  function closeAddModal() { $('#addModal').hidden = true; }

  function renderZoneList(query) {
    const list = $('#zoneList');
    list.innerHTML = '';
    const q = (query || '').trim().toLowerCase();
    const items = C.COMMON_TIMEZONES.filter(z =>
      !q || z.city.toLowerCase().includes(q) || z.tz.toLowerCase().includes(q) || (z.country || '').toLowerCase().includes(q)
    );
    if (!items.length) {
      list.appendChild(el('div', 'modal-empty', '没有匹配的城市'));
      return;
    }
    for (const z of items) {
      const added = hasZone(z.tz, z.city);
      const it = el('div', 'modal-item' + (added ? ' added' : ''));
      const offset = C.getOffsetMinutes(z.tz);
      it.innerHTML = `
        <div>
          <span class="mi-city">${z.city}</span>
          <span class="mi-country">${z.country || ''}</span>
        </div>
        <span class="mi-tz">${C.formatOffset(offset)} · ${C.formatInZone(z.tz, null, 'HH:mm')}</span>
      `;
      if (!added) {
        it.addEventListener('click', () => {
          state.zones.push({ city: z.city, tz: z.tz });
          saveState();
          renderZones();
          renderOverlap();
          populateRefTz();
          it.classList.add('added');
        });
      }
      list.appendChild(it);
    }
  }

  // ===== 工作时段重叠 =====
  function populateRefTz() {
    for (const selId of ['#refTz', '#histRefTz']) {
      const sel = $(selId);
      const cur = sel.value;
      sel.innerHTML = '';
      const seen = new Set();
      const options = [{ city: '本地', tz: LOCAL_TZ }]
        .concat(state.zones)
        .filter(z => { if (seen.has(z.tz)) return false; seen.add(z.tz); return true; });
      for (const z of options) {
        const o = el('option', null, `${z.city} (${C.formatOffset(C.getOffsetMinutes(z.tz))})`);
        o.value = z.tz;
        if (z.tz === LOCAL_TZ) o.selected = true;
        sel.appendChild(o);
      }
      if (cur) sel.value = cur;
    }
  }

  function renderOverlap() {
    const workHours = { start: +$('#workStart').value || 9, end: +$('#workEnd').value || 18 };
    state.workHours = workHours;
    saveState();

    const refTz = $('#refTz').value || LOCAL_TZ;
    const now = new Date();
    const zones = state.zones.slice();
    const overlap = C.computeOverlap(zones, workHours, now);

    // 摘要
    const summary = $('#overlapSummary');
    if (!overlap.length) {
      summary.innerHTML = `
        <div class="os-title">⚠️ 这些时区的工作时段没有重叠</div>
        <div class="os-empty">无法找到所有人都方便开会的时间，建议调整工作时段或减少时区。</div>
      `;
    } else {
      const slots = overlap.map(r => {
        const startLocal = C.utcMinutesToZoneTime(r.startUTC, refTz, now);
        const endLocal = C.utcMinutesToZoneTime(r.endUTC, refTz, now);
        const durMin = r.fullDay ? 1440 : (r.endUTC - r.startUTC + (r.endUTC < r.startUTC ? 1440 : 0));
        const durH = (durMin / 60).toFixed(durMin % 60 ? 1 : 0);
        return `<span class="os-slot"><b>${startLocal}–${endLocal}</b> · ${durH}h</span>`;
      }).join('');
      summary.innerHTML = `
        <div class="os-title">✅ 全员可开会时段（参考时区：${tzLabel(refTz)}）</div>
        <div>${slots}</div>
      `;
    }

    // 时间刻度
    const scale = $('#tlScale');
    scale.innerHTML = '';
    for (let h = 0; h <= 24; h += 3) {
      scale.appendChild(el('span', null, pad(h) + ':00'));
    }

    // 每个时区的时间条
    const rows = $('#timelineRows');
    rows.innerHTML = '';
    for (const z of zones) {
      const row = el('div', 'tl-row');
      const wh = C.workHoursToUTC(z.tz, workHours, now);
      // 该时区工作时段在参考时区下的起止小时
      const workStartLocal = C.utcMinutesToZoneHour(wh.startUTC, refTz, now);
      const workEndLocal = C.utcMinutesToZoneHour(wh.endUTC, refTz, now);
      // 该时区"夜间"段（18:00-次日6:00 当地）转参考时区
      const nightStartLocal = C.utcMinutesToZoneHour(((18 * 60 - wh.offset) % 1440 + 1440) % 1440, refTz, now);

      const bars = [];
      // 夜间背景段（白天之外的非工作时段，淡灰）
      // 为简化：画工作段（蓝）+ 重叠段（绿）覆盖，其余为夜间色
      bars.push(`<div class="tl-seg night" style="left:0;width:100%"></div>`);

      // 工作时段条（处理跨天）
      const workBars = barSegments(workStartLocal, workEndLocal, 'work');
      bars.push(...workBars);

      // 重叠段（绿）
      for (const r of overlap) {
        const os = C.utcMinutesToZoneHour(r.startUTC, refTz, now);
        const oe = C.utcMinutesToZoneHour(r.endUTC, refTz, now);
        bars.push(...barSegments(os, oe, 'overlap'));
      }

      // 当前时刻线
      const nowH = C.getHoursInZone(refTz, now);
      const nowLine = `<div class="tl-now-line" style="left:${(nowH / 24 * 100).toFixed(2)}%" title="现在"></div>`;

      row.innerHTML = `
        <div class="tl-name">${z.city}<small>${C.formatOffset(C.getOffsetMinutes(z.tz, now))}</small></div>
        <div class="tl-bar">${bars.join('')}${nowLine}</div>
      `;
      rows.appendChild(row);
    }
  }

  // 生成 [startH, endH]（0-24，可能跨天）的百分比条段
  function barSegments(startH, endH, cls) {
    const segs = [];
    if (startH < endH) {
      segs.push(`<div class="tl-seg ${cls}" style="left:${(startH / 24 * 100).toFixed(2)}%;width:${((endH - startH) / 24 * 100).toFixed(2)}%"></div>`);
    } else if (startH > endH) {
      segs.push(`<div class="tl-seg ${cls}" style="left:${(startH / 24 * 100).toFixed(2)}%;width:${((24 - startH) / 24 * 100).toFixed(2)}%"></div>`);
      segs.push(`<div class="tl-seg ${cls}" style="left:0;width:${(endH / 24 * 100).toFixed(2)}%"></div>`);
    }
    return segs;
  }

  function tzLabel(tz) {
    const z = state.zones.find(z => z.tz === tz);
    if (z) return z.city;
    if (tz === LOCAL_TZ) return '本地';
    return tz;
  }

  // ===== 时间戳转换 =====
  function renderTimestamp() {
    const input = $('#tsInput').value.trim();
    const meta = $('#tsMeta');
    const tbody = $('#tsResult tbody');
    tbody.innerHTML = '';
    if (!input) {
      meta.innerHTML = '<span class="err">请输入 Unix 时间戳或 ISO 字符串</span>';
      return;
    }

    let date = null;
    let kind = '';
    // 尝试数字
    const num = Number(input);
    if (!isNaN(num) && /^\d+$/.test(input)) {
      const ms = input.length > 10 ? num : num * 1000;
      date = new Date(ms);
      kind = input.length > 10 ? '毫秒时间戳' : '秒时间戳';
    } else {
      // 尝试 ISO / 日期字符串
      const d = new Date(input);
      if (!isNaN(d.getTime())) { date = d; kind = '日期字符串'; }
    }

    if (!date || isNaN(date.getTime())) {
      meta.innerHTML = '<span class="err">无法解析输入，请检查格式</span>';
      return;
    }

    const utcStr = C.formatInZone('UTC', date, 'YYYY-MM-DD HH:mm:ss');
    meta.innerHTML = `<b>${kind}</b> · UTC ${utcStr} · Unix ${Math.floor(date.getTime() / 1000)}`;

    // 各时区结果
    const zones = uniqZones(state.zones);
    for (const z of zones) {
      const tr = el('tr');
      tr.innerHTML = `
        <td class="col-city">${z.city}</td>
        <td class="col-tz">${z.tz}</td>
        <td>${C.formatInZone(z.tz, date, 'YYYY-MM-DD')}</td>
        <td class="col-time">${C.formatInZone(z.tz, date, 'HH:mm:ss')}</td>
        <td>${C.formatInZone(z.tz, date, 'W')}</td>
        <td><button class="copy-btn" data-copy="${C.formatInZone(z.tz, date, 'YYYY-MM-DD HH:mm:ss')}">复制</button></td>
      `;
      tbody.appendChild(tr);
    }
    // 本地也加一行
    const tr = el('tr');
    tr.innerHTML = `
      <td class="col-city">本地</td>
      <td class="col-tz">${LOCAL_TZ}</td>
      <td>${C.formatInZone(LOCAL_TZ, date, 'YYYY-MM-DD')}</td>
      <td class="col-time">${C.formatInZone(LOCAL_TZ, date, 'HH:mm:ss')}</td>
      <td>${C.formatInZone(LOCAL_TZ, date, 'W')}</td>
      <td><button class="copy-btn" data-copy="${C.formatInZone(LOCAL_TZ, date, 'YYYY-MM-DD HH:mm:ss')}">复制</button></td>
    `;
    tbody.appendChild(tr);

    $$('.copy-btn', tbody).forEach(b => {
      b.addEventListener('click', () => copyText(b.dataset.copy));
    });
  }

  // ===== 历史回溯 =====
  function renderHistory() {
    const refTz = $('#histRefTz').value || LOCAL_TZ;
    const value = $('#histInput').value;
    const tbody = $('#histResult tbody');
    tbody.innerHTML = '';

    if (!value) {
      tbody.appendChild(el('tr', null, '<td colspan="6" style="text-align:center;color:var(--text-3);padding:24px">请选择一个日期时间</td>'));
      return;
    }

    const date = C.parseLocalInput(value, refTz);
    if (!date || isNaN(date.getTime())) {
      tbody.appendChild(el('tr', null, '<td colspan="6" style="text-align:center;color:var(--red);padding:24px">无法解析时间</td>'));
      return;
    }

    const refOffset = C.getOffsetMinutes(refTz, date);
    const zones = uniqZones(state.zones);
    for (const z of zones) {
      const diff = (C.getOffsetMinutes(z.tz, date) - refOffset) / 60;
      const diffStr = diff === 0 ? '同' : (diff > 0 ? `+${diff}h` : `${diff}h`);
      const tr = el('tr');
      tr.innerHTML = `
        <td class="col-city">${z.city}</td>
        <td class="col-tz">${z.tz}</td>
        <td>${C.formatInZone(z.tz, date, 'YYYY-MM-DD')}</td>
        <td class="col-time">${C.formatInZone(z.tz, date, 'HH:mm:ss')}</td>
        <td>${C.formatInZone(z.tz, date, 'W')}</td>
        <td style="color:${diff === 0 ? 'var(--text-3)' : 'var(--blue)'};font-weight:500">${diffStr}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function uniqZones(zones) {
    const seen = new Set();
    const out = [];
    for (const z of zones) {
      const k = z.tz + '|' + z.city;
      if (seen.has(k)) continue;
      seen.add(k); out.push(z);
    }
    return out;
  }

  // ===== tab 切换 =====
  function switchTab(name) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  }

  // ===== 初始化 =====
  function init() {
    // hash 路由：#clock #overlap #timestamp #history
    const hashTab = (location.hash || '').replace('#', '');
    if (['clock', 'overlap', 'timestamp', 'history'].includes(hashTab)) {
      switchTab(hashTab);
    }

    // 还原工作时段输入
    $('#workStart').value = state.workHours.start;
    $('#workEnd').value = state.workHours.end;

    populateRefTz();

    // 历史回溯默认填当前参考时区时间
    const now = new Date();
    $('#histInput').value = C.formatInZone(LOCAL_TZ, now, 'YYYY-MM-DD') + 'T' + C.formatInZone(LOCAL_TZ, now, 'HH:mm');

    renderLocalNow();
    renderZones();
    renderOverlap();
    renderTimestamp();
    renderHistory();

    // 事件绑定
    $$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    $('#btnAdd').addEventListener('click', openAddModal);
    $('#btnCloseModal').addEventListener('click', closeAddModal);
    $('#addModal').addEventListener('click', (e) => { if (e.target.id === 'addModal') closeAddModal(); });
    $('#zoneSearch').addEventListener('input', (e) => renderZoneList(e.target.value));

    $('#btnSort').addEventListener('click', () => {
      state.sortByTime = !state.sortByTime;
      saveState();
      renderZones();
      $('#btnSort').textContent = state.sortByTime ? '↕ 按时间' : '↕ 排序';
    });

    $('#workStart').addEventListener('input', renderOverlap);
    $('#workEnd').addEventListener('input', renderOverlap);
    $('#refTz').addEventListener('change', renderOverlap);

    $('#tsInput').addEventListener('input', renderTimestamp);
    $('#btnTsNow').addEventListener('click', () => {
      $('#tsInput').value = Math.floor(Date.now() / 1000);
      renderTimestamp();
    });

    $('#histInput').addEventListener('input', renderHistory);
    $('#histRefTz').addEventListener('change', renderHistory);
    $('#btnHistNow').addEventListener('click', () => {
      const n = new Date();
      const tz = $('#histRefTz').value || LOCAL_TZ;
      $('#histInput').value = C.formatInZone(tz, n, 'YYYY-MM-DD') + 'T' + C.formatInZone(tz, n, 'HH:mm');
      renderHistory();
    });

    // ESC 关闭弹层
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#addModal').hidden) closeAddModal();
    });

    // 每秒刷新世界时钟
    setInterval(() => {
      renderLocalNow();
      if ($('.panel.active').dataset.panel === 'clock') renderZones();
      if ($('.panel.active').dataset.panel === 'overlap') renderOverlap();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
