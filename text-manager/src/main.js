'use strict';

const { app, BrowserWindow, Menu, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// 爱发电统一链接
const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    title: '文本管家',
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 最大化状态变化时通知渲染层更新按钮
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximize', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximize', false));

  // 外部链接在默认浏览器打开
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
    {
      label: '文件',
      submenu: [
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '打开爱发电', click: () => shell.openExternal(AFDIAN_URL) },
        { label: '关于文本管家', click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('show-about');
          }
        }}
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ---------- IPC：文件读写 ----------

ipcMain.handle('file:open', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开文本文件',
    filters: [
      { name: '文本文件', extensions: ['txt', 'md', 'csv', 'json', 'log', 'js', 'css', 'html', 'xml', 'yml', 'yaml'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const files = [];
  for (const p of result.filePaths) {
    try {
      const content = fs.readFileSync(p, 'utf-8');
      files.push({ path: p, name: path.basename(p), content });
    } catch (e) {
      files.push({ path: p, name: path.basename(p), error: e.message });
    }
  }
  return { canceled: false, files };
});

ipcMain.handle('file:save', async (event, data) => {
  const { dialog } = require('electron');
  const defaultName = (data && data.suggestedName) || '文本管家导出.txt';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存结果',
    defaultPath: defaultName,
    filters: [
      { name: '文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled) return { canceled: true };
  try {
    fs.writeFileSync(result.filePath, data.content || '', 'utf-8');
    return { canceled: false, path: result.filePath };
  } catch (e) {
    return { canceled: false, error: e.message };
  }
});

ipcMain.handle('clipboard:write', (event, text) => {
  clipboard.writeText(String(text || ''));
  return true;
});

ipcMain.handle('clipboard:read', () => {
  return clipboard.readText();
});

ipcMain.handle('shell:openExternal', (event, url) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
  return true;
});

ipcMain.handle('app:info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    afdian: AFDIAN_URL,
    platform: process.platform
  };
});

// ---------- 窗口控制 ----------

ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle('window:isMaximized', () => !!(mainWindow && mainWindow.isMaximized()));

// ---------- 生命周期 ----------

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
