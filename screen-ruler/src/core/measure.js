// 测量核心逻辑 - 纯函数模块，可被 main 进程和 renderer 共用
// 包含：距离、角度、标尺刻度、单位换算、几何计算

'use strict';

/**
 * 计算两点间距离（欧氏距离）
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
function distance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算两点向量与 X 轴正方向的夹角（度，-180 ~ 180）
 * @param {{x:number,y:number}} a 起点
 * @param {{x:number,y:number}} b 终点
 * @returns {number} 角度（度）
 */
function angleOfLine(a, b) {
  // 屏幕 Y 轴向下，反转后让上方为正角度（符合直觉）
  const rad = Math.atan2(-(b.y - a.y), b.x - a.x);
  return rad * 180 / Math.PI;
}

/**
 * 三点定角：以 vertex 为顶点，计算 ray1-vertex-ray2 的夹角（度，0~360）
 * @param {{x:number,y:number}} vertex 顶点
 * @param {{x:number,y:number}} ray1 第一条边端点
 * @param {{x:number,y:number}} ray2 第二条边端点
 * @returns {number} 角度（度，0~360）
 */
function angleBetween(vertex, ray1, ray2) {
  const v1 = { x: ray1.x - vertex.x, y: -(ray1.y - vertex.y) };
  const v2 = { x: ray2.x - vertex.x, y: -(ray2.y - vertex.y) };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const m2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (m1 === 0 || m2 === 0) return 0;
  let cos = dot / (m1 * m2);
  // 防止浮点误差导致 NaN
  if (cos > 1) cos = 1;
  if (cos < -1) cos = -1;
  let deg = Math.acos(cos) * 180 / Math.PI;
  // 用叉积判断方向，得到 0~360
  const cross = v1.x * v2.y - v1.y * v2.x;
  if (cross < 0) deg = 360 - deg;
  return deg;
}

/**
 * 生成标尺刻度
 * @param {number} length 像素长度
 * @param {number} [step=50] 主刻度间隔
 * @returns {{pos:number,major:boolean,label?:string}[]}
 */
function rulerTicks(length, step = 50) {
  const ticks = [];
  for (let p = 0; p <= length; p += 10) {
    const major = p % step === 0;
    ticks.push({
      pos: p,
      major,
      label: major ? String(p) : undefined
    });
  }
  return ticks;
}

/**
 * 像素 → 物理长度估算（基于 DPI）
 * Windows 默认 96 DPI：1 inch = 96 px = 25.4 mm
 * @param {number} px
 * @param {number} [dpi=96]
 * @returns {{mm:number,cm:number,in:number}}
 */
function pxToPhysical(px, dpi = 96) {
  const inches = px / dpi;
  return {
    mm: inches * 25.4,
    cm: inches * 2.54,
    in: inches
  };
}

/**
 * 标准化矩形（左上角为原点，宽高为正）
 * @param {{x:number,y:number}} a 拖拽起点
 * @param {{x:number,y:number}} b 拖拽终点
 */
function normalizeRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  return { x, y, w, h };
}

/**
 * 点是否在矩形内
 */
function pointInRect(p, rect) {
  return p.x >= rect.x && p.x <= rect.x + rect.w &&
         p.y >= rect.y && p.y <= rect.y + rect.h;
}

/**
 * 找到点所在的显示器
 * @param {Array<{bounds:{x:number,y:number,width:number,height:number}}>} displays
 * @param {{x:number,y:number}} point
 * @returns {Object|null} 匹配的显示器，无匹配时返回 null
 */
function findDisplayAt(displays, point) {
  if (!Array.isArray(displays) || !point) return null;
  return displays.find(d => {
    const b = d.bounds;
    return point.x >= b.x && point.x < b.x + b.width &&
           point.y >= b.y && point.y < b.y + b.height;
  }) || null;
}

/**
 * 格式化测量结果为可读字符串
 */
function formatMeasure(kind, data) {
  switch (kind) {
    case 'rect':
      return `${Math.round(data.w)} × ${Math.round(data.h)} px`;
    case 'line':
      return `${Math.round(data.len)} px  ∠ ${data.angle.toFixed(1)}°`;
    case 'angle':
      return `${data.deg.toFixed(1)}°`;
    default:
      return '';
  }
}

module.exports = {
  distance,
  angleOfLine,
  angleBetween,
  rulerTicks,
  pxToPhysical,
  normalizeRect,
  pointInRect,
  findDisplayAt,
  formatMeasure
};
