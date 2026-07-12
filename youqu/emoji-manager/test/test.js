// test/test.js — 表情管家核心逻辑测试（不依赖 Electron）
// 运行：node test/test.js
// 因 electron-store 需 Electron 环境，本测试不覆盖 store，仅覆盖数据/搜索逻辑
const assert = require('assert');
const { EMOJI_CATEGORIES, ALL_CATEGORIES, getAllCategories, getAllEmojis } = require('../src/core/emoji-data');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

function main() {
  console.log('\n[1] 基础数据结构');
  ok('EMOJI_CATEGORIES 是数组', Array.isArray(EMOJI_CATEGORIES));
  ok('EMOJI_CATEGORIES 至少 4 个分类', EMOJI_CATEGORIES.length >= 4);
  ok('ALL_CATEGORIES 包含额外分类', ALL_CATEGORIES.length >= EMOJI_CATEGORIES.length + 5);
  ok('每个分类有 id/name/icon/emojis', EMOJI_CATEGORIES.every(c => c.id && c.name && c.icon && Array.isArray(c.emojis)));
  ok('每个 emoji 至少有 c 字段', EMOJI_CATEGORIES.every(c => c.emojis.every(e => e.c && typeof e.c === 'string')));

  console.log('\n[2] getAllCategories 合并颜文字与特殊符号');
  const allCats = getAllCategories();
  const ids = allCats.map(c => c.id);
  ok('包含 kao 颜文字分类', ids.includes('kao'));
  ok('包含 special 特殊符号分类', ids.includes('special'));
  ok('总分类数 >= 11', allCats.length >= 11);

  console.log('\n[3] getAllEmojis 扁平化');
  const all = getAllEmojis();
  ok('返回数组', Array.isArray(all));
  ok('总数 >= 600', all.length >= 600);
  ok('每个项带 cat 和 catName', all.every(e => e.cat && e.catName));
  ok('项中有 c 字段', all.every(e => e.c));

  console.log('\n[4] 搜索逻辑（模拟主进程 emoji-search）');
  function search(keyword) {
    if (!keyword || !keyword.trim()) return [];
    const kw = keyword.trim().toLowerCase();
    return all.filter(e => {
      if (e.n && e.n.toLowerCase().includes(kw)) return true;
      if (e.k && e.k.toLowerCase().includes(kw)) return true;
      if (e.c && e.c.includes(keyword.trim())) return true;
      return false;
    });
  }
  // 中文名搜索
  const laugh = search('笑');
  ok('搜 "笑" 有结果', laugh.length > 0);
  ok('搜 "笑" 的结果都含 笑', laugh.every(e => (e.n && e.n.includes('笑')) || (e.k && e.k.includes('笑'))));
  // 关键词搜索
  const heart = search('love');
  ok('搜 "love" 有结果', heart.length > 0);
  // 颜文字搜索
  const kao = search('掀桌');
  ok('搜 "掀桌" 找到颜文字', kao.length > 0 && kao.some(e => e.cat === 'kao'));
  // 字符直接搜索
  const direct = search('😀');
  ok('直接搜字符能找到', direct.length > 0 && direct.some(e => e.c === '😀'));
  // 空搜索
  ok('空搜索返回空数组', search('').length === 0);
  ok('空白搜索返回空数组', search('   ').length === 0);

  console.log('\n[5] Unicode 码点计算');
  // 模拟前端码点计算
  function codepoints(s) {
    const arr = [];
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      arr.push('U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
    }
    return arr.join(' ');
  }
  ok('😀 码点为 U+1F600', codepoints('😀') === 'U+1F600');
  ok('😂 码点为 U+1F602', codepoints('😂') === 'U+1F602');
  ok('颜文字字符不变', codepoints('(´・ω・`)').startsWith('U+0028'));

  console.log('\n[6] 颜文字转义检查');
  // 颜文字数据源中的反斜杠应正确转义为单反斜杠
  const kaoCat = allCats.find(c => c.id === 'kao');
  const shrug = kaoCat ? kaoCat.emojis.find(e => e.n === '耸肩') : null;
  ok('找到 "耸肩" 颜文字', !!shrug);
  if (shrug) {
    ok('耸肩颜文字含单反斜杠', shrug.c.includes('\\') && shrug.c.length === shrug.c.replace(/\\/g, '').length + 1);
    ok('耸肩颜文字含 _', shrug.c.includes('_') && shrug.c.includes('ツ'));
  }

  console.log('\n[7] 数据无重复字符（每个分类内）');
  const dups = [];
  for (const cat of allCats) {
    const seen = new Set();
    for (const e of cat.emojis) {
      if (seen.has(e.c)) dups.push(cat.id + ':' + e.c);
      seen.add(e.c);
    }
  }
  ok('分类内无重复 emoji', dups.length === 0);
  if (dups.length) console.log('    重复项:', dups.slice(0, 5).join(', '));

  console.log('\n========== 测试结果 ==========');
  console.log(`通过：${pass}，失败：${fail}`);
  if (fail > 0) {
    process.exit(1);
  }
}

try {
  main();
} catch (e) {
  console.error('测试异常:', e);
  process.exit(2);
}
