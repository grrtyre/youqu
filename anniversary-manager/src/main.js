// Electron 主进程
const { app, BrowserWindow, ipcMain, dialog, nativeImage, Tray, Menu, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { AnniversaryStore } = require('./core/store');
const { computeEventInfo } = require('./core/anniversary-core');
const { getUpcomingEvents, buildNotification } = require('./core/reminder-core');

function storePath() {
  return path.join(app.getPath('userData'), 'anniversaries.json');
}

let store;
let mainWindow;
let tray = null;
let checkTimer = null;
// 已发送通知的去重集合（进程内），避免定时检查重复弹通知
const sentNotifyKeys = new Set();

function ensureStore() {
  if (!store) store = new AnniversaryStore(storePath());
  return store;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function createWindow() {
  // 截图模式：窗口隐藏（show:false），用 capturePage 后台捕获渲染内容，不打扰用户
  const shotMode = !!process.env.AM_AUTO_SCREENSHOT;
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 980,
    minWidth: 940,
    minHeight: 640,
    show: !shotMode,
    title: '纪念日管家',
    backgroundColor: '#ffffff',
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

  if (process.env.AM_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 自动截图：环境变量指定输出路径
  if (process.env.AM_AUTO_SCREENSHOT) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          await new Promise((r) => setTimeout(r, 2500));
          const img = await mainWindow.webContents.capturePage();
          const buf = img.toPNG();
          fs.writeFileSync(process.env.AM_AUTO_SCREENSHOT, buf);
          console.log('[screenshot] saved:', process.env.AM_AUTO_SCREENSHOT, buf.length, 'bytes');
        } catch (e) {
          console.error('[screenshot] error:', e.message);
        }
      }, 600);
    });
  }

  // 关闭窗口时隐藏到托盘而非退出（提醒类应用需常驻后台）
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ===== 系统托盘 =====
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let trayIcon = nativeImage.createFromPath(iconPath);
  if (trayIcon.isEmpty()) {
    // 兜底：用 16x16 透明图避免崩溃
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  tray.setToolTip('纪念日管家');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => showMainWindow(),
    },
    {
      label: '立即检查提醒',
      click: () => {
        checkAndNotify(true);
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

// ===== 桌面通知 =====
// 检查即将到来的事件并发送桌面通知
// force: true 时忽略去重（用于托盘手动触发）
function checkAndNotify(force) {
  if (!Notification.isSupported()) return;
  const today = todayStr();
  const events = ensureStore().list();
  const upcoming = getUpcomingEvents(events, today, 7);

  for (const evt of upcoming) {
    const key = `${evt.id}_${today}_${evt.daysUntilNext}`;
    if (!force && sentNotifyKeys.has(key)) continue;
    const n = buildNotification(evt);
    if (!n) continue;

    const notif = new Notification({
      title: n.title,
      body: n.body,
      silent: false,
    });
    notif.on('click', () => {
      showMainWindow();
    });
    notif.show();
    sentNotifyKeys.add(key);
  }
}

// ===== 单实例锁 + 应用启动 =====
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 已有实例运行时，唤起主窗口
    showMainWindow();
  });

  app.whenReady().then(() => {
    // 测试/截图模式：清空旧数据，确保 seedDemo 会创建示例
    if (process.env.AM_DEMO || process.env.AM_AUTO_SCREENSHOT) {
      try {
        const p = storePath();
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (e) {
        console.warn('[test] failed to clear data:', e.message);
      }
    }
    ensureStore();
    ensureStore().seedDemo();
    createWindow();
    createTray();

    // 启动后延迟检查提醒（等窗口加载完，避免启动瞬间打扰）
    setTimeout(() => {
      checkAndNotify(false);
    }, 3000);

    // 每小时定时检查一次是否有事件进入提醒窗口
    checkTimer = setInterval(() => {
      checkAndNotify(false);
    }, 60 * 60 * 1000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
});

// ===== IPC =====
ipcMain.handle('anniv:list', () => {
  const today = todayStr();
  return ensureStore().list().map((e) => computeEventInfo(e, today));
});

ipcMain.handle('anniv:get', (e, id) => {
  const evt = ensureStore().get(id);
  return evt ? { ...evt } : null;
});

ipcMain.handle('anniv:create', (e, data) => {
  const evt = ensureStore().create(data || {});
  return computeEventInfo(evt, todayStr());
});

ipcMain.handle('anniv:update', (e, id, patch) => {
  const evt = ensureStore().update(id, patch || {});
  return computeEventInfo(evt, todayStr());
});

ipcMain.handle('anniv:remove', (e, id) => ensureStore().remove(id));

ipcMain.handle('anniv:export', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出纪念日数据',
    defaultPath: `anniversaries-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, ensureStore().exportJSON(), 'utf-8');
  return res.filePath;
});

ipcMain.handle('anniv:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择导入文件',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const txt = fs.readFileSync(res.filePaths[0], 'utf-8');
  const r = ensureStore().importJSON(txt);
  return r;
});

ipcMain.handle('anniv:today', () => todayStr());
