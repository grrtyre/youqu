// 端口管家 - 核心逻辑单元测试
const {
  parseNetstat,
  parseTasklist,
  enrichConnections,
  filterConnections,
  summarize,
  exportCSV,
  splitAddrPort,
  parseCsvLine,
} = require('../src/core/port-scanner');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error('  ✗ FAIL: ' + msg);
  }
}
function assertEq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
  } else {
    fail++;
    console.error('  ✗ FAIL: ' + msg);
    console.error('    expected:', JSON.stringify(expected));
    console.error('    actual:  ', JSON.stringify(actual));
  }
}

console.log('== splitAddrPort ==');
assertEq(splitAddrPort('0.0.0.0:135'), { addr: '0.0.0.0', port: 135 }, 'IPv4 地址端口');
assertEq(splitAddrPort('192.168.1.100:8080'), { addr: '192.168.1.100', port: 8080 }, 'IPv4 带 IP');
assertEq(splitAddrPort('[::]:443'), { addr: '::', port: 443 }, 'IPv6 [::]:port');
assertEq(splitAddrPort('[2001:db8::1]:80'), { addr: '2001:db8::1', port: 80 }, 'IPv6 具体地址');
assertEq(splitAddrPort('*:*'), { addr: '*', port: 0 }, 'UDP 通配 *:*');
assertEq(splitAddrPort('10.0.0.1:0'), { addr: '10.0.0.1', port: 0 }, '端口 0');

console.log('== parseCsvLine ==');
assertEq(parseCsvLine('"chrome.exe","5678","Console","1","123,456 K"'), ['chrome.exe', '5678', 'Console', '1', '123,456 K'], '标准 CSV 行');
assertEq(parseCsvLine('"a,b","c"'), ['a,b', 'c'], '含逗号字段');
assertEq(parseCsvLine('"a""b"'), ['a"b'], '转义双引号');

console.log('== parseNetstat ==');
const sample = `
活动连接

  协议  本地地址          外部地址        状态           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1056
  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING       4
  TCP    192.168.1.100:51234    142.250.80.46:443      ESTABLISHED     5678
  TCP    192.168.1.100:51235    142.250.80.46:443      TIME_WAIT       0
  UDP    0.0.0.0:500            *:*                                    1234
  UDP    [::]:5353              *:*                                    2468
`;
const conns = parseNetstat(sample);
assertEq(conns.length, 5, '解析出 5 条连接（PID=0 已过滤）');
assertEq(conns[0].proto, 'TCP', '第1条协议 TCP');
assertEq(conns[0].localAddr, '0.0.0.0', '第1条本地地址');
assertEq(conns[0].localPort, 135, '第1条本地端口 135');
assertEq(conns[0].state, 'LISTENING', '第1条状态 LISTENING');
assertEq(conns[0].pid, 1056, '第1条 PID');
// TIME_WAIT PID=0 应被过滤
assert(conns.every((c) => c.pid > 0), 'PID<=0 已过滤');
assertEq(conns[3].proto, 'UDP', '第3条 UDP');
assertEq(conns[3].state, '', 'UDP 无状态');
assertEq(conns[3].pid, 1234, 'UDP PID');
assertEq(conns[4].localAddr, '::', 'IPv6 本地地址');
assertEq(conns[4].localPort, 5353, 'IPv6 本地端口');

console.log('== parseNetstat 英文 locale ==');
const enSample = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1056
  TCP    127.0.0.1:3000         127.0.0.1:51234        ESTABLISHED     9999
`;
const enConns = parseNetstat(enSample);
assertEq(enConns.length, 2, '英文 locale 2 条');
assertEq(enConns[1].localPort, 3000, '英文本地端口');
assertEq(enConns[1].foreignPort, 51234, '英文外部端口');

console.log('== parseTasklist ==');
const tasklistOut = `
"System Idle Process","0","Services","0","8 K"
"chrome.exe","5678","Console","1","123,456 K"
"node.exe","9999","Console","1","45,678 K"
`;
const procMap = parseTasklist(tasklistOut);
assertEq(procMap.size, 2, '2 个进程（PID=0 已过滤）');
assertEq(procMap.get(5678), { name: 'chrome.exe', mem: '123,456 K' }, 'chrome 进程信息');
assertEq(procMap.get(9999).name, 'node.exe', 'node 进程名');

console.log('== enrichConnections ==');
const enriched = enrichConnections(conns, procMap);
assertEq(enriched[0].processName, '(未知)', 'PID 1056 未知进程');
assertEq(enriched[2].processName, 'chrome.exe', 'PID 5678 = chrome');
assertEq(enriched[2].memUsage, '123,456 K', '内存占用');
assertEq(enriched[4].processName, '(未知)', 'UDP PID 1234 未知');

console.log('== filterConnections ==');
const filteredByPort = filterConnections(enriched, '443');
assertEq(filteredByPort.length, 1, '过滤端口 443 -> 1 条');
assertEq(filteredByPort[0].foreignPort, 443, '确认是 443');
const filteredByProc = filterConnections(enriched, 'chrome');
assertEq(filteredByProc.length, 1, '过滤 chrome -> 1 条');
assertEq(filterConnections(enriched, 'nonexist').length, 0, '不存在的关键字 -> 0');
assertEq(filterConnections(enriched, '').length, 5, '空关键字 -> 全部');

console.log('== summarize ==');
const stats = summarize(enriched);
assertEq(stats.total, 5, '总连接 5');
assertEq(stats.listening, 2, '监听 2');
assertEq(stats.established, 1, '已建立 1');
assertEq(stats.timeWait, 0, 'TIME_WAIT 0 (PID=0 已过滤)');
assertEq(stats.udpCount, 2, 'UDP 2');
assert(stats.processCount >= 4, '进程数 >=4');

console.log('== exportCSV ==');
const csv = exportCSV(enriched);
assert(csv.startsWith('\ufeff'), 'CSV 含 BOM');
assert(csv.includes('协议,本地地址'), 'CSV 含表头');
assert(csv.includes('chrome.exe'), 'CSV 含进程名');
assert(csv.includes('LISTENING'), 'CSV 含状态');

console.log('== 空/异常输入 ==');
assertEq(parseNetstat(''), [], '空字符串');
assertEq(parseNetstat(null), [], 'null');
assertEq(parseNetstat(123), [], '非字符串');
assertEq(parseTasklist(''), new Map(), '空 tasklist');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
if (fail > 0) {
  process.exit(1);
} else {
  console.log('全部通过 ✓');
}
