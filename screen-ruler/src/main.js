// src/main.js — 屏幕尺管家主进程
// 全屏透明覆盖窗口 + 全局热键 + 桌面截图取色

const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain, nativeImage, clipboard } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { physicalPixels, matchDisplaySource } = require('./core/ruler-core');

const store = new Store({ name: 'screen-ruler-config' });

let overlay = null;
let panel = null; // 主控面板（小窗）
let frozenSnapshot = null; // 唤起时冻结的桌面截图 dataURL

// ============ 工具函数 ============
function getActiveDisplay() {
  const cursor = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursor);
}

// 截取指定显示器整个画面
// HiDPI 修复：thumbnailSize 用物理像素（逻辑像素 × scaleFactor），避免 150%/200% 缩放屏截图模糊
// 多屏匹配修复：严格按 display.id 匹配桌面源，找不到直接报错，不再"取 sources[0] 兜底"以免拿错屏
async function captureDisplay(display) {
  const sf = display.scaleFactor || 1;
  const phys = physicalPixels(display.bounds.width, display.bounds.height, sf);
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: phys.width, height: phys.height }
  });
  const matched = matchDisplaySource(sources, display.id);
  if (!matched) {
    throw new Error(`未找到显示器 ${display.id} 的桌面源（可用源数：${sources.length}）`);
  }
  return matched.thumbnail;
}

// ============ 覆盖窗口（测量画布） ============
function createOverlay(display, snapshotDataURL) {
  const b = display.bounds;
  overlay = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    frame: false,
    fullscreen: false,
    movable: false,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  overlay.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
  overlay.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlay.once('ready-to-show', () => {
    // 截图失败时 dataURL 为 null，前端会显示纯透明背景（仍可用坐标/十字线，但不能取色量距）
    overlay.webContents.send('snapshot', { dataURL: snapshotDataURL, bounds: b, scaleFactor: display.scaleFactor });
    overlay.show();
  });
  overlay.on('closed', () => { overlay = null; });
}

// ============ 主控面板（小窗，常驻） ============
function createPanel() {
  const b = getActiveDisplay().bounds;
  panel = new BrowserWindow({
    width: 360, height: 540,
    x: b.x + b.width - 380, y: b.y + 40,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  panel.loadFile(path.join(__dirname, 'renderer', 'panel.html'));
  panel.once('ready-to-show', () => panel.show());
  panel.on('closed', () => { panel = null; });
}

// ============ 唤起/退出覆盖模式 ============
async function enterOverlay() {
  if (overlay) { overlay.focus(); return; }
  const display = getActiveDisplay();
  let thumb;
  try {
    thumb = await captureDisplay(display);
  } catch (err) {
    // 截图失败（如多屏匹配不到源、权限被拒）：用透明 1×1 占位图，仍然打开覆盖层
    // 让用户至少能看到坐标/十字线（不能取色和量距）
    console.error('[屏幕尺管家] captureDisplay 失败：', err.message);
    const { nativeImage } = require('electron');
    thumb = nativeImage.createEmpty();
  }
  frozenSnapshot = thumb.isEmpty() ? null : thumb.toDataURL();
  createOverlay(display, frozenSnapshot);
}

function exitOverlay() {
  if (overlay) overlay.close();
}

// ============ IPC ============
ipcMain.on('exit-overlay', () => exitOverlay());
ipcMain.on('save-history', (_e, item) => {
  const list = store.get('history', []);
  list.unshift(item);
  store.set('history', list.slice(0, 50));
  if (panel) panel.webContents.send('history-updated', store.get('history', []));
});
ipcMain.on('copy-text', (_e, text) => clipboard.writeText(text));
ipcMain.on('get-history', (e) => e.sender.send('history-updated', store.get('history', [])));
ipcMain.on('clear-history', () => {
  store.set('history', []);
  if (panel) panel.webContents.send('history-updated', []);
});
ipcMain.on('hide-panel', () => { if (panel) panel.hide(); });
ipcMain.on('show-panel', () => { if (panel) panel.show(); });
ipcMain.on('quit-app', () => { app.quit(); });
ipcMain.on('minimize-panel', () => { if (panel) panel.minimize(); });
ipcMain.on('toggle-always-on-top', () => {
  if (panel) panel.setAlwaysOnTop(!panel.isAlwaysOnTop());
});
ipcMain.on('trigger-overlay', async () => { await enterOverlay(); });

// ============ 全局热键 ============
app.whenReady().then(() => {
  createPanel();
  // Ctrl+Shift+R 唤起测量
  globalShortcut.register('Ctrl+Shift+R', () => { enterOverlay(); });
  // Ctrl+Shift+P 显示/隐藏面板
  globalShortcut.register('Ctrl+Shift+P', () => {
    if (!panel) createPanel();
    else if (panel.isVisible()) panel.hide();
    else panel.show();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
