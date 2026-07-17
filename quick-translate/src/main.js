// Electron 主进程：创建窗口、托盘、全局热键、剪贴板监听

'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, clipboard, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isQuiting = false;

// 用户数据目录：历史记录与设置
function userDataFile() {
  return path.join(app.getPath('userData'), 'quick-translate-data.json');
}
function loadStore() {
  try {
    const raw = fs.readFileSync(userDataFile(), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { history: [], settings: { from: 'auto', to: 'zh', clipboardWatch: false, engine: 'auto' } };
  }
}
function saveStore(store) {
  try {
    fs.writeFileSync(userDataFile(), JSON.stringify(store, null, 2), 'utf8');
  } catch (e) { /* 忽略写入错误 */ }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 660,
    minWidth: 720,
    minHeight: 480,
    show: false,
    frame: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    title: '快速翻译器',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 关闭时隐藏到托盘而非退出
  mainWindow.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('hide', () => {
    if (mainWindow) mainWindow.webContents.send('window-hidden');
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let trayIcon = nativeImage.createEmpty();
  try {
    if (fs.existsSync(iconPath)) trayIcon = nativeImage.createFromPath(iconPath);
  } catch (e) { /* 忽略 */ }
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示翻译器', click: () => showWindow() },
    { type: 'separator' },
    { label: '翻译剪贴板', click: () => translateClipboard() },
    { type: 'separator' },
    { label: '退出', click: () => { isQuiting = true; app.quit(); } }
  ]);
  tray.setToolTip('快速翻译器');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => showWindow());
}

function showWindow() {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  mainWindow.webContents.send('window-shown');
}

function translateClipboard() {
  const text = clipboard.readText();
  if (text && text.trim()) {
    showWindow();
    mainWindow.webContents.send('translate-clipboard', text);
  }
}

// 剪贴板轮询监听（可选）
let lastClipboard = '';
let clipboardTimer = null;
function startClipboardWatch() {
  const store = loadStore();
  if (!store.settings.clipboardWatch) return;
  stopClipboardWatch();
  lastClipboard = clipboard.readText();
  clipboardTimer = setInterval(() => {
    const cur = clipboard.readText();
    if (cur && cur !== lastClipboard) {
      lastClipboard = cur;
      if (mainWindow) {
        if (!mainWindow.isVisible()) showWindow();
        mainWindow.webContents.send('translate-clipboard', cur);
      }
    }
  }, 1500);
}
function stopClipboardWatch() {
  if (clipboardTimer) { clearInterval(clipboardTimer); clipboardTimer = null; }
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // 全局热键：Ctrl+Shift+T 唤起/翻译剪贴板
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    const text = clipboard.readText();
    if (text && text.trim()) {
      showWindow();
      mainWindow.webContents.send('translate-clipboard', text);
    } else {
      showWindow();
    }
  });

  startClipboardWatch();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { isQuiting = true; });

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopClipboardWatch();
});

// IPC：渲染进程请求读取/保存数据
ipcMain.handle('store:load', () => loadStore());
ipcMain.handle('store:save', (e, store) => { saveStore(store); return true; });
ipcMain.handle('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.handle('window:close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle('clipboard:read', () => clipboard.readText());
ipcMain.handle('clipboard:write', (e, text) => clipboard.writeText(text || ''));
ipcMain.handle('shell:open', (e, url) => { if (url) shell.openExternal(url); });
ipcMain.handle('watch:set', (e, on) => {
  const store = loadStore();
  store.settings.clipboardWatch = !!on;
  saveStore(store);
  if (on) startClipboardWatch(); else stopClipboardWatch();
  return true;
});
