// 科学计算器管家 · 主进程
// 苹果白高端风格桌面计算器，纯本地隐私优先

'use strict';

const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');

const calcEngine = require('./core/calc-engine.js');
const historyStore = require('./core/history-store.js');

let mainWindow = null;

// 截图模式：传入 --screenshot=<path> 时启用，窗口显示但定位到屏幕外
const screenshotArg = process.argv.find(a => a.startsWith('--screenshot='));
const SCREENSHOT_MODE = !!screenshotArg;
const SCREENSHOT_PATH = screenshotArg ? screenshotArg.split('=')[1] : null;

// 截图模式：使用项目内临时数据目录，便于预填演示数据
if (SCREENSHOT_MODE) {
  try {
    const fs = require('fs');
    const demoDir = path.join(__dirname, '..', 'build', 'demo-data');
    if (!fs.existsSync(demoDir)) fs.mkdirSync(demoDir, { recursive: true });
    app.setPath('userData', demoDir);
  } catch (e) {
    // 忽略错误，继续使用默认路径
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 560,
    title: '计算器管家',
    backgroundColor: '#f5f5f7',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    // 截图模式：窗口显示但定位到屏幕外（-3200,-3200），不抢焦点、不在任务栏
    // Chromium 在 show:true 时才会真正渲染内容，paintWhenInitiallyHidden 不可靠
    show: true,
    x: SCREENSHOT_MODE ? -3200 : undefined,
    y: SCREENSHOT_MODE ? -3200 : undefined,
    focusable: !SCREENSHOT_MODE,
    skipTaskbar: SCREENSHOT_MODE,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 拦截新窗口，外部链接在系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 防止多开
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
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
}

// ============ IPC：计算 ============

ipcMain.handle('calc:evaluate', async (event, payload) => {
  try {
    const expr = String((payload && payload.expr) || '');
    const variables = historyStore.loadVariables();
    const result = calcEngine.evaluate(expr, variables);
    return { ok: true, value: result, formatted: calcEngine.formatResult(result) };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('calc:assign', async (event, payload) => {
  try {
    const expr = String((payload && payload.expr) || '');
    const variables = historyStore.loadVariables();
    const assign = calcEngine.tryParseAssignment(expr, variables);
    if (!assign) {
      return { ok: false, error: '不是有效的赋值表达式（例：x = 5）' };
    }
    const newVars = historyStore.saveVariable(assign.name, assign.value);
    return {
      ok: true,
      name: assign.name,
      value: assign.value,
      formatted: calcEngine.formatResult(assign.value),
      variables: newVars,
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

// ============ IPC：进制转换 ============

ipcMain.handle('calc:convertBase', async (event, payload) => {
  try {
    const num = parseFloat(payload && payload.num);
    if (!isFinite(num)) throw new Error('数值无效');
    const bin = calcEngine.toBase(num, 2);
    const oct = calcEngine.toBase(num, 8);
    const dec = calcEngine.toBase(num, 10);
    const hex = calcEngine.toBase(num, 16);
    return { ok: true, bin, oct, dec, hex };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

// ============ IPC：历史 ============

ipcMain.handle('history:list', async () => {
  return { ok: true, items: historyStore.loadHistory() };
});

ipcMain.handle('history:append', async (event, payload) => {
  const items = historyStore.saveHistoryItem(payload || {});
  return { ok: true, items };
});

ipcMain.handle('history:clear', async () => {
  historyStore.clearHistory();
  return { ok: true, items: [] };
});

ipcMain.handle('history:delete', async (event, payload) => {
  const items = historyStore.deleteHistoryItem(payload && payload.id);
  return { ok: true, items };
});

// ============ IPC：变量 ============

ipcMain.handle('vars:list', async () => {
  return { ok: true, variables: historyStore.loadVariables() };
});

ipcMain.handle('vars:delete', async (event, payload) => {
  const variables = historyStore.deleteVariable(payload && payload.name);
  return { ok: true, variables };
});

ipcMain.handle('vars:clear', async () => {
  historyStore.clearVariables();
  return { ok: true, variables: {} };
});

// ============ IPC：存储路径（用于设置页显示）============

ipcMain.handle('storage:path', async () => {
  try {
    return { ok: true, path: historyStore.getStorageDir() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
