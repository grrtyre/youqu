// 速览管家 - Electron 主进程
// 职责：窗口管理、全局快捷键、读取 Explorer 选中文件、IPC、托盘、单实例

'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, shell, nativeImage, Tray, Menu, dialog, clipboard } = require('electron');
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
  mainWindow = new BrowserWindow({
    width: cfg.windowWidth,
    height: cfg.windowHeight,
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

  mainWindow.once('ready-to-show', () => {
    // 首次启动显示主窗口（欢迎页），后续按 Alt+Q 唤起
    showWindow();
  });

  // 失焦隐藏（仿 Mac QuickLook 行为）
  mainWindow.on('blur', () => {
    // 仅在已显示时隐藏，避免重复触发
    if (mainWindow && mainWindow.isVisible()) {
      // 通过延迟避免误触
      setTimeout(() => {
        if (mainWindow && !mainWindow.isFocused()) {
          hideWindow();
        }
      }, 120);
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
  mainWindow.focus();
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

// ===== 托盘 =====
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let icon = nativeImage.createEmpty();
  try {
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
    }
  } catch {}
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  const menu = Menu.buildFromTemplate([
    { label: '速览管家', enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => showWindow() },
    { label: '打开文件选择', click: () => {
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
      console.error('快捷键注册失败:', cfg.hotkey);
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
