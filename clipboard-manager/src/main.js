const { app, BrowserWindow, Tray, Menu, clipboard, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const POLL_INTERVAL = 500;
const MAX_ITEMS = 500;

let mainWindow = null;
let tray = null;
let clipboardHistory = [];
let lastContent = '';
let pollTimer = null;

const userDataPath = app.getPath('userData');
const historyFile = path.join(userDataPath, 'clipboard-history.json');

// --- Data persistence ---

function loadHistory() {
  try {
    if (fs.existsSync(historyFile)) {
      const raw = fs.readFileSync(historyFile, 'utf-8');
      const data = JSON.parse(raw);
      clipboardHistory = Array.isArray(data.items) ? data.items : [];
    } else {
      clipboardHistory = [];
    }
  } catch (e) {
    console.error('Failed to load clipboard history:', e.message);
    clipboardHistory = [];
  }
}

function saveHistory() {
  try {
    const dir = path.dirname(historyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(historyFile, JSON.stringify({ items: clipboardHistory }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save clipboard history:', e.message);
  }
}

// --- Classification ---

function classifyContent(text) {
  if (typeof text !== 'string' || text.length === 0) return 'text';
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'link';
  if (/^\S+@\S+\.\S+$/.test(trimmed)) return 'email';
  if (/^1[3-9]\d{9}$/.test(trimmed)) return 'phone';
  if (/(?:function|const|let|var|import|export|=>|class |return |if\s*\(|for\s*\(|while\s*\(|switch\s*\(|\.map\(|\.filter\(|\.forEach\(|async |await )/.test(trimmed)) return 'code';
  if (trimmed.includes('\n') && trimmed.split('\n').length >= 2) {
    const lines = trimmed.split('\n');
    const indentedLines = lines.filter(l => /^\s{2,}/.test(l));
    if (indentedLines.length >= Math.floor(lines.length / 2)) return 'code';
  }
  return 'text';
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Clipboard polling ---

function startClipboardPolling() {
  lastContent = clipboard.readText() || '';
  pollTimer = setInterval(() => {
    try {
      const current = clipboard.readText() || '';
      if (current && current !== lastContent) {
        lastContent = current;
        // Dedup: skip if same content as most recent item
        if (clipboardHistory.length > 0 && clipboardHistory[0].content === current) {
          return;
        }
        const item = {
          id: genId(),
          content: current,
          type: classifyContent(current),
          timestamp: Date.now(),
          pinned: false,
          favorite: false
        };
        clipboardHistory.unshift(item);
        if (clipboardHistory.length > MAX_ITEMS) {
          clipboardHistory = clipboardHistory.slice(0, MAX_ITEMS);
        }
        saveHistory();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('history-updated');
        }
      }
    } catch (e) {
      console.error('Clipboard poll error:', e.message);
    }
  }, POLL_INTERVAL);
}

function stopClipboardPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// --- Window ---

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    frame: false,
    transparent: false,
    show: false,
    skipTaskbar: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    // minimize-to-tray: hide instead of close
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    // Position near the tray (bottom-right, above taskbar)
    const { screen } = require('electron');
    const display = screen.getPrimaryDisplay();
    const wa = display.workArea; // {x, y, width, height}
    const winWidth = 480;
    const winHeight = 600;
    mainWindow.setBounds({
      x: wa.x + wa.width - winWidth - 16,
      y: wa.y + wa.height - winHeight - 16,
      width: winWidth,
      height: winHeight
    });
    mainWindow.show();
    mainWindow.focus();
  }
}

// --- IPC handlers ---

function setupIPC() {
  ipcMain.handle('get-items', () => {
    return clipboardHistory;
  });

  ipcMain.handle('search-items', (event, query) => {
    if (!query || typeof query !== 'string') return clipboardHistory;
    const q = query.toLowerCase();
    return clipboardHistory.filter(item =>
      item.content.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q)
    );
  });

  ipcMain.handle('copy-item', (event, id) => {
    const item = clipboardHistory.find(i => i.id === id);
    if (item) {
      // Write to clipboard; this will trigger poll but dedup skips it
      clipboard.writeText(item.content);
      lastContent = item.content;
      return true;
    }
    return false;
  });

  ipcMain.handle('toggle-favorite', (event, id) => {
    const item = clipboardHistory.find(i => i.id === id);
    if (item) {
      item.favorite = !item.favorite;
      saveHistory();
      return item;
    }
    return null;
  });

  ipcMain.handle('toggle-pin', (event, id) => {
    const item = clipboardHistory.find(i => i.id === id);
    if (item) {
      item.pinned = !item.pinned;
      saveHistory();
      return item;
    }
    return null;
  });

  ipcMain.handle('delete-item', (event, id) => {
    const idx = clipboardHistory.findIndex(i => i.id === id);
    if (idx !== -1) {
      clipboardHistory.splice(idx, 1);
      saveHistory();
      return true;
    }
    return false;
  });

  ipcMain.handle('clear-all', () => {
    clipboardHistory = clipboardHistory.filter(i => i.pinned);
    saveHistory();
    return true;
  });

  // 一键粘贴到前台窗口：隐藏自己 → 等待 → 发送 Ctrl+V
  ipcMain.handle('paste-to-front', () => {
    return new Promise((resolve) => {
      if (mainWindow && mainWindow.isVisible()) {
        mainWindow.hide();
      }
      // 等待 80ms 让焦点回到目标窗口，再发送 Ctrl+V
      setTimeout(() => {
        const ps = [
          '$wshell = New-Object -ComObject WScript.Shell;',
          'Start-Sleep -Milliseconds 100;',
          '$wshell.SendKeys("^v")'
        ].join(' ');
        execFile('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true }, (err) => {
          if (err) console.error('paste-to-front error:', err.message);
          resolve(!err);
        });
      }, 80);
    });
  });
}

// --- Tray ---

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Clipboard Manager');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => toggleWindow() },
    { type: 'separator' },
    {
      label: 'Exit', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleWindow());
}

// --- App lifecycle ---

app.whenReady().then(() => {
  loadHistory();
  createWindow();
  createTray();
  setupIPC();
  startClipboardPolling();

  // 开发模式或 --show 参数：启动时直接显示窗口
  if (process.argv.includes('--dev') || process.argv.includes('--show')) {
    if (mainWindow) {
      const { screen } = require('electron');
      const display = screen.getPrimaryDisplay();
      const wa = display.workArea;
      mainWindow.setBounds({
        x: wa.x + wa.width - 480 - 16,
        y: wa.y + wa.height - 600 - 16,
        width: 480,
        height: 600
      });
      mainWindow.show();
      mainWindow.focus();
    }
  }

  // Global shortcut
  const { globalShortcut } = require('electron');
  globalShortcut.register('Ctrl+Shift+V', () => {
    toggleWindow();
  });
});

app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
  stopClipboardPolling();
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      toggleWindow();
    }
  });
}

app.on('window-all-closed', (e) => {
  // On Windows/Linux don't quit when all windows closed (tray app)
  e.preventDefault?.();
});
