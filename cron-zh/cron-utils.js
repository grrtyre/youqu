window.CronUtils = (function () {
  'use strict';

  var MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var DOW_NAMES = ['周日','周一','周二','周三','周四','周五','周六'];

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysIn(y, m) { return m === 1 && isLeap(y) ? 29 : MONTH_DAYS[m]; }

  function parseSingleField(token, min, max) {
    if (token === '*') {
      var all = [];
      for (var i = min; i <= max; i++) all.push(i);
      return { ok: true, values: all };
    }

    // Check for L or # (special extensions)
    if (token === 'L' || token.indexOf('#') !== -1 || (token.length > 1 && token.charAt(token.length - 1) === 'L')) {
      return { ok: true, special: token };
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

      if (rangePart === '*') {
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

  function parseCron(expr) {
    if (typeof expr !== 'string') return { ok: false, error: '表达式必须为字符串' };
    var parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return { ok: false, error: '需要5个字段，实际' + parts.length + '个' };

    var fieldDefs = [
      { name: 'minute', min: 0, max: 59 },
      { name: 'hour', min: 0, max: 23 },
      { name: 'dom', min: 1, max: 31 },
      { name: 'month', min: 1, max: 12 },
      { name: 'dow', min: 0, max: 7 }
    ];

    var fields = {};
    for (var i = 0; i < 5; i++) {
      var r = parseSingleField(parts[i], fieldDefs[i].min, fieldDefs[i].max);
      if (!r.ok) return { ok: false, error: fieldDefs[i].name + ': ' + r.error };
      fields[fieldDefs[i].name] = r.special || r.values;
    }

    // Normalize dow: treat 7 as 0 (Sunday)
    if (Array.isArray(fields.dow)) {
      var norm = [];
      for (var d = 0; d < fields.dow.length; d++) {
        norm.push(fields.dow[d] === 7 ? 0 : fields.dow[d]);
      }
      fields.dow = norm;
    }

    return { ok: true, fields: fields };
  }

  function describeCron(expr) {
    var parsed = parseCron(expr);
    if (!parsed.ok) return '无效表达式: ' + parsed.error;

    var f = parsed.fields;
    var parts = [];

    // Month
    if (!Array.isArray(f.month) || f.month.length < 12) {
      if (Array.isArray(f.month)) {
        var ms = [];
        for (var i = 0; i < f.month.length; i++) ms.push(MONTH_NAMES[f.month[i] - 1]);
        parts.push(ms.join(','));
      } else {
        parts.push(String(f.month));
      }
    }

    // DOM / DOW
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

    // Time
    var timeStr = '';
    if (Array.isArray(f.minute) && f.minute.length === 1 &&
        Array.isArray(f.hour) && f.hour.length === 1) {
      timeStr = pad(f.hour[0]) + ':' + pad(f.minute[0]);
    } else if (Array.isArray(f.hour) && f.hour.length === 1) {
      timeStr = pad(f.hour[0]) + ':' + describeList(f.minute);
    } else if (Array.isArray(f.minute) && f.minute.length === 1) {
      timeStr = describeList(f.hour) + '时' + pad(f.minute[0]) + '分';
    } else {
      timeStr = describeList(f.hour) + '时' + describeList(f.minute) + '分';
    }

    return parts.join(' ') + ' ' + timeStr;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function describeList(arr) {
    if (!Array.isArray(arr)) return '*';
    if (arr.length <= 4) return arr.join(',');
    return arr[0] + '到' + arr[arr.length - 1];
  }

  function fieldMatches(field, value) {
    if (!Array.isArray(field)) return true;
    for (var i = 0; i < field.length; i++) {
      if (field[i] === value) return true;
    }
    return false;
  }

  function nextRun(expr, fromDate, count) {
    var parsed = parseCron(expr);
    if (!parsed.ok) throw new Error('Invalid cron: ' + parsed.error);
    if (typeof fromDate === 'undefined' || fromDate === null) fromDate = new Date();
    if (typeof count === 'undefined' || count === null) count = 5;

    var f = parsed.fields;
    var results = [];
    var d = new Date(fromDate.getTime() + 60000); // start from next minute
    d.setSeconds(0);
    d.setMilliseconds(0);

    var safety = 0;
    while (results.length < count && safety < 500000) {
      safety++;

      // Month check
      if (!fieldMatches(f.month, d.getMonth() + 1)) {
        d = nextMonth(d);
        continue;
      }

      // Day logic: OR when both dom and dow are restricted
      var domRestricted = Array.isArray(f.dom) && f.dom.length < 31;
      var dowRestricted = Array.isArray(f.dow) && f.dow.length < 7;
      var dayOk = true;

      if (domRestricted && dowRestricted) {
        // OR: either dom matches OR dow matches
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

      // Hour check
      if (!fieldMatches(f.hour, d.getHours())) {
        // Jump to next valid hour
        var nextH = nextValidInField(f.hour, d.getHours(), 0, 23);
        if (nextH < 0) {
          d.setDate(d.getDate() + 1);
          d.setHours(0, 0, 0, 0);
        } else {
          d.setHours(nextH, 0, 0, 0);
        }
        continue;
      }

      // Minute check
      if (!fieldMatches(f.minute, d.getMinutes())) {
        var nextM = nextValidInField(f.minute, d.getMinutes(), 0, 59);
        if (nextM < 0) {
          // Next hour
          var nh = nextValidInField(f.hour, d.getHours() + 1, 0, 23);
          if (nh < 0) {
            d.setDate(d.getDate() + 1);
            d.setHours(0, 0, 0, 0);
          } else {
            d.setHours(nh, 0, 0, 0);
          }
        } else {
          d.setMinutes(nextM);
        }
        continue;
      }

      results.push(new Date(d.getTime()));
      d.setMinutes(d.getMinutes() + 1);
    }

    return results;
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

  return {
    parse: parseCron,
    describe: describeCron,
    nextRun: nextRun
  };
})();