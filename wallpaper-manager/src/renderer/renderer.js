// 渲染进程 - 壁纸管理器界面交互
// 苹果白高端风格 UI 逻辑

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let config = {};
let allWallpapers = [];
let currentView = 'all';
let searchQuery = '';

// === 工具函数 ===
function formatSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return bytes.toFixed(bytes < 10 ? 1 : 0) + ' ' + units[i];
}

function showToast(msg) {
  let toast = $('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function basename(p) {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

// 渲染壁纸卡片
function renderGrid(wallpapers) {
  const grid = $('#grid');
  const empty = $('#empty');
  const loading = $('#loading');
  loading.style.display = 'none';

  if (wallpapers.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = wallpapers.map(w => {
    const isFav = config.favorites.includes(w.path);
    const isCur = config.currentWallpaper === w.path;
    return `
      <div class="card ${isCur ? 'is-current' : ''}" data-path="${escapeAttr(w.path)}">
        <div class="card-img-wrap">
          <img class="card-img" src="file:///${encodeURI(w.path.replace(/\\/g, '/'))}" alt="${escapeAttr(w.name)}" loading="lazy" />
          <div class="card-overlay"></div>
          ${isCur ? '<div class="card-current-badge">当前壁纸</div>' : ''}
          <button class="card-fav ${isFav ? 'active' : ''}" data-fav="${escapeAttr(w.path)}" title="收藏">
            <svg viewBox="0 0 24 24">
              ${isFav
                ? '<path class="star-fill" d="M12 2l2.9 6.9L22 9.3l-5.5 4.7 1.7 7.1L12 17.3 5.8 21l1.7-7L2 9.3l7.1-.4z"/>'
                : '<path class="star-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 2l2.9 6.9L22 9.3l-5.5 4.7 1.7 7.1L12 17.3 5.8 21l1.7-7L2 9.3l7.1-.4z"/>'}
            </svg>
          </button>
          <div class="card-info">
            <div class="card-name">${escapeHtml(w.name)}</div>
            <div class="card-meta">${formatSize(w.size)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 卡片事件
  $$('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav')) return;
      const p = unescapeAttr(card.dataset.path);
      openPreview(p);
    });
  });

  $$('.card-fav').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const p = unescapeAttr(btn.dataset.fav);
      const isFav = await window.api.toggleFavorite(p);
      btn.classList.toggle('active', isFav);
      const svg = btn.querySelector('svg');
      svg.innerHTML = isFav
        ? '<path class="star-fill" d="M12 2l2.9 6.9L22 9.3l-5.5 4.7 1.7 7.1L12 17.3 5.8 21l1.7-7L2 9.3l7.1-.4z"/>'
        : '<path class="star-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 2l2.9 6.9L22 9.3l-5.5 4.7 1.7 7.1L12 17.3 5.8 21l1.7-7L2 9.3l7.1-.4z"/>';
      config = await window.api.getConfig();
      updateStatus();
      if (currentView === 'favorites') await refreshView();
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function escapeAttr(s) {
  return encodeURIComponent(s);
}
function unescapeAttr(s) {
  return decodeURIComponent(s);
}

// 过滤当前视图
function filterView() {
  let list = allWallpapers;
  if (currentView === 'favorites') {
    list = list.filter(w => config.favorites.includes(w.path));
  } else if (currentView === 'current') {
    list = list.filter(w => w.path === config.currentWallpaper);
    if (list.length === 0 && config.currentWallpaper) {
      list = [{ path: config.currentWallpaper, name: basename(config.currentWallpaper), size: 0, mtime: 0 }];
    }
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(w => w.name.toLowerCase().includes(q));
  }
  return list;
}

async function refreshView() {
  $('#loading').style.display = 'flex';
  $('#grid').innerHTML = '';
  allWallpapers = await window.api.listWallpapers();
  renderGrid(filterView());
  updateCount();
}

function updateCount() {
  const list = filterView();
  $('#count-badge').textContent = `${list.length} 张`;
}

function updateStatus() {
  if (config.currentWallpaper) {
    $('#status-current').textContent = basename(config.currentWallpaper);
  } else {
    $('#status-current').textContent = '未设置壁纸';
  }
  $('#status-sources').textContent = `${config.sources.length} 个来源`;
  $('#status-favorites').textContent = `${config.favorites.length} 个收藏`;
}

// 渲染来源列表
function renderSources() {
  const list = $('#sources-list');
  if (config.sources.length === 0) {
    list.innerHTML = '<div class="empty-hint">暂无来源，点击右上「添加文件夹」</div>';
    return;
  }
  const folderSvg = '<svg class="source-icon" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="1.6"/></svg>';
  list.innerHTML = config.sources.map(dir => `
    <div class="source-item">
      ${folderSvg}
      <span class="source-name" title="${escapeHtml(dir)}">${escapeHtml(basename(dir))}</span>
      <button class="source-remove" data-dir="${escapeAttr(dir)}" title="移除">×</button>
    </div>
  `).join('');

  $$('.source-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dir = unescapeAttr(btn.dataset.dir);
      await window.api.removeSource(dir);
      config = await window.api.getConfig();
      renderSources();
      updateStatus();
      await refreshView();
    });
  });
}

// === 预览 ===
let previewPath = '';
function openPreview(p) {
  previewPath = p;
  $('#preview-img').src = 'file:///' + encodeURI(p.replace(/\\/g, '/'));
  $('#preview-name').textContent = basename(p);
  $('#preview-overlay').style.display = 'flex';
  const isFav = config.favorites.includes(p);
  $('#preview-fav').textContent = isFav ? '取消收藏' : '收藏';
}
function closePreview() {
  $('#preview-overlay').style.display = 'none';
  previewPath = '';
}

// === 事件绑定 ===
async function init() {
  config = await window.api.getConfig();

  // 视图切换
  $$('.side-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.side-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      const titles = { all: '全部壁纸', favorites: '我的收藏', current: '当前壁纸' };
      $('#view-title').textContent = titles[currentView];
      renderGrid(filterView());
      updateCount();
    });
  });

  // 添加文件夹
  $('#btn-add-folder').addEventListener('click', async () => {
    const added = await window.api.addSource();
    if (added.length > 0) {
      showToast(`已添加 ${added.length} 个来源`);
      config = await window.api.getConfig();
      renderSources();
      updateStatus();
      await refreshView();
    }
  });
  $('#btn-empty-add').addEventListener('click', () => $('#btn-add-folder').click());

  // 必应今日
  $('#btn-bing').addEventListener('click', async () => {
    showToast('正在下载必应每日壁纸…');
    const f = await window.api.fetchBing();
    if (f) {
      const ok = await window.api.setWallpaper(f);
      if (ok) {
        showToast('已设为壁纸');
        config = await window.api.getConfig();
        await refreshView();
        updateStatus();
      }
    } else {
      showToast('下载失败，请检查网络');
    }
  });

  // 自动切换
  $('#toggle-auto').checked = config.autoChange;
  $('#toggle-auto').addEventListener('change', async (e) => {
    config.autoChange = e.target.checked;
    await window.api.setConfig({ autoChange: config.autoChange });
    $('#interval-row').style.display = config.autoChange ? 'flex' : 'none';
    showToast(config.autoChange ? '已启用定时切换' : '已关闭定时切换');
  });
  $('#interval-row').style.display = config.autoChange ? 'flex' : 'none';
  $('#interval-hours').value = String(config.intervalHours);
  $('#interval-hours').addEventListener('change', async (e) => {
    config.intervalHours = Number(e.target.value);
    await window.api.setConfig({ intervalHours: config.intervalHours });
    showToast('间隔已更新');
  });

  // 必应每日开关
  $('#toggle-bing').checked = config.bingDaily;
  $('#toggle-bing').addEventListener('change', async (e) => {
    config.bingDaily = e.target.checked;
    await window.api.setConfig({ bingDaily: config.bingDaily });
    showToast(config.bingDaily ? '已启用必应每日' : '已关闭必应每日');
  });

  // 搜索
  $('#search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderGrid(filterView());
    updateCount();
  });

  // 预览
  $('#preview-close').addEventListener('click', closePreview);
  $('#preview-backdrop').addEventListener('click', closePreview);
  $('#preview-set').addEventListener('click', async () => {
    if (!previewPath) return;
    try {
      await window.api.setWallpaper(previewPath);
      showToast('已设为壁纸');
      config = await window.api.getConfig();
      await refreshView();
      updateStatus();
    } catch (e) {
      showToast('设置失败: ' + e.message);
    }
  });
  $('#preview-fav').addEventListener('click', async () => {
    if (!previewPath) return;
    const isFav = await window.api.toggleFavorite(previewPath);
    $('#preview-fav').textContent = isFav ? '取消收藏' : '收藏';
    config = await window.api.getConfig();
    updateStatus();
    showToast(isFav ? '已收藏' : '已取消收藏');
  });
  $('#preview-folder').addEventListener('click', () => {
    if (previewPath) window.api.openInFolder(previewPath);
  });

  // 退出
  $('#btn-quit').addEventListener('click', () => window.api.quitApp());

  // 监听必应壁纸更新
  window.api.onBingUpdated(() => refreshView());

  // ESC 关闭预览
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#preview-overlay').style.display !== 'none') {
      closePreview();
    }
  });

  renderSources();
  updateStatus();
  await refreshView();
}

document.addEventListener('DOMContentLoaded', init);
