'use strict';

const { app, BrowserWindow, Menu, ipcMain, shell, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// 爱发电统一链接
const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';

// 文档存储目录
const DOCS_DIR = path.join(app.getPath('userData'), 'docs');

let mainWindow = null;

function ensureDocsDir() {
  try {
    if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  } catch (e) { console.error('创建文档目录失败:', e); }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1000,
    minHeight: 660,
    title: '思维导图管家',
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
        { label: '关于思维导图管家', click: () => { if (mainWindow) mainWindow.webContents.send('show-about'); } }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- 文档持久化 ----------
function docPath(id) {
  return path.join(DOCS_DIR, id + '.json');
}

function listDocs() {
  ensureDocsDir();
  try {
    const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.json'));
    const list = [];
    for (const f of files) {
      try {
        const txt = fs.readFileSync(path.join(DOCS_DIR, f), 'utf-8');
        const data = JSON.parse(txt);
        list.push({
          id: data.id || f.replace('.json', ''),
          title: data.title || '未命名',
          createdAt: data.createdAt || 0,
          updatedAt: data.updatedAt || 0,
          nodeCount: countNodesInData(data.root)
        });
      } catch (e) { /* 跳过损坏文件 */ }
    }
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return list;
  } catch { return []; }
}

function countNodesInData(root) {
  if (!root) return 0;
  let n = 1;
  for (const c of (root.children || [])) n += countNodesInData(c);
  return n;
}

function loadDoc(id) {
  ensureDocsDir();
  try {
    const txt = fs.readFileSync(docPath(id), 'utf-8');
    return JSON.parse(txt);
  } catch (e) {
    return null;
  }
}

function saveDoc(data) {
  ensureDocsDir();
  const id = data.id;
  try {
    fs.writeFileSync(docPath(id), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function deleteDoc(id) {
  try {
    const p = docPath(id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  } catch { return false; }
}

// ---------- IPC ----------
ipcMain.handle('doc:list', () => listDocs());

ipcMain.handle('doc:load', (event, id) => {
  const data = loadDoc(id);
  return data ? { ok: true, doc: data } : { ok: false, error: '文档不存在或已损坏' };
});

ipcMain.handle('doc:save', (event, data) => {
  const ok = saveDoc(data);
  return { ok, nodeCount: countNodesInData(data.root) };
});

ipcMain.handle('doc:delete', (event, id) => ({ ok: deleteDoc(id) }));

ipcMain.handle('doc:export', async (event, payload) => {
  // payload: { content, suggestedName, filterType }
  const filters = [];
  const ft = payload && payload.filterType;
  if (ft === 'json') {
    filters.push({ name: 'JSON 文件', extensions: ['json'] });
  } else if (ft === 'png') {
    filters.push({ name: 'PNG 图片', extensions: ['png'] });
  } else if (ft === 'md') {
    filters.push({ name: 'Markdown 文件', extensions: ['md'] });
  } else if (ft === 'txt') {
    filters.push({ name: '文本文件', extensions: ['txt'] });
  } else {
    filters.push({ name: '所有文件', extensions: ['*'] });
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出思维导图',
    defaultPath: (payload && payload.suggestedName) || '思维导图.json',
    filters
  });
  if (result.canceled) return { canceled: true };
  try {
    if (ft === 'png') {
      // PNG 是 base64 data URL，需要转成二进制
      const b64 = String(payload.content).replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(result.filePath, Buffer.from(b64, 'base64'));
    } else {
      fs.writeFileSync(result.filePath, payload.content || '', 'utf-8');
    }
    return { canceled: false, path: result.filePath };
  } catch (e) {
    return { canceled: false, error: e.message };
  }
});

ipcMain.handle('doc:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入思维导图 JSON',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  try {
    const txt = fs.readFileSync(result.filePaths[0], 'utf-8');
    const data = JSON.parse(txt);
    return { canceled: false, doc: data };
  } catch (e) {
    return { canceled: false, error: e.message };
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
  ensureDocsDir();
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
