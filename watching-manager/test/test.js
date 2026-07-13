// test/test.js — 剧集管家核心逻辑测试
const assert = require('assert');
const core = require('../src/core/store');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log('剧集管家 · 核心逻辑测试\n');

// ===== validate / createShow =====
test('createShow: 正常创建', () => {
  const s = core.createShow({ title: '漫长的季节', type: 'tv', status: 'watching', season: 1, episode: 5 });
  assert.ok(s.id, '应有 id');
  assert.strictEqual(s.title, '漫长的季节');
  assert.strictEqual(s.type, 'tv');
  assert.strictEqual(s.status, 'watching');
  assert.strictEqual(s.season, 1);
  assert.strictEqual(s.episode, 5);
  assert.ok(s.addedAt);
  assert.strictEqual(s.lastWatchedAt, null);
});

test('createShow: 空标题应抛错', () => {
  assert.throws(() => core.createShow({ title: '' }), /剧名不能为空/);
});

test('createShow: 非法 type 回退为 tv', () => {
  const s = core.createShow({ title: 'X', type: 'unknown' });
  assert.strictEqual(s.type, 'tv');
});

test('createShow: 非法 status 回退为 planning', () => {
  const s = core.createShow({ title: 'X', status: 'invalid' });
  assert.strictEqual(s.status, 'planning');
});

test('createShow: rating 越界被截断', () => {
  const s = core.createShow({ title: 'X', rating: 99 });
  assert.strictEqual(s.rating, 10);
  const s2 = core.createShow({ title: 'Y', rating: -3 });
  assert.strictEqual(s2.rating, 0);
});

test('createShow: episode 负数归零', () => {
  const s = core.createShow({ title: 'X', episode: -5 });
  assert.strictEqual(s.episode, 0);
});

test('createShow: 标签去重去空', () => {
  const s = core.createShow({ title: 'X', tags: ['a', '  ', 'b', 'a'] });
  assert.deepStrictEqual(s.tags, ['a', 'b', 'a']);
});

test('createShow: note 长度截断', () => {
  const long = 'x'.repeat(3000);
  const s = core.createShow({ title: 'X', note: long });
  assert.strictEqual(s.note.length, 2000);
});

// ===== updateShow =====
test('updateShow: 修改字段', () => {
  const s = core.createShow({ title: 'A', episode: 1 });
  const u = core.updateShow(s, { episode: 2 });
  assert.strictEqual(u.episode, 2);
  assert.strictEqual(u.title, 'A');
  assert.ok(u.updatedAt >= s.updatedAt);
});

test('updateShow: 进度变更触发 lastWatchedAt', () => {
  const s = core.createShow({ title: 'A', episode: 1 });
  assert.strictEqual(s.lastWatchedAt, null);
  const u = core.updateShow(s, { episode: 2 });
  assert.ok(u.lastWatchedAt, '应记录上次观看时间');
});

test('updateShow: 标题变更不触发 lastWatchedAt', () => {
  const s = core.createShow({ title: 'A', episode: 1 });
  const u = core.updateShow(s, { title: 'B' });
  assert.strictEqual(u.lastWatchedAt, null);
});

test('updateShow: 状态变为 completed 设置 finishedAt', () => {
  const s = core.createShow({ title: 'A', status: 'watching' });
  const u = core.updateShow(s, { status: 'completed' });
  assert.ok(u.finishedAt, '应设置完成时间');
});

test('updateShow: 从 completed 改回 watching 清除 finishedAt', () => {
  const s = core.createShow({ title: 'A', status: 'completed' });
  const u = core.updateShow(s, { status: 'watching' });
  assert.strictEqual(u.finishedAt, null);
});

// ===== advanceEpisode =====
test('advanceEpisode: 默认 +1', () => {
  const s = core.createShow({ title: 'A', season: 1, episode: 5, totalEpisodes: 12 });
  const u = core.advanceEpisode(s);
  assert.strictEqual(u.episode, 6);
  assert.strictEqual(u.season, 1);
});

test('advanceEpisode: 总集数已满时锁定到总集数并标记完成', () => {
  const s = core.createShow({ title: 'A', season: 2, episode: 11, totalSeasons: 2, totalEpisodes: 12 });
  const u = core.advanceEpisode(s, 5);
  assert.strictEqual(u.episode, 12);
  assert.strictEqual(u.status, 'completed');
});

test('advanceEpisode: 跨季自动 +1', () => {
  const s = core.createShow({ title: 'A', season: 1, episode: 12, totalSeasons: 3, totalEpisodes: 12 });
  const u = core.advanceEpisode(s);
  assert.strictEqual(u.season, 2);
  assert.strictEqual(u.episode, 1);
});

test('advanceEpisode: 从 planning 升到 watching', () => {
  const s = core.createShow({ title: 'A', status: 'planning', episode: 0 });
  const u = core.advanceEpisode(s);
  assert.strictEqual(u.status, 'watching');
  assert.strictEqual(u.episode, 1);
});

// ===== resetProgress =====
test('resetProgress: 进度归零', () => {
  const s = core.createShow({ title: 'A', status: 'watching', season: 3, episode: 8 });
  const u = core.resetProgress(s);
  assert.strictEqual(u.season, 1);
  assert.strictEqual(u.episode, 0);
  assert.strictEqual(u.status, 'planning');
  assert.strictEqual(u.lastWatchedAt, null);
});

// ===== stats =====
test('stats: 统计正确', () => {
  const shows = [
    core.createShow({ title: 'A', status: 'watching', type: 'tv', episode: 5, rating: 8, tags: ['悬疑'] }),
    core.createShow({ title: 'B', status: 'completed', type: 'anime', episode: 24, rating: 9, tags: ['治愈', '悬疑'] }),
    core.createShow({ title: 'C', status: 'planning', type: 'tv', episode: 0, rating: 0 })
  ];
  const s = core.stats(shows);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.byStatus.watching, 1);
  assert.strictEqual(s.byStatus.completed, 1);
  assert.strictEqual(s.byType.tv, 2);
  assert.strictEqual(s.byType.anime, 1);
  assert.strictEqual(s.totalEpisodesWatched, 29);
  assert.strictEqual(s.avgRating, 8.5);
  assert.strictEqual(s.ratedCount, 2);
  // topTags 排序：悬疑=2 > 治愈=1
  assert.strictEqual(s.topTags[0].tag, '悬疑');
  assert.strictEqual(s.topTags[0].count, 2);
});

test('stats: 空数组安全', () => {
  const s = core.stats([]);
  assert.strictEqual(s.total, 0);
  assert.strictEqual(s.avgRating, 0);
  assert.deepStrictEqual(s.topTags, []);
});

// ===== filterShows / sortShows =====
test('filterShows: 关键词匹配标题', () => {
  const shows = [
    core.createShow({ title: '漫长的季节' }),
    core.createShow({ title: '隐秘的角落' })
  ];
  const r = core.filterShows(shows, { keyword: '季节' });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].title, '漫长的季节');
});

test('filterShows: 多条件过滤', () => {
  const shows = [
    core.createShow({ title: 'A', status: 'watching', type: 'tv', tags: ['悬疑'] }),
    core.createShow({ title: 'B', status: 'completed', type: 'tv', tags: ['悬疑'] }),
    core.createShow({ title: 'C', status: 'watching', type: 'anime', tags: ['治愈'] })
  ];
  const r = core.filterShows(shows, { status: 'watching', type: 'tv', tag: '悬疑' });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].title, 'A');
});

test('sortShows: 按评分降序', () => {
  const shows = [
    core.createShow({ title: 'A', rating: 7 }),
    core.createShow({ title: 'B', rating: 9 }),
    core.createShow({ title: 'C', rating: 8 })
  ];
  const r = core.sortShows(shows, 'rating', false);
  assert.strictEqual(r[0].title, 'B');
  assert.strictEqual(r[1].title, 'C');
  assert.strictEqual(r[2].title, 'A');
});

test('sortShows: 按标题升序', () => {
  const shows = [
    core.createShow({ title: '橙' }),
    core.createShow({ title: '苹果' }),
    core.createShow({ title: '香蕉' })
  ];
  const r = core.sortShows(shows, 'title', true);
  assert.strictEqual(r[0].title, '橙');
  assert.strictEqual(r[1].title, '苹果');
  assert.strictEqual(r[2].title, '香蕉');
});

// ===== exportData / importData =====
test('exportData: 输出结构正确', () => {
  const shows = [core.createShow({ title: 'A' })];
  const d = core.exportData(shows);
  assert.strictEqual(d.version, 1);
  assert.ok(d.exportedAt);
  assert.strictEqual(d.shows.length, 1);
});

test('importData: 同 id 覆盖', () => {
  const a = core.createShow({ title: '旧' });
  const current = [a];
  const data = { shows: [{ ...a, title: '新' }] };
  const merged = core.importData(current, data);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].title, '新');
});

test('importData: 不同 id 追加', () => {
  const a = core.createShow({ title: 'A' });
  const b = core.createShow({ title: 'B' });
  const data = { shows: [b] };
  const merged = core.importData([a], data);
  assert.strictEqual(merged.length, 2);
});

test('importData: 非法项跳过', () => {
  const a = core.createShow({ title: 'A' });
  const data = { shows: [{ title: '' }, core.createShow({ title: 'B' })] };
  const merged = core.importData([a], data);
  assert.strictEqual(merged.length, 2);
});

test('importData: 格式错误抛异常', () => {
  assert.throws(() => core.importData([], { foo: 'bar' }), /格式错误/);
});

// ===== 模拟一个典型追剧流程 =====
test('端到端: 看完整季流程', () => {
  let s = core.createShow({ title: '三体', status: 'planning', season: 1, episode: 0, totalSeasons: 1, totalEpisodes: 30 });
  assert.strictEqual(s.status, 'planning');
  s = core.advanceEpisode(s); // 1 集
  assert.strictEqual(s.status, 'watching');
  // 连看 29 集
  for (let i = 0; i < 29; i++) s = core.advanceEpisode(s);
  assert.strictEqual(s.episode, 30);
  assert.strictEqual(s.status, 'completed');
  assert.ok(s.finishedAt);
});

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
