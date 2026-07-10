// 时间管家 - 核心逻辑测试
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

const { TimeStore } = require('../src/core/time-store');
const utils = require('../src/core/time-utils');
const stats = require('../src/core/stats-utils');

let pass = 0;
let fail = 0;
const errors = [];

function assert(cond, msg) {
  if (cond) {
    pass++;
  } else {
    fail++;
    errors.push(msg);
    console.log('  FAIL: ' + msg);
  }
}

function tmpFile() {
  return path.join(os.tmpdir(), 'tt-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
}

console.log('=== 时间管家 核心逻辑测试 ===\n');

// --- time-utils ---
console.log('[1] time-utils 测试');
assert(utils.formatDuration(0) === '0分', 'formatDuration(0) 应为 0分');
assert(utils.formatDuration(65000) === '1分5秒', 'formatDuration(65000) 应为 1分5秒，得到: ' + utils.formatDuration(65000));
assert(utils.formatDuration(3723000) === '1小时2分', 'formatDuration(3723000) 应为 1小时2分，得到: ' + utils.formatDuration(3723000));
assert(utils.formatTimer(0) === '00:00:00', 'formatTimer(0) 应为 00:00:00');
assert(utils.formatTimer(3661000) === '01:01:01', 'formatTimer(3661000) 应为 01:01:01，得到: ' + utils.formatTimer(3661000));
const dk = utils.dateKey(new Date(2026, 6, 10).getTime());
assert(dk === '2026-07-10', 'dateKey 应为 2026-07-10，得到: ' + dk);
assert(utils.genId().length > 5, 'genId 应有合理长度');

// --- TimeStore ---
console.log('\n[2] TimeStore 测试');
const f = tmpFile();
const store = new TimeStore(f);
store.ensureDefault();
const projs = store.listProjects();
assert(projs.length === 3, 'ensureDefault 应创建3个项目，得到: ' + projs.length);
assert(projs[0].name === '工作', '第一个默认项目应为 工作');

// 创建项目
const p = store.createProject({ name: '测试项目', color: '#ff0000' });
assert(p.id && p.name === '测试项目', 'createProject 应返回正确项目');
assert(store.listProjects().length === 4, '创建后应有4个项目');

// 计时
const active = store.startTimer(p.id);
assert(active && active.projectId === p.id, 'startTimer 应返回 active 状态');
assert(store.getActive() !== null, 'getActive 应非空');

// 停止计时
const rec = store.stopTimer();
assert(rec !== null, 'stopTimer 应返回记录');
assert(rec.projectId === p.id, '记录 projectId 应正确');
assert(rec.duration >= 0, '记录 duration 应 >= 0');
assert(store.getActive() === null, '停止后 getActive 应为 null');
assert(store.listRecords().length === 1, '应有1条记录');

// 手动添加记录
const rec2 = store.addRecord({ projectId: p.id, start: Date.now() - 7200000, end: Date.now() - 3600000, note: '手动' });
assert(rec2 && rec2.duration === 3600000, 'addRecord duration 应为 3600000，得到: ' + rec2.duration);
assert(store.listRecords().length === 2, '应有2条记录');

// 删除记录
store.removeRecord(rec2.id);
assert(store.listRecords().length === 1, '删除后应有1条记录');

// 更新项目
store.updateProject(p.id, { name: '改名后' });
assert(store.listProjects().find((x) => x.id === p.id).name === '改名后', 'updateProject 应更新名称');

// 删除项目级联
store.removeProject(p.id);
assert(store.listProjects().find((x) => x.id === p.id) === undefined, 'removeProject 应删除项目');
assert(store.listRecords().filter((r) => r.projectId === p.id).length === 0, '删除项目应级联删除记录');

// 导出
const csv = store.exportCSV();
assert(csv.includes('日期') && csv.includes('项目'), 'exportCSV 应含表头');
const json = store.exportJSON();
assert(JSON.parse(json).projects !== undefined, 'exportJSON 应可解析');

// 导入
const store2 = new TimeStore(tmpFile());
store2.importJSON(json);
assert(store2.listProjects().length === store.listProjects().length, 'importJSON 应恢复项目数');

// --- stats-utils ---
console.log('\n[3] stats-utils 测试');
const now = new Date(2026, 6, 10, 14, 0, 0).getTime(); // 2026-07-10 14:00
const sStore = new TimeStore(tmpFile());
const sp1 = sStore.createProject({ name: 'P1', color: '#007aff' });
const sp2 = sStore.createProject({ name: 'P2', color: '#34c759' });
// 今日记录
sStore.addRecord({ projectId: sp1.id, start: now - 3600000, end: now });
sStore.addRecord({ projectId: sp2.id, start: now - 7200000, end: now - 3600000 });
const records = sStore.listRecords();

const today = stats.todayTotal(records, now);
assert(today === 7200000, 'todayTotal 应为 7200000，得到: ' + today);
const week = stats.weekTotal(records, now);
assert(week === 7200000, 'weekTotal 应为 7200000，得到: ' + week);

const dist = stats.projectDistribution(records, sStore.listProjects(), utils.startOfDay(now), utils.startOfDay(now) + 86400000);
assert(dist.length === 2, 'projectDistribution 应返回2个项目，得到: ' + dist.length);
assert(dist[0].percent + dist[1].percent === 100, '百分比之和应为100，得到: ' + (dist[0].percent + dist[1].percent));

const trend = stats.dailyTrend(records, 7, now);
assert(trend.length === 7, 'dailyTrend 应返回7天，得到: ' + trend.length);
assert(trend[6].duration === 7200000, '今天趋势应为 7200000，得到: ' + trend[6].duration);

// 清理
try { fs.unlinkSync(f); } catch (e) {}

// --- 结果 ---
console.log('\n=== 测试结果 ===');
console.log(`通过: ${pass}, 失败: ${fail}`);
if (fail > 0) {
  console.log('失败项:');
  errors.forEach((e) => console.log('  - ' + e));
  process.exit(1);
} else {
  console.log('全部通过 ✓');
}
