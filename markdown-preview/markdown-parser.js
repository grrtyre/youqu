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
   */
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ======================== 中文排版优化 ========================

  /**
   * 中英文之间自动插入空格
   * 汉字与 ASCII 字母/数字之间加半角空格
   */
  function addChineseSpaces(text) {
    text = text.replace(/([\u4e00-\u9fff\u3400-\u4dbf])([a-zA-Z0-9])/g, '$1 $2');
    text = text.replace(/([a-zA-Z0-9])([\u4e00-\u9fff\u3400-\u4dbf])/g, '$1 $2');
    return text;
  }

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
   */
  function parseBlocks(text) {
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
        var langClass = lang ? ' class="language-' + escapeHtml(lang) + '"' : '';
        html += '<pre><code' + langClass + '>' + escapeHtml(codeLines.join('\n')) + '</code></pre>\n';
        continue;
      }

      // --- 引用块 ---
      if (/^\s*>\s?/.test(line)) {
        var quoteLines = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html += '<blockquote>' + parseBlocks(quoteLines.join('\n')).trim() + '</blockquote>';
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
   */
  function parseMarkdown(text) {
    if (typeof text !== 'string') return '';
    return parseBlocks(text).trim();
  }

  return {
    parseMarkdown: parseMarkdown,
    escapeHtml: escapeHtml,
    addChineseSpaces: addChineseSpaces
  };
}));
