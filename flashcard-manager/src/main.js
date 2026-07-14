'use strict';
// 闪卡记忆管家 - Electron 主进程
// 苹果白窗口 + 本地数据持久化 IPC

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const store = require('./core/store');
const srs = require('./core/srs');
const sm2 = require('./core/sm2');

// 截图模式禁用硬件加速，强制软件渲染，确保 capturePage 能捕获合成画面
if (process.env.FC_SHOT === '1') {
  app.disableHardwareAcceleration();
}

const DATA_FILE = path.join(app.getPath('userData'), 'flashcard-data.json');
store.setDataFile(DATA_FILE);

// 内存中持有一份状态，写操作后立即落盘
let state = store.load();

function persist() {
  store.save(state);
}

let mainWindow = null;

function createWindow() {
  // 截图模式：离屏渲染（offscreen），通过 paint 事件捕获画面，窗口完全不显示、不抢焦点
  const shotMode = process.env.FC_SHOT === '1';
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    title: '闪卡记忆管家',
    autoHideMenuBar: true,
    show: !shotMode,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      offscreen: shotMode
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (shotMode) {
    const fs2 = require('fs');
    const dir = 'D:\\Ai\\mimo\\screenshots';
    if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
    const outPath = dir + '\\flashcard-manager.png';
    let lastImage = null;
    let paintCount = 0;
    mainWindow.webContents.on('console-message', (e, level, message) => {
      console.log('[renderer] ' + message);
    });
    // 离屏渲染：每帧 paint 事件携带渲染好的 NativeImage
    mainWindow.webContents.on('paint', (event, dirty, image) => {
      lastImage = image;
      paintCount++;
    });
    mainWindow.webContents.on('did-finish-load', () => {
      // 等待足够多 paint 帧后保存最后一帧
      setTimeout(() => {
        try {
          if (lastImage) {
            fs2.writeFileSync(outPath, lastImage.toPNG());
            console.log('[SHOT] saved: ' + outPath + ' (' + lastImage.toPNG().length + ' bytes, frames=' + paintCount + ')');
          } else {
            console.log('[SHOT] no paint frames received');
          }
        } catch (err) {
          console.log('[SHOT] error: ' + (err && err.message || err));
        } finally {
          app.quit();
        }
      }, 4500);
    });
  }
}

app.whenReady().then(() => {
  // 首次启动且无数据：注入示例卡组，便于用户上手与截图展示
  if (Object.keys(state.decks).length === 0) {
    seedDemo();
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 示例卡组：英语高频词（演示用，真实数据由用户自建）
function seedDemo() {
  const d = store.createDeck(state, '英语高频词');
  const samples = [
    { front: 'serendipity', back: 'n. 意外发现美好事物的能力；机缘巧合', tags: ['CET6'] },
    { front: 'ephemeral', back: 'adj. 短暂的；瞬息的', tags: ['GRE'] },
    { front: 'ubiquitous', back: 'adj. 无处不在的；普遍存在的', tags: ['CET6'] },
    { front: 'resilient', back: 'adj. 有韧性的；能迅速恢复的', tags: ['CET6'] },
    { front: 'meticulous', back: 'adj. 一丝不苟的；极其注重细节的', tags: ['GRE'] },
    { front: 'profound', back: 'adj. 深刻的；意义深远的', tags: ['CET4'] },
    { front: 'endeavor', back: 'n./v. 努力；尽力', tags: ['CET4'] },
    { front: 'paradigm', back: 'n. 范例；范式；典范', tags: ['GRE'] }
  ];
  samples.forEach((s) => store.addCard(state, d.id, s));
  // 第二个示例卡组：编程概念
  const d2 = store.createDeck(state, '编程概念');
  const samples2 = [
    { front: '什么是闭包 (Closure)？', back: '函数与其引用的外层变量组合而成的实体，使内层函数能访问外层作用域的变量。', tags: ['JS'] },
    { front: '什么是 Promise？', back: '表示异步操作最终结果的对象，有 pending/fulfilled/rejected 三种状态。', tags: ['JS'] },
    { front: '什么是 HTTP 无状态？', back: '服务器不保留请求间的客户端状态，每次请求独立，需用 Cookie/Session 维持会话。', tags: ['网络'] }
  ];
  samples2.forEach((s) => store.addCard(state, d2.id, s));
  persist();
}

// ---------- IPC：卡组 ----------
ipcMain.handle('deck:list', async () => {
  return store.listDecks(state);
});

ipcMain.handle('deck:create', async (e, name) => {
  try {
    const d = store.createDeck(state, name);
    persist();
    return { ok: true, deck: { id: d.id, name: d.name, createdAt: d.createdAt, cardCount: 0 } };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('deck:rename', async (e, deckId, name) => {
  try {
    store.renameDeck(state, deckId, name);
    persist();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('deck:delete', async (e, deckId) => {
  store.deleteDeck(state, deckId);
  persist();
  return { ok: true };
});

// ---------- IPC：卡片 ----------
ipcMain.handle('card:list', async (e, deckId) => {
  try {
    return { ok: true, cards: store.listCards(state, deckId) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('card:add', async (e, deckId, fields) => {
  try {
    const c = store.addCard(state, deckId, fields);
    persist();
    return { ok: true, card: c };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('card:update', async (e, deckId, cardId, fields) => {
  try {
    const c = store.updateCard(state, deckId, cardId, fields);
    persist();
    return { ok: true, card: c };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('card:delete', async (e, deckId, cardId) => {
  store.deleteCard(state, deckId, cardId);
  persist();
  return { ok: true };
});

// ---------- IPC：复习 ----------
ipcMain.handle('review:queue', async (e, deckId, opts) => {
  try {
    const cards = store.listCards(state, deckId);
    const queue = srs.buildQueue(cards, opts);
    return { ok: true, queue };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('review:grade', async (e, deckId, cardId, q) => {
  try {
    const card = store.getCard(state, deckId, cardId);
    if (!card) return { ok: false, error: '卡片不存在' };
    const sched = sm2.schedule(card, q);
    store.setCardSchedule(state, deckId, cardId, sched);
    persist();
    return { ok: true, sched };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('review:stats', async (e, deckId) => {
  try {
    const cards = store.listCards(state, deckId);
    return { ok: true, stats: srs.stats(cards) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

// ---------- IPC：导入/导出 ----------
ipcMain.handle('data:export', async () => {
  return store.exportAll(state);
});

ipcMain.handle('data:exportFile', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出全部数据',
    defaultFileName: '闪卡记忆管家-备份.json',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    const fs = require('fs');
    fs.writeFileSync(result.filePath, JSON.stringify(store.exportAll(state), null, 2), 'utf8');
    return { ok: true, filePath: result.filePath };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('data:importFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入数据',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { ok: false };
  try {
    const fs = require('fs');
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const incoming = JSON.parse(raw);
    state = store.importAll(state, incoming);
    persist();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});
