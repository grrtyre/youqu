// launcher-manager 渲染逻辑

const searchInput = document.getElementById('search-input');
const resultsEl = document.getElementById('results');
const emptyState = document.getElementById('empty-state');
const appCountEl = document.getElementById('app-count');
const statusBarLeft = document.querySelector('.status-left');

let currentResults = [];
let selectedIndex = 0;
let searchTimer = null;
let isIndexing = false;
let totalAppCount = 0;
let currentQuery = '';

// 应用头像配色板（饱和中调渐变，避免浅色发白）
const AVATAR_COLORS = [
  ['#0a84ff', '#0064d6'],
  ['#30d158', '#28a745'],
  ['#ff9f0a', '#f07700'],
  ['#bf5af2', '#9b30d4'],
  ['#ff375f', '#d6244a'],
  ['#5e5ce6', '#4338ca'],
  ['#1ec8d6', '#0e9aa8'],
  ['#e84c8a', '#c41e6a']
];

function firstChar(name) {
  const t = (name || '').trim();
  return t ? t[0].toUpperCase() : '?';
}

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function avatarHtml(name) {
  const [c1, c2] = avatarColor(name);
  const ch = escapeHtml(firstChar(name));
  return '<div class="avatar" style="background:linear-gradient(135deg,' + c1 + ',' + c2 + ')">' + ch + '</div>';
}

// 截图模式：通过 query 参数可靠传递
const SHOT_MODE = new URLSearchParams(location.search).get('shot') === '1';
const TEST_QUERY = new URLSearchParams(location.search).get('q') || '';

async function init() {
  // 初始状态：先拉取索引状态，让状态栏立刻显示"正在索引..."或数量
  try {
    const state = await window.launcher.getIndexingState();
    isIndexing = state.indexing;
    totalAppCount = state.count;
    updateStatusLeft();
  } catch (e) {
    // 忽略
  }

  if (SHOT_MODE) {
    searchInput.value = TEST_QUERY;
    currentQuery = TEST_QUERY;
    await doSearch(TEST_QUERY);
    searchInput.focus();
  } else {
    await doSearch('');
  }
}

// 索引状态变化时更新状态栏
window.launcher.onIndexingState((state) => {
  isIndexing = state.indexing;
  totalAppCount = state.count;
  updateStatusLeft();
});

window.launcher.onWindowShown(() => {
  searchInput.value = '';
  currentQuery = '';
  searchInput.focus();
  doSearch('');
  const updateCount = async () => {
    try {
      const state = await window.launcher.getIndexingState();
      isIndexing = state.indexing;
      totalAppCount = state.count;
      updateStatusLeft();
    } catch (e) {}
  };
  updateCount();
});

// 防抖 40ms（原 80ms 偏长，Spotlight/Alfred 通常 30-50ms）
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentQuery = searchInput.value;
    doSearch(searchInput.value);
  }, 40);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (currentResults.length === 0) return;
    selectedIndex = (selectedIndex + 1) % currentResults.length;
    updateSelectionOnly();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentResults.length === 0) return;
    selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
    updateSelectionOnly();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (currentResults[selectedIndex]) {
      launchApp(currentResults[selectedIndex]);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    window.launcher.hide();
  }
});

async function doSearch(query) {
  currentResults = await window.launcher.search(query || '');
  selectedIndex = 0;
  renderResults();
}

function renderResults() {
  resultsEl.innerHTML = '';

  if (currentResults.length === 0) {
    resultsEl.hidden = true;
    emptyState.hidden = false;
    // 区分场景：无查询时引导输入，有查询无结果显示"未找到"
    const titleEl = emptyState.querySelector('.empty-title');
    const subEl = emptyState.querySelector('.empty-sub');
    if (!currentQuery || !currentQuery.trim()) {
      if (titleEl) titleEl.textContent = '开始输入以搜索应用';
      if (subEl) subEl.textContent = '或直接查看下方的最近使用';
    } else {
      if (titleEl) titleEl.textContent = '未找到匹配的应用';
      if (subEl) subEl.textContent = '试试输入应用名称的关键字';
    }
    return;
  }

  resultsEl.hidden = false;
  emptyState.hidden = true;

  currentResults.forEach((app, index) => {
    const item = document.createElement('div');
    item.className = 'result-item' + (index === selectedIndex ? ' selected' : '');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', index === selectedIndex);
    // 路径 tooltip：鼠标悬停显示完整路径
    item.title = app.path;

    const iconWrap = document.createElement('div');
    iconWrap.className = 'item-icon';
    if (app.icon) {
      const img = document.createElement('img');
      img.src = app.icon;
      img.alt = '';
      img.onerror = () => {
        iconWrap.innerHTML = avatarHtml(app.name);
      };
      iconWrap.appendChild(img);
    } else {
      iconWrap.innerHTML = avatarHtml(app.name);
    }

    const textWrap = document.createElement('div');
    textWrap.className = 'item-text';

    const nameEl = document.createElement('div');
    nameEl.className = 'item-name';
    nameEl.innerHTML = highlight(app.name, searchInput.value);

    const pathEl = document.createElement('div');
    pathEl.className = 'item-path';
    pathEl.textContent = shortenPath(app.path);
    pathEl.title = app.path;

    textWrap.appendChild(nameEl);
    textWrap.appendChild(pathEl);

    item.appendChild(iconWrap);
    item.appendChild(textWrap);

    // V7: hover 仅切换 selected 类，不触发全量 re-render（避免 8 项时闪烁）
    item.addEventListener('mouseenter', () => {
      if (selectedIndex === index) return;
      const prev = resultsEl.querySelector('.result-item.selected');
      if (prev) prev.classList.remove('selected');
      item.classList.add('selected');
      selectedIndex = index;
    });
    item.addEventListener('click', () => {
      selectedIndex = index;
      launchApp(currentResults[index]);
    });

    resultsEl.appendChild(item);
  });

  const selected = resultsEl.querySelector('.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}

// V7: 键盘导航只切换 selected 类，不重建 DOM
function updateSelectionOnly() {
  const items = resultsEl.querySelectorAll('.result-item');
  items.forEach((el, i) => {
    if (i === selectedIndex) {
      el.classList.add('selected');
      el.setAttribute('aria-selected', 'true');
    } else {
      el.classList.remove('selected');
      el.setAttribute('aria-selected', 'false');
    }
  });
  const selected = resultsEl.querySelector('.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}

function highlight(text, query) {
  if (!query || !query.trim()) return escapeHtml(text);
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx >= 0) {
    return (
      escapeHtml(text.slice(0, idx)) +
      '<mark>' + escapeHtml(text.slice(idx, idx + q.length)) + '</mark>' +
      escapeHtml(text.slice(idx + q.length))
    );
  }
  let result = '';
  let qi = 0;
  for (let i = 0; i < text.length; i++) {
    if (qi < q.length && lower[i] === q[qi]) {
      result += '<mark>' + escapeHtml(text[i]) + '</mark>';
      qi++;
    } else {
      result += escapeHtml(text[i]);
    }
  }
  return result;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// F2: 扩展 shortenPath，覆盖更多 Windows 常见路径前缀
function shortenPath(p) {
  return p
    .replace(/^[A-Z]:\\Users\\[^\\]+\\/, '~/')
    .replace(/^[A-Z]:\\ProgramData\\/, '/ProgramData/')
    .replace(/^[A-Z]:\\Program Files( \(x86\))?\\/, '/Program Files/')
    .replace(/^[A-Z]:\\Users\\Public\\/, '/Public/')
    .replace(/^[A-Z]:\\Windows\\/, '/Windows/')
    .replace(/^[A-Z]:\\.*?\\([^\\]+\\[^\\]+)$/, '.../$1');
}

async function launchApp(app) {
  const res = await window.launcher.launch(app.path);
  if (res.success) {
    searchInput.value = '';
    currentQuery = '';
    setTimeout(() => doSearch(''), 150);
  } else {
    // F1: 启动失败时显示错误提示（不隐藏窗口）
    showErrorToast(res.error || '启动失败');
  }
}

// F1: 错误提示 toast（轻量、自动消失）
let errorTimer = null;
function showErrorToast(msg) {
  let toast = document.getElementById('error-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'error-toast';
    toast.className = 'error-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = '⚠ ' + (msg || '启动失败');
  toast.classList.add('show');
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

// D2: 状态栏左侧文案随索引状态变化
function updateStatusLeft() {
  if (!statusBarLeft) return;
  if (isIndexing) {
    statusBarLeft.innerHTML = '<span class="status-dot indexing"></span>正在索引应用...';
  } else {
    statusBarLeft.innerHTML = '<span class="status-dot"></span>' + totalAppCount + ' 个应用已索引';
  }
}

init();
