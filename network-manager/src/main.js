// Electron 主进程 - 网络管家
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');
const http = require('http');
const https = require('https');
const {
  isValidHost,
  isValidPort,
  isValidDomain,
  parseUrl,
  parsePingOutput,
  parseTracertOutput,
  parseNslookupOutput,
  parseWhoisOutput,
  parseHttpHeaders,
  historyToCsv,
  historyToJson,
} = require('./core/net-core');

let mainWindow;
let tray = null;
let history = []; // 诊断历史

function histPath() {
  return path.join(app.getPath('userData'), 'network-history.json');
}

function loadHistory() {
  try {
    const p = histPath();
    if (fs.existsSync(p)) {
      history = JSON.parse(fs.readFileSync(p, 'utf-8') || '[]');
    }
  } catch (e) {
    history = [];
  }
  if (!Array.isArray(history)) history = [];
}

function saveHistory() {
  try {
    // 最多保留 100 条
    if (history.length > 100) history = history.slice(0, 100);
    fs.writeFileSync(histPath(), JSON.stringify(history, null, 2), 'utf-8');
  } catch (e) {
    console.error('[history] save error:', e.message);
  }
}

function addHistory(entry) {
  history.unshift({ ts: Date.now(), ...entry });
  saveHistory();
}

function createWindow() {
  const isDemo = process.env.NM_DEMO === '1' || process.argv.includes('--demo');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 920,
    minWidth: 980,
    minHeight: 600,
    show: false,
    title: '网络管家',
    backgroundColor: '#f5f5f7',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), isDemo ? { query: { demo: '1' } } : undefined);

  mainWindow.webContents.on('console-message', (e, level, message) => {
    console.log('[renderer]', message);
  });

  // 演示/截图模式：显示但不抢焦点；正常模式：正常显示
  mainWindow.once('ready-to-show', () => {
    if (isDemo) mainWindow.showInactive();
    else mainWindow.show();
  });

  // 关闭时隐藏到托盘，不退出（托盘常驻）
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // 演示模式由 renderer.js 的 init() 自行检测（api.isDemo()），无需主进程重复注入

  if (process.env.NM_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// ---- 系统托盘 ----
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let img;
  try {
    img = nativeImage.createFromPath(iconPath);
    if (img.isEmpty()) img = nativeImage.createEmpty();
  } catch (e) {
    img = nativeImage.createEmpty();
  }
  tray = new Tray(img);
  tray.setToolTip('网络管家 - 网络诊断工具集');
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { type: 'separator' },
      { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
    ]);
    tray.popUpContextMenu(menu);
  });
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: '网络管家', enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

// ---- 单实例锁 ----
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    loadHistory();
    createWindow();
    createTray();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    // 不退出，留在托盘
  });
  app.on('before-quit', () => { app.isQuitting = true; });
}

// ===== 运行系统命令（spawn，支持中文） =====
function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      windowsHide: true,
      ...opts,
    });
    let stdout = '';
    let stderr = '';
    // Windows 默认 GBK，用 chcp 65001 切 UTF-8 读取
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (e) => resolve({ stdout: '', stderr: e.message }));
    child.on('close', () => resolve({ stdout, stderr }));
  });
}

// ===== Ping =====
ipcMain.handle('net:ping', async (e, host, count) => {
  if (!isValidHost(host)) return { ok: false, msg: '无效的主机名或 IP' };
  const n = Math.min(Math.max(parseInt(count, 10) || 4, 1), 20);
  // 使用 chcp 65001 + ping -n
  const args = ['/c', 'chcp', '65001', '>', 'nul', '&', 'ping', '-n', String(n), '-w', '2000', host];
  const { stdout } = await runCmd('cmd', args, { shell: true });
  const result = parsePingOutput(stdout);
  addHistory({ tool: 'ping', target: host, summary: `${result.received}/${result.sent} 包, 丢失 ${result.loss}%, 平均 ${result.avg}ms` });
  return { ok: true, raw: stdout, result };
});

// ===== Traceroute =====
ipcMain.handle('net:tracert', async (e, host, maxHops) => {
  if (!isValidHost(host)) return { ok: false, msg: '无效的主机名或 IP' };
  const h = Math.min(Math.max(parseInt(maxHops, 10) || 15, 1), 30);
  const args = ['/c', 'chcp', '65001', '>', 'nul', '&', 'tracert', '-h', String(h), '-w', '2000', host];
  const { stdout } = await runCmd('cmd', args, { shell: true });
  const hops = parseTracertOutput(stdout);
  addHistory({ tool: 'tracert', target: host, summary: `${hops.length} 跳` });
  return { ok: true, raw: stdout, hops };
});

// ===== DNS Lookup (nslookup) =====
ipcMain.handle('net:dns', async (e, domain, recordType) => {
  if (!isValidDomain(domain)) return { ok: false, msg: '无效的域名' };
  const type = (recordType || 'A').toUpperCase();
  const args = ['/c', 'chcp', '65001', '>', 'nul', '&', 'nslookup', '-type=' + type, domain];
  const { stdout } = await runCmd('cmd', args, { shell: true });
  const records = parseNslookupOutput(stdout);
  addHistory({ tool: 'dns', target: domain + ' (' + type + ')', summary: `${records.length} 条记录` });
  return { ok: true, raw: stdout, records };
});

// ===== Port Check (TCP 连接测试) =====
ipcMain.handle('net:portCheck', async (e, host, port, timeoutMs) => {
  if (!isValidHost(host)) return { ok: false, msg: '无效的主机名或 IP' };
  if (!isValidPort(port)) return { ok: false, msg: '无效的端口号' };
  const timeout = Math.min(Math.max(parseInt(timeoutMs, 10) || 3000, 500), 10000);
  const start = Date.now();
  const result = await new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - start;
      socket.destroy();
      resolve({ reachable: true, elapsed });
    });
    socket.once('timeout', () => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ reachable: false, elapsed: timeout, reason: 'timeout' });
    });
    socket.once('error', (err) => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - start;
      resolve({ reachable: false, elapsed, reason: err.code || err.message });
    });
    socket.connect(port, host);
  });
  addHistory({ tool: 'portCheck', target: `${host}:${port}`, summary: result.reachable ? `可达 (${result.elapsed}ms)` : '不可达' });
  return { ok: true, ...result };
});

// ===== HTTP Headers =====
ipcMain.handle('net:httpHeaders', async (e, urlStr) => {
  const parsed = parseUrl(urlStr);
  if (!parsed.valid) return { ok: false, msg: '无效的 URL（需 http/https）' };
  const start = Date.now();
  return new Promise((resolve) => {
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      host: parsed.host,
      port: parsed.port,
      path: parsed.path,
      method: 'GET',
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (NetworkManager/1.0)' },
    }, (res) => {
      const elapsed = Date.now() - start;
      const headers = parseHttpHeaders(res.rawHeaders ? rawHeadersToText(res.rawHeaders) : '');
      addHistory({ tool: 'http', target: urlStr, summary: `${res.statusCode} ${res.statusMessage} (${elapsed}ms)` });
      resolve({ ok: true, status: res.statusCode, statusText: res.statusMessage, elapsed, headers });
      req.destroy();
    });
    req.on('error', (err) => {
      resolve({ ok: false, msg: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, msg: '请求超时' });
    });
    req.end();
  });
});

// rawHeaders 数组转文本
function rawHeadersToText(arr) {
  let s = '';
  for (let i = 0; i < arr.length; i += 2) {
    s += (arr[i] || '') + ': ' + (arr[i + 1] || '') + '\n';
  }
  return s;
}

// ===== Whois（TCP 连接到 whois 服务器） =====
ipcMain.handle('net:whois', async (e, domain) => {
  if (!isValidDomain(domain)) return { ok: false, msg: '无效的域名' };
  const tld = domain.split('.').pop().toLowerCase();
  // 先查 whois.iana.org 获取该 TLD 的 whois 服务器
  const whoisServer = await queryWhoisServer('whois.iana.org', tld);
  const server = whoisServer || ('whois.' + tld);
  // 再查目标 whois 服务器
  const text = await queryWhoisServer(server, domain, 8000);
  if (!text) return { ok: false, msg: 'Whois 查询失败（可能被限流）' };
  const info = parseWhoisOutput(text);
  addHistory({ tool: 'whois', target: domain, summary: info.registrar || (info.expiryDate ? '到期 ' + info.expiryDate.slice(0, 10) : '已查询') });
  return { ok: true, raw: text, info };
});

// 从 whois.iana.org 提取 refer 字段（该 TLD 的 whois 服务器）
function extractRefer(text) {
  const m = text.match(/^refer\s*:\s*(\S+)/im);
  return m ? m[1] : '';
}

// 对 whois.iana.org 查询返回 refer，否则返回原始文本
async function queryWhoisServer(server, query, timeout) {
  const text = await rawWhois(server, query, timeout);
  if (server === 'whois.iana.org') return extractRefer(text);
  return text;
}

function rawWhois(server, query, timeout = 6000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let data = '';
    socket.setTimeout(timeout);
    socket.once('connect', () => socket.write(query + '\r\n'));
    socket.on('data', (d) => { data += d.toString('utf8'); });
    socket.once('close', () => resolve(data.trim()));
    socket.once('timeout', () => { socket.destroy(); resolve(data.trim()); });
    socket.once('error', () => resolve(''));
  });
}

// ===== IP 信息（本机公网 IP + 地理位置） =====
ipcMain.handle('net:ipInfo', async (e, query) => {
  // query 为空时查询本机公网 IP
  const url = query
    ? `http://ip-api.com/json/${encodeURIComponent(query)}?lang=zh-CN&fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
    : 'http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query';
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d.toString('utf8'); });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.status === 'success') {
            addHistory({ tool: 'ipInfo', target: data.query, summary: `${data.country} ${data.city} ${data.isp}` });
            resolve({ ok: true, ...data });
          } else {
            resolve({ ok: false, msg: data.message || '查询失败' });
          }
        } catch (e) {
          resolve({ ok: false, msg: '解析失败' });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, msg: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, msg: '请求超时' }); });
  });
});

// ===== 本地网络信息 =====
ipcMain.handle('net:localInfo', async () => {
  const { stdout } = await runCmd('cmd', ['/c', 'chcp', '65001', '>', 'nul', '&', 'ipconfig', '/all'], { shell: true });
  return { ok: true, raw: stdout };
});

// ===== 历史 =====
ipcMain.handle('hist:list', () => history.slice());
ipcMain.handle('hist:clear', () => {
  history = [];
  saveHistory();
  return true;
});
ipcMain.handle('hist:remove', (e, index) => {
  if (index >= 0 && index < history.length) {
    history.splice(index, 1);
    saveHistory();
  }
  return history.slice();
});

// ===== 剪贴板（复制诊断结果） =====
ipcMain.handle('clip:writeText', (e, text) => {
  try {
    clipboard.writeText(String(text || ''));
    return true;
  } catch (err) {
    return false;
  }
});

// ===== 历史导出（CSV / JSON） =====
ipcMain.handle('hist:exportCsv', async () => {
  const csv = historyToCsv(history);
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出历史记录为 CSV',
    defaultPath: 'network-history.csv',
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, msg: '已取消' };
  try {
    // 加 UTF-8 BOM，保证 Excel 正确识别中文
    fs.writeFileSync(res.filePath, '\uFEFF' + csv, 'utf-8');
    return { ok: true, path: res.filePath };
  } catch (err) {
    return { ok: false, msg: err.message };
  }
});

ipcMain.handle('hist:exportJson', async () => {
  const json = historyToJson(history);
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出历史记录为 JSON',
    defaultPath: 'network-history.json',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, msg: '已取消' };
  try {
    fs.writeFileSync(res.filePath, json, 'utf-8');
    return { ok: true, path: res.filePath };
  } catch (err) {
    return { ok: false, msg: err.message };
  }
});
