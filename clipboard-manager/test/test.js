// 测试脚本：验证核心逻辑（分类、去重、IPC 接口契约）
// 由于 main.js 依赖 electron，我们提取纯逻辑函数测试
const assert = require('assert');

// 重新实现 classifyContent（与 main.js 一致）进行测试
function classifyContent(text) {
  if (typeof text !== 'string' || text.length === 0) return 'text';
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'link';
  if (/^\S+@\S+\.\S+$/.test(trimmed)) return 'email';
  if (/^1[3-9]\d{9}$/.test(trimmed)) return 'phone';
  if (/(?:function|const|let|var|import|export|=>|class |return |if\s*\(|for\s*\(|while\s*\(|switch\s*\(|\.map\(|\.filter\(|\.forEach\(|async |await )/.test(trimmed)) return 'code';
  if (trimmed.includes('\n') && trimmed.split('\n').length >= 2) {
    const lines = trimmed.split('\n');
    const indentedLines = lines.filter(l => /^\s{2,}/.test(l));
    if (indentedLines.length >= Math.floor(lines.length / 2)) return 'code';
  }
  return 'text';
}

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + ' — ' + e.message); }
}

console.log('\n=== 1. 内容分类 ===');
test('链接识别 http', () => assert.strictEqual(classifyContent('https://github.com'), 'link'));
test('链接识别 http://', () => assert.strictEqual(classifyContent('http://example.com/path'), 'link'));
test('邮箱识别', () => assert.strictEqual(classifyContent('user@example.com'), 'email'));
test('手机号识别', () => assert.strictEqual(classifyContent('13812345678'), 'phone'));
test('代码识别 function', () => assert.strictEqual(classifyContent('function add(a,b){return a+b}'), 'code'));
test('代码识别 const', () => assert.strictEqual(classifyContent('const x = 1'), 'code'));
test('代码识别 箭头函数', () => assert.strictEqual(classifyContent('const f = () => 2'), 'code'));
test('代码识别 import', () => assert.strictEqual(classifyContent('import React from "react"'), 'code'));
test('代码识别 多行缩进', () => {
  assert.strictEqual(classifyContent('if true:\n  print(1)\n  print(2)'), 'code');
});
test('普通文本', () => assert.strictEqual(classifyContent('今天天气不错'), 'text'));
test('空字符串', () => assert.strictEqual(classifyContent(''), 'text'));
test('null 安全', () => assert.strictEqual(classifyContent(null), 'text'));
test('undefined 安全', () => assert.strictEqual(classifyContent(undefined), 'text'));

console.log('\n=== 2. 数据结构契约 ===');
// 模拟一个剪贴板条目的结构
const sampleItem = {
  id: 'abc123',
  content: 'hello',
  type: 'text',
  timestamp: Date.now(),
  pinned: false,
  favorite: false
};
test('条目结构完整', () => {
  assert.ok(sampleItem.id, '需要有 id');
  assert.ok(sampleItem.content, '需要有 content');
  assert.ok(['code','link','email','phone','text','image'].includes(sampleItem.type), 'type 需合法');
  assert.strictEqual(typeof sampleItem.timestamp, 'number');
  assert.strictEqual(typeof sampleItem.pinned, 'boolean');
  assert.strictEqual(typeof sampleItem.favorite, 'boolean');
});

console.log('\n=== 3. 去重逻辑 ===');
// 模拟 main.js 的去重：连续相同内容不记录
let history = [{ content: 'aaa', id: '1' }];
let lastContent = 'aaa';
function tryAdd(current) {
  if (current && current !== lastContent) {
    if (history.length > 0 && history[0].content === current) return false;
    history.unshift({ content: current, id: Date.now().toString() });
    lastContent = current;
    return true;
  }
  return false;
}
test('相同内容不重复记录', () => assert.strictEqual(tryAdd('aaa'), false));
test('新内容会记录', () => assert.strictEqual(tryAdd('bbb'), true));
test('新内容在顶部', () => assert.strictEqual(history[0].content, 'bbb'));

console.log('\n=== 4. 最大条目限制 ===');
let bigHistory = [];
for (let i = 0; i < 600; i++) bigHistory.push({ id: i, content: 'item' + i });
if (bigHistory.length > 500) bigHistory = bigHistory.slice(0, 500);
test('超过 500 条截断', () => assert.strictEqual(bigHistory.length, 500));

console.log('\n=== 5. 清空保留置顶与收藏 ===');
// v1.3.0 修复：清空时保留 pinned 或 favorite（与按钮文案"保留收藏"一致）
let clearHistory = [
  { id: '1', content: 'a', pinned: true, favorite: false },
  { id: '2', content: 'b', pinned: false, favorite: false },
  { id: '3', content: 'c', pinned: true, favorite: false },
  { id: '4', content: 'd', pinned: false, favorite: true },
  { id: '5', content: 'e', pinned: false, favorite: false }
];
clearHistory = clearHistory.filter(i => i.pinned || i.favorite);
test('清空后保留置顶和收藏', () => {
  assert.strictEqual(clearHistory.length, 3);
  assert.ok(clearHistory.every(i => i.pinned || i.favorite));
});
test('清空后非置顶非收藏被移除', () => {
  const removed = ['b', 'e'];
  assert.ok(clearHistory.every(i => !removed.includes(i.content)));
});
test('清空后收藏项保留', () => {
  assert.ok(clearHistory.some(i => i.content === 'd' && i.favorite));
});

console.log('\n=== 6. 搜索过滤 ===');
const searchPool = [
  { content: 'hello world', type: 'text' },
  { content: 'function foo()', type: 'code' },
  { content: 'https://github.com', type: 'link' }
];
test('关键词搜索', () => {
  const q = 'hello';
  const r = searchPool.filter(i => i.content.toLowerCase().includes(q));
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].content, 'hello world');
});
test('类型筛选', () => {
  const r = searchPool.filter(i => i.type === 'code');
  assert.strictEqual(r.length, 1);
});

console.log('\n=== 7. 相对时间格式 ===');
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return '刚刚';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' 分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小时前';
  return '更久前';
}
test('刚刚', () => assert.strictEqual(timeAgo(Date.now() - 5000), '刚刚'));
test('分钟前', () => assert.strictEqual(timeAgo(Date.now() - 120000), '2 分钟前'));
test('小时前', () => assert.strictEqual(timeAgo(Date.now() - 7200000), '2 小时前'));

console.log('\n=== 8. 键盘导航索引边界 ===');
// 模拟 renderer.js 的 focusedIndex 边界控制逻辑
function clampFocus(focusedIndex, itemsLen) {
  if (focusedIndex >= itemsLen) focusedIndex = itemsLen - 1;
  if (focusedIndex < -1) focusedIndex = -1;
  return focusedIndex;
}
test('索引超出上限被截断', () => assert.strictEqual(clampFocus(5, 3), 2));
test('索引 -2 被修正为 -1', () => assert.strictEqual(clampFocus(-2, 3), -1));
test('空列表索引归 -1', () => assert.strictEqual(clampFocus(0, 0), -1));
test('合法索引不变', () => assert.strictEqual(clampFocus(1, 3), 1));

// 模拟上下箭头移动
function moveDown(focusedIndex, itemsLen) {
  return Math.min(focusedIndex + 1, itemsLen - 1);
}
function moveUp(focusedIndex) {
  return Math.max(focusedIndex - 1, 0);
}
test('下箭头不超上限', () => assert.strictEqual(moveDown(2, 3), 2));
test('上箭头不低于 0', () => assert.strictEqual(moveUp(0), 0));
test('下箭头从 -1 到 0', () => assert.strictEqual(moveDown(-1, 3), 0));

console.log('\n=== 9. 自动粘贴设置 ===');
// 模拟 localStorage 读取逻辑
function readAutoPaste(stored) {
  return stored === null ? true : stored === '1';
}
test('未设置时默认开启', () => assert.strictEqual(readAutoPaste(null), true));
test('"1" 表示开启', () => assert.strictEqual(readAutoPaste('1'), true));
test('"0" 表示关闭', () => assert.strictEqual(readAutoPaste('0'), false));

console.log('\n=== 10. 搜索关键词高亮 ===');
// 与 renderer.js 中 highlight 一致的纯逻辑实现
function escapeHtmlTest(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeRegExpTest(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function highlight(text, query) {
  const escaped = escapeHtmlTest(text);
  if (!query) return escaped;
  const safeQuery = escapeRegExpTest(query);
  try {
    const re = new RegExp('(' + safeQuery + ')', 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  } catch (e) {
    return escaped;
  }
}
test('无关键词返回纯 escape', () => {
  assert.strictEqual(highlight('hello world', ''), 'hello world');
});
test('匹配关键词被 mark 包裹', () => {
  const r = highlight('hello world', 'world');
  assert.strictEqual(r, 'hello <mark>world</mark>');
});
test('大小写不敏感匹配', () => {
  const r = highlight('Hello World', 'hello');
  assert.strictEqual(r, '<mark>Hello</mark> World');
});
test('多处匹配都高亮', () => {
  const r = highlight('foo bar foo', 'foo');
  assert.strictEqual(r, '<mark>foo</mark> bar <mark>foo</mark>');
});
test('HTML 特殊字符被转义', () => {
  const r = highlight('<script>', '');
  assert.strictEqual(r, '&lt;script&gt;');
});
test('正则特殊字符作为关键词安全', () => {
  // 关键词含正则元字符，不应抛错且按字面匹配
  const r = highlight('a.b c.d', 'c.d');
  assert.strictEqual(r, 'a.b <mark>c.d</mark>');
});
test('空文本安全', () => {
  assert.strictEqual(highlight('', 'x'), '');
});

console.log('\n=== 11. 预览展开逻辑 ===');
// 模拟 expandedId 的 toggle 行为
let expandedId = null;
function toggleExpand(id) {
  expandedId = (expandedId === id) ? null : id;
  return expandedId;
}
test('首次展开返回 id', () => {
  expandedId = null;
  assert.strictEqual(toggleExpand('a1'), 'a1');
});
test('再次点击同一项收起', () => {
  expandedId = 'a1';
  assert.strictEqual(toggleExpand('a1'), null);
});
test('切换到另一项展开', () => {
  expandedId = 'a1';
  assert.strictEqual(toggleExpand('b2'), 'b2');
});
test('删除当前展开项应清空 expandedId', () => {
  expandedId = 'a1';
  // 模拟 renderer.js 中删除分支
  if (expandedId === 'a1') expandedId = null;
  assert.strictEqual(expandedId, null);
});

console.log('\n=== 12. 字数与行数统计 ===');
function countChars(s) { return String(s).length; }
function countLines(s) { return String(s).split('\n').length; }
test('字符数统计', () => {
  assert.strictEqual(countChars('hello'), 5);
  assert.strictEqual(countChars('你好世界'), 4);
  assert.strictEqual(countChars(''), 0);
});
test('行数统计（单行）', () => {
  assert.strictEqual(countLines('hello'), 1);
});
test('行数统计（多行）', () => {
  assert.strictEqual(countLines('a\nb\nc'), 3);
});
test('行数统计（含空行）', () => {
  assert.strictEqual(countLines('a\n\nb'), 3);
});

console.log('\n=== 13. 图片指纹与去重 ===');
// 模拟 main.js 的 imageFingerprint：宽×高:字节数
function imageFingerprint(size, bytes) {
  if (!size || bytes <= 0) return '';
  return size.width + 'x' + size.height + ':' + bytes;
}
test('相同尺寸+字节指纹相同', () => {
  assert.strictEqual(imageFingerprint({width:100,height:100}, 5000), imageFingerprint({width:100,height:100}, 5000));
});
test('不同尺寸指纹不同', () => {
  assert.notStrictEqual(imageFingerprint({width:100,height:100}, 5000), imageFingerprint({width:200,height:100}, 5000));
});
test('相同尺寸不同字节指纹不同', () => {
  assert.notStrictEqual(imageFingerprint({width:100,height:100}, 5000), imageFingerprint({width:100,height:100}, 6000));
});
test('空图片返回空指纹', () => {
  assert.strictEqual(imageFingerprint(null, 0), '');
  assert.strictEqual(imageFingerprint({width:0,height:0}, 0), '');
});
// 模拟轮询去重逻辑：相同指纹不重复记录
let lastImageFp = '';
function tryAddImage(size, bytes) {
  const fp = imageFingerprint(size, bytes);
  if (fp && fp !== lastImageFp) {
    lastImageFp = fp;
    return true;
  }
  return false;
}
test('新图片指纹会被记录', () => {
  lastImageFp = '';
  assert.strictEqual(tryAddImage({width:100,height:100}, 5000), true);
});
test('相同指纹不重复记录', () => {
  lastImageFp = imageFingerprint({width:100,height:100}, 5000);
  assert.strictEqual(tryAddImage({width:100,height:100}, 5000), false);
});
test('不同图片会被记录', () => {
  lastImageFp = imageFingerprint({width:100,height:100}, 5000);
  assert.strictEqual(tryAddImage({width:200,height:200}, 8000), true);
});

console.log('\n=== 14. 图片条目结构 ===');
const imageItem = {
  id: 'img1',
  content: '[图片] 100×100',
  type: 'image',
  imagePath: 'C:/userData/clipboard-images/img1.png',
  thumb: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD=',
  width: 100,
  height: 100,
  timestamp: Date.now(),
  pinned: false,
  favorite: false
};
test('图片条目类型为 image', () => assert.strictEqual(imageItem.type, 'image'));
test('图片条目含 imagePath', () => assert.ok(typeof imageItem.imagePath === 'string' && imageItem.imagePath.length > 0));
test('图片条目含 thumb dataURL', () => assert.ok(typeof imageItem.thumb === 'string' && imageItem.thumb.startsWith('data:image/')));
test('图片条目含宽高', () => {
  assert.strictEqual(typeof imageItem.width, 'number');
  assert.strictEqual(typeof imageItem.height, 'number');
});
test('图片条目 content 含尺寸信息', () => {
  assert.ok(imageItem.content.includes('100') && imageItem.content.includes('100'));
});
test('图片条目可置顶可收藏', () => {
  imageItem.pinned = true; imageItem.favorite = true;
  assert.strictEqual(imageItem.pinned, true);
  assert.strictEqual(imageItem.favorite, true);
});

console.log('\n=== 15. 编辑条目逻辑 ===');
// 模拟 main.js 的 edit-item IPC：更新内容并重新分类
function classifyContent(text) {
  if (typeof text !== 'string' || text.length === 0) return 'text';
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'link';
  if (/^\S+@\S+\.\S+$/.test(trimmed)) return 'email';
  if (/^1[3-9]\d{9}$/.test(trimmed)) return 'phone';
  if (/(?:function|const|let|var|import|export|=>|class |return |if\s*\(|for\s*\(|while\s*\(|switch\s*\(|\.map\(|\.filter\(|\.forEach\(|async |await )/.test(trimmed)) return 'code';
  if (trimmed.includes('\n') && trimmed.split('\n').length >= 2) {
    const lines = trimmed.split('\n');
    const indentedLines = lines.filter(l => /^\s{2,}/.test(l));
    if (indentedLines.length >= Math.floor(lines.length / 2)) return 'code';
  }
  return 'text';
}
function editItem(item, newContent) {
  if (typeof newContent !== 'string' || newContent.trim().length === 0) return null;
  if (item.type === 'image') return null;
  const trimmed = newContent.replace(/\r\n/g, '\n');
  item.content = trimmed;
  item.type = classifyContent(trimmed);
  return item;
}
test('编辑文本后内容更新', () => {
  const it = { content: 'hello', type: 'text' };
  const r = editItem(it, 'world');
  assert.strictEqual(r.content, 'world');
});
test('编辑后类型自动重分类（文本→链接）', () => {
  const it = { content: 'hello', type: 'text' };
  editItem(it, 'https://github.com');
  assert.strictEqual(it.type, 'link');
});
test('编辑后类型自动重分类（文本→代码）', () => {
  const it = { content: 'hello', type: 'text' };
  editItem(it, 'const x = 1');
  assert.strictEqual(it.type, 'code');
});
test('编辑空内容被拒绝', () => {
  const it = { content: 'hello', type: 'text' };
  assert.strictEqual(editItem(it, ''), null);
  assert.strictEqual(it.content, 'hello'); // 原内容不变
});
test('编辑纯空格内容被拒绝', () => {
  const it = { content: 'hello', type: 'text' };
  assert.strictEqual(editItem(it, '   '), null);
});
test('图片条目不可编辑', () => {
  const it = { content: '[图片] 100×100', type: 'image', imagePath: '/x.png' };
  assert.strictEqual(editItem(it, '新文本'), null);
});
test('编辑时 CRLF 统一为 LF', () => {
  const it = { content: 'a', type: 'text' };
  editItem(it, 'a\r\nb\r\nc');
  assert.strictEqual(it.content, 'a\nb\nc');
});

console.log('\n=== 16. 图片条目数量上限 ===');
// 模拟 enforceImageLimit：超出 50 张时删除最旧的未置顶未收藏图片
const MAX_IMAGE_ITEMS = 50;
function enforceImageLimit(history) {
  const imageItems = history.filter(i => i.type === 'image');
  if (imageItems.length <= MAX_IMAGE_ITEMS) return history;
  const sorted = imageItems
    .filter(i => !i.pinned && !i.favorite)
    .sort((a, b) => a.timestamp - b.timestamp);
  const toRemove = sorted.slice(0, imageItems.length - MAX_IMAGE_ITEMS);
  const removeIds = new Set(toRemove.map(i => i.id));
  return history.filter(i => !removeIds.has(i.id));
}
test('未达上限不删', () => {
  const h = Array.from({length: 30}, (_, i) => ({id: 'i'+i, type:'image', timestamp: i}));
  assert.strictEqual(enforceImageLimit(h).length, 30);
});
test('超出上限删除最旧未置顶', () => {
  const h = Array.from({length: 60}, (_, i) => ({
    id: 'i'+i, type:'image', timestamp: i, pinned: false, favorite: false
  }));
  const r = enforceImageLimit(h);
  assert.strictEqual(r.filter(i => i.type==='image').length, 50);
  // 保留的应是最新的 50 条（timestamp 10..59）
  const ts = r.filter(i => i.type==='image').map(i => i.timestamp);
  assert.strictEqual(Math.min(...ts), 10);
});
test('置顶图片不被上限删除', () => {
  const h = Array.from({length: 60}, (_, i) => ({
    id: 'i'+i, type:'image', timestamp: i,
    pinned: i === 0, // 最旧的那张置顶
    favorite: false
  }));
  const r = enforceImageLimit(h);
  assert.ok(r.some(i => i.id === 'i0' && i.pinned));
});
test('收藏图片不被上限删除', () => {
  const h = Array.from({length: 60}, (_, i) => ({
    id: 'i'+i, type:'image', timestamp: i,
    pinned: false,
    favorite: i === 1 // 第 2 张收藏
  }));
  const r = enforceImageLimit(h);
  assert.ok(r.some(i => i.id === 'i1' && i.favorite));
});

console.log('\n=== 17. 缩略图尺寸计算 ===');
// 模拟 main.js 的 makeThumbnailDataURL 中的尺寸计算逻辑
function computeThumbSize(w, h, maxEdge) {
  if (w > maxEdge || h > maxEdge) {
    if (w >= h) { h = Math.round(h * maxEdge / w); w = maxEdge; }
    else { w = Math.round(w * maxEdge / h); h = maxEdge; }
  }
  return { w, h };
}
test('小图不缩放', () => {
  const r = computeThumbSize(100, 100, 240);
  assert.strictEqual(r.w, 100); assert.strictEqual(r.h, 100);
});
test('大图按宽缩放', () => {
  const r = computeThumbSize(1832, 1832, 240);
  assert.strictEqual(r.w, 240); assert.strictEqual(r.h, 240);
});
test('横图按宽缩放保持比例', () => {
  const r = computeThumbSize(800, 400, 240);
  assert.strictEqual(r.w, 240); assert.strictEqual(r.h, 120);
});
test('竖图按高缩放保持比例', () => {
  const r = computeThumbSize(400, 800, 240);
  assert.strictEqual(r.w, 120); assert.strictEqual(r.h, 240);
});

console.log('\n=========================');
console.log('通过: ' + pass + ' / 失败: ' + fail);
console.log('=========================');
process.exit(fail > 0 ? 1 : 0);
