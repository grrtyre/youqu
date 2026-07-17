// launcher-manager 渲染逻辑

const searchInput = document.getElementById('search-input');
const resultsEl = document.getElementById('results');
const emptyState = document.getElementById('empty-state');
const appCountEl = document.getElementById('app-count');

let currentResults = [];
let selectedIndex = 0;
let searchTimer = null;

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

async function init() {
  const count = await window.launcher.getAppCount();
  appCountEl.textContent = count;
  if (SHOT_MODE) {
    searchInput.value = '';
    await doSearch('');
    searchInput.focus();
  } else {
    await doSearch('');
  }
}

window.launcher.onWindowShown(() => {
  searchInput.value = '';
  searchInput.focus();
  doSearch('');
  const updateCount = async () => {
    appCountEl.textContent = await window.launcher.getAppCount();
  };
  updateCount();
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(searchInput.value), 80);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (currentResults.length === 0) return;
    selectedIndex = (selectedIndex + 1) % currentResults.length;
    renderResults();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentResults.length === 0) return;
    selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
    renderResults();
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
    return;
  }

  resultsEl.hidden = false;
  emptyState.hidden = true;

  currentResults.forEach((app, index) => {
    const item = document.createElement('div');
    item.className = 'result-item' + (index === selectedIndex ? ' selected' : '');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', index === selectedIndex);

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

    textWrap.appendChild(nameEl);
    textWrap.appendChild(pathEl);

    item.appendChild(iconWrap);
    item.appendChild(textWrap);

    // 移除右侧"最近"圆点指示器 — 最近应用已通过置顶排序隐式表达
    // 避免视觉冗余和"未完成感"

    item.addEventListener('mouseenter', () => {
      selectedIndex = index;
      renderResults();
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

function shortenPath(p) {
  return p.replace(/^[A-Z]:\\Users\\[^\\]+\\/, '~/').replace(/^[A-Z]:\\ProgramData\\/, '/ProgramData/');
}

async function launchApp(app) {
  const res = await window.launcher.launch(app.path);
  if (res.success) {
    searchInput.value = '';
    setTimeout(() => doSearch(''), 150);
  }
}

init();
