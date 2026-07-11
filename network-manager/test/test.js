// 网络管家 - 核心逻辑单元测试
const {
  parseHostPort,
  isIPv4,
  isIPv6,
  isValidHost,
  isValidPort,
  isValidDomain,
  parseUrl,
  parsePingOutput,
  parseTracertOutput,
  parseNslookupOutput,
  parseWhoisOutput,
  parseHttpHeaders,
  latencyColor,
  latencyRating,
  formatBytes,
  timeAgo,
} = require('../src/core/net-core');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  ✗ FAIL: ' + msg); }
}
function assertEq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; }
  else {
    fail++;
    console.error('  ✗ FAIL: ' + msg);
    console.error('    expected:', JSON.stringify(expected));
    console.error('    actual:  ', JSON.stringify(actual));
  }
}

console.log('== parseHostPort ==');
assertEq(parseHostPort('baidu.com'), { host: 'baidu.com', port: 0 }, '仅 host');
assertEq(parseHostPort('8.8.8.8'), { host: '8.8.8.8', port: 0 }, '仅 IP');
assertEq(parseHostPort('example.com:8080'), { host: 'example.com', port: 8080 }, 'host:port');
assertEq(parseHostPort('1.2.3.4 443'), { host: '1.2.3.4', port: 443 }, 'host 空格 port');
assertEq(parseHostPort(''), { host: '', port: 0 }, '空字符串');
assertEq(parseHostPort(null), { host: '', port: 0 }, 'null');
assertEq(parseHostPort('  baidu.com  '), { host: 'baidu.com', port: 0 }, '前后空格');

console.log('== isIPv4 ==');
assert(isIPv4('8.8.8.8'), '8.8.8.8');
assert(isIPv4('192.168.1.1'), '192.168.1.1');
assert(!isIPv4('256.1.1.1'), '超范围 256');
assert(!isIPv4('1.2.3'), '三段');
assert(!isIPv4('baidu.com'), '域名非 IPv4');
assert(!isIPv4(''), '空');

console.log('== isIPv6 ==');
assert(isIPv6('::1'), '::1');
assert(isIPv6('2001:db8::1'), '2001:db8::1');
assert(!isIPv6('8.8.8.8'), 'IPv4 非 IPv6');
assert(!isIPv6('baidu.com'), '域名非 IPv6');

console.log('== isValidHost ==');
assert(isValidHost('baidu.com'), '域名');
assert(isValidHost('8.8.8.8'), 'IPv4');
assert(isValidHost('www.example.com'), '多级域名');
assert(!isValidHost(''), '空');
assert(!isValidHost('..invalid'), '非法域名');
assert(!isValidHost(null), 'null');

console.log('== isValidPort ==');
assert(isValidPort(80), '80');
assert(isValidPort(65535), '65535');
assert(isValidPort(1), '1');
assert(!isValidPort(0), '0 太小');
assert(!isValidPort(65536), '65536 太大');
assert(!isValidPort('abc'), '非数字');
assert(!isValidPort(80.5), '小数');

console.log('== isValidDomain ==');
assert(isValidDomain('baidu.com'), 'baidu.com');
assert(isValidDomain('www.example.com'), '多级域名');
assert(!isValidDomain('8.8.8.8'), 'IP 非域名');
assert(!isValidDomain('baidu'), '无点');
assert(!isValidDomain(''), '空');

console.log('== parseUrl ==');
let u = parseUrl('https://www.baidu.com/path');
assert(u.valid, 'https 有效');
assertEq(u.protocol, 'https:', 'https 协议');
assertEq(u.host, 'www.baidu.com', 'host');
assertEq(u.port, 443, '默认 https 端口');
assertEq(u.path, '/path', '路径');
u = parseUrl('http://localhost:8080/');
assertEq(u.port, 8080, '显式端口');
u = parseUrl('baidu.com');
assert(u.valid, '无协议补全 http');
assertEq(u.protocol, 'http:', '补全协议');
u = parseUrl('://bad');
assert(!u.valid, '非法 URL');

console.log('== parsePingOutput (中文) ==');
const pingZh = `正在 Ping baidu.com [110.242.68.66] 具有 32 字节的数据:
来自 110.242.68.66 的回复: 字节=32 时间=12ms TTL=54
来自 110.242.68.66 的回复: 字节=32 时间=11ms TTL=54
来自 110.242.68.66 的回复: 字节=32 时间=16ms TTL=54
来自 110.242.68.66 的回复: 字节=32 时间=13ms TTL=54

110.242.68.66 的 Ping 统计信息:
    数据包: 已发送 = 4，已接收 = 4，丢失 = 0 (0% 丢失)，
往返行程的估计时间(以毫秒):
    最短 = 11ms，最长 = 16ms，平均 = 13ms`;
const pr = parsePingOutput(pingZh);
assertEq(pr.host, 'baidu.com', '中文 host');
assertEq(pr.ip, '110.242.68.66', '中文 ip');
assertEq(pr.sent, 4, '中文 sent');
assertEq(pr.received, 4, '中文 received');
assertEq(pr.loss, 0, '中文 loss 0');
assertEq(pr.min, 11, '中文 min');
assertEq(pr.max, 16, '中文 max');
assertEq(pr.avg, 13, '中文 avg');
assertEq(pr.samples.length, 4, '中文样本数');
assertEq(pr.samples[0].time, 12, '第一样本时间');
assertEq(pr.samples[0].ttl, 54, '第一样本 TTL');

console.log('== parsePingOutput (英文) ==');
const pingEn = `Pinging baidu.com [110.242.68.66] with 32 bytes of data:
Reply from 110.242.68.66: bytes=32 time=12ms TTL=54
Reply from 110.242.68.66: bytes=32 time=15ms TTL=54
Request timed out.
Reply from 110.242.68.66: bytes=32 time=14ms TTL=54

Ping statistics for 110.242.68.66:
    Packets: Sent = 4, Received = 3, Lost = 1 (25% loss),
Approximate round trip times in milli-seconds:
    Minimum = 12ms, Maximum = 15ms, Average = 13ms`;
const pr2 = parsePingOutput(pingEn);
assertEq(pr2.sent, 4, '英文 sent');
assertEq(pr2.received, 3, '英文 received');
assertEq(pr2.loss, 25, '英文 loss 25%');
assertEq(pr2.min, 12, '英文 min');
assertEq(pr2.avg, 13, '英文 avg');
assertEq(pr2.samples.length, 3, '英文样本数（排除超时）');

console.log('== parsePingOutput (全超时) ==');
const pingTimeout = `Pinging 10.255.255.1 with 32 bytes of data:
Request timed out.
Request timed out.
Ping statistics for 10.255.255.1:
    Packets: Sent = 2, Received = 0, Lost = 2 (100% loss),`;
const pr3 = parsePingOutput(pingTimeout);
assertEq(pr3.sent, 2, '全超时 sent');
assertEq(pr3.received, 0, '全超时 received');
assertEq(pr3.loss, 100, '全超时 loss 100%');
assertEq(pr3.samples.length, 0, '全超时无样本');

console.log('== parseTracertOutput ==');
const tracertOut = `通过最多追踪 15 个跃点跟踪到 baidu.com [110.242.68.66] 的路由:

  1     1 ms     1 ms     1 ms  192.168.1.1
  2     3 ms     2 ms     2 ms  10.0.0.1
  3     *        *        *     请求超时。
  4    12 ms    11 ms    13 ms  example.com [93.184.216.34]

跟踪完成。`;
const hops = parseTracertOutput(tracertOut);
assertEq(hops.length, 4, '跳数');
assertEq(hops[0].hop, 1, '第一跳序号');
assertEq(hops[0].host, '192.168.1.1', '第一跳 host');
assertEq(hops[0].ip, '192.168.1.1', '第一跳 ip');
assertEq(hops[0].times, [1, 1, 1], '第一跳时间');
assertEq(hops[2].times, [null, null, null], '第三跳全超时');
assertEq(hops[3].host, 'example.com', '第四跳 host');
assertEq(hops[3].ip, '93.184.216.34', '第四跳 ip');
assertEq(hops[3].times, [12, 11, 13], '第四跳时间');

console.log('== parseNslookupOutput ==');
const nsOut = `服务器:  UnKnown
Address:  192.168.1.1

非权威应答:
名称:    example.com
Address:  93.184.216.34
Address:  2606:2800:220:1:248:1893:25c8:1946`;
const recs = parseNslookupOutput(nsOut);
assertEq(recs.length, 2, 'DNS 记录数');
assertEq(recs[0].type, 'A', '第一记录类型 A');
assertEq(recs[0].address, '93.184.216.34', '第一记录地址');
assertEq(recs[1].address, '2606:2800:220:1:248:1893:25c8:1946', '第二记录地址 IPv6');

console.log('== parseNslookupOutput (MX) ==');
const mxOut = `非权威应答:
baidu.com   mail exchanger = 10 mx.maillb.baidu.com.
baidu.com   mail exchanger = 20 jpmx.baidu.com.`;
const mxRecs = parseNslookupOutput(mxOut);
assertEq(mxRecs.length, 2, 'MX 记录数');
assertEq(mxRecs[0].type, 'MX', 'MX 类型');
assertEq(mxRecs[0].address, 'mx.maillb.baidu.com.', 'MX 地址');
assertEq(mxRecs[0].preference, 10, 'MX 优先级');

console.log('== parseWhoisOutput ==');
const whoisOut = `Domain Name: BAIDU.COM
Registrar: MarkMonitor Inc.
Registrar URL: http://www.markmonitor.com
Updated Date: 2023-09-15T06:40:38Z
Creation Date: 1999-10-11T04:31:20Z
Registry Expiry Date: 2026-10-11T04:31:20Z
Name Server: NS1.BAIDU.COM
Name Server: NS2.BAIDU.COM
Domain Status: clientTransferProhibited https://icann.org`;
const wi = parseWhoisOutput(whoisOut);
assertEq(wi.registrar, 'MarkMonitor Inc.', '注册商');
assert(wi.createdDate.indexOf('1999-10-11') >= 0, '注册时间');
assert(wi.expiryDate.indexOf('2026-10-11') >= 0, '到期时间');
assertEq(wi.nameServers.length, 2, 'NS 数量');
assertEq(wi.nameServers[0], 'ns1.baidu.com', 'NS1');
assert(wi.status.length > 0, '状态存在');

console.log('== parseHttpHeaders ==');
const hdr = 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 1234\r\nServer: bfe\r\n';
const hdrs = parseHttpHeaders(hdr);
assertEq(hdrs.length, 3, '头数量（状态行无冒号被跳过）');
assertEq(hdrs[0].key, 'Content-Type', '第一 key');
assertEq(hdrs[0].value, 'text/html', '第一 value');
assertEq(hdrs[1].key, 'Content-Length', '第二 key');
assertEq(hdrs[1].value, '1234', '第二 value');
assertEq(hdrs[2].key, 'Server', '第三 key');
assertEq(hdrs[2].value, 'bfe', '第三 value');
assertEq(parseHttpHeaders('').length, 0, '空输入');
assertEq(parseHttpHeaders('单行无冒号').length, 0, '无冒号行跳过');

console.log('== latencyColor / latencyRating ==');
assertEq(latencyColor(20), '#34c759', '<50 绿');
assertEq(latencyColor(80), '#007aff', '<100 蓝');
assertEq(latencyColor(150), '#ff9500', '<200 橙');
assertEq(latencyColor(300), '#ff3b30', '>=200 红');
assertEq(latencyColor(null), '#ff3b30', '超时 红');
assertEq(latencyRating(20), '极优', '<50 极优');
assertEq(latencyRating(80), '良好', '<100 良好');
assertEq(latencyRating(150), '一般', '<200 一般');
assertEq(latencyRating(300), '较差', '>=200 较差');
assertEq(latencyRating(null), '超时', '超时');

console.log('== formatBytes ==');
assertEq(formatBytes(0), '0 B', '0');
assertEq(formatBytes(512), '512 B', '512B');
assertEq(formatBytes(1024), '1.00 KB', '1KB');
assertEq(formatBytes(1048576), '1.00 MB', '1MB');
assertEq(formatBytes(1073741824), '1.00 GB', '1GB');

console.log('== timeAgo ==');
const now = Date.now();
assertEq(timeAgo(now), '刚刚', '刚刚');
assertEq(timeAgo(now - 120000), '2 分钟前', '2分钟前');
assertEq(timeAgo(now - 7200000), '2 小时前', '2小时前');
assertEq(timeAgo(now - 86400000), '1 天前', '1天前');

console.log('\n=========================');
console.log(`  通过: ${pass}  失败: ${fail}`);
console.log('=========================');
if (fail > 0) process.exit(1);
