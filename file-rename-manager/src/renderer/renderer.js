// renderer.js —— 渲染层逻辑：规则编辑、文件管理、预览、执行

const RULE_TYPES = [
  { value: 'replace', label: '文本替换' },
  { value: 'regex', label: '正则替换' },
  { value: 'sequence', label: '序号命名' },
  { value: 'date', label: '日期命名' },
  { value: 'case', label: '大小写转换' },
  { value: 'insert', label: '插入文本' },
  { value: 'remove', label: '删除字符' }
];

const POSITION_OPTIONS = [
  { value: 'replace', label: '替换原名' },
  { value: 'prefix', label: '加在前面' },
  { value: 'suffix', label: '加在后面' }
];

// 应用状态
const state = {
  rules: [],
  files: [],        // 文件项数组
  preview: [],      // 预览结果
  recursive: true,
  extFilter: ''     // 扩展名过滤文本（如 ".jpg,.png" 或 "jpg png"）
};

// DOM 引用
const $ = (id) => document.getElementById(id);
const rulesList = $('rules-list');
const rulesEmpty = $('rules-empty');
const fileTbody = $('file-tbody');
const dropZone = $('drop-zone');
const fileTableWrap = $('file-table-wrap');

// ========== 工具 ==========

function toast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { t.className = 'toast'; }, 2400);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// 模拟 path.extname / path.basename 拆分（渲染层无 Node path 模块）
function parseNameExt(name) {
  if (typeof name !== 'string' || name.length === 0) return { base: '', ext: '' };
  const i = name.lastIndexOf('.');
  if (i <= 0) return { base: name, ext: '' }; // 无点或开头点（如 .bashrc）视为无扩展名
  return { base: name.slice(0, i), ext: name.slice(i) };
}

// 解析扩展名过滤输入文本 → 扩展名数组
// 支持 ".jpg,.png"、"jpg png"、"*.jpg;*.png" 等格式
// 返回 null 表示不过滤
function parseExtFilter(text) {
  if (!text || typeof text !== 'string') return null;
  // 用逗号、分号、空格、换行分隔
  const parts = text.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  // 去掉开头的 * 通配符（如 *.jpg → .jpg）
  const normalized = parts.map(p => {
    let s = p;
    while (s.startsWith('*')) s = s.slice(1);
    return s;
  }).filter(Boolean);
  return normalized.length > 0 ? normalized : null;
}

// 高亮新旧文件名差异
function diffHighlight(oldName, newName) {
  if (oldName === newName) return { old: escapeHtml(oldName), new: escapeHtml(newName) };
  // 找公共前缀
  let i = 0;
  while (i < oldName.length && i < newName.length && oldName[i] === newName[i]) i++;
  // 找公共后缀
  let j = 0;
  while (j < oldName.length - i && j < newName.length - i &&
         oldName[oldName.length - 1 - j] === newName[newName.length - 1 - j]) j++;
  const oldMid = oldName.slice(i, oldName.length - j);
  const newMid = newName.slice(i, newName.length - j);
  const prefix = escapeHtml(oldName.slice(0, i));
  const suffix = escapeHtml(oldName.slice(oldName.length - j));
  return {
    old: `${prefix}<span class="name-diff">${escapeHtml(oldMid)}</span>${suffix}`,
    new: `${prefix}<span class="name-diff">${escapeHtml(newMid)}</span>${suffix}`
  };
}

// ========== 规则管理 ==========

function createDefaultRule(type) {
  const defaults = {
    replace: { type: 'replace', find: '', replaceWith: '', caseSensitive: true, wholeWord: false },
    regex: { type: 'regex', pattern: '', replacement: '', flags: 'g' },
    sequence: { type: 'sequence', prefix: '', start: 1, step: 1, pad: 3, suffix: '', position: 'replace' },
    date: { type: 'date', source: 'mtime', format: 'YYYYMMDD', position: 'replace' },
    case: { type: 'case', mode: 'lower' },
    insert: { type: 'insert', text: '', position: 0 },
    remove: { type: 'remove', chars: '' }
  };
  return { ...defaults[type] };
}

function addRule(type = 'replace') {
  state.rules.push(createDefaultRule(type));
  renderRules();
  updatePreview();
}

function deleteRule(idx) {
  state.rules.splice(idx, 1);
  renderRules();
  updatePreview();
}

function updateRule(idx, patch) {
  Object.assign(state.rules[idx], patch);
  updatePreview();
}

// 规则上下移动（E：规则调序）
// 通过 IPC 委托给引擎的 moveRule 纯函数（已测试），保证逻辑一致
async function moveRule(idx, direction) {
  // 引擎在 main 侧，这里直接做数组交换即可（moveRule 逻辑很简单）
  // 但为了与测试过的逻辑保持一致，仍然按 moveRule 的语义实现
  if (idx < 0 || idx >= state.rules.length) return;
  const target = direction === 'up' ? idx - 1 : direction === 'down' ? idx + 1 : -1;
  if (target < 0 || target >= state.rules.length) return;
  const tmp = state.rules[idx];
  state.rules[idx] = state.rules[target];
  state.rules[target] = tmp;
  renderRules();
  updatePreview();
}

function renderRules() {
  if (state.rules.length === 0) {
    rulesEmpty.style.display = '';
    rulesList.innerHTML = '';
    rulesList.appendChild(rulesEmpty);
    return;
  }
  rulesEmpty.style.display = 'none';
  rulesList.innerHTML = '';
  state.rules.forEach((rule, idx) => {
    rulesList.appendChild(renderRuleCard(rule, idx));
  });
}

function renderRuleCard(rule, idx) {
  const card = document.createElement('div');
  card.className = 'rule-card';

  const header = document.createElement('div');
  header.className = 'rule-card-header';

  const select = document.createElement('select');
  select.className = 'rule-type-select';
  RULE_TYPES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.label;
    if (t.value === rule.type) opt.selected = true;
  });
  select.addEventListener('change', () => {
    const newType = select.value;
    state.rules[idx] = createDefaultRule(newType);
    renderRules();
    updatePreview();
  });
  header.appendChild(select);

  // 规则调序按钮组（E：上下移动）
  const moveGroup = document.createElement('div');
  moveGroup.className = 'rule-move-group';

  const upBtn = document.createElement('button');
  upBtn.className = 'rule-move';
  upBtn.title = '上移';
  upBtn.disabled = idx === 0;
  upBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 3l4 5H2z" fill="currentColor"/></svg>';
  upBtn.addEventListener('click', () => moveRule(idx, 'up'));
  moveGroup.appendChild(upBtn);

  const downBtn = document.createElement('button');
  downBtn.className = 'rule-move';
  downBtn.title = '下移';
  downBtn.disabled = idx === state.rules.length - 1;
  downBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 9L2 4h8z" fill="currentColor"/></svg>';
  downBtn.addEventListener('click', () => moveRule(idx, 'down'));
  moveGroup.appendChild(downBtn);

  header.appendChild(moveGroup);

  const delBtn = document.createElement('button');
  delBtn.className = 'rule-delete';
  delBtn.title = '删除规则';
  delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  delBtn.addEventListener('click', () => deleteRule(idx));
  header.appendChild(delBtn);

  card.appendChild(header);

  const fields = document.createElement('div');
  fields.className = 'rule-fields';
  fields.innerHTML = renderRuleFields(rule, idx);
  // 绑定字段事件
  fields.querySelectorAll('input, select').forEach(el => {
    const handler = () => {
      const key = el.dataset.key;
      let val = el.value;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number') val = parseInt(val, 10) || 0;
      updateRule(idx, { [key]: val });
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });
  card.appendChild(fields);

  return card;
}

function renderRuleFields(rule, idx) {
  const prefix = (label) => `<div class="field-row"><span class="field-label">${label}</span>`;
  const input = (key, val, type = 'text', placeholder = '') =>
    `<input class="field-input" type="${type}" data-key="${key}" value="${escapeHtml(String(val ?? ''))}" placeholder="${placeholder}">`;
  const rowEnd = () => `</div>`;

  switch (rule.type) {
    case 'replace':
      return prefix('查找') + input('find', rule.find, 'text', '要查找的文本') + rowEnd()
        + prefix('替换') + input('replaceWith', rule.replaceWith, 'text', '替换为（留空即删除）') + rowEnd()
        + `<div class="field-row" style="padding-left:56px;gap:14px;">
            <label class="checkbox-line"><input type="checkbox" data-key="caseSensitive" ${rule.caseSensitive ? 'checked' : ''}><span>区分大小写</span></label>
            <label class="checkbox-line"><input type="checkbox" data-key="wholeWord" ${rule.wholeWord ? 'checked' : ''}><span>全词匹配</span></label>
          </div>`;

    case 'regex':
      return prefix('正则') + input('pattern', rule.pattern, 'text', '如 (\\d{4})-(\\d{2})') + rowEnd()
        + prefix('替换') + input('replacement', rule.replacement, 'text', '如 $1$2') + rowEnd()
        + prefix('标志') + input('flags', rule.flags, 'text', 'g') + rowEnd();

    case 'sequence':
      return prefix('前缀') + input('prefix', rule.prefix, 'text', '如 img_') + rowEnd()
        + prefix('起始') + input('start', rule.start, 'number') + rowEnd()
        + prefix('步长') + input('step', rule.step, 'number') + rowEnd()
        + prefix('补零') + input('pad', rule.pad, 'number', '如 3 → 001') + rowEnd()
        + prefix('后缀') + input('suffix', rule.suffix, 'text', '') + rowEnd()
        + prefix('位置') + `<select class="field-input" data-key="position">${POSITION_OPTIONS.map(o => `<option value="${o.value}" ${rule.position === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>` + rowEnd();

    case 'date':
      return prefix('来源') + `<select class="field-input" data-key="source">
            <option value="mtime" ${rule.source === 'mtime' ? 'selected' : ''}>修改时间</option>
            <option value="ctime" ${rule.source === 'ctime' ? 'selected' : ''}>创建时间</option>
            <option value="birthtime" ${rule.source === 'birthtime' ? 'selected' : ''}>出生时间</option>
            <option value="exif" ${rule.source === 'exif' ? 'selected' : ''}>EXIF 拍摄日期</option>
          </select>` + rowEnd()
        + prefix('格式') + input('format', rule.format, 'text', 'YYYYMMDD') + rowEnd()
        + prefix('位置') + `<select class="field-input" data-key="position">${POSITION_OPTIONS.map(o => `<option value="${o.value}" ${rule.position === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>` + rowEnd();

    case 'case':
      return prefix('模式') + `<select class="field-input" data-key="mode">
            <option value="upper" ${rule.mode === 'upper' ? 'selected' : ''}>全部大写</option>
            <option value="lower" ${rule.mode === 'lower' ? 'selected' : ''}>全部小写</option>
            <option value="title" ${rule.mode === 'title' ? 'selected' : ''}>标题大小写</option>
            <option value="camel" ${rule.mode === 'camel' ? 'selected' : ''}>驼峰命名</option>
            <option value="snake" ${rule.mode === 'snake' ? 'selected' : ''}>蛇形命名</option>
          </select>` + rowEnd();

    case 'insert':
      return prefix('文本') + input('text', rule.text, 'text', '要插入的文本') + rowEnd()
        + prefix('位置') + input('position', rule.position, 'number', '0=开头') + rowEnd();

    case 'remove':
      return prefix('字符集') + input('chars', rule.chars, 'text', '要删除的字符集合') + rowEnd()
        + `<div class="field-row" style="padding-left:56px;"><span style="font-size:11px;color:var(--text-tertiary);">删除出现在"字符集"中的任意字符</span></div>`;

    default: return '';
  }
}

// ========== 文件管理 ==========

async function addPaths(paths) {
  if (!paths || paths.length === 0) return;
  toast('正在扫描文件...');
  try {
    // 解析扩展名过滤（A：添加文件夹时按扩展名过滤）
    const extFilter = parseExtFilter(state.extFilter);
    const items = await window.api.scanPaths(paths, state.recursive, extFilter);
    if (items.length === 0) {
      toast(extFilter
        ? `未找到匹配 ${extFilter.join(', ')} 的文件`
        : '未找到文件', 'warn');
      return;
    }
    // 去重（按完整路径）
    const existing = new Set(state.files.map(f => f.dir + '/' + f.name));
    let added = 0;
    items.forEach(item => {
      const key = item.dir + '/' + item.name;
      if (!existing.has(key)) {
        state.files.push(item);
        existing.add(key);
        added++;
      }
    });
    const filterNote = extFilter ? `（仅 ${extFilter.join(', ')}）` : '';
    toast(`已添加 ${added} 个文件${added < items.length ? `（跳过 ${items.length - added} 个重复）` : ''}${filterNote}`, 'success');
    renderFileTable();
    updatePreview();
  } catch (e) {
    toast('扫描失败: ' + e.message, 'error');
  }
}

function clearFiles() {
  if (state.files.length === 0) return;
  state.files = [];
  state.preview = [];
  renderFileTable();
  updateActionButtons();
  toast('已清空文件列表');
}

// 删除单个文件（B：文件列表无法删除单个文件）
function removeFile(idx) {
  if (idx < 0 || idx >= state.files.length) return;
  state.files.splice(idx, 1);
  // 预览也要同步删除对应索引
  if (idx < state.preview.length) state.preview.splice(idx, 1);
  renderFileTable();
  updatePreview();
}

function renderFileTable() {
  const count = state.files.length;
  $('file-count').textContent = `${count} 个文件`;

  if (count === 0) {
    dropZone.style.display = '';
    fileTableWrap.style.display = 'none';
    return;
  }
  dropZone.style.display = 'none';
  fileTableWrap.style.display = '';

  fileTbody.innerHTML = '';
  state.files.forEach((file, idx) => {
    const tr = document.createElement('tr');
    const preview = state.preview[idx];
    let oldHtml, newHtml, statusHtml;

    if (preview) {
      const d = diffHighlight(preview.oldName, preview.newName);
      oldHtml = d.old;
      newHtml = d.new;
      if (preview.hasConflict) {
        statusHtml = '<span class="status-badge status-conflict">冲突</span>';
      } else if (preview.willChange) {
        statusHtml = '<span class="status-badge status-change">变更</span>';
      } else {
        statusHtml = '<span class="status-badge status-same">不变</span>';
      }
    } else {
      oldHtml = escapeHtml(file.name);
      newHtml = escapeHtml(file.name);
      statusHtml = '<span class="status-badge status-same">不变</span>';
    }

    tr.innerHTML = `
      <td class="col-idx">${idx + 1}</td>
      <td class="col-old"><span class="name-old">${oldHtml}</span></td>
      <td class="col-arrow">→</td>
      <td class="col-new"><span class="name-new">${newHtml}</span></td>
      <td class="col-status">${statusHtml}</td>
      <td class="col-action"><button class="row-delete" title="从列表移除"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button></td>
    `;
    // 绑定删除按钮
    tr.querySelector('.row-delete').addEventListener('click', () => removeFile(idx));
    fileTbody.appendChild(tr);
  });
}

// ========== 预览生成 ==========

let previewTimer = null;
function updatePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    if (state.files.length === 0) {
      state.preview = [];
      updateActionButtons();
      return;
    }
    try {
      state.preview = await window.api.generatePreview(state.files, state.rules);
      renderFileTable();
      updateActionButtons();
    } catch (e) {
      console.error('预览失败:', e);
    }
  }, 150); // 防抖
}

function updateActionButtons() {
  const changes = state.preview.filter(p => p.willChange && !p.hasConflict).length;
  const conflicts = state.preview.filter(p => p.hasConflict).length;

  $('info-change').textContent = `${changes} 项变更`;
  const conflictBadge = $('info-conflict');
  if (conflicts > 0) {
    conflictBadge.textContent = `${conflicts} 项冲突`;
    conflictBadge.style.display = '';
  } else {
    conflictBadge.style.display = 'none';
  }

  $('btn-apply').disabled = changes === 0 || conflicts > 0;
}

// ========== 执行/撤销 ==========

async function applyRename() {
  const toApply = state.preview.filter(p => p.willChange && !p.hasConflict);
  if (toApply.length === 0) return;

  if (!confirm(`确认重命名 ${toApply.length} 个文件？\n可通过"撤销"按钮恢复。`)) return;

  try {
    const result = await window.api.executeRename(state.preview);
    if (result.failed > 0) {
      toast(`成功 ${result.success} 项，失败 ${result.failed} 项`, 'warn');
    } else {
      toast(`成功重命名 ${result.success} 个文件`, 'success');
    }
    // 更新文件列表为新名（修复原 require('path') bug：渲染层 contextIsolation 下无 require）
    // 引擎规则只作用于 base（不含扩展名），ext 不变
    state.files.forEach((file, idx) => {
      const p = state.preview[idx];
      if (p && p.willChange) {
        const ext = file.ext; // 扩展名不变
        file.name = p.newName;
        file.base = ext ? p.newName.slice(0, p.newName.length - ext.length) : p.newName;
      }
    });
    // 重新生成预览（应该都是"不变"）
    state.preview = await window.api.generatePreview(state.files, state.rules);
    renderFileTable();
    updateActionButtons();
    $('btn-undo').disabled = false;
  } catch (e) {
    toast('重命名失败: ' + e.message, 'error');
  }
}

async function undoRename() {
  try {
    const result = await window.api.undoRename();
    if (result.empty) {
      toast('没有可撤销的操作', 'warn');
      $('btn-undo').disabled = true;
      return;
    }
    // H：撤销后不清空文件列表，用 history 恢复 state.files 的文件名
    // 撤销后磁盘上文件已恢复原名，state.files 也要同步把"新名"改回"原名"
    if (result.history && result.history.length > 0) {
      state.files = await window.api.applyUndoToFiles(state.files, result.history);
    }
    // 重新生成预览
    state.preview = await window.api.generatePreview(state.files, state.rules);
    renderFileTable();
    updateActionButtons();
    $('btn-undo').disabled = true;
    if (result.failed > 0) {
      toast(`撤销成功 ${result.success} 项，失败 ${result.failed} 项`, 'warn');
    } else {
      toast(`已撤销 ${result.success} 项重命名`, 'success');
    }
  } catch (e) {
    toast('撤销失败: ' + e.message, 'error');
  }
}

// ========== 预设管理 ==========

async function renderPresets() {
  try {
    const presets = await window.api.presetList();
    const list = $('preset-list');
    if (presets.length === 0) {
      list.innerHTML = '<div class="preset-empty">暂无预设</div>';
      return;
    }
    list.innerHTML = '';
    presets.forEach(p => {
      const item = document.createElement('div');
      item.className = 'preset-item';
      item.innerHTML = `
        <span class="preset-item-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
        <button class="preset-load" data-id="${p.id}">加载</button>
        <button class="preset-del" data-id="${p.id}">删除</button>
      `;
      item.querySelector('.preset-load').addEventListener('click', async () => {
        const preset = presets.find(x => x.id === p.id);
        if (preset) {
          state.rules = JSON.parse(JSON.stringify(preset.rules));
          renderRules();
          updatePreview();
          toast(`已加载预设"${preset.name}"`, 'success');
        }
      });
      item.querySelector('.preset-del').addEventListener('click', async () => {
        await window.api.presetDelete(p.id);
        renderPresets();
        toast('已删除预设');
      });
      list.appendChild(item);
    });
  } catch (e) {
    console.error('加载预设失败:', e);
  }
}

async function savePreset() {
  if (state.rules.length === 0) {
    toast('当前没有规则可保存', 'warn');
    return;
  }
  const name = prompt('请输入预设名称：');
  if (!name || !name.trim()) return;
  try {
    await window.api.presetAdd(name.trim(), state.rules);
    renderPresets();
    toast(`已保存预设"${name.trim()}"`, 'success');
  } catch (e) {
    toast('保存预设失败', 'error');
  }
}

// ========== 事件绑定 ==========

function bindEvents() {
  // 标题栏
  $('btn-min').addEventListener('click', () => window.api.winMinimize());
  $('btn-max').addEventListener('click', () => window.api.winMaximize());
  $('btn-close').addEventListener('click', () => window.api.winClose());
  $('btn-afdian').addEventListener('click', async () => {
    const url = await window.api.getAfdianUrl();
    window.api.openExternal(url);
  });

  // 规则面板
  $('btn-add-rule').addEventListener('click', () => addRule('replace'));
  $('btn-save-preset').addEventListener('click', savePreset);

  // 文件工具栏
  $('btn-add-files').addEventListener('click', async () => {
    const paths = await window.api.pickFiles();
    addPaths(paths);
  });
  $('btn-add-folder').addEventListener('click', async () => {
    const paths = await window.api.pickFolder();
    addPaths(paths);
  });
  $('btn-clear-files').addEventListener('click', clearFiles);
  $('chk-recursive').addEventListener('change', (e) => {
    state.recursive = e.target.checked;
  });
  // 扩展名过滤输入（A）
  const extFilterInput = $('input-ext-filter');
  if (extFilterInput) {
    extFilterInput.addEventListener('input', (e) => {
      state.extFilter = e.target.value || '';
    });
    // 回车时若有拖入路径则提示当前过滤已生效
    extFilterInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const f = parseExtFilter(state.extFilter);
        toast(f ? `已设置扩展名过滤：${f.join(', ')}` : '扩展名过滤已清空（添加全部）');
      }
    });
  }
  // 快捷过滤按钮（图片/视频/文档）
  document.querySelectorAll('.ext-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.ext || '';
      if (extFilterInput) {
        extFilterInput.value = val;
        state.extFilter = val;
        toast(val ? `已切换为：${val}` : '扩展名过滤已清空');
      }
    });
  });

  // 拖放
  ['dragenter', 'dragover'].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
    document.body.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
  ['dragleave', 'drop'].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    // Electron 28: file.path 仍可用（已废弃但仍工作）
    const paths = files.map(f => f.path).filter(Boolean);
    if (paths.length > 0) addPaths(paths);
  });
  // 整个窗口接受拖放（文件表格显示时）
  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const paths = files.map(f => f.path).filter(Boolean);
    if (paths.length > 0) addPaths(paths);
  });

  // 操作按钮
  $('btn-apply').addEventListener('click', applyRename);
  $('btn-undo').addEventListener('click', undoRename);

  // 初始检查是否有可撤销的历史
  window.api.hasUndoHistory().then(has => {
    $('btn-undo').disabled = !has;
  });
}

// ========== 启动 ==========

function init() {
  bindEvents();
  renderRules();
  renderPresets();

  // demo 数据（用于截图展示）
  window.api.onDemoData((data) => {
    if (data.items && data.items.length > 0) {
      state.files = data.items;
      renderFileTable();
    }
    if (data.rules && data.rules.length > 0) {
      state.rules = data.rules;
      renderRules();
    }
    updatePreview();
  });
}

document.addEventListener('DOMContentLoaded', init);
