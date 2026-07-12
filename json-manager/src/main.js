'use strict';
// JSON管家 - Electron 主进程
// 苹果白风格窗口 + 文件读写/历史记录 IPC

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 用户数据目录：保存最近处理的 JSON 文本（最多 20 条，单条上限 1MB）
const HISTORY_FILE = path.join(app.getPath('userData'), 'history.json');
const HISTORY_MAX = 20;
const ITEM_MAX_BYTES = 1 * 1024 * 1024;

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
    // 仅保存不超过 ITEM_MAX_BYTES 的条目
    const filtered = list
      .filter((item) => {
        if (!item || typeof item.text !== 'string') return false;
        return Buffer.byteLength(item.text, 'utf8') <= ITEM_MAX_BYTES;
      })
      .slice(-HISTORY_MAX);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(filtered, null, 2), 'utf8');
  } catch (_) { /* 忽略写入错误 */ }
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#ffffff',
    title: 'JSON管家',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // 截图模式：在 loadFile 之前注册监听器，避免错过 did-finish-load 事件
  if (process.env.JSON_MANAGER_SHOT === '1') {
    console.log('[SHOT] 截图模式已启用，等待页面加载...');
    // 转发渲染进程的 console.log 到主进程 stdout
    mainWindow.webContents.on('console-message', (e, level, message) => {
      console.log('[renderer] ' + message);
    });
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[SHOT] 页面加载完成，等待 3.5 秒后截图');
      setTimeout(async () => {
        try {
          const image = await mainWindow.webContents.capturePage();
          const fs2 = require('fs');
          const path2 = require('path');
          const dir = 'D:\\Ai\\mimo\\screenshots';
          if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
          const outPath = path2.join(dir, 'json-manager.png');
          fs2.writeFileSync(outPath, image.toPNG());
          console.log('[SHOT] 截图已保存: ' + outPath + ' (' + image.toPNG().length + ' bytes)');
        } catch (err) {
          console.log('[SHOT] 截图错误: ' + (err && err.message || err));
        } finally {
          app.quit();
        }
      }, 5000);
    });
    mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
      console.log('[SHOT] 页面加载失败: ' + code + ' ' + desc);
    });
  }

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

// IPC：打开 JSON 文件
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 JSON 文件',
    filters: [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return { filePath, text };
  } catch (err) {
    return { filePath, error: String(err && err.message || err) };
  }
});

// IPC：保存为 JSON 文件
ipcMain.handle('dialog:saveFile', async (event, defaultName, text) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存到文件',
    defaultFileName: defaultName || 'output.json',
    filters: [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePath) return null;
  try {
    fs.writeFileSync(result.filePath, text, 'utf8');
    return { filePath: result.filePath };
  } catch (err) {
    return { error: String(err && err.message || err) };
  }
});

// IPC：读取历史记录
ipcMain.handle('history:load', async () => {
  return loadHistory();
});

// IPC：追加历史记录
ipcMain.handle('history:add', async (event, item) => {
  if (!item || typeof item.text !== 'string') return false;
  const list = loadHistory();
  // 去重：相同 text 则先移除旧的
  const dedup = list.filter((it) => it.text !== item.text);
  dedup.push({
    text: item.text,
    label: (item.label || '').toString().slice(0, 60),
    time: Date.now()
  });
  saveHistory(dedup);
  return true;
});

// IPC：清空历史记录
ipcMain.handle('history:clear', async () => {
  saveHistory([]);
  return true;
});
