'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { PomodoroCore } = require('./core/pomodoro-core');

let mainWindow = null;
let tray = null;
let core = null;
let tickInterval = null;
let storePath = path.join(app.getPath('userData'), 'pomodoro-data.json');
let trayHintShown = false; // 是否已提示过"已最小化到托盘"

// ---- 持久化 ----
function loadData() {
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('读取数据失败:', e.message);
  }
  return null;
}

function saveData() {
  try {
    fs.writeFileSync(storePath, JSON.stringify(core.serialize(), null, 2), 'utf-8');
  } catch (e) {
    console.error('保存数据失败:', e.message);
  }
}

function initCore() {
  const data = loadData();
  core = PomodoroCore.deserialize(data || {});
  core.rebuildStreak();
}

// 截图模式：注入演示数据（仅内存，不持久化），让界面展示更饱满
function seedDemoData() {
  core.tasks = [
    { id: 'demo1', title: '完成产品需求文档', estimate: 3, pomodoros: 2, completed: false, createdAt: Date.now() },
    { id: 'demo2', title: '审阅代码 Pull Request', estimate: 2, pomodoros: 1, completed: false, createdAt: Date.now() + 1 },
    { id: 'demo3', title: '回复客户邮件', estimate: 1, pomodoros: 1, completed: true, createdAt: Date.now() + 2, completedAt: Date.now() + 3 },
    { id: 'demo4', title: '准备明日会议演示', estimate: 4, pomodoros: 0, completed: false, createdAt: Date.now() + 4 },
    { id: 'demo5', title: '整理本周工作周报', estimate: 2, pomodoros: 0, completed: false, createdAt: Date.now() + 5 },
    { id: 'demo6', title: '设计评审会议纪要', estimate: 1, pomodoros: 0, completed: false, createdAt: Date.now() + 6 }
  ];
  core.currentTaskId = 'demo1';
  const today = core._todayKey();
  core._ensureStat(today);
  core.stats[today] = { workSessions: 3, totalMinutes: 75 };
  // 最近 6 天演示统计
  const now = new Date();
  const demos = [5, 3, 6, 4, 7, 2];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = core._todayKey(d);
    core.stats[key] = { workSessions: demos[i - 1], totalMinutes: demos[i - 1] * 25 };
  }
  core.streak = 4;
  core.state = 'working';
  core.remainingMs = 24 * 60 * 1000 + 54 * 1000;
  core.cycleCount = 2;
  // 热力图演示数据：最近 12 周，工作日偏多、周末偏少，模拟真实专注规律
  const todayBase = new Date(); todayBase.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 84; i++) {
    const d = new Date(todayBase);
    d.setDate(d.getDate() - i);
    if (d.getTime() >= now.getTime() - 6 * 86400000) continue;
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const recencyBoost = i < 35 ? 2 : (i < 63 ? 1 : 0);
    let ws;
    if (isWeekend) {
      ws = Math.random() < 0.45 ? Math.floor(Math.random() * 3) : 0;
    } else {
      const base2 = 3 + recencyBoost;
      ws = Math.max(0, base2 + Math.floor(Math.random() * 4) - 2);
    }
    if (ws > 0) {
      const key = core._todayKey(d);
      core.stats[key] = { workSessions: ws, totalMinutes: ws * 25 };
    }
  }
}

// ---- 计时循环 ----
function startTicking() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    if (core.state === 'idle' || core.state === 'paused') return;
    const event = core.tick(1);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tick', {
        state: core.state,
        remainingMs: core.remainingMs,
        progress: core.progress(),
        cycleCount: core.cycleCount
      });
    }
    updateTray();
    if (event) {
      handlePhaseChange(event);
    }
    // 每秒不需要存盘，阶段切换时存
  }, 1000);
}

function handlePhaseChange(event) {
  saveData();
  // 自动开始控制：若关闭自动开始休息/工作，则暂停下一阶段等待用户操作
  let pausedForAutoStart = false;
  if (event.completedWork && core.config.autoStartBreak === false) {
    core.pause();
    pausedForAutoStart = true;
  } else if (event.nextPhase === 'working' && core.config.autoStartWork === false) {
    core.pause();
    pausedForAutoStart = true;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('phase', {
      state: core.state,
      remainingMs: core.remainingMs,
      cycleCount: core.cycleCount,
      event,
      pausedForAutoStart
    });
  }
  // 通知
  let title = '', body = '';
  if (event.skipped) {
    // 跳过：不播放提示音，仅轻量通知
    title = '已跳过';
    body = event.nextPhase === 'working' ? '休息已跳过，开始专注吧' : '专注已跳过，进入休息';
  } else if (event.completedWork) {
    title = '番茄完成 🍅';
    body = `已完成 ${event.workSessionsToday} 个番茄，进入${event.nextPhase === 'long_break' ? '长休息' : '短休息'}`;
    playChime();
  } else if (event.nextPhase === 'working') {
    title = '休息结束';
    body = '开始下一个番茄吧';
    playChime();
  }
  if (title && Notification.isSupported()) {
    const n = new Notification({ title, body, silent: true });
    n.on('click', () => showWindow());
    n.show();
  }
  updateTray();
}

// 合成提示音（无需外部音频文件）
function playChime() {
  if (!core.config.soundEnabled) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notify', { type: 'chime' });
  }
}

// ---- 窗口 ----
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 860,
    minHeight: 700,
    show: false,
    frame: true,
    autoHideMenuBar: true,
    title: '番茄管家',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    // 不主动 show，避免打扰；由托盘或用户决定
  });
  // 关闭时隐藏到托盘
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      // 首次最小化到托盘时提示用户，避免误以为程序退出
      if (!trayHintShown && tray) {
        trayHintShown = true;
        tray.displayBalloon({
          iconType: 'info',
          title: '番茄管家',
          content: '已最小化到托盘，点击托盘图标可恢复窗口'
        });
      }
    }
  });
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ---- 托盘 ----
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
  updateTray();
  tray.on('click', showWindow);
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: '显示主窗口', click: showWindow },
      { type: 'separator' },
      { label: '开始/暂停', click: () => { toggleTimer(); } },
      { label: '重置', click: () => { core.reset(); saveData(); broadcastState(); updateTray(); } },
      { type: 'separator' },
      { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.popUpContextMenu(menu);
  });
}

function toggleTimer() {
  if (core.state === 'idle') {
    core.start();
  } else if (core.state === 'paused') {
    core.resume();
  } else {
    core.pause();
  }
  saveData();
  broadcastState();
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const time = PomodoroCore.formatTime(core.remainingMs);
  const phaseLabel = ({
    idle: '空闲',
    working: '专注中',
    short_break: '短休息',
    long_break: '长休息',
    paused: '已暂停'
  })[core.state];
  tray.setToolTip(`番茄管家 - ${phaseLabel} ${time}`);
  const menu = Menu.buildFromTemplate([
    { label: `${phaseLabel}  ${time}`, enabled: false },
    { label: `今日 ${core.todayStats().workSessions} / ${core.config.dailyGoal} 🍅`, enabled: false },
    { label: `连续 ${core.streak} 天`, enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: showWindow },
    { label: core.state === 'idle' || core.state === 'paused' ? '开始' : '暂停', click: toggleTimer },
    { label: '重置', click: () => { core.reset(); saveData(); broadcastState(); updateTray(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
}

function broadcastState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('phase', {
      state: core.state,
      remainingMs: core.remainingMs,
      cycleCount: core.cycleCount,
      full: true
    });
  }
}

// ---- IPC ----
function registerIpc() {
  ipcMain.handle('state:get', () => {
    return {
      ...core.serialize(),
      today: core.todayStats(),
      week: core.weekStats(),
      weekDaily: core.weekDaily(),
      total: core.totalStats(),
      thisWeek: core.thisWeekStats(),
      heatmap: core.heatmapData(13),
      progress: core.progress()
    };
  });
  ipcMain.handle('timer:start', () => {
    if (core.state === 'idle') core.start();
    else if (core.state === 'paused') core.resume();
    saveData();
    broadcastState();
    updateTray();
    return true;
  });
  ipcMain.handle('timer:pause', () => {
    core.pause();
    saveData();
    broadcastState();
    updateTray();
    return true;
  });
  ipcMain.handle('timer:resume', () => {
    core.resume();
    saveData();
    broadcastState();
    updateTray();
    return true;
  });
  ipcMain.handle('timer:reset', () => {
    core.reset();
    saveData();
    broadcastState();
    updateTray();
    return true;
  });
  ipcMain.handle('timer:skip', () => {
    const ev = core.skip();
    saveData();
    broadcastState();
    if (ev) handlePhaseChange(ev);
    return ev;
  });
  ipcMain.handle('timer:switch', (e, phase) => {
    const ok = core.switchPhase(phase);
    if (!ok) return false;
    saveData();
    broadcastState();
    updateTray();
    return true;
  });
  ipcMain.handle('task:add', (e, title, estimate) => {
    const t = core.addTask(title, estimate);
    // 首次添加任务或当前无选中任务时，自动设为当前任务，减少操作步数
    if (t && !core.currentTaskId && !t.completed) {
      core.setCurrentTask(t.id);
    }
    saveData();
    broadcastState();
    return t;
  });
  ipcMain.handle('task:addRaw', (e, task) => {
    // 以原始对象恢复任务（撤销删除用），保留 id/pomodoros/createdAt
    const restored = core.addTaskRaw(task);
    saveData();
    broadcastState();
    return restored;
  });
  ipcMain.handle('task:current', (e, id) => {
    core.setCurrentTask(id);
    saveData();
    broadcastState();
    return true;
  });
  ipcMain.handle('task:complete', (e, id) => {
    core.completeTask(id);
    saveData();
    broadcastState();
    return true;
  });
  ipcMain.handle('task:uncomplete', (e, id) => {
    core.uncompleteTask(id);
    saveData();
    broadcastState();
    return true;
  });
  ipcMain.handle('task:update', (e, id, updates) => {
    const ok = core.updateTask(id, updates || {});
    if (ok) { saveData(); broadcastState(); }
    return ok;
  });
  ipcMain.handle('task:delete', (e, id) => {
    core.deleteTask(id);
    saveData();
    broadcastState();
    return true;
  });
  ipcMain.handle('config:save', (e, cfg) => {
    Object.assign(core.config, cfg);
    core.rebuildStreak();
    saveData();
    broadcastState();
    updateTray();
    return true;
  });
  ipcMain.handle('data:export', () => {
    return JSON.stringify(core.serialize(), null, 2);
  });
  ipcMain.handle('data:import', (e, json) => {
    const data = JSON.parse(json);
    core = PomodoroCore.deserialize(data);
    core.rebuildStreak();
    saveData();
    broadcastState();
    updateTray();
    return true;
  });
}

// ---- 单实例锁 ----
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { showWindow(); });

  app.whenReady().then(() => {
    initCore();
    if (process.argv.includes('--screenshot')) seedDemoData();
    createWindow();
    createTray();
    registerIpc();
    startTicking();
    // 启动后默认不显示窗口（托盘常驻），但首次启动显示一次方便了解
    if (mainWindow) {
      if (process.argv.includes('--screenshot')) {
        mainWindow.showInactive(); // 截图模式：显示但不抢焦点
      } else {
        mainWindow.show();
      }
    }
  });

  app.on('window-all-closed', (e) => {
    // 不退出，留在托盘
    e.preventDefault();
  });
  app.on('before-quit', () => { app.isQuitting = true; });
}
