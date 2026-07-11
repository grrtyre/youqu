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
};
