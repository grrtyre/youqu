// launcher-manager 主进程
// 快速应用启动器 - 全局热键唤起、模糊搜索已安装应用、苹果白风格
const { app, BrowserWindow, globalShortcut, ipcMain, screen, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { AppIndexer } = require('./lib/appIndexer');
const { fuzzySearch } = require('./lib/fuzzySearch');

let mainWindow = null;
let indexer = null;

// 截图模式：注入演示数据、禁用失焦隐藏与热键，便于后台 PrintWindow 截取
const SCREENSHOT_MODE = process.argv.includes('--screenshot');

// 演示数据（截图模式下展示，呈现苹果白界面效果）
// 8 个应用让结果列表更饱满，并配合"最近使用 / 全部应用"小节标签呈现层级
const DEMO_APPS = [
  { name: 'Google Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', icon: null, ext: '.lnk' },
  { name: 'Visual Studio Code', path: 'C:\\Users\\demo\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe', icon: null, ext: '.lnk' },
  { name: 'Windows Terminal', path: 'C:\\Users\\demo\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe', icon: null, ext: '.lnk' },
  { name: 'Figma', path: 'C:\\Users\\demo\\AppData\\Local\\Programs\\Figma\\Figma.exe', icon: null, ext: '.lnk' },
  { name: 'Spotify', path: 'C:\\Users\\demo\\AppData\\Roaming\\Spotify\\Spotify.exe', icon: null, ext: '.lnk' },
  { name: 'Notion', path: 'C:\\Users\\demo\\AppData\\Local\\Programs\\Notion\\Notion.exe', icon: null, ext: '.lnk' },
  { name: 'Telegram', path: 'C:\\Users\\demo\\AppData\\Roaming\\Telegram Desktop\\Telegram.exe', icon: null, ext: '.lnk' },
  { name: 'WeChat', path: 'C:\\Program Files\\Tencent\\WeChat\\WeChat.exe', icon: null, ext: '.lnk' }
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
  const winW = SCREENSHOT_MODE ? 680 : 640;
  const winH = SCREENSHOT_MODE ? 660 : 460;

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 480,
    minHeight: 360,
    x: Math.round((screenWidth - winW) / 2),
    y: Math.round(screenHeight * 0.28),
    frame: false,
    // 截图模式：非透明 + 浅灰底，让白色圆角卡片在截图中清晰可见
    transparent: !SCREENSHOT_MODE,
    resizable: true,
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
    SCREENSHOT_MODE ? { query: { shot: '1' } } : undefined);

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

// 索引应用（启动时 + 每隔 5 分钟刷新）
function startIndexing() {
  if (SCREENSHOT_MODE) {
    // 截图模式：注入演示"最近使用"数据 —— 前 4 个标记为最近
    // 让"最近使用"(4) + "全部应用"(4) 两个小节都可见，充分呈现层级
    recentApps = [
      { path: DEMO_APPS[0].path, count: 12, time: Date.now() },
      { path: DEMO_APPS[1].path, count: 8, time: Date.now() - 1000 },
      { path: DEMO_APPS[3].path, count: 5, time: Date.now() - 2000 },
      { path: DEMO_APPS[2].path, count: 3, time: Date.now() - 3000 }
    ];
    buildAppList();
    return;
  }
  indexer = new AppIndexer();
  indexer.scan().then(() => {
    buildAppList();
  }).catch(err => {
    console.error('应用索引失败:', err);
  });
  setInterval(() => {
    if (indexer) {
      indexer.scan().then(buildAppList).catch(() => {});
    }
  }, 5 * 60 * 1000);
}

app.whenReady().then(() => {
  loadRecent();
  createWindow();
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

ipcMain.handle('launch-app', (event, appPath) => {
  try {
    saveRecent(appPath);
    shell.openPath(appPath);
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
