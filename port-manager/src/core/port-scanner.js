// 端口管家 - 核心端口扫描与解析逻辑
// 纯函数模块，可被 main.js 和 test/test.js 同时引用

/**
 * 解析 netstat -ano 的输出，提取连接列表。
 * 兼容中英文 locale（表头可能为"协议"或"Proto"，数据行以 TCP/UDP 开头）。
 * @param {string} output netstat -ano 原始输出
 * @returns {Array<Object>} 连接数组
 */
function parseNetstat(output) {
  if (!output || typeof output !== 'string') return [];
  const lines = output.split(/\r?\n/);
  const results = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 只处理 TCP / TCPv6 / UDP / UDPv6 数据行
    if (!/^(tcp|udp)/i.test(trimmed)) continue;
    // 按连续空白拆分
    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;
    const proto = parts[0];
    const localRaw = parts[1];
    const foreignRaw = parts[2];
    // UDP 行可能没有状态，此时 parts[3] 是 PID
    let state = '';
    let pidStr = '';
    if (/^(tcp)/i.test(proto)) {
      // TCP: proto local foreign state pid
      if (parts.length >= 5) {
        state = parts[3];
        pidStr = parts[4];
      } else {
        // 兼容少数情况
        state = parts[3] || '';
        pidStr = '';
      }
    } else {
      // UDP: proto local foreign pid (无状态)
      state = '';
      pidStr = parts[3] || '';
    }
    const pid = parseInt(pidStr, 10);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const local = splitAddrPort(localRaw);
    const foreign = splitAddrPort(foreignRaw);
    results.push({
      proto,
      localAddr: local.addr,
      localPort: local.port,
      foreignAddr: foreign.addr,
      foreignPort: foreign.port,
      state,
      pid,
    });
  }
  return results;
}

/**
 * 将 "192.168.1.1:8080" 或 "[::]:443" 或 "0.0.0.0:135" 拆分为地址和端口。
 * UDP 的 "*:*" 视为空。
 */
function splitAddrPort(raw) {
  if (!raw || raw === '*:*') return { addr: '*', port: 0 };
  // IPv6 形如 [::]:443 或 [2001:db8::1]:80
  const v6Match = raw.match(/^\[(.+)\]:(\d+)$/);
  if (v6Match) return { addr: v6Match[1], port: parseInt(v6Match[2], 10) || 0 };
  // 普通地址 最后一个冒号分隔端口
  const idx = raw.lastIndexOf(':');
  if (idx === -1) return { addr: raw, port: 0 };
  const addr = raw.substring(0, idx);
  const port = parseInt(raw.substring(idx + 1), 10) || 0;
  return { addr, port };
}

/**
 * 解析 tasklist /fo csv /nh 的输出，返回 PID -> 进程信息 的映射。
 * 输出示例:
 *   "chrome.exe","5678","Console","1","123,456 K"
 * @param {string} output tasklist 原始输出
 * @returns {Map<number, {name:string, mem:string}>}
 */
function parseTasklist(output) {
  const map = new Map();
  if (!output || typeof output !== 'string') return map;
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // CSV 字段以双引号包裹，逗号分隔
    const fields = parseCsvLine(trimmed);
    if (fields.length < 2) continue;
    const name = fields[0];
    const pid = parseInt(fields[1], 10);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const mem = fields[4] || '';
    map.set(pid, { name, mem });
  }
  return map;
}

/**
 * 极简 CSV 单行解析（处理双引号包裹字段与转义双引号）。
 */
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        result.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  result.push(cur);
  return result;
}

/**
 * 将 netstat 连接列表与 tasklist 进程信息合并，生成富连接信息。
 * @param {Array} connections parseNetstat 结果
 * @param {Map<number, {name:string, mem:string}>} procMap parseTasklist 结果
 * @returns {Array<Object>} 富连接数组（带 processName, memUsage）
 */
function enrichConnections(connections, procMap) {
  return connections.map((c) => {
    const proc = procMap.get(c.pid);
    return {
      ...c,
      processName: proc ? proc.name : '(未知)',
      memUsage: proc ? proc.mem : '',
    };
  });
}

/**
 * 按关键字过滤连接（端口、进程名、地址、状态、PID）。
 */
function filterConnections(connections, keyword) {
  if (!keyword) return connections;
  const kw = String(keyword).trim().toLowerCase();
  if (!kw) return connections;
  return connections.filter((c) => {
    return (
      String(c.localPort).includes(kw) ||
      String(c.foreignPort).includes(kw) ||
      String(c.pid).includes(kw) ||
      (c.processName || '').toLowerCase().includes(kw) ||
      (c.localAddr || '').toLowerCase().includes(kw) ||
      (c.foreignAddr || '').toLowerCase().includes(kw) ||
      (c.state || '').toLowerCase().includes(kw) ||
      (c.proto || '').toLowerCase().includes(kw)
    );
  });
}

/**
 * 统计概览信息。
 */
function summarize(connections) {
  const total = connections.length;
  let listening = 0;
  let established = 0;
  let timeWait = 0;
  let closeWait = 0;
  let udpCount = 0;
  const pidSet = new Set();
  const portSet = new Set();
  for (const c of connections) {
    const st = (c.state || '').toUpperCase();
    if (st === 'LISTENING') listening++;
    else if (st === 'ESTABLISHED') established++;
    else if (st === 'TIME_WAIT') timeWait++;
    else if (st === 'CLOSE_WAIT') closeWait++;
    if (/^udp/i.test(c.proto)) udpCount++;
    pidSet.add(c.pid);
    if (c.localPort > 0) portSet.add(c.localPort);
  }
  return {
    total,
    listening,
    established,
    timeWait,
    closeWait,
    udpCount,
    processCount: pidSet.size,
    portCount: portSet.size,
  };
}

/**
 * 生成 CSV 导出内容。
 */
function exportCSV(connections) {
  const header = '协议,本地地址,本地端口,外部地址,外部端口,状态,PID,进程名,内存占用';
  const rows = connections.map((c) => {
    return [
      c.proto,
      c.localAddr,
      c.localPort,
      c.foreignAddr,
      c.foreignPort,
      c.state || '',
      c.pid,
      c.processName || '',
      c.memUsage || '',
    ]
      .map((v) => {
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      })
      .join(',');
  });
  return '\ufeff' + header + '\n' + rows.join('\n');
}

module.exports = {
  parseNetstat,
  parseTasklist,
  enrichConnections,
  filterConnections,
  summarize,
  exportCSV,
  splitAddrPort,
  parseCsvLine,
};
