'use strict';

const { app, BrowserWindow, Menu, ipcMain, shell, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 爱发电统一链接
const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';

// 最近文件持久化路径
const RECENT_FILE = path.join(app.getPath('userData'), 'recent.json');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '表格管家',
    backgroundColor: '#f5f5f7',
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximize', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximize', false));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// ---------- 应用菜单 ----------
function buildMenu() {
  const template = [
    { label: '文件', submenu: [{ role: 'quit', label: '退出' }] },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' }, { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' },
        { type: 'separator' }, { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '打开爱发电', click: () => shell.openExternal(AFDIAN_URL) },
        { label: '关于表格管家', click: () => { if (mainWindow) mainWindow.webContents.send('show-about'); } }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- 最近文件 ----------
function loadRecent() {
  try {
    const txt = fs.readFileSync(RECENT_FILE, 'utf-8');
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr.filter(p => { try { return fs.existsSync(p); } catch { return false; } }).slice(0, 10) : [];
  } catch { return []; }
}

function saveRecent(arr) {
  try { fs.writeFileSync(RECENT_FILE, JSON.stringify(arr.slice(0, 10)), 'utf-8'); } catch { }
}

function pushRecent(p) {
  let arr = loadRecent();
  arr = arr.filter(x => x !== p);
  arr.unshift(p);
  saveRecent(arr);
}

// ---------- IPC ----------
ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 CSV / TSV 文件',
    filters: [
      { name: '表格文件', extensions: ['csv', 'tsv', 'txt'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const p = result.filePaths[0];
  try {
    const content = fs.readFileSync(p, 'utf-8');
    pushRecent(p);
    return { canceled: false, path: p, name: path.basename(p), content };
  } catch (e) {
    return { canceled: false, error: e.message };
  }
});

ipcMain.handle('file:save', async (event, data) => {
  const defaultName = (data && data.suggestedName) || '表格管家导出.csv';
  const filters = [
    { name: 'CSV 文件', extensions: ['csv'] },
    { name: 'TSV 文件', extensions: ['tsv'] },
    { name: 'JSON 文件', extensions: ['json'] },
    { name: 'Markdown 文件', extensions: ['md'] },
    { name: '所有文件', extensions: ['*'] }
  ];
  const result = await dialog.showSaveDialog(mainWindow, { title: '保存结果', defaultPath: defaultName, filters });
  if (result.canceled) return { canceled: true };
  try {
    fs.writeFileSync(result.filePath, data.content || '', 'utf-8');
    return { canceled: false, path: result.filePath };
  } catch (e) {
    return { canceled: false, error: e.message };
  }
});

ipcMain.handle('recent:list', () => loadRecent());

ipcMain.handle('recent:open', (event, p) => {
  try {
    if (!fs.existsSync(p)) return { error: '文件不存在' };
    const content = fs.readFileSync(p, 'utf-8');
    pushRecent(p);
    return { path: p, name: path.basename(p), content };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('clipboard:write', (event, text) => { clipboard.writeText(String(text || '')); return true; });

ipcMain.handle('shell:openExternal', (event, url) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) shell.openExternal(url);
  return true;
});

ipcMain.handle('app:info', () => ({
  name: app.getName(), version: app.getVersion(), afdian: AFDIAN_URL, platform: process.platform
}));

// ---------- 窗口控制 ----------
ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
});
ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle('window:isMaximized', () => !!(mainWindow && mainWindow.isMaximized()));

// ---------- 生命周期 ----------
app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
