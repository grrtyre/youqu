// 核心逻辑测试 - 置顶管家
// 测试 topmost-store 规则管理与桥接 JSON 协议解析
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('../src/core/topmost-store');

let pass = 0;
const ok = (name, cond) => { assert.ok(cond, name); pass++; console.log('  ✓ ' + name); };

function tmpFile() {
  return path.join(os.tmpdir(), 'topmost-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
}

console.log('\n[1] topmost-store 规则管理');

// 默认数据
let d = store.defaultData();
ok('defaultData 返回空规则且 autoPin=false', d.rules.length === 0 && d.autoPin === false);

// addRule 去重大小写
d = store.addRule(store.defaultData(), 'Notepad');
ok('addRule 加入 Notepad', d.rules.length === 1 && d.rules[0].proc === 'notepad');
d = store.addRule(d, 'NOTEPAD');
ok('addRule 大小写不敏感去重', d.rules.length === 1);
d = store.addRule(d, 'explorer');
ok('addRule 加入第二个规则', d.rules.length === 2);
d = store.addRule(d, '   ');
ok('addRule 空字符串被忽略', d.rules.length === 2);

// matchesRule
ok('matchesRule 命中 notepad', store.matchesRule(d, 'notepad') === true);
ok('matchesRule 大小写不敏感命中', store.matchesRule(d, 'NOTEPAD') === true);
ok('matchesRule 未命中', store.matchesRule(d, 'chrome') === false);
ok('matchesRule 空名不命中', store.matchesRule(d, '') === false);

// toggleRule
d = store.toggleRule(d, 'notepad', false);
ok('toggleRule 禁用 notepad', d.rules[0].enabled === false);
ok('matchesRule 禁用后不再命中', store.matchesRule(d, 'notepad') === false);
d = store.toggleRule(d, 'notepad', true);
ok('toggleRule 启用 notepad', d.rules[0].enabled === true);
ok('matchesRule 启用后命中', store.matchesRule(d, 'notepad') === true);

// removeRule
d = store.removeRule(d, 'explorer');
ok('removeRule 移除 explorer', d.rules.length === 1 && d.rules[0].proc === 'notepad');
d = store.removeRule(d, '不存在');
ok('removeRule 不存在的规则无副作用', d.rules.length === 1);

console.log('\n[2] topmost-store 持久化');

// save + load 往返
const f = tmpFile();
d = store.defaultData();
d.autoPin = true;
store.addRule(d, 'calc');
store.addRule(d, 'mspaint');
assert.ok(store.save(f, d), 'save 应返回 true');
ok('save 写入文件成功', fs.existsSync(f));

const loaded = store.load(f);
ok('load autoPin 往返一致', loaded.autoPin === true);
ok('load 规则数量一致', loaded.rules.length === 2);
ok('load 规则均为小写', loaded.rules.every((r) => r.proc === r.proc.toLowerCase()));
ok('load 规则均带 enabled', loaded.rules.every((r) => typeof r.enabled === 'boolean'));

// load 容错：损坏文件
const f2 = tmpFile();
fs.writeFileSync(f2, '{这不是合法json', 'utf-8');
const broken = store.load(f2);
ok('load 损坏 JSON 返回默认数据', broken.rules.length === 0 && broken.autoPin === false);

// load 容错：缺字段
const f3 = tmpFile();
fs.writeFileSync(f3, '{"rules": [{"proc": "x"}]}', 'utf-8');
const partial = store.load(f3);
ok('load 缺 enabled 字段补默认 true', partial.rules[0].enabled === true);
ok('load 缺 autoPin 字段补默认 false', partial.autoPin === false);

// load 容错：过滤无效条目
const f4 = tmpFile();
fs.writeFileSync(f4, '{"rules": [{"proc": "ok"}, {"proc": ""}, {"proc": 123}, null], "autoPin": false}', 'utf-8');
const filtered = store.load(f4);
ok('load 过滤掉空/无效规则', filtered.rules.length === 1 && filtered.rules[0].proc === 'ok');

// 清理
try { fs.unlinkSync(f); fs.unlinkSync(f2); fs.unlinkSync(f3); fs.unlinkSync(f4); } catch (e) {}

console.log('\n[3] 桥接 JSON 协议解析模拟');

// 模拟 C# 返回的窗口列表 JSON（含中文标题、转义）
const sampleListJson = '{"ok":true,"data":[{"hwnd":"131234","pid":5678,"title":"记事本 - 无标题.txt","proc":"notepad","topmost":false,"layered":false,"alpha":255,"x":100,"y":100,"w":800,"h":600},{"hwnd":"998877","pid":1234,"title":"含\\"引号\\"和\\\\反斜杠的标题","proc":"explorer","topmost":true,"layered":true,"alpha":180,"x":0,"y":0,"w":1920,"h":1080}]}';
let parsed;
try { parsed = JSON.parse(sampleListJson); } catch (e) { throw new Error('列表 JSON 解析失败: ' + e.message); }
ok('列表 JSON 解析成功', parsed.ok === true && Array.isArray(parsed.data) && parsed.data.length === 2);
ok('列表 hwnd 为字符串保留精度', parsed.data[0].hwnd === '131234');
ok('列表中文标题正确', parsed.data[0].title === '记事本 - 无标题.txt');
ok('列表转义标题正确还原', parsed.data[1].title === '含"引号"和\\反斜杠的标题');
ok('列表 topmost 字段为布尔', parsed.data[1].topmost === true);
ok('列表 alpha 数值正确', parsed.data[1].alpha === 180);

// 模拟简单命令响应 JSON
const okJson = '{"ok":true}';
ok('简单成功响应解析', JSON.parse(okJson).ok === true);
const errJson = '{"ok":false,"error":"something failed"}';
const errP = JSON.parse(errJson);
ok('错误响应解析', errP.ok === false && errP.error === 'something failed');

// 模拟 topfg 响应
const topfgJson = '{"ok":true,"hwnd":"456789","topmost":true,"title":"计算器"}';
const tfg = JSON.parse(topfgJson);
ok('topfg 响应解析', tfg.topmost === true && tfg.title === '计算器' && tfg.hwnd === '456789');

// 构造发送给桥接的命令 JSON（确保 hwnd 以字符串发送，避免精度丢失）
const sendCmd = { cmd: 'top', hwnd: String(131234), on: true };
const sendJson = JSON.stringify(sendCmd);
ok('发送命令 hwnd 为字符串', JSON.parse(sendJson).hwnd === '131234');
ok('发送命令 on 为布尔', JSON.parse(sendJson).on === true);

console.log('\n[4] 渲染层辅助逻辑模拟');

// 头像颜色哈希稳定
function colorFor(name) {
  const palette = ['#007aff', '#34c759', '#ff9500'];
  const s = (name || '?').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
ok('colorFor 同名稳定一致', colorFor('notepad') === colorFor('notepad'));
ok('colorFor 大小写不敏感一致', colorFor('Notepad') === colorFor('notepad'));
ok('colorFor 返回调色板内颜色', paletteIncludes(colorFor('abc'), ['#007aff', '#34c759', '#ff9500']));
function paletteIncludes(c, p) { return p.indexOf(c) >= 0; }

// initialOf 取首字
function initialOf(name) {
  const s = (name || '?').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
}
ok('initialOf 英文大写首字母', initialOf('notepad') === 'N');
ok('initialOf 中文取首字', initialOf('记事本') === '记');
ok('initialOf 空串返回?', initialOf('') === '?');

// 透明度百分比换算（与 C# SetAlpha 一致）
function pctToAlpha(pct) { if (pct < 1) pct = 1; if (pct > 100) pct = 100; return Math.round(pct * 255 / 100); }
ok('透明度 100% -> 255', pctToAlpha(100) === 255);
ok('透明度 50% -> 128', pctToAlpha(50) === 128);
ok('透明度 10% -> 26', pctToAlpha(10) === 26);
ok('透明度 0% 钳制为 1% -> 3', pctToAlpha(0) === 3);
ok('透明度 200% 钳制为 100% -> 255', pctToAlpha(200) === 255);

// alpha 反算百分比（渲染层显示用）
function alphaToPct(alpha) { return Math.round(alpha / 255 * 100); }
ok('alpha 255 -> 100%', alphaToPct(255) === 100);
ok('alpha 180 -> 71%', alphaToPct(180) === 71);
ok('alpha 26 -> 10%', alphaToPct(26) === 10);

console.log('\n=========================');
console.log('  全部通过：' + pass + ' 项断言');
console.log('=========================\n');
