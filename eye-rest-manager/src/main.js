// main.js — Electron 主进程
// 职责：创建主窗口/休息覆盖层/托盘、调度休息计时器、IPC 通信、数据持久化
'use strict';

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, Notification, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./core/store');
const engine = require('./core/break-engine');
const stats = require('./core/stats-utils');

const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';
const APP_NAME = '护眼管家';

let mainWindow = null;
let overlayWindow = null;
let tray = null;

// 调度状态
let state = engine.STATES.IDLE;
let settings = null;
let nextBreak = null;          // { type, time: Date, durationSec }
let warningFired = false;      // 预警通知是否已发
let pauseUntil = null;         // 暂停截止时刻 (Date)
let timerHandle = null;        // 主调度循环 setInterval 句柄

// === 数据文件路径 ===
function userDataDir() {
  const dir = path.join(app.getPath('userData'), 'eye-rest-data-v1');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function settingsFile() { return path.join(userDataDir(), store.SETTINGS_FILE); }
function historyFile()  { return path.join(userDataDir(), store.HISTORY_FILE); }

// === 窗口创建 ===
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 1140,
    minWidth: 880,
    minHeight: 720,
    title: APP_NAME,
    backgroundColor: '#f5f5f7',
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

function createOverlayWindow(breakInfo) {
  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  const strict = !!(settings && settings.strictMode);
  overlayWindow = new BrowserWindow({
    width: Math.min(primary.workAreaSize.width, 1100),
    height: Math.min(primary.workAreaSize.height, 760),
    x: primary.workArea.x + Math.floor((primary.workAreaSize.width - Math.min(primary.workAreaSize.width, 1100)) / 2),
    y: primary.workArea.y + Math.floor((primary.workAreaSize.height - Math.min(primary.workAreaSize.height, 760)) / 2),
    frame: true,
    resizable: true,
    minimizable: !strict,
    maximizable: false,
    closable: !strict,
    alwaysOnTop: strict,
    skipTaskbar: false,
    backgroundColor: '#f5f5f7',
    title: '休息一下 · ' + APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '..', 'build', 'icon.ico')
  });
  // 严格模式下拦截 Alt+F4 和系统菜单的关闭
  if (strict) {
    overlayWindow.on('close', (e) => {
      // 倒计时未结束前阻止关闭
      if (!overlayWindow.__breakFinished) e.preventDefault();
    });
  }
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.show();
    overlayWindow.focus();
    overlayWindow.webContents.send('break-start', { ...breakInfo, strictMode: strict });
  });
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

// === 托盘 ===
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
  updateTrayMenu();
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const label = buildTrayLabel();
  const menu = Menu.buildFromTemplate([
    { label, enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: '立即休息', click: () => triggerBreakNow('micro') },
    { type: 'separator' },
    {
      label: state === engine.STATES.PAUSED ? '恢复提醒' : '暂停 30 分钟',
      click: () => {
        if (state === engine.STATES.PAUSED) resumeSchedule();
        else pauseFor(30);
      }
    },
    {
      label: '暂停 1 小时',
      click: () => pauseFor(60),
      enabled: state !== engine.STATES.PAUSED
    },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); }
    }
  ]);
  tray.setContextMenu(menu);
}

function buildTrayLabel() {
  if (state === engine.STATES.PAUSED) {
    const left = pauseUntil ? Math.max(0, Math.ceil((pauseUntil.getTime() - Date.now()) / 60000)) : 0;
    return `${APP_NAME} · 已暂停 ${left} 分钟`;
  }
  if (state === engine.STATES.BREAK) return `${APP_NAME} · 休息中`;
  if (!nextBreak) return APP_NAME;
  const sec = Math.max(0, Math.ceil((nextBreak.time.getTime() - Date.now()) / 1000));
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  const typeLabel = nextBreak.type === 'micro' ? '微休息' : (nextBreak.type === 'short' ? '短休息' : '长休息');
  return `${APP_NAME} · 距${typeLabel} ${min}:${String(s).padStart(2, '0')}`;
}

// === 调度核心 ===

function loadInitialSettings() {
  settings = store.loadSettings(settingsFile());
  return settings;
}

// 首次运行注入演示历史：过去 7 天分布一些完成/跳过记录，让统计图表有内容
function seedDemoHistory() {
  const now = Date.now();
  const demo = [];
  // 过去 6 天，每天 3-6 次完成 + 0-1 次跳过（确定性数据保证图表满柱）
  const dailyCounts = [3, 5, 4, 6, 3, 5]; // 过去 6 天每天的完成数
  for (let d = 6; d >= 1; d--) {
    const dayBase = now - d * 86400000;
    const completedCount = dailyCounts[6 - d];
    for (let i = 0; i < completedCount; i++) {
      const ts = new Date(dayBase - i * 25 * 60 * 1000);
      demo.push({
        ts: ts.toISOString(),
        type: i % 5 === 0 ? 'short' : 'micro',
        action: 'completed',
        durationSec: i % 5 === 0 ? 180 : 20
      });
    }
    // 每 2 天有 1 次跳过
    if (d % 2 === 0) {
      demo.push({
        ts: new Date(dayBase - 50 * 60 * 1000).toISOString(),
        type: 'micro',
        action: 'skipped',
        durationSec: 0
      });
    }
  }
  // 今天：3 次完成 + 1 次跳过
  demo.push({ ts: new Date(now - 90 * 60 * 1000).toISOString(), type: 'micro', action: 'completed', durationSec: 20 });
  demo.push({ ts: new Date(now - 60 * 60 * 1000).toISOString(), type: 'micro', action: 'skipped', durationSec: 0 });
  demo.push({ ts: new Date(now - 30 * 60 * 1000).toISOString(), type: 'micro', action: 'completed', durationSec: 20 });
  demo.push({ ts: new Date(now - 15 * 60 * 1000).toISOString(), type: 'short', action: 'completed', durationSec: 180 });
  store.saveHistory(historyFile(), demo);
}

// 计算下一次休息（从某个时刻起）
function recomputeNextBreak(fromTime) {
  const list = engine.scheduleNextBreaks(settings, fromTime);
  nextBreak = list.length > 0 ? list[0] : null;
  warningFired = false;
}

// 主调度循环：每秒检查一次
function startTickLoop() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => onTick(), 1000);
}

function onTick() {
  const now = new Date();
  // 暂停态：检查是否到恢复时间
  if (state === engine.STATES.PAUSED) {
    if (pauseUntil && now.getTime() >= pauseUntil.getTime()) {
      resumeSchedule();
    } else {
      updateTrayMenu();
      return;
    }
  }
  // 免打扰时段：跳过本次休息，重新调度到时段结束后
  if (engine.isInDND(now, settings.dnd)) {
    if (nextBreak && nextBreak.time.getTime() <= now.getTime()) {
      // 推迟 1 分钟后再判断
      nextBreak.time = new Date(now.getTime() + 60 * 1000);
      warningFired = false;
    }
    broadcastCountdown();
    return;
  }
  // 全屏抑制：检测当前是否有窗口全屏，是则推迟休息
  if (settings.fullscreenSuppress && isAnyWindowFullscreen()) {
    if (nextBreak && nextBreak.time.getTime() <= now.getTime()) {
      nextBreak.time = new Date(now.getTime() + 60 * 1000);
      warningFired = false;
    }
    broadcastCountdown();
    return;
  }

  if (state === engine.STATES.BREAK) return; // 休息中由覆盖层自行计时

  if (!nextBreak) {
    recomputeNextBreak(now);
  }

  const secToBreak = engine.secondsBetween(now, nextBreak.time);
  const newState = engine.nextIdleState(secToBreak, settings);

  // 进入预警态时发通知
  if (newState === engine.STATES.WARNING && !warningFired) {
    warningFired = true;
    fireWarningNotification(nextBreak);
  }

  // 进入休息态
  if (newState === engine.STATES.BREAK) {
    triggerBreakNow(nextBreak.type);
    return;
  }

  state = newState;
  updateTrayMenu();
  broadcastCountdown();
}

// 触发一次休息
function triggerBreakNow(type) {
  const cfg = settings.breaks[type] || settings.breaks.micro;
  const breakInfo = {
    type,
    durationSec: cfg.duration,
    startedAt: new Date().toISOString()
  };
  state = engine.STATES.BREAK;
  createOverlayWindow(breakInfo);
  updateTrayMenu();
  if (mainWindow) mainWindow.webContents.send('state-changed', { state, breakInfo });
}

// 休息覆盖层结束（完成/跳过/延后）
function finishBreak(action, durationSec) {
  if (!nextBreak) return;
  const type = nextBreak.type;
  store.appendHistory(historyFile(), {
    type,
    action,           // 'completed' | 'skipped' | 'snoozed'
    durationSec
  });
  // 关闭覆盖层
  if (overlayWindow) {
    overlayWindow.__breakFinished = true;
    try { overlayWindow.close(); } catch (e) {}
    overlayWindow = null;
  }
  state = engine.STATES.IDLE;
  if (action === 'snoozed') {
    // 延后 5 分钟再提醒
    nextBreak = {
      type,
      time: new Date(Date.now() + 5 * 60 * 1000),
      durationSec: nextBreak.durationSec
    };
  } else {
    // 完成或跳过：按当前时刻重新调度
    recomputeNextBreak(new Date());
  }
  warningFired = false;
  updateTrayMenu();
  if (mainWindow) mainWindow.webContents.send('state-changed', { state, breakInfo: null });
  if (mainWindow) mainWindow.webContents.send('stats-updated', null);
}

// 暂停 N 分钟
function pauseFor(minutes) {
  pauseUntil = new Date(Date.now() + minutes * 60 * 1000);
  state = engine.STATES.PAUSED;
  if (Notification && settings.sound !== false) {
    new Notification({ title: APP_NAME, body: `已暂停 ${minutes} 分钟`, silent: true }).show();
  }
  updateTrayMenu();
  if (mainWindow) mainWindow.webContents.send('state-changed', { state, paused: true, minutes });
}

// 恢复调度
function resumeSchedule() {
  state = engine.STATES.IDLE;
  pauseUntil = null;
  recomputeNextBreak(new Date());
  updateTrayMenu();
  if (mainWindow) mainWindow.webContents.send('state-changed', { state, paused: false });
}

// 预警通知
function fireWarningNotification(b) {
  if (!Notification) return;
  const typeLabel = b.type === 'micro' ? '微休息' : (b.type === 'short' ? '短休息' : '长休息');
  const n = new Notification({
    title: APP_NAME,
    body: `${typeLabel}马上开始，请准备好放下手头工作`,
    silent: !settings.sound
  });
  n.show();
}

// 检测是否有窗口全屏（简单实现：枚举所有窗口找是否有最大化全屏）
function isAnyWindowFullscreen() {
  const wins = BrowserWindow.getAllWindows();
  for (const w of wins) {
    if (!w.isVisible()) continue;
    if (w.isFullScreen()) return true;
  }
  return false;
}

// 把当前倒计时推给主窗口渲染层
function broadcastCountdown() {
  if (!mainWindow) return;
  const sec = nextBreak
    ? Math.max(0, Math.ceil((nextBreak.time.getTime() - Date.now()) / 1000))
    : 0;
  mainWindow.webContents.send('countdown', {
    state,
    secondsToBreak: sec,
    nextType: nextBreak ? nextBreak.type : null,
    nextTime: nextBreak ? nextBreak.time.toISOString() : null,
    paused: state === engine.STATES.PAUSED,
    pauseMinutesLeft: pauseUntil ? Math.max(0, Math.ceil((pauseUntil.getTime() - Date.now()) / 60000)) : 0
  });
}

// === 启动 ===
app.whenReady().then(() => {
  loadInitialSettings();
  // 首次运行或截图演示模式：注入演示历史数据，让统计图表有内容可看
  if (!fs.existsSync(historyFile()) || process.argv.includes('--screenshot-demo')) {
    seedDemoHistory();
  }
  createMainWindow();
  createTray();
  recomputeNextBreak(new Date());
  // 截图演示模式：让倒计时显示部分消耗状态（5 分钟后休息，圆环显示 75%）
  if (process.argv.includes('--screenshot-demo') && nextBreak) {
    nextBreak.time = new Date(Date.now() + 5 * 60 * 1000);
  }
  startTickLoop();

  // 系统休眠恢复后，重新调度
  powerMonitor.on('resume', () => {
    recomputeNextBreak(new Date());
    state = engine.STATES.IDLE;
    updateTrayMenu();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// === IPC ===

ipcMain.handle('get-settings', async () => {
  return store.loadSettings(settingsFile());
});

ipcMain.handle('save-settings', async (event, patch) => {
  const current = store.loadSettings(settingsFile());
  const merged = Object.assign({}, current, patch || {});
  if (patch && patch.breaks) {
    merged.breaks = Object.assign({}, current.breaks, patch.breaks);
  }
  if (patch && patch.warning) {
    merged.warning = Object.assign({}, current.warning, patch.warning);
  }
  if (patch && patch.dnd) {
    merged.dnd = Object.assign({}, current.dnd, patch.dnd);
  }
  settings = store.saveSettings(settingsFile(), merged);
  // 设置变更后重新调度
  recomputeNextBreak(new Date());
  return settings;
});

ipcMain.handle('get-state', async () => ({
  state,
  nextType: nextBreak ? nextBreak.type : null,
  nextTime: nextBreak ? nextBreak.time.toISOString() : null,
  secondsToBreak: nextBreak ? Math.max(0, Math.ceil((nextBreak.time.getTime() - Date.now()) / 1000)) : 0,
  paused: state === engine.STATES.PAUSED,
  pauseMinutesLeft: pauseUntil ? Math.max(0, Math.ceil((pauseUntil.getTime() - Date.now()) / 60000)) : 0
}));

ipcMain.handle('pause', async (event, minutes) => {
  pauseFor(Math.max(1, Number(minutes) || 30));
  return true;
});

ipcMain.handle('resume', async () => {
  resumeSchedule();
  return true;
});

ipcMain.handle('trigger-break', async (event, type) => {
  triggerBreakNow(type || (nextBreak ? nextBreak.type : 'micro'));
  return true;
});

// 由覆盖层调用：报告本次休息结果
ipcMain.handle('break-finished', async (event, payload) => {
  finishBreak(payload.action, payload.durationSec);
  return true;
});

ipcMain.handle('get-stats', async () => {
  const history = store.loadHistory(historyFile());
  return {
    today: stats.todaySummary(history),
    weekly: stats.weeklyChart(history),
    streak: stats.streakDays(history),
    lifetime: stats.lifetimeSummary(history)
  };
});

ipcMain.handle('get-history', async () => {
  return store.loadHistory(historyFile());
});

ipcMain.handle('clear-history', async () => {
  store.saveHistory(historyFile(), []);
  return true;
});

ipcMain.handle('export-data', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出数据',
    defaultPath: `eye-rest-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { cancelled: true };
  const data = store.exportAll(settingsFile(), historyFile());
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, path: result.filePath };
});

ipcMain.handle('import-data', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入数据',
    properties: ['openFile'],
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return { cancelled: true };
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const payload = JSON.parse(raw);
    const r = store.importAll(payload, settingsFile(), historyFile());
    settings = store.loadSettings(settingsFile());
    recomputeNextBreak(new Date());
    return { ok: true, ...r };
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

// 设置开机自启（写入注册表，仅 Windows）
ipcMain.handle('set-launch-at-login', async (event, enabled) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled });
    const cur = store.loadSettings(settingsFile());
    cur.launchAtLogin = !!enabled;
    store.saveSettings(settingsFile(), cur);
    settings = cur;
    return true;
  } catch (e) {
    return { error: e.message };
  }
});
