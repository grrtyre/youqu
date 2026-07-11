'use strict';

// API管家 · Electron 主进程

const { app, BrowserWindow, Menu, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./core/store.js');
const { buildRequest, sendRequest, formatBody } = require('./core/http-client.js');

const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';

let mainWindow = null;
let store = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    title: 'API管家',
    backgroundColor: '#f5f5f7',
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('console-message', (e, level, msg) => {
    if (level >= 2) console.error('[renderer]', msg);
    if (String(msg).indexOf('__READY__') >= 0) {
      try { require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'api-manager-ready.flag'), '1'); } catch (er) {}
      // 截图模式：收到就绪信号后用 capturePage 内部截图（比 PrintWindow 质量更好）
      if (process.env.AM_SHOT === '1') {
        setTimeout(() => {
          try {
            const shotPath = 'd:\\Ai\\mimo\\screenshots\\api-manager.png';
            require('fs').mkdirSync(require('path').dirname(shotPath), { recursive: true });
            mainWindow.webContents.capturePage().then((img) => {
              require('fs').writeFileSync(shotPath, img.toPNG());
              console.log('[shot] saved:', shotPath);
              app.quit();
            }).catch((err) => {
              console.error('[shot] error:', err.message);
              app.quit();
            });
          } catch (e2) {
            console.error('[shot] exception:', e2.message);
            app.quit();
          }
        }, 1500);
      }
    }
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

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

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [{ role: 'quit', label: '退出' }]
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
        { label: '关于 API管家', click: () => mainWindow && mainWindow.webContents.send('show-about') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- IPC：存储 ----------

function getStore() {
  if (!store) {
    store = new Store(path.join(app.getPath('userData'), 'data'));
  }
  return store;
}

ipcMain.handle('store:all', () => getStore().getAll());

ipcMain.handle('collection:add', (_, name) => getStore().addCollection(name));
ipcMain.handle('collection:rename', (_, id, name) => getStore().renameCollection(id, name));
ipcMain.handle('collection:delete', (_, id) => getStore().deleteCollection(id));
ipcMain.handle('folder:add', (_, colId, name) => getStore().addFolder(colId, name));

ipcMain.handle('item:add', (_, colId, parentId, item) => getStore().addItem(colId, parentId, item));
ipcMain.handle('item:update', (_, colId, itemId, patch) => getStore().updateItem(colId, itemId, patch));
ipcMain.handle('item:delete', (_, colId, itemId) => getStore().deleteItem(colId, itemId));

ipcMain.handle('history:add', (_, entry) => getStore().addHistory(entry));
ipcMain.handle('history:clear', () => getStore().clearHistory());

ipcMain.handle('env:get', () => getStore().getEnvConfig());
ipcMain.handle('env:setActive', (_, envId) => getStore().setActiveEnv(envId));
ipcMain.handle('env:save', (_, env) => getStore().saveEnvironment(env));
ipcMain.handle('env:delete', (_, envId) => getStore().deleteEnvironment(envId));
ipcMain.handle('env:activeVars', () => getStore().getActiveVariables());

// ---------- IPC：发送请求 ----------

ipcMain.handle('request:send', async (_, reqDef) => {
  try {
    const vars = getStore().getActiveVariables();
    const built = buildRequest(reqDef, vars);
    const resp = await sendRequest(built, { timeout: 30000, maxRedirects: 5 });
    const formatted = formatBody(resp.body, resp.headers);
    // 写入历史
    getStore().addHistory({
      method: built.method,
      url: built.url,
      status: resp.status,
      time_ms: resp.time
    });
    return {
      ok: true,
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
      body: formatted.text,
      bodyType: formatted.type,
      size: resp.size,
      time: resp.time,
      redirects: resp.redirects,
      requestMethod: built.method,
      requestUrl: built.url,
      requestHeaders: built.headers
    };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

// ---------- IPC：通用 ----------

ipcMain.handle('clipboard:write', (_, text) => {
  clipboard.writeText(String(text || ''));
  return true;
});
ipcMain.handle('clipboard:read', () => clipboard.readText());
ipcMain.handle('shell:openExternal', (_, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
  return true;
});
ipcMain.handle('app:info', () => ({
  name: app.getName(),
  version: app.getVersion(),
  afdian: AFDIAN_URL,
  platform: process.platform
}));

// ---------- 窗口控制 ----------

ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow && mainWindow.close());
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
