// launcher-manager 主进程
// 快速应用启动器 - 全局热键唤起、模糊搜索已安装应用、苹果白风格
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { AppIndexer } = require('./lib/appIndexer');
const { fuzzySearch } = require('./lib/fuzzySearch');

let mainWindow = null;
let indexer = null;
let tray = null;
let isIndexing = false;

// 截图模式：注入演示数据、禁用失焦隐藏与热键，便于后台 PrintWindow 截取
const SCREENSHOT_MODE = process.argv.includes('--screenshot');

// 截图模式查询字符串：支持 --q=<query> 注入搜索词
function buildShotQuery() {
  const q = process.argv.find(a => a.startsWith('--q='));
  const query = { shot: '1' };
  if (q) {
    query.q = decodeURIComponent(q.slice(4));
  }
  return query;
}

// 演示数据（截图模式下展示，呈现苹果白界面效果）
const DEMO_APPS = [
  { name: 'Google Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', icon: null, ext: '.lnk' },
  { name: 'Visual Studio Code', path: 'C:\\Users\\demo\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe', icon: null, ext: '.lnk' },
  { name: 'Windows Terminal', path: 'C:\\Users\\demo\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe', icon: null, ext: '.lnk' },
  { name: 'Spotify', path: 'C:\\Users\\demo\\AppData\\Roaming\\Spotify\\Spotify.exe', icon: null, ext: '.lnk' },
  { name: 'Notion', path: 'C:\\Users\\demo\\AppData\\Local\\Programs\\Notion\\Notion.exe', icon: null, ext: '.lnk' }
];

// 索引缓存
let appList = [];
let recentApps = []; // 最近启动的应用路径

const RECENT_FILE = path.join(app.getPath('userData'), 'recent.json');

// 加载最近使用记录
function loadRecent() {
  try {
    if (fs.existsSync(RECENT_FILE)) {
      recentApps = JSON.parse(fs.readFileSync(RECENT_FILE, 'utf8'));
    }
  } catch (e) {
    recentApps = [];
  }
}

// 保存最近使用记录（最多 20 条，按使用次数+时间排序）
function saveRecent(appPath) {
  const existing = recentApps.find(a => a.path === appPath);
  if (existing) {
    existing.count = (existing.count || 0) + 1;
    existing.time = Date.now();
  } else {
    recentApps.push({ path: appPath, count: 1, time: Date.now() });
  }
  recentApps.sort((a, b) => (b.count - a.count) || (b.time - a.time));
  recentApps = recentApps.slice(0, 20);
  try {
    fs.writeFileSync(RECENT_FILE, JSON.stringify(recentApps, null, 2));
  } catch (e) {
    // 忽略写入错误
  }
}

// 构建应用列表（带最近使用排序）
function buildAppList() {
  const indexed = SCREENSHOT_MODE ? DEMO_APPS : (indexer ? indexer.getApps() : []);
  const recentMap = new Map();
  recentApps.forEach((r, i) => recentMap.set(r.path, { count: r.count, idx: i }));
  appList = indexed.map(a => {
    const rec = recentMap.get(a.path);
    return {
      ...a,
      recentCount: rec ? rec.count : 0,
      recentIdx: rec ? rec.idx : -1
    };
  });
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const winW = SCREENSHOT_MODE ? 660 : 640;
  const winH = SCREENSHOT_MODE ? 520 : 460;

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 480,
    minHeight: 360,
    maxWidth: 800,
    maxHeight: 720,
    x: Math.round((screenWidth - winW) / 2),
    y: Math.round(screenHeight * 0.28),
    frame: false,
    // 截图模式：非透明 + 浅灰底，让白色圆角卡片在截图中清晰可见
    transparent: !SCREENSHOT_MODE,
    resizable: false,
    show: false,
    skipTaskbar: true,
    backgroundColor: SCREENSHOT_MODE ? '#f0f0f4' : '#00000000',
    hasShadow: !SCREENSHOT_MODE,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'),
    SCREENSHOT_MODE ? { query: buildShotQuery() } : undefined);

  // 失焦自动隐藏（仿 Spotlight 体验）；截图模式下禁用以便后台截取
  if (!SCREENSHOT_MODE) {
    mainWindow.on('blur', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }
    });
  }

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    buildAppList();
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const [w, h] = mainWindow.getSize();
    mainWindow.setPosition(Math.round((sw - w) / 2), Math.round(sh * 0.28));
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('window-shown');
  }
}

function registerHotkey() {
  if (SCREENSHOT_MODE) return; // 截图模式不注册热键，避免冲突
  const ret = globalShortcut.register('Alt+Space', toggleWindow);
  if (!ret) {
    console.error('全局热键注册失败，可能被其他程序占用');
  }
}

// 索引应用（启动时 + 每隔 15 分钟刷新；避免 5 分钟过频造成磁盘 IO 浪费）
function startIndexing() {
  if (SCREENSHOT_MODE) {
    // 截图模式：注入演示"最近使用"数据，让"最近"标记可见
    recentApps = [
      { path: DEMO_APPS[0].path, count: 8, time: Date.now() },
      { path: DEMO_APPS[1].path, count: 5, time: Date.now() - 1000 },
      { path: DEMO_APPS[3].path, count: 3, time: Date.now() - 2000 }
    ];
    buildAppList();
    notifyIndexingState();
    return;
  }
  indexer = new AppIndexer();
  isIndexing = true;
  notifyIndexingState();
  indexer.scan().then(() => {
    isIndexing = false;
    buildAppList();
    notifyIndexingState();
  }).catch(err => {
    isIndexing = false;
    notifyIndexingState();
    console.error('应用索引失败:', err);
  });
  setInterval(() => {
    if (indexer) {
      isIndexing = true;
      notifyIndexingState();
      indexer.scan().then(() => {
        isIndexing = false;
        buildAppList();
        notifyIndexingState();
      }).catch(() => {
        isIndexing = false;
        notifyIndexingState();
      });
    }
  }, 15 * 60 * 1000);
}

// 通知渲染进程索引状态变化（用于状态栏显示"正在索引..."）
function notifyIndexingState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('indexing-state', {
      indexing: isIndexing,
      count: appList.length
    });
  }
}

function createTray() {
  // 系统托盘：让用户感知应用常驻，避免忘记 Alt+Space 后以为应用消失
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  let trayIcon = nativeImage.createEmpty();
  try {
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
    }
  } catch (e) {
    // 图标加载失败时使用空图标，托盘仍可用
  }
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  tray.setToolTip('Launcher Manager · Alt+Space 唤起');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示启动器',
      click: () => toggleWindow()
    },
    {
      label: '重新索引应用',
      click: () => {
        if (indexer) {
          isIndexing = true;
          notifyIndexingState();
          indexer.scan().then(() => {
            isIndexing = false;
            buildAppList();
            notifyIndexingState();
          }).catch(() => {
            isIndexing = false;
            notifyIndexingState();
          });
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        globalShortcut.unregisterAll();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleWindow());
}

app.whenReady().then(() => {
  loadRecent();
  createWindow();
  createTray();
  registerHotkey();
  startIndexing();
  // 截图模式：显示窗口但不抢焦点（showInactive），避免打扰用户当前操作
  if (SCREENSHOT_MODE && mainWindow) {
    mainWindow.showInactive();
    mainWindow.setSkipTaskbar(true);
  }
});

app.on('window-all-closed', e => {
  e.preventDefault();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});

// ===== IPC 处理 =====

ipcMain.handle('search-apps', (event, query) => {
  if (!query || !query.trim()) {
    const recent = appList
      .filter(a => a.recentIdx >= 0)
      .sort((a, b) => a.recentIdx - b.recentIdx);
    // fill 需排除已在 recent 中的应用，避免重复显示
    const recentPaths = new Set(recent.map(a => a.path));
    const fill = appList.filter(a => !recentPaths.has(a.path)).slice(0, 8);
    return [...recent, ...fill].slice(0, 8).map(a => ({
      name: a.name,
      path: a.path,
      icon: a.icon || null,
      recent: a.recentIdx >= 0
    }));
  }
  const results = fuzzySearch(appList, query, { key: 'name', limit: 8 });
  return results.map(r => ({
    name: r.item.name,
    path: r.item.path,
    icon: r.item.icon || null,
    score: r.score,
    recent: r.item.recentIdx >= 0
  }));
});

ipcMain.handle('launch-app', async (event, appPath) => {
  try {
    saveRecent(appPath);
    // shell.openPath 异步返回错误字符串（成功时为空字符串），必须 await 才能拿到真实结果
    const err = await shell.openPath(appPath);
    if (err) {
      // 启动失败：不隐藏窗口，让用户看到错误提示
      return { success: false, error: err };
    }
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('hide-window', () => {
  if (mainWindow) mainWindow.hide();
  return true;
});

ipcMain.handle('get-app-count', () => {
  return appList.length;
});

ipcMain.handle('get-indexing-state', () => {
  return { indexing: isIndexing, count: appList.length };
});
