'use strict';
// 校验管家 - Electron 主进程
// 苹果白风格窗口 + 文件读取/哈希计算 IPC

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { hashFile } = require('./core/hash-utils');

// 用户数据目录：保存历史记录
const HISTORY_FILE = path.join(app.getPath('userData'), 'history.json');

function loadHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function saveHistory(list) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(list.slice(-50), null, 2), 'utf8');
  } catch (_) { /* 忽略写入错误 */ }
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 820,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: '#ffffff',
    title: '校验管家',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // 不自动打开 DevTools，避免打扰
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC：选择文件（返回单文件路径）
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择要校验的文件',
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// IPC：选择多个文件
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择多个文件',
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) return [];
  return result.filePaths || [];
});

// IPC：获取文件信息（不含哈希）
ipcMain.handle('file:stat', async (_evt, filePath) => {
  if (!filePath) return null;
  try {
    const stat = fs.statSync(filePath);
    return {
      filePath,
      name: path.basename(filePath),
      size: stat.size,
      mtime: stat.mtimeMs
    };
  } catch (e) {
    return null;
  }
});

// IPC：计算单个文件哈希（带进度）
ipcMain.handle('hash:compute', async (event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    const sender = event.sender;
    const hashes = await hashFile(filePath, (ratio) => {
      try { sender.send('hash:progress', { filePath, ratio }); } catch (_) { /* 忽略 */ }
    });
    return {
      filePath,
      name: path.basename(filePath),
      size: stat.size,
      mtime: stat.mtimeMs,
      hashes
    };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e), filePath };
  }
});

// IPC：读取历史记录
ipcMain.handle('history:load', async () => loadHistory());

// IPC：写入历史记录
ipcMain.handle('history:save', async (_evt, list) => {
  saveHistory(list);
  return true;
});
