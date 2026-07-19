// 渲染进程：UI 交互 + 图表绘制
'use strict';

(function () {
  const calc = window.calc;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const state = {
    tab: 'commercial',
    method: 'equalInstallment',
    combinedMethod: 'equalInstallment',
    prepayMode: 'reduceTerm',
    lastSchedule: null,
    lastResult: null
  };

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.tab = tab.dataset.tab;
      $$('.form').forEach(f => f.classList.remove('active'));
      if (state.tab === 'commercial' || state.tab === 'fund') {
        $('#form-single').classList.add('active');
        $('#rate').value = state.tab === 'fund' ? '3.1' : '4.2';
        $('#form-hint').textContent = state.tab === 'fund' ? '公积金贷款（利率参考 3.10%）' : '商业贷款（参考 LPR 4.20%）';
      } else if (state.tab === 'combined') {
        $('#form-combined').classList.add('active');
        $('#form-hint').textContent = '组合贷款：商贷 + 公积金';
      } else if (state.tab === 'prepay') {
        $('#form-prepay').classList.add('active');
        $('#form-hint').textContent = '基于商业贷款参数测算提前还款';
      }
    });
  });

  $$('[data-method]').forEach(btn => btn.addEventListener('click', () => {
    $$('[data-method]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.method = btn.dataset.method;
  }));
  $$('[data-c-method]').forEach(btn => btn.addEventListener('click', () => {
    $$('[data-c-method]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.combinedMethod = btn.dataset.cMethod;
  }));
  $$('[data-prepay-mode]').forEach(btn => btn.addEventListener('click', () => {
    $$('[data-prepay-mode]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.prepayMode = btn.dataset.prepayMode;
  }));

  $$('.quick [data-set]').forEach(btn => btn.addEventListener('click', () => $('#principal').value = btn.dataset.set));
  $$('.quick [data-rate]').forEach(btn => btn.addEventListener('click', () => $('#rate').value = btn.dataset.rate));
  $$('.quick [data-year]').forEach(btn => btn.addEventListener('click', () => $('#years').value = btn.dataset.year));

  function showResult(result, monthlyLabel) {
    state.lastResult = result;
    state.lastSchedule = result.schedule;

    const monthly = result.monthlyPayment || result.monthlyPaymentFirst;
    $('#m-monthly').textContent = fmt(monthly);
    $('#m-monthly-foot').textContent = monthlyLabel || '元 / 月';
    if (result.monthlyPaymentFirst && result.monthlyPaymentLast && result.monthlyPaymentFirst !== result.monthlyPaymentLast) {
      $('#m-monthly-foot').textContent = `首月 ${fmt(result.monthlyPaymentFirst)} → 末月 ${fmt(result.monthlyPaymentLast)}`;
    }
    $('#m-interest').textContent = fmt(result.totalInterest);
    $('#m-total').textContent = fmt(result.totalPayment);
    const ratio = result.totalPayment > 0 ? (result.totalInterest / result.totalPayment * 100) : 0;
    $('#m-ratio').textContent = ratio.toFixed(1);

    $('#result-sub').textContent = '已更新 · ' + new Date().toLocaleTimeString('zh-CN');

    drawPieChart(result.totalPrincipal || (result.totalPayment - result.totalInterest), result.totalInterest);
    drawLineChart(result.schedule);
    renderTable(result.schedule);
  }

  function drawPieChart(principal, interest) {
    const total = principal + interest;
    if (total <= 0) { $('#chart-pie').innerHTML = ''; return; }
    const pRatio = principal / total;
    const iRatio = interest / total;

    const cx = 90, cy = 80, r = 60, ir = 38;
    const pStartAngle = -Math.PI / 2;
    const pEndAngle = pStartAngle + 2 * Math.PI * pRatio;
    const iStartAngle = pEndAngle;
    const iEndAngle = pStartAngle + 2 * Math.PI;

    function arcPath(start, end, rOuter, rInner) {
      const x1 = cx + rOuter * Math.cos(start);
      const y1 = cy + rOuter * Math.sin(start);
      const x2 = cx + rOuter * Math.cos(end);
      const y2 = cy + rOuter * Math.sin(end);
      const x3 = cx + rInner * Math.cos(end);
      const y3 = cy + rInner * Math.sin(end);
      const x4 = cx + rInner * Math.cos(start);
      const y4 = cy + rInner * Math.sin(start);
      const large = (end - start) > Math.PI ? 1 : 0;
      return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
    }

    const html = `
      <svg viewBox="0 0 180 160" preserveAspectRatio="xMidYMid meet">
        <path d="${arcPath(pStartAngle, pEndAngle, r, ir)}" fill="#007aff"/>
        <path d="${arcPath(iStartAngle, iEndAngle, r, ir)}" fill="#ff9500"/>
        <text x="90" y="76" text-anchor="middle" font-size="11" fill="#8e8e93">本金占比</text>
        <text x="90" y="92" text-anchor="middle" font-size="14" font-weight="600" fill="#1d1d1f">${(pRatio * 100).toFixed(1)}%</text>
        <text x="20" y="150" font-size="11" fill="#1d1d1f">本金 ${(pRatio * 100).toFixed(1)}%</text>
        <text x="120" y="150" font-size="11" fill="#1d1d1f">利息 ${(iRatio * 100).toFixed(1)}%</text>
      </svg>
    `;
    $('#chart-pie').innerHTML = html;
  }

  function drawLineChart(schedule) {
    if (!schedule || schedule.length === 0) { $('#chart-line').innerHTML = ''; return; }
    const w = 600, h = 180, padL = 50, padR = 20, padT = 16, padB = 28;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const maxPeriod = schedule.length;
    const maxRemaining = Math.max(...schedule.map(s => s.remaining), 1);

    const points = schedule.map((s, i) => {
      const x = padL + (i / (maxPeriod - 1)) * innerW;
      const y = padT + innerH - (s.remaining / maxRemaining) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const step = Math.max(1, Math.floor(points.length / 200));
    const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    const polylinePoints = sampled.join(' ');

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => {
      const y = padT + innerH - t * innerH;
      const val = t * maxRemaining;
      return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(0,0,0,0.05)" stroke-width="1"/>
              <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="12" font-weight="500" fill="#6e6e73">${val >= 10000 ? (val / 10000).toFixed(0) + '万' : val.toFixed(0)}</text>`;
    }).join('');

    const years = Math.ceil(maxPeriod / 12);
    const xTicks = [];
    const yearStep = Math.max(1, Math.ceil(years / 6));
    for (let y = 0; y <= years; y += yearStep) {
      const period = y * 12;
      const x = padL + (period / (maxPeriod - 1)) * innerW;
      xTicks.push(`<text x="${x}" y="${h - 6}" text-anchor="middle" font-size="12" font-weight="500" fill="#6e6e73">${y}年</text>`);
    }

    const html = `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
        ${yTicks}
        ${xTicks.join('')}
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#34c759" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#34c759" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polygon points="${padL},${padT + innerH} ${polylinePoints} ${padL + innerW},${padT + innerH}" fill="url(#lineGrad)"/>
        <polyline points="${polylinePoints}" fill="none" stroke="#34c759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    $('#chart-line').innerHTML = html;
  }

  function renderTable(schedule) {
    const tbody = $('#schedule-body');
    tbody.innerHTML = '';
    if (!schedule || schedule.length === 0) { $('#table-sub').textContent = '无数据'; return; }

    const years = {};
    schedule.forEach(s => {
      const y = Math.ceil(s.period / 12);
      if (!years[y]) years[y] = { year: y, monthly: 0, principal: 0, interest: 0, endRemaining: 0, rows: [] };
      years[y].monthly += s.monthlyPayment;
      years[y].principal += s.principalPart;
      years[y].interest += s.interestPart;
      years[y].endRemaining = s.remaining;
      years[y].rows.push(s);
    });

    Object.values(years).forEach(yg => {
      const yearRow = document.createElement('tr');
      yearRow.className = 'year-row';
      yearRow.innerHTML = `<td>第 ${yg.year} 年</td>
        <td>${fmt(yg.monthly)}</td>
        <td>${fmt(yg.principal)}</td>
        <td>${fmt(yg.interest)}</td>
        <td>${fmt(yg.endRemaining)}</td>`;
      yearRow.addEventListener('click', () => {
        yearRow.classList.toggle('expanded');
        let next = yearRow.nextSibling;
        while (next && !next.classList.contains('year-row')) {
          if (next.classList && next.classList.contains('month-row')) {
            next.style.display = next.style.display === 'none' ? '' : 'none';
          }
          next = next.nextSibling;
        }
      });
      tbody.appendChild(yearRow);

      yg.rows.forEach(s => {
        const row = document.createElement('tr');
        row.className = 'month-row';
        row.style.display = 'none';
        if (s.prepaid !== undefined) {
          row.classList.add('prepay-row');
          row.innerHTML = `<td>第 ${s.period} 期 ★</td>
            <td>${fmt(s.monthlyPayment)}</td>
            <td>${fmt(s.principalPart)}（提前 ${fmt(s.prepaid)}）</td>
            <td>${fmt(s.interestPart)}</td>
            <td>${fmt(s.remainingAfterPrepay !== undefined ? s.remainingAfterPrepay : s.remaining)}</td>`;
        } else {
          row.innerHTML = `<td>第 ${s.period} 期</td>
            <td>${fmt(s.monthlyPayment)}</td>
            <td>${fmt(s.principalPart)}</td>
            <td>${fmt(s.interestPart)}</td>
            <td>${fmt(s.remaining)}</td>`;
        }
        tbody.appendChild(row);
      });
    });

    $('#table-sub').textContent = `共 ${schedule.length} 期 · 按年折叠`;
  }

  function calcSingle() {
    const principal = parseFloat($('#principal').value) * 10000;
    const rate = parseFloat($('#rate').value);
    const years = parseInt($('#years').value);
    if (!(principal > 0) || !(years > 0)) { $('#result-sub').textContent = '请检查输入'; return; }
    const result = state.method === 'equalInstallment'
      ? calc.equalInstallment(principal, rate, years)
      : calc.equalPrincipal(principal, rate, years);
    result.totalPrincipal = principal;
    showResult(result, state.method === 'equalInstallment' ? '元 / 月（固定）' : '元 / 月（递减）');
  }

  function calcCombined() {
    const cp = parseFloat($('#c-principal').value) * 10000;
    const cr = parseFloat($('#c-rate').value);
    const fp = parseFloat($('#f-principal').value) * 10000;
    const fr = parseFloat($('#f-rate').value);
    const years = parseInt($('#combined-years').value);
    if (!(cp + fp > 0) || !(years > 0)) { $('#result-sub').textContent = '请检查输入'; return; }
    const result = calc.combinedLoan({
      commercialPrincipal: cp, commercialRate: cr,
      fundPrincipal: fp, fundRate: fr,
      years: years, method: state.combinedMethod
    });
    result.totalPrincipal = cp + fp;
    showResult(result, state.combinedMethod === 'equalInstallment' ? '元 / 月（固定）' : '元 / 月（递减）');
  }

  function calcPrepay() {
    const principal = parseFloat($('#principal').value) * 10000;
    const rate = parseFloat($('#rate').value);
    const years = parseInt($('#years').value);
    const prepayMonth = parseInt($('#prepay-month').value);
    const prepayAmount = parseFloat($('#prepay-amount').value) * 10000;
    if (!(principal > 0) || !(years > 0) || !(prepayAmount > 0)) { $('#result-sub').textContent = '请检查输入'; return; }
    const original = state.method === 'equalInstallment'
      ? calc.equalInstallment(principal, rate, years)
      : calc.equalPrincipal(principal, rate, years);
    if (prepayMonth > original.schedule.length) { $('#result-sub').textContent = '提前还款期次超出原还款期限'; return; }
    const r = calc.prepayment({
      originalSchedule: original.schedule, prepayMonth,
      prepayAmount, annualRate: rate, mode: state.prepayMode
    });
    const result = {
      schedule: r.newSchedule,
      totalPayment: original.totalPayment - r.savedInterest,
      totalInterest: original.totalInterest - r.savedInterest,
      totalPrincipal: principal,
      monthlyPayment: r.newMonthlyPayment,
      savedInterest: r.savedInterest,
      newTermMonths: r.newTermMonths,
      paidOff: r.paidOff
    };
    showResult(result, r.paidOff ? '已还清' : (state.prepayMode === 'reduceTerm' ? '元 / 月（月供不变，年限缩短）' : `元 / 月（减少月供，新月供 ${fmt(r.newMonthlyPayment)}）`));
    $('#result-sub').textContent = `节省利息 ${fmt(r.savedInterest)} 元 · 原利息 ${fmt(original.totalInterest)} → 新利息 ${fmt(result.totalInterest)} · 新期限 ${r.newTermMonths} 期`;
  }

  async function exportCsv() {
    if (!state.lastSchedule) { alert('请先计算'); return; }
    const csv = calc.scheduleToCSV(state.lastSchedule);
    const name = `还款计划_${new Date().toISOString().slice(0, 10)}.csv`;
    if (window.api && window.api.exportCsv) {
      const r = await window.api.exportCsv(csv, name);
      if (r.ok) alert('已保存：' + r.path);
      else if (r.error) alert('保存失败：' + r.error);
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
    }
  }

  $('#btn-calc').addEventListener('click', calcSingle);
  $('#btn-calc-combined').addEventListener('click', calcCombined);
  $('#btn-calc-prepay').addEventListener('click', calcPrepay);
  $('#btn-export').addEventListener('click', exportCsv);
  $('#btn-export-combined').addEventListener('click', exportCsv);
  $('#btn-export-prepay').addEventListener('click', exportCsv);

  $('#link-afdian').addEventListener('click', (e) => {
    e.preventDefault();
    if (window.api && window.api.openExternal) {
      window.api.openExternal('https://www.ifdian.net/a/giquwei');
    }
  });

  $('#principal').addEventListener('keydown', e => { if (e.key === 'Enter') calcSingle(); });
  $('#rate').addEventListener('keydown', e => { if (e.key === 'Enter') calcSingle(); });
  $('#years').addEventListener('keydown', e => { if (e.key === 'Enter') calcSingle(); });

  calcSingle();
})();
