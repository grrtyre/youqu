// src/main.js — 剧集管家主进程
const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const core = require('./core/store');

const store = new Store({ name: 'watching-manager-data' });
let main = null;

function createWindow() {
  main = new BrowserWindow({
    width: 1320, height: 880, minWidth: 1000, minHeight: 640,
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'hiddenInset',
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  main.once('ready-to-show', () => main.show());
  main.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  main.on('closed', () => { main = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!main) createWindow(); });

// ============ Demo 模式（仅用于截图展示，不写入 store） ============
// 海报在 build/demo-posters/<id>.png，启动时读取并转为 dataURL
function loadPoster(id) {
  // 兼容开发环境与打包后：开发环境从 build/ 读，打包后从 resources/ 读
  const candidates = [
    path.join(__dirname, '..', 'build', 'demo-posters', `${id}.png`),
    path.join(process.resourcesPath || '', 'build', 'demo-posters', `${id}.png`)
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch (_) { /* ignore */ }
  }
  return '';
}

const DEMO_SHOWS_BASE = [
  { id: 'demo1', title: '漫长的季节', type: 'tv', status: 'completed', season: 1, episode: 12, totalSeasons: 1, totalEpisodes: 12, rating: 9.5, tags: ['悬疑', '年代', '国产'], note: '范伟的演技绝了', addedAt: '2026-03-15T08:00:00.000Z', updatedAt: '2026-05-20T10:00:00.000Z', lastWatchedAt: '2026-05-20T10:00:00.000Z', finishedAt: '2026-05-20T10:00:00.000Z' },
  { id: 'demo2', title: '繁花', type: 'tv', status: 'watching', season: 1, episode: 18, totalSeasons: 1, totalEpisodes: 30, rating: 8.8, tags: ['年代', '王家卫', '上海'], note: '光影绝美', addedAt: '2026-04-01T08:00:00.000Z', updatedAt: '2026-07-10T22:30:00.000Z', lastWatchedAt: '2026-07-10T22:30:00.000Z', finishedAt: null },
  { id: 'demo3', title: '葬送的芙莉莲', type: 'anime', status: 'watching', season: 1, episode: 24, totalSeasons: 1, totalEpisodes: 28, rating: 9.2, tags: ['治愈', '奇幻', '日番'], note: '温柔又深刻', addedAt: '2026-04-20T08:00:00.000Z', updatedAt: '2026-07-12T20:00:00.000Z', lastWatchedAt: '2026-07-12T20:00:00.000Z', finishedAt: null },
  { id: 'demo4', title: '进击的巨人 最终季', type: 'anime', status: 'completed', season: 4, episode: 16, totalSeasons: 4, totalEpisodes: 16, rating: 9.7, tags: ['热血', '末日', '日番'], note: '神作收尾', addedAt: '2026-02-10T08:00:00.000Z', updatedAt: '2026-04-05T18:00:00.000Z', lastWatchedAt: '2026-04-05T18:00:00.000Z', finishedAt: '2026-04-05T18:00:00.000Z' },
  { id: 'demo5', title: '流浪地球 2', type: 'movie', status: 'completed', season: 1, episode: 1, totalSeasons: 1, totalEpisodes: 1, rating: 8.5, tags: ['科幻', '国产', '硬核'], note: '中国科幻新高度', addedAt: '2026-03-22T08:00:00.000Z', updatedAt: '2026-03-23T20:00:00.000Z', lastWatchedAt: '2026-03-23T20:00:00.000Z', finishedAt: '2026-03-23T20:00:00.000Z' },
  { id: 'demo6', title: '苍兰诀', type: 'tv', status: 'dropped', season: 1, episode: 6, totalSeasons: 1, totalEpisodes: 36, rating: 6.0, tags: ['仙侠', '言情'], note: '剧情有点水', addedAt: '2026-05-01T08:00:00.000Z', updatedAt: '2026-05-10T15:00:00.000Z', lastWatchedAt: '2026-05-10T15:00:00.000Z', finishedAt: null },
  { id: 'demo7', title: '歌手 2026', type: 'variety', status: 'watching', season: 1, episode: 8, totalSeasons: 1, totalEpisodes: 12, rating: 7.5, tags: ['音乐', '综艺'], note: '直播紧张感拉满', addedAt: '2026-06-01T08:00:00.000Z', updatedAt: '2026-07-11T22:00:00.000Z', lastWatchedAt: '2026-07-11T22:00:00.000Z', finishedAt: null },
  { id: 'demo8', title: '蓝色星球 II', type: 'doc', status: 'planning', season: 1, episode: 0, totalSeasons: 1, totalEpisodes: 7, rating: 0, tags: ['自然', 'BBC'], note: '听说画面超震撼，待看', addedAt: '2026-07-12T08:00:00.000Z', updatedAt: '2026-07-12T08:00:00.000Z', lastWatchedAt: null, finishedAt: null },
  { id: 'demo9', title: '狂飙', type: 'tv', status: 'completed', season: 1, episode: 39, totalSeasons: 1, totalEpisodes: 39, rating: 8.7, tags: ['扫黑', '国产', '悬疑'], note: '高启强真立体', addedAt: '2026-02-20T08:00:00.000Z', updatedAt: '2026-04-15T22:00:00.000Z', lastWatchedAt: '2026-04-15T22:00:00.000Z', finishedAt: '2026-04-15T22:00:00.000Z' },
  { id: 'demo10', title: '奥本海默', type: 'movie', status: 'planning', season: 1, episode: 0, totalSeasons: 1, totalEpisodes: 1, rating: 0, tags: ['传记', '诺兰'], note: '三小时太长，先mark', addedAt: '2026-07-05T08:00:00.000Z', updatedAt: '2026-07-05T08:00:00.000Z', lastWatchedAt: null, finishedAt: null }
];

// 启动时填充 poster dataURL
const DEMO_SHOWS = DEMO_SHOWS_BASE.map(s => ({ ...s, poster: loadPoster(s.id) }));

ipcMain.handle('is-demo', () => process.env.WM_DEMO === '1');
ipcMain.handle('demo-shows', () => DEMO_SHOWS);

// ============ 剧集 CRUD ============
ipcMain.handle('shows-get', () => store.get('shows', []));

ipcMain.handle('shows-add', (_e, input) => {
  try {
    const show = core.createShow(input);
    const list = store.get('shows', []);
    list.push(show);
    store.set('shows', list);
    return { ok: true, show };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('shows-update', (_e, { id, patch }) => {
  try {
    const list = store.get('shows', []);
    const idx = list.findIndex(s => s.id === id);
    if (idx < 0) return { ok: false, error: '剧集不存在' };
    const updated = core.updateShow(list[idx], patch || {});
    list[idx] = updated;
    store.set('shows', list);
    return { ok: true, show: updated };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('shows-advance', (_e, { id, step }) => {
  try {
    const list = store.get('shows', []);
    const idx = list.findIndex(s => s.id === id);
    if (idx < 0) return { ok: false, error: '剧集不存在' };
    const updated = core.advanceEpisode(list[idx], step === undefined ? 1 : step);
    list[idx] = updated;
    store.set('shows', list);
    return { ok: true, show: updated };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('shows-reset', (_e, { id }) => {
  try {
    const list = store.get('shows', []);
    const idx = list.findIndex(s => s.id === id);
    if (idx < 0) return { ok: false, error: '剧集不存在' };
    const updated = core.resetProgress(list[idx]);
    list[idx] = updated;
    store.set('shows', list);
    return { ok: true, show: updated };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('shows-remove', (_e, { id }) => {
  const list = store.get('shows', []).filter(s => s.id !== id);
  store.set('shows', list);
  return { ok: true };
});

ipcMain.handle('shows-clear', () => { store.set('shows', []); return { ok: true }; });

// ============ 统计/筛选/排序（共享纯函数） ============
function activeShows() {
  return process.env.WM_DEMO === '1' ? DEMO_SHOWS : store.get('shows', []);
}

ipcMain.handle('shows-stats', () => core.stats(activeShows()));

ipcMain.handle('shows-query', (_e, opts) => {
  let list = activeShows();
  if (opts) {
    if (opts.keyword || opts.status || opts.type || opts.tag) {
      list = core.filterShows(list, opts);
    }
    if (opts.sortBy) {
      list = core.sortShows(list, opts.sortBy, opts.asc === true);
    }
  }
  return list;
});

// ============ 导入/导出 ============
ipcMain.handle('shows-export', async () => {
  const r = await dialog.showSaveDialog(main, {
    title: '导出剧集数据',
    defaultPath: `watching-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return { ok: false };
  const data = core.exportData(store.get('shows', []));
  fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, path: r.filePath };
});

ipcMain.handle('shows-import', async (_e, filePath) => {
  try {
    const p = filePath || (async () => {
      const r = await dialog.showOpenDialog(main, {
        title: '导入剧集数据',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
      });
      return r.canceled ? null : r.filePaths[0];
    })();
    const file = await Promise.resolve(p);
    if (!file) return { ok: false, error: '未选择文件' };
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    const merged = core.importData(store.get('shows', []), data);
    store.set('shows', merged);
    return { ok: true, count: merged.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ============ 提醒：检查今日待更新 ============
ipcMain.handle('reminders-check', () => {
  // 简易提醒：列出 status=watching 且 lastWatchedAt 距今超过 3 天 的剧集
  const list = activeShows();
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return list
    .filter(s => s.status === 'watching')
    .filter(s => !s.lastWatchedAt || (now - new Date(s.lastWatchedAt).getTime()) > threeDaysMs)
    .map(s => ({ id: s.id, title: s.title, season: s.season, episode: s.episode, lastWatchedAt: s.lastWatchedAt }));
});

ipcMain.handle('notify', (_e, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title: title || '剧集管家', body: body || '', silent: false }).show();
    return { ok: true };
  }
  return { ok: false, error: '当前系统不支持通知' };
});

// ============ 选择海报图片 ============
ipcMain.handle('pick-poster', async () => {
  const r = await dialog.showOpenDialog(main, {
    title: '选择海报图片',
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
    properties: ['openFile']
  });
  if (r.canceled || !r.filePaths.length) return { ok: false };
  const p = r.filePaths[0];
  try {
    const buf = fs.readFileSync(p);
    const ext = path.extname(p).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'webp' ? 'image/webp'
      : ext === 'bmp' ? 'image/bmp'
      : 'image/png';
    return { ok: true, dataURL: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ============ 窗口控制 ============
ipcMain.handle('window-min', () => { if (main) main.minimize(); return true; });
ipcMain.handle('window-max', () => {
  if (!main) return true;
  if (main.isMaximized()) main.unmaximize(); else main.maximize();
  return true;
});
ipcMain.handle('window-close', () => { if (main) main.close(); return true; });

ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
  return true;
});
