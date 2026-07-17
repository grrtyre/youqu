// 渲染进程：日记本 UI 逻辑
const $ = (id) => document.getElementById(id);

const state = {
  current: new Date(),
  view: new Date(), // 日历视图月份
  selectedDate: null,
  entry: { date: '', content: '', mood: '', tags: [], updatedAt: null },
  allEntries: [],
  searchKw: ''
};

// 日期格式化：YYYY-MM-DD
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// 中文日期
function fmtCN(d) {
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}
function parseStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ====== 日历渲染 ======
function renderCalendar() {
  const grid = $('calGrid');
  grid.innerHTML = '';
  const v = state.view;
  $('calTitle').textContent = `${v.getFullYear()} 年 ${v.getMonth() + 1} 月`;
  const first = new Date(v.getFullYear(), v.getMonth(), 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(v.getFullYear(), v.getMonth() + 1, 0).getDate();
  const prevMonthDays = new Date(v.getFullYear(), v.getMonth(), 0).getDate();

  // 上月尾
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const cell = document.createElement('div');
    cell.className = 'cal-day out';
    cell.textContent = d;
    grid.appendChild(cell);
  }
  // 本月
  const today = new Date();
  const todayStr = fmt(today);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(v.getFullYear(), v.getMonth(), d);
    const ds = fmt(date);
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (ds === todayStr) cell.classList.add('today');
    if (ds === state.selectedDate) cell.classList.add('selected');
    if (state.allEntries.some(e => e.date === ds)) cell.classList.add('has-entry');
    cell.textContent = d;
    cell.addEventListener('click', () => selectDate(ds));
    grid.appendChild(cell);
  }
  // 下月头
  const total = startDay + daysInMonth;
  const rest = (7 - (total % 7)) % 7;
  for (let d = 1; d <= rest; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day out';
    cell.textContent = d;
    grid.appendChild(cell);
  }
}

// ====== 列表渲染 ======
async function refreshList() {
  state.allEntries = await window.diaryAPI.list();
  $('listCount').textContent = state.allEntries.length;
  renderList();
  renderCalendar();
}

function renderList() {
  const box = $('entryList');
  const kw = state.searchKw.trim().toLowerCase();
  let items = state.allEntries;
  if (kw) {
    items = items.filter(e =>
      (e.preview || '').toLowerCase().includes(kw) ||
      (e.tags || []).some(t => t.toLowerCase().includes(kw)) ||
      e.date.includes(kw)
    );
  }
  if (!items.length) {
    box.innerHTML = '<div class="entry-empty">' + (kw ? '没有匹配的日记' : '还没有日记，从今天开始吧') + '</div>';
    return;
  }
  box.innerHTML = '';
  for (const e of items) {
    const div = document.createElement('div');
    div.className = 'entry-item' + (e.date === state.selectedDate ? ' active' : '');
    const d = parseStr(e.date);
    const tagsHTML = (e.tags || []).slice(0, 3).map(t => `<span class="entry-tag">${escapeHtml(t)}</span>`).join('');
    div.innerHTML = `
      <div class="entry-item-top">
        <span class="entry-item-date">${e.date}</span>
        <span class="entry-item-mood">${e.mood || ''}</span>
      </div>
      ${e.title ? `<div class="entry-item-title">${escapeHtml(e.title)}</div>` : ''}
      <div class="entry-item-preview">${escapeHtml(e.preview || '（空白日记）')}</div>
      ${tagsHTML ? `<div class="entry-item-tags">${tagsHTML}</div>` : ''}
    `;
    div.addEventListener('click', () => selectDate(e.date));
    box.appendChild(div);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ====== 选择日期并加载 ======
async function selectDate(dateStr) {
  state.selectedDate = dateStr;
  const d = parseStr(dateStr);
  state.view = new Date(d.getFullYear(), d.getMonth(), 1);
  $('entryDate').textContent = fmtCN(d);
  const entry = await window.diaryAPI.read(dateStr);
  state.entry = entry;
  // 填充 UI
  $('titleLine').textContent = entry.title || '';
  $('editor').innerHTML = entry.content || '';
  $('wordCount').textContent = countWords(entry.content) + ' 字';
  $('entryMeta').textContent = entry.updatedAt ? `已保存 · ${new Date(entry.updatedAt).toLocaleString('zh-CN')}` : '尚未保存';
  updateEmptyState();
  // 心情
  document.querySelectorAll('.mood').forEach(b => {
    b.classList.toggle('selected', b.dataset.mood === entry.mood);
  });
  // 标签
  renderTags();
  renderCalendar();
  renderList();
}

function renderTags() {
  const box = $('tagChips');
  box.innerHTML = '';
  for (const t of state.entry.tags || []) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escapeHtml(t)} <span class="tag-x" data-tag="${escapeHtml(t)}">×</span>`;
    chip.querySelector('.tag-x').addEventListener('click', () => {
      state.entry.tags = state.entry.tags.filter(x => x !== t);
      renderTags();
    });
    box.appendChild(chip);
  }
}

function countWords(html) {
  const text = (html || '').replace(/<[^>]+>/g, '');
  return text.replace(/\s/g, '').length;
}

function updateEmptyState() {
  const hasContent = $('editor').innerHTML.trim() !== '' || $('titleLine').textContent.trim() !== '';
  $('emptyState').classList.toggle('hidden', hasContent);
  document.body.classList.toggle('is-empty', !hasContent);
}

// ====== 保存 ======
async function saveEntry() {
  if (!state.selectedDate) return;
  const content = $('editor').innerHTML;
  const title = $('titleLine').textContent.trim();
  state.entry.date = state.selectedDate;
  state.entry.content = content;
  state.entry.title = title;
  state.entry.tags = state.entry.tags || [];
  const res = await window.diaryAPI.save(state.entry);
  if (res.ok) {
    $('entryMeta').textContent = `已保存 · ${new Date(res.updatedAt).toLocaleString('zh-CN')}`;
    showToast('已保存');
    refreshList();
  } else {
    showToast('保存失败');
  }
}

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1600);
}

// ====== 事件绑定 ======
function bind() {
  $('prevMonth').addEventListener('click', () => {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1);
    renderCalendar();
  });
  $('nextMonth').addEventListener('click', () => {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1);
    renderCalendar();
  });

  $('todayBtn').addEventListener('click', () => selectDate(fmt(new Date())));

  $('saveBtn').addEventListener('click', saveEntry);

  $('deleteBtn').addEventListener('click', async () => {
    if (!state.selectedDate) return;
    if (!confirm('确定删除这一天的日记吗？此操作不可撤销。')) return;
    await window.diaryAPI.delete(state.selectedDate);
    showToast('已删除');
    await selectDate(state.selectedDate);
    refreshList();
  });

  $('exportBtn').addEventListener('click', async () => {
    if (!state.selectedDate) return;
    const r = await window.diaryAPI.export(state.selectedDate);
    showToast(r.ok ? `已导出到 ${r.path}` : '已取消');
  });

  // 心情选择
  document.querySelectorAll('.mood').forEach(b => {
    b.addEventListener('click', () => {
      if (state.entry.mood === b.dataset.mood) {
        state.entry.mood = '';
      } else {
        state.entry.mood = b.dataset.mood;
      }
      document.querySelectorAll('.mood').forEach(x => x.classList.toggle('selected', x.dataset.mood === state.entry.mood));
    });
  });

  // 标签输入
  $('tagInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = e.target.value.trim();
      if (v && !(state.entry.tags || []).includes(v)) {
        state.entry.tags = state.entry.tags || [];
        state.entry.tags.push(v);
        renderTags();
      }
      e.target.value = '';
    } else if (e.key === 'Backspace' && !e.target.value && (state.entry.tags || []).length) {
      state.entry.tags.pop();
      renderTags();
    }
  });

  // 字数统计
  $('editor').addEventListener('input', () => {
    $('wordCount').textContent = countWords($('editor').innerHTML) + ' 字';
    updateEmptyState();
  });
  $('titleLine').addEventListener('input', updateEmptyState);

  // 搜索
  $('search').addEventListener('input', (e) => {
    state.searchKw = e.target.value;
    renderList();
  });

  // 快捷键
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveEntry();
    }
  });
}

// ====== 启动 ======
(async function init() {
  bind();
  await refreshList();
  await selectDate(fmt(new Date()));
})();
