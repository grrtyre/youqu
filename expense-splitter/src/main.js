// 分账助手 - Electron 主进程
// 负责窗口创建、数据持久化（JSON 文件）、系统托盘

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(app.getPath('userData'), 'expense-splitter-data.json');

let mainWindow = null;
let tray = null;

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.groups)) return data;
    }
  } catch (e) {
    console.error('读取数据失败:', e);
  }
  return { groups: [], activeGroupId: null };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存数据失败:', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (app.isQuitting) return;
    e.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let img = nativeImage.createEmpty();
  try {
    if (fs.existsSync(iconPath)) img = nativeImage.createFromPath(iconPath);
  } catch (e) {}
  if (img.isEmpty()) img = nativeImage.createEmpty();
  tray = new Tray(img);
  const menu = Menu.buildFromTemplate([
    { label: '打开分账助手', click: () => { if (mainWindow) mainWindow.show(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setToolTip('分账助手');
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (mainWindow) mainWindow.show();
  });
}

// ---------- IPC ----------
ipcMain.handle('data:load', () => loadData());
ipcMain.handle('data:save', (event, data) => { saveData(data); return true; });

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.isQuitting = true;
    app.quit();
  }
});
