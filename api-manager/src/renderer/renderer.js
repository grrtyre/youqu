'use strict';

// API管家 · 渲染进程逻辑

(function () {
  const api = window.api;

  // 当前编辑中的请求定义（未保存的工作区）
  let currentRequest = blankRequest();
  let currentItemId = null;       // 当前加载的集合项 id（保存时用）
  let currentCollectionId = null; // 所属集合
  let appData = null;            // 全量存储快照

  // ---------- 工具 ----------
  function blankRequest() {
    return {
      method: 'GET',
      url: '',
      params: [],
      headers: [],
      body: { type: 'none', raw: '', form: [] },
      auth: { type: 'none' }
    };
  }

  function el(id) { return document.getElementById(id); }
  function toast(msg) {
    const t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // ---------- 窗口控制 ----------
  el('winMin').onclick = () => api.winMinimize();
  el('winMax').onclick = () => api.winToggleMaximize();
  el('winClose').onclick = () => api.winClose();
  api.onMaximizeChange((v) => { /* 可扩展图标 */ });
  api.onShowAbout(() => showAbout());

  // ---------- 左侧标签切换 ----------
  document.querySelectorAll('.sidebar-tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.sidebar-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      el('paneCollections').classList.toggle('active', target === 'collections');
      el('paneHistory').classList.toggle('active', target === 'history');
      if (target === 'history') renderHistory();
    };
  });

  // ---------- 请求标签切换 ----------
  document.querySelectorAll('.req-tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.req-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.rtab;
      ['Params', 'Headers', 'Body', 'Auth'].forEach((n) => {
        el('pane' + n).classList.toggle('active', n.toLowerCase() === target);
      });
    };
  });

  // ---------- 响应标签切换 ----------
  document.querySelectorAll('.resp-tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.resp-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.rtab;
      el('respBodyPane').classList.toggle('active', target === 'body');
      el('respHeadersPane').classList.toggle('active', target === 'headers');
    };
  });

  // ---------- 方法/URL ----------
  el('methodSelect').onchange = (e) => { currentRequest.method = e.target.value; };
  el('urlInput').oninput = (e) => { currentRequest.url = e.target.value; };

  // ---------- 键值编辑器通用渲染 ----------
  function renderKV(container, list, opts) {
    opts = opts || {};
    container.innerHTML = '';
    list.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'kv-row';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'kv-check';
      check.checked = item.enabled !== false;
      check.onchange = () => { item.enabled = check.checked; updateBadges(); };
      const keyIn = document.createElement('input');
      keyIn.className = 'kv-input' + (opts.mono ? ' mono' : '');
      keyIn.value = item.key || '';
      keyIn.placeholder = opts.keyPlaceholder || '键';
      keyIn.oninput = () => { item.key = keyIn.value; updateBadges(); };
      const valIn = document.createElement('input');
      valIn.className = 'kv-input' + (opts.mono ? ' mono' : '');
      valIn.value = item.value || '';
      valIn.placeholder = opts.valPlaceholder || '值';
      valIn.oninput = () => { item.value = valIn.value; updateBadges(); };
      const del = document.createElement('button');
      del.className = 'kv-del';
      del.title = '删除';
      del.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
      del.onclick = () => { list.splice(idx, 1); renderKV(container, list, opts); updateBadges(); };
      row.append(check, keyIn, valIn, del);
      container.append(row);
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-ghost btn-sm kv-addrow';
    addBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>' + (opts.addLabel || '添加') + '</span>';
    addBtn.onclick = () => {
      list.push({ key: '', value: '', enabled: true });
      renderKV(container, list, opts);
      updateBadges();
      // 聚焦新行的键
      const rows = container.querySelectorAll('.kv-row');
      if (rows.length) rows[rows.length - 1].children[1].focus();
    };
    container.append(addBtn);
  }

  function ensureArr(arr) { return Array.isArray(arr) ? arr : []; }

  function renderParams() {
    currentRequest.params = ensureArr(currentRequest.params);
    renderKV(el('paramsEditor'), currentRequest.params, { keyPlaceholder: '参数名', valPlaceholder: '参数值', addLabel: '添加参数', mono: true });
  }
  function renderHeaders() {
    currentRequest.headers = ensureArr(currentRequest.headers);
    renderKV(el('headersEditor'), currentRequest.headers, { keyPlaceholder: 'Header 名', valPlaceholder: 'Header 值', addLabel: '添加请求头', mono: true });
  }
  function renderForm() {
    currentRequest.body.form = ensureArr(currentRequest.body.form);
    renderKV(el('formEditor'), currentRequest.body.form, { keyPlaceholder: '字段名', valPlaceholder: '字段值', addLabel: '添加字段', mono: true });
  }

  function updateBadges() {
    const pc = (currentRequest.params || []).filter((p) => p.enabled !== false && p.key).length;
    const hc = (currentRequest.headers || []).filter((h) => h.enabled !== false && h.key).length;
    el('badgeParams').textContent = pc ? String(pc) : '';
    el('badgeHeaders').textContent = hc ? String(hc) : '';
  }

  // ---------- 请求体 ----------
  el('bodyTypeSelect').onchange = (e) => {
    currentRequest.body.type = e.target.value;
    renderBody();
  };
  el('bodyTextarea').oninput = (e) => { currentRequest.body.raw = e.target.value; };

  function renderBody() {
    const t = currentRequest.body.type;
    el('bodyTypeSelect').value = t;
    const ta = el('bodyTextarea');
    const fe = el('formEditor');
    const hint = el('bodyHint');
    if (t === 'none') {
      ta.style.display = 'none'; fe.style.display = 'none'; hint.style.display = 'block';
      hint.textContent = '无请求体';
    } else if (t === 'json') {
      ta.style.display = 'block'; fe.style.display = 'none'; hint.style.display = 'none';
      ta.value = currentRequest.body.raw || '';
      ta.placeholder = '{\n  "key": "value"\n}';
    } else if (t === 'text') {
      ta.style.display = 'block'; fe.style.display = 'none'; hint.style.display = 'none';
      ta.value = currentRequest.body.raw || '';
      ta.placeholder = '纯文本内容';
    } else if (t === 'form') {
      ta.style.display = 'none'; fe.style.display = 'block'; hint.style.display = 'none';
      renderForm();
    }
  }

  // ---------- 认证 ----------
  el('authTypeSelect').onchange = (e) => {
    currentRequest.auth.type = e.target.value;
    renderAuth();
  };
  function renderAuth() {
    const t = currentRequest.auth.type || 'none';
    el('authTypeSelect').value = t;
    const area = el('authArea');
    area.innerHTML = '';
    if (t === 'none') {
      area.innerHTML = '<div class="auth-empty">该请求不使用认证</div>';
      return;
    }
    if (t === 'basic') {
      area.innerHTML =
        '<div class="auth-row"><label>用户名</label><input type="text" id="authUser" placeholder="username"></div>' +
        '<div class="auth-row"><label>密码</label><input type="password" id="authPass" placeholder="password" class="mono"></div>';
      el('authUser').value = currentRequest.auth.username || '';
      el('authPass').value = currentRequest.auth.password || '';
      el('authUser').oninput = (e) => { currentRequest.auth.username = e.target.value; };
      el('authPass').oninput = (e) => { currentRequest.auth.password = e.target.value; };
    } else if (t === 'bearer') {
      area.innerHTML =
        '<div class="auth-row"><label>Token</label><input type="text" id="authToken" placeholder="Bearer Token" class="mono"></div>';
      el('authToken').value = currentRequest.auth.token || '';
      el('authToken').oninput = (e) => { currentRequest.auth.token = e.target.value; };
    }
  }

  // ---------- 加载请求到编辑器 ----------
  function loadRequest(req, itemId, collectionId) {
    currentRequest = JSON.parse(JSON.stringify(req || blankRequest()));
    currentItemId = itemId || null;
    currentCollectionId = collectionId || null;
    el('methodSelect').value = currentRequest.method;
    el('urlInput').value = currentRequest.url;
    renderParams();
    renderHeaders();
    renderBody();
    renderAuth();
    updateBadges();
    // 高亮树
    document.querySelectorAll('.tree-row').forEach((r) => r.classList.remove('active'));
    if (itemId) {
      const node = document.querySelector('[data-item-id="' + itemId + '"]');
      if (node) node.classList.add('active');
    }
  }

  // ---------- 集合树渲染 ----------
  function renderTree() {
    const list = el('treeList');
    list.innerHTML = '';
    if (!appData || !appData.collections.length) {
      list.innerHTML = '<li style="padding:14px;color:var(--text-tertiary);font-size:12.5px;text-align:center">暂无集合，点击上方新建</li>';
      return;
    }
    appData.collections.forEach((col) => {
      const li = document.createElement('li');
      li.className = 'tree-node';
      const row = document.createElement('div');
      row.className = 'tree-row';
      row.innerHTML =
        '<svg class="tree-toggle" width="10" height="10" viewBox="0 0 10 10"><path d="M2 3 L5 7 L8 3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<svg class="tree-icon" width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 4.5C1.5 3.4 2.4 2.5 3.5 2.5h2.5l1.2 1.5h3.3c1.1 0 2 .9 2 2v4.5c0 1.1-.9 2-2 2h-7c-1.1 0-2-.9-2-2v-6z" fill="#007aff" opacity="0.85"/></svg>' +
        '<span class="tree-label"></span>' +
        '<span class="tree-actions">' +
          '<button class="tree-action" title="新建请求" data-act="addreq"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>' +
          '<button class="tree-action" title="新建文件夹" data-act="addfolder"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1.5 3.5C1.5 2.7 2.2 2 3 2h2l1 1.2h3c.8 0 1.5.7 1.5 1.5v3.3c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5V3.5z" fill="none" stroke="currentColor" stroke-width="1"/></svg></button>' +
          '<button class="tree-action" title="删除集合" data-act="delcol"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>' +
        '</span>';
      row.querySelector('.tree-label').textContent = col.name;
      row.querySelector('.tree-toggle').onclick = (e) => { e.stopPropagation(); li.classList.toggle('collapsed'); };
      row.querySelector('[data-act="addreq"]').onclick = (e) => { e.stopPropagation(); newRequestInCollection(col.id, null); };
      row.querySelector('[data-act="addfolder"]').onclick = (e) => { e.stopPropagation(); newFolder(col.id); };
      row.querySelector('[data-act="delcol"]').onclick = (e) => { e.stopPropagation(); deleteCollection(col.id, col.name); };
      list.append(li);

      const ul = document.createElement('ul');
      ul.className = 'tree-children';
      ul.style.listStyle = 'none';
      renderItems(ul, col.items, col.id);
      li.append(ul);
    });
  }

  function renderItems(container, items, collectionId, parentId) {
    items.forEach((it) => {
      const li = document.createElement('li');
      li.className = 'tree-node';
      if (it.type === 'folder') {
        const row = document.createElement('div');
        row.className = 'tree-row';
        row.innerHTML =
          '<svg class="tree-toggle" width="10" height="10" viewBox="0 0 10 10"><path d="M2 3 L5 7 L8 3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<svg class="tree-icon" width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 4.5C1.5 3.4 2.4 2.5 3.5 2.5h2.5l1.2 1.5h3.3c1.1 0 2 .9 2 2v4.5c0 1.1-.9 2-2 2h-7c-1.1 0-2-.9-2-2v-6z" fill="#a1a1a6"/></svg>' +
          '<span class="tree-label"></span>' +
          '<span class="tree-actions">' +
            '<button class="tree-action" title="新建请求" data-act="addreq"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>' +
            '<button class="tree-action" title="删除文件夹" data-act="delfolder"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>' +
          '</span>';
        row.querySelector('.tree-label').textContent = it.name;
        row.querySelector('.tree-toggle').onclick = (e) => { e.stopPropagation(); li.classList.toggle('collapsed'); };
        row.querySelector('[data-act="addreq"]').onclick = (e) => { e.stopPropagation(); newRequestInCollection(collectionId, it.id); };
        row.querySelector('[data-act="delfolder"]').onclick = (e) => { e.stopPropagation(); deleteItem(collectionId, it.id, it.name); };
        container.append(li);
        const ul = document.createElement('ul');
        ul.className = 'tree-children';
        ul.style.listStyle = 'none';
        renderItems(ul, it.items || [], collectionId, it.id);
        li.append(ul);
      } else {
        const row = document.createElement('div');
        row.className = 'tree-row';
        row.dataset.itemId = it.id;
        const m = (it.request && it.request.method) || 'GET';
        row.innerHTML =
          '<span style="width:12px;flex-shrink:0"></span>' +
          '<span class="method-tag m-' + m + '">' + m + '</span>' +
          '<span class="tree-label"></span>' +
          '<span class="tree-actions">' +
            '<button class="tree-action" title="删除请求" data-act="delreq"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>' +
          '</span>';
        row.querySelector('.tree-label').textContent = it.name;
        row.onclick = () => loadRequest(it.request, it.id, collectionId);
        row.querySelector('[data-act="delreq"]').onclick = (e) => { e.stopPropagation(); deleteItem(collectionId, it.id, it.name); };
        container.append(li);
      }
    });
  }

  // ---------- 集合操作 ----------
  el('newCollectionBtn').onclick = async () => {
    const name = prompt('集合名称：', '新集合');
    if (!name) return;
    await api.collectionAdd(name);
    await refreshData();
    renderTree();
    toast('已新建集合');
  };

  async function newRequestInCollection(colId, parentId) {
    const name = prompt('请求名称：', '新请求');
    if (!name) return;
    const item = await api.itemAdd(colId, parentId, { name: name, request: blankRequest() });
    await refreshData();
    renderTree();
    if (item) loadRequest(item.request, item.id, colId);
    toast('已新建请求');
  }

  async function newFolder(colId) {
    const name = prompt('文件夹名称：', '新文件夹');
    if (!name) return;
    await api.folderAdd(colId, name);
    await refreshData();
    renderTree();
  }

  async function deleteCollection(colId, name) {
    if (!confirm('确认删除集合「' + name + '」？其中的请求将一并删除。')) return;
    await api.collectionDelete(colId);
    await refreshData();
    renderTree();
    toast('已删除集合');
  }

  async function deleteItem(colId, itemId, name) {
    if (!confirm('确认删除「' + name + '」？')) return;
    await api.itemDelete(colId, itemId);
    await refreshData();
    renderTree();
    if (currentItemId === itemId) {
      loadRequest(blankRequest(), null, null);
    }
    toast('已删除');
  }

  // ---------- 历史 ----------
  async function renderHistory() {
    await refreshData();
    const list = el('historyList');
    list.innerHTML = '';
    if (!appData.history.length) {
      list.innerHTML = '<li style="padding:14px;color:var(--text-tertiary);font-size:12.5px;text-align:center">暂无历史记录</li>';
      return;
    }
    appData.history.forEach((h) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      const sc = h.status || 0;
      let scCls = '';
      if (sc >= 200 && sc < 300) scCls = 's2';
      else if (sc >= 300 && sc < 400) scCls = 's3';
      else if (sc >= 400 && sc < 500) scCls = 's4';
      else if (sc >= 500) scCls = 's5';
      li.innerHTML =
        '<div class="hi-top">' +
          '<span class="method-tag m-' + (h.method || 'GET') + '">' + (h.method || 'GET') + '</span>' +
          '<span class="meta-chip status ' + scCls + '">' + (h.status || '—') + '</span>' +
          '<span class="hi-time">' + fmtTime(h.time) + '</span>' +
        '</div>' +
        '<div class="hi-url"></div>';
      li.querySelector('.hi-url').textContent = h.url;
      li.onclick = () => {
        // 从历史加载：构建一个请求（仅方法+url，便于重发）
        loadRequest({ method: h.method, url: h.url, params: [], headers: [], body: { type: 'none', raw: '', form: [] }, auth: { type: 'none' } }, null, null);
        toast('已从历史加载（仅 URL 与方法）');
      };
      list.append(li);
    });
  }

  el('clearHistoryBtn').onclick = async () => {
    if (!confirm('确认清空全部历史记录？')) return;
    await api.historyClear();
    renderHistory();
    toast('已清空历史');
  };

  // ---------- 保存对话框 ----------
  el('saveBtn').onclick = async () => {
    await refreshData();
    const sel = el('saveTarget');
    sel.innerHTML = '';
    appData.collections.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.append(opt);
    });
    if (currentCollectionId) sel.value = currentCollectionId;
    el('saveName').value = currentRequest.url ? deriveName(currentRequest.url) : '新请求';
    el('saveModal').style.display = 'flex';
    el('saveName').focus();
  };
  el('saveCancel').onclick = () => { el('saveModal').style.display = 'none'; };
  el('saveConfirm').onclick = async () => {
    const name = el('saveName').value.trim() || '未命名请求';
    const colId = el('saveTarget').value;
    if (!colId) { toast('请选择集合'); return; }
    if (currentItemId) {
      await api.itemUpdate(colId, currentItemId, { name: name, request: currentRequest });
    } else {
      const item = await api.itemAdd(colId, null, { name: name, request: currentRequest });
      currentItemId = item ? item.id : null;
      currentCollectionId = colId;
    }
    el('saveModal').style.display = 'none';
    await refreshData();
    renderTree();
    toast('已保存');
  };

  function deriveName(url) {
    try {
      const u = new URL(/^https?:\/\//i.test(url) ? url : 'http://' + url);
      const seg = u.pathname.split('/').filter(Boolean).pop();
      return seg ? decodeURIComponent(seg) : u.hostname;
    } catch (e) {
      return '请求';
    }
  }

  // ---------- 环境变量对话框 ----------
  let envEditing = null;
  el('envBtn').onclick = async () => {
    await refreshData();
    renderEnvSelect();
    el('envModal').style.display = 'flex';
  };
  el('envClose').onclick = () => { el('envModal').style.display = 'none'; };
  el('envSelect').onchange = () => renderEnvEditor();
  el('envNewBtn').onclick = async () => {
    const name = prompt('环境名称：', '新环境');
    if (!name) return;
    const env = await api.envSave({ id: 'env_' + Date.now().toString(36), name: name, variables: [] });
    await refreshData();
    renderEnvSelect();
    el('envSelect').value = env.id;
    renderEnvEditor();
  };
  el('envRenameBtn').onclick = async () => {
    const id = el('envSelect').value;
    const env = appData.env.environments.find((e) => e.id === id);
    if (!env) return;
    const name = prompt('重命名环境：', env.name);
    if (!name) return;
    env.name = name;
    await api.envSave(env);
    await refreshData();
    renderEnvSelect();
    el('envSelect').value = id;
    renderEnvEditor();
  };
  el('envDeleteBtn').onclick = async () => {
    const id = el('envSelect').value;
    if (appData.env.environments.length <= 1) { toast('至少保留一个环境'); return; }
    if (!confirm('确认删除该环境？')) return;
    await api.envDelete(id);
    await refreshData();
    renderEnvSelect();
    renderEnvEditor();
  };
  el('envUseBtn').onclick = async () => {
    const id = el('envSelect').value;
    await api.envSetActive(id);
    await refreshData();
    renderEnvSelect();
    toast('已切换为当前环境');
  };

  function renderEnvSelect() {
    const sel = el('envSelect');
    sel.innerHTML = '';
    appData.env.environments.forEach((e) => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.name + (e.id === appData.env.active ? ' · 当前' : '');
      sel.append(opt);
    });
    sel.value = appData.env.active;
    renderEnvEditor();
  }

  function renderEnvEditor() {
    const id = el('envSelect').value;
    const env = appData.env.environments.find((e) => e.id === id);
    if (!env) { el('envEditor').innerHTML = ''; return; }
    envEditing = env;
    // 确保变量数组
    if (!Array.isArray(env.variables)) env.variables = [];
    renderKV(el('envEditor'), env.variables, { keyPlaceholder: '变量名', valPlaceholder: '变量值', addLabel: '添加变量', mono: true });
    // 给变量输入绑定即时保存
    el('envEditor').querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('change', saveEnv);
    });
    el('envEditor').querySelector('.kv-del') && el('envEditor').querySelectorAll('.kv-del').forEach((b) => b.addEventListener('click', () => setTimeout(saveEnv, 50)));
    el('envEditor').querySelector('.kv-addrow') && el('envEditor').querySelector('.kv-addrow').addEventListener('click', () => setTimeout(saveEnvAndRerender, 50));
  }

  function saveEnvAndRerender() {
    if (!envEditing) return;
    api.envSave(envEditing).then(() => {
      refreshData().then(() => renderEnvEditor());
    });
  }
  function saveEnv() {
    if (!envEditing) return;
    api.envSave(envEditing);
  }

  // ---------- 发送请求 ----------
  let sending = false;
  el('sendBtn').onclick = doSend;

  async function doSend() {
    if (sending) return;
    if (!currentRequest.url.trim()) { toast('请输入 URL'); return; }
    sending = true;
    const btn = el('sendBtn');
    btn.disabled = true;
    btn.querySelector('span').textContent = '发送中…';
    // 占位
    el('responseMeta').innerHTML = '<span class="meta-empty">请求中…</span>';
    el('respEmpty').style.display = 'none';
    el('respPre').style.display = 'none';

    const result = await api.requestSend(currentRequest);
    sending = false;
    btn.disabled = false;
    btn.querySelector('span').textContent = '发送';

    if (!result.ok) {
      el('responseMeta').innerHTML = '<span class="meta-chip s5">错误</span>';
      el('respEmpty').style.display = 'none';
      const pre = el('respPre');
      pre.style.display = 'block';
      pre.className = 'resp-pre resp-error';
      pre.textContent = '✗ ' + (result.error || '请求失败');
      return;
    }
    // 元信息
    const sc = result.status;
    let scCls = 's2';
    if (sc >= 300 && sc < 400) scCls = 's3';
    else if (sc >= 400 && sc < 500) scCls = 's4';
    else if (sc >= 500) scCls = 's5';
    const sizeText = result.size > 1024 ? (result.size / 1024).toFixed(2) + ' KB' : result.size + ' B';
    el('responseMeta').innerHTML =
      '<span class="meta-chip status ' + scCls + '">' + sc + ' ' + esc(result.statusText || '') + '</span>' +
      '<span class="meta-chip">' + (result.time) + ' ms</span>' +
      '<span class="meta-chip">' + sizeText + '</span>';

    // 响应体
    if (result.body) {
      el('respEmpty').style.display = 'none';
      renderResponseBody(result.body);
    } else {
      pre.style.display = 'none';
      el('respEmpty').style.display = 'flex';
      el('respEmpty').querySelector('p').textContent = '响应为空';
    }
    // 响应头
    const hh = el('respHeaders');
    hh.innerHTML = '';
    const hdrs = result.headers || {};
    const keys = Object.keys(hdrs);
    if (!keys.length) {
      hh.innerHTML = '<div style="padding:14px;color:var(--text-tertiary);font-size:12.5px">无响应头</div>';
    } else {
      keys.forEach((k) => {
        const row = document.createElement('div');
        row.className = 'rh-row';
        row.innerHTML = '<div class="rh-key"></div><div class="rh-val"></div>';
        row.querySelector('.rh-key').textContent = k;
        row.querySelector('.rh-val').textContent = hdrs[k];
        hh.append(row);
      });
    }
    // 刷新历史（如果历史标签可见）
    if (el('paneHistory').classList.contains('active')) renderHistory();
  }

  // Ctrl+Enter 发送
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      doSend();
    }
  });

  // ---------- 关于 ----------
  async function showAbout() {
    const info = await api.appInfo();
    el('aboutVersion').textContent = 'v' + info.version;
    el('aboutAfdian').onclick = () => api.openExternal(info.afdian);
    el('aboutModal').style.display = 'flex';
  }
  el('aboutClose').onclick = () => { el('aboutModal').style.display = 'none'; };

  // ---------- 数据刷新 ----------
  async function refreshData() {
    appData = await api.storeAll();
    return appData;
  }

  // ---------- JSON 语法高亮 ----------
  function syntaxHighlightJSON(jsonStr) {
    const escaped = esc(jsonStr);
    return escaped.replace(/("(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'json-num';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) cls = 'json-key';
        else cls = 'json-str';
      } else if (/^(true|false)$/.test(match)) cls = 'json-bool';
      else if (match === 'null') cls = 'json-null';
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }

  function renderResponseBody(text) {
    const pre = el('respPre');
    pre.style.display = 'block';
    pre.className = 'resp-pre';
    // 尝试 JSON 高亮
    try {
      const parsed = JSON.parse(text);
      const formatted = JSON.stringify(parsed, null, 2);
      pre.innerHTML = syntaxHighlightJSON(formatted);
    } catch (e) {
      pre.textContent = text;
    }
  }

  // ---------- 显示示例响应（让初始界面不空旷） ----------
  function showDemoResponse() {
    const sc = 200;
    const scCls = 's2';
    el('responseMeta').innerHTML =
      '<span class="meta-chip status ' + scCls + '">' + sc + ' OK</span>' +
      '<span class="meta-chip">128 ms</span>' +
      '<span class="meta-chip">186 B</span>';
    el('respEmpty').style.display = 'none';
    renderResponseBody('{\n  "origin": "203.0.113.42",\n  "url": "https://httpbin.org/ip",\n  "method": "GET",\n  "headers": {\n    "Host": "httpbin.org",\n    "User-Agent": "API-Guanjia/1.0",\n    "Accept": "application/json"\n  },\n  "duration_ms": 128\n}');
    // 示例响应头
    const hh = el('respHeaders');
    hh.innerHTML = '';
    const demoHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': '186',
      'Server': 'gunicorn/19.9.0',
      'Date': 'Fri, 11 Jul 2026 03:48:00 GMT',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Connection': 'keep-alive'
    };
    Object.keys(demoHeaders).forEach((k) => {
      const row = document.createElement('div');
      row.className = 'rh-row';
      row.innerHTML = '<div class="rh-key"></div><div class="rh-val"></div>';
      row.querySelector('.rh-key').textContent = k;
      row.querySelector('.rh-val').textContent = demoHeaders[k];
      hh.append(row);
    });
  }

  // ---------- 初始化 ----------
  async function init() {
    await refreshData();
    renderTree();
    // 自动加载第一个集合的第一个请求，避免初始界面空旷
    let loaded = false;
    if (appData.collections && appData.collections.length) {
      const col = appData.collections[0];
      const firstReq = (col.items || []).find((it) => it.type !== 'folder');
      if (firstReq) {
        loadRequest(firstReq.request, firstReq.id, col.id);
        loaded = true;
      }
    }
    if (!loaded) loadRequest(blankRequest(), null, null);
    // 显示示例响应，让响应区有内容
    showDemoResponse();
    // 通知主进程渲染就绪（供截图脚本等待）
    try { console.log('__READY__'); } catch (e) {}
  }

  init();
})();
