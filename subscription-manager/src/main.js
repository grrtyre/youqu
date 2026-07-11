// main.js - Electron 主进程
const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadData, saveData } = require('./core/store');
const utils = require('./core/subscription-utils');

let mainWindow = null;
let tray = null;

// 单实例锁：防止多开冲突
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const screenshotMode = !!process.env.SUB_MGR_SCREENSHOT;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: '订阅管家',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (screenshotMode) {
      // 截图模式：不显示窗口，延迟后截图并退出
      setTimeout(async () => {
        try {
          const image = await mainWindow.webContents.capturePage();
          const buf = image.toPNG();
          fs.writeFileSync(process.env.SUB_MGR_SCREENSHOT, buf);
          console.log('screenshot saved: ' + process.env.SUB_MGR_SCREENSHOT);
        } catch (e) {
          console.error('screenshot error:', e.message);
        }
        app.quit();
      }, 3500);
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 系统托盘：关闭窗口不退出，托盘常驻
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
  tray.setToolTip('订阅管家');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
}

// IPC: 获取所有订阅
ipcMain.handle('subscriptions:getAll', () => {
  const data = loadData();
  // 截图模式下重置演示数据
  if (process.env.SUB_MGR_SCREENSHOT && data.subscriptions.length < 8) {
    return { subscriptions: [], settings: { currency: 'CNY', reminderDays: 3 } };
  }
  return data;
});

// IPC: 保存所有订阅
ipcMain.handle('subscriptions:save', (event, data) => {
  saveData(data);
  return { success: true };
});

// IPC: 获取统计
ipcMain.handle('subscriptions:stats', () => {
  const data = loadData();
  const stats = utils.computeStats(data.subscriptions);
  const categories = utils.categoryBreakdown(data.subscriptions);
  return { stats, categories };
});

// IPC: 显示通知
ipcMain.handle('notifications:show', (event, title, body) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  return { success: true };
});

// IPC: 导出 JSON（弹出保存对话框）
ipcMain.handle('subscriptions:exportJSON', async () => {
  const data = loadData();
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出订阅数据',
    defaultPath: `subscriptions-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(res.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, filePath: res.filePath, count: (data.subscriptions || []).length };
});

// IPC: 导出 CSV（带 UTF-8 BOM，Excel 中文不乱码）
ipcMain.handle('subscriptions:exportCSV', async () => {
  const data = loadData();
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出为 CSV',
    defaultPath: `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  const bom = '\ufeff';
  fs.writeFileSync(res.filePath, bom + utils.toCSV(data.subscriptions), 'utf-8');
  return { ok: true, filePath: res.filePath, count: (data.subscriptions || []).length };
});

// IPC: 导入数据（自动识别 JSON / CSV，按名称+周期去重合并）
ipcMain.handle('subscriptions:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择导入文件',
    filters: [
      { name: '数据文件', extensions: ['json', 'csv'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'CSV', extensions: ['csv'] }
    ],
    properties: ['openFile']
  });
  if (res.canceled || res.filePaths.length === 0) return { ok: false, canceled: true };
  const filePath = res.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  try {
    const txt = fs.readFileSync(filePath, 'utf-8');
    let incoming = [];
    if (ext === '.csv') {
      incoming = utils.fromCSV(txt);
    } else {
      // JSON：兼容数组或 { subscriptions: [...] }
      const parsed = JSON.parse(txt);
      incoming = Array.isArray(parsed) ? parsed : (parsed.subscriptions || []);
    }
    const data = loadData();
    const existing = new Set(data.subscriptions.map(s => s.name + '|' + s.cycle));
    let added = 0;
    for (const sub of incoming) {
      if (!sub || !sub.name) continue;
      const key = sub.name + '|' + (sub.cycle || 'monthly');
      if (existing.has(key)) continue;
      data.subscriptions.push({
        id: 'imp' + Date.now() + '_' + added + '_' + Math.random().toString(36).slice(2, 6),
        name: sub.name,
        price: Number(sub.price) || 0,
        cycle: sub.cycle || 'monthly',
        startDate: sub.startDate || new Date().toISOString().slice(0, 10),
        category: sub.category || '其他',
        note: sub.note || '',
        active: sub.active === false ? false : true
      });
      existing.add(key);
      added++;
    }
    saveData(data);
    return { ok: true, added, total: data.subscriptions.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// 启动时检查续费提醒
function checkRenewals() {
  const data = loadData();
  const stats = utils.computeStats(data.subscriptions);
  const reminderDays = (data.settings && data.settings.reminderDays) || 3;
  for (const sub of stats.upcoming) {
    if (sub.daysLeft <= reminderDays) {
      if (Notification.isSupported()) {
        new Notification({
          title: '订阅续费提醒',
          body: `${sub.name} 将在 ${sub.daysLeft} 天后续费（${sub.renewalDate}）`
        }).show();
      }
    }
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  // 延迟检查续费
  setTimeout(checkRenewals, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', (e) => {
  // 截图模式：正常退出
  if (process.env.SUB_MGR_SCREENSHOT) return;
  // 关闭窗口时不退出，保留托盘
  if (process.platform !== 'darwin') {
    e.preventDefault();
  }
});

app.on('before-quit', () => {
  if (tray) { tray.destroy(); tray = null; }
});
