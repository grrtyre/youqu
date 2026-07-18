window.CronUtils = (function () {
  'use strict';

  var MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var DOW_NAMES = ['周日','周一','周二','周三','周四','周五','周六'];

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysIn(y, m) { return m === 1 && isLeap(y) ? 29 : MONTH_DAYS[m]; }

  // 解析单个字段
  // allowQuestion: 是否允许 Quartz 的 "?" 标记（仅 dom/dow 允许）
  function parseSingleField(token, min, max, allowQuestion) {
    // Quartz "?" 标记：表示"不指定"，仅 dom/dow 合法，语义等同 *（全选），但展示为 ?
    if (token === '?') {
      if (!allowQuestion) {
        return { ok: false, error: '"?" 仅可用于日(day-of-month)和周(day-of-week)字段' };
      }
      var allq = [];
      for (var qi = min; qi <= max; qi++) allq.push(qi);
      return { ok: true, values: allq, unspecified: true };
    }

    if (token === '*') {
      var all = [];
      for (var i = min; i <= max; i++) all.push(i);
      return { ok: true, values: all };
    }

    // L / # 是 Quartz 扩展（如 "L" 最后一天、"1#3" 第三个周一）
    // 本工具暂不支持，明确报错，避免静默产生错误结果
    if (token === 'L' || token.indexOf('#') !== -1 || (token.length > 1 && token.charAt(token.length - 1) === 'L')) {
      return { ok: false, error: '暂不支持特殊字符 L/#（Quartz 扩展），请改用具体数值' };
    }

    var values = {};
    var parts = token.split(',');
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p].trim();
      if (part === '') return { ok: false, error: '空字段段' };

      var stepIdx = part.indexOf('/');
      var rangePart = stepIdx !== -1 ? part.substring(0, stepIdx) : part;
      var step = null;
      if (stepIdx !== -1) {
        var stepStr = part.substring(stepIdx + 1);
        if (!/^\d+$/.test(stepStr) || parseInt(stepStr, 10) === 0) {
          return { ok: false, error: '无效步长: ' + stepStr };
        }
        step = parseInt(stepStr, 10);
      }

      if (rangePart === '*' || rangePart === '?') {
        for (var v = min; v <= max; v += (step || 1)) values[v] = true;
      } else if (rangePart.indexOf('-') !== -1) {
        var rp = rangePart.split('-');
        if (rp.length !== 2 || !/^\d+$/.test(rp[0]) || !/^\d+$/.test(rp[1])) {
          return { ok: false, error: '无效范围: ' + rangePart };
        }
        var s = parseInt(rp[0], 10), e = parseInt(rp[1], 10);
        if (s < min || e > max || s > e) {
          return { ok: false, error: '范围越界: ' + rangePart + ' (有效:' + min + '-' + max + ')' };
        }
        for (var w = s; w <= e; w += (step || 1)) values[w] = true;
      } else if (/^\d+$/.test(rangePart)) {
        var n = parseInt(rangePart, 10);
        if (n < min || n > max) return { ok: false, error: '值越界: ' + n + ' (有效:' + min + '-' + max + ')' };
        if (step) {
          for (var t = n; t <= max; t += step) values[t] = true;
        } else {
          values[n] = true;
        }
      } else {
        return { ok: false, error: '无效字段: ' + rangePart };
      }
    }

    var result = [];
    for (var k in values) result.push(parseInt(k, 10));
    result.sort(function (a, b) { return a - b; });
    return { ok: true, values: result };
  }

  // 解析 cron 表达式：自动识别 5 字段（标准）或 6 字段（带秒，Quartz/Spring）
  function parseCron(expr) {
    if (typeof expr !== 'string') return { ok: false, error: '表达式必须为字符串' };
    var parts = expr.trim().split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) {
      return { ok: false, error: '需要5或6个字段，实际' + parts.length + '个' };
    }

    var hasSeconds = parts.length === 6;
    var secPart = hasSeconds ? parts[0] : null;
    var fieldTokens = hasSeconds ? parts.slice(1) : parts;

    // 字段定义（5 个标准字段）
    var fieldDefs = [
      { name: 'minute', min: 0, max: 59, allowQ: false },
      { name: 'hour',   min: 0, max: 23, allowQ: false },
      { name: 'dom',    min: 1, max: 31, allowQ: true  },
      { name: 'month',  min: 1, max: 12, allowQ: false },
      { name: 'dow',    min: 0, max: 7,  allowQ: true  }
    ];

    var fields = {};
    var unspecified = { dom: false, dow: false };

    for (var i = 0; i < 5; i++) {
      var def = fieldDefs[i];
      var r = parseSingleField(fieldTokens[i], def.min, def.max, def.allowQ);
      if (!r.ok) return { ok: false, error: def.name + ': ' + r.error };
      fields[def.name] = r.values;
      if (r.unspecified) unspecified[def.name] = true;
    }

    // 秒字段（6 字段模式）
    if (hasSeconds) {
      var rs = parseSingleField(secPart, 0, 59, false);
      if (!rs.ok) return { ok: false, error: 'second: ' + rs.error };
      fields.second = rs.values;
    }

    // 规范化 dow：7 视为 0（周日）
    if (Array.isArray(fields.dow)) {
      var norm = [];
      for (var d = 0; d < fields.dow.length; d++) {
        norm.push(fields.dow[d] === 7 ? 0 : fields.dow[d]);
      }
      // 去重（7 和 0 可能同时出现）
      var seen = {};
      var dedup = [];
      for (var dd = 0; dd < norm.length; dd++) {
        if (!seen[norm[dd]]) { seen[norm[dd]] = true; dedup.push(norm[dd]); }
      }
      dedup.sort(function (a, b) { return a - b; });
      fields.dow = dedup;
    }

    return { ok: true, fields: fields, hasSeconds: hasSeconds, unspecified: unspecified };
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function describeList(arr) {
    if (!Array.isArray(arr)) return '*';
    if (arr.length <= 4) return arr.join(',');
    return arr[0] + '到' + arr[arr.length - 1];
  }

  // 判断数组是否为等差数列（步长 > 1），用于把 "0,10,20,30,40,50" 简化为 "每10"
  function detectStep(arr) {
    if (!Array.isArray(arr) || arr.length < 3) return 0;
    var step = arr[1] - arr[0];
    if (step <= 1) return 0;
    for (var i = 2; i < arr.length; i++) {
      if (arr[i] - arr[i - 1] !== step) return 0;
    }
    return step;
  }

  function describeCron(expr) {
    var parsed = parseCron(expr);
    if (!parsed.ok) return '无效表达式: ' + parsed.error;

    var f = parsed.fields;
    var hasSeconds = parsed.hasSeconds;
    var parts = [];

    // 月份
    if (Array.isArray(f.month) && f.month.length < 12) {
      var ms = [];
      for (var i = 0; i < f.month.length; i++) ms.push(MONTH_NAMES[f.month[i] - 1]);
      parts.push(ms.join(','));
    }

    // 日 / 周
    var hasDom = Array.isArray(f.dom) && f.dom.length < 31;
    var hasDow = Array.isArray(f.dow) && f.dow.length < 7;

    if (hasDom && hasDow) {
      var ds = [];
      for (var d = 0; d < f.dom.length; d++) ds.push(f.dom[d] + '日');
      parts.push(ds.join(','));
      var ws = [];
      for (var w = 0; w < f.dow.length; w++) ws.push(DOW_NAMES[f.dow[w]]);
      parts.push(ws.join(','));
    } else if (hasDom) {
      if (f.dom.length === 1) {
        parts.push(f.dom[0] === 1 ? '每月1号' : f.dom[0] + '号');
      } else {
        var ds2 = [];
        for (var d2 = 0; d2 < f.dom.length; d2++) ds2.push(f.dom[d2] + '日');
        parts.push(ds2.join(','));
      }
    } else if (hasDow) {
      if (f.dow.length === 1) {
        parts.push('每' + DOW_NAMES[f.dow[0]]);
      } else {
        var ws2 = [];
        for (var w2 = 0; w2 < f.dow.length; w2++) ws2.push(DOW_NAMES[f.dow[w2]]);
        parts.push(ws2.join(','));
      }
    } else {
      parts.push('每天');
    }

    // 时分
    var timeStr = '';
    if (Array.isArray(f.minute) && f.minute.length === 1 &&
        Array.isArray(f.hour) && f.hour.length === 1) {
      timeStr = pad(f.hour[0]) + ':' + pad(f.minute[0]);
    } else if (Array.isArray(f.hour) && f.hour.length === 1) {
      timeStr = pad(f.hour[0]) + ':' + describeList(f.minute) + '分';
    } else if (Array.isArray(f.minute) && f.minute.length === 1) {
      timeStr = describeList(f.hour) + '时' + pad(f.minute[0]) + '分';
    } else {
      timeStr = describeList(f.hour) + '时' + describeList(f.minute) + '分';
    }

    // 秒（仅 6 字段模式）
    var secStr = '';
    if (hasSeconds) {
      var sec = f.second;
      if (Array.isArray(sec) && sec.length === 60) {
        secStr = ' 每秒';
      } else if (Array.isArray(sec) && sec.length === 1) {
        // 单个秒值：若时间为 HH:MM 形式，扩展为 HH:MM:SS
        if (/^\d{2}:\d{2}$/.test(timeStr)) {
          timeStr = timeStr + ':' + pad(sec[0]);
        } else {
          secStr = ' ' + sec[0] + '秒';
        }
      } else if (Array.isArray(sec)) {
        var st = detectStep(sec);
        if (st > 0) {
          secStr = ' 每' + st + '秒';
        } else {
          secStr = ' 第' + sec.join(',') + '秒';
        }
      }
    }

    return parts.join(' ') + ' ' + timeStr + secStr;
  }

  function fieldMatches(field, value) {
    if (!Array.isArray(field)) return true;
    for (var i = 0; i < field.length; i++) {
      if (field[i] === value) return true;
    }
    return false;
  }

  function nextValidInField(field, current, min, max) {
    if (!Array.isArray(field)) return current <= max ? current : -1;
    for (var i = 0; i < field.length; i++) {
      if (field[i] >= current) return field[i];
    }
    return -1;
  }

  function nextMonth(d) {
    var y = d.getFullYear();
    var m = d.getMonth(); // 0-11
    if (m === 11) { y++; m = 0; } else { m++; }
    return new Date(y, m, 1, 0, 0, 0, 0);
  }

  // 计算接下来 count 次执行时间
  // 5 字段：精确到分钟；6 字段：精确到秒
  function nextRun(expr, fromDate, count) {
    var parsed = parseCron(expr);
    if (!parsed.ok) throw new Error('Invalid cron: ' + parsed.error);
    if (typeof fromDate === 'undefined' || fromDate === null) fromDate = new Date();
    if (typeof count === 'undefined' || count === null) count = 5;

    var f = parsed.fields;
    var hasSeconds = parsed.hasSeconds;
    var secField = hasSeconds ? f.second : null;

    var results = [];
    // 6 字段从下一秒开始；5 字段从下一分钟开始
    var d = new Date(fromDate.getTime() + (hasSeconds ? 1000 : 60000));
    d.setMilliseconds(0);
    if (!hasSeconds) d.setSeconds(0);

    var safety = 0;
    while (results.length < count && safety < 500000) {
      safety++;

      // 月份
      if (!fieldMatches(f.month, d.getMonth() + 1)) {
        d = nextMonth(d);
        continue;
      }

      // 日逻辑：dom 和 dow 同时受限时为 OR 关系
      var domRestricted = Array.isArray(f.dom) && f.dom.length < 31;
      var dowRestricted = Array.isArray(f.dow) && f.dow.length < 7;
      var dayOk = true;

      if (domRestricted && dowRestricted) {
        var domMatch = fieldMatches(f.dom, d.getDate());
        var dowMatch = fieldMatches(f.dow, d.getDay());
        dayOk = domMatch || dowMatch;
      } else if (domRestricted) {
        dayOk = fieldMatches(f.dom, d.getDate());
      } else if (dowRestricted) {
        dayOk = fieldMatches(f.dow, d.getDay());
      }

      if (!dayOk) {
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
        continue;
      }

      // 小时
      if (!fieldMatches(f.hour, d.getHours())) {
        var nextH = nextValidInField(f.hour, d.getHours(), 0, 23);
        if (nextH < 0) {
          d.setDate(d.getDate() + 1);
          d.setHours(0, 0, 0, 0);
        } else {
          d.setHours(nextH, 0, 0, 0);
        }
        continue;
      }

      // 分钟
      if (!fieldMatches(f.minute, d.getMinutes())) {
        var nextM = nextValidInField(f.minute, d.getMinutes(), 0, 59);
        if (nextM < 0) {
          var nh = nextValidInField(f.hour, d.getHours() + 1, 0, 23);
          if (nh < 0) {
            d.setDate(d.getDate() + 1);
            d.setHours(0, 0, 0, 0);
          } else {
            d.setHours(nh, 0, 0, 0);
          }
        } else {
          // setMinutes(min, sec, ms)：跳到下一个匹配分钟并重置秒/毫秒
          d.setMinutes(nextM, 0, 0);
        }
        continue;
      }

      // 秒（6 字段模式）
      if (hasSeconds) {
        var curSec = d.getSeconds();
        var hits = [];
        for (var si = 0; si < secField.length; si++) {
          if (secField[si] >= curSec) hits.push(secField[si]);
        }
        if (hits.length === 0) {
          // 当前分钟内无匹配秒，进入下一分钟
          d.setMinutes(d.getMinutes() + 1, 0, 0);
          continue;
        }
        for (var hj = 0; hj < hits.length && results.length < count; hj++) {
          d.setSeconds(hits[hj]);
          results.push(new Date(d.getTime()));
        }
        d.setMinutes(d.getMinutes() + 1, 0, 0);
      } else {
        results.push(new Date(d.getTime()));
        d.setMinutes(d.getMinutes() + 1, 0, 0);
      }
    }

    return results;
  }

  // 将选中的值数组智能还原为 cron 字段 token
  // 规则：空或全选 -> '*'；单值 -> 'n'；连续范围 -> 'a-b'；
  //       从 min 开始的等差 -> '*/step'；其它等差 -> 'first/step'；否则 -> 逗号列表
  function buildToken(values, min, max) {
    if (!Array.isArray(values) || values.length === 0) return '*';
    // 去重 + 升序排序
    var v = values.slice().sort(function (a, b) { return a - b; });
    var uniq = [];
    for (var i = 0; i < v.length; i++) {
      if (uniq.length === 0 || uniq[uniq.length - 1] !== v[i]) uniq.push(v[i]);
    }
    v = uniq;
    var total = max - min + 1;
    if (v.length === total) return '*';
    if (v.length === 1) return String(v[0]);

    // 连续范围
    var isContiguous = true;
    for (var j = 1; j < v.length; j++) {
      if (v[j] - v[j - 1] !== 1) { isContiguous = false; break; }
    }
    if (isContiguous) return v[0] + '-' + v[v.length - 1];

    // 等差数列：步长 > 1，且最后一个值 + 步长 > max（即精确填满到末尾）
    if (v.length >= 2) {
      var step = v[1] - v[0];
      if (step > 1) {
        var isStep = true;
        for (var k = 2; k < v.length; k++) {
          if (v[k] - v[k - 1] !== step) { isStep = false; break; }
        }
        if (isStep && v[0] >= min && v[v.length - 1] + step > max) {
          if (v[0] === min) return '*/' + step;
          return v[0] + '/' + step;
        }
      }
    }

    // 默认：逗号列表
    return v.join(',');
  }

  // 统计 [start, end) 时间区间内的执行次数
  // 返回 { count, runs, capped }，capped=true 表示触发 maxCount 上限
  // 用于"调度节奏"卡片：今日/本周/本月剩余次数、24小时每小时分布等
  function runsInRange(expr, start, end, maxCount) {
    if (typeof maxCount !== 'number' || maxCount <= 0) maxCount = 2000;
    var parsed = parseCron(expr);
    if (!parsed.ok) return { count: 0, runs: [], capped: false, error: parsed.error };

    var hasSeconds = parsed.hasSeconds;
    var results = [];
    // 从 start 前一刻开始，确保能命中 start 本身
    var d = new Date(start.getTime() - (hasSeconds ? 1000 : 60000));
    d.setMilliseconds(0);
    if (!hasSeconds) d.setSeconds(0);

    var safety = 0;
    while (results.length < maxCount && safety < 500000) {
      safety++;
      var next = nextRun(expr, d, 1);
      if (!next || next.length === 0) break;
      var nd = next[0];
      if (nd.getTime() >= end.getTime()) break;
      if (nd.getTime() >= start.getTime()) results.push(nd);
      d = new Date(nd.getTime());
    }
    return { count: results.length, runs: results, capped: results.length >= maxCount };
  }

  return {
    parse: parseCron,
    describe: describeCron,
    nextRun: nextRun,
    buildToken: buildToken,
    runsInRange: runsInRange
  };
})();
