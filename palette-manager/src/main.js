// main.js
// Electron 主进程：创建窗口、注册系统托盘、全局快捷键

const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, ipcMain, shell, clipboard, nativeTheme } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    show: false,
    frame: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 失焦后自动隐藏到托盘，类似输入法行为，需要时再唤出
  mainWindow.on('blur', () => {
    if (process.platform === 'win32' || process.platform === 'darwin') {
      // 仅在托盘已就绪时隐藏，避免开发时退出
      if (tray && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let trayImage;
  try {
    trayImage = nativeImage.createFromPath(iconPath);
    if (trayImage.isEmpty()) {
      trayImage = nativeImage.createEmpty();
    }
  } catch (e) {
    trayImage = nativeImage.createEmpty();
  }
  tray = new Tray(trayImage);
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示调色板', click: () => showWindow() },
    { type: 'separator' },
    { label: '随机生成', click: () => { if (mainWindow) mainWindow.webContents.send('menu-random'); } },
    { label: '从剪贴板导入', click: () => { if (mainWindow) mainWindow.webContents.send('menu-import-clipboard'); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } },
  ]);
  tray.setToolTip('调色板管理器');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

// 复制文本到剪贴板
ipcMain.handle('clipboard:write', (event, text) => {
  clipboard.writeText(text);
  return true;
});

// 读取剪贴板文本（用于从剪贴板导入 HEX）
ipcMain.handle('clipboard:read', () => {
  return clipboard.readText();
});

// 在系统默认浏览器打开外链
ipcMain.handle('shell:openExternal', (event, url) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

app.whenReady().then(() => {
  nativeTheme.themeSource = 'light';
  createWindow();
  createTray();

  // 全局快捷键：Ctrl+Shift+P 唤出主窗口
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    showWindow();
  });
});

app.on('window-all-closed', () => {
  // 保留托盘常驻，不退出应用
  if (process.platform !== 'darwin' && tray) {
    // Windows/Linux：保持托盘，不退出
  } else if (!tray) {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});
