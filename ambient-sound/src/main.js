// main.js
// Electron 主进程 - 创建苹果白风格窗口，配置单实例锁与系统托盘
'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// demo 截图模式：禁用 GPU 硬件加速，使用软件渲染，确保 PrintWindow 能完整截取
if (process.env.DEMO_SHOT === '1') {
  app.disableHardwareAcceleration();
}

let mainWindow = null;
let tray = null;

function createWindow() {
  const demoShot = process.env.DEMO_SHOT === '1';
  mainWindow = new BrowserWindow({
    width: 460,
    height: 720,
    minWidth: 420,
    minHeight: 640,
    show: false,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#ffffff',
    title: '环境音播放器',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (demoShot) {
      // demo 截图模式：不抢用户焦点，渲染完成后注入演示状态
      mainWindow.showInactive();
      // 2 秒后激活 3 张卡片用于截图展示（不真正播放音频，仅视觉态）
      setTimeout(() => {
        mainWindow.webContents.executeJavaScript(
          "window.__demoMode=true;['rain','fire','waves'].forEach(function(id){var c=document.querySelector('.sound-card[data-id=\"'+id+'\"]');if(c)c.classList.add('active');});var st=document.getElementById('status');if(st){st.textContent='播放中 · 雨声、篝火、海浪';st.classList.add('playing');};"
        ).catch(() => {});
      }, 2000);
    } else {
      mainWindow.show();
    }
  });

  // 关闭时隐藏到托盘而非退出
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function createTray() {
  // 加载应用图标作为托盘图标（assets/icon.png 存在）
  let icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'));
  if (icon.isEmpty()) {
    // 加载失败时用 1x1 蓝色像素占位，避免托盘图标完全不可见
    icon = nativeImage.createFromBuffer(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYPj/HwAEhwH/yfeNpQAAAABJRU5ErkJggg==',
      'base64'));
  }
  // 托盘图标标准尺寸 16x16
  icon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setToolTip('环境音播放器');
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC：托盘/窗口控制
ipcMain.on('window-hide', () => { if (mainWindow) mainWindow.hide(); });
