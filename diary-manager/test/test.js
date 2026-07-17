// 日记本核心逻辑测试（纯函数验证）
// 运行：node test/test.js

let pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

// 复刻 renderer 中的日期格式化函数
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function countWords(html) {
  const text = (html || '').replace(/<[^>]+>/g, '');
  return text.replace(/\s/g, '').length;
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

console.log('日期格式化测试：');
assert(fmt(new Date(2026, 6, 17)) === '2026-07-17', '标准日期');
assert(fmt(new Date(2026, 0, 1)) === '2026-01-01', '一月一日补零');

console.log('日期解析测试：');
const d = parseStr('2026-07-17');
assert(d.getFullYear() === 2026 && d.getMonth() === 6 && d.getDate() === 17, '解析 2026-07-17');

console.log('字数统计测试：');
assert(countWords('<p>你好 世界</p>') === 4, '中文字数统计');
assert(countWords('') === 0, '空内容');
assert(countWords('<p></p>') === 0, '空标签');
assert(countWords('<h2>标题</h2><p>正文 内容</p>') === 6, '多标签字数');

console.log('HTML 转义测试：');
assert(escapeHtml('<script>') === '&lt;script&gt;', '尖括号转义');
assert(escapeHtml('"a"') === '&quot;a&quot;', '引号转义');
assert(escapeHtml("a'b") === 'a&#39;b', '单引号转义');
assert(escapeHtml('a&b') === 'a&amp;b', '与号转义');

console.log('\n结果：' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
