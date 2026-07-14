// 闹钟管家 - 主进程
// 负责：窗口管理、托盘、全局快捷键、IPC、闹钟调度循环、系统通知、铃声触发

const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, Notification, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store.js');
const engine = require('./alarm-engine.js');
const lunar = require('./lunar.js');

// 单实例锁：防止多开
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let triggerWindow = null;
let tray = null;
let data = null;
let dataFile = null;
let schedulerTimer = null;
let lastCheckTime = Date.now();

// 数据文件路径（固定路径，与 store.js DEFAULT_FILE 一致）
function getDataFile() {
  return path.join(process.env.APPDATA || process.env.HOME || app.getPath('userData'), 'alarm-manager', 'alarms.json');
}

// 加载或初始化数据
function ensureData() {
  if (!dataFile) dataFile = getDataFile();
  data = store.load(dataFile);
  // 启动时刷新所有 nextTrigger
  const now = Date.now();
  (data.alarms || []).forEach(a => {
    if (a.enabled) {
      a.nextTrigger = engine.nextTrigger(a, now);
    }
  });
  persist();
}

// 持久化
function persist() {
  if (!data || !dataFile) return;
  store.save(data, dataFile);
}

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    show: false,           // 默认隐藏到托盘
    frame: true,
    autoHideMenuBar: true,
    title: '闹钟管家',
    backgroundColor: '#f5f5f7',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 关闭时隐藏到托盘，不退出
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 启动时如果带 --show 参数，则显示窗口
  if (process.argv.includes('--show')) {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  }
}

// 创建触发窗口（用于闹钟触发时显示 + 播放铃声）
function createTriggerWindow() {
  triggerWindow = new BrowserWindow({
    width: 560,
    height: 420,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#ffffff',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  triggerWindow.loadFile(path.join(__dirname, 'trigger.html'));
  triggerWindow.on('closed', () => {
    triggerWindow = null;
  });
}

// 显示主窗口（从托盘唤起）
function showMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  } else {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  }
}

// 触发闹钟
function fireAlarm(alarm) {
  // 1. 系统通知
  if (Notification.isSupported() && data.settings.notificationEnabled) {
    const n = new Notification({
      title: '⏰ 闹钟响铃：' + (alarm.label || '闹钟'),
      body: '现在时间 ' + formatTime(new Date()) + ' · 点击查看',
      silent: true,                       // 我们自己合成铃声
      icon: getIconPath()
    });
    n.on('click', () => {
      showMainWindow();
    });
    n.show();
  }

  // 2. 显示触发窗口 + 播放铃声
  if (!triggerWindow) createTriggerWindow();
  triggerWindow.once('ready-to-show', () => {
    triggerWindow.show();
    triggerWindow.focus();
    triggerWindow.webContents.send('trigger:fire', {
      alarm: alarm,
      settings: data.settings
    });
  });
  // 如果窗口已经加载好，直接发消息
  if (triggerWindow.webContents.isLoading() === false) {
    triggerWindow.show();
    triggerWindow.focus();
    triggerWindow.webContents.send('trigger:fire', {
      alarm: alarm,
      settings: data.settings
    });
  }

  // 3. 通知主窗口（用于刷新 UI 状态）
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('alarm:fired', alarm);
  }

  // 4. 更新闹钟状态（lastTriggered、nextTrigger）
  engine.afterFired(alarm, Date.now());
  store.appendLog(data, {
    type: 'fired',
    alarmId: alarm.id,
    label: alarm.label,
    time: alarm.hour + ':' + alarm.minute
  });
  persist();
}

// 调度循环：每秒检查
function schedulerTick() {
  if (!data) return;
  const now = Date.now();
  let fired = false;
  for (const alarm of data.alarms) {
    if (!alarm.enabled) continue;
    if (engine.shouldFire(alarm, now, lastCheckTime)) {
      fired = true;
      fireAlarm(alarm);
    }
  }
  lastCheckTime = now;
  // 每分钟发送一次 tick，让渲染进程刷新倒计时
  if (now % 60000 < 1000 || fired) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tick', { now: now });
    }
  }
}

function formatTime(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return hh + ':' + mm;
}

// 获取图标路径（不存在则返回空，使用 Electron 默认图标）
function getIconPath() {
  const candidates = [
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(__dirname, 'assets', 'icon.ico')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// 创建托盘
function createTray() {
  const iconPath = getIconPath();
  let icon;
  if (iconPath) {
    icon = nativeImage.createFromPath(iconPath);
    icon.setTemplateImage(false);  // 我们使用彩色图标
  } else {
    // 兜底：1x1 蓝色 PNG（base64）
    icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAJUlEQVR4nO3PMQ0AIAzAsCH/jNC7AV+QyiBdE4o3AAAAAAAAAADv8w0H8Y09vTcU4lsAAAAASUVORK5CYII=');
  }
  tray = new Tray(icon);
  updateTrayMenu();
  tray.setToolTip('闹钟管家 · 点击打开');
  tray.on('click', () => {
    showMainWindow();
  });
}

// 更新托盘菜单（含下一闹钟提示）
function updateTrayMenu() {
  if (!tray) return;
  const now = Date.now();
  const next = (data.alarms || [])
    .filter(a => a.enabled && a.nextTrigger)
    .sort((a, b) => a.nextTrigger - b.nextTrigger)[0];
  const subtitle = next
    ? '下一闹钟：' + (next.label || '闹钟') + ' · ' + engine.describeNextTime(next.nextTrigger)
    : '无活动闹钟';
  const menu = Menu.buildFromTemplate([
    { label: '⏰ 闹钟管家', enabled: false },
    { label: subtitle, enabled: false },
    { type: 'separator' },
    { label: '打开主窗口', click: () => showMainWindow() },
    { label: '快速添加闹钟...', click: () => {
        showMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('trigger:show');
        }
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip('闹钟管家 · ' + subtitle);
}

// 注册全局快捷键
function registerShortcut() {
  // 默认 Ctrl+Alt+A 唤起主窗口
  try {
    const ret = globalShortcut.register('CommandOrControl+Alt+A', () => {
      showMainWindow();
    });
    if (!ret) console.warn('全局快捷键注册失败');
  } catch (e) {
    console.warn('全局快捷键注册异常:', e.message);
  }
}

// ============ IPC handlers ============

ipcMain.handle('store:load', () => {
  return data;
});

ipcMain.handle('store:save', (e, newData) => {
  data = Object.assign({}, data, newData);
  persist();
  return true;
});

ipcMain.handle('alarm:upsert', (e, alarm) => {
  if (!alarm || !alarm.id) {
    alarm = engine.createAlarm(alarm);
    data.alarms.push(alarm);
  } else {
    const idx = data.alarms.findIndex(a => a.id === alarm.id);
    if (idx >= 0) {
      // 合并并重新计算 nextTrigger
      alarm.nextTrigger = engine.nextTrigger(alarm);
      data.alarms[idx] = alarm;
    } else {
      alarm.nextTrigger = engine.nextTrigger(alarm);
      data.alarms.push(alarm);
    }
  }
  persist();
  updateTrayMenu();
  return alarm;
});

ipcMain.handle('alarm:delete', (e, id) => {
  data.alarms = data.alarms.filter(a => a.id !== id);
  persist();
  updateTrayMenu();
  return true;
});

ipcMain.handle('alarm:toggle', (e, id, enabled) => {
  const a = data.alarms.find(x => x.id === id);
  if (a) {
    a.enabled = !!enabled;
    a.nextTrigger = a.enabled ? engine.nextTrigger(a) : null;
    a.snoozeCount = 0;
    persist();
    updateTrayMenu();
    return a;
  }
  return null;
});

ipcMain.handle('alarm:snooze', (e, id) => {
  const a = data.alarms.find(x => x.id === id);
  if (a) {
    const ok = engine.snooze(a, Date.now());
    persist();
    updateTrayMenu();
    return ok;
  }
  return false;
});

ipcMain.handle('alarm:dismiss', (e, id) => {
  const a = data.alarms.find(x => x.id === id);
  if (a) {
    a.snoozeCount = 0;
    a.nextTrigger = engine.nextTrigger(a, Date.now());
    persist();
    updateTrayMenu();
  }
  // 关闭触发窗口
  if (triggerWindow) {
    triggerWindow.hide();
  }
  return true;
});

ipcMain.handle('alarm:test', (e, id) => {
  const a = data.alarms.find(x => x.id === id);
  if (a) {
    fireAlarm(a);
    return true;
  }
  return false;
});

ipcMain.handle('settings:update', (e, settings) => {
  data.settings = Object.assign({}, data.settings, settings || {});
  persist();
  return data.settings;
});

ipcMain.handle('data:export', () => {
  return store.exportJson(data);
});

ipcMain.handle('data:import', (e, text) => {
  try {
    const imported = store.importJson(text);
    data = imported;
    persist();
    updateTrayMenu();
    return true;
  } catch (err) {
    return false;
  }
});

// 触发窗口请求关闭（dismiss 或 snooze 后）
ipcMain.handle('trigger:close', () => {
  if (triggerWindow) triggerWindow.hide();
  return true;
});

// 主窗口请求聚焦
ipcMain.on('main:focus', () => {
  showMainWindow();
});

// ============ 应用生命周期 ============

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureData();
  createMainWindow();
  createTriggerWindow();
  createTray();
  registerShortcut();

  // 启动调度循环：每秒检查
  schedulerTimer = setInterval(schedulerTick, 1000);
  lastCheckTime = Date.now();

  // 不显示主窗口（隐藏到托盘）；除非带 --show
});

app.on('second-instance', () => {
  showMainWindow();
});

app.on('window-all-closed', (e) => {
  // 不退出，留在托盘
  e.preventDefault();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  // 注销全局快捷键
  globalShortcut.unregisterAll();
  if (schedulerTimer) clearInterval(schedulerTimer);
});
