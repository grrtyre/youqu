// Electron 主进程 - 置顶管家
const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const { Win32Bridge } = require('./core/win32-bridge');
const store = require('./core/topmost-store');

let mainWindow = null;
let tray = null;
let bridge = null;
let storeData = store.defaultData();
let storePath = '';
let manualUnpinned = new Set();   // 用户手动取消置顶的 hwnd（本会话内不再自动置顶）
let autoPinTimer = null;
let isQuitting = false;

const APP_NAME = '置顶管家';
const HOTKEY = 'Ctrl+Alt+T';

function storeFilePath() {
  return path.join(app.getPath('userData'), 'topmost-rules.json');
}

function loadStore() {
  storePath = storeFilePath();
  storeData = store.load(storePath);
}

function persistStore() {
  store.save(storePath, storeData);
}

// 获取本应用主窗口的 hwnd（用于在窗口列表中排除自身）
function getSelfHwnd() {
  try {
    if (!mainWindow) return '';
    const buf = mainWindow.getNativeHandle();
    if (buf && buf.length >= 8) {
      return buf.readBigInt64LE(0).toString();
    } else if (buf && buf.length >= 4) {
      return buf.readUInt32LE(0).toString();
    }
  } catch (e) {}
  return '';
}

function showToast(body) {
  try {
    if (Notification.isSupported()) {
      new Notification({ title: APP_NAME, body: body, silent: true }).show();
    }
  } catch (e) {}
}

// 执行自动置顶：对命中规则且非置顶、未被手动取消的窗口自动置顶
async function applyAutoPin() {
  if (!bridge || !storeData.autoPin) return;
  try {
    const selfHwnd = getSelfHwnd();
    const res = await bridge.listWindows(selfHwnd);
    if (!res || !res.ok || !Array.isArray(res.data)) return;
    for (const w of res.data) {
      if (w.topmost) continue;
      if (manualUnpinned.has(w.hwnd)) continue;
      if (store.matchesRule(storeData, w.proc)) {
        await bridge.setTopmost(w.hwnd, true);
      }
    }
  } catch (e) {}
}

function startAutoPinTimer() {
  stopAutoPinTimer();
  autoPinTimer = setInterval(() => { applyAutoPin(); }, 5000);
}

function stopAutoPinTimer() {
  if (autoPinTimer) { clearInterval(autoPinTimer); autoPinTimer = null; }
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let img;
  try { img = nativeImage.createFromPath(iconPath); } catch (e) { img = nativeImage.createEmpty(); }
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  const menu = Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => showMainWindow() },
    { label: '置顶/取消当前窗口  ' + HOTKEY, click: () => onHotkey() },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 760,
    minHeight: 540,
    title: APP_NAME,
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

  // 关闭时最小化到托盘，而非退出
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

async function ensureBridge() {
  if (!bridge) bridge = new Win32Bridge();
  if (!bridge.proc) {
    try { await bridge.start(); }
    catch (e) { console.error('[bridge] start error:', e.message); throw e; }
  }
  return bridge;
}

// 全局热键：切换前台窗口置顶
async function onHotkey() {
  try {
    await ensureBridge();
    const res = await bridge.toggleTopmostForeground();
    if (res && res.ok) {
      const title = res.title || '当前窗口';
      if (res.topmost) {
        manualUnpinned.delete(res.hwnd);
        showToast('已置顶：' + title);
      } else {
        manualUnpinned.add(res.hwnd);
        showToast('已取消置顶：' + title);
      }
    } else {
      showToast('未获取到前台窗口');
    }
  } catch (e) {
    showToast('操作失败：' + (e.message || ''));
  }
}

function registerHotkey() {
  try {
    globalShortcut.register(HOTKEY, () => onHotkey());
  } catch (e) {
    console.error('[hotkey] register error:', e.message);
  }
}

function unregisterHotkey() {
  try { globalShortcut.unregister(HOTKEY); } catch (e) {}
}

// 演示数据（截图模式用，TM_DEMO=1 时启用）
function getDemoWindows() {
  return [
    { hwnd: '131620', proc: 'notepad.exe', pid: 1234, title: '备忘录.txt - 记事本', topmost: true, alpha: 255 },
    { hwnd: '262440', proc: 'chrome.exe', pid: 5678, title: '置顶管家 - 让任意窗口始终置顶 - Google Chrome', topmost: true, alpha: 180 },
    { hwnd: '393660', proc: 'Code.exe', pid: 9012, title: 'renderer.js - topmost-manager - Visual Studio Code', topmost: false, alpha: 255 },
    { hwnd: '524880', proc: 'explorer.exe', pid: 3456, title: 'D:\\Ai\\mimo\\youqu', topmost: true, alpha: 220 },
    { hwnd: '655100', proc: 'spotify.exe', pid: 7890, title: 'Spotify - 播放中', topmost: false, alpha: 255 },
    { hwnd: '786320', proc: 'cmd.exe', pid: 2345, title: '管理员: C:\\Windows\\System32\\cmd.exe', topmost: false, alpha: 255 },
    { hwnd: '917540', proc: 'WINWORD.EXE', pid: 6789, title: '需求文档.docx - Word', topmost: false, alpha: 255 },
    { hwnd: '1048760', proc: 'Telegram.exe', pid: 1357, title: 'Telegram Desktop', topmost: false, alpha: 255 },
  ];
}

// ---- IPC ----
ipcMain.handle('win:list', async () => {
  if (process.env.TM_DEMO === '1') return { ok: true, data: getDemoWindows() };
  try {
    await ensureBridge();
    const res = await bridge.listWindows(getSelfHwnd());
    return res;
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('win:top', async (e, hwnd, on) => {
  try {
    await ensureBridge();
    const res = await bridge.setTopmost(hwnd, on);
    if (on) manualUnpinned.delete(String(hwnd));
    else {
      manualUnpinned.add(String(hwnd));
      // 取消置顶时恢复不透明
      await bridge.resetAlpha(hwnd).catch(() => {});
    }
    return { ok: res };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('win:alpha', async (e, hwnd, percent) => {
  try {
    await ensureBridge();
    const res = await bridge.setAlpha(hwnd, percent);
    return { ok: res };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('win:topfg', async () => {
  try {
    await ensureBridge();
    const res = await bridge.toggleTopmostForeground();
    if (res && res.ok) {
      if (res.topmost) manualUnpinned.delete(res.hwnd);
      else manualUnpinned.add(res.hwnd);
    }
    return res;
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('rules:get', async () => {
  return { ok: true, data: storeData, path: storePath };
});

ipcMain.handle('rules:add', async (e, proc) => {
  store.addRule(storeData, proc);
  persistStore();
  return { ok: true, data: storeData };
});

ipcMain.handle('rules:remove', async (e, proc) => {
  store.removeRule(storeData, proc);
  persistStore();
  return { ok: true, data: storeData };
});

ipcMain.handle('rules:toggle', async (e, proc, enabled) => {
  store.toggleRule(storeData, proc, enabled);
  persistStore();
  return { ok: true, data: storeData };
});

ipcMain.handle('rules:autoPin', async (e, on) => {
  storeData.autoPin = !!on;
  persistStore();
  if (storeData.autoPin) startAutoPinTimer(); else stopAutoPinTimer();
  if (storeData.autoPin) applyAutoPin();
  return { ok: true, data: storeData };
});

ipcMain.handle('app:showToast', async (e, body) => {
  showToast(body);
  return { ok: true };
});

// ---- 生命周期 ----
app.whenReady().then(() => {
  loadStore();
  if (process.env.TM_DEMO === '1') {
    storeData = { rules: [
      { proc: 'notepad.exe', enabled: true },
      { proc: 'explorer.exe', enabled: true },
    ], autoPin: true };
  }
  createWindow();
  createTray();
  registerHotkey();
  if (storeData.autoPin) startAutoPinTimer();
  if (process.env.TM_DEMO === '1') {
    setTimeout(() => {
      if (mainWindow) mainWindow.webContents.send('bridge:ready', true);
    }, 400);
  } else {
    ensureBridge().then(() => {
      if (mainWindow) mainWindow.webContents.send('bridge:ready', true);
      if (storeData.autoPin) applyAutoPin();
    }).catch((e) => {
      if (mainWindow) mainWindow.webContents.send('bridge:ready', false);
    });
  }
});

app.on('window-all-closed', (e) => {
  // 不退出，驻留托盘
  e.preventDefault();
});

app.on('before-quit', () => { isQuitting = true; });

app.on('will-quit', () => {
  unregisterHotkey();
  stopAutoPinTimer();
  if (bridge) bridge.stop();
});
