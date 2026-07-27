// launcher-manager 主进程
// 快速应用启动器 - 全局热键唤起、模糊搜索已安装应用、苹果白风格
const { app, BrowserWindow, globalShortcut, ipcMain, screen, shell, nativeImage, Tray, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { AppIndexer } = require('./lib/appIndexer');
const { fuzzySearch } = require('./lib/fuzzySearch');

let mainWindow = null;
let indexer = null;
let tray = null;
let firstLaunchShown = false; // 首次启动是否已展示过窗口
let blurHideTimer = null; // 失焦延迟隐藏计时器
let isIndexing = false; // 是否正在索引

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
  // 加 220ms 延迟：避免用户切到辅助窗口（如输入法候选框、字典）时立即消失
  if (!SCREENSHOT_MODE) {
    mainWindow.on('blur', () => {
      if (blurHideTimer) clearTimeout(blurHideTimer);
      blurHideTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
          mainWindow.hide();
        }
        blurHideTimer = null;
      }, 220);
    });
    mainWindow.on('focus', () => {
      if (blurHideTimer) {
        clearTimeout(blurHideTimer);
        blurHideTimer = null;
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
  isIndexing = true;
  notifyIndexingStatus();
  indexer.scan().then(() => {
    buildAppList();
    isIndexing = false;
    notifyIndexingStatus();
  }).catch(err => {
    console.error('应用索引失败:', err);
    isIndexing = false;
    notifyIndexingStatus();
  });
  setInterval(() => {
    if (indexer) {
      isIndexing = true;
      notifyIndexingStatus();
      indexer.scan().then(() => {
        buildAppList();
        isIndexing = false;
        notifyIndexingStatus();
      }).catch(() => {
        isIndexing = false;
        notifyIndexingStatus();
      });
    }
  }, 5 * 60 * 1000);
}

// 通知渲染层索引状态变化（用于状态栏显示"索引中..."）
function notifyIndexingStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('indexing-status', { indexing: isIndexing, count: appList.length });
  }
}

// 创建系统托盘（仿 Spotlight 的常驻体验，提供可见性 + 退出入口）
function createTray() {
  if (SCREENSHOT_MODE) return;
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  let trayIcon = null;
  try {
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
    }
  } catch (e) {}
  // 回退：用一个 16x16 透明图（避免 Tray 抛错）
  if (!trayIcon || trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  tray.setToolTip('Launcher Manager - Alt+Space 唤起');

  const menu = Menu.buildFromTemplate([
    { label: '显示搜索框', click: () => toggleWindow() },
    { type: 'separator' },
    { label: '重新索引应用', click: () => { startIndexing(); } },
    { type: 'separator' },
    { label: '退出', click: () => {
      globalShortcut.unregisterAll();
      if (tray) tray.destroy();
      app.quit();
    }}
  ]);
  tray.setContextMenu(menu);
  // 单击托盘图标也切换窗口
  tray.on('click', () => toggleWindow());
}

app.whenReady().then(() => {
  loadRecent();
  createWindow();
  registerHotkey();
  createTray();
  startIndexing();
  // 截图模式：显示窗口但不抢焦点（showInactive），避免打扰用户当前操作
  if (SCREENSHOT_MODE && mainWindow) {
    mainWindow.showInactive();
    mainWindow.setSkipTaskbar(true);
  } else if (mainWindow) {
    // 首次启动：主动展示一次窗口，让用户知道程序已运行（避免"双击没反应"误解）
    // 后续只能通过 Alt+Space 或托盘唤起
    if (!firstLaunchShown) {
      firstLaunchShown = true;
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('window-shown');
    }
  }
});

// 关闭窗口时不退出应用，隐藏到托盘（Spotlight 行为）
// 通过托盘菜单"退出"才会真正退出
app.on('window-all-closed', e => {
  e.preventDefault();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) tray.destroy();
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

// 右键菜单：打开所在文件夹 / 以管理员运行 / 复制路径
ipcMain.handle('show-context-menu', async (event, appPath) => {
  const { Menu } = require('electron');
  const menu = Menu.buildFromTemplate([
    {
      label: '打开所在文件夹',
      click: () => {
        // shell.showItemInFolder 会高亮选中该文件
        try { shell.showItemInFolder(appPath); } catch (e) {}
        if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
      }
    },
    {
      label: '以管理员身份运行',
      click: () => {
        // 借助 PowerShell 的 Start-Process -Verb RunAs 触发 UAC 提权
        try {
          const { exec } = require('child_process');
          const safePath = appPath.replace(/'/g, "''");
          exec(`powershell -NoProfile -Command "Start-Process -FilePath '${safePath}' -Verb RunAs"`, () => {});
        } catch (e) {}
        if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
      }
    },
    {
      label: '复制路径',
      click: () => {
        try { clipboard.writeText(appPath); } catch (e) {}
      }
    },
    { type: 'separator' },
    {
      label: '启动',
      click: () => {
        try {
          saveRecent(appPath);
          shell.openPath(appPath);
        } catch (e) {}
        if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
      }
    }
  ]);
  menu.popup();
  return true;
});
