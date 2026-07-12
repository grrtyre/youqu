'use strict';
// JSON管家 - 渲染进程交互
// 苹果白高端风格 UI + 工具切换 + 实时处理

const appApi = window['api'];
const core = appApi.core;


// 共享状态：当前 JSON 输入文本（所有工具共用，切换工具时同步）
let sharedInput = '';
let currentTool = 'format';

// 示例数据（首次启动展示，足够丰富以展示工具能力）
const SAMPLE = `{
  "project": "JSON管家",
  "version": "1.0.0",
  "description": "苹果白风格的 JSON 深度处理工具",
  "author": {
    "name": "youqu",
    "email": "youqu@example.com",
    "social": {
      "github": "grrtyre",
      "blog": "https://example.com"
    }
  },
  "stats": {
    "stars": 1280,
    "forks": 256,
    "subscribers": 89,
    "issues": { "open": 12, "closed": 347 }
  },
  "tags": ["工具", "开发者", "JSON", "Electron"],
  "tools": [
    { "id": 1, "name": "格式化", "enabled": true },
    { "id": 2, "name": "树形浏览", "enabled": true },
    { "id": 3, "name": "jq 过滤", "enabled": true },
    { "id": 4, "name": "对比", "enabled": true },
    { "id": 5, "name": "转换", "enabled": true },
    { "id": 6, "name": "Schema", "enabled": false }
  ],
  "releaseDate": "2026-07-12",
  "price": null,
  "downloadUrl": "https://github.com/grrtyre/youqu/releases",
  "changelog": [
    { "version": "1.0.0", "date": "2026-07-12", "changes": ["首发版本", "6 大工具"] }
  ]
}`;

// ===== 工具切换 =====
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const tool = item.dataset.tool;
    if (tool === currentTool) return;
    navItems.forEach((n) => n.classList.remove('active'));
    item.classList.add('active');
    currentTool = tool;
    renderTool(tool);
  });
});

const mainEl = document.getElementById('main');

function renderTool(tool) {
  switch (tool) {
    case 'format': renderFormat(); break;
    case 'tree': renderTree(); break;
    case 'jq': renderJq(); break;
    case 'diff': renderDiff(); break;
    case 'convert': renderConvert(); break;
    case 'schema': renderSchema(); break;
  }
}

// ===== 工具：格式化 =====
function renderFormat() {
  mainEl.innerHTML = `
    <div class="tool-head">
      <div class="tool-title">JSON 格式化</div>
      <div class="tool-desc">美化（2/4 空格缩进）或压缩为一行，自动校验错误并定位。</div>
    </div>
    <div class="tool-actions">
      <button class="btn btn-primary" id="fmt-beautify2">美化 (2 空格)</button>
      <button class="btn" id="fmt-beautify4">美化 (4 空格)</button>
      <button class="btn" id="fmt-minify">压缩</button>
      <button class="btn btn-ghost" id="fmt-copy">复制结果</button>
      <button class="btn btn-ghost" id="fmt-sample">载入示例</button>
    </div>
    <div class="editor-pair">
      <div class="editor-col">
        <div class="editor-head"><span class="label">输入</span><span class="meta" id="fmt-in-meta">0 字符</span></div>
        <div class="editor-body">
          <pre class="editor-highlight" id="fmt-highlight"></pre>
          <textarea class="editor-input" id="fmt-input" placeholder="在此粘贴 JSON 文本..."></textarea>
        </div>
      </div>
      <div class="editor-col">
        <div class="editor-head"><span class="label">输出</span><span class="meta" id="fmt-out-meta">-</span></div>
        <div class="editor-body"><pre class="output-pre empty" id="fmt-output">点击上方按钮开始格式化</pre></div>
      </div>
    </div>
  `;
  const input = document.getElementById('fmt-input');
  const highlight = document.getElementById('fmt-highlight');
  input.value = sharedInput;
  updateInputMeta('fmt-in-meta', input.value);
  syncInputHighlight();
  input.addEventListener('input', () => {
    sharedInput = input.value;
    updateInputMeta('fmt-in-meta', input.value);
    syncInputHighlight();
  });
  input.addEventListener('scroll', () => {
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  });
  document.getElementById('fmt-beautify2').onclick = () => doFormat(2);
  document.getElementById('fmt-beautify4').onclick = () => doFormat(4);
  document.getElementById('fmt-minify').onclick = () => doFormat(0);
  document.getElementById('fmt-copy').onclick = () => copyText(document.getElementById('fmt-output').textContent);
  document.getElementById('fmt-sample').onclick = () => {
    input.value = SAMPLE;
    sharedInput = SAMPLE;
    updateInputMeta('fmt-in-meta', input.value);
    syncInputHighlight();
    doFormat(2);
  };
  // 自动执行一次
  if (sharedInput.trim()) doFormat(2);

  function syncInputHighlight() {
    if (!highlight) return;
    const text = input.value;
    if (!text.trim()) {
      highlight.innerHTML = '';
      return;
    }
    // 直接对原始文本做语法高亮（保持与 textarea 内容完全一致，确保光标对齐）
    highlight.innerHTML = highlightJSON(text);
  }
}

function doFormat(indent) {
  const out = document.getElementById('fmt-output');
  const meta = document.getElementById('fmt-out-meta');
  if (!out) { console.log('[doFormat] output element not found'); return; }
  const r = core.parse(sharedInput);
  console.log('[doFormat] parse ok=' + r.ok + ' inputLen=' + sharedInput.length);
  if (!r.ok) {
    out.className = 'output-pre error';
    out.textContent = '解析错误：' + r.error + (r.pos >= 0 ? '（位置 ' + r.pos + '）' : '');
    meta.textContent = '错误';
    setStatus('解析错误', true);
    return;
  }
  const text = indent === 0 ? core.minify(r.value) : core.beautify(r.value, indent);
  out.className = 'output-pre';
  out.innerHTML = highlightJSON(text);
  console.log('[doFormat] output set, textLen=' + text.length);
  const s = core.stats(r.value);
  meta.textContent = text.length + ' 字符 · ' + s.keys + ' 键 · 深度 ' + s.depth;
  setStatus('格式化成功');
  saveHistory(sharedInput, '格式化');
}

// JSON 语法高亮：先转义 HTML，再用 span 着色
function highlightJSON(text) {
  let html = core.escapeHtml(text);
  // key（带冒号）
  html = html.replace(/(&quot;[^&]*?&quot;)(\s*):/g, '<span class="hl-key">$1</span>$2:');
  // 字符串值
  html = html.replace(/(&quot;[^&]*?&quot;)/g, '<span class="hl-string">$1</span>');
  // 数字
  html = html.replace(/\b(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, '<span class="hl-number">$1</span>');
  // 布尔
  html = html.replace(/\b(true|false)\b/g, '<span class="hl-boolean">$1</span>');
  // null
  html = html.replace(/\bnull\b/g, '<span class="hl-null">null</span>');
  return html;
}

function updateInputMeta(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text.length + ' 字符';
  updateStats(text);
}

// ===== 工具：树形浏览 =====
function renderTree() {
  mainEl.innerHTML = `
    <div class="tool-head">
      <div class="tool-title">树形浏览</div>
      <div class="tool-desc">可折叠展开的树形视图，点击任意节点查看路径与值。</div>
    </div>
    <div class="tool-actions">
      <button class="btn" id="tree-expand">全部展开</button>
      <button class="btn" id="tree-collapse">全部折叠</button>
      <button class="btn btn-ghost" id="tree-sample">载入示例</button>
    </div>
    <div class="tree-wrap">
      <div class="tree-panel">
        <div class="editor-head"><span class="label">JSON 输入</span><span class="meta" id="tree-in-meta">0 字符</span></div>
        <div class="editor-body" style="padding:0;"><textarea class="editor-input" id="tree-input" placeholder="粘贴 JSON 文本..."></textarea></div>
      </div>
      <div class="tree-panel">
        <div class="editor-head"><span class="label">树形视图</span><span class="meta" id="tree-out-meta">-</span></div>
        <div class="tree-body" id="tree-body"></div>
      </div>
    </div>
  `;
  const input = document.getElementById('tree-input');
  input.value = sharedInput;
  updateInputMeta('tree-in-meta', input.value);
  input.addEventListener('input', () => {
    sharedInput = input.value;
    updateInputMeta('tree-in-meta', input.value);
    buildTree();
  });
  document.getElementById('tree-expand').onclick = () => toggleAll(true);
  document.getElementById('tree-collapse').onclick = () => toggleAll(false);
  document.getElementById('tree-sample').onclick = () => {
    input.value = SAMPLE;
    sharedInput = SAMPLE;
    updateInputMeta('tree-in-meta', input.value);
    buildTree();
  };
  buildTree();
}

function buildTree() {
  const body = document.getElementById('tree-body');
  const meta = document.getElementById('tree-out-meta');
  const r = core.parse(sharedInput);
  if (!r.ok) {
    body.innerHTML = '<div style="padding:14px;color:var(--red);font-family:var(--mono);font-size:12px;">' +
      core.escapeHtml('解析错误：' + r.error) + '</div>';
    meta.textContent = '错误';
    return;
  }
  body.innerHTML = '';
  body.appendChild(buildNode(r.value, '$', [], true));
  const s = core.stats(r.value);
  meta.textContent = s.keys + ' 键 · ' + s.leafNodes + ' 叶子 · 深度 ' + s.depth;
  setStatus('树形渲染完成');
}

function buildNode(value, key, path, isRoot) {
  const wrap = document.createElement('div');
  wrap.className = 'tree-node';
  const row = document.createElement('div');
  row.className = 'tree-row';
  const toggle = document.createElement('span');
  toggle.className = 'tree-toggle';
  const keyEl = document.createElement('span');
  if (!isRoot) keyEl.className = 'tree-key';
  keyEl.textContent = isRoot ? '$' : key;
  row.appendChild(toggle);
  row.appendChild(keyEl);

  const type = core.typeOf(value);
  const childrenWrap = document.createElement('div');
  childrenWrap.className = 'tree-children';

  if (type === 'array' || type === 'object') {
    const isOpen = path.length < 2; // 默认展开前两层
    toggle.textContent = isOpen ? '▼' : '▶';
    row.appendChild(document.createTextNode(type === 'array' ? ' [' : ' {'));
    if (!isOpen) childrenWrap.classList.add('hidden');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = childrenWrap.classList.toggle('hidden');
      toggle.textContent = hidden ? '▶' : '▼';
    });
    row.addEventListener('click', () => {
      document.querySelectorAll('.tree-row.selected').forEach((n) => n.classList.remove('selected'));
      row.classList.add('selected');
      showTreeDetail(value, path);
    });
    // 子节点
    if (type === 'array') {
      value.forEach((v, i) => childrenWrap.appendChild(buildNode(v, i, path.concat(i), false)));
      const close = document.createElement('div');
      close.className = 'tree-row tree-bracket';
      close.style.paddingLeft = '18px';
      close.textContent = ']';
      childrenWrap.appendChild(close);
    } else {
      Object.keys(value).forEach((k) => childrenWrap.appendChild(buildNode(value[k], k, path.concat(k), false)));
      const close = document.createElement('div');
      close.className = 'tree-row tree-bracket';
      close.style.paddingLeft = '18px';
      close.textContent = '}';
      childrenWrap.appendChild(close);
    }
    wrap.appendChild(row);
    wrap.appendChild(childrenWrap);
  } else {
    toggle.textContent = '';
    const valEl = document.createElement('span');
    valEl.className = 'tree-' + (type === 'string' ? 'string' : type === 'number' ? 'number' : type === 'boolean' ? 'boolean' : 'null');
    valEl.textContent = formatLeafValue(value);
    row.appendChild(valEl);
    row.addEventListener('click', () => {
      document.querySelectorAll('.tree-row.selected').forEach((n) => n.classList.remove('selected'));
      row.classList.add('selected');
      showTreeDetail(value, path);
    });
    wrap.appendChild(row);
  }
  return wrap;
}

function formatLeafValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return '"' + v + '"';
  return String(v);
}

function showTreeDetail(value, path) {
  // 直接展示在状态栏 + 弹出 toast 显示路径
  const pathStr = core.pathToString(path);
  setStatus('已选择：' + pathStr + '（值类型 ' + core.typeOf(value) + '）');
}

function toggleAll(open) {
  document.querySelectorAll('.tree-children').forEach((el) => {
    if (open) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
  document.querySelectorAll('.tree-toggle').forEach((el) => {
    if (el.textContent) el.textContent = open ? '▼' : '▶';
  });
}

// ===== 工具：jq 过滤 =====
function renderJq() {
  mainEl.innerHTML = `
    <div class="tool-head">
      <div class="tool-title">jq 过滤查询</div>
      <div class="tool-desc">简化版 jq 语法：. 取根，.foo 取字段，.[] 遍历数组，| 管道，length/keys/values 等内置函数。</div>
    </div>
    <div class="jq-input">
      <span class="prefix">jq&gt;</span>
      <input id="jq-expr" placeholder="例如 .users[].name 或 .stats.stars" autocomplete="off"/>
    </div>
    <div class="jq-templates">
      <span class="chip" data-expr=".">. (根)</span>
      <span class="chip" data-expr="keys">keys</span>
      <span class="chip" data-expr="values">values</span>
      <span class="chip" data-expr=".[]">.[] (遍历)</span>
      <span class="chip" data-expr="length">length</span>
      <span class="chip" data-expr=".tags">.tags</span>
      <span class="chip" data-expr=".tags[]">.tags[]</span>
      <span class="chip" data-expr=".author.name">.author.name</span>
      <span class="chip" data-expr=".stats.stars">.stats.stars</span>
    </div>
    <div class="editor-pair">
      <div class="editor-col">
        <div class="editor-head"><span class="label">JSON 输入</span><span class="meta" id="jq-in-meta">0 字符</span></div>
        <div class="editor-body"><textarea class="editor-input" id="jq-input" placeholder="粘贴 JSON 文本..."></textarea></div>
      </div>
      <div class="editor-col">
        <div class="editor-head"><span class="label">查询结果</span><span class="meta" id="jq-out-meta">-</span></div>
        <div class="editor-body"><pre class="output-pre empty" id="jq-output">输入表达式后查看结果</pre></div>
      </div>
    </div>
  `;
  const input = document.getElementById('jq-input');
  const expr = document.getElementById('jq-expr');
  input.value = sharedInput;
  updateInputMeta('jq-in-meta', input.value);
  input.addEventListener('input', () => {
    sharedInput = input.value;
    updateInputMeta('jq-in-meta', input.value);
    runJq();
  });
  expr.addEventListener('input', runJq);
  document.querySelectorAll('.jq-templates .chip').forEach((chip) => {
    chip.onclick = () => {
      expr.value = chip.dataset.expr;
      runJq();
    };
  });
  if (sharedInput.trim()) {
    expr.value = '.stats.stars';
    runJq();
  }
}

function runJq() {
  const out = document.getElementById('jq-output');
  const meta = document.getElementById('jq-out-meta');
  const expr = document.getElementById('jq-expr').value.trim();
  if (!expr) {
    out.className = 'output-pre empty';
    out.textContent = '输入表达式后查看结果';
    meta.textContent = '-';
    return;
  }
  const r = core.parse(sharedInput);
  if (!r.ok) {
    out.className = 'output-pre error';
    out.textContent = 'JSON 错误：' + r.error;
    meta.textContent = '错误';
    return;
  }
  try {
    const result = core.jqQuery(r.value, expr);
    out.className = 'output-pre';
    out.textContent = result || '(无匹配结果)';
    meta.textContent = result.length + ' 字符';
    setStatus('jq 查询完成');
  } catch (err) {
    out.className = 'output-pre error';
    out.textContent = '表达式错误：' + String(err && err.message || err);
    meta.textContent = '错误';
  }
}

// ===== 工具：对比 =====
let diffRightInput = '';
function renderDiff() {
  mainEl.innerHTML = `
    <div class="tool-head">
      <div class="tool-title">JSON 对比</div>
      <div class="tool-desc">逐字段对比两个 JSON 的差异：新增、删除、修改，并标注完整路径。</div>
    </div>
    <div class="editor-pair">
      <div class="editor-col">
        <div class="editor-head"><span class="label">左侧 JSON</span><span class="meta" id="diff-l-meta">0 字符</span></div>
        <div class="editor-body"><textarea class="editor-input" id="diff-left" placeholder="左侧 JSON..."></textarea></div>
      </div>
      <div class="editor-col">
        <div class="editor-head"><span class="label">右侧 JSON</span><span class="meta" id="diff-r-meta">0 字符</span></div>
        <div class="editor-body"><textarea class="editor-input" id="diff-right" placeholder="右侧 JSON..."></textarea></div>
      </div>
    </div>
    <div class="tool-actions" style="margin-top:14px;">
      <button class="btn btn-primary" id="diff-run">开始对比</button>
      <button class="btn btn-ghost" id="diff-sample">载入示例</button>
    </div>
    <div class="diff-list" id="diff-list">
      <div class="diff-head">差异结果</div>
      <div class="diff-empty">点击「开始对比」查看差异</div>
    </div>
  `;
  const left = document.getElementById('diff-left');
  const right = document.getElementById('diff-right');
  left.value = sharedInput;
  right.value = diffRightInput;
  document.getElementById('diff-l-meta').textContent = left.value.length + ' 字符';
  document.getElementById('diff-r-meta').textContent = right.value.length + ' 字符';
  left.addEventListener('input', () => {
    sharedInput = left.value;
    document.getElementById('diff-l-meta').textContent = left.value.length + ' 字符';
    updateStats(left.value);
  });
  right.addEventListener('input', () => {
    diffRightInput = right.value;
    document.getElementById('diff-r-meta').textContent = right.value.length + ' 字符';
  });
  document.getElementById('diff-run').onclick = runDiff;
  document.getElementById('diff-sample').onclick = () => {
    const l = '{"name":"JSON管家","version":"1.0.0","tags":["a","b"],"author":{"name":"youqu","email":"old@example.com"},"active":true}';
    const r = '{"name":"JSON管家","version":"1.1.0","tags":["a","c","d"],"author":{"name":"youqu","email":"new@example.com"},"price":99}';
    left.value = l; right.value = r;
    sharedInput = l; diffRightInput = r;
    document.getElementById('diff-l-meta').textContent = l.length + ' 字符';
    document.getElementById('diff-r-meta').textContent = r.length + ' 字符';
    runDiff();
  };
}

function runDiff() {
  const list = document.getElementById('diff-list');
  const l = core.parse(document.getElementById('diff-left').value);
  const r = core.parse(document.getElementById('diff-right').value);
  if (!l.ok || !r.ok) {
    list.innerHTML = '<div class="diff-head">差异结果</div><div class="diff-empty">' +
      (!l.ok ? '左侧 JSON 错误：' + core.escapeHtml(l.error) : '右侧 JSON 错误：' + core.escapeHtml(r.error)) + '</div>';
    return;
  }
  const diffs = core.diff(l.value, r.value);
  if (diffs.length === 0) {
    list.innerHTML = '<div class="diff-head">差异结果</div><div class="diff-empty">两个 JSON 完全相同 ✓</div>';
    setStatus('对比完成：完全相同');
    return;
  }
  let html = '<div class="diff-head">差异结果（共 ' + diffs.length + ' 处）</div>';
  diffs.forEach((d) => {
    const typeLabel = { added: '新增', removed: '删除', changed: '修改' }[d.type];
    html += '<div class="diff-row ' + d.type + '">' +
      '<div><span class="diff-path">' + core.escapeHtml(d.path) + '</span><span class="diff-type-tag ' + d.type + '">' + typeLabel + '</span></div>' +
      '<div>' + (d.left === undefined ? '—' : core.escapeHtml(JSON.stringify(d.left))) + '</div>' +
      '<div>' + (d.right === undefined ? '—' : core.escapeHtml(JSON.stringify(d.right))) + '</div>' +
      '</div>';
  });
  list.innerHTML = html;
  setStatus('对比完成：' + diffs.length + ' 处差异');
}

// ===== 工具：格式转换 =====
function renderConvert() {
  mainEl.innerHTML = `
    <div class="tool-head">
      <div class="tool-title">格式转换</div>
      <div class="tool-desc">将 JSON 转换为 CSV / YAML / XML / Properties 格式，便于在其他场景使用。</div>
    </div>
    <div class="tool-actions">
      <button class="btn btn-primary" data-fmt="csv">转 CSV</button>
      <button class="btn" data-fmt="yaml">转 YAML</button>
      <button class="btn" data-fmt="xml">转 XML</button>
      <button class="btn" data-fmt="properties">转 Properties</button>
      <button class="btn btn-ghost" id="conv-copy">复制结果</button>
      <button class="btn btn-ghost" id="conv-sample">载入示例</button>
    </div>
    <div class="editor-pair convert-output" style="grid-template-columns:1fr 1fr;">
      <div class="editor-col">
        <div class="editor-head"><span class="label">JSON 输入</span><span class="meta" id="conv-in-meta">0 字符</span></div>
        <div class="editor-body"><textarea class="editor-input" id="conv-input" placeholder="粘贴 JSON 文本..."></textarea></div>
      </div>
      <div class="editor-col">
        <div class="editor-head"><span class="label" id="conv-out-label">输出</span><span class="meta" id="conv-out-meta">-</span></div>
        <div class="editor-body"><pre class="output-pre empty" id="conv-output">选择目标格式开始转换</pre></div>
      </div>
    </div>
  `;
  const input = document.getElementById('conv-input');
  input.value = sharedInput;
  updateInputMeta('conv-in-meta', input.value);
  input.addEventListener('input', () => {
    sharedInput = input.value;
    updateInputMeta('conv-in-meta', input.value);
  });
  document.querySelectorAll('.tool-actions [data-fmt]').forEach((btn) => {
    btn.onclick = () => doConvert(btn.dataset.fmt);
  });
  document.getElementById('conv-copy').onclick = () => copyText(document.getElementById('conv-output').textContent);
  document.getElementById('conv-sample').onclick = () => {
    input.value = '[{"name":"苹果","price":5.5,"qty":10},{"name":"香蕉","price":3.2,"qty":20},{"name":"橙子","price":4.8,"qty":15}]';
    sharedInput = input.value;
    updateInputMeta('conv-in-meta', input.value);
    doConvert('csv');
  };
}

function doConvert(fmt) {
  const out = document.getElementById('conv-output');
  const meta = document.getElementById('conv-out-meta');
  const label = document.getElementById('conv-out-label');
  const r = core.parse(sharedInput);
  if (!r.ok) {
    out.className = 'output-pre error';
    out.textContent = 'JSON 错误：' + r.error;
    meta.textContent = '错误';
    return;
  }
  let text = '';
  let name = '';
  try {
    switch (fmt) {
      case 'csv': text = core.toCSV(r.value); name = 'CSV'; break;
      case 'yaml': text = core.toYAML(r.value); name = 'YAML'; break;
      case 'xml': text = core.toXML(r.value); name = 'XML'; break;
      case 'properties': text = core.toProperties(r.value); name = 'Properties'; break;
    }
  } catch (err) {
    out.className = 'output-pre error';
    out.textContent = '转换失败：' + String(err && err.message || err);
    meta.textContent = '错误';
    return;
  }
  out.className = 'output-pre';
  out.textContent = text;
  label.textContent = '输出 · ' + name;
  meta.textContent = text.length + ' 字符';
  setStatus('已转换为 ' + name);
}

// ===== 工具：Schema 校验 =====
let schemaSchemaInput = '';
function renderSchema() {
  mainEl.innerHTML = `
    <div class="tool-head">
      <div class="tool-title">JSON Schema 校验</div>
      <div class="tool-desc">用 JSON Schema 校验数据：支持 type / required / properties / items / enum / minimum / maximum / pattern 等关键字子集。</div>
    </div>
    <div class="editor-pair" style="height:calc(100vh - 320px);min-height:240px;">
      <div class="editor-col">
        <div class="editor-head"><span class="label">数据 JSON</span><span class="meta" id="sch-d-meta">0 字符</span></div>
        <div class="editor-body"><textarea class="editor-input" id="sch-data" placeholder="待校验的 JSON 数据..."></textarea></div>
      </div>
      <div class="editor-col">
        <div class="editor-head"><span class="label">Schema JSON</span><span class="meta" id="sch-s-meta">0 字符</span></div>
        <div class="editor-body"><textarea class="editor-input" id="sch-schema" placeholder="JSON Schema..."></textarea></div>
      </div>
    </div>
    <div class="tool-actions" style="margin-top:14px;">
      <button class="btn btn-primary" id="sch-run">开始校验</button>
      <button class="btn btn-ghost" id="sch-sample">载入示例</button>
    </div>
    <div class="schema-result" id="sch-result">
      <div style="color:var(--text-dim);font-size:13px;">点击「开始校验」查看结果</div>
    </div>
  `;
  const data = document.getElementById('sch-data');
  const sch = document.getElementById('sch-schema');
  data.value = sharedInput;
  sch.value = schemaSchemaInput;
  document.getElementById('sch-d-meta').textContent = data.value.length + ' 字符';
  document.getElementById('sch-s-meta').textContent = sch.value.length + ' 字符';
  data.addEventListener('input', () => {
    sharedInput = data.value;
    document.getElementById('sch-d-meta').textContent = data.value.length + ' 字符';
    updateStats(data.value);
  });
  sch.addEventListener('input', () => {
    schemaSchemaInput = sch.value;
    document.getElementById('sch-s-meta').textContent = sch.value.length + ' 字符';
  });
  document.getElementById('sch-run').onclick = runSchema;
  document.getElementById('sch-sample').onclick = () => {
    const d = '{"name":"苹果","price":5.5,"qty":10,"tags":["水果","红色"]}';
    const s = '{"type":"object","required":["name","price"],"properties":{"name":{"type":"string","minLength":1},"price":{"type":"number","minimum":0},"qty":{"type":"integer","minimum":0},"tags":{"type":"array","items":{"type":"string"}}}}';
    data.value = d; sch.value = s;
    sharedInput = d; schemaSchemaInput = s;
    document.getElementById('sch-d-meta').textContent = d.length + ' 字符';
    document.getElementById('sch-s-meta').textContent = s.length + ' 字符';
    runSchema();
  };
}

function runSchema() {
  const out = document.getElementById('sch-result');
  const d = core.parse(document.getElementById('sch-data').value);
  const s = core.parse(document.getElementById('sch-schema').value);
  if (!d.ok) { out.innerHTML = '<div style="color:var(--red);font-size:13px;">数据 JSON 错误：' + core.escapeHtml(d.error) + '</div>'; return; }
  if (!s.ok) { out.innerHTML = '<div style="color:var(--red);font-size:13px;">Schema JSON 错误：' + core.escapeHtml(s.error) + '</div>'; return; }
  const errors = core.validateSchema(d.value, s.value);
  if (errors.length === 0) {
    out.innerHTML = '<div class="schema-ok">✓ 校验通过，数据完全符合 Schema</div>';
    setStatus('Schema 校验通过');
  } else {
    let html = '<div style="color:var(--red);font-size:13px;font-weight:500;margin-bottom:8px;">发现 ' + errors.length + ' 处不符合：</div><ul class="schema-err-list">';
    errors.forEach((e) => {
      html += '<li><span class="err-path">' + core.escapeHtml(e.path) + '</span>' + core.escapeHtml(e.msg) + '</li>';
    });
    html += '</ul>';
    out.innerHTML = html;
    setStatus('Schema 校验：' + errors.length + ' 处错误');
  }
}

// ===== 顶部按钮：打开 / 保存 / 清空 / 历史 =====
document.getElementById('btn-open').onclick = async () => {
  const r = await appApi.openFile();
  if (!r) return;
  if (r.error) { toast('打开失败：' + r.error); return; }
  sharedInput = r.text;
  toast('已载入：' + (r.filePath.split(/[\\/]/).pop()));
  renderTool(currentTool);
};
document.getElementById('btn-save').onclick = async () => {
  // 保存当前输出
  let text = '';
  const out = document.querySelector('.output-pre:not(.empty)');
  if (out) text = out.textContent;
  if (!text) { toast('没有可保存的输出'); return; }
  const r = await appApi.saveFile('output.json', text);
  if (r && r.filePath) toast('已保存：' + r.filePath.split(/[\\/]/).pop());
};
document.getElementById('btn-clear').onclick = () => {
  sharedInput = '';
  renderTool(currentTool);
  setStatus('已清空输入');
};
document.getElementById('btn-history').onclick = openDrawer;
document.getElementById('btn-history-close').onclick = closeDrawer;
document.getElementById('drawer-mask').onclick = closeDrawer;
document.getElementById('btn-history-clear').onclick = async () => {
  await appApi.history.clear();
  renderHistory();
  toast('历史已清空');
};

// ===== 历史抽屉 =====
async function openDrawer() {
  document.getElementById('drawer-mask').classList.add('show');
  document.getElementById('drawer').classList.add('show');
  await renderHistory();
}
function closeDrawer() {
  document.getElementById('drawer-mask').classList.remove('show');
  document.getElementById('drawer').classList.remove('show');
}
async function renderHistory() {
  const list = await appApi.history.load();
  const el = document.getElementById('history-list');
  if (!list || list.length === 0) {
    el.innerHTML = '<div class="history-empty">暂无历史记录<br/><span style="font-size:11px;">每次格式化或操作后会自动保存</span></div>';
    return;
  }
  el.innerHTML = '';
  list.slice().reverse().forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const preview = (item.text || '').slice(0, 80).replace(/\n/g, ' ');
    const time = new Date(item.time).toLocaleString('zh-CN', { hour12: false });
    div.innerHTML = '<div class="h-label">' + core.escapeHtml(item.label || '未命名') + '</div>' +
      '<div class="h-preview">' + core.escapeHtml(preview) + '</div>' +
      '<div class="h-time">' + time + '</div>';
    div.onclick = () => {
      sharedInput = item.text;
      closeDrawer();
      renderTool(currentTool);
      toast('已恢复历史记录');
    };
    el.appendChild(div);
  });
}

function saveHistory(text, label) {
  if (!text || text.length > 1024 * 1024) return;
  appApi.history.add({ text, label });
}

// ===== 状态栏 =====
function setStatus(msg, isError) {
  const el = document.getElementById('status-info');
  el.textContent = msg;
  if (isError) {
    el.classList.add('error');
  } else {
    el.classList.remove('error');
  }
}
function updateStats(text) {
  const el = document.getElementById('status-stats');
  const r = core.parse(text);
  if (r.ok) {
    const s = core.stats(r.value);
    el.innerHTML = '<span>' + text.length + ' 字符</span><span class="sep">·</span><span>' + s.keys + ' 键</span><span class="sep">·</span><span>深度 ' + s.depth + '</span>';
  } else {
    el.innerHTML = '<span>' + text.length + ' 字符</span>';
  }
}
function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

// ===== 工具函数 =====
function copyText(text) {
  if (!text) { toast('无内容可复制'); return; }
  navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板')).catch(() => toast('复制失败'));
}

let toastTimer = null;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ===== 启动：默认载入示例 =====
sharedInput = SAMPLE;
renderTool('format');
setStatus('就绪 · 已载入示例数据');
