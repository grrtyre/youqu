// 速览管家 - Electron 主进程
// 职责：窗口管理、全局快捷键、读取 Explorer 选中文件、IPC、托盘、单实例

'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, shell, nativeImage, Tray, Menu, dialog, clipboard, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const core = require('./quick-look-core');

// 配置文件路径
const CONFIG_PATH = path.join(app.getPath('userData'), 'quick-look-config.json');
const HISTORY_PATH = path.join(app.getPath('userData'), 'quick-look-history.json');

let mainWindow = null;
let tray = null;
let history = new core.History(50);

// ===== blur 隐藏控制（修复 S1/S2/S3/S4）=====
// startupGraceUntil：启动后 1.5 秒内忽略 blur 隐藏，避免 ready-to-show 后窗口一闪而过
let startupGraceUntil = 0;
// suppressBlurHide：拖拽/dialog/外部应用打开期间临时禁用 blur 隐藏
let suppressBlurHide = false;
let suppressBlurHideTimers = new Set();

function setSuppressBlurHide(ms) {
  suppressBlurHide = true;
  const timer = setTimeout(() => {
    suppressBlurHide = false;
    suppressBlurHideTimers.delete(timer);
  }, ms);
  suppressBlurHideTimers.add(timer);
}

function shouldHideOnBlur() {
  if (suppressBlurHide) return false;
  if (Date.now() < startupGraceUntil) return false;
  return true;
}

// ===== 配置读写 =====
function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return core.mergeConfig(JSON.parse(raw));
  } catch {
    return core.mergeConfig({});
  }
}
function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('保存配置失败:', e);
  }
}
function loadHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_PATH, 'utf8');
    history = core.History.fromJSON(JSON.parse(raw));
  } catch {
    history = new core.History(50);
  }
}
function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.toJSON(), null, 2), 'utf8');
  } catch (e) {
    console.error('保存历史失败:', e);
  }
}

// ===== 读取当前 Explorer 选中的文件 =====
// 通过 PowerShell COM 调用 Shell.Application 读取当前打开的资源管理器窗口选中项
function getExplorerSelection() {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$shell = New-Object -ComObject Shell.Application
$paths = @()
foreach ($win in $shell.Windows()) {
  try {
    $sel = $win.Document.SelectedItems()
    foreach ($item in $sel) {
      $paths += $item.Path
    }
  } catch {}
}
Write-Output ($paths -join \"\`n\")
`;
  try {
    const result = execSync(`powershell -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf8',
      timeout: 2000,
      windowsHide: true,
    });
    return result.split('\n').map(s => s.trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

// ===== 创建主窗口 =====
function createWindow() {
  const cfg = loadConfig();

  // 修复 M8：窗口尺寸不超过屏幕 90%
  let winW = cfg.windowWidth;
  let winH = cfg.windowHeight;
  try {
    const area = screen.getPrimaryDisplay().workAreaSize;
    const maxW = Math.floor(area.width * 0.9);
    const maxH = Math.floor(area.height * 0.9);
    if (winW > maxW) winW = maxW;
    if (winH > maxH) winH = maxH;
  } catch {}

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 480,
    minHeight: 360,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 修复 S1：启动 grace 期，1.5 秒内忽略 blur 隐藏
  mainWindow.once('ready-to-show', () => {
    startupGraceUntil = Date.now() + 1500;
    showWindow();
  });

  // 修复 S1/S2/S3/S4：blur 隐藏前先检查 grace 期和 suppress 标志
  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.isVisible()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isFocused() && shouldHideOnBlur()) {
          hideWindow();
        }
      }, 200);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showWindow() {
  if (!mainWindow) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  // 修复 S5：被遮挡时强制置顶 200ms，再恢复，避免 Alt+Q 看似无效
  try {
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
    setTimeout(() => {
      if (mainWindow) mainWindow.setAlwaysOnTop(false);
    }, 200);
  } catch {
    mainWindow.focus();
  }
  // 唤起后立即尝试读取选中文件
  tryAutoPreviewSelection();
}

function hideWindow() {
  if (mainWindow && mainWindow.isVisible()) {
    mainWindow.hide();
  }
}

function tryAutoPreviewSelection() {
  const paths = getExplorerSelection();
  if (paths && paths.length > 0) {
    mainWindow.webContents.send('action:preview', paths[0]);
  } else {
    // 没有选中文件则显示欢迎页
    mainWindow.webContents.send('action:show-welcome');
  }
}

// ===== 生成默认托盘图标（16x16 蓝色圆点 PNG，修复 S6）=====
function createDefaultTrayIcon() {
  // 16x16 PNG，蓝色实心圆 + 白色描边
  // 预先用 Python PIL 生成好的 base64，避免重复构造
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAb0lEQVR4nM1SMRLAIAhr8u3Ovpueg3c0ItJeh2ZSICEKOAKYmUVxANAYq+RVDqskTiG32A1UQImTi3YX4BOyrxkcZm/eoXOpyhX4Wr7t/kMBkzln8LWM1rOKzuU4VF3oIn23yiuhyLa/T1PI/iTKXT08OhwHYyJrAAAAAElFTkSuQmCC';
  try {
    return nativeImage.createFromBuffer(Buffer.from(pngBase64, 'base64'));
  } catch {
    return nativeImage.createEmpty();
  }
}

// ===== 托盘 =====
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let icon = nativeImage.createEmpty();
  try {
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
    }
  } catch {}
  // 修复 S6：图标为空时使用默认蓝色圆点，避免任务栏空白图标
  if (icon.isEmpty()) {
    icon = createDefaultTrayIcon();
  }
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: '速览管家', enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => showWindow() },
    { label: '打开文件选择', click: () => {
        // 修复 S4：dialog 期间禁用 blur 隐藏 3 秒
        setSuppressBlurHide(3000);
        showWindow();
        dialog.showOpenDialog({
          properties: ['openFile'],
          title: '选择要预览的文件',
        }).then(r => {
          if (!r.canceled && r.filePaths.length > 0) {
            mainWindow.webContents.send('action:preview', r.filePaths[0]);
          }
        });
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip('速览管家 - 按 Alt+Q 唤起');
  tray.on('click', () => showWindow());
}

// ===== 单实例锁 =====
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });

  app.whenReady().then(() => {
    loadHistory();
    createWindow();
    createTray();

    // 注册全局快捷键
    const cfg = loadConfig();
    const ok = globalShortcut.register(cfg.hotkey, () => {
      if (mainWindow && mainWindow.isVisible()) {
        hideWindow();
      } else {
        showWindow();
      }
    });
    if (!ok) {
      // 修复 S7：快捷键注册失败时弹出提示，避免用户毫不知情
      console.error('快捷键注册失败:', cfg.hotkey);
      try {
        dialog.showMessageBoxSync({
          type: 'warning',
          title: '速览管家 - 快捷键注册失败',
          message: `全局快捷键 ${cfg.hotkey} 注册失败`,
          detail: '可能被其他应用占用。请关闭占用该快捷键的程序后重启速览管家，或修改配置中的 hotkey 字段。',
          buttons: ['知道了'],
        });
      } catch {}
      if (tray) tray.setToolTip('速览管家 - 快捷键注册失败，请检查');
    }

    // 隐藏 dock 图标（仿后台运行）
    // 这里保留任务栏图标，方便用户找到
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    saveHistory();
  });

  app.on('window-all-closed', () => {
    // 不退出，保持托盘运行
    if (process.platform !== 'darwin') {
      // Windows/Linux 隐藏到托盘
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

// ===== IPC 通道 =====
ipcMain.handle('preview:load', async (event, filePath) => {
  if (!filePath) return { error: '路径为空' };
  try {
    const meta = core.getMeta(filePath);
    if (!meta) return { error: '文件不存在或无法读取' };
    if (meta.isDirectory) return { error: '暂不支持预览目录' };

    const decision = core.decidePreview(filePath, meta.size);
    const result = { meta, decision };

    // 文本类直接返回内容
    if (['text', 'code', 'json', 'markdown'].includes(decision.kind)) {
      if (!decision.supported) {
        return { error: `文件过大（${meta.sizeText}），超过文本预览上限` };
      }
      const content = fs.readFileSync(filePath, 'utf8');
      result.content = content;
      result.language = decision.language || decision.kind;
    }

    // 历史记录
    if (history) {
      history.add(filePath);
      saveHistory();
    }
    return result;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('preview:read-binary-data-url', async (event, filePath) => {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = mimeFromExt(ext);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    return null;
  }
});

ipcMain.handle('history:list', async () => {
  return history.list();
});

ipcMain.handle('history:clear', async () => {
  history.clear();
  saveHistory();
  return true;
});

ipcMain.handle('shell:open', async (event, filePath) => {
  return shell.openPath(filePath);
});

ipcMain.handle('shell:show-in-folder', async (event, filePath) => {
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('clipboard:copy-text', async (event, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('dialog:pick-file', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: '选择要预览的文件',
  });
  if (r.canceled || r.filePaths.length === 0) return null;
  return r.filePaths[0];
});

ipcMain.handle('window:close', async () => {
  hideWindow();
  return true;
});

ipcMain.handle('window:minimize', async () => {
  if (mainWindow) mainWindow.minimize();
  return true;
});

ipcMain.handle('window:toggle-max', async () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});

// 修复 S2/S3：渲染进程通知拖拽/外部操作开始，期间禁用 blur 隐藏
ipcMain.handle('blur-control:suspend', async (event, ms) => {
  setSuppressBlurHide(ms || 1500);
  return true;
});

ipcMain.handle('config:get', async () => {
  return loadConfig();
});

ipcMain.handle('config:set', async (event, partial) => {
  const cfg = Object.assign({}, loadConfig(), partial);
  saveConfig(cfg);
  return cfg;
});

// ===== MIME 推断 =====
function mimeFromExt(ext) {
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon',
    avif: 'image/avif', tiff: 'image/tiff', tif: 'image/tiff',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
    avi: 'video/x-msvideo', m4v: 'video/x-m4v', ogv: 'video/ogg', wmv: 'video/x-ms-wmv', flv: 'video/x-flv',
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac',
    ogg: 'audio/ogg', m4a: 'audio/mp4', wma: 'audio/x-ms-wma', opus: 'audio/opus', aiff: 'audio/aiff',
    pdf: 'application/pdf',
    ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
  };
  return map[ext] || 'application/octet-stream';
}

module.exports = { mimeFromExt };
