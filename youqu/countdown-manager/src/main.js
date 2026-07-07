// main.js — Electron 主进程
// 职责：创建窗口、托盘、IPC、数据持久化、导入导出
const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./core/event-store');

const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';
const APP_NAME = '倒计时管家';

let mainWindow = null;
let tray = null;

// 数据文件路径：用户目录下（版本化，便于后续迁移）
function dataFilePath() {
  const dir = path.join(app.getPath('userData'), 'countdown-data-v1');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'events.json');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 880,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '..', 'build', 'icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    // 最小化到托盘而不是退出
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// 首次运行注入示例数据
function seedSampleEvents(file) {
  const nextYear = new Date().getFullYear() + 1;
  const samples = [
    { title: '春节', date: '2026-02-17', calendar: 'lunar', repeat: 'yearly', category: 'festival', color: '#ff3b30', note: '农历正月初一，阖家团圆' },
    { title: '中秋节', date: '2025-10-06', calendar: 'lunar', repeat: 'yearly', category: 'festival', color: '#ff9500', note: '农历八月十五，人月两团圆' },
    { title: '我的生日', date: '1995-08-15', calendar: 'solar', repeat: 'yearly', category: 'anniversary', color: '#ff2d55', note: '记得给自己买蛋糕' },
    { title: '项目截止日', date: '2026-12-31', calendar: 'solar', repeat: 'none', category: 'work', color: '#007aff', note: '年终交付节点' },
    { title: '结婚纪念日', date: '2020-05-20', calendar: 'solar', repeat: 'yearly', category: 'anniversary', color: '#af52de', note: '提前订花' },
    { title: '暑假旅行', date: '2026-07-25', calendar: 'solar', repeat: 'none', category: 'life', color: '#34c759', note: '北海道，机票已出' }
  ];
  const events = samples.map(s => store.normalizeEvent(s));
  store.save(events, file);
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let img;
  try {
    img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  } catch (e) {
    img = nativeImage.createEmpty();
  }
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip(APP_NAME);
  const menu = Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    }
  });
}

app.whenReady().then(() => {
  // 首次运行先注入示例数据，避免与渲染层加载产生竞态
  const file = dataFilePath();
  if (!fs.existsSync(file)) seedSampleEvents(file);
  createWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 关闭窗口时退出（托盘仍由 before-quit 控制）
    app.quit();
  }
});

// ===== IPC =====

ipcMain.handle('load-events', async () => {
  return store.load(dataFilePath());
});

ipcMain.handle('save-events', async (event, events) => {
  try {
    store.save(events, dataFilePath());
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('add-event', async (event, raw) => {
  try {
    const events = store.load(dataFilePath());
    const evt = store.add(events, raw);
    store.save(events, dataFilePath());
    return evt;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('update-event', async (event, id, patch) => {
  try {
    const events = store.load(dataFilePath());
    const evt = store.update(events, id, patch);
    store.save(events, dataFilePath());
    return evt;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('delete-event', async (event, id) => {
  try {
    const events = store.load(dataFilePath());
    const ok = store.remove(events, id);
    store.save(events, dataFilePath());
    return ok;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('export-events', async () => {
  try {
    const events = store.load(dataFilePath());
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出事件',
      defaultPath: `countdown-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    fs.writeFileSync(result.filePath, store.exportJSON(events), 'utf-8');
    return { ok: true, path: result.filePath };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('import-events', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入事件',
      properties: ['openFile'],
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return { cancelled: true };
    const jsonStr = fs.readFileSync(result.filePaths[0], 'utf-8');
    const events = store.load(dataFilePath());
    const merged = store.importJSON(events, jsonStr);
    store.save(merged, dataFilePath());
    return { ok: true, count: merged.length };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('get-afdian-url', async () => AFDIAN_URL);

ipcMain.handle('get-app-info', async () => ({
  name: APP_NAME,
  version: app.getVersion(),
  afdian: AFDIAN_URL
}));

ipcMain.handle('quit-app', async () => {
  app.isQuitting = true;
  app.quit();
});
