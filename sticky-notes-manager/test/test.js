// 便签管家 - 核心逻辑测试
'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const store = require('../src/core/note-store');

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(msg);
    console.error('  FAIL: ' + msg);
  }
}

function assertEqual(actual, expected, msg) {
  assert(actual === expected, msg + ' (expected: ' + expected + ', got: ' + actual + ')');
}

function assertDeepEqual(actual, expected, msg) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), msg + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
}

// 临时数据文件
const tmpDir = path.join(os.tmpdir(), 'sticky-notes-test-' + Date.now());
const tmpFile = path.join(tmpDir, 'notes.json');

function cleanup() {
  try {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  } catch (e) { /* ignore */ }
}

console.log('便签管家 - 核心逻辑测试');
console.log('========================\n');

// === 1. generateId ===
console.log('1. ID 生成');
const id1 = store.generateId();
const id2 = store.generateId();
assert(typeof id1 === 'string' && id1.length > 0, 'ID 应为非空字符串');
assert(id1 !== id2, '两次生成的 ID 应不同');
assert(id1.startsWith('n_'), 'ID 应以 n_ 开头');
console.log('  OK\n');

// === 2. createNote ===
console.log('2. 创建便签');
const note = store.createNote({ title: '测试', content: '内容' });
assert(typeof note.id === 'string', '便签应有 ID');
assertEqual(note.title, '测试', '标题应正确');
assertEqual(note.content, '内容', '内容应正确');
assertEqual(note.color, 'default', '默认颜色应为 default');
assertEqual(note.category, '其他', '默认分类应为 其他');
assertEqual(note.pinned, false, '默认不应置顶');
assert(typeof note.createdAt === 'number', '应有创建时间');
assert(typeof note.updatedAt === 'number', '应有更新时间');

// 空数据
const emptyNote = store.createNote({});
assertEqual(emptyNote.title, '', '空便签标题应为空');
assertEqual(emptyNote.content, '', '空便签内容应为空');

// 无效颜色/分类应回退默认值
const invalidNote = store.createNote({ color: 'invalid', category: '不存在' });
assertEqual(invalidNote.color, 'default', '无效颜色应回退');
assertEqual(invalidNote.category, '其他', '无效分类应回退');

// 自动 trim
const trimNote = store.createNote({ title: '  空格  ', content: '  内容  ' });
assertEqual(trimNote.title, '空格', '标题应 trim');
assertEqual(trimNote.content, '内容', '内容应 trim');

// 保留已有 ID 和创建时间
const existingId = 'n_existing';
const existingTime = 1000;
const preserved = store.createNote({ id: existingId, createdAt: existingTime, title: '保留' });
assertEqual(preserved.id, existingId, '应保留已有 ID');
assertEqual(preserved.createdAt, existingTime, '应保留已有创建时间');
console.log('  OK\n');

// === 3. loadNotes / saveNotes ===
console.log('3. 读写存储');
const emptyLoaded = store.loadNotes(tmpFile);
assertDeepEqual(emptyLoaded, [], '空文件应返回空数组');

const notes1 = [
  store.createNote({ title: '便签1', content: '内容1' }),
  store.createNote({ title: '便签2', content: '内容2', color: 'blue', category: '工作' })
];
store.saveNotes(notes1, tmpFile);
assert(fs.existsSync(tmpFile), '保存后文件应存在');

const loaded = store.loadNotes(tmpFile);
assertEqual(loaded.length, 2, '应加载 2 条便签');
assertEqual(loaded[0].title, '便签1', '第一条标题应正确');
assertEqual(loaded[1].color, 'blue', '第二条颜色应正确');
assertEqual(loaded[1].category, '工作', '第二条分类应正确');

// 损坏文件应返回空数组
fs.writeFileSync(tmpFile, 'invalid json', 'utf-8');
const corruptLoaded = store.loadNotes(tmpFile);
assertDeepEqual(corruptLoaded, [], '损坏文件应返回空数组');
console.log('  OK\n');

// === 4. addNote ===
console.log('4. 新增便签');
let notes2 = [];
const result = store.addNote(notes2, { title: '新增', content: '新内容' });
notes2 = result.notes;
assertEqual(notes2.length, 1, '应有 1 条便签');
assertEqual(result.note.title, '新增', '返回的便签标题应正确');
assert(typeof result.note.id === 'string', '返回的便签应有 ID');

// 新增的便签应在数组头部
const result2 = store.addNote(notes2, { title: '更新一条' });
notes2 = result2.notes;
assertEqual(notes2.length, 2, '应有 2 条便签');
assertEqual(notes2[0].title, '更新一条', '新便签应在头部');
console.log('  OK\n');

// === 5. updateNote ===
console.log('5. 更新便签');
const targetId = notes2[0].id;
const updateResult = store.updateNote(notes2, targetId, { title: '已更新', color: 'green' });
notes2 = updateResult.notes;
assertEqual(updateResult.note.title, '已更新', '标题应已更新');
assertEqual(updateResult.note.color, 'green', '颜色应已更新');
// 保留 ID 和创建时间
assertEqual(updateResult.note.id, targetId, 'ID 不应变');
assertEqual(updateResult.note.createdAt, notes2.find(n => n.id === targetId).createdAt, '创建时间不应变');
// 更新时间应刷新
assert(updateResult.note.updatedAt >= updateResult.note.createdAt, '更新时间应 >= 创建时间');

// 更新不存在的 ID
const noUpdate = store.updateNote(notes2, 'nonexistent', { title: '不存在' });
assertEqual(noUpdate.note, null, '更新不存在 ID 应返回 null');
console.log('  OK\n');

// === 6. deleteNote ===
console.log('6. 删除便签');
const beforeLen = notes2.length;
notes2 = store.deleteNote(notes2, targetId);
assertEqual(notes2.length, beforeLen - 1, '删除后数量应减 1');
assert(!notes2.find(n => n.id === targetId), '被删除的便签不应存在');

// 删除不存在的 ID 不报错
notes2 = store.deleteNote(notes2, 'nonexistent');
assertEqual(notes2.length, beforeLen - 1, '删除不存在的 ID 不影响数量');
console.log('  OK\n');

// === 7. togglePin ===
console.log('7. 切换置顶');
let notes3 = [store.createNote({ title: '测试置顶' })];
const pinId = notes3[0].id;
assertEqual(notes3[0].pinned, false, '初始不应置顶');
const pinResult = store.togglePin(notes3, pinId);
notes3 = pinResult.notes;
assertEqual(pinResult.note.pinned, true, '置顶后应为 true');
const unpinResult = store.togglePin(notes3, pinId);
notes3 = unpinResult.notes;
assertEqual(unpinResult.note.pinned, false, '取消置顶后应为 false');
console.log('  OK\n');

// === 8. searchNotes ===
console.log('8. 搜索便签');
let notes4 = [
  store.createNote({ title: 'Python 教程', content: '学习编程' }),
  store.createNote({ title: '会议记录', content: '讨论 Python 项目' }),
  store.createNote({ title: '购物清单', content: '苹果 牛奶' })
];

// 搜标题
const r1 = store.searchNotes(notes4, '会议');
assertEqual(r1.length, 1, '搜标题「会议」应匹配 1 条');

// 搜内容
const r2 = store.searchNotes(notes4, 'Python');
assertEqual(r2.length, 2, '搜「Python」应匹配 2 条（标题+内容）');

// 大小写不敏感
const r3 = store.searchNotes(notes4, 'python');
assertEqual(r3.length, 2, '搜「python」小写也应匹配 2 条');

// 空关键词返回全部
const r4 = store.searchNotes(notes4, '');
assertEqual(r4.length, 3, '空关键词应返回全部');

// 空格关键词返回全部
const r5 = store.searchNotes(notes4, '   ');
assertEqual(r5.length, 3, '空格关键词应返回全部');

// 无匹配
const r6 = store.searchNotes(notes4, '不存在的关键词');
assertEqual(r6.length, 0, '无匹配应返回空数组');
console.log('  OK\n');

// === 9. filterByCategory ===
console.log('9. 分类筛选');
let notes5 = [
  store.createNote({ title: 'A', category: '工作' }),
  store.createNote({ title: 'B', category: '个人' }),
  store.createNote({ title: 'C', category: '工作' })
];
assertEqual(store.filterByCategory(notes5, '工作').length, 2, '工作分类应有 2 条');
assertEqual(store.filterByCategory(notes5, '个人').length, 1, '个人分类应有 1 条');
assertEqual(store.filterByCategory(notes5, '全部').length, 3, '全部应返回 3 条');
assertEqual(store.filterByCategory(notes5, '').length, 3, '空分类应返回全部');
assertEqual(store.filterByCategory(notes5, '不存在').length, 0, '不存在的分类应返回空');
console.log('  OK\n');

// === 10. sortNotes ===
console.log('10. 排序');
let notes6 = [
  { id: '1', title: '旧', pinned: false, updatedAt: 1000, createdAt: 1000, content: '', color: 'default', category: '其他' },
  { id: '2', title: '新', pinned: false, updatedAt: 3000, createdAt: 3000, content: '', color: 'default', category: '其他' },
  { id: '3', title: '置顶', pinned: true, updatedAt: 2000, createdAt: 2000, content: '', color: 'default', category: '其他' }
];
const sorted = store.sortNotes(notes6);
assertEqual(sorted[0].id, '3', '置顶应在第一位');
assertEqual(sorted[1].id, '2', '非置顶中新的在前面');
assertEqual(sorted[2].id, '1', '非置顶中旧的在后面');

// 不修改原数组
assertEqual(notes6[0].id, '1', '排序不应修改原数组');
console.log('  OK\n');

// === 11. getStats ===
console.log('11. 统计');
let notes7 = [
  store.createNote({ title: '工作1', content: '内容', category: '工作', pinned: true }),
  store.createNote({ title: '工作2', content: 'hello world', category: '工作' }),
  store.createNote({ title: '个人', content: '中文内容测试', category: '个人' })
];
const stats = store.getStats(notes7);
assertEqual(stats.total, 3, '总数应为 3');
assertEqual(stats.pinned, 1, '置顶数应为 1');
assertEqual(stats.byCategory['工作'], 2, '工作分类应为 2');
assertEqual(stats.byCategory['个人'], 1, '个人分类应为 1');
assertEqual(stats.byCategory['灵感'], 0, '灵感分类应为 0');
assert(stats.totalWords > 0, '总字数应 > 0');
assert(stats.totalChars > 0, '总字符数应 > 0');

// 空数组统计
const emptyStats = store.getStats([]);
assertEqual(emptyStats.total, 0, '空数组总数应为 0');
assertEqual(emptyStats.pinned, 0, '空数组置顶应为 0');
console.log('  OK\n');

// === 12. exportNotes / importNotes ===
console.log('12. 导入导出');
let notes8 = [
  store.createNote({ title: '导出测试', content: '内容' })
];
const exported = store.exportNotes(notes8);
const parsed = JSON.parse(exported);
assertEqual(parsed.version, 1, '导出版本应为 1');
assert(Array.isArray(parsed.notes), '导出的 notes 应为数组');
assertEqual(parsed.notes.length, 1, '导出应有 1 条便签');
assert(parsed.exportedAt, '应有导出时间');

// 导入
let existing = [store.createNote({ title: '已有' })];
const imported = store.importNotes(exported, existing);
assertEqual(imported.length, 2, '导入后应有 2 条便签（已有 + 导入）');
// 导入的便签应有新 ID
const importedNote = imported.find(n => n.title === '导出测试');
assert(importedNote, '应能找到导入的便签');
assert(importedNote.id !== notes8[0].id, '导入便签应有新 ID');

// 无效导入
try {
  store.importNotes('{"notes": "not array"}', []);
  assert(false, '无效数据应抛出异常');
} catch (e) {
  assert(true, '无效数据应抛出异常');
}
console.log('  OK\n');

// === 13. COLORS / CATEGORIES 常量 ===
console.log('13. 常量定义');
assert(store.COLORS.default, '应有 default 颜色');
assert(store.COLORS.blue, '应有 blue 颜色');
assert(store.COLORS.default.hex, '颜色应有 hex 值');
assert(store.COLORS.default.dot, '颜色应有 dot 值');
assert(Array.isArray(store.CATEGORIES), 'CATEGORIES 应为数组');
assert(store.CATEGORIES.includes('工作'), 'CATEGORIES 应包含 工作');
assert(store.CATEGORIES.includes('待办'), 'CATEGORIES 应包含 待办');
assertEqual(store.CATEGORIES.length, 5, '应有 5 个分类');
console.log('  OK\n');

// === 14. defaultDataPath ===
console.log('14. 默认路径');
const dp = store.defaultDataPath();
assert(typeof dp === 'string' && dp.length > 0, '默认路径应为非空字符串');
assert(dp.includes('sticky-notes-manager'), '路径应包含项目名');
assert(dp.endsWith('notes.json'), '路径应以 notes.json 结尾');
console.log('  OK\n');

// === 总结 ===
console.log('========================');
console.log('通过: ' + passed + ' | 失败: ' + failed);
console.log('总计: ' + (passed + failed) + ' 个测试用例');

cleanup();

if (failed > 0) {
  console.error('\n失败用例:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
} else {
  console.log('\n全部通过！');
  process.exit(0);
}
