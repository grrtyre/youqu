// 极简 UUID v4 生成（无需依赖）
function uuidv4() {
  // 非加密强度，足够历史记录 ID 用
  const rnd = (n) => {
    const arr = new Array(n);
    for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  };
  const b = rnd(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.map(x => x.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}
module.exports = { v4: uuidv4 };
