// test/test.js — 核心逻辑测试
const assert = require('assert');
const { hasCJK, inferCategory, isCJKFont, normalizeFamily, tagScore, filterFonts, sortFontsCJKFirst, cssFamily } = require('../src/core/font-utils');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('字体管家 - 核心逻辑测试\n');

console.log('CJK 检测');
t('中文字体名', () => assert.strictEqual(hasCJK('微软雅黑'), true));
t('英文字体名', () => assert.strictEqual(hasCJK('Arial'), false));
t('混合字体名', () => assert.strictEqual(hasCJK('PingFang SC'), false));
t('isCJKFont 一致性', () => {
  assert.strictEqual(isCJKFont('宋体'), true);
  assert.strictEqual(isCJKFont('Helvetica'), false);
});

console.log('字体分类推断');
t('等宽字体', () => {
  assert.strictEqual(inferCategory('Fira Code'), '等宽');
  assert.strictEqual(inferCategory('JetBrains Mono'), '等宽');
  assert.strictEqual(inferCategory('Courier New'), '等宽');
  assert.strictEqual(inferCategory('Source Code Pro'), '等宽');
  assert.strictEqual(inferCategory('Menlo'), '等宽');
});
t('衬线字体', () => {
  assert.strictEqual(inferCategory('Times New Roman'), '衬线');
  assert.strictEqual(inferCategory('Georgia'), '衬线');
  assert.strictEqual(inferCategory('宋体'), '衬线');
  assert.strictEqual(inferCategory('楷体'), '衬线');
  assert.strictEqual(inferCategory('Cambria'), '衬线');
});
t('无衬线字体', () => {
  assert.strictEqual(inferCategory('Arial'), '无衬线');
  assert.strictEqual(inferCategory('Helvetica'), '无衬线');
  assert.strictEqual(inferCategory('微软雅黑'), '无衬线');
  assert.strictEqual(inferCategory('PingFang SC'), '无衬线');
});
t('手写字体', () => {
  assert.strictEqual(inferCategory('Comic Sans MS'), '手写');
  assert.strictEqual(inferCategory('行楷'), '手写');
  assert.strictEqual(inferCategory('Bradley Hand'), '手写');
});
t('装饰字体', () => {
  assert.strictEqual(inferCategory('Impact'), '装饰');
  assert.strictEqual(inferCategory('Bebas Neue'), '装饰');
});
t('未知归为其他', () => {
  assert.strictEqual(inferCategory('SomeWeirdFont'), '其他');
  assert.strictEqual(inferCategory(''), '其他');
});

console.log('字体名规范化');
t('去首尾引号', () => assert.strictEqual(normalizeFamily('"Arial"'), 'Arial'));
t('去首尾单引号', () => assert.strictEqual(normalizeFamily("'Arial'"), 'Arial'));
t('去除两端空白', () => assert.strictEqual(normalizeFamily('  Arial  '), 'Arial'));
t('空字符串处理', () => assert.strictEqual(normalizeFamily(null), ''));
t('undefined 处理', () => assert.strictEqual(normalizeFamily(undefined), ''));
t('保留内部空格', () => assert.strictEqual(normalizeFamily('  Times New Roman  '), 'Times New Roman'));

console.log('CSS family 转义');
t('简单名称不转义', () => assert.strictEqual(cssFamily('Arial'), 'Arial'));
t('含空格加引号', () => assert.strictEqual(cssFamily('Times New Roman'), '"Times New Roman"'));
t('已带引号不再加', () => assert.strictEqual(cssFamily('"Already Quoted"'), '"Already Quoted"'));
t('已带单引号不再加', () => assert.strictEqual(cssFamily("'Already Quoted'"), "'Already Quoted'"));
t('中文名不加引号', () => assert.strictEqual(cssFamily('微软雅黑'), '微软雅黑'));

console.log('标签匹配评分');
t('无过滤标签返回 1', () => assert.strictEqual(tagScore('Arial', {}, []), 1));
t('完全命中', () => {
  const tags = { Arial: ['标题', '中文'] };
  assert.strictEqual(tagScore('Arial', tags, ['标题', '中文']), 1);
});
t('部分命中', () => {
  const tags = { Arial: ['标题'] };
  const s = tagScore('Arial', tags, ['标题', '中文']);
  assert.ok(Math.abs(s - 0.5) < 0.001);
});
t('无命中返回 0', () => {
  const tags = { Arial: ['标题'] };
  assert.strictEqual(tagScore('Arial', tags, ['中文']), 0);
});

console.log('字体过滤');
const sample = ['Arial', '微软雅黑', 'Times New Roman', 'Fira Code', '宋体', 'Comic Sans MS'];
t('搜索过滤', () => {
  const r = filterFonts(sample, { search: 'arial' });
  assert.ok(r.includes('Arial'));
  assert.ok(!r.includes('宋体'));
});
t('分类过滤', () => {
  const r = filterFonts(sample, { filterCategory: '等宽' });
  assert.ok(r.includes('Fira Code'));
  assert.ok(!r.includes('Arial'));
});
t('标签过滤', () => {
  const tags = { 'Arial': ['标题'], '宋体': ['正文'] };
  const r = filterFonts(sample, { tags, filterTags: ['标题'] });
  assert.ok(r.includes('Arial'));
  assert.ok(!r.includes('宋体'));
});
t('多条件组合', () => {
  const tags = { 'Arial': ['标题'] };
  const r = filterFonts(sample, { search: 'ari', tags, filterTags: ['标题'], filterCategory: '无衬线' });
  assert.ok(r.includes('Arial'));
  assert.strictEqual(r.length, 1);
});
t('无匹配返回空', () => {
  const r = filterFonts(sample, { search: 'zzzznotexist' });
  assert.strictEqual(r.length, 0);
});

console.log('排序（中文字体优先）');
t('中文字体排在前面', () => {
  const r = sortFontsCJKFirst(['Arial', '微软雅黑', 'Helvetica']);
  assert.strictEqual(r[0], '微软雅黑');
});
t('保持相对顺序', () => {
  const r = sortFontsCJKFirst(['Helvetica', 'Arial']);
  // 同为拉丁字体，按 localeCompare 排序
  assert.strictEqual(r.length, 2);
});
t('全中文字体排序', () => {
  const r = sortFontsCJKFirst(['微软雅黑', '宋体', '楷体']);
  assert.strictEqual(r.length, 3);
  // 全部为中文，按 localeCompare 排序，不报错即可
  assert.ok(r.includes('微软雅黑') && r.includes('宋体') && r.includes('楷体'));
});
t('空数组排序', () => {
  const r = sortFontsCJKFirst([]);
  assert.strictEqual(r.length, 0);
});
t('不修改原数组', () => {
  const orig = ['Arial', '微软雅黑'];
  const r = sortFontsCJKFirst(orig);
  assert.strictEqual(orig[0], 'Arial'); // 原数组不变
  assert.strictEqual(r[0], '微软雅黑');
});

console.log('中文字体过滤 filterCJK');
t('filterCJK=true 仅保留中文字体', () => {
  const r = filterFonts(sample, { filterCJK: true });
  assert.ok(r.includes('微软雅黑'));
  assert.ok(r.includes('宋体'));
  assert.ok(!r.includes('Arial'));
  assert.ok(!r.includes('Times New Roman'));
});
t('filterCJK=false 仅保留非中文字体', () => {
  const r = filterFonts(sample, { filterCJK: false });
  assert.ok(r.includes('Arial'));
  assert.ok(r.includes('Fira Code'));
  assert.ok(!r.includes('微软雅黑'));
  assert.ok(!r.includes('宋体'));
});
t('filterCJK=null 不过滤', () => {
  const r = filterFonts(sample, { filterCJK: null });
  assert.strictEqual(r.length, sample.length);
});
t('filterCJK 未传等同 null', () => {
  const r = filterFonts(sample, {});
  assert.strictEqual(r.length, sample.length);
});
t('filterCJK + 搜索组合', () => {
  // 中文 + 搜索"宋"
  const r = filterFonts(sample, { filterCJK: true, search: '宋' });
  assert.ok(r.includes('宋体'));
  assert.strictEqual(r.length, 1);
});
t('filterCJK + 分类组合', () => {
  // 非中文 + 等宽
  const r = filterFonts(sample, { filterCJK: false, filterCategory: '等宽' });
  assert.ok(r.includes('Fira Code'));
  assert.ok(!r.includes('微软雅黑'));
});
t('filterCJK + 标签组合', () => {
  const tags = { '微软雅黑': ['标题'], 'Arial': ['标题'] };
  // 中文 + 标签"标题"
  const r = filterFonts(sample, { filterCJK: true, tags, filterTags: ['标题'] });
  assert.ok(r.includes('微软雅黑'));
  assert.ok(!r.includes('Arial'));
});
t('filterCJK=true 全为非中文返回空', () => {
  const allLatin = ['Arial', 'Helvetica', 'Times New Roman'];
  const r = filterFonts(allLatin, { filterCJK: true });
  assert.strictEqual(r.length, 0);
});
t('filterCJK=false 全为中文返回空', () => {
  const allCJK = ['微软雅黑', '宋体', '楷体'];
  const r = filterFonts(allCJK, { filterCJK: false });
  assert.strictEqual(r.length, 0);
});

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
