// Squarified Treemap 布局算法（Bruls/Huijsmans/van Wijk 2000）
// 输入：矩形区域 + 带 size 的节点列表（按 size 降序）
// 输出：每个节点的 {x, y, w, h}
'use strict';

// 计算一行/一列的最差长宽比
// row: 当前行的 area 列表（size 比例转面积）
// w: 行的另一侧长度（短边）
function worst(row, w) {
  if (!row.length) return Infinity;
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (let i = 0; i < row.length; i++) {
    const a = row[i];
    sum += a;
    if (a > max) max = a;
    if (a < min) min = a;
  }
  const w2 = w * w;
  const s2 = sum * sum;
  // 避免除零
  if (s2 === 0) return Infinity;
  return Math.max((w2 * max) / s2, s2 / (w2 * min));
}

// 把一行铺到矩形的一侧
// row: 行内节点的 area 列表
// rect: {x, y, w, h} 当前可用矩形
// 沿短边铺，返回 [{node, x, y, w, h}, ...] 以及铺完后的剩余矩形
function layoutRow(row, rect) {
  const { x, y, w, h } = rect;
  const out = [];
  const sum = row.reduce((s, r) => s + r.area, 0);
  // 沿短边铺：如果 w <= h，沿垂直方向铺一列（宽度 = sum/h）
  if (w <= h) {
    const colW = (sum / h);
    let oy = y;
    for (let i = 0; i < row.length; i++) {
      const r = row[i];
      const itemH = h > 0 ? r.area / colW : 0;
      out.push({ node: r.node, x: x, y: oy, w: colW, h: itemH });
      oy += itemH;
    }
    return { rects: out, remaining: { x: x + colW, y: y, w: w - colW, h: h } };
  } else {
    const rowH = (sum / w);
    let ox = x;
    for (let i = 0; i < row.length; i++) {
      const r = row[i];
      const itemW = w > 0 ? r.area / rowH : 0;
      out.push({ node: r.node, x: ox, y: y, w: itemW, h: rowH });
      ox += itemW;
    }
    return { rects: out, remaining: { x: x, y: y + rowH, w: w, h: h - rowH } };
  }
}

// 主算法：squarify
// items: [{ node, size }] 已按 size 降序
// rect: {x, y, w, h}
function squarify(items, rect) {
  if (!items.length || rect.w <= 0 || rect.h <= 0) return [];
  const total = items.reduce((s, it) => s + it.size, 0);
  if (total <= 0) return [];
  // 短边
  const w = Math.min(rect.w, rect.h);
  // 把 size 转成面积比例（area = size / total * rectArea）
  const area = rect.w * rect.h;
  const scaled = items.map(it => ({ node: it.node, area: (it.size / total) * area, size: it.size }));

  const result = [];
  let row = [];
  let remaining = scaled.slice();
  let curRect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };

  function shortSide(r) { return Math.min(r.w, r.h); }

  while (remaining.length > 0) {
    if (curRect.w <= 0 || curRect.h <= 0) break;
    const next = remaining[0];
    const rowAreas = row.map(r => r.area);
    const worstWithNext = worst(rowAreas.concat(next.area), shortSide(curRect));
    const worstWithoutNext = worst(rowAreas, shortSide(curRect));
    if (row.length === 0 || worstWithNext <= worstWithoutNext) {
      // 继续加到当前行
      row.push(next);
      remaining.shift();
    } else {
      // 提交当前行
      const { rects, remaining: rem } = layoutRow(row, curRect);
      for (let i = 0; i < rects.length; i++) result.push(rects[i]);
      curRect = rem;
      row = [];
    }
  }
  // 提交最后一行
  if (row.length > 0 && curRect.w > 0 && curRect.h > 0) {
    const { rects } = layoutRow(row, curRect);
    for (let i = 0; i < rects.length; i++) result.push(rects[i]);
  }
  return result;
}

// 分层 treemap：对目录节点的 children 做 squarify，递归到一定深度
// node: 目录节点（带 children）
// rect: 当前矩形
// depth: 当前深度
// maxDepth: 最大深度
// minSizeRatio: 相对父总面积小于此比例的不再细分（直接画色块）
function hierarchicalTreemap(node, rect, depth, maxDepth, minSizeRatio) {
  depth = depth || 0;
  maxDepth = maxDepth || 2;
  minSizeRatio = minSizeRatio || 0.01;
  const out = [];
  if (!node || node.size <= 0 || rect.w <= 0 || rect.h <= 0) return out;
  if (node.type === 'file' || !node.children || node.children.length === 0) {
    out.push({ node: node, rect: rect, depth: depth });
    return out;
  }
  // 只取 size > 0 的子节点
  const items = node.children
    .filter(c => c.size > 0)
    .map(c => ({ node: c, size: c.size }));
  if (items.length === 0) return out;

  const rects = squarify(items, rect);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    // 修正负数/零
    const rr = {
      x: r.x, y: r.y,
      w: Math.max(0, r.w),
      h: Math.max(0, r.h),
    };
    out.push({ node: r.node, rect: rr, depth: depth });
    // 递归细分目录
    if (r.node.type === 'dir' && depth < maxDepth) {
      const ratio = node.size > 0 ? r.node.size / node.size : 0;
      if (ratio >= minSizeRatio && rr.w > 2 && rr.h > 2) {
        const sub = hierarchicalTreemap(r.node, rr, depth + 1, maxDepth, minSizeRatio);
        for (let j = 0; j < sub.length; j++) out.push(sub[j]);
      }
    }
  }
  return out;
}

module.exports = { squarify, hierarchicalTreemap, worst, layoutRow };
