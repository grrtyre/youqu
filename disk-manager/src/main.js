// Electron 主进程
'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { scanDir, collectTopFiles, collectStats } = require('./core/scanner');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: '磁盘管家',
    backgroundColor: '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 开发时打开 DevTools
  if (process.env.DISK_MGR_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// 选择目录
ipcMain.handle('dialog:open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择要扫描的文件夹',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// 获取磁盘可用空间
ipcMain.handle('disk:get-info', async (event, folderPath) => {
  try {
    const stat = fs.statSync(folderPath);
    // 使用 fsutil 或 statfs 在 Electron 里较复杂，这里返回基础信息
    return { exists: true, isDir: stat.isDirectory() };
  } catch (e) {
    return { exists: false, error: e.message };
  }
});

// 扫描目录
let scanCancelled = false;
ipcMain.handle('scan:start', async (event, folderPath) => {
  scanCancelled = false;
  const { makeDirNode } = require('./core/scanner');
  const root = makeDirNode(path.basename(folderPath) || folderPath, folderPath);
  const onProgress = (p) => {
    if (!scanCancelled) {
      event.sender.send('scan:progress', p);
    }
  };
  const shouldStop = () => scanCancelled;
  try {
    const res = await scanDir(root, onProgress, shouldStop);
    const topFiles = collectTopFiles(root, 100);
    const stats = collectStats(root);
    return {
      ok: true,
      tree: root,
      files: res.files,
      dirs: res.dirs,
      bytes: root.size,
      stopped: res.stopped,
      topFiles: topFiles,
      stats: stats,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('scan:cancel', async () => {
  scanCancelled = true;
  return true;
});

// 在资源管理器中打开
ipcMain.handle('shell:show-in-folder', async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return true;
  } catch (e) {
    return false;
  }
});

// 移到回收站（Electron 22+ 提供 shell.trashItem）
ipcMain.handle('shell:trash', async (event, filePath) => {
  try {
    await shell.trashItem(filePath);
    return true;
  } catch (e) {
    return { error: e.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  // 支持命令行传入初始扫描路径：electron . -- "D:\some\path"
  const argPath = process.argv.find((a, i) => i >= 2 && !a.startsWith('-'));
  if (argPath) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('app:init-path', argPath);
    });
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
