// 网络管家 - 核心纯函数模块
// 包含输入校验、命令输出解析、格式化等纯函数，便于单元测试

// ===== 输入校验 =====

// 解析 "host:port" 或 "host port" 或 "host" 输入
function parseHostPort(input) {
  if (!input || typeof input !== 'string') return { host: '', port: 0 };
  const trimmed = input.trim();
  if (!trimmed) return { host: '', port: 0 };
  // host:port
  let m = trimmed.match(/^(.+):(\d+)$/);
  if (m) return { host: m[1].trim(), port: parseInt(m[2], 10) };
  // host port (空格分隔)
  m = trimmed.match(/^(\S+)\s+(\d+)$/);
  if (m) return { host: m[1], port: parseInt(m[2], 10) };
  // 仅 host
  return { host: trimmed, port: 0 };
}

// 校验是否为合法 IPv4
function isIPv4(s) {
  if (typeof s !== 'string') return false;
  const parts = s.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255;
  });
}

// 校验是否为合法 IPv6（简化校验）
function isIPv6(s) {
  if (typeof s !== 'string') return false;
  if (!/^[0-9a-fA-F:]+$/.test(s)) return false;
  if (!s.includes(':')) return false;
  // 至少两个冒号或一个::简写
  const colons = (s.match(/:/g) || []).length;
  return colons >= 1;
}

// 校验主机名或 IP
function isValidHost(host) {
  if (!host || typeof host !== 'string') return false;
  const h = host.trim();
  if (!h || h.length > 253) return false;
  if (isIPv4(h)) return true;
  if (isIPv6(h)) return true;
  // 域名
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(h);
}

// 校验端口号
function isValidPort(port) {
  const p = Number(port);
  return Number.isInteger(p) && p >= 1 && p <= 65535;
}

// 校验域名（非 IP）
function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  const d = domain.trim();
  if (!d || d.length > 253) return false;
  if (isIPv4(d)) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(d);
}

// 解析 URL（http/https）
function parseUrl(url) {
  if (!url || typeof url !== 'string') return { valid: false };
  const trimmed = url.trim();
  const m = trimmed.match(/^(https?:)\/\/([^\/:]+)(?::(\d+))?(\/.*)?$/i);
  if (!m) {
    // 尝试补全 http://
    if (/^[a-zA-Z0-9]/.test(trimmed) && isValidHost(trimmed.split('/')[0].split(':')[0])) {
      return { valid: true, protocol: 'http:', host: trimmed.split('/')[0].split(':')[0], port: 80, path: '/' };
    }
    return { valid: false };
  }
  return {
    valid: true,
    protocol: m[1].toLowerCase(),
    host: m[2],
    port: m[3] ? parseInt(m[3], 10) : (m[1].toLowerCase() === 'https:' ? 443 : 80),
    path: m[4] || '/',
  };
}

// ===== Ping 输出解析 =====

// 解析 Windows ping 命令输出
function parsePingOutput(text) {
  const result = {
    host: '',
    ip: '',
    sent: 0,
    received: 0,
    loss: 0,
    min: 0,
    max: 0,
    avg: 0,
    samples: [],
  };
  if (!text || typeof text !== 'string') return result;

  // 正在 Ping host [ip] 具有 32 字节的数据 / Pinging host [ip] with 32 bytes of data
  const headMatch = text.match(/(?:正在 Ping|Pinging)\s+(\S+)(?:\s*\[([^\]]+)\])?/i);
  if (headMatch) {
    result.host = headMatch[1];
    result.ip = headMatch[2] || '';
  }

  // 来自 ip 的回复: 字节=32 时间=12ms TTL=64 / Reply from ip: bytes=32 time=12ms TTL=64
  const replyRe = /(?:来自\s+|Reply from\s+)(\S+?)(?:\s*的回复)?[：:\s]*(?:bytes?|字节)=(\d+)\s+(?:time|时间)[=:](\d+)\s*ms\s+TTL[=:](\d+)/gi;
  let m;
  while ((m = replyRe.exec(text)) !== null) {
    result.samples.push({
      ip: m[1],
      bytes: parseInt(m[2], 10),
      time: parseInt(m[3], 10),
      ttl: parseInt(m[4], 10),
    });
  }

  // 请求超时 / Request timed out
  const timeoutRe = /(?:请求超时|Request timed out)/gi;
  let timeouts = 0;
  while (timeoutRe.exec(text) !== null) timeouts++;

  result.sent = result.samples.length + timeouts;
  result.received = result.samples.length;
  result.loss = result.sent > 0 ? Math.round((timeouts / result.sent) * 100) : 0;

  // 统计信息 / Packets: Sent = 4, Received = 4, Lost = 0
  const statMatch = text.match(/Packets:\s*Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+),\s*Lost\s*=\s*(\d+)/i);
  if (statMatch) {
    result.sent = parseInt(statMatch[1], 10);
    result.received = parseInt(statMatch[2], 10);
    const lost = parseInt(statMatch[3], 10);
    result.loss = result.sent > 0 ? Math.round((lost / result.sent) * 100) : 0;
  }
  // 中文统计
  const statMatchZh = text.match(/已发送\s*=\s*(\d+)[，,]\s*已接收\s*=\s*(\d+)[，,]\s*丢失\s*=\s*(\d+)/);
  if (statMatchZh) {
    result.sent = parseInt(statMatchZh[1], 10);
    result.received = parseInt(statMatchZh[2], 10);
    const lost = parseInt(statMatchZh[3], 10);
    result.loss = result.sent > 0 ? Math.round((lost / result.sent) * 100) : 0;
  }

  // 往返时间统计
  const timeMatch = text.match(/(?:Minimum|最短)\s*=\s*(\d+)ms[，,]\s*(?:Maximum|最长)\s*=\s*(\d+)ms[，,]\s*(?:Average|平均)\s*=\s*(\d+)ms/i);
  if (timeMatch) {
    result.min = parseInt(timeMatch[1], 10);
    result.max = parseInt(timeMatch[2], 10);
    result.avg = parseInt(timeMatch[3], 10);
  }

  // 若未解析到统计但存在样本，自行计算
  if (result.samples.length > 0 && result.avg === 0) {
    const times = result.samples.map((s) => s.time);
    result.min = Math.min(...times);
    result.max = Math.max(...times);
    result.avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  return result;
}

// ===== Traceroute 输出解析 =====

// 解析 Windows tracert 命令输出
function parseTracertOutput(text) {
  const hops = [];
  if (!text || typeof text !== 'string') return hops;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    if (/tracert|跟踪|over a maximum/i.test(line)) continue;

    //  1     1 ms     1 ms     1 ms  192.168.1.1
    //  2     *        *        *     请求超时
    //  3    12 ms    11 ms    13 ms  example.com [93.184.216.34]
    const m = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!m) continue;
    const hop = parseInt(m[1], 10);
    const rest = m[2];

    // 提取三次时间
    const times = [];
    const timeRe = /(\d+)\s*ms|\*/g;
    let tm;
    let count = 0;
    while ((tm = timeRe.exec(rest)) !== null && count < 3) {
      times.push(tm[1] ? parseInt(tm[1], 10) : null);
      count++;
    }
    if (times.length === 0) continue;

    // 提取主机/IP（在时间之后的部分）
    let host = '';
    let ip = '';
    // 取最后一个 ms/* 之后的内容
    const afterTimes = rest.replace(/(\d+\s*ms|\*)/gi, '').trim();
    // 匹配 host [ip] 或仅 host/ip
    const hostMatch = afterTimes.match(/^([a-zA-Z0-9.\-]+)(?:\s*\[([^\]]+)\])?/);
    if (hostMatch) {
      host = hostMatch[1] || '';
      ip = hostMatch[2] || '';
      if (!ip && isIPv4(host)) ip = host;
    }

    hops.push({ hop, host, ip, times });
  }
  return hops;
}

// ===== DNS (nslookup) 输出解析 =====

// 解析 nslookup 输出
function parseNslookupOutput(text) {
  const records = [];
  if (!text || typeof text !== 'string') return records;

  const lines = text.split(/\r?\n/);
  let currentName = '';
  let currentType = '';
  let isAnswer = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/非权威应答|Non-authoritative answer|Authoritative answers/i.test(line)) {
      isAnswer = true;
      continue;
    }
    if (!isAnswer) continue;
    // 名称 / Name
    const nameMatch = line.match(/^\s*(?:名称|Name)\s*[:：]\s*(.+)/i);
    if (nameMatch) {
      currentName = nameMatch[1].trim();
      continue;
    }
    // Address / Addresses
    const addrMatch = line.match(/^\s*(?:Address|Addresses)\s*[:：]\s*(.+)/i);
    if (addrMatch) {
      const addrs = addrMatch[1].split(/\s+/).filter(Boolean);
      for (const a of addrs) {
        records.push({ name: currentName, type: currentType || 'A', address: a, ttl: 0 });
      }
      continue;
    }
    // MX: xxx.com mail exchanger = 10 mail.xxx.com
    const mxMatch = line.match(/^\s*(.+?)\s+mail exchanger\s*=\s*(\d+)\s+(.+)/i);
    if (mxMatch) {
      records.push({ name: mxMatch[1].trim(), type: 'MX', address: mxMatch[3].trim(), preference: parseInt(mxMatch[2], 10), ttl: 0 });
      continue;
    }
  }
  // 兜底：简单 Address 行
  if (records.length === 0) {
    const addrRe = /(?:Address|地址)\s*[:：]\s*([0-9a-fA-F:.]+)/gi;
    let am;
    while ((am = addrRe.exec(text)) !== null) {
      records.push({ name: '', type: 'A', address: am[1], ttl: 0 });
    }
  }
  return records;
}

// ===== Whois 输出解析 =====

// 解析 whois 文本输出
function parseWhoisOutput(text) {
  const info = {
    registrar: '',
    createdDate: '',
    expiryDate: '',
    updatedDate: '',
    nameServers: [],
    status: [],
    raw: '',
  };
  if (!text || typeof text !== 'string') return info;
  info.raw = text;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const l = line.trim();
    if (/^(Registrar|注册商)\s*[:：]\s*(.+)/i.test(l)) {
      info.registrar = l.replace(/^(Registrar|注册商)\s*[:：]\s*/i, '').trim();
    }
    if (/(Creation Date|Created|Registration Time|注册时间|创建时间)\s*[:：]\s*(.+)/i.test(l)) {
      info.createdDate = l.replace(/^.*?(Creation Date|Created|Registration Time|注册时间|创建时间)\s*[:：]\s*/i, '').trim();
    }
    if (/(Registry Expiry Date|Expiry Date|Expiration Date|Paid-till|过期时间)\s*[:：]\s*(.+)/i.test(l)) {
      info.expiryDate = l.replace(/^.*?(Registry Expiry Date|Expiry Date|Expiration Date|Paid-till|过期时间)\s*[:：]\s*/i, '').trim();
    }
    if (/(Updated Date|Last Modified|更新时间)\s*[:：]\s*(.+)/i.test(l)) {
      info.updatedDate = l.replace(/^.*?(Updated Date|Last Modified|更新时间)\s*[:：]\s*/i, '').trim();
    }
    if (/^(Name Server|nserver|域名服务器)\s*[:：]\s*(.+)/i.test(l)) {
      const ns = l.replace(/^(Name Server|nserver|域名服务器)\s*[:：]\s*/i, '').trim().toLowerCase();
      if (ns && !info.nameServers.includes(ns)) info.nameServers.push(ns);
    }
    if (/^(Domain Status|status)\s*[:：]\s*(.+)/i.test(l)) {
      const s = l.replace(/^(Domain Status|status)\s*[:：]\s*/i, '').trim();
      if (s) info.status.push(s);
    }
  }
  return info;
}

// ===== HTTP 响应解析 =====

// 解析 HTTP 响应头字符串为键值数组
function parseHttpHeaders(headerStr) {
  const headers = [];
  if (!headerStr || typeof headerStr !== 'string') return headers;
  const lines = headerStr.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    headers.push({ key, value });
  }
  return headers;
}

// ===== 格式化辅助 =====

// 根据延迟返回颜色
function latencyColor(ms) {
  if (ms === null || ms === undefined) return '#ff3b30';
  if (ms < 50) return '#34c759';
  if (ms < 100) return '#007aff';
  if (ms < 200) return '#ff9500';
  return '#ff3b30';
}

// 延迟评级文字
function latencyRating(ms) {
  if (ms === null || ms === undefined) return '超时';
  if (ms < 50) return '极优';
  if (ms < 100) return '良好';
  if (ms < 200) return '一般';
  return '较差';
}

// 格式化字节数
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
}

// 相对时间
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  return Math.floor(diff / 86400000) + ' 天前';
}

// ===== 结果转纯文本（用于复制到剪贴板） =====

// 将诊断结果格式化为可分享的纯文本
// tool: 'ping' | 'tracert' | 'dns' | 'port' | 'http' | 'whois' | 'ip'
// data: 该工具解析后的结果对象
// meta: { host, domain, type, port, url } 输入元信息
function formatResultText(tool, data, meta) {
  if (!tool || !data) return '';
  meta = meta || {};
  switch (tool) {
    case 'ping': return _fmtPing(data, meta.host);
    case 'tracert': return _fmtTracert(data, meta.host);
    case 'dns': return _fmtDns(data, meta.domain, meta.type);
    case 'port': return _fmtPort(data, meta.host, meta.port);
    case 'http': return _fmtHttp(data, meta.url);
    case 'whois': return _fmtWhois(data, meta.domain);
    case 'ip': return _fmtIp(data);
    default: return '';
  }
}

function _fmtPing(r, host) {
  const lines = [];
  lines.push(`Ping 探测 - ${host || r.host || ''}${r.ip ? ' [' + r.ip + ']' : ''}`);
  lines.push(`已发送: ${r.sent}  已接收: ${r.received}  丢包率: ${r.loss}%  平均延迟: ${r.avg}ms (最小 ${r.min || '—'}ms / 最大 ${r.max || '—'}ms)`);
  lines.push('');
  if (r.samples && r.samples.length) {
    r.samples.forEach((s, i) => {
      lines.push(`#${i + 1}  ${s.ip || host || ''}  ${s.time}ms  TTL=${s.ttl}  ${s.bytes}B`);
    });
  }
  return lines.join('\n');
}

function _fmtTracert(hops, host) {
  const lines = [];
  lines.push(`路由追踪 - ${host || ''}`);
  if (hops && hops.length) {
    hops.forEach((h) => {
      const times = h.times.map((t) => (t === null ? '超时' : t + 'ms')).join(' / ');
      const name = h.host || '(匿名)';
      const ip = h.ip ? ' [' + h.ip + ']' : '';
      lines.push(` ${h.hop}  ${name}${ip}  ${times}`);
    });
  }
  return lines.join('\n');
}

function _fmtDns(records, domain, type) {
  const lines = [];
  lines.push(`DNS 查询 - ${domain || ''} (${type || 'A'})`);
  if (records && records.length) {
    records.forEach((r) => {
      const pref = r.preference != null ? `  优先级 ${r.preference}` : '';
      lines.push(`${r.type || type || 'A'}\t${r.address}${pref}`);
    });
  }
  return lines.join('\n');
}

function _fmtPort(res, host, port) {
  const ok = res.reachable;
  const reason = ok ? '' : `（${res.reason === 'timeout' ? '连接超时' : (res.reason || '拒绝')}）`;
  return [
    `端口检测 - ${host || ''}:${port || ''}`,
    `状态: ${ok ? '端口开放' : '端口不可达'}${reason}`,
    `耗时: ${res.elapsed}ms`,
  ].join('\n');
}

function _fmtHttp(res, url) {
  const lines = [];
  lines.push(`HTTP 头分析 - ${url || ''}`);
  lines.push(`状态: ${res.status} ${res.statusText || ''}  耗时: ${res.elapsed}ms`);
  lines.push('');
  if (res.headers && res.headers.length) {
    res.headers.forEach((h) => lines.push(`${h.key}: ${h.value}`));
  }
  return lines.join('\n');
}

function _fmtWhois(info, domain) {
  const lines = [];
  lines.push(`Whois 域名信息 - ${domain || ''}`);
  lines.push(`注册商: ${info.registrar || '—'}`);
  lines.push(`注册时间: ${info.createdDate || '—'}`);
  lines.push(`到期时间: ${info.expiryDate || '—'}`);
  lines.push(`更新时间: ${info.updatedDate || '—'}`);
  lines.push(`域名服务器: ${(info.nameServers && info.nameServers.length) ? info.nameServers.join(', ') : '—'}`);
  return lines.join('\n');
}

function _fmtIp(d) {
  const lines = [];
  lines.push(`IP 归属 - ${d.query || ''}`);
  lines.push(`国家/地区: ${d.country || '—'} ${d.countryCode ? '(' + d.countryCode + ')' : ''}`);
  lines.push(`省/州: ${d.regionName || '—'}`);
  lines.push(`城市: ${d.city || '—'}`);
  lines.push(`邮编: ${d.zip || '—'}`);
  lines.push(`经纬度: ${d.lat != null ? d.lat + ', ' + d.lon : '—'}`);
  lines.push(`时区: ${d.timezone || '—'}`);
  lines.push(`运营商: ${d.isp || '—'}`);
  lines.push(`组织/AS: ${[d.org, d.as].filter(Boolean).join(' ') || '—'}`);
  return lines.join('\n');
}

// ===== 历史记录导出 CSV =====

// CSV 字段转义：包含逗号、引号或换行时用双引号包裹，内部引号双写
function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// 时间戳格式化为 yyyy-MM-dd HH:mm:ss
function formatTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 历史记录转 CSV 文本
function historyToCsv(history) {
  if (!Array.isArray(history) || history.length === 0) return '时间,工具,目标,摘要\r\n';
  const rows = ['时间,工具,目标,摘要'];
  history.forEach((h) => {
    rows.push([
      escapeCsv(formatTs(h.ts)),
      escapeCsv(h.tool),
      escapeCsv(h.target),
      escapeCsv(h.summary),
    ].join(','));
  });
  return rows.join('\r\n') + '\r\n';
}

// 历史记录转 JSON 文本
function historyToJson(history) {
  if (!Array.isArray(history)) return '[]';
  return JSON.stringify(history.map((h) => ({
    time: formatTs(h.ts),
    tool: h.tool,
    target: h.target || '',
    summary: h.summary || '',
  })), null, 2);
}

module.exports = {
  parseHostPort,
  isIPv4,
  isIPv6,
  isValidHost,
  isValidPort,
  isValidDomain,
  parseUrl,
  parsePingOutput,
  parseTracertOutput,
  parseNslookupOutput,
  parseWhoisOutput,
  parseHttpHeaders,
  latencyColor,
  latencyRating,
  formatBytes,
  timeAgo,
  formatResultText,
  escapeCsv,
  formatTs,
  historyToCsv,
  historyToJson,
};
