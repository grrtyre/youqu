// 系统监控器 - 后端服务器
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execFile } = require('child_process');
const si = require('systeminformation');

const PORT = process.env.PORT || 3210;
const PUBLIC_DIR = path.join(__dirname, 'public');
const NET_PS = path.join(__dirname, 'net.ps1');
const HISTORY_LEN = 60;

function getNet() {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', NET_PS],
      { timeout: 4000, windowsHide: true },
      (err, stdout) => {
        if (err) return resolve({ rx: 0, tx: 0, ifaces: [] });
        try {
          let p = JSON.parse((stdout || '').trim());
          if (Array.isArray(p)) p = p[0] || {};
          resolve({ rx: Math.max(0, Number(p.rx) || 0), tx: Math.max(0, Number(p.tx) || 0), ifaces: Array.isArray(p.ifaces) ? p.ifaces : [] });
        } catch (_) { resolve({ rx: 0, tx: 0, ifaces: [] }); }
      });
  });
}

const state = {
  ts: 0,
  cpu: { load: 0, cores: 0, speed: 0, temp: null, model: '' },
  mem: { total: 0, active: 0, used: 0, percent: 0 },
  swap: { total: 0, used: 0, percent: 0 },
  disk: { total: 0, used: 0, percent: 0, readSec: 0, writeSec: 0, fsList: [] },
  net: { rxSec: 0, txSec: 0, interfaces: [] },
  processes: [],
  system: { hostname: '', platform: '', distro: '', release: '', kernel: '', arch: '', uptime: 0, gpus: [], model: '' },
  cpuHistory: [], memHistory: [], netRxHistory: [], netTxHistory: [],
};

let staticInfoReady = false;
async function loadStaticInfo() {
  if (staticInfoReady) return;
  try {
    const [cpu, osInfo, sys, gfx] = await Promise.all([
      si.cpu(), si.osInfo(), si.system(), si.graphics().catch(() => ({ controllers: [] })),
    ]);
    state.cpu.model = `${cpu.manufacturer} ${cpu.brand}`.trim();
    state.cpu.cores = cpu.cores || 0;
    state.system.hostname = osInfo.hostname || '';
    state.system.platform = osInfo.platform || '';
    state.system.distro = osInfo.distro || '';
    state.system.release = osInfo.release || '';
    state.system.kernel = osInfo.kernel || '';
    state.system.arch = osInfo.arch || '';
    state.system.gpus = (gfx.controllers || []).map(c => c.model).filter(Boolean);
    state.system.model = sys.model || '';
  } catch (e) {}
  staticInfoReady = true;
}

function pushHistory(arr, val) { arr.push(val); if (arr.length > HISTORY_LEN) arr.shift(); }

async function sample() {
  await loadStaticInfo();
  try {
    const [load, mem, swap, fsSize, net, procs, temp, time] = await Promise.all([
      si.currentLoad(), si.mem(),
      si.mem().then(m => ({ total: m.swaptotal, used: m.swapused })).catch(() => ({ total: 0, used: 0 })),
      si.fsSize(), getNet(),
      si.processes().catch(() => ({ list: [] })),
      si.cpuTemperature().catch(() => ({ main: null })), si.time(),
    ]);
    state.cpu.load = Math.max(0, Math.min(100, load.currentLoad || 0));
    state.cpu.temp = (temp && temp.main != null && temp.main > 0) ? temp.main : null;
    state.mem.total = mem.total || 0; state.mem.active = mem.active || 0; state.mem.used = mem.used || 0;
    state.mem.percent = mem.total ? (mem.active / mem.total) * 100 : 0;
    state.swap.total = swap.total || 0; state.swap.used = swap.used || 0;
    state.swap.percent = swap.total ? (swap.used / swap.total) * 100 : 0;
    let dTotal = 0, dUsed = 0;
    const fsList = (fsSize || []).map(f => ({ fs: f.fs, mount: f.mount, size: f.size, used: f.used, available: f.available, percent: f.size ? (f.used / f.size) * 100 : 0, type: f.type }));
    for (const f of fsSize || []) { dTotal += f.size || 0; dUsed += f.used || 0; }
    state.disk.total = dTotal; state.disk.used = dUsed;
    state.disk.percent = dTotal ? (dUsed / dTotal) * 100 : 0; state.disk.fsList = fsList;
    try { const io = await si.fsStats().catch(() => null); if (io) { state.disk.readSec = io.rxSec || 0; state.disk.writeSec = io.wxSec || 0; } } catch (_) {}
    state.net.rxSec = net.rx || 0; state.net.txSec = net.tx || 0;
    state.net.interfaces = (net.ifaces || []).map(name => ({ iface: name }));
    const list = (procs && procs.list) ? procs.list : [];
    state.processes = list.map(p => ({ pid: p.pid, name: p.name, cpu: p.cpu || 0, mem: p.mem || 0 })).sort((a, b) => b.cpu - a.cpu).slice(0, 8);
    state.system.uptime = time ? (time.uptime || 0) : 0;
    state.ts = Date.now();
    pushHistory(state.cpuHistory, +state.cpu.load.toFixed(1));
    pushHistory(state.memHistory, +state.mem.percent.toFixed(1));
    pushHistory(state.netRxHistory, +state.net.rxSec.toFixed(0));
    pushHistory(state.netTxHistory, +state.net.txSec.toFixed(0));
  } catch (e) {}
}

function startSampling() { sample(); setInterval(sample, 2000); }

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res) {
  let pathname = decodeURIComponent(url.parse(req.url).pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  if (pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(state)); return;
  }
  serveStatic(req, res);
});

startSampling();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`系统监控器已启动：http://127.0.0.1:${PORT}/`);
});

module.exports = { server, state, sample };
