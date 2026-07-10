// Electron 主进程 - 端口管家
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const {
  parseNetstat,
  parseTasklist,
  enrichConnections,
  exportCSV,
} = require('./core/port-scanner');

let mainWindow;
let favorites = []; // 收藏的端口列表

function favPath() {
  return path.join(app.getPath('userData'), 'port-favorites.json');
}

function loadFavorites() {
  try {
    const p = favPath();
    if (fs.existsSync(p)) {
      favorites = JSON.parse(fs.readFileSync(p, 'utf-8') || '[]');
    }
  } catch (e) {
    favorites = [];
  }
  if (!Array.isArray(favorites)) favorites = [];
}

function saveFavorites() {
  try {
    fs.writeFileSync(favPath(), JSON.stringify(favorites, null, 2), 'utf-8');
  } catch (e) {
    console.error('[favorites] save error:', e.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 920,
    minHeight: 560,
    title: '端口管家',
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

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('console-message', (e, level, message) => {
    console.log('[renderer]', message);
  });

  if (process.env.PM_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// 执行命令，返回 stdout（Promise）
function runCmd(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      resolve(stdout || '');
    });
  });
}

// 扫描端口：并行执行 netstat 和 tasklist，合并结果
async function scanPorts() {
  const [netstatOut, tasklistOut] = await Promise.all([
    runCmd('netstat -ano'),
    runCmd('tasklist /fo csv /nh'),
  ]);
  const conns = parseNetstat(netstatOut);
  const procMap = parseTasklist(tasklistOut);
  const enriched = enrichConnections(conns, procMap);
  // 标记收藏端口
  const favSet = new Set(favorites);
  enriched.forEach((c) => {
    c.favorite = favSet.has(c.localPort);
  });
  return enriched;
}

app.whenReady().then(() => {
  loadFavorites();
  // 截图模式：注入演示数据让界面有内容
  if (process.env.PM_DEMO === '1') {
    favorites = [3000, 8080, 443];
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC =====
ipcMain.handle('port:scan', async () => {
  try {
    if (process.env.PM_DEMO === '1') {
      // 返回演示数据
      return getDemoData();
    }
    return await scanPorts();
  } catch (e) {
    console.error('[scan] error:', e.message);
    return [];
  }
});

ipcMain.handle('port:kill', async (e, pid) => {
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, msg: '无效的 PID' };
  // 禁止结束系统关键进程
  if (pid === 0 || pid === 4) return { ok: false, msg: '不允许结束系统关键进程' };
  return new Promise((resolve) => {
    exec(`taskkill /PID ${pid} /F`, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, msg: '结束失败：' + (stderr || err.message) });
      } else {
        resolve({ ok: true, msg: '已结束进程 PID ' + pid });
      }
    });
  });
});

ipcMain.handle('port:processPath', async (e, pid) => {
  if (!Number.isFinite(pid) || pid <= 0) return '';
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -Command "(Get-Process -Id ${pid}).Path"`, { windowsHide: true }, (err, stdout) => {
      resolve((stdout || '').trim());
    });
  });
});

ipcMain.handle('fav:list', () => favorites.slice());
ipcMain.handle('fav:toggle', (e, port) => {
  if (!Number.isFinite(port) || port <= 0) return favorites.slice();
  const idx = favorites.indexOf(port);
  if (idx >= 0) {
    favorites.splice(idx, 1);
  } else {
    favorites.push(port);
    favorites.sort((a, b) => a - b);
  }
  saveFavorites();
  return favorites.slice();
});
ipcMain.handle('fav:export', () => JSON.stringify(favorites, null, 2));
ipcMain.handle('fav:import', (e, json) => {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) {
      favorites = arr.filter((p) => Number.isFinite(p) && p > 0);
      favorites.sort((a, b) => a - b);
      saveFavorites();
      return { ok: true, count: favorites.length };
    }
    return { ok: false, msg: '格式无效' };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
});

ipcMain.handle('data:exportCSV', async () => {
  const conns = process.env.PM_DEMO === '1' ? getDemoData() : await scanPorts();
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出 CSV',
    defaultPath: `ports-${Date.now()}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, exportCSV(conns), 'utf-8');
  return res.filePath;
});

ipcMain.handle('data:exportJSON', async () => {
  const conns = process.env.PM_DEMO === '1' ? getDemoData() : await scanPorts();
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出 JSON',
    defaultPath: `ports-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const data = {
    exportedAt: new Date().toISOString(),
    count: conns.length,
    connections: conns,
  };
  fs.writeFileSync(res.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return res.filePath;
});

// 演示数据（用于截图模式，让界面有丰富内容）
function getDemoData() {
  const favSet = new Set(favorites);
  const demo = [
    { proto: 'TCP', localAddr: '127.0.0.1', localPort: 3000, foreignAddr: '0.0.0.0', foreignPort: 0, state: 'LISTENING', pid: 18932, processName: 'node.exe', memUsage: '98,432 K', favorite: favSet.has(3000) },
    { proto: 'TCP', localAddr: '0.0.0.0', localPort: 8080, foreignAddr: '0.0.0.0', foreignPort: 0, state: 'LISTENING', pid: 15420, processName: 'python.exe', memUsage: '56,200 K', favorite: favSet.has(8080) },
    { proto: 'TCP', localAddr: '0.0.0.0', localPort: 443, foreignAddr: '0.0.0.0', foreignPort: 0, state: 'LISTENING', pid: 9876, processName: 'nginx.exe', memUsage: '12,800 K', favorite: favSet.has(443) },
    { proto: 'TCP', localAddr: '0.0.0.0', localPort: 3306, foreignAddr: '0.0.0.0', foreignPort: 0, state: 'LISTENING', pid: 7654, processName: 'mysqld.exe', memUsage: '345,672 K', favorite: false },
    { proto: 'TCP', localAddr: '127.0.0.1', localPort: 5432, foreignAddr: '0.0.0.0', foreignPort: 0, state: 'LISTENING', pid: 5432, processName: 'postgres.exe', memUsage: '128,500 K', favorite: false },
    { proto: 'TCP', localAddr: '0.0.0.0', localPort: 80, foreignAddr: '0.0.0.0', foreignPort: 0, state: 'LISTENING', pid: 3344, processName: 'httpd.exe', memUsage: '24,100 K', favorite: false },
    { proto: 'TCP', localAddr: '127.0.0.1', localPort: 6379, foreignAddr: '0.0.0.0', foreignPort: 0, state: 'LISTENING', pid: 6379, processName: 'redis-server.exe', memUsage: '18,300 K', favorite: false },
    { proto: 'TCP', localAddr: '127.0.0.1', localPort: 27017, foreignAddr: '0.0.0.0', foreignPort: 0, state: 'LISTENING', pid: 27017, processName: 'mongod.exe', memUsage: '201,400 K', favorite: false },
    { proto: 'TCP', localAddr: '192.168.1.100', localPort: 51234, foreignAddr: '142.250.80.46', foreignPort: 443, state: 'ESTABLISHED', pid: 12000, processName: 'chrome.exe', memUsage: '234,560 K', favorite: false },
    { proto: 'TCP', localAddr: '192.168.1.100', localPort: 51240, foreignAddr: '151.101.1.69', foreignPort: 443, state: 'ESTABLISHED', pid: 8800, processName: 'Code.exe', memUsage: '456,700 K', favorite: false },
    { proto: 'TCP', localAddr: '192.168.1.100', localPort: 51260, foreignAddr: '104.16.123.96', foreignPort: 443, state: 'TIME_WAIT', pid: 0, processName: '(已释放)', memUsage: '', favorite: false },
    { proto: 'UDP', localAddr: '0.0.0.0', localPort: 5353, foreignAddr: '*', foreignPort: 0, state: '', pid: 2468, processName: 'chrome.exe', memUsage: '234,560 K', favorite: false },
  ];
  return demo;
}
