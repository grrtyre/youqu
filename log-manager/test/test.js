'use strict';

/* 日志管家 · 核心逻辑单元测试 */

const C = require('../src/core/log-core.js');

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); console.error('  ✗ ' + msg); }
}

function assertEq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; }
  else { fail++; failures.push(msg + ` (期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)})`); console.error('  ✗ ' + msg + ` (期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)})`); }
}

console.log('--- 日志管家核心逻辑测试 ---\n');

// 1. 级别识别
console.log('[1] 级别识别 detectLevel');
assertEq(C.detectLevel('[INFO] 服务启动'), 'INFO', '中括号 INFO');
assertEq(C.detectLevel('[ERROR] 数据库连接失败'), 'ERROR', '中括号 ERROR');
assertEq(C.detectLevel('[WARN] 内存占用高'), 'WARN', '中括号 WARN');
assertEq(C.detectLevel('[WARNING] 内存占用高'), 'WARN', 'WARNING 归一化为 WARN');
assertEq(C.detectLevel('2024-01-01 12:00:00 DEBUG 加载配置'), 'DEBUG', '时间戳后 DEBUG');
assertEq(C.detectLevel('2024-01-01 12:00:00 INFO 用户登录'), 'INFO', '时间戳后 INFO');
assertEq(C.detectLevel('FATAL 进程崩溃'), 'FATAL', '裸词 FATAL');
assertEq(C.detectLevel('level=error 发生异常'), 'ERROR', 'level=error 小写');
assertEq(C.detectLevel('level=warn 警告'), 'WARN', 'level=warn 小写');
assertEq(C.detectLevel('"level":"info","msg":"ok"'), 'INFO', 'JSON level:info');
assertEq(C.detectLevel('这是一行普通文本'), null, '无级别返回 null');
assertEq(C.detectLevel(''), null, '空字符串返回 null');
assertEq(C.detectLevel(null), null, 'null 返回 null');

// 2. normalizeLevel
console.log('[2] normalizeLevel');
assertEq(C.normalizeLevel('warning'), 'WARN', 'warning -> WARN');
assertEq(C.normalizeLevel('INFO'), 'INFO', 'INFO 保持');
assertEq(C.normalizeLevel('fatal'), 'FATAL', 'fatal -> FATAL');
assertEq(C.normalizeLevel('xyz'), null, '非法级别 null');

// 3. 时间戳识别
console.log('[3] 时间戳识别 detectTimestamp');
assertEq(C.detectTimestamp('2024-01-01 12:00:00 INFO ok'), '2024-01-01 12:00:00', '标准时间戳');
assertEq(C.detectTimestamp('[2024-01-01 12:00:00] INFO ok'), '2024-01-01 12:00:00', '中括号时间戳去括号');
const ts3 = C.detectTimestamp('12:00:00.123 启动');
assert(ts3 && ts3.startsWith('12:00:00'), '时间-only 时间戳: ' + ts3);

// 4. 行解析
console.log('[4] 行解析 parseLine');
const line1 = C.parseLine('2024-01-01 12:00:00 INFO 服务启动成功', 5);
assertEq(line1.lineNo, 5, '行号正确');
assertEq(line1.level, 'INFO', '级别 INFO');
assertEq(line1.timestamp, '2024-01-01 12:00:00', '时间戳');
assert(line1.message.includes('服务启动成功'), '消息含正文: ' + line1.message);

const line2 = C.parseLine('普通文本无级别', 1);
assertEq(line2.level, null, '无级别行');
assertEq(line2.message, '普通文本无级别', '消息回退原文');

// 5. 内容解析
console.log('[5] 内容解析 parseContent');
const content = '2024-01-01 10:00:00 INFO 启动\n2024-01-01 10:00:01 ERROR 崩溃\n2024-01-01 10:00:02 WARN 警告\n';
const lines = C.parseContent(content);
assertEq(lines.length, 3, '3 行（末尾换行不产生空行）');
assertEq(lines[0].level, 'INFO', '第1行 INFO');
assertEq(lines[1].level, 'ERROR', '第2行 ERROR');
assertEq(lines[2].level, 'WARN', '第3行 WARN');
assertEq(lines[1].lineNo, 2, '第2行行号为 2');

// CRLF 兼容
const crlf = C.parseContent('a\r\nb\r\nc');
assertEq(crlf.length, 3, 'CRLF 换行兼容 3 行');
assertEq(crlf[1].raw, 'b', 'CRLF 第2行内容');

// 6. 级别过滤
console.log('[6] 级别过滤 filterByLevel');
const parsed = C.parseContent('INFO a\nERROR b\nWARN c\nDEBUG d\n');
const onlyError = C.filterByLevel(parsed, { TRACE: false, DEBUG: false, INFO: false, WARN: false, ERROR: true, FATAL: true });
assertEq(onlyError.length, 1, '仅 ERROR 1 行');
assertEq(onlyError[0].level, 'ERROR', '过滤结果为 ERROR');

const allEnabled = C.filterByLevel(parsed, { TRACE: true, DEBUG: true, INFO: true, WARN: true, ERROR: true, FATAL: true });
assertEq(allEnabled.length, 4, '全启用返回全部');

const noFilter = C.filterByLevel(parsed, null);
assertEq(noFilter.length, 4, 'null 过滤器返回全部');

// 7. 搜索
console.log('[7] 搜索 searchLines');
const searchSrc = C.parseContent('用户登录成功\n用户登出\n订单创建\n用户登录失败\n');
const r1 = C.searchLines(searchSrc, '登录');
assertEq(r1.matches.length, 2, '搜索"登录"匹配 2 行');
assertEq(r1.matches[0], 0, '第1个匹配在第0行');
assertEq(r1.matches[1], 3, '第2个匹配在第3行');
assert(r1.regex !== null, '返回编译后的正则');

const r2 = C.searchLines(searchSrc, '');
assertEq(r2.matches.length, 0, '空查询返回 0 匹配');
assertEq(r2.regex, null, '空查询返回 null 正则');

// 正则搜索
const r3 = C.searchLines(searchSrc, '登录(成功|失败)', { useRegex: true });
assertEq(r3.matches.length, 2, '正则匹配 2 行');

// 大小写敏感
const mixed = C.parseContent('Hello\nhello\nHELLO\n');
const r4 = C.searchLines(mixed, 'hello', { caseSensitive: false });
assertEq(r4.matches.length, 3, '不区分大小写匹配 3 行');
const r5 = C.searchLines(mixed, 'hello', { caseSensitive: true });
assertEq(r5.matches.length, 1, '区分大小写匹配 1 行');

// 非法正则降级
const r6 = C.searchLines(mixed, '[invalid', { useRegex: true });
assert(r6.regex !== null, '非法正则降级为字面量');

// 8. 统计
console.log('[8] 统计 countByLevel');
const statSrc = C.parseContent('INFO a\nINFO b\nERROR c\nWARN d\nDEBUG e\nFATAL f\n普通行\n');
const counts = C.countByLevel(statSrc);
assertEq(counts.INFO, 2, 'INFO 2');
assertEq(counts.ERROR, 1, 'ERROR 1');
assertEq(counts.WARN, 1, 'WARN 1');
assertEq(counts.FATAL, 1, 'FATAL 1');
assertEq(counts.DEBUG, 1, 'DEBUG 1');
assertEq(counts.UNKNOWN, 1, 'UNKNOWN 1');
assertEq(counts.total, 7, 'total 7');

// 9. 编码检测
console.log('[9] 编码检测 detectEncoding');
const utf8Buf = Buffer.from('中文日志内容', 'utf-8');
assertEq(C.detectEncoding(utf8Buf), 'utf-8', 'UTF-8 检测');
const bomBuf = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('hello', 'utf-8')]);
assertEq(C.detectEncoding(bomBuf), 'utf-8-bom', 'UTF-8 BOM 检测');
const emptyBuf = Buffer.alloc(0);
assertEq(C.detectEncoding(emptyBuf), 'utf-8', '空缓冲返回 utf-8');
const asciiBuf = Buffer.from('plain ascii log', 'utf-8');
assertEq(C.detectEncoding(asciiBuf), 'utf-8', 'ASCII 视为 utf-8');

// 10. 高亮
console.log('[10] 高亮 highlightMatches');
const hl = C.highlightMatches('用户登录成功', /登录/g);
assert(hl.includes('<mark>登录</mark>'), '高亮含 mark 标签: ' + hl);
assert(hl.includes('成功'), '高亮保留未匹配文本: ' + hl);
const hlSafe = C.highlightMatches('<script>alert(1)</script>', null);
assert(hlSafe.includes('&lt;script&gt;'), 'HTML 转义 script 标签: ' + hlSafe);
const hlNull = C.highlightMatches('文本', null);
assertEq(hlNull, '文本', '无正则返回纯转义文本');

// 11. HTML 转义
console.log('[11] HTML 转义 escapeHtml');
assertEq(C.escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;', '转义 <>""');
assertEq(C.escapeHtml('正常文本'), '正常文本', '无特殊字符不变');
assertEq(C.escapeHtml("it's"), "it&#39;s", '转义单引号');

// 12. formatBytes
console.log('[12] formatBytes');
assertEq(C.formatBytes(0), '0 B', '0 B');
assertEq(C.formatBytes(500), '500 B', '500 B');
assertEq(C.formatBytes(1024), '1.0 KB', '1024 -> 1.0 KB');
assertEq(C.formatBytes(1536), '1.5 KB', '1536 -> 1.5 KB');
assertEq(C.formatBytes(1048576), '1.0 MB', '1 MB');
assertEq(C.formatBytes(null), '0 B', 'null -> 0 B');

// 13. levelColor / levelNames
console.log('[13] levelColor / levelNames');
assertEq(C.levelColor('INFO'), '#007aff', 'INFO 颜色');
assertEq(C.levelColor('ERROR'), '#ff3b30', 'ERROR 颜色');
assertEq(C.levelColor(null), '#8e8e93', '未知级别默认色');
const names = C.levelNames();
assertEq(names.length, 6, '6 个级别');
assertEq(names[0], 'TRACE', '首为 TRACE');
assertEq(names[5], 'FATAL', '末为 FATAL');

// 14. escapeRegex
console.log('[14] escapeRegex');
assertEq(C.escapeRegex('a.b*c'), 'a\\.b\\*c', '转义 . 和 *');
assertEq(C.escapeRegex('[test]'), '\\[test\\]', '转义方括号');

// 15. 综合场景：典型日志文件
console.log('[15] 综合场景');
const realLog = [
  '2024-06-01 09:00:00.123 INFO  [main] 服务启动，端口 8080',
  '2024-06-01 09:00:00.456 DEBUG [db] 连接池初始化 size=10',
  '2024-06-01 09:00:01.789 WARN  [cache] 缓存命中率低 42%',
  '2024-06-01 09:00:02.001 ERROR [main] 处理请求异常 NullPointerException',
  '2024-06-01 09:00:02.002 FATAL [main] 致命错误，准备退出',
  '2024-06-01 09:00:03.000 INFO  [main] 优雅关闭完成',
  ''
].join('\n');
const realLines = C.parseContent(realLog);
assertEq(realLines.length, 6, '真实日志 6 行');
const realCounts = C.countByLevel(realLines);
assertEq(realCounts.INFO, 2, 'INFO 2');
assertEq(realCounts.DEBUG, 1, 'DEBUG 1');
assertEq(realCounts.WARN, 1, 'WARN 1');
assertEq(realCounts.ERROR, 1, 'ERROR 1');
assertEq(realCounts.FATAL, 1, 'FATAL 1');
// 搜索异常
const exSearch = C.searchLines(realLines, 'Exception');
assertEq(exSearch.matches.length, 1, '搜索 Exception 1 行');
// 过滤仅错误
const errOnly = C.filterByLevel(realLines, { TRACE: false, DEBUG: false, INFO: false, WARN: false, ERROR: true, FATAL: true });
assertEq(errOnly.length, 2, 'ERROR+FATAL 2 行');

// 16. 大行号场景
console.log('[16] 大行号');
const big = C.parseContent('line1\nline2\nline3\n', 99999);
assertEq(big[0].lineNo, 99999, '起始行号 99999');
assertEq(big[2].lineNo, 100001, '第3行 100001');

// --- 结果 ---
console.log('\n------------------------');
console.log(`通过: ${pass}  失败: ${fail}`);
if (fail > 0) {
  console.log('\n失败项:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('全部测试通过 ✅');
  process.exit(0);
}
