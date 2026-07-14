'use strict';
// 闪卡记忆管家 - 渲染层逻辑

const fc = window.api;
const GRADE = { AGAIN: 1, HARD: 3, GOOD: 4, EASY: 5 };

// 应用状态
const state = {
  decks: [],
  currentDeckId: null,
  cards: [],
  stats: null,
  review: null  // { queue, index, flipped, done }
};

// ---- DOM 引用 ----
const $ = (sel) => document.querySelector(sel);
const deckListEl = $('#deck-list');
const mainEl = $('#main');
const totalCardEl = $('#total-card');

// ---- 工具 ----
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  // 长文本延长显示时间，避免用户来不及看完
  const dur = msg.length > 40 ? 3500 : 1800;
  toast._t = setTimeout(() => { el.hidden = true; }, dur);
}
// 模态框是否打开（用于全局 Esc 关闭）
function isModalOpen() {
  return !$('#modal-mask').hidden;
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

// ---- 卡组列表 ----
async function renderDecks() {
  state.decks = await fc.deck.list();
  deckListEl.innerHTML = '';
  if (state.decks.length === 0) {
    deckListEl.innerHTML = '<li style="color:var(--text-3);font-size:12.5px;padding:10px 6px;">暂无卡组，点击 + 新建</li>';
  }
  state.decks.forEach((d) => {
    const li = document.createElement('li');
    li.className = 'deck-item' + (d.id === state.currentDeckId ? ' active' : '');
    li.innerHTML =
      '<span class="deck-dot"></span>' +
      '<span class="deck-name">' + escapeHtml(d.name) + '</span>' +
      '<span class="deck-count">' + d.cardCount + '</span>' +
      '<span class="deck-ops">' +
        '<button class="deck-op" title="重命名" data-act="rename">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L18.5 9.5a2.12 2.12 0 00-3-3L5 17v3z"/></svg>' +
        '</button>' +
        '<button class="deck-op danger" title="删除卡组" data-act="delete">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13"/></svg>' +
        '</button>' +
      '</span>';
    li.addEventListener('click', () => selectDeck(d.id));
    li.querySelector('[data-act="rename"]').addEventListener('click', (e) => { e.stopPropagation(); openDeckRenameModal(d); });
    li.querySelector('[data-act="delete"]').addEventListener('click', (e) => { e.stopPropagation(); openDeckDeleteModal(d); });
    deckListEl.appendChild(li);
  });
  const total = state.decks.reduce((s, d) => s + d.cardCount, 0);
  totalCardEl.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/></svg> 共 ' + state.decks.length + ' 个卡组 · ' + total + ' 张卡片';
}

async function selectDeck(deckId) {
  state.currentDeckId = deckId;
  await renderDecks();
  await renderDeckDetail();
}

// ---- 卡组详情 ----
async function renderDeckDetail() {
  if (!state.currentDeckId) {
    mainEl.innerHTML =
      '<div class="empty-state">' +
        '<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="5" width="14" height="16" rx="2"/><rect x="7" y="3" width="14" height="16" rx="2"/></svg>' +
        '<h3>选择左侧卡组开始学习</h3>' +
        '<p>或点击左上角 + 新建卡组</p>' +
      '</div>';
    return;
  }
  const deck = state.decks.find((d) => d.id === state.currentDeckId);
  const res = await fc.card.list(state.currentDeckId);
  state.cards = res.ok ? res.cards : [];
  const sRes = await fc.review.stats(state.currentDeckId);
  state.stats = sRes.ok ? sRes.stats : { total: 0, due: 0, fresh: 0, learned: 0 };

  const dueCount = state.stats.due;
  mainEl.innerHTML =
    '<div class="deck-header">' +
      '<h1>' + escapeHtml(deck.name) + '</h1>' +
      '<div class="subtitle">间隔重复 · 科学记忆 · 本地优先</div>' +
    '</div>' +
    '<div class="hero-review">' +
      '<div class="hero-stats">' +
        '<div class="hero-stat"><div class="hero-stat-num due">' + dueCount + '</div><div class="hero-stat-label">今日待复习</div></div>' +
        '<div class="hero-divider"></div>' +
        '<div class="hero-stat"><div class="hero-stat-num fresh">' + state.stats.fresh + '</div><div class="hero-stat-label">未学新卡</div></div>' +
        '<div class="hero-divider"></div>' +
        '<div class="hero-stat"><div class="hero-stat-num learned">' + state.stats.learned + '</div><div class="hero-stat-label">已学习中</div></div>' +
      '</div>' +
      '<div class="hero-cta">' +
        '<button class="btn-hero" id="btn-review" ' + (state.stats.total === 0 ? 'disabled' : '') + '>' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5v14l11-7z"/></svg>' +
          '<span>开始复习</span>' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div class="action-bar">' +
      '<button class="btn-secondary" id="btn-add-card">' +
        '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '<span>添加卡片</span>' +
      '</button>' +
    '</div>' +
    '<div class="section-title">' +
      '<span>卡片列表</span>' +
      '<span style="color:var(--text-3);font-weight:400;">(' + state.cards.length + ')</span>' +
    '</div>' +
    '<div class="card-list" id="card-list"></div>';

  const listEl = $('#card-list');
  if (state.cards.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;color:var(--text-3);padding:40px 0;font-size:13px;">还没有卡片，点击「添加卡片」创建第一张</div>';
  } else {
    state.cards.forEach((c) => listEl.appendChild(cardRowEl(c)));
  }

  $('#btn-review').addEventListener('click', startReview);
  $('#btn-add-card').addEventListener('click', () => openCardModal());
}

function tagClass(t) {
  const tl = String(t).toLowerCase().replace(/\s/g, '');
  if (['cet4', 'cet-4'].includes(tl)) return 'cet4';
  if (['cet6', 'cet-6'].includes(tl)) return 'cet6';
  if (['gre'].includes(tl)) return 'gre';
  if (['js', 'javascript'].includes(tl)) return 'js';
  if (['网络', 'net', 'network'].includes(tl)) return 'net';
  return 'default';
}

function cardRowEl(c) {
  const div = document.createElement('div');
  const reps = c.reps || 0;
  const isLearned = reps > 0;
  const isDue = isLearned && (!c.due || c.due <= Date.now());
  const statusClass = !isLearned ? 'fresh' : (isDue ? 'due' : 'learned');
  div.className = 'card-row ' + statusClass;
  const tagsHtml = (c.tags || []).map((t) => '<span class="tag ' + tagClass(t) + '">' + escapeHtml(t) + '</span>').join('');
  const due = isLearned ? (c.due && c.due > Date.now() ? fmtDate(c.due) + ' 复习' : '今日到期') : '尚未学习';
  const badge = !isLearned ? '<span class="badge new">新卡</span>' : (isDue ? '<span class="badge due">待复习</span>' : '<span class="badge learned">已学习</span>');
  div.innerHTML =
    '<div class="card-row-head">' +
      '<div class="card-front">' + escapeHtml(c.front) + '</div>' +
      (tagsHtml ? '<div class="card-tags">' + tagsHtml + '</div>' : '') +
      '<div class="card-actions">' +
        '<button class="icon-btn" title="编辑" data-act="edit">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L18.5 9.5a2.12 2.12 0 00-3-3L5 17v3z"/></svg>' +
        '</button>' +
        '<button class="icon-btn danger" title="删除" data-act="del">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div class="card-back">' + escapeHtml(c.back) + '</div>' +
    '<div class="card-meta">' +
      badge +
      (isLearned ? '<span class="meta-item">已复习 ' + reps + ' 次</span><span class="meta-item">·</span>' : '') +
      '<span class="meta-item">' + due + '</span>' +
      (isLearned ? '<span class="meta-item">·</span><span class="meta-item dim">易度 ' + (c.ef || 2.5).toFixed(2) + '</span>' : '<span class="meta-item">·</span><span class="meta-item dim">易度 ' + (c.ef || 2.5).toFixed(2) + '</span>') +
    '</div>';
  div.querySelector('[data-act="edit"]').addEventListener('click', () => openCardModal(c));
  div.querySelector('[data-act="del"]').addEventListener('click', () => deleteCard(c));
  return div;
}

// ---- 卡片模态框（新增/编辑）----
function openCardModal(card) {
  const isEdit = !!card;
  const modal = $('#modal');
  modal.innerHTML =
    '<h3>' + (isEdit ? '编辑卡片' : '添加卡片') + '</h3>' +
    '<div class="modal-field"><label>正面（问题/提示）</label>' +
      '<textarea id="m-front" placeholder="如：serendipity">' + escapeHtml(card ? card.front : '') + '</textarea></div>' +
    '<div class="modal-field"><label>背面（答案/解释）</label>' +
      '<textarea id="m-back" placeholder="如：n. 意外发现美好事物的能力">' + escapeHtml(card ? card.back : '') + '</textarea></div>' +
    '<div class="modal-field"><label>标签（逗号分隔，可选）</label>' +
      '<input id="m-tags" placeholder="如：CET6, 词汇" value="' + escapeHtml(card ? (card.tags || []).join(', ') : '') + '"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn-text" id="m-cancel">取消</button>' +
      '<button class="btn-fill" id="m-save">' + (isEdit ? '保存' : '添加') + '</button>' +
    '</div>';
  $('#modal-mask').hidden = false;
  $('#m-front').focus();

  $('#m-cancel').addEventListener('click', closeModal);
  const saveCard = async () => {
    const front = $('#m-front').value.trim();
    const back = $('#m-back').value.trim();
    const tags = $('#m-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
    if (!front || !back) { toast('正面和背面都不能为空'); return; }
    if (isEdit) {
      await fc.card.update(state.currentDeckId, card.id, { front, back, tags });
    } else {
      await fc.card.add(state.currentDeckId, { front, back, tags });
    }
    closeModal();
    toast(isEdit ? '已保存' : '已添加');
    await renderDecks();
    await renderDeckDetail();
  };
  $('#m-save').addEventListener('click', saveCard);
  // Ctrl+Enter / Cmd+Enter 快速保存
  $('#m-back').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveCard(); }
  });
  $('#m-front').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveCard(); }
  });
}

async function deleteCard(card) {
  // 用自定义确认弹窗替代原生 confirm，保持风格统一
  const modal = $('#modal');
  modal.innerHTML =
    '<h3>删除卡片</h3>' +
    '<p style="font-size:13.5px;color:var(--text-2);line-height:1.6;margin-bottom:4px;">确认删除这张卡片？</p>' +
    '<p style="font-size:13.5px;font-weight:500;color:var(--text);margin-bottom:18px;word-break:break-word;">「' + escapeHtml(card.front) + '」</p>' +
    '<div class="modal-actions">' +
      '<button class="btn-text" id="c-cancel">取消</button>' +
      '<button class="btn-fill btn-danger" id="c-ok">删除</button>' +
    '</div>';
  $('#modal-mask').hidden = false;
  const ok = await new Promise((resolve) => {
    $('#c-cancel').addEventListener('click', () => resolve(false));
    $('#c-ok').addEventListener('click', () => resolve(true));
    $('#modal-mask').addEventListener('click', function handler(e) {
      if (e.target.id === 'modal-mask') { $('#modal-mask').removeEventListener('click', handler); resolve(false); }
    });
  });
  closeModal();
  if (!ok) return;
  await fc.card.remove(state.currentDeckId, card.id);
  toast('已删除');
  await renderDecks();
  await renderDeckDetail();
}

function closeModal() { $('#modal-mask').hidden = true; $('#modal').innerHTML = ''; }

// ---- 新建卡组 ----
function openDeckModal() {
  const modal = $('#modal');
  modal.innerHTML =
    '<h3>新建卡组</h3>' +
    '<div class="modal-field"><label>卡组名称</label>' +
      '<input id="d-name" placeholder="如：英语四级词汇"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn-text" id="d-cancel">取消</button>' +
      '<button class="btn-fill" id="d-save">创建</button>' +
    '</div>';
  $('#modal-mask').hidden = false;
  $('#d-name').focus();
  $('#d-cancel').addEventListener('click', closeModal);
  const save = async () => {
    const name = $('#d-name').value.trim();
    if (!name) { toast('名称不能为空'); return; }
    const res = await fc.deck.create(name);
    closeModal();
    if (res.ok) {
      toast('已创建卡组');
      await renderDecks();
      await selectDeck(res.deck.id);
    } else {
      toast(res.error || '创建失败');
    }
  };
  $('#d-save').addEventListener('click', save);
  $('#d-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

// ---- 重命名卡组 ----
function openDeckRenameModal(deck) {
  const modal = $('#modal');
  modal.innerHTML =
    '<h3>重命名卡组</h3>' +
    '<div class="modal-field"><label>卡组名称</label>' +
      '<input id="r-name" value="' + escapeHtml(deck.name) + '"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn-text" id="r-cancel">取消</button>' +
      '<button class="btn-fill" id="r-save">保存</button>' +
    '</div>';
  $('#modal-mask').hidden = false;
  const input = $('#r-name');
  input.focus();
  input.select();
  const save = async () => {
    const name = input.value.trim();
    if (!name) { toast('名称不能为空'); return; }
    if (name === deck.name) { closeModal(); return; }
    const res = await fc.deck.rename(deck.id, name);
    closeModal();
    if (res.ok) {
      toast('已重命名');
      await renderDecks();
      await renderDeckDetail();
    } else {
      toast(res.error || '重命名失败');
    }
  };
  $('#r-cancel').addEventListener('click', closeModal);
  $('#r-save').addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

// ---- 删除卡组 ----
async function openDeckDeleteModal(deck) {
  const modal = $('#modal');
  modal.innerHTML =
    '<h3>删除卡组</h3>' +
    '<p style="font-size:13.5px;color:var(--text-2);line-height:1.6;margin-bottom:4px;">确认删除卡组及其全部卡片？此操作不可撤销。</p>' +
    '<p style="font-size:13.5px;font-weight:500;color:var(--text);margin-bottom:18px;">「' + escapeHtml(deck.name) + '」（' + deck.cardCount + ' 张卡片）</p>' +
    '<div class="modal-actions">' +
      '<button class="btn-text" id="dl-cancel">取消</button>' +
      '<button class="btn-fill btn-danger" id="dl-ok">删除</button>' +
    '</div>';
  $('#modal-mask').hidden = false;
  const ok = await new Promise((resolve) => {
    $('#dl-cancel').addEventListener('click', () => resolve(false));
    $('#dl-ok').addEventListener('click', () => resolve(true));
  });
  closeModal();
  if (!ok) return;
  await fc.deck.remove(deck.id);
  toast('已删除卡组');
  if (state.currentDeckId === deck.id) state.currentDeckId = null;
  await renderDecks();
  if (state.decks.length > 0) {
    await selectDeck(state.decks[0].id);
  } else {
    await renderDeckDetail();
  }
}

// ---------- 复习模式 ----------
async function startReview() {
  const res = await fc.review.queue(state.currentDeckId, { newPerSession: 20 });
  if (!res.ok || res.queue.length === 0) { toast('当前没有需要复习的卡片'); return; }
  state.review = { queue: res.queue, index: 0, flipped: false, done: false, reviewed: 0 };
  renderReview();
}

function renderReview() {
  const r = state.review;
  const total = r.queue.length;
  const card = r.queue[r.index];

  mainEl.innerHTML = ''; // 清空主区，复习用全屏覆盖
  // 移除可能已存在的覆盖层
  const old = document.querySelector('.review-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'review-overlay';
  overlay.innerHTML =
    '<div class="review-top">' +
      '<div class="review-progress">' + (r.index + 1) + ' / ' + total + '</div>' +
      '<button class="review-close" id="rv-close">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '<span>退出</span>' +
      '</button>' +
    '</div>' +
    '<div class="review-stage">' +
      '<div class="progress-bar"><div class="progress-bar-fill" id="rv-bar"></div></div>' +
      '<div class="flashcard" id="rv-card">' +
        '<div class="flashcard-label" id="rv-label">问题</div>' +
        '<div class="flashcard-content" id="rv-content"></div>' +
      '</div>' +
      '<div class="grade-row" id="rv-grades" style="visibility:hidden;">' +
        gradeBtn('again', '忘了', 'Again', estInterval(card, 1), '1') +
        gradeBtn('hard', '困难', 'Hard', estInterval(card, 3), '2') +
        gradeBtn('good', '良好', 'Good', estInterval(card, 4), '3') +
        gradeBtn('easy', '简单', 'Easy', estInterval(card, 5), '4') +
      '</div>' +
      '<div class="review-hints">' +
        '<span><kbd>空格</kbd> 翻牌</span>' +
        '<span><kbd>1</kbd>-<kbd>4</kbd> 评分</span>' +
        '<span><kbd>Esc</kbd> 退出</span>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // 进度条：至少给一点可见宽度，避免首张时看起来是空的
  $('#rv-bar').style.width = Math.max(4, (r.index / total * 100)) + '%';
  renderCardFace(card);

  $('#rv-card').addEventListener('click', flipCard);
  $('#rv-close').addEventListener('click', exitReview);
  document.querySelectorAll('.grade-btn').forEach((b) => {
    b.addEventListener('click', () => gradeCard(parseInt(b.dataset.q, 10)));
  });
}

// 根据卡片当前调度状态推算下次间隔天数（仅展示，与主进程 sm2 一致）
function estInterval(card, q) {
  const ef = typeof card.ef === 'number' && card.ef >= 1.3 ? card.ef : 2.5;
  const reps = typeof card.reps === 'number' && card.reps >= 0 ? card.reps : 0;
  let interval = typeof card.interval === 'number' && card.interval >= 0 ? card.interval : 0;
  if (q >= 3) {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);
  } else {
    interval = 1;
  }
  if (interval <= 0) return '<1天';
  if (interval === 1) return '1天';
  if (interval < 30) return interval + '天';
  if (interval < 365) return Math.round(interval / 30) + '个月';
  return Math.round(interval / 365 * 10) / 10 + '年';
}

function gradeBtn(cls, zh, en, hint, key) {
  const q = cls === 'again' ? GRADE.AGAIN : cls === 'hard' ? GRADE.HARD : cls === 'good' ? GRADE.GOOD : GRADE.EASY;
  return '<button class="grade-btn ' + cls + '" data-q="' + q + '">' +
    '<span class="grade-zh">' + zh + '</span>' +
    '<span class="grade-en">' + en + ' · ' + hint + ' <kbd>' + key + '</kbd></span>' +
  '</button>';
}

function renderCardFace(card) {
  const r = state.review;
  const label = $('#rv-label');
  const content = $('#rv-content');
  if (!r.flipped) {
    label.textContent = '问题 · 点击卡片查看答案';
    content.innerHTML = '<div class="flashcard-front-text">' + escapeHtml(card.front) + '</div>';
  } else {
    label.textContent = '答案 · 选择你的掌握程度';
    content.innerHTML = '<div class="flashcard-back-text">' + escapeHtml(card.back) + '</div>';
    $('#rv-grades').style.visibility = 'visible';
  }
}

function flipCard() {
  const r = state.review;
  if (r.flipped) return;
  r.flipped = true;
  renderCardFace(r.queue[r.index]);
}

async function gradeCard(q) {
  const r = state.review;
  const card = r.queue[r.index];
  await fc.review.grade(state.currentDeckId, card.id, q);
  r.reviewed++;
  r.index++;
  r.flipped = false;
  if (r.index >= r.queue.length) {
    showReviewComplete();
  } else {
    renderReview();
  }
}

function showReviewComplete() {
  const r = state.review;
  r.done = true;
  const overlay = document.querySelector('.review-overlay');
  overlay.querySelector('.review-stage').innerHTML =
    '<div class="review-complete">' +
      '<div class="done-icon">' +
        '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>' +
      '</div>' +
      '<h2>本次复习完成</h2>' +
      '<p>共复习 ' + r.reviewed + ' 张卡片，继续保持！</p>' +
      '<button class="btn-hero" id="rv-back" style="margin-top:8px;">返回卡组</button>' +
    '</div>';
  $('#rv-back').addEventListener('click', exitReview);
}

async function exitReview() {
  const overlay = document.querySelector('.review-overlay');
  if (overlay) overlay.remove();
  state.review = null;
  await renderDecks();
  await renderDeckDetail();
}

// ---------- 导入/导出 ----------
async function doExport() {
  const res = await fc.data.exportFile();
  if (res.ok) toast('已导出到：' + res.filePath);
  else if (res.error) toast('导出失败：' + res.error);
}
async function doImport() {
  const res = await fc.data.importFile();
  if (res.ok) {
    toast('导入成功');
    await renderDecks();
    if (state.decks.length > 0) await selectDeck(state.decks[0].id);
  } else if (res.error) {
    toast('导入失败：' + res.error);
  }
}

// ---------- 事件绑定 ----------
$('#btn-new-deck').addEventListener('click', openDeckModal);
$('#btn-export').addEventListener('click', doExport);
$('#btn-import').addEventListener('click', doImport);
$('#modal-mask').addEventListener('click', (e) => { if (e.target.id === 'modal-mask') closeModal(); });
document.addEventListener('keydown', (e) => {
  // 模态框打开时：Esc 关闭（优先于复习快捷键）
  if (isModalOpen() && e.key === 'Escape') { closeModal(); return; }
  if (state.review && !state.review.done) {
    const r = state.review;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!r.flipped) flipCard(); }
    else if (r.flipped) {
      if (e.key === '1') gradeCard(GRADE.AGAIN);
      else if (e.key === '2') gradeCard(GRADE.HARD);
      else if (e.key === '3') gradeCard(GRADE.GOOD);
      else if (e.key === '4') gradeCard(GRADE.EASY);
    }
    if (e.key === 'Escape') exitReview();
  }
});

// ---------- 启动 ----------
(async function init() {
  console.log('[init] starting, fc=', typeof fc);
  await renderDecks();
  console.log('[init] decks loaded:', state.decks.length);
  if (state.decks.length > 0) {
    await selectDeck(state.decks[0].id);
    console.log('[init] selected deck, cards:', state.cards.length);
  } else {
    renderDeckDetail();
  }
  console.log('[init] done');
})();
