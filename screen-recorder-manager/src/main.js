// 录屏管家 - 主进程
// 苹果白高端风格本地屏幕录制工具
const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, shell, dialog, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('./uuid-lite');

// 状态
let tray = null;
let mainWin = null;
let isRecording = false;   // 录制状态（供托盘快捷键切换用）

// 历史目录：录制的 webm 文件存放处
function getHistoryDir() {
  const dir = path.join(app.getPath('userData'), 'recordings');
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

// 原子写入：先写 .tmp 再 rename，避免崩溃导致 history.json 损坏
function saveHistory(list) {
  try {
    const f = getHistoryFile();
    const tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmp, f);
  } catch (e) {}
}

function addToHistory(item) {
  const list = loadHistory();
  list.unshift(item);
  // 最多保留 200 条
  if (list.length > 200) list.length = 200;
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
  if (resolved.startsWith(historyDir + path.sep) || resolved === historyDir) return true;
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
    { label: '开始/停止录制 (Ctrl+Shift+R)', click: () => toggleRecordingFromTray() },
    { type: 'separator' },
    { label: '打开主窗口', click: () => { showMainWindow(); } },
    { label: '退出', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('录屏管家 - Ctrl+Shift+R 开始/停止录制');
  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow());
}

// 托盘快捷键触发：通知渲染进程切换录制状态
function toggleRecordingFromTray() {
  if (!mainWin || mainWin.isDestroyed()) {
    showMainWindow();
    return;
  }
  showMainWindow();
  mainWin.webContents.send('toggle-recording');
}

// 主窗口
function createMainWindow() {
  const demoMode = fs.existsSync(path.join(__dirname, '..', '.demo'));
  const display = screen.getPrimaryDisplay();
  const w = Math.min(display.workAreaSize.width - 80, 1080);
  const h = Math.min(display.workAreaSize.height - 60, 720);
  mainWin = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 860,
    minHeight: 540,
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
  // 通过 URL hash 同步传递 demo 标志，避免 IPC 异步时序问题
  const loadOpts = demoMode ? { hash: 'demo' } : {};
  mainWin.loadFile(path.join(__dirname, 'renderer', 'index.html'), loadOpts);
  mainWin.once('ready-to-show', () => {
    mainWin.show();
  });
  // 双重保险：did-finish-load 后强制注入 demo 模式（防止 hash 未生效）
  if (demoMode) {
    mainWin.webContents.on('did-finish-load', () => {
      mainWin.webContents.executeJavaScript(
        'if (typeof demoMode !== "undefined" && !demoMode) { demoMode = true; if (typeof renderDemoSources === "function") renderDemoSources(); if (typeof renderHistory === "function") renderHistory(); }'
      ).catch(() => {});
    });
  }
  mainWin.on('close', (e) => {
    // 录制中不允许直接关闭，避免丢失录制
    if (isRecording) {
      e.preventDefault();
      dialog.showMessageBox(mainWin, {
        type: 'warning',
        title: '录制中',
        message: '正在录制中，请先停止录制再关闭窗口',
        buttons: ['知道了']
      });
      return;
    }
    e.preventDefault();
    mainWin.hide();
  });
}

function showMainWindow() {
  if (!mainWin) createMainWindow();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  const sendHistory = () => { if (!mainWin.isDestroyed()) mainWin.webContents.send('history-updated', loadHistory()); };
  if (mainWin.webContents.isLoading()) {
    mainWin.webContents.once('did-finish-load', sendHistory);
  } else {
    sendHistory();
  }
}

// ========== IPC ==========

// 查询 demo 模式状态（通过 .demo 信号文件触发）
ipcMain.handle('get-demo-mode', async () => {
  return fs.existsSync(path.join(__dirname, '..', '.demo'));
});

// 获取可录制的源（屏幕 + 窗口）
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true
    });
    // 返回精简信息（thumbnail 转 base64 PNG，窗口图标转 base64）
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      display_id: s.display_id,
      thumbnail: s.thumbnail.toPNG().toString('base64'),
      icon: s.appIcon ? s.appIcon.toPNG().toString('base64') : null
    }));
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 渲染进程通知录制状态变化（用于快捷键切换 + 关闭拦截）
ipcMain.handle('set-recording-state', async (event, args) => {
  isRecording = !!args.recording;
  // 更新托盘提示
  if (tray) {
    tray.setToolTip(isRecording ? '录屏管家 - 录制中…再次按 Ctrl+Shift+R 停止' : '录屏管家 - Ctrl+Shift+R 开始录制');
  }
  return { ok: true };
});

// 保存录制：接收 ArrayBuffer，写入 webm 文件并加入历史
ipcMain.handle('save-recording', async (event, args) => {
  try {
    const { buffer, duration, size, sourceName, mimeType } = args;
    const buf = Buffer.from(buffer);
    const ext = (mimeType && mimeType.indexOf('mp4') >= 0) ? 'mp4' : 'webm';
    const file = path.join(getHistoryDir(), `rec_${Date.now()}.${ext}`);
    fs.writeFileSync(file, buf);
    const item = {
      id: uuidv4(),
      path: file,
      time: Date.now(),
      duration: duration || 0,     // 秒
      size: size || buf.length,    // 字节
      sourceName: sourceName || '屏幕',
      format: ext
    };
    addToHistory(item);
    return { ok: true, path: file };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 获取历史
ipcMain.handle('get-history', async () => {
  return loadHistory();
});

// 删除历史项（同时删除文件）
ipcMain.handle('delete-history', async (event, args) => {
  const { id } = args;
  const list = loadHistory();
  const item = list.find(x => x.id === id);
  if (item) {
    try { if (fs.existsSync(item.path)) fs.unlinkSync(item.path); } catch (e) {}
  }
  const newList = list.filter(x => x.id !== id);
  saveHistory(newList);
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('history-updated', newList);
  }
  return { ok: true };
});

// 读取视频文件为 base64（白名单校验，用于预览播放）
ipcMain.handle('read-video', async (event, args) => {
  const { path: p } = args;
  try {
    if (!isPathSafe(p)) return { ok: false, error: '路径不在允许范围内' };
    const buf = fs.readFileSync(p);
    return { ok: true, base64: buf.toString('base64'), size: buf.length };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 在文件夹中显示（白名单校验）
ipcMain.handle('show-in-folder', async (event, args) => {
  const { path: p } = args;
  if (!isPathSafe(p)) return { ok: false, error: '路径不在允许范围内' };
  shell.showItemInFolder(p);
  return { ok: true };
});

// 另存为：把历史中的视频复制到用户选择的位置
ipcMain.handle('save-as', async (event, args) => {
  const { path: p } = args;
  if (!isPathSafe(p) || !fs.existsSync(p)) return { ok: false, error: '源文件不存在' };
  const ext = path.extname(p) || '.webm';
  const parent = (mainWin && !mainWin.isDestroyed()) ? mainWin : undefined;
  const result = await dialog.showSaveDialog(parent, {
    title: '另存为',
    defaultPath: `录屏_${Date.now()}${ext}`,
    filters: [{ name: ext === '.mp4' ? 'MP4 视频' : 'WebM 视频', extensions: [ext.replace('.', '')] }]
  });
  if (result.canceled) return { ok: false, canceled: true };
  try {
    fs.copyFileSync(p, result.filePath);
    return { ok: true, path: result.filePath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
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

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    createMainWindow();
    createTray();
    // 全局快捷键：Ctrl+Shift+R 开始/停止录制
    const regR = globalShortcut.register('CommandOrControl+Shift+R', () => {
      toggleRecordingFromTray();
    });
    if (!regR) console.warn('[录屏管家] 全局快捷键 Ctrl+Shift+R 注册失败，可能已被占用');

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
