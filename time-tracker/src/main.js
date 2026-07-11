// Electron 主进程 - 时间管家
const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { TimeStore } = require('./core/time-store');
const stats = require('./core/stats-utils');

function storePath() {
  return path.join(app.getPath('userData'), 'time-tracker.json');
}

let store;
let mainWindow;
let tray = null;

function ensureStore() {
  if (!store) store = new TimeStore(storePath());
  return store;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 880,
    minHeight: 600,
    title: '时间管家',
    backgroundColor: '#f5f5f7',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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

  // 捕获渲染层控制台日志
  mainWindow.webContents.on('console-message', (e, level, message, line, sourceId) => {
    console.log('[renderer]', message);
  });

  if (process.env.TT_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 自动截图：启动后渲染完成自动截屏（用于测试）
  if (process.env.TT_AUTO_SCREENSHOT) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          await new Promise((r) => setTimeout(r, 5000));
          const img = await mainWindow.webContents.capturePage();
          const buf = img.toPNG();
          fs.writeFileSync(process.env.TT_AUTO_SCREENSHOT, buf);
          console.log('[screenshot] saved:', process.env.TT_AUTO_SCREENSHOT, buf.length, 'bytes');
        } catch (e) {
          console.error('[screenshot] error:', e.message);
        }
      }, 600);
    });
  }
}

function createTray() {
  // 生成托盘图标（蓝色圆点）
  const iconSize = 16;
  const img = nativeImage.createEmpty();
  try {
    const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
    if (fs.existsSync(icoPath)) {
      const trayImg = nativeImage.createFromPath(icoPath);
      tray = new Tray(trayImg);
    } else {
      // 用程序生成一个简单的蓝色方块图标
      const png = nativeImage.createFromBuffer(makeTrayIconPng());
      tray = new Tray(png);
    }
  } catch (e) {
    return;
  }

  const buildMenu = () => {
    const projects = ensureStore().listProjects();
    const active = ensureStore().getActive();
    const activeProj = active ? projects.find((p) => p.id === active.projectId) : null;
    const tpl = [
      { label: '时间管家', enabled: false },
      { type: 'separator' },
    ];
    if (activeProj) {
      tpl.push({ label: `计时中: ${activeProj.name}`, enabled: false });
      tpl.push({
        label: '停止计时',
        click: () => {
          ensureStore().stopTimer();
          mainWindow.webContents.send('timer:changed');
        },
      });
    } else {
      tpl.push({ label: '未在计时', enabled: false });
      tpl.push({
        label: '开始计时',
        click: () => {
          if (projects.length > 0) {
            ensureStore().startTimer(projects[0].id);
            mainWindow.webContents.send('timer:changed');
          }
        },
      });
    }
    tpl.push({ type: 'separator' });
    tpl.push({
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
        }
      },
    });
    tpl.push({
      label: '退出',
      click: () => app.quit(),
    });
    tray.setContextMenu(Menu.buildFromTemplate(tpl));
    tray.setToolTip('时间管家');
  };

  buildMenu();
  // 监听变化刷新菜单
  ipcMain.on('tray:refresh', buildMenu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

// 生成托盘小图标 PNG（蓝色圆角方块，16x16）
function makeTrayIconPng() {
  // 极简 16x16 PNG：纯色块
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAfklEQVR4AcXOMQqDQBCF4d/R9h9C0b0L' +
      '0sK9S9PEFw+D2AsIShGExLCIKIpgsBHF1wt4vV4vPJ/PJ5/PJ5vNZrPZbDabrVar1Wq1Wq1Wq9Vq' +
      'tVqtVqvVajWbtQAAAABJRU5ErkJggg==',
    'base64'
  );
  return png;
}

app.whenReady().then(() => {
  // 测试模式：清空旧数据，注入示例
  if (process.env.TT_AUTO_SCREENSHOT) {
    try {
      const p = storePath();
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {
      console.warn('[test] clear data failed:', e.message);
    }
  }
  ensureStore();
  ensureStore().ensureDefault();
  // 截图模式注入示例数据
  if (process.env.TT_AUTO_SCREENSHOT) {
    injectDemoData();
  }
  createWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 注入演示数据，让截图有内容
function injectDemoData() {
  const s = ensureStore();
  const projects = s.listProjects();
  const now = new Date();
  // 本地午夜
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today0 = d0.getTime();
  console.log('[demo] today0=', today0, 'now=', Date.now(), 'projects=', projects.length);
  // 今日几条记录（相对 now 倒推，确保都是过去时间）
  const nowTs = Date.now();
  s.addRecord({ projectId: projects[0].id, start: nowTs - 6.5 * 3600000, end: nowTs - 5 * 3600000 });
  s.addRecord({ projectId: projects[1].id, start: nowTs - 4.5 * 3600000, end: nowTs - 3.5 * 3600000 });
  s.addRecord({ projectId: projects[0].id, start: nowTs - 3 * 3600000, end: nowTs - 1.5 * 3600000 });
  s.addRecord({ projectId: projects[2].id, start: nowTs - 1.25 * 3600000, end: nowTs - 0.5 * 3600000 });
  s.addRecord({ projectId: projects[1].id, start: nowTs - 2.5 * 3600000, end: nowTs - 2 * 3600000 });
  s.addRecord({ projectId: projects[0].id, start: nowTs - 0.4 * 3600000, end: nowTs - 0.1 * 3600000 });
  // 昨天
  s.addRecord({ projectId: projects[0].id, start: today0 - 86400000 + 9 * 3600000, end: today0 - 86400000 + 12 * 3600000 });
  s.addRecord({ projectId: projects[1].id, start: today0 - 86400000 + 14 * 3600000, end: today0 - 86400000 + 16 * 3600000 });
  // 前几天
  for (let i = 2; i <= 6; i++) {
    s.addRecord({ projectId: projects[0].id, start: today0 - i * 86400000 + 9 * 3600000, end: today0 - i * 86400000 + 11 * 3600000 });
    s.addRecord({ projectId: projects[1].id, start: today0 - i * 86400000 + 14 * 3600000, end: today0 - i * 86400000 + 15.5 * 3600000 });
  }
  // 启动一个正在计时的任务
  const active = s.startTimer(projects[0].id);
  s.data.active.start = Date.now() - 1800000; // 半小时前
  s.save();
  console.log('[demo] active=', JSON.stringify(s.data.active), 'records=', s.data.records.length);
}

// ===== IPC =====
ipcMain.handle('project:list', () => ensureStore().listProjects());
ipcMain.handle('project:create', (e, data) => ensureStore().createProject(data || {}));
ipcMain.handle('project:update', (e, id, patch) => ensureStore().updateProject(id, patch || {}));
ipcMain.handle('project:remove', (e, id) => ensureStore().removeProject(id));

ipcMain.handle('timer:start', (e, projectId) => {
  const r = ensureStore().startTimer(projectId);
  mainWindow.webContents.send('timer:changed');
  return r;
});
ipcMain.handle('timer:stop', () => {
  const r = ensureStore().stopTimer();
  mainWindow.webContents.send('timer:changed');
  return r;
});
ipcMain.handle('timer:cancel', () => {
  ensureStore().cancelTimer();
  mainWindow.webContents.send('timer:changed');
});
ipcMain.handle('timer:active', () => ensureStore().getActive());

ipcMain.handle('record:list', () => ensureStore().listRecords());
ipcMain.handle('record:remove', (e, id) => ensureStore().removeRecord(id));
ipcMain.handle('record:add', (e, data) => ensureStore().addRecord(data));
ipcMain.handle('record:update', (e, id, patch) => ensureStore().updateRecord(id, patch));

ipcMain.handle('stats:overview', () => {
  const records = ensureStore().listRecords();
  const now = Date.now();
  const result = {
    today: stats.todayTotal(records, now),
    week: stats.weekTotal(records, now),
    month: stats.monthTotal(records, now),
  };
  console.log('[stats:overview]', JSON.stringify(result), 'records=', records.length);
  return result;
});

ipcMain.handle('stats:distribution', (e, range) => {
  const records = ensureStore().listRecords();
  const projects = ensureStore().listProjects();
  const now = Date.now();
  let from, to;
  if (range === 'week') {
    from = require('./core/time-utils').startOfWeek(now);
    to = from + 7 * 86400000;
  } else if (range === 'month') {
    from = require('./core/time-utils').startOfMonth(now);
    to = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 1).getTime();
  } else {
    from = require('./core/time-utils').startOfDay(now);
    to = from + 86400000;
  }
  return stats.projectDistribution(records, projects, from, to);
});

ipcMain.handle('stats:trend', (e, days) => {
  const records = ensureStore().listRecords();
  return stats.dailyTrend(records, days || 7);
});

ipcMain.handle('data:exportCSV', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出 CSV',
    defaultPath: `time-records-${Date.now()}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, ensureStore().exportCSV(), 'utf-8');
  return res.filePath;
});

ipcMain.handle('data:exportJSON', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出 JSON',
    defaultPath: `time-data-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, ensureStore().exportJSON(), 'utf-8');
  return res.filePath;
});

ipcMain.handle('data:importJSON', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '导入 JSON 数据',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null;
  const filePath = res.filePaths[0];
  const raw = fs.readFileSync(filePath, 'utf-8');
  ensureStore().importJSON(raw);
  mainWindow.webContents.send('timer:changed');
  return filePath;
});
