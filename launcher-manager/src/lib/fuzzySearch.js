// 模糊搜索算法 - 子序列匹配 + 连续匹配加分 + 首字母匹配加分
// 不依赖第三方库，轻量高效

function matchScore(t, q) {
  if (!q) return { score: 1, positions: [] };
  const text = t.toLowerCase();
  const query = q.toLowerCase();

  if (text === query) {
    return { score: 1000, positions: range(0, query.length) };
  }
  if (text.startsWith(query)) {
    return { score: 500 + (1 / (text.length + 1)) * 100, positions: range(0, query.length) };
  }
  const idx = text.indexOf(query);
  if (idx >= 0) {
    // 完整单词匹配（前后为非字母数字边界或字符串首尾）：最高优先级
    const before = idx === 0 ? true : /[^a-z0-9]/.test(text[idx - 1]);
    const after = (idx + query.length) >= text.length ? true : /[^a-z0-9]/.test(text[idx + query.length]);
    if (before && after) {
      return { score: 600, positions: range(idx, idx + query.length) };
    }
    return { score: 300 - idx + (1 / (text.length + 1)) * 50, positions: range(idx, idx + query.length) };
  }

  // 子序列模糊匹配
  const positions = [];
  let ti = 0;
  for (let qi = 0; qi < query.length; qi++) {
    const ch = query[qi];
    let found = false;
    while (ti < text.length) {
      if (text[ti] === ch) {
        positions.push(ti);
        ti++;
        found = true;
        break;
      }
      ti++;
    }
    if (!found) {
      return { score: -1, positions: [] };
    }
  }

  let score = 50;
  let consecutive = 1;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === positions[i - 1] + 1) {
      consecutive++;
      score += consecutive * 8;
    } else {
      consecutive = 1;
      score -= 3;
    }
  }
  if (positions[0] === 0) {
    score += 30;
  }
  for (let i = 1; i < positions.length; i++) {
    const prev = text[positions[i] - 1];
    if (prev === ' ' || prev === '-' || prev === '_' || prev === '.') {
      score += 15;
    }
  }
  const span = positions[positions.length - 1] - positions[0];
  score -= span * 0.5;

  return { score, positions };
}

function range(start, end) {
  const r = [];
  for (let i = start; i < end; i++) r.push(i);
  return r;
}

function fuzzySearch(items, query, options = {}) {
  const key = options.key || 'name';
  const limit = options.limit || 8;

  if (!query || !query.trim()) {
    return items.slice(0, limit).map(item => ({ item, score: 0, positions: [] }));
  }

  const results = [];
  for (const item of items) {
    const text = item[key] || '';
    const { score, positions } = matchScore(text, query);
    if (score >= 0) {
      results.push({ item, score, positions });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item[key].length - b.item[key].length;
  });

  return results.slice(0, limit);
}

module.exports = { fuzzySearch, matchScore };
