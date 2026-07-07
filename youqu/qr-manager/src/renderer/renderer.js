// src/renderer/renderer.js — 二维码管家渲染层逻辑
// 模板拼装（与 core/template.js 保持一致，渲染层内联以支持实时预览）
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ============ 模板拼装（与主进程 core/template.js 一致）============
  const esc = (s) => String(s).replace(/([\\;,:"'])/g, '\\$1');
  function buildWiFi({ ssid, password = '', encryption = 'WPA', hidden = false }) {
    if (!ssid) return null;
    const pwd = encryption === 'nopass' ? '' : esc(password);
    return `WIFI:T:${encryption};S:${esc(ssid)};P:${pwd};H:${hidden ? 'true' : 'false'};;`;
  }
  function buildVCard({ firstName = '', lastName = '', phone = '', email = '', org = '', title = '', url = '', address = '' }) {
    const lines = [
      'BEGIN:VCARD', 'VERSION:3.0',
      `N:${lastName};${firstName};;`,
      `FN:${[firstName, lastName].filter(Boolean).join(' ')}`,
      org ? `ORG:${org}` : null,
      title ? `TITLE:${title}` : null,
      phone ? `TEL;TYPE=CELL:${phone}` : null,
      email ? `EMAIL:${email}` : null,
      url ? `URL:${url}` : null,
      address ? `ADR:;;${address}` : null,
      'END:VCARD'
    ].filter(Boolean);
    return lines.join('\n');
  }
  function buildEmail({ to, subject = '', body = '' }) {
    if (!to) return null;
    const params = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    return `mailto:${to}${params.length ? '?' + params.join('&') : ''}`;
  }
  function buildSMS({ phone, message = '' }) {
    if (!phone) return null;
    return message ? `SMSTO:${phone}:${message}` : `SMSTO:${phone}`;
  }
  function buildPhone({ phone }) { return phone ? `tel:${phone}` : null; }
  function buildURL({ url }) {
    if (!url) return null;
    const u = String(url).trim();
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) return u;
    return `https://${u}`;
  }
  function buildText({ text }) { return text ? String(text) : null; }
  function buildContent(type, fields) {
    switch (type) {
      case 'text': return buildText(fields);
      case 'url': return buildURL(fields);
      case 'wifi': return buildWiFi(fields);
      case 'vcard': return buildVCard(fields);
      case 'email': return buildEmail(fields);
      case 'sms': return buildSMS(fields);
      case 'phone': return buildPhone(fields);
      default: return null;
    }
  }
  function parseContent(raw) {
    const r = String(raw);
    if (r.startsWith('WIFI:')) {
      const m = r.match(/^WIFI:T:([^;]*);S:([^;]*);P:([^;]*);H:([^;]*);;/);
      if (m) return { type: 'wifi', label: 'WiFi', fields: { ssid: m[2], password: m[3], encryption: m[1] || 'WPA', hidden: m[4] === 'true' }, raw: r };
    }
    if (r.startsWith('BEGIN:VCARD')) return { type: 'vcard', label: '名片', fields: {}, raw: r };
    if (r.startsWith('mailto:')) return { type: 'email', label: '邮箱', fields: {}, raw: r };
    if (r.startsWith('SMSTO:')) return { type: 'sms', label: '短信', fields: {}, raw: r };
    if (r.startsWith('tel:')) return { type: 'phone', label: '电话', fields: {}, raw: r };
    if (/^https?:\/\//i.test(r)) return { type: 'url', label: '网址', fields: {}, raw: r };
    return { type: 'text', label: '文本', fields: {}, raw: r };
  }

  // ============ 字段定义 ============
  const TYPE_LABEL = { text: '文本', url: '网址', wifi: 'WiFi', vcard: '名片', email: '邮箱', sms: '短信', phone: '电话' };
  const FIELD_DEFS = {
    text: [{ key: 'text', label: '文本内容', type: 'textarea', placeholder: '输入任意文本…', required: true }],
    url: [{ key: 'url', label: '网址', type: 'input', placeholder: 'example.com 或 https://…', required: true }],
    wifi: [
      { key: 'ssid', label: 'WiFi 名称', type: 'input', placeholder: 'MyWiFi', required: true },
      { key: 'password', label: '密码', type: 'input', placeholder: 'password' },
      { key: 'encryption', label: '加密方式', type: 'select', options: [['WPA', 'WPA/WPA2'], ['WEP', 'WEP'], ['nopass', '无密码']], required: true },
      { key: 'hidden', label: '隐藏网络', type: 'checkbox' }
    ],
    vcard: [
      { row: true, items: [
        { key: 'lastName', label: '姓', type: 'input', placeholder: '张' },
        { key: 'firstName', label: '名', type: 'input', placeholder: '三' }
      ]},
      { row: true, items: [
        { key: 'phone', label: '电话', type: 'input', placeholder: '13800000000' },
        { key: 'email', label: '邮箱', type: 'input', placeholder: 'a@b.com' }
      ]},
      { row: true, items: [
        { key: 'org', label: '公司', type: 'input', placeholder: '公司' },
        { key: 'title', label: '职位', type: 'input', placeholder: '职位' }
      ]},
      { key: 'url', label: '网址', type: 'input', placeholder: 'https://' }
    ],
    email: [
      { key: 'to', label: '收件人', type: 'input', placeholder: 'a@b.com', required: true },
      { key: 'subject', label: '主题', type: 'input', placeholder: '邮件主题' },
      { key: 'body', label: '正文', type: 'textarea', placeholder: '邮件正文…' }
    ],
    sms: [
      { key: 'phone', label: '电话', type: 'input', placeholder: '13800000000', required: true },
      { key: 'message', label: '短信内容', type: 'textarea', placeholder: '短信内容…' }
    ],
    phone: [{ key: 'phone', label: '电话', type: 'input', placeholder: '13800000000', required: true }]
  };

  // ============ 状态 ============
  const state = {
    type: 'text',
    fields: {},
    dark: '#000000',
    light: '#ffffff',
    ecl: 'M',
    size: 480,
    margin: 4,
    currentDataURL: null,
    currentContent: null
  };

  // ============ Toast ============
  let toastTimer = null;
  function toast(msg, kind = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast ' + kind; }, 2200);
  }

  // ============ 渲染表单 ============
  function renderForm() {
    const wrap = $('#formFields');
    wrap.innerHTML = '';
    const defs = FIELD_DEFS[state.type] || [];
    defs.forEach(def => {
      if (def.row) {
        const row = document.createElement('div');
        row.className = 'field-row';
        def.items.forEach(it => row.appendChild(makeField(it)));
        wrap.appendChild(row);
      } else {
        wrap.appendChild(makeField(def));
      }
    });
  }
  function makeField(def) {
    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = 'f-' + def.key;
    label.textContent = def.label + (def.required ? ' *' : '');
    field.appendChild(label);
    let input;
    if (def.type === 'textarea') {
      input = document.createElement('textarea');
      input.placeholder = def.placeholder || '';
    } else if (def.type === 'select') {
      input = document.createElement('select');
      def.options.forEach(([v, t]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = t;
        input.appendChild(o);
      });
    } else if (def.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'f-' + def.key;
      input.checked = !!state.fields[def.key];
      input.addEventListener('change', () => {
        state.fields[def.key] = input.checked;
        scheduleGenerate();
      });
      field.appendChild(input);
      // 复选框特殊：让 label 可点击切换
      label.setAttribute('for', 'f-' + def.key);
      label.style.cursor = 'pointer';
      return field;
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.placeholder = def.placeholder || '';
    }
    input.id = 'f-' + def.key;
    input.value = state.fields[def.key] != null ? state.fields[def.key] : (def.type === 'select' ? def.options[0][0] : '');
    if (def.type === 'select') {
      input.addEventListener('change', () => {
        state.fields[def.key] = input.value;
        scheduleGenerate();
      });
    } else {
      input.addEventListener('input', () => {
        state.fields[def.key] = input.value;
        scheduleGenerate();
      });
    }
    field.appendChild(input);
    return field;
  }

  // ============ 实时生成 ============
  let genTimer = null;
  function scheduleGenerate() {
    clearTimeout(genTimer);
    genTimer = setTimeout(generate, 250);
  }
  async function generate() {
    const content = buildContent(state.type, state.fields);
    state.currentContent = content;
    if (!content) {
      $('#qrEmpty').classList.remove('hidden');
      $('#qrImage').classList.add('hidden');
      $('#btnSavePNG').disabled = true;
      $('#btnSaveSVG').disabled = true;
      $('#btnCopy').disabled = true;
      $('#btnFav').disabled = true;
      $('#previewMeta').textContent = '';
      state.currentDataURL = null;
      return;
    }
    const opts = {
      errorCorrectionLevel: state.ecl,
      margin: state.margin,
      width: state.size,
      dark: state.dark,
      light: state.light
    };
    const res = await window.api.generate(content, opts);
    if (!res.ok) {
      $('#previewMeta').textContent = '生成失败：' + res.error;
      return;
    }
    state.currentDataURL = res.dataURL;
    const img = $('#qrImage');
    img.src = res.dataURL;
    img.classList.remove('hidden');
    $('#qrEmpty').classList.add('hidden');
    $('#btnSavePNG').disabled = false;
    $('#btnSaveSVG').disabled = false;
    $('#btnCopy').disabled = false;
    $('#btnFav').disabled = false;
    const meta = $('#previewMeta');
    meta.innerHTML = '<span class="meta-tag"></span><span class="meta-content"></span>';
    meta.querySelector('.meta-tag').textContent = `${TYPE_LABEL[state.type]} · ${content.length} 字符 · ${state.ecl} 容错`;
    meta.querySelector('.meta-content').textContent = content;
  }

  // ============ 事件绑定 ============
  function bindTypeGrid() {
    $$('#typeGrid .type-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        $$('#typeGrid .type-cell').forEach(c => c.classList.remove('active'));
        cell.classList.add('active');
        state.type = cell.dataset.type;
        state.fields = {};
        renderForm();
        scheduleGenerate();
      });
    });
  }
  function bindStyleControls() {
    const dark = $('#darkColor'), darkT = $('#darkColorText');
    const light = $('#lightColor'), lightT = $('#lightColorText');
    dark.addEventListener('input', () => { darkT.value = dark.value; state.dark = dark.value; scheduleGenerate(); });
    darkT.addEventListener('input', () => {
      const v = darkT.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { dark.value = v; state.dark = v; scheduleGenerate(); }
    });
    light.addEventListener('input', () => { lightT.value = light.value; state.light = light.value; scheduleGenerate(); });
    lightT.addEventListener('input', () => {
      const v = lightT.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { light.value = v; state.light = v; scheduleGenerate(); }
    });
    $$('#eclGroup .seg').forEach(b => {
      b.addEventListener('click', () => {
        $$('#eclGroup .seg').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        state.ecl = b.dataset.ecl;
        scheduleGenerate();
      });
    });
    const sizeR = $('#sizeRange'), sizeV = $('#sizeVal');
    const updateSizePct = () => { const p = (sizeR.value - sizeR.min) / (sizeR.max - sizeR.min) * 100; sizeR.style.setProperty('--pct', p + '%'); };
    sizeR.addEventListener('input', () => { sizeV.textContent = sizeR.value; state.size = +sizeR.value; updateSizePct(); scheduleGenerate(); });
    updateSizePct();
    const marginR = $('#marginRange'), marginV = $('#marginVal');
    const updateMarginPct = () => { const p = (marginR.value - marginR.min) / (marginR.max - marginR.min) * 100; marginR.style.setProperty('--pct', p + '%'); };
    marginR.addEventListener('input', () => { marginV.textContent = marginR.value; state.margin = +marginR.value; updateMarginPct(); scheduleGenerate(); });
    updateMarginPct();
  }
  function bindPreviewActions() {
    $('#btnSavePNG').addEventListener('click', async () => {
      if (!state.currentDataURL) return;
      const name = `二维码_${TYPE_LABEL[state.type]}_${Date.now()}.png`;
      const r = await window.api.savePNG(state.currentDataURL, name);
      if (r.ok) { toast('已保存到 ' + r.path, 'success'); addHistory('generate'); }
      else if (r.error) toast('保存失败：' + r.error, 'error');
    });
    $('#btnSaveSVG').addEventListener('click', async () => {
      if (!state.currentContent) return;
      const svg = await window.api.generateSVG(state.currentContent, {
        errorCorrectionLevel: state.ecl, margin: state.margin,
        dark: state.dark, light: state.light
      });
      if (!svg.ok) { toast('生成 SVG 失败：' + svg.error, 'error'); return; }
      const name = `二维码_${TYPE_LABEL[state.type]}_${Date.now()}.svg`;
      const r = await window.api.saveSVG(svg.svg, name);
      if (r.ok) toast('已保存到 ' + r.path, 'success');
      else if (r.error) toast('保存失败：' + r.error, 'error');
    });
    $('#btnCopy').addEventListener('click', async () => {
      if (!state.currentDataURL) return;
      const r = await window.api.copyImage(state.currentDataURL);
      if (r.ok) toast('已复制到剪贴板', 'success');
      else toast('复制失败：' + (r.error || ''), 'error');
    });
    $('#btnFav').addEventListener('click', async () => {
      if (!state.currentContent) return;
      const r = await window.api.favAdd({
        type: state.type,
        label: TYPE_LABEL[state.type],
        content: state.currentContent,
        dataURL: state.currentDataURL,
        fields: { ...state.fields }
      });
      if (r.ok) toast('已加入收藏', 'success');
    });
  }

  // ============ 历史 / 收藏 ============
  async function addHistory(action) {
    if (!state.currentContent) return;
    await window.api.historyAdd({
      action,
      type: state.type,
      label: TYPE_LABEL[state.type],
      content: state.currentContent,
      dataURL: state.currentDataURL
    });
  }
  async function renderHistory() {
    const list = await window.api.historyGet();
    const wrap = $('#historyList');
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state"><p>暂无历史记录</p></div>';
      return;
    }
    wrap.innerHTML = '';
    list.forEach(item => {
      wrap.appendChild(makeListItem(item, false));
    });
  }
  async function renderFav() {
    const list = await window.api.favGet();
    const wrap = $('#favList');
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state"><p>暂无收藏</p></div>';
      return;
    }
    wrap.innerHTML = '';
    list.forEach(item => {
      wrap.appendChild(makeListItem(item, true));
    });
  }
  function makeListItem(item, isFav) {
    const el = document.createElement('div');
    el.className = 'list-item';
    const time = new Date(item.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const tag = item.label || TYPE_LABEL[item.type] || '文本';
    const action = item.action === 'decode' ? '识别' : '生成';
    const thumb = item.dataURL
      ? `<img src="${item.dataURL}" alt="">`
      : `<div class="ph">${action}</div>`;
    el.innerHTML = `
      <div class="list-thumb">${thumb}</div>
      <div class="list-main">
        <div class="list-title"><span class="list-tag">${tag}</span>${escapeHtml(item.content || '')}</div>
        <div class="list-sub">${action} · ${time}</div>
      </div>
      <div class="list-actions">
        <button class="icon-btn" data-act="copy" title="复制内容">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="icon-btn" data-act="use" title="填入生成">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        ${isFav ? `<button class="icon-btn danger" data-act="del" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>` : ''}
      </div>
    `;
    el.querySelector('[data-act="copy"]').addEventListener('click', async () => {
      await window.api.copyText(item.content);
      toast('已复制内容', 'success');
    });
    el.querySelector('[data-act="use"]').addEventListener('click', () => {
      fillFromItem(item);
      switchView('generate');
    });
    if (isFav) {
      el.querySelector('[data-act="del"]').addEventListener('click', async () => {
        await window.api.favRemove(item.id);
        renderFav();
        toast('已删除', 'success');
      });
    }
    return el;
  }
  function fillFromItem(item) {
    // 简化：切到文本类型，填入 content
    state.type = 'text';
    state.fields = { text: item.content };
    $$('#typeGrid .type-cell').forEach(c => c.classList.toggle('active', c.dataset.type === 'text'));
    renderForm();
    scheduleGenerate();
  }

  // ============ 识别 ============
  function bindDecode() {
    $('#btnPickImage').addEventListener('click', async () => {
      const r = await window.api.pickImage();
      handleDecodeResult(r, '图片识别');
    });
    $('#btnScreen').addEventListener('click', async () => {
      toast('正在截屏识别…');
      const r = await window.api.decodeScreen();
      handleDecodeResult(r, '截屏识别');
    });
    // 拖拽
    const dz = $('#dropzone');
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); }));
    dz.addEventListener('drop', async (e) => {
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const r = await window.api.decodeNative(reader.result);
        handleDecodeResult(r, '拖拽识别');
      };
      reader.readAsDataURL(file);
    });
  }
  async function handleDecodeResult(r, source) {
    if (!r.ok) {
      $('#resultEmpty').classList.remove('hidden');
      $('#resultBody').classList.add('hidden');
      toast(r.error || '识别失败', 'error');
      return;
    }
    const parsed = parseContent(r.data);
    $('#resultEmpty').classList.add('hidden');
    $('#resultBody').classList.remove('hidden');
    $('#resultType').textContent = parsed.label + ' · ' + source;
    $('#resultText').textContent = r.data;
    // 写入历史
    await window.api.historyAdd({
      action: 'decode',
      type: parsed.type,
      label: parsed.label,
      content: r.data,
      dataURL: null
    });
    // 链接类型提供打开
    const openBtn = $('#btnOpenResult');
    if (/^https?:\/\//.test(r.data)) {
      openBtn.classList.remove('hidden');
      openBtn.onclick = () => window.api.openExternal(r.data);
    } else {
      openBtn.classList.add('hidden');
    }
    $('#btnCopyResult').onclick = async () => { await window.api.copyText(r.data); toast('已复制', 'success'); };
    $('#btnResultToFav').onclick = async () => {
      await window.api.favAdd({ type: parsed.type, label: parsed.label, content: r.data, dataURL: null, fields: {} });
      toast('已加入收藏', 'success');
    };
    toast('识别成功', 'success');
  }

  // ============ 视图切换 ============
  function switchView(name) {
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view-' + name).classList.add('active');
    if (name === 'history') renderHistory();
    if (name === 'favorites') renderFav();
  }
  function bindNav() {
    $$('.nav-item').forEach(n => n.addEventListener('click', () => switchView(n.dataset.view)));
  }

  // ============ 工具 ============
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ============ 清空按钮 ============
  function bindClear() {
    $('#btnClearHistory').addEventListener('click', async () => {
      await window.api.historyClear();
      renderHistory();
      toast('历史已清空', 'success');
    });
    $('#btnClearFav').addEventListener('click', async () => {
      await window.api.favClear();
      renderFav();
      toast('收藏已清空', 'success');
    });
  }

  // ============ 窗口控制 ============
  function bindWindow() {
    $('#btnMin').addEventListener('click', () => window.api.winMin());
    $('#btnClose').addEventListener('click', () => window.api.winClose());
  }

  // ============ 初始化 ============
  function init() {
    bindWindow();
    bindNav();
    bindTypeGrid();
    bindStyleControls();
    bindPreviewActions();
    bindDecode();
    bindClear();
    // 默认填充示例内容，避免预览区空白
    state.fields = { text: 'https://github.com/grrtyre/youqu' };
    renderForm();
    generate();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
