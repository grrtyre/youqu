// 抽签转盘管家 - 主进程
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./core/store.js');

let mainWindow = null;
let state = null;
const dataFile = path.join(app.getPath('userData'), 'wheel-state.json');

// 加载本地数据
function loadState() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      const parsed = JSON.parse(raw);
      // 合并默认设置，兼容旧数据
      const empty = store.createEmptyState();
      state = Object.assign(empty, parsed);
      state.settings = Object.assign(empty.settings, parsed.settings || {});
      if (!Array.isArray(state.history)) state.history = [];
      if (!Array.isArray(state.lists)) state.lists = [];
    } else {
      state = store.createEmptyState();
    }
  } catch (e) {
    console.error('加载数据失败，使用空状态:', e.message);
    state = store.createEmptyState();
  }
  // 首次启动预置示例名单
  if (state.lists.length === 0) {
    const demo = store.createList(state, '今天吃什么');
    store.addEntriesBulk(state, demo.id, '火锅\n麻辣烫\n拉面\n炒饭\n饺子\n寿司\n沙拉\n汉堡');
    const demo2 = store.createList(state, '团建抽奖');
    store.addEntriesBulk(state, demo2.id, '张三\n李四\n王五\n赵六\n钱七\n孙八\n周九\n吴十');
    // 默认激活第一个
    state.activeListId = state.lists[0].id;
  }
  return state;
}

// 保存本地数据
function saveState() {
  try {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存数据失败:', e.message);
  }
}

function createWindow() {
  const shotMode = process.env.WHEEL_MANAGER_SHOT === '1';
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '抽签转盘管家',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    show: !shotMode,            // 截图模式不显示窗口，绝不打扰用户
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 截图模式：后台 capturePage，无需窗口前台
  if (shotMode) {
    mainWindow.webContents.on('console-message', (e, level, message) => {
      console.log('[renderer] ' + message);
    });
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await mainWindow.webContents.capturePage();
          const dir = 'D:\\Ai\\mimo\\screenshots';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const outPath = path.join(dir, 'wheel-manager.png');
          fs.writeFileSync(outPath, image.toPNG());
          console.log('[SHOT] saved: ' + outPath + ' (' + image.toPNG().length + ' bytes)');
        } catch (err) {
          console.log('[SHOT] error: ' + (err && err.message || err));
        } finally {
          app.quit();
        }
      }, 4000);
    });
    mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
      console.log('[SHOT] load failed: ' + code + ' ' + desc);
    });
  }

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// IPC 通道：读取全部状态
ipcMain.handle('state:get', () => {
  return JSON.parse(JSON.stringify(state));
});

// 创建名单
ipcMain.handle('list:create', (e, name) => {
  const list = store.createList(state, name);
  state.activeListId = list.id;
  saveState();
  return JSON.parse(JSON.stringify(list));
});

// 切换名单
ipcMain.handle('list:setActive', (e, listId) => {
  const ok = store.setActiveList(state, listId);
  if (ok) saveState();
  return ok;
});

// 重命名
ipcMain.handle('list:rename', (e, listId, newName) => {
  const ok = store.renameList(state, listId, newName);
  if (ok) saveState();
  return ok;
});

// 删除名单
ipcMain.handle('list:delete', (e, listId) => {
  const ok = store.deleteList(state, listId);
  if (ok) saveState();
  return ok;
});

// 添加条目
ipcMain.handle('entry:add', (e, listId, text, weight) => {
  const entry = store.addEntry(state, listId, text, weight);
  if (entry) saveState();
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
});

// 批量添加
ipcMain.handle('entry:addBulk', (e, listId, text) => {
  const added = store.addEntriesBulk(state, listId, text);
  saveState();
  return added.map(x => JSON.parse(JSON.stringify(x)));
});

// 更新条目
ipcMain.handle('entry:update', (e, listId, entryId, patch) => {
  const ok = store.updateEntry(state, listId, entryId, patch);
  if (ok) saveState();
  return ok;
});

// 删除条目
ipcMain.handle('entry:delete', (e, listId, entryId) => {
  const ok = store.deleteEntry(state, listId, entryId);
  if (ok) saveState();
  return ok;
});

// 清空条目
ipcMain.handle('entry:clear', (e, listId) => {
  const ok = store.clearEntries(state, listId);
  if (ok) saveState();
  return ok;
});

// 抽签（主进程执行加权随机，避免渲染层篡改）
// 返回 { entry, index, segments } 供渲染层做指针动画对齐
ipcMain.handle('wheel:draw', (e, listId) => {
  const result = store.pickWeighted(state, listId);
  if (!result) return null;
  const segments = store.computeSegments(state, listId);
  return {
    entry: JSON.parse(JSON.stringify(result.entry)),
    index: result.index,
    segments: segments.map(s => ({
      text: s.entry.text,
      weight: s.entry.weight,
      start: s.start,
      end: s.end,
      mid: s.mid
    }))
  };
});

// 记录抽签历史
ipcMain.handle('history:record', (e, listId, winnerText, mode) => {
  const rec = store.recordHistory(state, listId, winnerText, mode);
  saveState();
  return JSON.parse(JSON.stringify(rec));
});

// 清空历史
ipcMain.handle('history:clear', () => {
  store.clearHistory(state);
  saveState();
  return true;
});

// 删除单条历史
ipcMain.handle('history:delete', (e, recordId) => {
  const ok = store.deleteHistory(state, recordId);
  if (ok) saveState();
  return ok;
});

// 更新设置
ipcMain.handle('settings:update', (e, patch) => {
  const ok = store.updateSettings(state, patch);
  if (ok) saveState();
  return ok;
});

// 抽中后剔除（不重复抽奖模式）
ipcMain.handle('entry:removeWinner', (e, listId, entryId) => {
  const ok = store.deleteEntry(state, listId, entryId);
  if (ok) saveState();
  return ok;
});

app.whenReady().then(() => {
  loadState();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
