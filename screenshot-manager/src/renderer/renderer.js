// 截图管家 - 主窗口逻辑
const { api } = window;

// 标题栏按钮
document.getElementById('btnMin').onclick = () => api.winMinimize();
document.getElementById('btnMax').onclick = () => api.winMaximize();
document.getElementById('btnClose').onclick = () => api.winClose();

// 立即截图按钮：直接触发主进程截图流程（先隐藏主窗口避免被截到）
document.getElementById('btnShot').onclick = () => {
  api.winMinimize();
  // 等主窗口最小化后再启动截图，避免主窗口被截进去
  setTimeout(() => api.triggerScreenshot(), 180);
};

// 导航切换
document.querySelectorAll('.nav-item').forEach(item => {
  item.onclick = () => {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    item.classList.add('active');
    const tab = item.dataset.tab;
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-' + tab).classList.remove('hidden');
  };
});

// 历史网格
const historyGrid = document.getElementById('historyGrid');
const emptyState = document.getElementById('emptyState');
const historyCount = document.getElementById('historyCount');

function fmtTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderHistory(list) {
  historyCount.textContent = list.length;
  // 计数为 0 时隐藏徽章，避免空状态下出现突兀的"0"
  historyCount.style.display = list.length > 0 ? '' : 'none';
  historyGrid.innerHTML = '';
  if (!list.length) {
    historyGrid.appendChild(emptyState);
    return;
  }
  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-item';
    card.innerHTML = `
      <div class="history-thumb"><img alt="" data-path="${item.path}"></div>
      <div class="history-meta">
        <span class="history-time">${fmtTime(item.time)}</span>
        <div class="history-actions">
          <button class="h-act" data-act="edit" title="再编辑">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 4l6 6L9 21H3v-6L14 4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
          <button class="h-act" data-act="folder" title="在文件夹中显示">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="1.8"/></svg>
          </button>
          <button class="h-act danger" data-act="del" title="删除">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m-9 0l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `;
    // 通过 IPC readImage（白名单校验）加载缩略图，避免 file:/// 直连绕过安全检查
    const imgEl = card.querySelector('img');
    api.readImage({ path: item.path }).then(r => {
      if (r && r.ok) imgEl.src = 'data:image/png;base64,' + r.base64;
    });
    card.querySelector('[data-act="edit"]').onclick = async (e) => {
      e.stopPropagation();
      const r = await api.editFromHistory(item.id);
      if (!r.ok) showToast('打开失败');
    };
    card.querySelector('[data-act="folder"]').onclick = async (e) => {
      e.stopPropagation();
      api.showInFolder(item.path);
    };
    card.querySelector('[data-act="del"]').onclick = async (e) => {
      e.stopPropagation();
      const r = await api.deleteHistory(item.id);
      showToast(r && r.ok ? '已删除' : '删除失败');
    };
    card.onclick = () => api.editFromHistory(item.id);
    historyGrid.appendChild(card);
  });
}

// 加载历史
async function loadHistory() {
  const list = await api.getHistory();
  renderHistory(list);
}
loadHistory();

// 接收历史更新
api.onHistoryUpdated((list) => renderHistory(list));

// Toast
const toast = document.getElementById('toast');
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// 关于页 · 爱发电入口（关于页按钮 + 侧边栏页脚链接）
['afdianLink', 'afdianLinkSide'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.onclick = (e) => {
      e.preventDefault();
      api.openExternal('https://www.ifdian.net/a/giquwei');
    };
  }
});
