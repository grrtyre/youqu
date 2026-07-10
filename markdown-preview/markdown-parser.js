/**
 * MarkdownParser —— 零依赖 GFM 子集解析器
 * 支持浏览器和 Node.js（UMD 风格）
 * 语法：标题、段落、换行、粗体、斜体、删除线、行内代码、链接、图片、自动链接、
 *       代码块、引用块、无序列表、有序列表、任务列表、分隔线、表格
 * 中文排版优化 + XSS 转义
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.MarkdownParser = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ======================== XSS 转义 ========================

  /**
   * HTML 特殊字符转义，防止 XSS 注入
   * 注意：必须先替换 & 再替换其他字符，否则 &quot; 等已生成的实体中的 &
   * 会被二次转义为 &amp;quot;
   */
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * HTML 属性值转义：用于把文本安全地放入双引号属性（如 title="..."）
   * 与 escapeHtml 的区别：不转义单引号（双引号属性中单引号无需转义）
   * 顺序：先 & 再 "，避免 &quot; 中的 & 被二次转义
   */
  function escapeAttr(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ======================== 中文排版优化 ========================

  /**
   * 中英文之间自动插入空格
   * 汉字与 ASCII 字母/数字之间加半角空格
   * 注意：本函数会被作用于 parseInline 生成的 HTML 字符串，因此必须跳过
   *       HTML 标签和属性值（如 href/src/title），否则会把
   *       `./中文doc.html` 这样的 URL 破坏成 `./中文 doc.html`。
   *       实现方式：按 HTML 标签拆分，只对标签外的文本节点应用空格规则。
   */
  function addSpacesRaw(text) {
    text = text.replace(/([\u4e00-\u9fff\u3400-\u4dbf])([a-zA-Z0-9])/g, '$1 $2');
    text = text.replace(/([a-zA-Z0-9])([\u4e00-\u9fff\u3400-\u4dbf])/g, '$1 $2');
    return text;
  }

  function addChineseSpaces(text) {
    if (!text) return text;
    // 按标签拆分：偶数索引是文本节点，奇数索引是 HTML 标签
    // 标签内的属性（href/src/title 等）不被处理，避免破坏 URL
    var parts = text.split(/(<[^>]+>)/);
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        parts[i] = addSpacesRaw(parts[i]);
      }
    }
    return parts.join('');
  }

  // ======================== Slug 生成（用于目录跳转锚点） ========================

  /**
   * 把标题文本转换为 URL 安全的 slug
   * 规则：去 HTML 实体后，移除标点，空格转 -，中文保留，统一小写英文
   * 非字母数字汉字的字符全部替换为 -，连续 - 合并，首尾 - 去除
   */
  function slugify(text) {
    if (text == null) return '';
    text = String(text);
    // 去掉行内 markdown 标记（** **、* *、~~ ~~、` `、[ ]( )）
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/~~([^~]+)~~/g, '$1');
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // 保留：字母数字汉字连字符下划线，其余替换为 -
    text = text.replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf]+/g, '-');
    // 英文小写
    text = text.replace(/[A-Z]/g, function (ch) { return ch.toLowerCase(); });
    // 合并连续 -
    text = text.replace(/-+/g, '-');
    // 去首尾 -
    text = text.replace(/^-+|-+$/g, '');
    return text;
  }

  // ======================== 目录大纲提取 ========================

  /**
   * 从 Markdown 文本中提取标题列表
   * 仅识别行首 # 标记的标题（不识别 Setext 风格下划线标题）
   * @returns {Array<{level:Number, text:String, slug:String}>}
   */
  function extractToc(text) {
    if (typeof text !== 'string') return [];
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var toc = [];
    var inCodeBlock = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^```/.test(line)) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      // 移除行尾 # 标记
      var m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) {
        var level = m[1].length;
        var raw = m[2];
        // 去掉行内 markdown 标记，得到纯展示文本（用于目录显示）
        var plain = raw
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/~~([^~]+)~~/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        toc.push({ level: level, text: plain, slug: slugify(plain) });
      }
    }
    return toc;
  }

  // ======================== 代码块语法高亮（纯 JS，零依赖） ========================

  /**
   * 高亮代码字符串，返回带 <span class="tok-xxx"> 包裹的 HTML（已 escape）
   * 支持语言：javascript(js), typescript(ts), python(py), json, html, css, bash(sh), java, go, sql
   * 未识别语言 → 直接 escape 返回
   * 实现策略：用占位符保护已匹配片段，避免重叠
   */
  function highlightCode(code, lang) {
    if (code == null) return '';
    code = String(code);
    lang = String(lang || '').toLowerCase();
    var normalized = lang.replace(/^language-/, '');
    if (!normalized) return escapeHtml(code);

    var rules = HIGHLIGHT_RULES[normalized];
    if (!rules) return escapeHtml(code);

    // 把所有规则按优先级依次匹配，用占位符替换已匹配片段
    // 占位符格式：\x00INDEX\x00，INDEX 指向 tokens 数组
    var tokens = [];
    var placeholders = [];
    var marked = code;

    function escapeForRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 先 escape 原始代码为 HTML 实体字符串，再在实体字符串上做高亮包裹
    // 但这样会让关键字正则匹配不到 < > 等。所以反过来：在原始字符串上匹配，
    // 记录 [start, end, className]，最后统一 escape + 包裹。
    var ranges = [];
    rules.forEach(function (rule) {
      var re = new RegExp(rule.pattern, rule.flags || 'g');
      var m;
      while ((m = re.exec(marked)) !== null) {
        var start = m.index;
        var end = m.index + m[0].length;
        // 跳过被已匹配范围覆盖的片段
        var overlap = false;
        for (var r = 0; r < ranges.length; r++) {
          if (start < ranges[r].end && end > ranges[r].start) {
            overlap = true;
            break;
          }
        }
        if (!overlap && m[0].length > 0) {
          ranges.push({ start: start, end: end, cls: rule.cls });
        }
        if (m[0].length === 0) re.lastIndex++;
      }
    });

    if (ranges.length === 0) return escapeHtml(code);

    // 按起始位置排序
    ranges.sort(function (a, b) { return a.start - b.start; });

    // 拼装：片段间的普通文本 escape，匹配的片段 escape 后包 span
    var out = '';
    var cursor = 0;
    for (var i = 0; i < ranges.length; i++) {
      if (ranges[i].start > cursor) {
        out += escapeHtml(code.slice(cursor, ranges[i].start));
      }
      out += '<span class="' + ranges[i].cls + '">' + escapeHtml(code.slice(ranges[i].start, ranges[i].end)) + '</span>';
      cursor = ranges[i].end;
    }
    if (cursor < code.length) {
      out += escapeHtml(code.slice(cursor));
    }
    return out;
  }

  // 各语言高亮规则：{cls, pattern, flags}
  // 注意：注释和字符串优先匹配（在数组前部）
  var HIGHLIGHT_RULES = {
    javascript: [
      { cls: 'tok-comment', pattern: '\\/\\/[^\\n]*', flags: 'g' },
      { cls: 'tok-comment', pattern: '\\/\\*[\\s\\S]*?\\*\\/', flags: 'g' },
      { cls: 'tok-string', pattern: '"(?:\\\\.|[^"\\\\])*"', flags: 'g' },
      { cls: 'tok-string', pattern: "'(?:\\\\.|[^'\\\\])*'", flags: 'g' },
      { cls: 'tok-string', pattern: '`(?:\\\\.|[^`\\\\])*`', flags: 'g' },
      { cls: 'tok-keyword', pattern: '\\b(?:var|let|const|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|super|try|catch|finally|throw|typeof|instanceof|in|of|delete|void|yield|async|await|import|export|from|default|static|get|set|null|undefined|true|false|NaN|Infinity)\\b', flags: 'g' },
      { cls: 'tok-number', pattern: '\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b', flags: 'g' },
      { cls: 'tok-function', pattern: '\\b[a-zA-Z_$][\\w$]*(?=\\s*\\()', flags: 'g' }
    ],
    js: null, // 占位，下面用别名表填充
    typescript: null,
    ts: null,
    python: [
      { cls: 'tok-comment', pattern: '#[^\\n]*', flags: 'g' },
      { cls: 'tok-string', pattern: '"""[\\s\\S]*?"""', flags: 'g' },
      { cls: 'tok-string', pattern: "'''[\\s\\S]*?'''", flags: 'g' },
      { cls: 'tok-string', pattern: '"(?:\\\\.|[^"\\\\])*"', flags: 'g' },
      { cls: 'tok-string', pattern: "'(?:\\\\.|[^'\\\\])*'", flags: 'g' },
      { cls: 'tok-keyword', pattern: '\\b(?:def|return|if|elif|else|for|while|break|continue|in|not|and|or|is|None|True|False|import|from|as|class|try|except|finally|with|lambda|yield|global|nonlocal|pass|raise|assert|del|print|self)\\b', flags: 'g' },
      { cls: 'tok-number', pattern: '\\b\\d+(?:\\.\\d+)?\\b', flags: 'g' },
      { cls: 'tok-function', pattern: '\\bdef\\s+([a-zA-Z_]\\w*)', flags: 'g' }
    ],
    py: null,
    json: [
      { cls: 'tok-key', pattern: '"(?:\\\\.|[^"\\\\])*"(?=\\s*:)', flags: 'g' },
      { cls: 'tok-string', pattern: '"(?:\\\\.|[^"\\\\])*"', flags: 'g' },
      { cls: 'tok-number', pattern: '\\b-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b', flags: 'g' },
      { cls: 'tok-atom', pattern: '\\b(?:true|false|null)\\b', flags: 'g' }
    ],
    html: [
      { cls: 'tok-comment', pattern: '<!--[\\s\\S]*?-->', flags: 'g' },
      { cls: 'tok-tag', pattern: '<\\/?[a-zA-Z][\\w:-]*', flags: 'g' },
      { cls: 'tok-tag', pattern: '\\/?>', flags: 'g' },
      { cls: 'tok-attr', pattern: '[a-zA-Z-]+(?=\\s*=)', flags: 'g' },
      { cls: 'tok-string', pattern: '"[^"]*"', flags: 'g' },
      { cls: 'tok-string', pattern: "'[^']*'", flags: 'g' }
    ],
    css: [
      { cls: 'tok-comment', pattern: '\\/\\*[\\s\\S]*?\\*\\/', flags: 'g' },
      { cls: 'tok-keyword', pattern: '@[a-zA-Z-]+', flags: 'g' },
      { cls: 'tok-selector', pattern: '[.#]?[a-zA-Z_][\\w-]*(?=\\s*\\{)', flags: 'g' },
      { cls: 'tok-attr', pattern: '[a-zA-Z-]+(?=\\s*:)', flags: 'g' },
      { cls: 'tok-string', pattern: '"[^"]*"', flags: 'g' },
      { cls: 'tok-string', pattern: "'[^']*'", flags: 'g' },
      { cls: 'tok-number', pattern: '\\b-?\\d+(?:\\.\\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)?\\b', flags: 'g' },
      { cls: 'tok-atom', pattern: '\\b(?:!important|inherit|initial|auto|none|inline|block|flex|grid)\\b', flags: 'g' }
    ],
    bash: [
      { cls: 'tok-comment', pattern: '#[^\\n]*', flags: 'g' },
      { cls: 'tok-string', pattern: '"(?:\\\\.|[^"\\\\])*"', flags: 'g' },
      { cls: 'tok-string', pattern: "'[^']*'", flags: 'g' },
      { cls: 'tok-keyword', pattern: '\\b(?:if|then|else|fi|for|while|do|done|case|esac|in|return|function|export|local|echo|cd|ls|mv|cp|rm|mkdir|chmod|chown|sudo|npm|node|git|cd)\\b', flags: 'g' },
      { cls: 'tok-variable', pattern: '\\$[a-zA-Z_][\\w]*', flags: 'g' },
      { cls: 'tok-number', pattern: '\\b\\d+\\b', flags: 'g' }
    ],
    sh: null,
    shell: null,
    java: [
      { cls: 'tok-comment', pattern: '\\/\\/[^\\n]*', flags: 'g' },
      { cls: 'tok-comment', pattern: '\\/\\*[\\s\\S]*?\\*\\/', flags: 'g' },
      { cls: 'tok-string', pattern: '"(?:\\\\.|[^"\\\\])*"', flags: 'g' },
      { cls: 'tok-keyword', pattern: '\\b(?:public|private|protected|class|interface|extends|implements|new|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|throws|import|package|static|final|void|int|long|double|float|boolean|char|String|null|true|false|this|super|instanceof)\\b', flags: 'g' },
      { cls: 'tok-number', pattern: '\\b\\d+(?:\\.\\d+)?[LfDd]?\\b', flags: 'g' },
      { cls: 'tok-function', pattern: '\\b[a-zA-Z_$][\\w$]*(?=\\s*\\()', flags: 'g' }
    ],
    go: [
      { cls: 'tok-comment', pattern: '\\/\\/[^\\n]*', flags: 'g' },
      { cls: 'tok-comment', pattern: '\\/\\*[\\s\\S]*?\\*\\/', flags: 'g' },
      { cls: 'tok-string', pattern: '"(?:\\\\.|[^"\\\\])*"', flags: 'g' },
      { cls: 'tok-string', pattern: '`[^`]*`', flags: 'g' },
      { cls: 'tok-keyword', pattern: '\\b(?:package|import|func|return|if|else|for|range|switch|case|default|break|continue|var|const|type|struct|interface|map|chan|go|defer|nil|true|false)\\b', flags: 'g' },
      { cls: 'tok-number', pattern: '\\b\\d+(?:\\.\\d+)?\\b', flags: 'g' },
      { cls: 'tok-function', pattern: '\\bfunc\\s+([a-zA-Z_]\\w*)', flags: 'g' }
    ],
    sql: [
      { cls: 'tok-comment', pattern: '--[^\\n]*', flags: 'g' },
      { cls: 'tok-comment', pattern: '\\/\\*[\\s\\S]*?\\*\\/', flags: 'g' },
      { cls: 'tok-string', pattern: "'(?:''|[^'])*'", flags: 'g' },
      { cls: 'tok-string', pattern: '"[^"]*"', flags: 'g' },
      { cls: 'tok-keyword', pattern: '\\b(?:SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|INTO|VALUES|SET|AND|OR|NOT|NULL|IS|IN|LIKE|BETWEEN|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|CREATE|TABLE|INDEX|VIEW|DROP|ALTER|ADD|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|UNIQUE|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|UNION|ALL|TRUE|FALSE)\\b', flags: 'gi' }
    ]
  };
  // 别名填充
  HIGHLIGHT_RULES.js = HIGHLIGHT_RULES.javascript;
  HIGHLIGHT_RULES.typescript = HIGHLIGHT_RULES.javascript;
  HIGHLIGHT_RULES.ts = HIGHLIGHT_RULES.javascript;
  HIGHLIGHT_RULES.py = HIGHLIGHT_RULES.python;
  HIGHLIGHT_RULES.sh = HIGHLIGHT_RULES.bash;
  HIGHLIGHT_RULES.shell = HIGHLIGHT_RULES.bash;

  // ======================== 行内解析 ========================

  /**
   * 解析行内元素：粗体、斜体、删除线、行内代码、链接、图片、自动链接
   */
  function parseInline(text) {
    // 先用占位符保护 <br> 标记，防止被转义
    var PLACEHOLDER = '\x00BR\x00';
    text = text.replace(/<br>/g, PLACEHOLDER);

    var result = '';
    var i = 0;
    var len = text.length;

    while (i < len) {
      // --- 行内代码（优先，内部不做格式解析） ---
      if (text[i] === '`') {
        var codeEnd = text.indexOf('`', i + 1);
        if (codeEnd !== -1) {
          var codeContent = text.slice(i + 1, codeEnd);
          result += '<code>' + escapeHtml(codeContent) + '</code>';
          i = codeEnd + 1;
          continue;
        }
      }

      // --- 图片 ![alt](url) ---
      if (text[i] === '!' && i + 1 < len && text[i + 1] === '[') {
        var imgAltEnd = findClosingBracket(text, i + 2);
        if (imgAltEnd !== -1 && imgAltEnd + 1 < len && text[imgAltEnd + 1] === '(') {
          var urlEnd = text.indexOf(')', imgAltEnd + 2);
          if (urlEnd !== -1) {
            var alt = text.slice(i + 2, imgAltEnd);
            var url = text.slice(imgAltEnd + 2, urlEnd);
            result += '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '">';
            i = urlEnd + 1;
            continue;
          }
        }
      }

      // --- 链接 [text](url) ---
      if (text[i] === '[') {
        var linkTextEnd = findClosingBracket(text, i + 1);
        if (linkTextEnd !== -1 && linkTextEnd + 1 < len && text[linkTextEnd + 1] === '(') {
          var linkUrlEnd = text.indexOf(')', linkTextEnd + 2);
          if (linkUrlEnd !== -1) {
            var linkText = text.slice(i + 1, linkTextEnd);
            var linkUrl = text.slice(linkTextEnd + 2, linkUrlEnd);
            result += '<a href="' + escapeHtml(linkUrl) + '">' + parseInline(linkText) + '</a>';
            i = linkUrlEnd + 1;
            continue;
          }
        }
      }

      // --- 自动链接 <url> ---
      if (text[i] === '<') {
        var autoEnd = text.indexOf('>', i + 1);
        if (autoEnd !== -1) {
          var autoContent = text.slice(i + 1, autoEnd);
          if (/^https?:\/\//.test(autoContent)) {
            result += '<a href="' + escapeHtml(autoContent) + '">' + escapeHtml(autoContent) + '</a>';
            i = autoEnd + 1;
            continue;
          }
        }
      }

      // --- 粗体+斜体 ***text*** ---
      if (i + 2 < len && text[i] === '*' && text[i + 1] === '*' && text[i + 2] === '*') {
        var bsEnd = text.indexOf('***', i + 3);
        if (bsEnd !== -1) {
          result += '<strong><em>' + parseInline(text.slice(i + 3, bsEnd)) + '</em></strong>';
          i = bsEnd + 3;
          continue;
        }
      }

      // --- 粗体 **text** ---
      if (i + 1 < len && text[i] === '*' && text[i + 1] === '*') {
        var boldEnd = text.indexOf('**', i + 2);
        if (boldEnd !== -1) {
          result += '<strong>' + parseInline(text.slice(i + 2, boldEnd)) + '</strong>';
          i = boldEnd + 2;
          continue;
        }
      }

      // --- 斜体 *text* ---
      if (text[i] === '*' && i + 1 < len && text[i + 1] !== '*') {
        var italicEnd = text.indexOf('*', i + 1);
        if (italicEnd !== -1 && (italicEnd + 1 >= len || text[italicEnd + 1] !== '*')) {
          result += '<em>' + parseInline(text.slice(i + 1, italicEnd)) + '</em>';
          i = italicEnd + 1;
          continue;
        }
      }

      // --- 删除线 ~~text~~ ---
      if (i + 1 < len && text[i] === '~' && text[i + 1] === '~') {
        var strikeEnd = text.indexOf('~~', i + 2);
        if (strikeEnd !== -1) {
          result += '<del>' + parseInline(text.slice(i + 2, strikeEnd)) + '</del>';
          i = strikeEnd + 2;
          continue;
        }
      }

      // --- 普通字符转义 ---
      result += escapeHtml(text[i]);
      i++;
    }

    // 还原 <br> 并应用中文排版
    result = result.replace(new RegExp(PLACEHOLDER, 'g'), '<br>');
    return addChineseSpaces(result);
  }

  /**
   * 查找匹配的右方括号 ]
   */
  function findClosingBracket(text, start) {
    var depth = 1;
    var i = start;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '[') depth++;
      if (text[i] === ']') {
        depth--;
        if (depth === 0) return i;
      }
      i++;
    }
    return -1;
  }

  // ======================== 块级解析 ========================

  /**
   * 判断行是否以列表标记开头（- * + 后跟空格，或 数字. 后跟空格）
   */
  function isListLine(line) {
    return /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
  }

  /**
   * 按行拆分，逐行解析块级元素
   * @param {string} text
   * @param {object} [opts] { highlight: Boolean } 是否启用代码块语法高亮
   */
  function parseBlocks(text, opts) {
    opts = opts || {};
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (text.length > 0 && text[text.length - 1] !== '\n') {
      text += '\n';
    }

    var lines = text.split('\n');
    var html = '';
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      // --- 空行跳过 ---
      if (/^\s*$/.test(line)) {
        i++;
        continue;
      }

      // --- 标题 ---
      var headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        var level = headingMatch[1].length;
        var content = headingMatch[2].replace(/\s*#+\s*$/, '');
        html += '<h' + level + '>' + parseInline(content) + '</h' + level + '>\n';
        i++;
        continue;
      }

      // --- 分隔线 ---
      if (/^(\s*[-*_]\s*){3,}$/.test(line) && /^[\s\-*_]*$/.test(line)) {
        html += '<hr>\n';
        i++;
        continue;
      }

      // --- 代码块 ---
      if (/^```/.test(line)) {
        var langMatch = line.match(/^```(\S*)/);
        var lang = langMatch ? langMatch[1] : '';
        var codeLines = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        var rawCode = codeLines.join('\n');
        var langClass = lang ? ' class="language-' + escapeHtml(lang) + '"' : '';
        var inner = opts.highlight && lang ? highlightCode(rawCode, lang) : escapeHtml(rawCode);
        html += '<pre><code' + langClass + '>' + inner + '</code></pre>\n';
        continue;
      }

      // --- 引用块 ---
      if (/^\s*>\s?/.test(line)) {
        var quoteLines = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html += '<blockquote>' + parseBlocks(quoteLines.join('\n'), opts).trim() + '</blockquote>';
        continue;
      }

      // --- 表格 ---
      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        var tableResult = parseTable(lines, i);
        html += tableResult.html;
        i = tableResult.nextIndex;
        continue;
      }

      // --- 无序列表 ---
      if (/^\s*[-*+]\s+/.test(line)) {
        var listResult = parseList(lines, i, false);
        html += listResult.html;
        i = listResult.nextIndex;
        continue;
      }

      // --- 有序列表 ---
      if (/^\s*\d+\.\s+/.test(line)) {
        var listResult = parseList(lines, i, true);
        html += listResult.html;
        i = listResult.nextIndex;
        continue;
      }

      // --- 段落 ---
      var paraLines = [];
      while (i < lines.length) {
        var pl = lines[i];
        // 遇到空行、标题、分隔线、代码块、引用、表格起始、列表项则停止
        if (/^\s*$/.test(pl)) break;
        if (/^#{1,6}\s/.test(pl)) break;
        if (/^(\s*[-*_]\s*){3,}$/.test(pl) && /^[\s\-*_]*$/.test(pl)) break;
        if (/^```/.test(pl)) break;
        if (/^\s*>\s?/.test(pl)) break;
        if (/^\s*\|/.test(pl) && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1])) break;
        if (isListLine(pl)) break;
        paraLines.push(pl);
        i++;
      }
      if (paraLines.length > 0) {
        var paraText = paraLines.join('\n');
        // 两空格+换行 → <br>
        paraText = paraText.replace(/ {2}\n/g, '<br>\n');
        // 段落内其他换行 → 空格
        paraText = paraText.replace(/\n/g, ' ');
        html += '<p>' + parseInline(paraText) + '</p>\n';
        continue;
      }

      // 兜底跳过
      i++;
    }

    return html;
  }

  /**
   * 解析列表（支持无序、有序、任务列表）
   */
  function parseList(lines, startIndex, ordered) {
    var tag = ordered ? 'ol' : 'ul';
    var items = [];
    var i = startIndex;
    var baseIndent = lines[i].match(/^(\s*)/)[1].length;

    while (i < lines.length) {
      var line = lines[i];
      var indent = line.match(/^(\s*)/)[1].length;
      if (indent < baseIndent) break;

      // 任务列表
      var taskMatch = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)/);
      if (taskMatch) {
        var checked = taskMatch[1].toLowerCase() === 'x';
        var cls = checked ? ' class="task-checked"' : '';
        items.push('<li' + cls + '><input type="checkbox"' + (checked ? ' checked' : '') + ' disabled> ' + parseInline(taskMatch[2]) + '</li>');
        i++;
        continue;
      }

      // 无序列表项
      var ulMatch = line.match(/^\s*[-*+]\s+(.*)/);
      if (ulMatch && !ordered) {
        items.push('<li>' + parseInline(ulMatch[1]) + '</li>');
        i++;
        continue;
      }

      // 有序列表项
      var olMatch = line.match(/^\s*\d+\.\s+(.*)/);
      if (olMatch && ordered) {
        items.push('<li>' + parseInline(olMatch[1]) + '</li>');
        i++;
        continue;
      }

      break;
    }

    return { html: '<' + tag + '>\n' + items.join('\n') + '\n</' + tag + '>', nextIndex: i };
  }

  /**
   * 解析表格
   */
  function parseTable(lines, startIndex) {
    var headerCells = parseTableRow(lines[startIndex]);
    var alignments = parseAlignments(lines[startIndex + 1]);

    var html = '<table>\n<thead>\n<tr>\n';
    for (var h = 0; h < headerCells.length; h++) {
      var align = alignments[h] ? ' style="text-align:' + alignments[h] + '"' : '';
      html += '<th' + align + '>' + parseInline(headerCells[h].trim()) + '</th>\n';
    }
    html += '</tr>\n</thead>\n<tbody>\n';

    var i = startIndex + 2;
    while (i < lines.length && /^\s*\|/.test(lines[i])) {
      var cells = parseTableRow(lines[i]);
      html += '<tr>\n';
      for (var c = 0; c < cells.length; c++) {
        var a = alignments[c] ? ' style="text-align:' + alignments[c] + '"' : '';
        html += '<td' + a + '>' + parseInline(cells[c].trim()) + '</td>\n';
      }
      html += '</tr>\n';
      i++;
    }

    html += '</tbody>\n</table>\n';
    return { html: html, nextIndex: i };
  }

  /**
   * 解析表格行单元格，去掉首尾 |
   */
  function parseTableRow(line) {
    line = line.trim();
    if (line.charAt(0) === '|') line = line.slice(1);
    if (line.length > 0 && line.charAt(line.length - 1) === '|') line = line.slice(0, -1);
    return line.split('|');
  }

  /**
   * 解析表格对齐方式：:---: 居中  :--- 左对齐  ---: 右对齐
   */
  function parseAlignments(line) {
    var cells = parseTableRow(line);
    var alignments = [];
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i].trim();
      if (/^:-+:$/.test(cell)) {
        // :---: 格式（冒号在两端）→ 居中
        alignments.push('center');
      } else if (/^-+:$/.test(cell)) {
        // ---: 格式（冒号在右）→ 右对齐
        alignments.push('right');
      } else if (/^:-+$/.test(cell)) {
        // :--- 格式（冒号在左）→ 左对齐
        alignments.push('left');
      } else if (/^-+$/.test(cell)) {
        // --- 纯破折号 → 左对齐
        alignments.push('left');
      } else {
        alignments.push(null);
      }
    }
    return alignments;
  }

  // ======================== 主导出函数 ========================

  /**
   * 解析 Markdown 文本为 HTML 字符串
   * @param {string} text
   * @param {object} [options] { highlight: Boolean } 启用代码块语法高亮
   */
  function parseMarkdown(text, options) {
    if (typeof text !== 'string') return '';
    return parseBlocks(text, options || {}).trim();
  }

  return {
    parseMarkdown: parseMarkdown,
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
    addChineseSpaces: addChineseSpaces,
    slugify: slugify,
    extractToc: extractToc,
    highlightCode: highlightCode
  };
}));
