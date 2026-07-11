'use strict';

/* 文本管家 · 渲染层逻辑 */

(function () {
  const ops = window.TextOps;
  const $ = (id) => document.getElementById(id);

  // ---------- 操作定义 ----------

  const OPERATIONS = {
    replace: {
      title: '批量替换',
      subtitle: '支持普通文本与正则表达式',
      render: renderReplaceOptions,
      run: runReplace
    },
    split: {
      title: '文本分割',
      subtitle: '按分隔符、长度、行或正则切分文本',
      render: renderSplitOptions,
      run: runSplit
    },
    extract: {
      title: '模式提取',
      subtitle: '用正则提取所有匹配项',
      render: renderExtractOptions,
      run: runExtract
    },
    case: {
      title: '大小写转换',
      subtitle: '大写、小写、驼峰、帕斯卡等多种格式',
      render: renderCaseOptions,
      run: runCase
    },
    dedupe: {
      title: '去重',
      subtitle: '按行去重或按相似度去重',
      render: renderDedupeOptions,
      run: runDedupe
    },
    lines: {
      title: '行处理',
      subtitle: '排序、反转、编号、加前后缀等',
      render: renderLinesOptions,
      run: runLines
    },
    encode: {
      title: '编码转换',
      subtitle: 'Base64 / URL / HTML / Unicode / Hex 编解码',
      render: renderEncodeOptions,
      run: runEncode
    },
    stats: {
      title: '文本统计',
      subtitle: '字符数、词数、行数、段落数',
      render: renderStatsOptions,
      run: runStats
    }
  };

  let currentOp = 'replace';

  // ---------- 选项面板渲染 ----------

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] !== undefined && attrs[k] !== null) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function field(labelText, input) {
    return el('div', { class: 'opt-field' },
      el('label', null, labelText),
      input
    );
  }

  function checkbox(id, label, checked) {
    return el('label', { class: 'opt-checkbox' },
      el('input', { type: 'checkbox', id, ...(checked ? { checked: '' } : {}) }),
      el('span', null, label)
    );
  }

  function chipGroup(name, items, active) {
    const group = el('div', { class: 'chip-group', 'data-name': name });
    items.forEach(([val, label]) => {
      const chip = el('button', {
        class: 'chip' + (val === active ? ' active' : ''),
        'data-value': val,
        onclick: (e) => {
          group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        }
      }, label);
      group.appendChild(chip);
    });
    return group;
  }

  function getChipValue(container, name) {
    const group = container.querySelector('.chip-group[data-name="' + name + '"]');
    if (!group) return null;
    const active = group.querySelector('.chip.active');
    return active ? active.getAttribute('data-value') : null;
  }

  function getInputValue(container, id) {
    const node = container.querySelector('#' + id);
    if (!node) return '';
    if (node.type === 'checkbox') return node.checked;
    return node.value;
  }

  // 1. 替换
  function renderReplaceOptions() {
    const panel = $('optionsPanel');
    panel.innerHTML = '';
    panel.appendChild(field('查找',
      el('input', { type: 'text', id: 'rpFind', class: 'wide', placeholder: '输入要查找的内容' })
    ));
    panel.appendChild(field('替换为',
      el('input', { type: 'text', id: 'rpReplace', class: 'wide', placeholder: '输入替换后的内容' })
    ));
    panel.appendChild(el('div', { class: 'opt-divider' }));
    panel.appendChild(checkbox('rpRegex', '正则模式'));
    panel.appendChild(checkbox('rpCase', '区分大小写'));
    panel.appendChild(checkbox('rpGlobal', '全部替换', true));
    panel.appendChild(checkbox('rpMultiline', '多行模式'));
    panel.appendChild(checkbox('rpWhole', '全字匹配'));
    panel.appendChild(el('span', { class: 'opt-hint' }, '提示：正则可用 $1 $2 引用捕获组'));
  }

  function runReplace(input) {
    const p = $('optionsPanel');
    return ops.replaceText(input, {
      find: getInputValue(p, 'rpFind'),
      replace: getInputValue(p, 'rpReplace'),
      useRegex: getInputValue(p, 'rpRegex'),
      caseSensitive: getInputValue(p, 'rpCase'),
      global: getInputValue(p, 'rpGlobal'),
      multiline: getInputValue(p, 'rpMultiline'),
      wholeWord: getInputValue(p, 'rpWhole')
    });
  }

  // 2. 分割
  function renderSplitOptions() {
    const panel = $('optionsPanel');
    panel.innerHTML = '';
    panel.appendChild(field('分割模式',
      chipGroup('spMode', [
        ['separator', '按分隔符'],
        ['length', '按长度'],
        ['lines', '按行'],
        ['regex', '按正则']
      ], 'separator')
    ));
    panel.appendChild(field('分隔符',
      el('input', { type: 'text', id: 'spSep', placeholder: '如 , 或 | 或空格' })
    ));
    panel.appendChild(field('每段长度',
      el('input', { type: 'number', id: 'spLen', value: '2', min: '1', style: 'width:80px' })
    ));
    panel.appendChild(el('div', { class: 'opt-divider' }));
    panel.appendChild(checkbox('spKeepEmpty', '保留空段'));
    panel.appendChild(field('最多段数 (0=不限)',
      el('input', { type: 'number', id: 'spLimit', value: '0', min: '0', style: 'width:90px' })
    ));
    panel.appendChild(el('span', { class: 'opt-hint' }, '输出：每段一行'));
  }

  function runSplit(input) {
    const p = $('optionsPanel');
    const parts = ops.splitText(input, {
      mode: getChipValue(p, 'spMode') || 'separator',
      separator: getInputValue(p, 'spSep'),
      length: parseInt(getInputValue(p, 'spLen'), 10) || 1,
      keepEmpty: getInputValue(p, 'spKeepEmpty'),
      limit: parseInt(getInputValue(p, 'spLimit'), 10) || 0
    });
    return parts.join('\n');
  }

  // 3. 提取
  function renderExtractOptions() {
    const panel = $('optionsPanel');
    panel.innerHTML = '';
    panel.appendChild(field('正则表达式',
      el('input', { type: 'text', id: 'exPattern', class: 'wide', placeholder: '如 \\d{11} 提取手机号' })
    ));
    panel.appendChild(field('捕获组 (0=整体)',
      el('input', { type: 'number', id: 'exGroup', value: '0', min: '0', style: 'width:90px' })
    ));
    panel.appendChild(el('div', { class: 'opt-divider' }));
    panel.appendChild(checkbox('exCase', '区分大小写'));
    panel.appendChild(checkbox('exMultiline', '多行模式'));
    panel.appendChild(checkbox('exUnique', '去重'));
    panel.appendChild(el('span', { class: 'opt-hint' }, '输出：每个匹配项一行'));
  }

  function runExtract(input) {
    const p = $('optionsPanel');
    const results = ops.extractText(input, {
      pattern: getInputValue(p, 'exPattern'),
      group: parseInt(getInputValue(p, 'exGroup'), 10) || 0,
      caseSensitive: getInputValue(p, 'exCase'),
      multiline: getInputValue(p, 'exMultiline'),
      unique: getInputValue(p, 'exUnique')
    });
    return results.join('\n');
  }

  // 4. 大小写
  function renderCaseOptions() {
    const panel = $('optionsPanel');
    panel.innerHTML = '';
    panel.appendChild(field('转换格式',
      chipGroup('csMode', [
        ['upper', '大写'],
        ['lower', '小写'],
        ['title', '标题式'],
        ['capitalize', '首字母大写'],
        ['sentence', '句首大写'],
        ['camel', '驼峰'],
        ['pascal', '帕斯卡'],
        ['snake', '下划线'],
        ['kebab', '短横线'],
        ['invert', '大小写互换'],
        ['alternating', '交替']
      ], 'upper')
    ));
  }

  function runCase(input) {
    const mode = getChipValue($('optionsPanel'), 'csMode') || 'upper';
    return ops.caseConvert(input, mode);
  }

  // 5. 去重
  function renderDedupeOptions() {
    const panel = $('optionsPanel');
    panel.innerHTML = '';
    panel.appendChild(field('去重方式',
      chipGroup('ddMode', [
        ['lines', '按行去重'],
        ['similarity', '相似度去重']
      ], 'lines')
    ));
    panel.appendChild(el('div', { class: 'opt-divider' }));
    panel.appendChild(checkbox('ddCase', '区分大小写'));
    panel.appendChild(checkbox('ddTrim', '比较时去首尾空白'));
    panel.appendChild(checkbox('ddKeepEmpty', '保留空行'));
    panel.appendChild(field('相似度阈值 (0-1)',
      el('input', { type: 'number', id: 'ddThreshold', value: '0.9', min: '0', max: '1', step: '0.05', style: 'width:90px' })
    ));
  }

  function runDedupe(input) {
    const p = $('optionsPanel');
    const mode = getChipValue(p, 'ddMode') || 'lines';
    if (mode === 'similarity') {
      return ops.dedupeBySimilarity(input, parseFloat(getInputValue(p, 'ddThreshold')) || 0.9);
    }
    return ops.dedupeLines(input, {
      caseSensitive: getInputValue(p, 'ddCase'),
      trim: getInputValue(p, 'ddTrim'),
      keepEmpty: getInputValue(p, 'ddKeepEmpty')
    });
  }

  // 6. 行处理
  function renderLinesOptions() {
    const panel = $('optionsPanel');
    panel.innerHTML = '';
    panel.appendChild(field('操作',
      chipGroup('lnMode', [
        ['sort', '排序'],
        ['sortNatural', '自然排序'],
        ['sortDesc', '倒序排序'],
        ['sortNaturalDesc', '自然倒序'],
        ['reverse', '行反转'],
        ['trim', '去行首尾空白'],
        ['removeEmpty', '删空行'],
        ['number', '加行号'],
        ['prefix', '加前后缀']
      ], 'sort')
    ));
    panel.appendChild(el('div', { class: 'opt-divider' }));
    panel.appendChild(checkbox('lnIgnoreCase', '排序忽略大小写'));
    panel.appendChild(el('span', { class: 'opt-hint' }, '自然排序：file2 排在 file10 之前'));
    panel.appendChild(field('行号分隔符',
      el('input', { type: 'text', id: 'lnSep', value: '. ', style: 'width:80px' })
    ));
    panel.appendChild(field('前缀',
      el('input', { type: 'text', id: 'lnPrefix', placeholder: '如 > ', style: 'width:100px' })
    ));
    panel.appendChild(field('后缀',
      el('input', { type: 'text', id: 'lnSuffix', placeholder: '如 。', style: 'width:100px' })
    ));
  }

  function runLines(input) {
    const p = $('optionsPanel');
    const mode = getChipValue(p, 'lnMode') || 'sort';
    switch (mode) {
      case 'sort':
        return ops.sortLines(input, { ignoreCase: getInputValue(p, 'lnIgnoreCase') });
      case 'sortNatural':
        return ops.sortLines(input, { ignoreCase: getInputValue(p, 'lnIgnoreCase'), natural: true });
      case 'sortDesc':
        return ops.sortLines(input, { ignoreCase: getInputValue(p, 'lnIgnoreCase'), descending: true });
      case 'sortNaturalDesc':
        return ops.sortLines(input, { ignoreCase: getInputValue(p, 'lnIgnoreCase'), natural: true, descending: true });
      case 'reverse':
        return ops.reverseLines(input);
      case 'trim':
        return ops.trimLines(input);
      case 'removeEmpty':
        return ops.removeEmptyLines(input);
      case 'number':
        return ops.addLineNumber(input, { separator: getInputValue(p, 'lnSep') || '. ' });
      case 'prefix':
        return ops.addPrefixSuffix(input, {
          prefix: getInputValue(p, 'lnPrefix'),
          suffix: getInputValue(p, 'lnSuffix')
        });
      default:
        return input;
    }
  }

  // 7. 编码转换
  function renderEncodeOptions() {
    const panel = $('optionsPanel');
    panel.innerHTML = '';
    panel.appendChild(field('编码方式',
      chipGroup('enMode', [
        ['base64', 'Base64'],
        ['url', 'URL'],
        ['html', 'HTML'],
        ['unicode', 'Unicode'],
        ['hex', 'Hex']
      ], 'base64')
    ));
    panel.appendChild(field('方向',
      chipGroup('enDir', [
        ['encode', '编码'],
        ['decode', '解码']
      ], 'encode')
    ));
    panel.appendChild(el('span', { class: 'opt-hint' }, '支持中文；解码时自动忽略空白字符'));
  }

  function runEncode(input) {
    const p = $('optionsPanel');
    const mode = getChipValue(p, 'enMode') || 'base64';
    const dir = getChipValue(p, 'enDir') || 'encode';
    if (dir === 'decode') return ops.decodeText(input, mode);
    return ops.encodeText(input, mode);
  }

  // 8. 统计
  function renderStatsOptions() {
    const panel = $('optionsPanel');
    panel.innerHTML = '';
    panel.appendChild(el('span', { class: 'opt-hint' }, '点击「运行」即可统计输入文本的各项指标。'));
  }

  function runStats(input) {
    const s = ops.countStats(input);
    const lines = [
      '字符数（含空白）: ' + s.chars,
      '字符数（不含空白）: ' + s.charsNoSpace,
      '词数: ' + s.words + '  （英文 ' + s.englishWords + ' + 中文 ' + s.chineseChars + '）',
      '行数: ' + s.lines,
      '段落数: ' + s.paragraphs
    ];
    return lines.join('\n');
  }

  // ---------- 主流程 ----------

  function switchOp(op) {
    currentOp = op;
    const conf = OPERATIONS[op];
    $('opTitle').textContent = conf.title;
    $('opSubtitle').textContent = conf.subtitle;
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-op') === op);
    });
    conf.render();
    // 切换时把当前输出区清空，避免误用
    $('outputText').value = '';
    updateCount('output');
    // 重新运行一次（如果输入有内容）
    if ($('inputText').value) {
      doRun(false);
    }
  }

  function doRun(showToast) {
    const input = $('inputText').value;
    const conf = OPERATIONS[currentOp];
    let output = '';
    try {
      output = conf.run(input);
    } catch (e) {
      output = '⚠ 执行出错: ' + e.message;
    }
    $('outputText').value = output;
    updateCount('output');
    if (showToast !== false) {
      toast('已处理 · ' + output.length + ' 字符');
    }
  }

  function updateCount(which) {
    const el = which === 'input' ? $('inputText') : $('outputText');
    const target = which === 'input' ? $('inputCount') : $('outputCount');
    const s = ops.countStats(el.value);
    target.textContent = s.chars + ' 字符 · ' + s.lines + ' 行';
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  // ---------- 事件绑定 ----------

  function bindEvents() {
    // 导航
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchOp(btn.getAttribute('data-op')));
    });

    // 运行
    $('btnRun').addEventListener('click', () => doRun());

    // 回填
    $('btnSwap').addEventListener('click', () => {
      $('inputText').value = $('outputText').value;
      updateCount('input');
      toast('已回填到输入');
    });

    // 复制
    $('btnCopy').addEventListener('click', async () => {
      const text = $('outputText').value;
      if (!text) { toast('输出为空'); return; }
      if (window.tm && window.tm.writeClipboard) {
        await window.tm.writeClipboard(text);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast('已复制到剪贴板');
    });

    // 保存
    $('btnSave').addEventListener('click', async () => {
      const text = $('outputText').value;
      if (!text) { toast('输出为空'); return; }
      if (window.tm && window.tm.saveFile) {
        const r = await window.tm.saveFile({
          content: text,
          suggestedName: OPERATIONS[currentOp].title + '-结果.txt'
        });
        if (!r.canceled && !r.error) toast('已保存: ' + r.path);
        else if (r.error) toast('保存失败: ' + r.error);
      } else {
        toast('当前环境不支持保存');
      }
    });

    // 清空
    $('btnClear').addEventListener('click', () => {
      $('inputText').value = '';
      $('outputText').value = '';
      updateCount('input');
      updateCount('output');
      toast('已清空');
    });

    // 导入文件
    $('btnOpenFile').addEventListener('click', async () => {
      if (!window.tm || !window.tm.openFile) { toast('当前环境不支持'); return; }
      const r = await window.tm.openFile();
      if (r.canceled) return;
      if (r.files && r.files.length) {
        const existing = $('inputText').value;
        const parts = r.files.map(f => f.error ? ('⚠ ' + f.name + ': ' + f.error) : f.content);
        // 多文件用分隔线连接
        const joined = parts.join('\n\n——— 文件分隔线 ———\n\n');
        $('inputText').value = existing ? (existing + '\n\n' + joined) : joined;
        updateCount('input');
        toast('已导入 ' + r.files.length + ' 个文件');
      }
    });

    // 输入实时统计
    $('inputText').addEventListener('input', () => updateCount('input'));
    $('outputText').addEventListener('input', () => updateCount('output'));

    // Ctrl+Enter 运行
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        doRun();
      }
    });

    // 拖入文件
    const inputEl = $('inputText');
    inputEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      inputEl.style.background = '#eef6ff';
    });
    inputEl.addEventListener('dragleave', () => {
      inputEl.style.background = '';
    });
    inputEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      inputEl.style.background = '';
      if (!e.dataTransfer || !e.dataTransfer.files) return;
      const files = Array.from(e.dataTransfer.files);
      const texts = [];
      for (const f of files) {
        if (f.size > 5 * 1024 * 1024) {
          texts.push('⚠ ' + f.name + ': 文件过大（>5MB）');
          continue;
        }
        try {
          texts.push(await f.text());
        } catch (err) {
          texts.push('⚠ ' + f.name + ': ' + err.message);
        }
      }
      const joined = texts.join('\n\n——— 文件分隔线 ———\n\n');
      $('inputText').value = $('inputText').value
        ? ($('inputText').value + '\n\n' + joined)
        : joined;
      updateCount('input');
      toast('已拖入 ' + files.length + ' 个文件');
    });

    // 爱发电
    $('openAfdian').addEventListener('click', () => {
      if (window.tm && window.tm.openExternal) {
        window.tm.openExternal('https://www.ifdian.net/a/giquwei');
      }
    });

    // 关于弹窗
    $('aboutClose').addEventListener('click', () => {
      $('aboutModal').hidden = true;
    });
    $('aboutModal').addEventListener('click', (e) => {
      if (e.target === $('aboutModal')) $('aboutModal').hidden = true;
    });
    if (window.tm && window.tm.onShowAbout) {
      window.tm.onShowAbout(() => { $('aboutModal').hidden = false; });
    }

    // 应用信息
    if (window.tm && window.tm.appInfo) {
      window.tm.appInfo().then(info => {
        if (info && info.version) {
          $('aboutVersion').textContent = '版本 ' + info.version;
        }
      });
    }

    // 窗口控制
    const winMaxBtn = $('winMax');
    if (window.tm) {
      $('winMin').addEventListener('click', () => window.tm.winMinimize && window.tm.winMinimize());
      winMaxBtn.addEventListener('click', () => window.tm.winToggleMaximize && window.tm.winToggleMaximize());
      $('winClose').addEventListener('click', () => window.tm.winClose && window.tm.winClose());
      // 初始化最大化状态
      if (window.tm.isMaximized) {
        window.tm.isMaximized().then(max => {
          winMaxBtn.classList.toggle('maximized', !!max);
        });
      }
      if (window.tm.onMaximizeChange) {
        window.tm.onMaximizeChange((max) => {
          winMaxBtn.classList.toggle('maximized', !!max);
        });
      }
    }
  }

  // ---------- 初始化 ----------

  // 截图演示用：不同操作的示例输入文本
  const DEMO_INPUTS = {
    replace: 'Hello World\nhello world\n你好世界\nfoo bar baz\nFOO BAR BAZ\napple,banana,orange',
    encode: '你好，世界！\nHello World\n文本管家 v1.1.0\nhttps://www.example.com/path?q=中文',
    stats: '文本管家是一款批量文本处理工具。\n支持替换、分割、提取、大小写、去重、行处理、编码转换、统计等八大功能。\n\n本段用于演示统计功能：字符数、词数、行数、段落数等指标。\nApple, Banana, Orange.\n你好，中国！',
    lines: 'file10.txt\nfile2.txt\nfile1.txt\nfile20.txt\nfile3.txt\nREADME.md\nconfig.json\n1. 第一步\n10. 第十步\n2. 第二步',
    case: 'hello world\nthis is a test\nfoo bar baz',
    dedupe: 'apple\nbanana\napple\norange\nbanana\ngrape\nApple\napple',
    extract: '联系电话：13800138000，邮箱：test@example.com\n备用电话：13912345678\n网址：https://www.example.com',
    split: 'apple,banana,orange,grape,lemon,melon,peach,pear'
  };

  // 截图演示用：不同操作的选项预填
  function applyDemoOptions(op) {
    const p = $('optionsPanel');
    if (op === 'replace') {
      const f = document.getElementById('rpFind');
      const r = document.getElementById('rpReplace');
      if (f && r) { f.value = 'o'; r.value = '0'; }
    } else if (op === 'encode') {
      // 默认 base64 编码即可
    } else if (op === 'lines') {
      // 切到自然排序
      const group = p.querySelector('.chip-group[data-name="lnMode"]');
      if (group) {
        group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        const target = group.querySelector('.chip[data-value="sortNatural"]');
        if (target) target.classList.add('active');
      }
    } else if (op === 'extract') {
      const pat = document.getElementById('exPattern');
      if (pat) pat.value = '\\d{11}';
      const grp = document.getElementById('exGroup');
      if (grp) grp.value = '0';
    } else if (op === 'case') {
      const group = p.querySelector('.chip-group[data-name="csMode"]');
      if (group) {
        group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        const target = group.querySelector('.chip[data-value="title"]');
        if (target) target.classList.add('active');
      }
    } else if (op === 'dedupe') {
      // 默认按行去重
    } else if (op === 'split') {
      const sep = document.getElementById('spSep');
      if (sep) sep.value = ',';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    // 截图演示：若设置了 TM_DEMO_OP 环境变量则展示对应模块，否则默认「批量替换」
    const demoOp = (window.tm && window.tm.demoOp) ? window.tm.demoOp() : null;
    const initialOp = (demoOp && OPERATIONS[demoOp]) ? demoOp : 'replace';
    // 根据操作填入对应示例文本
    $('inputText').value = DEMO_INPUTS[initialOp] || DEMO_INPUTS.replace;
    updateCount('input');
    switchOp(initialOp);
    // 预填选项并运行，让首屏有结果展示（延迟 300ms 确保 DOM 完全就绪）
    setTimeout(() => {
      applyDemoOptions(initialOp);
      doRun(false);
      // 再延迟 200ms 确保输出区内容已渲染
      setTimeout(() => { doRun(false); }, 200);
    }, 300);
  });
})();
