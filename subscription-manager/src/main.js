// main.js - Electron 主进程
const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadData, saveData } = require('./core/store');
const utils = require('./core/subscription-utils');

let mainWindow = null;

function createWindow() {
  const screenshotMode = !!process.env.SUB_MGR_SCREENSHOT;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: '订阅管家',
    backgroundColor: '#f5f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (screenshotMode) {
      // 截图模式：不显示窗口，延迟后截图并退出
      setTimeout(async () => {
        try {
          const image = await mainWindow.webContents.capturePage();
          const buf = image.toPNG();
          fs.writeFileSync(process.env.SUB_MGR_SCREENSHOT, buf);
          console.log('screenshot saved: ' + process.env.SUB_MGR_SCREENSHOT);
        } catch (e) {
          console.error('screenshot error:', e.message);
        }
        app.quit();
      }, 3500);
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: 获取所有订阅
ipcMain.handle('subscriptions:getAll', () => {
  const data = loadData();
  // 截图模式下重置演示数据
  if (process.env.SUB_MGR_SCREENSHOT && data.subscriptions.length < 8) {
    return { subscriptions: [], settings: { currency: 'CNY', reminderDays: 3 } };
  }
  return data;
});

// IPC: 保存所有订阅
ipcMain.handle('subscriptions:save', (event, data) => {
  saveData(data);
  return { success: true };
});

// IPC: 获取统计
ipcMain.handle('subscriptions:stats', () => {
  const data = loadData();
  const stats = utils.computeStats(data.subscriptions);
  const categories = utils.categoryBreakdown(data.subscriptions);
  return { stats, categories };
});

// IPC: 显示通知
ipcMain.handle('notifications:show', (event, title, body) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  return { success: true };
});

// 启动时检查续费提醒
function checkRenewals() {
  const data = loadData();
  const stats = utils.computeStats(data.subscriptions);
  const reminderDays = (data.settings && data.settings.reminderDays) || 3;
  for (const sub of stats.upcoming) {
    if (sub.daysLeft <= reminderDays) {
      if (Notification.isSupported()) {
        new Notification({
          title: '订阅续费提醒',
          body: `${sub.name} 将在 ${sub.daysLeft} 天后续费（${sub.renewalDate}）`
        }).show();
      }
    }
  }
}

app.whenReady().then(() => {
  createWindow();
  // 延迟检查续费
  setTimeout(checkRenewals, 2000);

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
