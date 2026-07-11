'use strict';

// API管家 · 核心逻辑测试
// 运行：node test/test.js

const path = require('path');
const os = require('os');
const fs = require('fs');
const assert = require('assert');
const http = require('http');

const { buildRequest, applyEnv, applyEnvDeep, sendRequest, formatBody, SUPPORTED_METHODS } = require('../src/core/http-client.js');
const { Store, blankRequest } = require('../src/core/store.js');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

// ---------- 环境变量替换 ----------
console.log('\n[1] 环境变量替换');
ok('applyEnv 替换 {{var}}', applyEnv('{{baseUrl}}/ip', { baseUrl: 'https://x.com' }) === 'https://x.com/ip');
ok('applyEnv 未知变量保留', applyEnv('{{unknown}}/ip', { baseUrl: 'https://x.com' }) === '{{unknown}}/ip');
ok('applyEnv 带空格', applyEnv('{{ baseUrl }}/ip', { baseUrl: 'https://x.com' }) === 'https://x.com/ip');
ok('applyEnv 非字符串返回原值', applyEnv(123, { a: 1 }) === 123);
ok('applyEnvDeep 处理对象', JSON.stringify(applyEnvDeep({ a: '{{x}}', b: ['{{y}}', 2] }, { x: '1', y: '2' })) === JSON.stringify({ a: '1', b: ['2', 2] }));

// ---------- buildRequest ----------
console.log('\n[2] buildRequest 构建请求');
(function () {
  const built = buildRequest({ method: 'get', url: 'httpbin.org/get', params: [{ key: 'a', value: '1', enabled: true }, { key: 'b', value: '2', enabled: false }] }, {});
  ok('方法大写', built.method === 'GET');
  ok('自动补 http://', built.url.startsWith('http://'));
  ok('启用参数加入 URL', built.url.indexOf('a=1') >= 0);
  ok('禁用参数不加入 URL', built.url.indexOf('b=2') < 0);
})();

(function () {
  const built = buildRequest({
    method: 'POST',
    url: '{{baseUrl}}/post',
    headers: [{ key: 'X-Test', value: '{{token}}', enabled: true }],
    body: { type: 'json', raw: '{"k":"{{v}}"}' },
    auth: { type: 'bearer', token: '{{token}}' }
  }, { baseUrl: 'https://httpbin.org', token: 'abc', v: 'vv' });
  ok('URL 环境变量替换', built.url === 'https://httpbin.org/post');
  ok('请求头环境变量替换', built.headers['X-Test'] === 'abc');
  ok('Bearer 认证', built.headers['Authorization'] === 'Bearer abc');
  ok('JSON body 替换', built.body === '{"k":"vv"}');
  ok('自动 Content-Type', built.headers['Content-Type'] === 'application/json; charset=utf-8');
})();

(function () {
  const built = buildRequest({
    method: 'POST',
    url: 'https://httpbin.org/post',
    body: { type: 'form', form: [{ key: 'a', value: '1&2', enabled: true }] }
  }, {});
  ok('表单 URL 编码', built.body === 'a=1%262');
  ok('表单 Content-Type', built.headers['Content-Type'] === 'application/x-www-form-urlencoded; charset=utf-8');
})();

(function () {
  const built = buildRequest({
    method: 'POST',
    url: 'https://x.com',
    auth: { type: 'basic', username: 'u', password: 'p' }
  }, {});
  ok('Basic 认证', built.headers['Authorization'] === 'Basic ' + Buffer.from('u:p').toString('base64'));
})();

(function () {
  const built = buildRequest({ method: 'INVALID', url: 'https://x.com' }, {});
  ok('非法方法回退 GET', built.method === 'GET');
})();

// ---------- formatBody ----------
console.log('\n[3] formatBody 响应格式化');
(function () {
  const r = formatBody(Buffer.from('{"a":1}'), { 'content-type': 'application/json' });
  ok('JSON 响应解析', r.type === 'json' && r.text === '{\n  "a": 1\n}');
})();
(function () {
  const r = formatBody(Buffer.from('hello'), { 'content-type': 'text/plain' });
  ok('文本响应', r.type === 'text' && r.text === 'hello');
})();
(function () {
  const r = formatBody(Buffer.from('{"a":1}'), {});
  ok('无 content-type 但以 { 开头也尝试 JSON', r.type === 'json');
})();
(function () {
  const r = formatBody(Buffer.from('not json'), {});
  ok('非法 JSON 回退文本', r.type === 'text');
})();

// ---------- Store ----------
console.log('\n[4] Store 本地存储');
(function () {
  const tmpDir = path.join(os.tmpdir(), 'api-mgr-test-' + Date.now());
  let s = new Store(tmpDir);
  ok('初始有示例集合', s.getCollections().length >= 1);
  ok('初始有默认环境', s.getEnvConfig().environments.length >= 1);
  const col = s.addCollection('测试集合');
  ok('添加集合', s.getCollections().some((c) => c.id === col.id && c.name === '测试集合'));
  s.renameCollection(col.id, '改名');
  ok('重命名集合', s.getCollections().find((c) => c.id === col.id).name === '改名');
  const item = s.addItem(col.id, null, { name: '我的请求', request: blankRequest() });
  ok('添加请求', !!item);
  ok('请求存入集合', s.getCollections().find((c) => c.id === col.id).items.some((i) => i.id === item.id));
  s.updateItem(col.id, item.id, { name: '改名请求', request: { method: 'POST', url: 'https://x.com' } });
  ok('更新请求', s.getCollections().find((c) => c.id === col.id).items.find((i) => i.id === item.id).name === '改名请求');
  s.deleteItem(col.id, item.id);
  ok('删除请求', !s.getCollections().find((c) => c.id === col.id).items.some((i) => i.id === item.id));
  s.deleteCollection(col.id);
  ok('删除集合', !s.getCollections().some((c) => c.id === col.id));

  // 持久化
  s.addHistory({ method: 'GET', url: 'https://x.com', status: 200, time_ms: 12 });
  s.addHistory({ method: 'POST', url: 'https://y.com', status: 500, time_ms: 99 });
  ok('历史记录添加', s.getHistory().length === 2);
  ok('历史最新在前', s.getHistory()[0].url === 'https://y.com');
  s.clearHistory();
  ok('清空历史', s.getHistory().length === 0);

  // 环境变量
  const vars = s.getActiveVariables();
  ok('获取当前环境变量', typeof vars === 'object');
  const newEnv = { id: 'env_test', name: '测试环境', variables: [{ key: 'host', value: 'https://t.com', enabled: true }] };
  s.saveEnvironment(newEnv);
  s.setActiveEnv('env_test');
  ok('切换环境', s.getActiveVariables().host === 'https://t.com');

  // 重新加载验证持久化
  const s2 = new Store(tmpDir);
  ok('持久化加载', s2.getEnvConfig().environments.some((e) => e.id === 'env_test'));

  // 清理
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
})();

// ---------- 真实 HTTP 请求（启动本地测试服务器） ----------
console.log('\n[5] 真实 HTTP 请求（本地测试服务器）');
(async function () {
  // 启动测试服务器
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (req.url === '/get') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ method: req.method, url: req.url, headers: req.headers }));
      } else if (req.url === '/post') {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ method: req.method, body: body }));
      } else if (req.url === '/redirect') {
        res.writeHead(302, { 'Location': '/get' });
        res.end();
      } else if (req.url === '/error') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port;

  try {
    // GET
    let resp = await sendRequest(buildRequest({ method: 'GET', url: base + '/get' }, {}));
    ok('GET 200', resp.status === 200);
    ok('响应体大小', resp.size > 0);
    ok('耗时记录', typeof resp.time === 'number' && resp.time >= 0);
    let fb = formatBody(resp.body, resp.headers);
    ok('GET 响应 JSON', fb.type === 'json' && JSON.parse(fb.raw).method === 'GET');

    // POST with body
    resp = await sendRequest(buildRequest({ method: 'POST', url: base + '/post', body: { type: 'json', raw: '{"hi":1}' } }, {}));
    ok('POST 201', resp.status === 201);
    fb = formatBody(resp.body, resp.headers);
    ok('POST 接收 body', JSON.parse(fb.raw).body === '{"hi":1}');

    // 重定向
    resp = await sendRequest(buildRequest({ method: 'GET', url: base + '/redirect' }, {}), { maxRedirects: 5 });
    ok('跟随重定向', resp.status === 200 && resp.redirects.length === 1);

    // 404
    resp = await sendRequest(buildRequest({ method: 'GET', url: base + '/nope' }, {}));
    ok('404 状态', resp.status === 404);

    // 500
    resp = await sendRequest(buildRequest({ method: 'GET', url: base + '/error' }, {}));
    ok('500 状态', resp.status === 500);

    // 超时
    const timeoutServer = http.createServer((req, res) => { /* 不响应 */ });
    await new Promise((r) => timeoutServer.listen(0, r));
    const tp = timeoutServer.address().port;
    try {
      await sendRequest(buildRequest({ method: 'GET', url: 'http://127.0.0.1:' + tp + '/x' }, {}), { timeout: 500 });
      ok('超时应抛错', false);
    } catch (e) {
      ok('超时抛错', /超时/.test(e.message));
    }
    timeoutServer.close();
  } finally {
    server.close();
  }

  // ---------- 结果 ----------
  console.log('\n==============================');
  console.log('  通过：' + pass + '  失败：' + fail);
  console.log('==============================');
  if (fail > 0) {
    console.log('❌ 测试失败');
    process.exit(1);
  } else {
    console.log('✅ 全部通过');
    process.exit(0);
  }
})();
