// launcher-manager 渲染逻辑 (v1.1.0 视觉精修)

const searchInput = document.getElementById('search-input');
const resultsEl = document.getElementById('results');
const emptyState = document.getElementById('empty-state');
const appCountEl = document.getElementById('app-count');

let currentResults = [];
let selectedIndex = 0;
let searchTimer = null;
let currentQuery = '';

// 应用头像配色板 —— 4 套和谐冷色（蓝/靛/青/紫），统一苹果白调性
// 比彩虹色板更克制、更具系统感，避免视觉杂乱
const AVATAR_COLORS = [
  ['#0a84ff', '#0064d6'],  // 蓝
  ['#5e5ce6', '#4338ca'],  // 靛
  ['#1ec8d6', '#0e9aa8'],  // 青
  ['#bf5af2', '#7c3aed']   // 紫
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
  currentQuery = query || '';
  currentResults = await window.launcher.search(currentQuery);
  selectedIndex = 0;
  renderResults();
}

// 把结果按 "最近使用 / 全部应用" 分组
// 仅当存在至少一个最近项，且查询为空（首页态）时显示小节标签
function groupResults(results, query) {
  const hasRecent = results.some(r => r.recent);
  if (query && query.trim()) {
    // 搜索态：不分组，整体显示为"搜索结果"
    return [
      { label: '', items: results }
    ];
  }
  if (!hasRecent) {
    return [
      { label: '', items: results }
    ];
  }
  const recent = results.filter(r => r.recent);
  const others = results.filter(r => !r.recent);
  const groups = [];
  if (recent.length) {
    groups.push({ label: '最近使用', items: recent });
  }
  if (others.length) {
    groups.push({ label: '全部应用', items: others });
  }
  return groups;
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

  const groups = groupResults(currentResults, currentQuery);

  // 把"全局 selectedIndex"映射到分组内的局部位置
  let globalIdx = 0;

  groups.forEach((group) => {
    if (group.label) {
      const label = document.createElement('div');
      label.className = 'section-label';
      const textNode = document.createTextNode(group.label);
      label.appendChild(textNode);
      const cnt = document.createElement('span');
      cnt.className = 'section-count';
      cnt.textContent = String(group.items.length);
      label.appendChild(cnt);
      resultsEl.appendChild(label);
    }
    group.items.forEach((app) => {
      const index = globalIdx;
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
      pathEl.textContent = shortenPath(app.path, app.name);

      textWrap.appendChild(nameEl);
      textWrap.appendChild(pathEl);

      item.appendChild(iconWrap);
      item.appendChild(textWrap);

      // 不再渲染单独的"最近"pill —— 小节标签 + 分组已经清楚表达"最近使用"
      // 避免连续 4 个相同 pill 造成视觉冗余

      item.addEventListener('mouseenter', () => {
        selectedIndex = index;
        renderResults();
      });
      item.addEventListener('click', () => {
        selectedIndex = index;
        launchApp(currentResults[index]);
      });

      resultsEl.appendChild(item);
      globalIdx++;
    });
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

// 副标题统一显示安装位置类型，信息层级一致，避免厂商名/父目录名混合造成的视觉混乱
function shortenPath(p, appName) {
  return getLocationType(p);
}

// 根据路径返回安装位置类型
function getLocationType(p) {
  const lower = p.toLowerCase();
  if (lower.indexOf('program files (x86)') >= 0) return 'Program Files (x86)';
  if (lower.indexOf('program files') >= 0) return 'Program Files';
  if (lower.indexOf('appdata\\roaming') >= 0) return 'Roaming';
  if (lower.indexOf('appdata\\local\\programs') >= 0) return 'Local';
  if (lower.indexOf('appdata\\local\\microsoft\\windowsapps') >= 0) return 'WindowsApps';
  if (lower.indexOf('appdata\\local') >= 0) return 'Local';
  if (lower.indexOf('programdata') >= 0) return 'ProgramData';
  if (lower.indexOf('desktop') >= 0) return 'Desktop';
  return '';
}

async function launchApp(app) {
  const res = await window.launcher.launch(app.path);
  if (res.success) {
    searchInput.value = '';
    setTimeout(() => doSearch(''), 150);
  }
}

init();
