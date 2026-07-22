// 分账助手 - 渲染进程逻辑
// 自动适配 Electron（window.api）与浏览器（localStorage）环境

(function () {
  const A = window.Accounting;

  // ---------- 存储层 ----------
  const isElectron = typeof window.api !== 'undefined' && window.api;
  let store = { groups: [], activeGroupId: null };

  async function loadStore() {
    if (isElectron) {
      try {
        store = await window.api.loadData();
      } catch (e) {
        store = { groups: [], activeGroupId: null };
      }
    } else {
      try {
        const raw = localStorage.getItem('expense-splitter-data');
        store = raw ? JSON.parse(raw) : { groups: [], activeGroupId: null };
      } catch (e) {
        store = { groups: [], activeGroupId: null };
      }
    }
    if (!store.groups || !store.groups.length) {
      seedDemo();
      await saveStore();
    }
    if (!store.activeGroupId && store.groups.length) {
      store.activeGroupId = store.groups[0].id;
    }
  }

  async function saveStore() {
    if (isElectron) {
      try { await window.api.saveData(store); } catch (e) {}
    } else {
      localStorage.setItem('expense-splitter-data', JSON.stringify(store));
    }
    flashSaved();
  }

  // ---------- 演示数据 ----------
  function seedDemo() {
    const g = A.createGroup('海南之旅');
    const m1 = { id: A.genId('mem'), name: '李明', color: A.MEMBER_COLORS[0] };
    const m2 = { id: A.genId('mem'), name: '王红', color: A.MEMBER_COLORS[1] };
    const m3 = { id: A.genId('mem'), name: '张刚', color: A.MEMBER_COLORS[2] };
    const m4 = { id: A.genId('mem'), name: '赵芳', color: A.MEMBER_COLORS[3] };
    g.members = [m1, m2, m3, m4];
    g.expenses = [
      { id: A.genId('exp'), description: '民宿住宿（3晚）', amount: A.yuanToFen(2400), payerId: m1.id, date: '2026-07-15', splitType: 'equal', category: '住宿', createdAt: Date.now() },
      { id: A.genId('exp'), description: '海鲜大餐', amount: A.yuanToFen(680), payerId: m2.id, date: '2026-07-15', splitType: 'equal', category: '餐饮', createdAt: Date.now() },
      { id: A.genId('exp'), description: '租车 + 油费', amount: A.yuanToFen(520), payerId: m3.id, date: '2026-07-16', splitType: 'equal', category: '交通', createdAt: Date.now() },
      { id: A.genId('exp'), description: '景点门票', amount: A.yuanToFen(360), payerId: m4.id, date: '2026-07-16', splitType: 'share', splits: { [m1.id]: 1, [m2.id]: 1, [m3.id]: 1, [m4.id]: 1 }, category: '门票', createdAt: Date.now() },
      { id: A.genId('exp'), description: '免税店购物', amount: A.yuanToFen(1280), payerId: m1.id, date: '2026-07-17', splitType: 'percent', splits: { [m1.id]: 40, [m2.id]: 30, [m3.id]: 30 }, category: '购物', createdAt: Date.now() },
      { id: A.genId('exp'), description: '椰子鸡晚餐', amount: A.yuanToFen(420), payerId: m3.id, date: '2026-07-17', splitType: 'equal', category: '餐饮', createdAt: Date.now() },
    ];
    // 小红已先转账给小明 200 元
    g.settlements = [
      { id: A.genId('set'), fromId: m2.id, toId: m1.id, amount: A.yuanToFen(200), date: '2026-07-18', createdAt: Date.now() },
    ];
    store.groups = [g];
    store.activeGroupId = g.id;
  }

  // ---------- 视图状态 ----------
  let currentTab = 'bills';
  let editingSplitType = 'equal';

  function activeGroup() {
    return store.groups.find((g) => g.id === store.activeGroupId) || null;
  }

  // ---------- 渲染 ----------
  function renderAll() {
    renderGroupList();
    renderDetail();
  }

  function renderGroupList() {
    const list = document.getElementById('groupList');
    list.innerHTML = '';
    store.groups.forEach((g) => {
      const item = document.createElement('div');
      item.className = 'group-item' + (g.id === store.activeGroupId ? ' active' : '');
      item.innerHTML = `
        <span class="group-item-dot" style="background:${A.MEMBER_COLORS[store.groups.indexOf(g) % A.MEMBER_COLORS.length]}"></span>
        <span class="group-item-name">${escapeHtml(g.name)}</span>
        <span class="group-item-count">${g.members.length}</span>
      `;
      item.onclick = () => {
        store.activeGroupId = g.id;
        saveStore();
        renderAll();
      };
      list.appendChild(item);
    });
  }

  function renderDetail() {
    const g = activeGroup();
    const empty = document.getElementById('emptyState');
    const detail = document.getElementById('detailView');
    if (!g) {
      empty.style.display = 'flex';
      detail.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    detail.style.display = 'block';

    document.getElementById('groupName').textContent = g.name;
    const stats = A.computeStats(g);
    document.getElementById('statTotal').textContent = '¥' + A.fenToYuan(stats.total);
    document.getElementById('statCount').textContent = stats.count;
    document.getElementById('statMembers').textContent = stats.memberCount;
    document.getElementById('statPerPerson').textContent = '¥' + A.fenToYuan(stats.perPerson);

    // 成员行
    const membersRow = document.getElementById('membersRow');
    membersRow.innerHTML = '';
    g.members.forEach((m) => {
      const chip = document.createElement('div');
      chip.className = 'member-chip';
      chip.innerHTML = `
        <div class="member-avatar" style="background:${m.color}">${initial(m.name)}</div>
        <span class="member-chip-name">${escapeHtml(m.name)}</span>
      `;
      membersRow.appendChild(chip);
    });

    renderBills(g);
    renderBalance(g);
    renderSettle(g);
  }

  // 统一描边风格 SVG 图标（Feather 风格，currentColor，stroke-width 1.8）
  const CATEGORY_ICON = {
    住宿: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5h5v5"/></svg>',
    餐饮: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M6 12v9"/><path d="M16 3c-1.5 0-3 1.5-3 4s1.5 4 3 4v10"/></svg>',
    交通: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 11h18v6H3z"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/></svg>',
    门票: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/></svg>',
    购物: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    general: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M15 6H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H9"/></svg>',
  };
  const SPLIT_LABEL = { equal: '均摊', share: '按份数', percent: '百分比', exact: '自定义' };

  function renderBills(g) {
    const list = document.getElementById('billList');
    list.innerHTML = '';
    if (!g.expenses.length) {
      list.innerHTML = '<div class="settle-empty"><div class="big">🧾</div>还没有账单，点击右上角添加</div>';
      return;
    }
    const sorted = g.expenses.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    sorted.forEach((e) => {
      const payer = g.members.find((m) => m.id === e.payerId);
      const item = document.createElement('div');
      item.className = 'bill-item';
      const icon = CATEGORY_ICON[e.category] || CATEGORY_ICON.general;
      item.innerHTML = `
        <div class="bill-icon">${icon}</div>
        <div class="bill-info">
          <div class="bill-desc">${escapeHtml(e.description)}</div>
          <div class="bill-meta">
            <span>${payer ? escapeHtml(payer.name) : '?'} 付款</span>
            <span>·</span>
            <span>${e.date}</span>
          </div>
        </div>
        <span class="bill-split-tag">${SPLIT_LABEL[e.splitType] || '均摊'}</span>
        <div class="bill-amount">¥${A.fenToYuan(e.amount)}</div>
        <button class="bill-delete" title="删除">✕</button>
      `;
      item.querySelector('.bill-delete').onclick = async () => {
        const ng = A.removeExpense(g, e.id);
        Object.assign(g, ng);
        await saveStore();
        renderAll();
        toast('已删除账单');
      };
      list.appendChild(item);
    });
  }

  function renderBalance(g) {
    const list = document.getElementById('balanceList');
    list.innerHTML = '';
    const bal = A.computeBalances(g);
    g.members.forEach((m) => {
      const v = bal[m.id] || 0;
      const card = document.createElement('div');
      card.className = 'balance-card';
      let cls = 'zero', status = '已结清';
      if (v > 0) { cls = 'positive'; status = '应收回'; }
      else if (v < 0) { cls = 'negative'; status = '应付出'; }
      const sign = v > 0 ? '+' : '';
      card.innerHTML = `
        <div class="balance-avatar" style="background:${m.color}">${initial(m.name)}</div>
        <div class="balance-info">
          <div class="balance-name">${escapeHtml(m.name)}</div>
          <div class="balance-status">${status}</div>
        </div>
        <div class="balance-amount ${cls}">${sign}¥${A.fenToYuan(v)}</div>
      `;
      list.appendChild(card);
    });
  }

  function renderSettle(g) {
    const intro = document.getElementById('settleIntro');
    const list = document.getElementById('settleList');
    list.innerHTML = '';
    const debts = A.simplifyDebts(g);
    if (!debts.length) {
      intro.innerHTML = '<span class="dot" style="background:#34c759"></span>所有人已结清，账目清清爽爽 🎉';
      list.innerHTML = '<div class="settle-empty"><div class="big">✅</div>无需结算，大家两不相欠</div>';
      return;
    }
    const totalDebt = debts.reduce((s, d) => s + d.amount, 0);
    intro.innerHTML = `<span class="dot"></span>共 <b>${debts.length}</b> 笔结算即可两清，总计 <b>¥${A.fenToYuan(totalDebt)}</b>`;
    debts.forEach((d) => {
      const from = g.members.find((m) => m.id === d.from);
      const to = g.members.find((m) => m.id === d.to);
      const item = document.createElement('div');
      item.className = 'settle-item';
      item.innerHTML = `
        <div class="settle-party">
          <div class="member-avatar" style="background:${from ? from.color : '#999'}">${from ? initial(from.name) : '?'}</div>
          <span class="settle-party-name">${from ? escapeHtml(from.name) : '?'}</span>
        </div>
        <span class="settle-arrow">→</span>
        <div class="settle-party">
          <div class="member-avatar" style="background:${to ? to.color : '#999'}">${to ? initial(to.name) : '?'}</div>
          <span class="settle-party-name">${to ? escapeHtml(to.name) : '?'}</span>
        </div>
        <div class="settle-amount">¥${A.fenToYuan(d.amount)}</div>
        <button class="settle-done-btn">已结清</button>
      `;
      item.querySelector('.settle-done-btn').onclick = async () => {
        const ng = A.addSettlement(g, { fromId: d.from, toId: d.to, amount: A.fenToYuan(d.amount) });
        Object.assign(g, ng);
        await saveStore();
        renderAll();
        toast('已记录结算');
      };
      list.appendChild(item);
    });
  }

  // ---------- 弹窗 ----------
  function openModal(id) {
    document.getElementById(id).style.display = 'flex';
  }
  function closeModal(id) {
    document.getElementById(id).style.display = 'none';
  }
  document.querySelectorAll('[data-close]').forEach((b) => {
    b.onclick = () => {
      ['expenseModal', 'memberModal', 'groupModal'].forEach((m) => (document.getElementById(m).style.display = 'none'));
    };
  });
  document.querySelectorAll('.modal-mask').forEach((mask) => {
    mask.addEventListener('click', (e) => {
      if (e.target === mask) mask.style.display = 'none';
    });
  });

  // 标签切换
  document.querySelectorAll('.tab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      currentTab = t.dataset.tab;
      document.getElementById('panel-' + currentTab).classList.add('active');
    };
  });

  // 新建分账
  document.getElementById('newGroupBtn').onclick = () => {
    document.getElementById('groupNameInput').value = '';
    document.getElementById('groupMembersInput').value = '';
    openModal('groupModal');
    setTimeout(() => document.getElementById('groupNameInput').focus(), 50);
  };
  document.getElementById('groupSave').onclick = async () => {
    const name = document.getElementById('groupNameInput').value.trim();
    if (!name) { toast('请输入分账名称'); return; }
    const g = A.createGroup(name);
    const names = document.getElementById('groupMembersInput').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (names.length) {
      g.members = names.map((n, i) => ({ id: A.genId('mem'), name: n, color: A.MEMBER_COLORS[i % A.MEMBER_COLORS.length] }));
    } else {
      const m = { id: A.genId('mem'), name: '我', color: A.MEMBER_COLORS[0] };
      g.members = [m];
    }
    store.groups.push(g);
    store.activeGroupId = g.id;
    await saveStore();
    renderAll();
    closeModal('groupModal');
    toast('已创建分账');
  };

  // 添加成员
  document.getElementById('addMemberBtn').onclick = () => {
    document.getElementById('memberName').value = '';
    openModal('memberModal');
    setTimeout(() => document.getElementById('memberName').focus(), 50);
  };
  document.getElementById('memberSave').onclick = async () => {
    const g = activeGroup();
    if (!g) return;
    const name = document.getElementById('memberName').value.trim();
    if (!name) { toast('请输入名字'); return; }
    const ng = A.addMember(g, name);
    Object.assign(g, ng);
    await saveStore();
    renderAll();
    closeModal('memberModal');
    toast('已添加成员');
  };

  // 删除分账组
  document.getElementById('deleteGroupBtn').onclick = async () => {
    const g = activeGroup();
    if (!g) return;
    if (!confirm(`确认删除「${g.name}」？所有账单将一并删除。`)) return;
    store.groups = store.groups.filter((x) => x.id !== g.id);
    store.activeGroupId = store.groups.length ? store.groups[0].id : null;
    await saveStore();
    renderAll();
    toast('已删除分账');
  };

  // 添加账单
  document.getElementById('addExpenseBtn').onclick = () => {
    const g = activeGroup();
    if (!g) return;
    if (!g.members.length) { toast('请先添加成员'); return; }
    document.getElementById('expDescription').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expDate').value = new Date().toISOString().slice(0, 10);
    editingSplitType = 'equal';
    document.querySelectorAll('#splitTypeSeg .seg-item').forEach((s) => s.classList.toggle('active', s.dataset.st === 'equal'));
    fillPayerSelect(g);
    renderSplitEditor(g);
    document.getElementById('expenseModalTitle').textContent = '添加账单';
    openModal('expenseModal');
    setTimeout(() => document.getElementById('expDescription').focus(), 50);
  };

  function fillPayerSelect(g) {
    const sel = document.getElementById('expPayer');
    sel.innerHTML = '';
    g.members.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      sel.appendChild(opt);
    });
  }

  document.querySelectorAll('#splitTypeSeg .seg-item').forEach((s) => {
    s.onclick = () => {
      document.querySelectorAll('#splitTypeSeg .seg-item').forEach((x) => x.classList.remove('active'));
      s.classList.add('active');
      editingSplitType = s.dataset.st;
      renderSplitEditor(activeGroup());
    };
  });

  function renderSplitEditor(g) {
    const ed = document.getElementById('splitEditor');
    ed.innerHTML = '';
    if (editingSplitType === 'equal') {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:12px;color:var(--text-3);padding:6px 2px';
      note.textContent = '所有成员均摊，无需额外设置';
      ed.appendChild(note);
      return;
    }
    const unit = editingSplitType === 'percent' ? '%' : (editingSplitType === 'share' ? '份' : '元');
    g.members.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'split-row';
      const def = editingSplitType === 'percent' ? '' : (editingSplitType === 'share' ? '1' : '');
      row.innerHTML = `
        <div class="member-avatar" style="background:${m.color}">${initial(m.name)}</div>
        <span class="split-name">${escapeHtml(m.name)}</span>
        <input type="number" data-mid="${m.id}" value="${def}" min="0" step="0.01" placeholder="0" />
        <span class="unit">${unit}</span>
      `;
      ed.appendChild(row);
    });
  }

  document.getElementById('expSave').onclick = async () => {
    const g = activeGroup();
    if (!g) return;
    const desc = document.getElementById('expDescription').value.trim();
    const amt = parseFloat(document.getElementById('expAmount').value);
    const payerId = document.getElementById('expPayer').value;
    const date = document.getElementById('expDate').value || new Date().toISOString().slice(0, 10);
    if (!desc) { toast('请输入描述'); return; }
    if (!(amt > 0)) { toast('请输入金额'); return; }
    let splits;
    if (editingSplitType === 'equal') {
      splits = null;
    } else {
      splits = {};
      document.querySelectorAll('#splitEditor input').forEach((inp) => {
        const v = parseFloat(inp.value);
        if (v > 0) splits[inp.dataset.mid] = editingSplitType === 'exact' ? A.yuanToFen(v) : v;
      });
      if (!Object.keys(splits).length) { toast('请填写分摊'); return; }
    }
    const ng = A.addExpense(g, { description: desc, amount: amt, payerId, date, splitType: editingSplitType, splits, category: guessCategory(desc) });
    Object.assign(g, ng);
    await saveStore();
    renderAll();
    closeModal('expenseModal');
    toast('已添加账单');
  };

  function guessCategory(desc) {
    if (/住|宿|酒店|民宿|房/.test(desc)) return '住宿';
    if (/餐|饭|吃|食|菜|面|烧烤|火锅|酒/.test(desc)) return '餐饮';
    if (/车|租|油|打车|高铁|机票|地铁|公交/.test(desc)) return '交通';
    if (/票|景区|乐园|游/.test(desc)) return '门票';
    if (/买|购|商场|超市/.test(desc)) return '购物';
    return 'general';
  }

  // ---------- 工具 ----------
  function initial(name) {
    return (name || '?').trim().slice(0, 1).toUpperCase();
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  let savedTimer = null;
  function flashSaved() {
    const s = document.getElementById('syncStatus');
    if (!s) return;
    s.textContent = '已保存';
    s.style.color = 'var(--green)';
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { s.textContent = '已保存'; s.style.color = ''; }, 1500);
  }

  // ---------- 启动 ----------
  loadStore().then(() => {
    renderAll();
  });
})();
