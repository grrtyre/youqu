// 网络管家 - 渲染层逻辑
(function () {
const api = window.api;

// ===== 工具切换 =====
const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.panel');
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const tool = item.dataset.tool;
    navItems.forEach((n) => n.classList.remove('active'));
    item.classList.add('active');
    panels.forEach((p) => p.classList.remove('active'));
    document.getElementById('panel-' + tool).classList.add('active');
  });
});

// ===== Toast =====
const toastEl = document.getElementById('toast');
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

// ===== 加载/错误状态 =====
function setLoading(el, text) {
  el.innerHTML = `<div class="result-loading"><div class="spinner"></div><div>${text || '正在诊断…'}</div></div>`;
}
function setError(el, msg) {
  el.innerHTML = `<div class="result-error"><span>⚠️</span><span>${escapeHtml(msg)}</span></div>`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== Ping =====
const pingRun = document.getElementById('ping-run');
pingRun.addEventListener('click', async () => {
  const host = document.getElementById('ping-host').value.trim();
  const count = document.getElementById('ping-count').value;
  if (!host) { toast('请输入主机名或 IP'); return; }
  if (!api.isValidHost(host)) { toast('无效的主机名或 IP'); return; }
  const resultEl = document.getElementById('ping-result');
  setLoading(resultEl, `正在 Ping ${host} …`);
  pingRun.disabled = true;
  try {
    const res = await api.ping(host, count);
    if (!res.ok) { setError(resultEl, res.msg); }
    else { renderPing(resultEl, res.result, host); refreshHistory(); }
  } catch (e) {
    setError(resultEl, e.message);
  } finally {
    pingRun.disabled = false;
  }
});

function renderPing(el, r, host) {
  if (r.sent === 0) {
    el.innerHTML = `<div class="result-error"><span>⚠️</span><span>未收到任何响应，请检查主机名或网络</span></div>`;
    return;
  }
  const maxTime = Math.max(...r.samples.map((s) => s.time), 1);
  // Y 轴刻度：向上取整到 30 的倍数，三等分出整齐刻度
  const yMax = Math.max(30, Math.ceil(maxTime / 30) * 30);
  const ySteps = [yMax, Math.round(yMax * 2 / 3), Math.round(yMax / 3), 0];
  const yaxis = ySteps.map((v) => `<span>${v}ms</span>`).join('');
  const bars = r.samples.map((s, i) => {
    const h = Math.max((s.time / yMax) * 100, 6);
    const color = api.latencyColor(s.time);
    return `<div class="bar-wrap">
      <span class="bar-value-top">${s.time}ms</span>
      <div class="bar" style="height:${h}%;background:linear-gradient(180deg, ${color}dd, ${color})"></div>
      <div class="bar-label">#${i + 1}</div>
    </div>`;
  }).join('');
  const rows = r.samples.map((s, i) => `
    <tr>
      <td>#${i + 1}</td>
      <td>${escapeHtml(s.ip || host)}</td>
      <td><span class="tag ${s.time < 50 ? 'green' : s.time < 100 ? 'blue' : s.time < 200 ? 'orange' : 'red'}">${s.time} ms</span></td>
      <td>${s.ttl}</td>
      <td>${s.bytes} B</td>
    </tr>`).join('');
  el.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="sc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></div>
        <div class="sc-body"><div class="sc-value">${r.sent}</div><div class="sc-label">已发送</div></div>
      </div>
      <div class="stat-card">
        <div class="sc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l5 5L20 5"/></svg></div>
        <div class="sc-body"><div class="sc-value sc-green">${r.received}</div><div class="sc-label">已接收</div></div>
      </div>
      <div class="stat-card">
        <div class="sc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div>
        <div class="sc-body"><div class="sc-value ${r.loss === 0 ? 'sc-green' : r.loss < 50 ? 'sc-orange' : 'sc-red'}">${r.loss}%</div><div class="sc-label">丢包率</div></div>
      </div>
      <div class="stat-card sc-highlight">
        <div class="sc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
        <div class="sc-body"><div class="sc-value sc-blue">${r.avg}<span style="font-size:14px;color:var(--text-2)"> ms</span></div><div class="sc-label">平均延迟</div></div>
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-title">
        <span>延迟分布</span>
        <div class="legend">
          <span><i style="background:#34c759"></i>&lt;50ms</span>
          <span><i style="background:#007aff"></i>&lt;100ms</span>
          <span><i style="background:#ff9500"></i>&lt;200ms</span>
          <span><i style="background:#ff3b30"></i>&ge;200ms</span>
        </div>
      </div>
      <div class="chart-body">
        <div class="chart-yaxis">${yaxis}</div>
        <div class="bar-chart">${bars}</div>
      </div>
    </div>
    <table class="detail-table">
      <thead><tr><th>序号</th><th>来源 IP</th><th>延迟</th><th>TTL</th><th>字节</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="ping-summary">
      <div class="ps-item"><span class="ps-label">最小</span><span class="ps-value">${r.min || '—'} ms</span></div>
      <div class="ps-divider"></div>
      <div class="ps-item"><span class="ps-label">最大</span><span class="ps-value">${r.max || '—'} ms</span></div>
      <div class="ps-divider"></div>
      <div class="ps-item"><span class="ps-label">平均</span><span class="ps-value">${r.avg || '—'} ms</span></div>
      <div class="ps-divider"></div>
      <div class="ps-item"><span class="ps-label">抖动</span><span class="ps-value">${(r.max - r.min) || 0} ms</span></div>
      <div class="ps-divider"></div>
      <div class="ps-item"><span class="ps-label">目标</span><span class="ps-value" style="font-family:'SF Mono','Consolas',monospace;font-size:12px">${escapeHtml(host)}</span></div>
    </div>`;
}

// ===== Traceroute =====
document.getElementById('tracert-run').addEventListener('click', async () => {
  const host = document.getElementById('tracert-host').value.trim();
  const hops = document.getElementById('tracert-hops').value;
  if (!host) { toast('请输入主机名或 IP'); return; }
  if (!api.isValidHost(host)) { toast('无效的主机名或 IP'); return; }
  const el = document.getElementById('tracert-result');
  setLoading(el, `正在追踪到 ${host} 的路由…`);
  const btn = document.getElementById('tracert-run');
  btn.disabled = true;
  try {
    const res = await api.tracert(host, hops);
    if (!res.ok) setError(el, res.msg);
    else renderTracert(el, res.hops, host);
    refreshHistory();
  } catch (e) { setError(el, e.message); }
  finally { btn.disabled = false; }
});

function renderTracert(el, hops, host) {
  if (hops.length === 0) {
    el.innerHTML = `<div class="result-error"><span>⚠️</span><span>未追踪到任何路由节点</span></div>`;
    return;
  }
  const items = hops.map((h) => {
    const times = h.times.map((t) => t === null
      ? `<span class="hop-time timeout">超时</span>`
      : `<span class="hop-time">${t} ms</span>`).join('');
    return `<div class="hop-item">
      <div class="hop-num">${h.hop}</div>
      <div class="hop-host">
        <div class="hh-name">${escapeHtml(h.host || '(匿名)')}</div>
        <div class="hh-ip">${escapeHtml(h.ip || '')}</div>
      </div>
      <div class="hop-times">${times}</div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="hop-list">${items}</div>`;
}

// ===== DNS =====
document.getElementById('dns-run').addEventListener('click', async () => {
  const domain = document.getElementById('dns-domain').value.trim();
  const type = document.getElementById('dns-type').value;
  if (!domain) { toast('请输入域名'); return; }
  if (!api.isValidDomain(domain)) { toast('无效的域名'); return; }
  const el = document.getElementById('dns-result');
  setLoading(el, `正在查询 ${domain} 的 ${type} 记录…`);
  const btn = document.getElementById('dns-run');
  btn.disabled = true;
  try {
    const res = await api.dns(domain, type);
    if (!res.ok) setError(el, res.msg);
    else renderDns(el, res.records, domain, type);
    refreshHistory();
  } catch (e) { setError(el, e.message); }
  finally { btn.disabled = false; }
});

function renderDns(el, records, domain, type) {
  if (records.length === 0) {
    el.innerHTML = `<div class="result-error"><span>⚠️</span><span>未找到 ${escapeHtml(domain)} 的 ${type} 记录</span></div>`;
    return;
  }
  const items = records.map((r) => {
    const t = (r.type || 'A').toLowerCase();
    return `<div class="record-item">
      <div class="record-type ${t}">${escapeHtml(r.type || type)}</div>
      <div class="record-addr">${escapeHtml(r.address)}</div>
      ${r.preference != null ? `<div class="record-pref">优先级 ${r.preference}</div>` : ''}
      ${r.name ? `<div class="record-pref">${escapeHtml(r.name)}</div>` : ''}
    </div>`;
  }).join('');
  el.innerHTML = `<div class="record-list">${items}</div>`;
}

// ===== Port Check =====
document.getElementById('port-run').addEventListener('click', async () => {
  const host = document.getElementById('port-host').value.trim();
  const port = document.getElementById('port-port').value.trim();
  const timeout = document.getElementById('port-timeout').value;
  if (!host) { toast('请输入主机名或 IP'); return; }
  if (!api.isValidHost(host)) { toast('无效的主机名或 IP'); return; }
  if (!api.isValidPort(port)) { toast('端口号需为 1-65535 的整数'); return; }
  const el = document.getElementById('port-result');
  setLoading(el, `正在检测 ${host}:${port} …`);
  const btn = document.getElementById('port-run');
  btn.disabled = true;
  try {
    const res = await api.portCheck(host, port, timeout);
    if (!res.ok) setError(el, res.msg);
    else renderPort(el, res, host, port);
    refreshHistory();
  } catch (e) { setError(el, e.message); }
  finally { btn.disabled = false; }
});

function renderPort(el, res, host, port) {
  const ok = res.reachable;
  const reasonText = ok ? '' : `（${res.reason === 'timeout' ? '连接超时' : escapeHtml(res.reason || '拒绝')}）`;
  el.innerHTML = `<div class="port-result-card ${ok ? 'ok' : 'fail'}">
    <div class="port-icon">${ok ? '✓' : '✕'}</div>
    <div class="port-info">
      <div class="pi-status">${ok ? '端口开放' : '端口不可达'} ${reasonText}</div>
      <div class="pi-detail">${escapeHtml(host)}:${escapeHtml(port)} · 耗时 ${res.elapsed} ms</div>
    </div>
  </div>`;
}

// ===== HTTP Headers =====
document.getElementById('http-run').addEventListener('click', async () => {
  const urlStr = document.getElementById('http-url').value.trim();
  if (!urlStr) { toast('请输入 URL'); return; }
  const el = document.getElementById('http-result');
  setLoading(el, `正在获取 ${urlStr} 的响应头…`);
  const btn = document.getElementById('http-run');
  btn.disabled = true;
  try {
    const res = await api.httpHeaders(urlStr);
    if (!res.ok) setError(el, res.msg);
    else renderHttp(el, res, urlStr);
    refreshHistory();
  } catch (e) { setError(el, e.message); }
  finally { btn.disabled = false; }
});

function renderHttp(el, res, url) {
  const status = res.status;
  let cls = 'green';
  if (status >= 400) cls = 'red';
  else if (status >= 300) cls = 'orange';
  const rows = res.headers.map((h) => `
    <div class="header-item">
      <div class="hk">${escapeHtml(h.key)}</div>
      <div class="hv">${escapeHtml(h.value)}</div>
    </div>`).join('');
  el.innerHTML = `
    <div class="http-status ${cls}">
      <div class="hs-code">${status}</div>
      <div class="hs-text">${escapeHtml(res.statusText || '')}</div>
      <div class="hs-time">${res.elapsed} ms</div>
    </div>
    <div class="header-list">${rows}</div>`;
}

// ===== Whois =====
document.getElementById('whois-run').addEventListener('click', async () => {
  const domain = document.getElementById('whois-domain').value.trim();
  if (!domain) { toast('请输入域名'); return; }
  if (!api.isValidDomain(domain)) { toast('无效的域名'); return; }
  const el = document.getElementById('whois-result');
  setLoading(el, `正在查询 ${domain} 的 Whois 信息…`);
  const btn = document.getElementById('whois-run');
  btn.disabled = true;
  try {
    const res = await api.whois(domain);
    if (!res.ok) setError(el, res.msg);
    else renderWhois(el, res.info, domain);
    refreshHistory();
  } catch (e) { setError(el, e.message); }
  finally { btn.disabled = false; }
});

function renderWhois(el, info, domain) {
  const ns = info.nameServers.length
    ? `<div class="whois-ns">${info.nameServers.map((n) => `<span class="ns-chip">${escapeHtml(n)}</span>`).join('')}</div>`
    : '<span style="color:var(--text-3)">—</span>';
  el.innerHTML = `
    <div class="whois-grid">
      <div class="whois-field"><div class="wf-label">域名</div><div class="wf-value">${escapeHtml(domain)}</div></div>
      <div class="whois-field"><div class="wf-label">注册商</div><div class="wf-value">${escapeHtml(info.registrar || '—')}</div></div>
      <div class="whois-field"><div class="wf-label">注册时间</div><div class="wf-value">${escapeHtml(info.createdDate || '—')}</div></div>
      <div class="whois-field"><div class="wf-label">到期时间</div><div class="wf-value">${escapeHtml(info.expiryDate || '—')}</div></div>
      <div class="whois-field"><div class="wf-label">更新时间</div><div class="wf-value">${escapeHtml(info.updatedDate || '—')}</div></div>
      <div class="whois-field"><div class="wf-label">域名服务器</div><div class="wf-value">${ns}</div></div>
    </div>
    <div class="raw-block"><pre>${escapeHtml(info.raw || '无原始数据')}</pre></div>`;
}

// ===== IP Info =====
document.getElementById('ip-run').addEventListener('click', async () => {
  const query = document.getElementById('ip-query').value.trim();
  const el = document.getElementById('ip-result');
  setLoading(el, query ? `正在查询 ${query} 的归属…` : '正在查询本机公网 IP…');
  const btn = document.getElementById('ip-run');
  btn.disabled = true;
  try {
    const res = await api.ipInfo(query);
    if (!res.ok) setError(el, res.msg);
    else renderIp(el, res);
    refreshHistory();
  } catch (e) { setError(el, e.message); }
  finally { btn.disabled = false; }
});

document.getElementById('ip-local').addEventListener('click', async () => {
  const el = document.getElementById('ip-result');
  setLoading(el, '正在获取本机网络配置…');
  try {
    const res = await api.localInfo();
    if (!res.ok) setError(el, res.msg);
    else el.innerHTML = `<pre class="local-pre">${escapeHtml(res.raw)}</pre>`;
  } catch (e) { setError(el, e.message); }
});

function renderIp(el, data) {
  const flag = (data.countryCode || '').toUpperCase().slice(0, 2);
  el.innerHTML = `
    <div class="ip-card">
      <div class="ip-flag">🌐</div>
      <div class="ip-main">
        <div class="im-query">${escapeHtml(data.query || '')}</div>
        <div class="im-loc">${escapeHtml([data.country, data.regionName, data.city].filter(Boolean).join(' · '))}</div>
      </div>
    </div>
    <div class="ip-grid">
      <div class="ip-field"><div class="if-label">国家 / 地区</div><div class="if-value">${escapeHtml(data.country || '—')} ${escapeHtml(data.countryCode ? `(${data.countryCode})` : '')}</div></div>
      <div class="ip-field"><div class="if-label">省 / 州</div><div class="if-value">${escapeHtml(data.regionName || '—')}</div></div>
      <div class="ip-field"><div class="if-label">城市</div><div class="if-value">${escapeHtml(data.city || '—')}</div></div>
      <div class="ip-field"><div class="if-label">邮编</div><div class="if-value">${escapeHtml(data.zip || '—')}</div></div>
      <div class="ip-field"><div class="if-label">经纬度</div><div class="if-value">${data.lat != null ? data.lat + ', ' + data.lon : '—'}</div></div>
      <div class="ip-field"><div class="if-label">时区</div><div class="if-value">${escapeHtml(data.timezone || '—')}</div></div>
      <div class="ip-field"><div class="if-label">运营商 (ISP)</div><div class="if-value">${escapeHtml(data.isp || '—')}</div></div>
      <div class="ip-field"><div class="if-label">组织 / AS</div><div class="if-value">${escapeHtml(data.org || '—')} ${escapeHtml(data.as || '')}</div></div>
    </div>`;
}

// ===== 历史 =====
const TOOL_LABELS = {
  ping: '📡 Ping', tracert: '🛤️ 路由', dns: '📖 DNS',
  portCheck: '🔌 端口', http: '🌐 HTTP', whois: '🔑 Whois', ipInfo: '🌍 IP',
};
async function refreshHistory() {
  const list = await api.getHistory();
  const el = document.getElementById('hist-list');
  if (list.length === 0) {
    el.innerHTML = '<div class="hist-empty">暂无历史记录</div>';
    return;
  }
  el.innerHTML = list.map((h, i) => `
    <div class="hist-item">
      <div class="hi-tool">${TOOL_LABELS[h.tool] || h.tool}</div>
      <div class="hi-target">${escapeHtml(h.target || '')}</div>
      <div class="hi-summary">${escapeHtml(h.summary || '')}</div>
      <div class="hi-time">${api.timeAgo(h.ts)}</div>
    </div>`).join('');
}
document.getElementById('hist-clear').addEventListener('click', async () => {
  await api.clearHistory();
  refreshHistory();
  toast('历史已清空');
});

// 回车快捷
['ping-host', 'tracert-host', 'dns-domain', 'port-port', 'http-url', 'whois-domain', 'ip-query'].forEach((id) => {
  document.getElementById(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const map = { 'ping-host': 'ping-run', 'tracert-host': 'tracert-run', 'dns-domain': 'dns-run', 'port-port': 'port-run', 'http-url': 'http-run', 'whois-domain': 'whois-run', 'ip-query': 'ip-run' };
      document.getElementById(map[id]).click();
    }
  });
});

// 演示数据：Ping 结果（用于截图模式，让界面有丰富内容）
const DEMO_PING = {
  host: 'baidu.com',
  ip: '110.242.68.66',
  sent: 6,
  received: 6,
  loss: 0,
  min: 12,
  max: 88,
  avg: 48,
  samples: [
    { ip: '110.242.68.66', bytes: 32, time: 12, ttl: 54 },
    { ip: '110.242.68.66', bytes: 32, time: 68, ttl: 54 },
    { ip: '110.242.68.66', bytes: 32, time: 15, ttl: 54 },
    { ip: '110.242.68.66', bytes: 32, time: 72, ttl: 54 },
    { ip: '110.242.68.66', bytes: 32, time: 88, ttl: 54 },
    { ip: '110.242.68.66', bytes: 32, time: 33, ttl: 54 },
  ],
};

// 演示数据初始化函数（可被 main 进程调用）
function initDemoData() {
  document.getElementById('ping-host').value = 'baidu.com';
  renderPing(document.getElementById('ping-result'), DEMO_PING, 'baidu.com');
  const demoHist = document.getElementById('hist-list');
  demoHist.innerHTML = [
    { tool: '📡 Ping', target: 'baidu.com', summary: '6/6 包 · 丢失 0% · 平均 48ms', time: '刚刚' },
    { tool: '🛤️ 路由追踪', target: 'github.com', summary: '12 跳', time: '5 分钟前' },
    { tool: '🔌 端口检测', target: 'baidu.com:443', summary: '可达 (23ms)', time: '1 小时前' },
  ].map((h) => `
    <div class="hist-item">
      <div class="hi-tool">${h.tool}</div>
      <div class="hi-target">${h.target}</div>
      <div class="hi-summary">${h.summary}</div>
      <div class="hi-time">${h.time}</div>
    </div>`).join('');
}
// 暴露给 main 进程调用
window.__initDemoData__ = initDemoData;

// 初始化：加载历史；演示模式注入示例数据
(async function init() {
  await refreshHistory();
  if (api.isDemo && api.isDemo()) {
    initDemoData();
  }
})();
})();
