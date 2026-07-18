// 单元测试 - 纯函数逻辑（不依赖 Electron）
// 运行：node --test test/

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../src/logic');

test('STATUS 常量完整', () => {
  assert.equal(logic.STATUS.UNREAD, 'unread');
  assert.equal(logic.STATUS.READING, 'reading');
  assert.equal(logic.STATUS.READ, 'read');
  assert.equal(logic.STATUS.ARCHIVED, 'archived');
});

test('isValidUrl 校验 URL', () => {
  assert.equal(logic.isValidUrl('https://example.com/article'), true);
  assert.equal(logic.isValidUrl('http://example.com'), true);
  assert.equal(logic.isValidUrl('ftp://example.com'), false);
  assert.equal(logic.isValidUrl('not a url'), false);
  assert.equal(logic.isValidUrl(''), false);
  assert.equal(logic.isValidUrl(null), false);
  assert.equal(logic.isValidUrl(123), false);
});

test('normalizeUrl 移除跟踪参数并规范化', () => {
  const result = logic.normalizeUrl('https://Example.com/article?utm_source=x&fbclid=abc&id=1');
  assert.ok(result.startsWith('https://example.com/article'));
  assert.ok(result.includes('id=1'));
  assert.ok(!result.includes('utm_source'));
  assert.ok(!result.includes('fbclid'));
});

test('normalizeUrl 对非法 URL 返回 null', () => {
  assert.equal(logic.normalizeUrl(''), null);
  assert.equal(logic.normalizeUrl('javascript:alert(1)'), null);
});

test('getDomain 提取域名', () => {
  assert.equal(logic.getDomain('https://www.example.com/path'), 'example.com');
  assert.equal(logic.getDomain('https://blog.example.com'), 'blog.example.com');
  assert.equal(logic.getDomain(''), '');
});

test('parseTags 解析标签字符串', () => {
  assert.deepEqual(logic.parseTags('技术,设计,产品'), ['技术', '设计', '产品']);
  assert.deepEqual(logic.parseTags('技术 设计 产品'), ['技术', '设计', '产品']);
  assert.deepEqual(logic.parseTags('技术，设计 产品'), ['技术', '设计', '产品']);
  assert.deepEqual(logic.parseTags('  技术  ,  设计  '), ['技术', '设计']);
  assert.deepEqual(logic.parseTags(''), []);
  assert.deepEqual(logic.parseTags(null), []);
});

test('parseTags 去重（不区分大小写）', () => {
  const result = logic.parseTags('Tech,tech,TECH');
  assert.equal(result.length, 1);
  assert.equal(result[0], 'Tech');
});

test('parseTags 接受数组输入', () => {
  assert.deepEqual(logic.parseTags(['a', 'b', 'a']), ['a', 'b', 'a']);
  // 注：数组路径不做去重，留给外部处理
});

test('createArticle 创建文章对象', () => {
  const article = logic.createArticle({
    url: 'https://example.com/post',
    title: 'Test Article',
    tags: 'tech, news',
    notes: 'A note'
  });
  assert.equal(article.url, 'https://example.com/post');
  assert.equal(article.title, 'Test Article');
  assert.deepEqual(article.tags, ['tech', 'news']);
  assert.equal(article.notes, 'A note');
  assert.equal(article.status, logic.STATUS.UNREAD);
  assert.ok(article.createdAt > 0);
  assert.ok(article.updatedAt > 0);
  assert.equal(article.readAt, null);
});

test('createArticle 标题为空时使用 URL', () => {
  const article = logic.createArticle({ url: 'https://example.com/post' });
  assert.equal(article.title, 'https://example.com/post');
});

test('createArticle URL 不合法时抛出错误', () => {
  assert.throws(() => logic.createArticle({ url: 'not-a-url' }), /URL 不合法/);
  assert.throws(() => logic.createArticle({ url: '' }), /URL 不合法/);
});

test('createArticle 默认状态为未读', () => {
  const article = logic.createArticle({ url: 'https://example.com' });
  assert.equal(article.status, logic.STATUS.UNREAD);
});

test('createArticle 非法状态回退到未读', () => {
  const article = logic.createArticle({ url: 'https://example.com', status: 'invalid' });
  assert.equal(article.status, logic.STATUS.UNREAD);
});

test('filterByStatus 按状态过滤', () => {
  const articles = [
    { id: '1', url: 'https://a.com', status: logic.STATUS.UNREAD, tags: [] },
    { id: '2', url: 'https://b.com', status: logic.STATUS.READ, tags: [] },
    { id: '3', url: 'https://c.com', status: logic.STATUS.UNREAD, tags: [] }
  ];
  assert.equal(logic.filterByStatus(articles, logic.STATUS.UNREAD).length, 2);
  assert.equal(logic.filterByStatus(articles, logic.STATUS.READ).length, 1);
  assert.equal(logic.filterByStatus(articles, 'all').length, 3);
  assert.equal(logic.filterByStatus(articles, null).length, 3);
});

test('filterByTag 按标签过滤', () => {
  const articles = [
    { id: '1', url: 'https://a.com', status: 'unread', tags: ['Tech', 'News'] },
    { id: '2', url: 'https://b.com', status: 'unread', tags: ['News'] },
    { id: '3', url: 'https://c.com', status: 'unread', tags: [] }
  ];
  assert.equal(logic.filterByTag(articles, 'tech').length, 1);
  assert.equal(logic.filterByTag(articles, 'News').length, 2);
  assert.equal(logic.filterByTag(articles, 'all').length, 3);
});

test('searchArticles 搜索标题/URL/笔记/标签', () => {
  const articles = [
    { id: '1', url: 'https://example.com/post1', title: 'JavaScript 入门', notes: '', tags: ['编程'] },
    { id: '2', url: 'https://example.com/post2', title: 'Python 教程', notes: '基础语法', tags: ['编程'] },
    { id: '3', url: 'https://example.com/post3', title: '设计原则', notes: 'Material Design', tags: ['设计'] }
  ];
  assert.equal(logic.searchArticles(articles, 'javascript').length, 1);
  assert.equal(logic.searchArticles(articles, '基础语法').length, 1);
  assert.equal(logic.searchArticles(articles, 'design').length, 1);
  assert.equal(logic.searchArticles(articles, '编程').length, 2);
  assert.equal(logic.searchArticles(articles, '').length, 3);
});

test('sortArticles 按时间降序', () => {
  const articles = [
    { id: '1', url: 'a', title: 'A', createdAt: 100, updatedAt: 100, tags: [] },
    { id: '2', url: 'b', title: 'B', createdAt: 300, updatedAt: 300, tags: [] },
    { id: '3', url: 'c', title: 'C', createdAt: 200, updatedAt: 200, tags: [] }
  ];
  const sorted = logic.sortArticles(articles, 'createdAt', 'desc');
  assert.deepEqual(sorted.map(a => a.id), ['2', '3', '1']);
});

test('sortArticles 按标题升序', () => {
  const articles = [
    { id: '1', url: 'a', title: '香蕉', createdAt: 1, updatedAt: 1, tags: [] },
    { id: '2', url: 'b', title: '苹果', createdAt: 2, updatedAt: 2, tags: [] }
  ];
  const sorted = logic.sortArticles(articles, 'title', 'asc');
  assert.deepEqual(sorted.map(a => a.id), ['2', '1']);
});

test('getStats 统计各状态数量', () => {
  const articles = [
    { url: 'a', status: logic.STATUS.UNREAD, tags: ['x', 'y'] },
    { url: 'b', status: logic.STATUS.UNREAD, tags: ['x'] },
    { url: 'c', status: logic.STATUS.READ, tags: [] },
    { url: 'd', status: logic.STATUS.ARCHIVED, tags: ['z'] }
  ];
  const stats = logic.getStats(articles);
  assert.equal(stats.total, 4);
  assert.equal(stats.unread, 2);
  assert.equal(stats.read, 1);
  assert.equal(stats.archived, 1);
  assert.equal(stats.reading, 0);
  assert.equal(stats.tagCounts.x, 2);
  assert.equal(stats.tagCounts.y, 1);
  assert.equal(stats.tagCounts.z, 1);
});

test('getAllTags 按频率降序', () => {
  const articles = [
    { tags: ['A', 'B'] },
    { tags: ['A', 'C'] },
    { tags: ['A', 'B', 'B'] }
  ];
  const tags = logic.getAllTags(articles);
  assert.deepEqual(tags, [
    { tag: 'a', count: 3 },
    { tag: 'b', count: 2 },
    { tag: 'c', count: 1 }
  ]);
});

test('transitionStatus 合法状态转移', () => {
  assert.equal(logic.transitionStatus(logic.STATUS.UNREAD, logic.STATUS.READING), logic.STATUS.READING);
  assert.equal(logic.transitionStatus(logic.STATUS.READING, logic.STATUS.READ), logic.STATUS.READ);
  // 非法目标保持当前状态
  assert.equal(logic.transitionStatus(logic.STATUS.UNREAD, 'invalid'), logic.STATUS.UNREAD);
});

test('serializeArticles / deserializeArticles 往返', () => {
  const articles = [
    {
      id: 'a1', url: 'https://example.com/1', title: 'Article 1',
      notes: 'note', tags: ['t1'], status: logic.STATUS.UNREAD,
      createdAt: 1000, updatedAt: 1000, readAt: null
    },
    {
      id: 'a2', url: 'https://example.com/2', title: 'Article 2',
      notes: '', tags: [], status: logic.STATUS.READ,
      createdAt: 2000, updatedAt: 3000, readAt: 3000
    }
  ];
  const json = logic.serializeArticles(articles);
  const restored = logic.deserializeArticles(json);
  assert.equal(restored.length, 2);
  assert.equal(restored[0].url, 'https://example.com/1');
  assert.equal(restored[1].status, logic.STATUS.READ);
});

test('deserializeArticles 容错处理', () => {
  assert.deepEqual(logic.deserializeArticles(''), []);
  assert.deepEqual(logic.deserializeArticles(null), []);
  assert.deepEqual(logic.deserializeArticles('not json'), []);
  assert.deepEqual(logic.deserializeArticles('{}'), []);
  assert.deepEqual(logic.deserializeArticles('{"articles": "not array"}'), []);
  // 过滤掉非法 URL
  const bad = logic.deserializeArticles('{"articles":[{"url":"not-a-url","title":"x"}]}');
  assert.deepEqual(bad, []);
});
