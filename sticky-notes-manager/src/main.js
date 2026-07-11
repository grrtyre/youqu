// 便签管家 - Electron 主进程
'use strict';

const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const noteStore = require('./core/note-store');

// 去掉系统默认菜单栏
Menu.setApplicationMenu(null);

let mainWindow = null;
let tray = null;

// 数据文件路径（使用用户数据目录，避免污染项目目录）
function getDataPath() {
  return path.join(app.getPath('userData'), 'notes.json');
}

function createWindow() {
  const testMode = process.env.STICKY_TEST_MODE === '1';
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    show: testMode, // 测试模式立即显示，否则等 ready-to-show
    title: '便签管家',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (!testMode) {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  }

  // 点击关闭按钮时隐藏到托盘而不是退出
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      app.dock && app.dock && app.dock.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('便签管家');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '新建便签',
      accelerator: 'CmdOrCtrl+N',
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
          mainWindow.webContents.send('action', 'new-note');
        }
      }
    },
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    // 全局快捷键：Ctrl+Alt+N 唤起并新建便签
    globalShortcut.register('CommandOrControl+Alt+N', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        mainWindow.webContents.send('action', 'new-note');
      }
    });

    // 全局快捷键：Ctrl+Alt+S 唤起主窗口
    globalShortcut.register('CommandOrControl+Alt+S', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        mainWindow && mainWindow.show();
      }
    });
  });
}

// IPC 处理
ipcMain.handle('notes:load', () => {
  return noteStore.loadNotes(getDataPath());
});

ipcMain.handle('notes:save', (event, notes) => {
  return noteStore.saveNotes(notes, getDataPath());
});

ipcMain.handle('notes:export', (event, notes) => {
  const result = dialog.showSaveDialogSync(mainWindow, {
    title: '导出便签',
    defaultPath: '便签备份.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result) {
    const fs = require('fs');
    fs.writeFileSync(result, noteStore.exportNotes(notes), 'utf-8');
    return { success: true, path: result };
  }
  return { success: false };
});

ipcMain.handle('notes:import', () => {
  const result = dialog.showOpenDialogSync(mainWindow, {
    title: '导入便签',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result && result.length > 0) {
    const fs = require('fs');
    const jsonStr = fs.readFileSync(result[0], 'utf-8');
    try {
      const existing = noteStore.loadNotes(getDataPath());
      const merged = noteStore.importNotes(jsonStr, existing);
      noteStore.saveNotes(merged, getDataPath());
      return { success: true, notes: merged };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false };
});

// 退出时注销全局快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 防止托盘关闭后窗口退出
app.isQuitting = false;
