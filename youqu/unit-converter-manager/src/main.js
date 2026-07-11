// 换算管家 - Electron 主进程
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const Store = require('./core/store');
const { categories } = require('./core/converter');

// 持久化文件路径
function dataFilePath() {
  const dir = app.getPath('userData');
  return path.join(dir, 'state.json');
}

function loadState() {
  try {
    const p = dataFilePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      return Store.createState(JSON.parse(raw));
    }
  } catch (e) {
    console.error('加载状态失败：', e);
  }
  return Store.createState();
}

function saveState(state) {
  try {
    const dir = path.dirname(dataFilePath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dataFilePath(), JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存状态失败：', e);
  }
}

let win = null;
let state = null;

// 截图模式：不抢焦点，不激活到前台
const isScreenshot = process.argv.includes('--screenshot');

function createWindow() {
  win = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 880,
    minHeight: 600,
    title: '换算管家',
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    show: !isScreenshot,
    focusable: !isScreenshot,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 截图模式：英文标题便于脚本查找，显示但不抢焦点，预填示例值展示有数据状态
  if (isScreenshot) {
    win.once('ready-to-show', () => {
      win.showInactive();
      win.webContents.executeJavaScript("document.title='unit-converter-manager'").catch(() => {});
    });
    win.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        win.webContents.executeJavaScript(`
          const inp = document.getElementById('value-input');
          if(inp){ inp.value='1'; inp.dispatchEvent(new Event('input')); }
        `).catch(() => {});
      }, 400);
    });
  }
}

app.whenReady().then(() => {
  state = loadState();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC ----
ipcMain.handle('state:get', () => state);

ipcMain.handle('state:save', (_e, newState) => {
  state = Object.assign({}, state, newState);
  saveState(state);
  return state;
});

ipcMain.handle('history:add', (_e, entry) => {
  state = Store.addHistory(state, entry);
  saveState(state);
  return state;
});

ipcMain.handle('history:clear', () => {
  state = Store.clearHistory(state);
  saveState(state);
  return state;
});

ipcMain.handle('favorite:toggle', (_e, fav) => {
  if (Store.isFavorite(state, fav)) {
    state = Store.removeFavorite(state, fav);
  } else {
    state = Store.addFavorite(state, fav);
  }
  saveState(state);
  return { state, isFavorite: Store.isFavorite(state, fav) };
});

ipcMain.handle('last:set', (_e, last) => {
  state = Store.setLast(state, last);
  saveState(state);
  return state;
});

ipcMain.handle('categories:get', () => categories);
