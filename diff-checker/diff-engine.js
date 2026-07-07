/* ==================== 文本对比管家 · 核心 diff 引擎 ====================
 * 纯算法模块，无 DOM 依赖，可被浏览器和 Node.js 同时使用。
 * - 行级 diff：基于 LCS 动态规划
 * - 字符级 diff：对相邻 changed 行对做字符级 LCS
 * - 统一格式：以"块"为单位输出，便于渲染并排/内联视图
 * ============================================================ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DiffEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  // ---------- 工具函数 ----------
  function isObj(v) { return v && typeof v === 'object'; }

  // 按行切分文本（保留空行；统一换行符）
  function splitLines(text) {
    if (text == null) return [];
    // 统一 CRLF / CR 为 LF
    var normalized = String(text).replace(/\r\n?/g, '\n');
    // 末尾换行不产生额外空行
    if (normalized.charAt(normalized.length - 1) === '\n') {
      normalized = normalized.slice(0, -1);
    }
    return normalized.length === 0 ? [] : normalized.split('\n');
  }

  // 字符级 LCS，返回 diff 段数组
  // 每段：{ type: 'equal'|'add'|'del', text: string }
  // 按 Unicode 码点切分（Array.from），正确处理 emoji 等代理对字符
  function charDiff(a, b) {
    a = a == null ? '' : String(a);
    b = b == null ? '' : String(b);
    if (a === b) return [{ type: 'equal', text: a }];
    if (a.length === 0) return [{ type: 'add', text: b }];
    if (b.length === 0) return [{ type: 'del', text: a }];

    // 按码点切分，避免 emoji 代理对被拆成两个半位
    var aChars = Array.from(a);
    var bChars = Array.from(b);
    var n = aChars.length, m = bChars.length;

    // 大小保护：与 lineDiff 一致的 500 万 cell 上限，防止长行卡死浏览器
    var MAX_CELLS = 5000000;
    if ((n + 1) * (m + 1) > MAX_CELLS) {
      // 退化为整体替换（先删后增）
      return [
        { type: 'del', text: a },
        { type: 'add', text: b }
      ];
    }

    // dp[i][j] = LCS 长度
    var dp = [];
    for (var i = 0; i <= n; i++) {
      dp.push(new Array(m + 1).fill(0));
    }
    for (i = 1; i <= n; i++) {
      for (var j = 1; j <= m; j++) {
        if (aChars[i - 1] === bChars[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // 回溯（逆序收集，reverse 后 del 在前、add 在后）
    var segments = [];
    i = n; j = m;
    while (i > 0 && j > 0) {
      if (aChars[i - 1] === bChars[j - 1]) {
        segments.push({ type: 'equal', text: aChars[i - 1] });
        i--; j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        segments.push({ type: 'del', text: aChars[i - 1] });
        i--;
      } else {
        segments.push({ type: 'add', text: bChars[j - 1] });
        j--;
      }
    }
    while (i > 0) { segments.push({ type: 'del', text: aChars[i - 1] }); i--; }
    while (j > 0) { segments.push({ type: 'add', text: bChars[j - 1] }); j--; }
    segments.reverse();

    // 合并相邻同类型段
    var merged = [];
    for (var k = 0; k < segments.length; k++) {
      var s = segments[k];
      var last = merged[merged.length - 1];
      if (last && last.type === s.type) {
        last.text += s.text;
      } else {
        merged.push({ type: s.type, text: s.text });
      }
    }
    return merged;
  }

  // 行级 LCS diff
  // 返回操作序列：[{ type: 'equal'|'add'|'del', lines: string[] }]
  function lineDiff(aLines, bLines) {
    var n = aLines.length, m = bLines.length;
    // 滚动数组优化空间：只需两行
    // 但为了回溯，需要完整 dp 表。文本对比场景下 N 通常较小，可接受 O(n*m) 空间。
    // 对超大输入做保护。
    var MAX_CELLS = 5000000; // 500 万 cell 上限
    if ((n + 1) * (m + 1) > MAX_CELLS) {
      // 退化为整体替换
      var ops = [];
      if (n > 0) ops.push({ type: 'del', lines: aLines.slice() });
      if (m > 0) ops.push({ type: 'add', lines: bLines.slice() });
      return ops;
    }

    var dp = [];
    for (var i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (i = 1; i <= n; i++) {
      for (var j = 1; j <= m; j++) {
        if (aLines[i - 1] === bLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // 回溯，逆序收集
    var ops = [];
    i = n; j = m;
    while (i > 0 && j > 0) {
      if (aLines[i - 1] === bLines[j - 1]) {
        ops.push({ type: 'equal', lines: [aLines[i - 1]] });
        i--; j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        ops.push({ type: 'del', lines: [aLines[i - 1]] });
        i--;
      } else {
        ops.push({ type: 'add', lines: [bLines[j - 1]] });
        j--;
      }
    }
    while (i > 0) { ops.push({ type: 'del', lines: [aLines[i - 1]] }); i--; }
    while (j > 0) { ops.push({ type: 'add', lines: [bLines[j - 1]] }); j--; }
    ops.reverse();

    // 合并相邻同类型
    var merged = [];
    for (var k = 0; k < ops.length; k++) {
      var op = ops[k];
      var last = merged[merged.length - 1];
      if (last && last.type === op.type) {
        last.lines = last.lines.concat(op.lines);
      } else {
        merged.push({ type: op.type, lines: op.lines.slice() });
      }
    }
    return merged;
  }

  // 将行级 ops 渲染为"并排版块"
  // 每个 block: { type: 'equal'|'modify'|'add'|'del',
  //   left: [{text, charDiffs?}], right: [{text, charDiffs?}] }
  function toSideBySideBlocks(ops) {
    var blocks = [];
    var i = 0;
    while (i < ops.length) {
      var op = ops[i];
      if (op.type === 'equal') {
        // 相同行成对
        for (var k = 0; k < op.lines.length; k++) {
          blocks.push({
            type: 'equal',
            left: [{ text: op.lines[k] }],
            right: [{ text: op.lines[k] }]
          });
        }
        i++;
      } else if (op.type === 'add') {
        // 右侧新增
        for (var k2 = 0; k2 < op.lines.length; k2++) {
          blocks.push({
            type: 'add',
            left: [{ text: '' }],
            right: [{ text: op.lines[k2] }]
          });
        }
        i++;
      } else if (op.type === 'del') {
        // 看下一个是不是 add，是则配对为 modify
        var next = ops[i + 1];
        if (next && next.type === 'add') {
          // 配对成 modify 块，做字符级 diff
          var delLines = op.lines;
          var addLines = next.lines;
          var pairCount = Math.max(delLines.length, addLines.length);
          for (var p = 0; p < pairCount; p++) {
            // 用 hasDel/hasAdd 显式区分"无对应行"与"对应行是空字符串"
            // 此前用 dl !== '' 判断会把"删除一个空行"误判为 add 块，导致空行删除被静默丢弃
            var hasDel = p < delLines.length;
            var hasAdd = p < addLines.length;
            var dl = hasDel ? delLines[p] : '';
            var al = hasAdd ? addLines[p] : '';
            if (hasDel && hasAdd) {
              // 双侧都有行（含空字符串），做字符级 diff
              blocks.push({
                type: 'modify',
                left: [{ text: dl, charDiffs: charDiff(dl, al) }],
                right: [{ text: al, charDiffs: charDiff(dl, al) }]
              });
            } else if (hasDel) {
              blocks.push({ type: 'del', left: [{ text: dl }], right: [{ text: '' }] });
            } else {
              blocks.push({ type: 'add', left: [{ text: '' }], right: [{ text: al }] });
            }
          }
          i += 2;
        } else {
          for (var k3 = 0; k3 < op.lines.length; k3++) {
            blocks.push({ type: 'del', left: [{ text: op.lines[k3] }], right: [{ text: '' }] });
          }
          i++;
        }
      } else {
        i++;
      }
    }
    return blocks;
  }

  // 内联视图块：单一序列，每行 { type, text, baseText?, charDiffs? }
  function toInlineBlocks(ops) {
    var blocks = [];
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      for (var k = 0; k < op.lines.length; k++) {
        var line = op.lines[k];
        if (op.type === 'equal') {
          blocks.push({ type: 'equal', text: line });
        } else if (op.type === 'add') {
          blocks.push({ type: 'add', text: line });
        } else if (op.type === 'del') {
          blocks.push({ type: 'del', text: line });
        }
      }
    }
    return blocks;
  }

  // 统计
  function stats(ops) {
    var added = 0, deleted = 0, unchanged = 0;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op.type === 'add') added += op.lines.length;
      else if (op.type === 'del') deleted += op.lines.length;
      else if (op.type === 'equal') unchanged += op.lines.length;
    }
    return { added: added, deleted: deleted, unchanged: unchanged };
  }

  // 主入口：对比两段文本
  // options: { ignoreCase: bool, trimWhitespace: bool, ignoreBlankLines: bool }
  function compare(textA, textB, options) {
    options = options || {};
    var aLines = splitLines(textA);
    var bLines = splitLines(textB);

    // 预处理：根据选项归一化用于"比较"的行，但保留原始行用于展示
    function normalize(line) {
      var n = line;
      if (options.ignoreCase) n = n.toLowerCase();
      if (options.trimWhitespace) n = n.replace(/\s+/g, ' ').trim();
      return n;
    }

    // 用归一化后的行做比较；但 LCS 回溯需要保持行序
    // 简化做法：直接对原始行做比较，但比较时用归一化值
    // 这里实现一个支持自定义 equals 的 LCS
    var n = aLines.length, m = bLines.length;
    var MAX_CELLS = 5000000;
    if ((n + 1) * (m + 1) > MAX_CELLS) {
      var ops2 = [];
      if (n > 0) ops2.push({ type: 'del', lines: aLines.slice() });
      if (m > 0) ops2.push({ type: 'add', lines: bLines.slice() });
      return buildResult(ops2);
    }

    var normA = aLines.map(normalize);
    var normB = bLines.map(normalize);

    // 如果忽略空行：在比较时空行视为"等价"，但仍保留展示
    // 这里简化：不专门处理 ignoreBlankLines，留给上层

    var dp = [];
    for (var i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (i = 1; i <= n; i++) {
      for (var j = 1; j <= m; j++) {
        if (normA[i - 1] === normB[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    var ops = [];
    i = n; j = m;
    while (i > 0 && j > 0) {
      if (normA[i - 1] === normB[j - 1]) {
        ops.push({ type: 'equal', lines: [aLines[i - 1]] });
        i--; j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        ops.push({ type: 'del', lines: [aLines[i - 1]] });
        i--;
      } else {
        ops.push({ type: 'add', lines: [bLines[j - 1]] });
        j--;
      }
    }
    while (i > 0) { ops.push({ type: 'del', lines: [aLines[i - 1]] }); i--; }
    while (j > 0) { ops.push({ type: 'add', lines: [bLines[j - 1]] }); j--; }
    ops.reverse();

    // 合并相邻同类型
    var merged = [];
    for (var k = 0; k < ops.length; k++) {
      var op = ops[k];
      var last = merged[merged.length - 1];
      if (last && last.type === op.type) {
        last.lines = last.lines.concat(op.lines);
      } else {
        merged.push({ type: op.type, lines: op.lines.slice() });
      }
    }
    return buildResult(merged);
  }

  function buildResult(ops) {
    return {
      ops: ops,
      blocks: toSideBySideBlocks(ops),
      inline: toInlineBlocks(ops),
      stats: stats(ops)
    };
  }

  // 统一 diff（unified format）文本生成
  // 实现标准 unified diff 算法：每个 hunk 包含至多 ctx 行前导上下文 + 改动行 + 至多 ctx 行后继上下文
  // 相邻改动之间若相同行数 > 2*ctx 则分割为多个 hunk；否则合并到同一 hunk
  function toUnifiedDiff(textA, textB, options) {
    options = options || {};
    var headerA = options.headerA || '原文本';
    var headerB = options.headerB || '新文本';
    var ctx = options.context != null ? options.context : 3;
    var result = compare(textA, textB, options);
    var lines = [];
    lines.push('--- ' + headerA);
    lines.push('+++ ' + headerB);

    var ops = result.ops;
    // aLineNo / bLineNo：0-based，指向"下一个待处理行"的位置
    // 注意：pending 中的行不计入 aLineNo/bLineNo，直到被分配给某个 hunk 时才计入
    var aLineNo = 0, bLineNo = 0;
    var hunks = []; // 每个 hunk: { aStart, bStart, lines: [] }
    var current = null;
    // pending：上一个 equal 段末尾的至多 ctx 行，作为下一个 hunk 的前导上下文
    var pending = [];
    // pendingStartA/B：pending 第一行在 A/B 中的 0-based 行号
    var pendingStartA = 0, pendingStartB = 0;

    function flush() {
      if (current && current.lines.length) hunks.push(current);
      current = null;
    }

    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];

      if (op.type === 'equal') {
        var eqLines = op.lines;
        if (!current) {
          // 没有正在进行的 hunk：保留最后 ctx 行作为潜在前导上下文
          var head = Math.max(0, eqLines.length - ctx);
          pendingStartA = aLineNo + head;
          pendingStartB = bLineNo + head;
          pending = eqLines.slice(head);
          // 只把 pending 之前的行计入 aLineNo（pending 行待分配给 hunk 时再计）
          aLineNo += head;
          bLineNo += head;
        } else {
          if (eqLines.length <= 2 * ctx) {
            // 相同段较短：全部并入当前 hunk（可能后续还有改动继续此 hunk）
            for (var k = 0; k < eqLines.length; k++) {
              current.lines.push(' ' + eqLines[k]);
              aLineNo++; bLineNo++;
            }
          } else {
            // 相同段较长：前 ctx 行作为后继上下文加入当前 hunk，然后 flush
            for (var k2 = 0; k2 < ctx; k2++) {
              current.lines.push(' ' + eqLines[k2]);
              aLineNo++; bLineNo++;
            }
            flush();
            // 跳过中间的不变行
            var skip = eqLines.length - 2 * ctx;
            aLineNo += skip;
            bLineNo += skip;
            // 后 ctx 行作为下一个 hunk 的前导上下文（尚未计入 aLineNo）
            pendingStartA = aLineNo;
            pendingStartB = bLineNo;
            pending = eqLines.slice(eqLines.length - ctx);
          }
        }
        continue;
      }

      // add 或 del：开启或继续 hunk
      if (!current) {
        // 用 pending 前导上下文创建新 hunk
        current = {
          aStart: pendingStartA,
          bStart: pendingStartB,
          lines: []
        };
        for (var p = 0; p < pending.length; p++) {
          current.lines.push(' ' + pending[p]);
        }
        // pending 行是 equal 行，在 A 和 B 中都存在，此时计入 aLineNo/bLineNo
        aLineNo += pending.length;
        bLineNo += pending.length;
        pending = [];
      }
      for (var k3 = 0; k3 < op.lines.length; k3++) {
        if (op.type === 'del') {
          current.lines.push('-' + op.lines[k3]);
          aLineNo++;
        } else {
          current.lines.push('+' + op.lines[k3]);
          bLineNo++;
        }
      }
    }
    flush();

    // 输出 hunks
    for (var h = 0; h < hunks.length; h++) {
      var hu = hunks[h];
      var aLen = 0, bLen = 0;
      for (var x = 0; x < hu.lines.length; x++) {
        var c = hu.lines[x].charAt(0);
        if (c === ' ' || c === '-') aLen++;
        if (c === ' ' || c === '+') bLen++;
      }
      // 行号转 1-based；空侧（len=0）时起始号停在插入点（即 0-based 行号，不 +1）
      var aStart = hu.aStart + (aLen > 0 ? 1 : 0);
      var bStart = hu.bStart + (bLen > 0 ? 1 : 0);
      lines.push('@@ -' + aStart + ',' + aLen + ' +' + bStart + ',' + bLen + ' @@');
      for (var y = 0; y < hu.lines.length; y++) lines.push(hu.lines[y]);
    }
    return lines.join('\n');
  }

  // 摘要文本（可复制）
  function summaryText(result) {
    var s = result.stats;
    var lines = [];
    lines.push('对比结果摘要');
    lines.push('─────────────');
    lines.push('新增行：' + s.added);
    lines.push('删除行：' + s.deleted);
    lines.push('未变化：' + s.unchanged);
    lines.push('总差异：' + (s.added + s.deleted));
    lines.push('─────────────');
    lines.push('生成时间：' + new Date().toLocaleString('zh-CN'));
    return lines.join('\n');
  }

  return {
    splitLines: splitLines,
    charDiff: charDiff,
    lineDiff: lineDiff,
    compare: compare,
    toSideBySideBlocks: toSideBySideBlocks,
    toInlineBlocks: toInlineBlocks,
    toUnifiedDiff: toUnifiedDiff,
    stats: stats,
    summaryText: summaryText
  };
}));
