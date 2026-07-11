'use strict';
// 水印管家 - Electron 主进程
// 苹果白风格控制面板 + 透明置顶鼠标穿透水印层（支持多屏）
// 防截图泄密、版权标识、办公溯源

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { mergeConfig, validateConfig, resolveVariables, formatTime, DEFAULT_CONFIG, TEMPLATES } = require('./core/watermark-core');

// 捕获未处理异常
process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync(os.tmpdir() + '\\watermark-manager-error.log',
      new Date().toISOString() + ' UNCAUGHT: ' + err.stack + '\n');
  } catch (_) {}
});

// ==================== 路径常量 ====================

function getConfigFile() {
  return path.join(app.getPath('userData'), 'config.json');
}

// ==================== 配置读写 ====================

let currentConfig = null;

function loadConfig() {
  try {
    const raw = fs.readFileSync(getConfigFile(), 'utf8');
    const data = JSON.parse(raw);
    return validateConfig(mergeConfig(data));
  } catch (_) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  try {
    const validated = validateConfig(config);
    fs.writeFileSync(getConfigFile(), JSON.stringify(validated, null, 2), 'utf8');
    currentConfig = validated;
    return validated;
  } catch (err) {
    return null;
  }
}

// ==================== 系统信息获取 ====================

function getSystemVars() {
  const username = os.userInfo().username || '用户';
  const machine = os.hostname() || 'PC';
  const now = new Date();
  const time = formatTime(now, currentConfig ? currentConfig.timeFormat : 'YYYY-MM-DD HH:mm');
  const date = formatTime(now, 'YYYY-MM-DD');
  const ip = getLocalIP();
  return { username, machine, time, date, ip };
}

function getLocalIP() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (_) {}
  return '127.0.0.1';
}

// ==================== 窗口管理 ====================

let mainWindow = null;       // 控制面板窗口
let tray = null;             // 系统托盘
let overlayWindows = [];     // 水印覆盖窗口（每个屏幕一个）
let timeUpdateTimer = null;  // 时间更新定时器
let hwndWritten = false;     // HWND 文件是否已写入

// 将主窗口句柄写入临时文件（供截图脚本使用）
function writeHwndFile() {
  if (hwndWritten) return;
  if (!mainWindow) return;
  try {
    const handle = mainWindow.getNativeWindowHandle();
    let hwndVal;
    if (process.arch === 'x64') {
      hwndVal = handle.readBigUInt64LE(0).toString();
    } else {
      hwndVal = handle.readUInt32LE(0).toString();
    }
    const hwndFile = path.join(os.tmpdir(), 'watermark-manager-hwnd.txt');
    fs.writeFileSync(hwndFile, hwndVal, 'utf8');
    hwndWritten = true;
  } catch (_) {}
}

// 创建控制面板窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 820,
    minWidth: 880,
    minHeight: 640,
    backgroundColor: '#ffffff',
    title: '水印管家',
    autoHideMenuBar: true,
    frame: process.platform === 'darwin',
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#ffffff',
      symbolColor: '#6e6e73',
      height: 40
    } : undefined,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 窗口加载完成后，延迟将窗口句柄写入临时文件（供截图脚本使用）
  // 延迟是为了确保渲染层的 async init() 完成后再截图
  mainWindow.webContents.once('did-finish-load', () => {
    // 兜底：8秒后无论如何都写 HWND 文件（防止 ready 信号丢失）
    setTimeout(() => {
      writeHwndFile();
    }, 8000);
  });

  // 关闭时最小化到托盘（如果配置允许）
  mainWindow.on('close', (e) => {
    if (currentConfig && currentConfig.minimizeToTray && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// 创建水印覆盖窗口（每个屏幕一个）
function createOverlayWindows() {
  // 先关闭旧的水印窗口
  closeOverlayWindows();

  const displays = screen.getAllDisplays();
  overlayWindows = displays.map((display) => {
    const { x, y, width, height } = display.bounds;
    const overlay = new BrowserWindow({
      x: x,
      y: y,
      width: width,
      height: height,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    // 设置窗口层级为屏幕保护级别（覆盖在普通窗口之上，但不抢焦点）
    overlay.setAlwaysOnTop(true, 'screen-saver');

    // 鼠标穿透：让水印不阻挡任何操作
    overlay.setIgnoreMouseEvents(true, { forward: false });

    overlay.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

    overlay.once('ready-to-show', () => {
      if (currentConfig && currentConfig.enabled) {
        overlay.show();
        sendConfigToOverlay(overlay);
      }
    });

    return overlay;
  });
}

// 关闭所有水印窗口
function closeOverlayWindows() {
  for (const win of overlayWindows) {
    try {
      win.destroy();
    } catch (_) {}
  }
  overlayWindows = [];
}

// 向水印窗口发送配置
function sendConfigToOverlay(targetWin) {
  const vars = getSystemVars();
  const payload = {
    config: currentConfig,
    vars: vars
  };
  if (targetWin) {
    try { targetWin.webContents.send('overlay:update', payload); } catch (_) {}
  } else {
    for (const win of overlayWindows) {
      try { win.webContents.send('overlay:update', payload); } catch (_) {}
    }
  }
}

// 开启水印
function enableWatermark() {
  if (overlayWindows.length === 0) {
    createOverlayWindows();
  }
  for (const win of overlayWindows) {
    win.show();
  }
  sendConfigToOverlay();
  startTimeUpdate();
}

// 关闭水印
function disableWatermark() {
  for (const win of overlayWindows) {
    try { win.hide(); } catch (_) {}
  }
  stopTimeUpdate();
}

// 刷新水印显示（配置变化时）
function refreshWatermark() {
  if (currentConfig && currentConfig.enabled) {
    if (overlayWindows.length === 0) {
      createOverlayWindows();
    }
    for (const win of overlayWindows) {
      win.show();
    }
    sendConfigToOverlay();
  } else {
    disableWatermark();
  }
}

// 时间更新定时器（动态时间水印每分钟刷新）
function startTimeUpdate() {
  stopTimeUpdate();
  timeUpdateTimer = setInterval(() => {
    if (currentConfig && currentConfig.enabled && currentConfig.showTime) {
      sendConfigToOverlay();
    }
  }, 60 * 1000);
}

function stopTimeUpdate() {
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer);
    timeUpdateTimer = null;
  }
}

// ==================== 托盘 ====================

function createTray() {
  // 使用一个简单的透明图标（如果没有ico则用nativeImage.createEmpty）
  let trayIcon;
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  try {
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
    } else {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (_) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('水印管家');

  function updateTrayMenu() {
    const enabled = currentConfig && currentConfig.enabled;
    const menu = Menu.buildFromTemplate([
      {
        label: enabled ? '✓ 水印已开启' : '○ 水印已关闭',
        enabled: false
      },
      { type: 'separator' },
      {
        label: enabled ? '关闭水印' : '开启水印',
        click: () => {
          currentConfig.enabled = !currentConfig.enabled;
          saveConfig(currentConfig);
          refreshWatermark();
          updateTrayMenu();
          if (mainWindow) {
            mainWindow.webContents.send('config:updated', currentConfig);
          }
        }
      },
      {
        label: '显示设置面板',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(menu);
  }

  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // 暴露刷新菜单的函数
  tray.updateMenu = updateTrayMenu;
}

// ==================== 开机自启 ====================

function setAutoStart(enable) {
  app.setLoginItemSettings({
    openAtLogin: !!enable,
    args: ['--hidden']
  });
}

// ==================== 应用初始化 ====================

app.whenReady().then(() => {
  currentConfig = loadConfig();

  createMainWindow();
  createTray();
  createOverlayWindows();
  registerScreenListeners();

  // 如果启用了水印，自动开启
  if (currentConfig.enabled) {
    setTimeout(() => {
      enableWatermark();
    }, 500);
  }

  // 如果是 --hidden 启动（开机自启），则隐藏主窗口
  if (process.argv.includes('--hidden')) {
    mainWindow.hide();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopTimeUpdate();
  closeOverlayWindows();
});

app.on('window-all-closed', () => {
  // 不退出，保持托盘运行（水印需要持续运行）
  // 但如果配置不允许最小化到托盘，则退出
  if (currentConfig && !currentConfig.minimizeToTray) {
    app.quit();
  }
});

// ==================== 屏幕变化监听 ====================
// 注意：screen 模块必须在 app.ready 后使用，所以在 whenReady 中注册监听器

function registerScreenListeners() {
  screen.on('display-added', () => {
    if (currentConfig && currentConfig.enabled) {
      createOverlayWindows();
      setTimeout(() => {
        for (const win of overlayWindows) { win.show(); }
        sendConfigToOverlay();
      }, 300);
    }
  });

  screen.on('display-removed', () => {
    if (currentConfig && currentConfig.enabled) {
      createOverlayWindows();
      setTimeout(() => {
        for (const win of overlayWindows) { win.show(); }
        sendConfigToOverlay();
      }, 300);
    }
  });

  screen.on('display-metrics-changed', () => {
    if (currentConfig && currentConfig.enabled) {
      createOverlayWindows();
      setTimeout(() => {
        for (const win of overlayWindows) { win.show(); }
        sendConfigToOverlay();
      }, 300);
    }
  });
}

// ==================== IPC 处理 ====================

// 渲染层就绪信号（init() 完成后触发）—— 写入 HWND 文件供截图脚本使用
ipcMain.on('app:ready', () => {
  // 延迟 1 秒确保 drawPreview 的 requestAnimationFrame 执行完毕
  setTimeout(() => {
    writeHwndFile();
  }, 1000);
});

// 获取当前配置
ipcMain.handle('config:get', async () => {
  return currentConfig;
});

// 保存配置
ipcMain.handle('config:save', async (_e, config) => {
  const saved = saveConfig(config);
  if (saved) {
    refreshWatermark();
    setAutoStart(saved.autoStart);
    if (tray && tray.updateMenu) tray.updateMenu();
    return { success: true, config: saved };
  }
  return { success: false, error: '保存失败' };
});

// 切换水印开关
ipcMain.handle('watermark:toggle', async (_e, enabled) => {
  currentConfig.enabled = !!enabled;
  saveConfig(currentConfig);
  refreshWatermark();
  if (tray && tray.updateMenu) tray.updateMenu();
  return { success: true, config: currentConfig };
});

// 获取模板列表
ipcMain.handle('templates:list', async () => {
  return TEMPLATES;
});

// 应用模板
ipcMain.handle('templates:apply', async (_e, templateId) => {
  const tpl = TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return { success: false };
  currentConfig.content = tpl.content;
  currentConfig.color = tpl.color;
  currentConfig.opacity = tpl.opacity;
  currentConfig.rotation = tpl.rotation;
  saveConfig(currentConfig);
  refreshWatermark();
  return { success: true, config: currentConfig };
});

// 获取系统信息（预览用）
ipcMain.handle('system:vars', async () => {
  return getSystemVars();
});

// 获取水印预览数据（给渲染层预览用）
ipcMain.handle('watermark:preview', async () => {
  const vars = getSystemVars();
  const resolvedContent = resolveVariables(currentConfig.content, vars);
  return {
    content: resolvedContent,
    config: currentConfig
  };
});

// 退出应用
ipcMain.handle('app:quit', async () => {
  app.isQuitting = true;
  app.quit();
});
