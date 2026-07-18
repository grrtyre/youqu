// 本地音乐播放器 - 基础逻辑测试
// 用 Node 运行：node test/test.js
// 测试纯函数逻辑（不依赖 DOM/Electron）

const assert = require('assert');

// 复制 renderer 中的纯函数用于测试
function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function basename(p) {
  const name = p.split(/[\\/]/).pop();
  return name.replace(/\.[^.]+$/, '');
}

function parseMetadata(filePath) {
  const name = basename(filePath);
  const parts = name.split(/\s*-\s*/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { title: name, artist: '未知艺术家' };
}

function gradientFor(title) {
  const palettes = [
    ['#FF6B6B', '#FFA1A1'],
    ['#4ECDC4', '#7FE3DC'],
    ['#FFD93D', '#FFE680'],
    ['#A29BFE', '#C8C2FF'],
    ['#FD79A8', '#FDC2D8'],
    ['#00B894', '#5FD9B5'],
    ['#0984E3', '#5AB0F0'],
    ['#6C5CE7', '#9B8FF0']
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash << 5) - hash + title.charCodeAt(i);
  return palettes[Math.abs(hash) % palettes.length];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log('\n音乐播放器 - 单元测试\n');

console.log('formatTime:');
test('0 秒 -> 0:00', () => assert.strictEqual(formatTime(0), '0:00'));
test('NaN -> 0:00', () => assert.strictEqual(formatTime(NaN), '0:00'));
test('65 秒 -> 1:05', () => assert.strictEqual(formatTime(65), '1:05'));
test('3600 秒 -> 60:00', () => assert.strictEqual(formatTime(3600), '60:00'));
test('125 秒 -> 2:05', () => assert.strictEqual(formatTime(125), '2:05'));

console.log('\nbasename:');
test('Windows 路径', () => assert.strictEqual(basename('C:\\music\\song.mp3'), 'song'));
test('Unix 路径', () => assert.strictEqual(basename('/music/song.flac'), 'song'));
test('无扩展名', () => assert.strictEqual(basename('song'), 'song'));

console.log('\nparseMetadata:');
test('"Artist - Title.mp3" 解析', () => {
  const r = parseMetadata('D:\\music\\周杰伦 - 晴天.mp3');
  assert.strictEqual(r.artist, '周杰伦');
  assert.strictEqual(r.title, '晴天');
});
test('无分隔符用文件名', () => {
  const r = parseMetadata('D:\\music\\song.mp3');
  assert.strictEqual(r.title, 'song');
  assert.strictEqual(r.artist, '未知艺术家');
});
test('多分隔符合并标题', () => {
  const r = parseMetadata('A - B - C.mp3');
  assert.strictEqual(r.artist, 'A');
  assert.strictEqual(r.title, 'B - C');
});

console.log('\ngradientFor:');
test('返回有效调色板', () => {
  const g = gradientFor('test');
  assert(Array.isArray(g), '应为数组');
  assert.strictEqual(g.length, 2);
  assert(g[0].startsWith('#'));
});
test('相同输入返回相同结果', () => {
  const g1 = gradientFor('hello');
  const g2 = gradientFor('hello');
  assert.deepStrictEqual(g1, g2);
});
test('不同输入可返回不同结果', () => {
  const all = new Set();
  for (const t of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
    all.add(gradientFor(t).join(','));
  }
  assert(all.size > 1, '应产生至少 2 种不同渐变');
});

console.log('\nescapeHtml:');
test('转义特殊字符', () => {
  assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;');
  assert.strictEqual(escapeHtml('"'), '&quot;');
  assert.strictEqual(escapeHtml('&'), '&amp;');
});
test('普通文本不变', () => {
  assert.strictEqual(escapeHtml('hello world'), 'hello world');
});

console.log(`\n结果：${passed} 通过，${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
