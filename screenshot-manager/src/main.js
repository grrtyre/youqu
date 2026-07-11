// 截图管家 - 主进程
// 苹果白高端风格截图标注工具
const { app, BrowserWindow, globalShortcut, screen, ipcMain, Tray, Menu, nativeImage, clipboard, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('./uuid-lite');

// 状态
let tray = null;
let pickerWin = null;
let editorWin = null;
let mainWin = null;
let pinWindows = new Set();   // pin 窗口集合
let pinFiles = new Map();     // pinWin -> 临时图片文件路径，关闭时清理

// 历史目录
function getHistoryDir() {
  const dir = path.join(app.getPath('userData'), 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getHistoryFile() {
  return path.join(app.getPath('userData'), 'history.json');
}

function loadHistory() {
  try {
    const f = getHistoryFile();
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {}
  return [];
}

function saveHistory(list) {
  // 原子写入：先写 .tmp 再 rename，避免崩溃导致 history.json 损坏
  try {
    const f = getHistoryFile();
    const tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmp, f);
  } catch (e) {}
}

// 启动时清理崩溃残留的临时文件（raw_*.png / pin_*.png / raw_composed_*.png）
// 这些是截图/贴图流程的中间产物，正常流程会在编辑器/pin 关闭时删除；
// 若上次崩溃则残留，这里按是否在历史列表中决定是否清理
function cleanupOrphanTempFiles() {
  try {
    const dir = getHistoryDir();
    const list = loadHistory();
    const knownPaths = new Set(list.map(it => it.path && path.resolve(it.path)));
    for (const name of fs.readdirSync(dir)) {
      if (/^(raw_|pin_|raw_composed_)/.test(name)) {
        const full = path.join(dir, name);
        if (!knownPaths.has(path.resolve(full))) {
          try { fs.unlinkSync(full); } catch (e) {}
        }
      }
    }
  } catch (e) {}
}

function addToHistory(item) {
  const list = loadHistory();
  list.unshift(item);
  // 最多保留 100 条
  if (list.length > 100) list.length = 100;
  saveHistory(list);
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('history-updated', list);
  }
}

// 路径白名单校验：只允许读 historyDir 内的文件，或 history 列表中已记录的路径
function isPathSafe(p) {
  if (typeof p !== 'string' || !p) return false;
  const historyDir = getHistoryDir();
  const resolved = path.resolve(p);
  // 必须在历史目录内
  if (resolved.startsWith(historyDir + path.sep) || resolved === historyDir) return true;
  // 或在历史列表中已记录
  const list = loadHistory();
  return list.some(item => item.path && path.resolve(item.path) === resolved);
}

// 创建托盘
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: '截图 (Ctrl+Shift+A)', click: () => startScreenshot() },
    {
      label: '上次截图再编辑',
      click: () => {
        // 从历史取最新一张（避免引用已被清理的临时 raw 文件）
        const list = loadHistory();
        if (list.length > 0 && fs.existsSync(list[0].path)) {
          openEditor(list[0].path, list[0]);
        } else {
          dialog.showMessageBox({ message: '暂无历史截图，请先截一张图' });
        }
      }
    },
    { type: 'separator' },
    { label: '打开主窗口', click: () => { showMainWindow(); } },
    { label: '退出', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('截图管家 - Ctrl+Shift+A 截图');
  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow());
}

// 主窗口
function createMainWindow() {
  const display = screen.getPrimaryDisplay();
  const w = Math.min(display.workAreaSize.width - 80, 1080);
  const h = Math.min(display.workAreaSize.height - 60, 720);
  mainWin = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 820,
    minHeight: 520,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWin.once('ready-to-show', () => {
    mainWin.show();
  });
  mainWin.on('close', (e) => {
    e.preventDefault();
    mainWin.hide();
  });
}

function showMainWindow() {
  if (!mainWin) createMainWindow();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  // 等 webContents 加载完成后再发送，避免 ready-to-show 阶段消息丢失
  const sendHistory = () => { if (!mainWin.isDestroyed()) mainWin.webContents.send('history-updated', loadHistory()); };
  if (mainWin.webContents.isLoading()) {
    mainWin.webContents.once('did-finish-load', sendHistory);
  } else {
    sendHistory();
  }
}

// 截图流程：捕获所有显示器 → picker 选区
// 多屏支持：拼接成一张虚拟桌面图，picker 窗口跨屏覆盖
function startScreenshot() {
  if (pickerWin) { pickerWin.close(); pickerWin = null; }
  const displays = screen.getAllDisplays();
  if (!displays.length) {
    dialog.showErrorBox('截图失败', '未检测到显示器');
    return;
  }
  // 计算虚拟桌面 bounds（所有屏的并集）
  const minX = Math.min(...displays.map(d => d.bounds.x));
  const minY = Math.min(...displays.map(d => d.bounds.y));
  const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
  const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));
  const desktopBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  // 逐屏捕获（thumbnailSize 乘 scaleFactor 以拿到物理像素，避免高 DPI 模糊）
  Promise.all(displays.map(d => captureDisplay(d))).then(results => {
    // results: [{ rawPath, bounds, scaleFactor }]
    openPickerMulti(results, desktopBounds);
  }).catch(err => {
    dialog.showErrorBox('截图失败', String(err));
  });
}

function captureDisplay(display) {
  return new Promise((resolve, reject) => {
    const { desktopCapturer } = require('electron');
    const sf = display.scaleFactor || 1;
    // 物理像素 = CSS 像素 * scaleFactor，避免 150%/200% 缩放屏截图模糊
    const physW = Math.round(display.bounds.width * sf);
    const physH = Math.round(display.bounds.height * sf);
    desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physW, height: physH }
    }).then(sources => {
      const target = sources.find(s => s.display_id === String(display.id)) || sources[0];
      if (!target) return reject(new Error('未找到屏幕源'));
      const png = target.thumbnail.toPNG();
      const file = path.join(getHistoryDir(), `raw_${Date.now()}_${display.id}.png`);
      fs.writeFileSync(file, png);
      resolve({ rawPath: file, bounds: display.bounds, scaleFactor: sf, physW, physH });
    }).catch(reject);
  });
}

// 拾取窗口：跨屏覆盖整个虚拟桌面
function openPickerMulti(sources, desktopBounds) {
  pickerWin = new BrowserWindow({
    x: desktopBounds.x,
    y: desktopBounds.y,
    width: desktopBounds.width,
    height: desktopBounds.height,
    fullscreen: false,
    frame: false,
    movable: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  pickerWin.setAlwaysOnTop(true, 'screen-saver');
  pickerWin.loadFile(path.join(__dirname, 'renderer', 'picker.html'));
  pickerWin.webContents.on('did-finish-load', () => {
    pickerWin.webContents.send('picker-init', {
      sources: sources,                  // [{rawPath, bounds, scaleFactor, physW, physH}]
      desktopBounds: desktopBounds
    });
  });
  pickerWin.on('closed', () => { pickerWin = null; });
}

// 打开编辑器：把整屏图 + 选区 rect 传给 editor，editor 内 canvas 裁剪显示
// rawPath 是临时整屏图，编辑器关闭后由主进程清理（避免磁盘泄漏）
ipcMain.handle('open-editor', async (event, args) => {
  const { rawPath, rect, scaleFactor } = args;
  if (pickerWin) { pickerWin.close(); pickerWin = null; }
  openEditor(rawPath, null, rect, scaleFactor);
  return { ok: true };
});

function openEditor(imagePath, existingItem, rect, scaleFactor) {
  if (editorWin && !editorWin.isDestroyed()) {
    editorWin.close();
  }
  const display = screen.getPrimaryDisplay();
  const w = Math.min(display.workAreaSize.width - 80, 1200);
  const h = Math.min(display.workAreaSize.height - 80, 760);
  // 编辑器置顶（floating 级别），避免标注时被其他窗口遮挡；用户复制/保存后会主动关闭
  editorWin = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 720,
    minHeight: 480,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  editorWin.setAlwaysOnTop(true, 'floating');
  const isTempRaw = !existingItem;   // 从 picker 打开的是临时整屏图，关闭时清理
  editorWin.loadFile(path.join(__dirname, 'renderer', 'editor.html'));
  editorWin.webContents.on('did-finish-load', () => {
    editorWin.webContents.send('editor-init', {
      imagePath: imagePath,
      rect: rect || null,
      scaleFactor: scaleFactor || 1,
      existingItem: existingItem || null
    });
  });
  editorWin.on('closed', () => {
    editorWin = null;
    // 清理临时 raw 文件，避免磁盘泄漏
    if (isTempRaw && imagePath) {
      try { if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath); } catch (e) {}
    }
  });
  editorWin.show();
  editorWin.focus();
}

// 编辑器保存：接收 base64 图片，保存到历史
ipcMain.handle('save-screenshot', async (event, args) => {
  const { base64, width, height } = args;
  try {
    const buf = Buffer.from(base64, 'base64');
    const file = path.join(getHistoryDir(), `final_${Date.now()}.png`);
    fs.writeFileSync(file, buf);
    const item = {
      id: uuidv4(),
      path: file,
      time: Date.now(),
      width: width,
      height: height
    };
    addToHistory(item);
    return { ok: true, path: file };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 复制到剪贴板
ipcMain.handle('copy-to-clipboard', async (event, args) => {
  const { base64 } = args;
  try {
    const buf = Buffer.from(base64, 'base64');
    const img = nativeImage.createFromBuffer(buf);
    clipboard.writeImage(img);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 贴图钉屏幕
ipcMain.handle('pin-screenshot', async (event, args) => {
  const { base64, x, y, width, height } = args;
  try {
    const buf = Buffer.from(base64, 'base64');
    const file = path.join(getHistoryDir(), `pin_${Date.now()}.png`);
    fs.writeFileSync(file, buf);
    const pin = new BrowserWindow({
      x: x || 100,
      y: y || 100,
      width: width || 400,
      height: height || 300,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    pin.loadFile(path.join(__dirname, 'renderer', 'pin.html'));
    pin.webContents.on('did-finish-load', () => {
      pin.webContents.send('pin-init', { imagePath: file });
    });
    pinWindows.add(pin);
    pinFiles.set(pin, file);
    pin.on('closed', () => {
      pinWindows.delete(pin);
      // 清理 pin 临时文件，避免磁盘泄漏
      const f = pinFiles.get(pin);
      if (f) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
        pinFiles.delete(pin);
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// pin 窗口右键菜单：关闭 / 另存为 / 复制到剪贴板
ipcMain.handle('pin-context-menu', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false };
  const file = pinFiles.get(win);
  const menu = Menu.buildFromTemplate([
    {
      label: '另存为…',
      click: async () => {
        if (!file || !fs.existsSync(file)) return;
        const result = await dialog.showSaveDialog(win, {
          title: '保存贴图',
          defaultPath: `贴图_${Date.now()}.png`,
          filters: [{ name: 'PNG 图片', extensions: ['png'] }]
        });
        if (result.canceled) return;
        try { fs.copyFileSync(file, result.filePath); } catch (e) {}
      }
    },
    {
      label: '复制到剪贴板',
      click: () => {
        if (!file || !fs.existsSync(file)) return;
        try {
          const img = nativeImage.createFromPath(file);
          clipboard.writeImage(img);
        } catch (e) {}
      }
    },
    { type: 'separator' },
    {
      label: '关闭贴图',
      click: () => win.close()
    }
  ]);
  menu.popup(win);
  return { ok: true };
});

// 贴图滚轮缩放：等比缩放发起请求的 pin 窗口（图像填满窗口，缩放窗口即缩放图像）
ipcMain.handle('pin-zoom', async (event, args) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return { ok: false };
  const { delta } = args;
  const [w, h] = win.getSize();
  const factor = (typeof delta === 'number' && delta < 0) ? 1.1 : 0.9;
  let newW = Math.round(w * factor);
  let newH = Math.round(h * factor);
  // 限制在工作区内，避免贴图缩放到屏幕外
  const display = screen.getDisplayMatching(win.getBounds());
  const maxW = display.workAreaSize.width;
  const maxH = display.workAreaSize.height;
  if (newW > maxW) newW = maxW;
  if (newH > maxH) newH = maxH;
  if (newW < 80) newW = 80;
  if (newH < 60) newH = 60;
  win.setSize(newW, newH);
  return { ok: true, width: newW, height: newH };
});

// 打开外部链接（仅 http/https，用于爱发电等入口）
ipcMain.handle('open-external', async (event, args) => {
  const { url } = args;
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false };
});

// 读取图片为 base64（白名单校验：仅允许 historyDir 内或历史列表中的路径）
ipcMain.handle('read-image', async (event, args) => {
  const { path: p } = args;
  try {
    if (!isPathSafe(p)) return { ok: false, error: '路径不在允许范围内' };
    const buf = fs.readFileSync(p);
    return { ok: true, base64: buf.toString('base64') };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 获取历史
ipcMain.handle('get-history', async () => {
  return loadHistory();
});

// 删除历史项
ipcMain.handle('delete-history', async (event, args) => {
  const { id } = args;
  const list = loadHistory();
  const item = list.find(x => x.id === id);
  if (item) {
    try { fs.unlinkSync(item.path); } catch (e) {}
  }
  const newList = list.filter(x => x.id !== id);
  saveHistory(newList);
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('history-updated', newList);
  }
  return { ok: true };
});

// 在文件夹中显示（白名单校验）
ipcMain.handle('show-in-folder', async (event, args) => {
  const { path: p } = args;
  if (!isPathSafe(p)) return { ok: false, error: '路径不在允许范围内' };
  shell.showItemInFolder(p);
  return { ok: true };
});

// 保存到指定位置
ipcMain.handle('save-as', async (event, args) => {
  const { base64 } = args;
  // 优先用编辑器窗口作为父窗口，其次主窗口；均不可用时不指定父窗口
  const parent = (editorWin && !editorWin.isDestroyed()) ? editorWin
               : (mainWin && !mainWin.isDestroyed()) ? mainWin : undefined;
  const result = await dialog.showSaveDialog(parent, {
    title: '保存截图',
    defaultPath: `截图_${Date.now()}.png`,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  });
  if (result.canceled) return { ok: false, canceled: true };
  try {
    const buf = Buffer.from(base64, 'base64');
    fs.writeFileSync(result.filePath, buf);
    return { ok: true, path: result.filePath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 从历史打开编辑器
ipcMain.handle('edit-from-history', async (event, args) => {
  const { id } = args;
  const list = loadHistory();
  const item = list.find(x => x.id === id);
  if (item && fs.existsSync(item.path)) {
    openEditor(item.path, item);
    return { ok: true };
  }
  return { ok: false, error: '文件不存在' };
});

// 窗口控制
ipcMain.handle('win-close', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
  return { ok: true };
});
ipcMain.handle('win-minimize', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
  return { ok: true };
});
ipcMain.handle('win-maximize', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
  return { ok: true };
});

ipcMain.handle('picker-cancel', async () => {
  if (pickerWin) { pickerWin.close(); pickerWin = null; }
  return { ok: true };
});

// 主窗口"立即截图"按钮触发截图流程
ipcMain.handle('trigger-screenshot', async () => {
  startScreenshot();
  return { ok: true };
});

// 获取编辑器窗口在屏幕上的位置和尺寸（用于贴图定位到编辑器旁边）
ipcMain.handle('get-editor-bounds', async () => {
  if (!editorWin || editorWin.isDestroyed()) return { ok: false };
  const [x, y] = editorWin.getPosition();
  const [w, h] = editorWin.getSize();
  return { ok: true, x, y, w, h };
});

// 保存拼接后的整屏图（多屏截图场景，picker 内 canvas 拼好后传 base64 来）
// 保存为临时文件供 editor 读取，editor 关闭时由 openEditor 的清理逻辑删除
ipcMain.handle('save-temp-raw', async (event, args) => {
  const { base64 } = args;
  try {
    const buf = Buffer.from(base64, 'base64');
    const file = path.join(getHistoryDir(), `raw_composed_${Date.now()}.png`);
    fs.writeFileSync(file, buf);
    return { ok: true, path: file };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 清理临时单屏 raw 文件（多屏拼接完成后，原始单屏 raw 不再需要）
ipcMain.handle('cleanup-temp-file', async (event, args) => {
  const { path: p } = args;
  if (!isPathSafe(p)) return { ok: false, error: '路径不在允许范围内' };
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    // 清理上次崩溃残留的临时文件（raw_*.png / pin_*.png / raw_composed_*.png）
    cleanupOrphanTempFiles();
    createMainWindow();
    createTray();
    // 注册全局快捷键（检查返回值，失败时在控制台告警）
    const regA = globalShortcut.register('CommandOrControl+Shift+A', () => {
      startScreenshot();
    });
    if (!regA) console.warn('[截图管家] 全局快捷键 Ctrl+Shift+A 注册失败，可能已被占用');
    // 也支持 Ctrl+Shift+Q 作为备用
    const regQ = globalShortcut.register('CommandOrControl+Shift+Q', () => {
      startScreenshot();
    });
    if (!regQ) console.warn('[截图管家] 全局快捷键 Ctrl+Shift+Q 注册失败，可能已被占用');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 不退出，留在托盘
app.on('window-all-closed', () => {
  // Windows 上不退出，留在托盘
});
