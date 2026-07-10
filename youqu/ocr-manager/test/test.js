// test/test.js — 识字管家核心逻辑单元测试（纯 Node，不依赖 Electron）
const assert = require('assert');
const core = require('../src/core/ocr-core.js');

let pass = 0, fail = 0;
function test(name, fn){
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch(e){ fail++; console.log('  ✗ ' + name + '\n    ' + (e.message||e)); }
}

console.log('\n[识字管家] 核心逻辑测试\n');

// ----- parseLangs -----
test('parseLangs: 默认返回 chi_sim+eng', () => {
  assert.strictEqual(core.parseLangs(''), 'chi_sim+eng');
  assert.strictEqual(core.parseLangs(null), 'chi_sim+eng');
  assert.strictEqual(core.parseLangs(undefined), 'chi_sim+eng');
});
test('parseLangs: 接受 code', () => {
  assert.strictEqual(core.parseLangs('chi_sim'), 'chi_sim');
  assert.strictEqual(core.parseLangs('eng'), 'eng');
  assert.strictEqual(core.parseLangs('chi_sim+eng'), 'chi_sim+eng');
});
test('parseLangs: 接受 label', () => {
  assert.strictEqual(core.parseLangs('中文 + 英文'), 'chi_sim+eng');
  assert.strictEqual(core.parseLangs('英文'), 'eng');
});
test('parseLangs: 拒绝非法输入回退默认', () => {
  assert.strictEqual(core.parseLangs('rm -rf'), 'chi_sim+eng');
  assert.strictEqual(core.parseLangs('../../etc'), 'chi_sim+eng');
  assert.strictEqual(core.parseLangs('fra'), 'chi_sim+eng'); // 未在已知集合
});

// ----- cleanText -----
test('cleanText: 去除首尾空白', () => {
  assert.strictEqual(core.cleanText('  hello  '), 'hello');
});
test('cleanText: 统一换行符 CRLF -> LF', () => {
  assert.strictEqual(core.cleanText('a\r\nb\rc'), 'a\nb\nc');
});
test('cleanText: 行尾空白清除', () => {
  assert.strictEqual(core.cleanText('line1   \nline2\t'), 'line1\nline2');
});
test('cleanText: 折叠 3+ 换行为 2', () => {
  assert.strictEqual(core.cleanText('a\n\n\n\nb'), 'a\n\nb');
});
test('cleanText: 保留中文间空格语义', () => {
  assert.strictEqual(core.cleanText('你好 World 2026'), '你好 World 2026');
});
test('cleanText: null/undefined 安全', () => {
  assert.strictEqual(core.cleanText(null), '');
  assert.strictEqual(core.cleanText(undefined), '');
});

// ----- formatConfidence -----
test('formatConfidence: 数值转百分比', () => {
  assert.strictEqual(core.formatConfidence(92.345), '92.3%');
  assert.strictEqual(core.formatConfidence(0), '0.0%');
});
test('formatConfidence: 非数值返回 --', () => {
  assert.strictEqual(core.formatConfidence(NaN), '--');
  assert.strictEqual(core.formatConfidence('abc'), '--');
  assert.strictEqual(core.formatConfidence(undefined), '--');
});

// ----- summarize -----
test('summarize: 统计字符/行/汉字/单词', () => {
  const s = core.summarize('你好 hello\nworld 2026');
  // 字符数不含换行，但含空格：'你好 helloworld 2026' = 18
  assert.strictEqual(s.chars, 18);
  assert.strictEqual(s.lines, 2);
  assert.strictEqual(s.cjk, 2);
  assert.strictEqual(s.words, 2); // hello, world
});
test('summarize: 空字符串', () => {
  const s = core.summarize('');
  assert.deepStrictEqual(s, { chars:0, lines:0, cjk:0, words:0 });
});
test('summarize: 含撇号单词', () => {
  const s = core.summarize("it's a test");
  assert.strictEqual(s.words, 3); // it's, a, test
});

// ----- previewText -----
test('previewText: 超长截断加省略号', () => {
  const long = '一'.repeat(50);
  const p = core.previewText(long, 10);
  assert.ok(p.endsWith('…'));
  assert.strictEqual(p.length, 11);
});
test('previewText: 短文本不截断', () => {
  assert.strictEqual(core.previewText('短文本', 10), '短文本');
});
test('previewText: 换行转空格', () => {
  assert.strictEqual(core.previewText('第一行\n第二行', 100), '第一行 第二行');
});

// ----- buildHistoryEntry -----
test('buildHistoryEntry: 生成完整结构', () => {
  const e = core.buildHistoryEntry('测试 text', '截图区域', 88.8);
  assert.ok(e.id.startsWith('h_'));
  assert.ok(typeof e.time === 'string');
  assert.strictEqual(e.source, '截图区域');
  assert.strictEqual(e.text, '测试 text');
  assert.strictEqual(e.confidence, 88.8);
  assert.ok(e.preview.length <= 41);
});
test('buildHistoryEntry: 默认 source', () => {
  const e = core.buildHistoryEntry('abc');
  assert.strictEqual(e.source, 'image');
  assert.strictEqual(e.confidence, null);
});

// ----- appendHistory / removeHistory -----
test('appendHistory: newest 在前', () => {
  let h = [];
  h = core.appendHistory(h, { id:'a', text:'1' });
  h = core.appendHistory(h, { id:'b', text:'2' });
  assert.strictEqual(h[0].id, 'b');
  assert.strictEqual(h[1].id, 'a');
});
test('appendHistory: 超出上限裁剪', () => {
  let h = [];
  for(let i=0;i<55;i++) h = core.appendHistory(h, { id:'i'+i, text:String(i) }, 50);
  assert.strictEqual(h.length, 50);
  assert.strictEqual(h[0].id, 'i54');
  assert.strictEqual(h[49].id, 'i5');
});
test('removeHistory: 按 id 删除', () => {
  let h = [{id:'a'},{id:'b'},{id:'c'}];
  h = core.removeHistory(h, 'b');
  assert.strictEqual(h.length, 2);
  assert.ok(!h.find(x=>x.id==='b'));
});
test('removeHistory: 非数组安全', () => {
  assert.deepStrictEqual(core.removeHistory(null, 'x'), []);
});

// ----- buildExport -----
test('buildExport: 生成文件名与内容', () => {
  const e = core.buildExport('  内容  ', '我的截图');
  assert.ok(e.filename.startsWith('我的截图_'));
  assert.ok(e.filename.endsWith('.txt'));
  assert.strictEqual(e.content, '内容');
});
test('buildExport: 默认文件名', () => {
  const e = core.buildExport('abc');
  assert.ok(e.filename.startsWith('识字结果_'));
});

// ----- SUPPORTED_LANGS -----
test('SUPPORTED_LANGS: 包含中英文组合', () => {
  const codes = core.SUPPORTED_LANGS.map(l=>l.code);
  assert.ok(codes.includes('chi_sim+eng'));
  assert.ok(codes.includes('eng'));
});

console.log('\n--------------------------------');
console.log(`通过 ${pass} 项 / 失败 ${fail} 项`);
console.log('--------------------------------\n');
if(fail > 0) process.exit(1);
