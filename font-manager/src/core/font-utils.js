// src/core/font-utils.js — 字体工具纯函数（可测试）

// 判断字体名是否包含中文（粗略）
function hasCJK(name) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(name);
}

// 字体分类推断（按名称关键词）
function inferCategory(family) {
  const f = family.toLowerCase();
  if (/mono|code|consol|courier|menlo|fira code|jetbrains|source code/.test(f)) return '等宽';
  if (/hand|script|cursive|行|草|handwrit|comic/.test(f)) return '手写';
  if (/serif|宋|明|楷|times|georgia|garamond|cambria/.test(f)) return '衬线';
  if (/sans|黑|微软雅黑|pingfang|helvetica|arial|roboto|open sans|sf pro/.test(f)) return '无衬线';
  if (/display|title|装饰|poster|impact|bebas/.test(f)) return '装饰';
  return '其他';
}

// 判断是否中文字体（中文字体名或包含中文别名）
function isCJKFont(family) {
  return hasCJK(family);
}

// 字体名规范化（去重时用）
function normalizeFamily(name) {
  return (name || '').trim().replace(/^["']|["']$/g, '');
}

// 计算标签匹配度（用于标签过滤时排序）
function tagScore(family, tags, filterTags) {
  if (!filterTags || !filterTags.length) return 1;
  const ft = tags[family] || [];
  let hit = 0;
  for (const t of filterTags) if (ft.includes(t)) hit++;
  return hit / filterTags.length;
}

// 字体过滤（搜索 + 标签 + 分类）
function filterFonts(fonts, { search = '', tags = {}, filterTags = [], filterCategory = '' } = {}) {
  let list = fonts.slice();
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(f => f.toLowerCase().includes(s));
  }
  if (filterCategory) {
    list = list.filter(f => inferCategory(f) === filterCategory);
  }
  if (filterTags && filterTags.length) {
    list = list.filter(f => {
      const ft = tags[f] || [];
      return filterTags.every(t => ft.includes(t));
    });
  }
  return list;
}

// 排序：中文字体优先，然后字母序
function sortFontsCJKFirst(fonts) {
  return fonts.slice().sort((a, b) => {
    const aC = isCJKFont(a), bC = isCJKFont(b);
    if (aC && !bC) return -1;
    if (!aC && bC) return 1;
    return a.localeCompare(b, 'zh-Hans');
  });
}

// 字体安全 CSS family（含空格的需引号）
function cssFamily(name) {
  if (/\s/.test(name) && !/^["'].*["']$/.test(name)) {
    return `"${name}"`;
  }
  return name;
}

module.exports = {
  hasCJK, inferCategory, isCJKFont, normalizeFamily,
  tagScore, filterFonts, sortFontsCJKFirst, cssFamily
};
