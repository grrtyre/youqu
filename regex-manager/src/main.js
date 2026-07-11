// 正则管家 - Electron 主进程
// 创建窗口、加载渲染层、处理本地历史持久化

'use strict';

const { app, BrowserWindow, ipcMain, clipboard, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f0f0f4',
    title: '正则管家',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 窗口准备好后再显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 获取历史数据存储路径
function getHistoryFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'regex-history.json');
}

// 读取历史记录
ipcMain.handle('history:load', () => {
  try {
    const file = getHistoryFilePath();
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取历史失败:', e.message);
  }
  return { history: [], favorites: [] };
});

// 保存历史记录
ipcMain.handle('history:save', (event, data) => {
  try {
    const file = getHistoryFilePath();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('保存历史失败:', e.message);
    return false;
  }
});

// 复制到剪贴板
ipcMain.handle('clipboard:write', (event, text) => {
  clipboard.writeText(text);
  return true;
});

app.whenReady().then(() => {
  // 移除应用菜单栏，避免与自定义标题栏冲突
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
