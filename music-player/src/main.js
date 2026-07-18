// Electron 主进程 - 本地音乐播放器
// 苹果白高端风格，访问本地文件，简洁实用

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 支持环境变量 MUSIC_PLAYER_DEMO=1 触发 demo 模式（仅用于截图）
  if (process.env.MUSIC_PLAYER_DEMO === '1') {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: { demo: '1' } });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

// IPC: 选择音乐文件
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择音乐文件',
    filters: [
      { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] }
    ],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) return [];
  return result.filePaths;
});

// IPC: 选择音乐文件夹
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择音乐文件夹',
    properties: ['openDirectory']
  });
  if (result.canceled) return [];
  return result.filePaths;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
