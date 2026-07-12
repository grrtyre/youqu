// 番茄管家 - 核心逻辑测试
'use strict';

const { PomodoroCore } = require('../src/core/pomodoro-core');

let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.error('  ✗ ' + msg); }
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, `${msg} (期望 ${expected}, 实际 ${actual})`);
}

console.log('番茄管家核心逻辑测试\n');

// 测试 1：初始化默认配置
console.log('[测试] 初始化默认配置');
{
  const core = new PomodoroCore();
  assertEq(core.config.workDuration, 25, '默认工作时长 25 分钟');
  assertEq(core.config.shortBreak, 5, '默认短休息 5 分钟');
  assertEq(core.config.longBreak, 15, '默认长休息 15 分钟');
  assertEq(core.config.longBreakInterval, 4, '默认长休息间隔 4');
  assertEq(core.config.dailyGoal, 8, '默认每日目标 8');
  assertEq(core.state, 'idle', '初始状态 idle');
  assertEq(core.remainingMs, 25 * 60 * 1000, '初始剩余时间 = 工作时长');
}

// 测试 2：启动计时
console.log('[测试] 启动计时');
{
  const core = new PomodoroCore();
  assert(core.start(), 'start() 返回 true');
  assertEq(core.state, 'working', '启动后状态为 working');
  assert(core.start() === false || core.start() === true, '重复 start 不报错');
}

// 测试 3：计时推进与阶段切换（工作 -> 短休息）
console.log('[测试] 计时推进与阶段切换');
{
  const core = new PomodoroCore({ workDuration: 1, shortBreak: 1, longBreak: 2, longBreakInterval: 4 });
  core.start();
  // 推进 60 秒（1 分钟工作完成）
  const ev = core.tick(60);
  assert(ev !== null, '工作完成产生事件');
  assert(ev.completedWork === true, '事件标记 completedWork');
  assertEq(core.state, 'short_break', '工作完成后进入短休息');
  assertEq(core.cycleCount, 1, '周期计数 +1');
  assertEq(core.todayStats().workSessions, 1, '今日番茄数 +1');
  assertEq(core.todayStats().totalMinutes, 1, '今日专注分钟数 +1');
}

// 测试 4：长休息触发（每 4 个番茄）
console.log('[测试] 长休息触发');
{
  const core = new PomodoroCore({ workDuration: 1, shortBreak: 1, longBreak: 2, longBreakInterval: 4 });
  core.start();
  // 完成 4 个工作番茄
  for (let i = 0; i < 4; i++) {
    core.tick(60); // 工作完成 -> 休息
    core.tick(60); // 休息完成 -> 工作
    if (core.state === 'idle') core.start();
  }
  // 第 4 次工作完成后应进入长休息
  // 注意上面循环逻辑，需重新精确模拟
}

// 测试 4 重做：精确模拟长休息
console.log('[测试] 长休息精确触发');
{
  const core = new PomodoroCore({ workDuration: 1, shortBreak: 1, longBreak: 2, longBreakInterval: 4 });
  core.start();
  // 第 1 个番茄
  let ev = core.tick(60);
  assertEq(ev.completedWork, true, '第1个番茄完成');
  assertEq(core.state, 'short_break', '第1次进入短休息');
  // 休息结束
  core.tick(60);
  assertEq(core.state, 'working', '短休息后回到工作');
  // 第 2 个
  core.tick(60);
  assertEq(core.state, 'short_break', '第2次短休息');
  core.tick(60);
  // 第 3 个
  core.tick(60);
  assertEq(core.state, 'short_break', '第3次短休息');
  core.tick(60);
  // 第 4 个 -> 长休息
  ev = core.tick(60);
  assertEq(ev.completedWork, true, '第4个番茄完成');
  assertEq(core.state, 'long_break', '第4次进入长休息');
  assertEq(core.cycleCount, 4, '周期计数=4');
}

// 测试 5：暂停与恢复
console.log('[测试] 暂停与恢复');
{
  const core = new PomodoroCore({ workDuration: 10 });
  core.start();
  core.tick(30); // 推进 30 秒
  const beforePause = core.remainingMs;
  assert(core.pause(), 'pause() 成功');
  assertEq(core.state, 'paused', '暂停后状态 paused');
  core.tick(30); // 暂停时 tick 不推进
  assertEq(core.remainingMs, beforePause, '暂停期间时间不变');
  assert(core.resume(), 'resume() 成功');
  assertEq(core.state, 'working', '恢复后回到 working');
}

// 测试 6：重置
console.log('[测试] 重置');
{
  const core = new PomodoroCore({ workDuration: 10 });
  core.start();
  core.tick(30);
  core.reset();
  assertEq(core.state, 'idle', '重置后状态 idle');
  assertEq(core.remainingMs, 10 * 60 * 1000, '重置后剩余时间恢复');
}

// 测试 7：跳过
console.log('[测试] 跳过');
{
  const core = new PomodoroCore({ workDuration: 10, shortBreak: 5, strictMode: false });
  core.start();
  const ev = core.skip();
  assert(ev !== null, '非严格模式可跳过工作');
  // 跳过后进入休息
  assert(core.state === 'short_break' || core.state === 'long_break', '跳过工作后进入休息');
  // 跳过休息
  const ev2 = core.skip();
  assert(ev2 !== null, '非严格模式可跳过休息');
}

// 测试 8：严格模式不可跳过休息
console.log('[测试] 严格模式');
{
  const core = new PomodoroCore({ workDuration: 1, shortBreak: 1, strictMode: true });
  core.start();
  core.tick(60); // 工作完成 -> 短休息
  assertEq(core.state, 'short_break', '严格模式：工作后进入短休息');
  const ev = core.skip();
  assert(ev === null, '严格模式跳过休息返回 null');
  assertEq(core.state, 'short_break', '严格模式仍处于短休息');
}

// 测试 9：任务管理
console.log('[测试] 任务管理');
{
  const core = new PomodoroCore();
  const t1 = core.addTask('写文档', 2);
  const t2 = core.addTask('写代码', 3);
  assertEq(core.tasks.length, 2, '添加 2 个任务');
  assertEq(t1.title, '写文档', '任务标题正确');
  assertEq(t1.estimate, 2, '任务预估番茄数');
  core.setCurrentTask(t1.id);
  assertEq(core.currentTaskId, t1.id, '设置当前任务');
  // 完成一个番茄，当前任务进度 +1
  core.config.workDuration = 1;
  core.start();
  core.tick(60);
  const updated = core.tasks.find(t => t.id === t1.id);
  assertEq(updated.pomodoros, 1, '当前任务番茄进度 +1');
  // 完成任务
  assert(core.completeTask(t1.id), '完成任务成功');
  assertEq(updated.completed, true, '任务标记为已完成');
  assert(core.currentTaskId === null, '完成任务后当前任务清空');
  // 重复完成返回 false
  assert(core.completeTask(t1.id) === false, '重复完成返回 false');
  // 删除任务
  assert(core.deleteTask(t2.id), '删除任务成功');
  assertEq(core.tasks.length, 1, '删除后剩 1 个任务');
}

// 测试 10：统计
console.log('[测试] 统计');
{
  const core = new PomodoroCore({ workDuration: 25, dailyGoal: 3 });
  core.start();
  core.tick(25 * 60); // 完成 1 个番茄
  const today = core.todayStats();
  assertEq(today.workSessions, 1, '今日 1 个番茄');
  assertEq(today.totalMinutes, 25, '今日 25 分钟');
  const week = core.weekStats();
  assertEq(week.workSessions, 1, '本周 1 个番茄');
  const total = core.totalStats();
  assertEq(total.workSessions, 1, '累计 1 个番茄');
}

// 测试 11：连续打卡
console.log('[测试] 连续打卡');
{
  const core = new PomodoroCore({ workDuration: 1, shortBreak: 1, dailyGoal: 2 });
  core.start();
  core.tick(60); // 第1个番茄完成 -> 短休息
  core.tick(60); // 短休息结束 -> 工作
  core.tick(60); // 第2个番茄完成 -> 短休息
  assert(core.streak >= 1, `达标后连续天数 >= 1 (实际 ${core.streak})`);
  assertEq(core.lastGoalMetDate, core._todayKey(), '记录达标日期');
}

// 测试 12：序列化与反序列化
console.log('[测试] 序列化与反序列化');
{
  const core = new PomodoroCore({ workDuration: 30, dailyGoal: 5 });
  core.addTask('测试任务', 1);
  core.start();
  core.tick(60);
  const data = core.serialize();
  const restored = PomodoroCore.deserialize(data);
  assertEq(restored.config.workDuration, 30, '配置恢复');
  assertEq(restored.state, 'working', '状态恢复');
  assertEq(restored.tasks.length, 1, '任务恢复');
  assertEq(restored.todayStats().workSessions, core.todayStats().workSessions, '统计恢复');
}

// 测试 13：周柱状图数据
console.log('[测试] 周柱状图数据');
{
  const core = new PomodoroCore({ workDuration: 1 });
  core.start();
  core.tick(60);
  const daily = core.weekDaily();
  assertEq(daily.length, 7, '返回 7 天数据');
  assert(daily[6].workSessions === 1, '今天（最后一天）有 1 个番茄');
}

// 测试 14：格式化时间
console.log('[测试] 格式化时间');
{
  assertEq(PomodoroCore.formatTime(25 * 60 * 1000), '25:00', '25 分钟格式化');
  assertEq(PomodoroCore.formatTime(5 * 60 * 1000), '05:00', '5 分钟格式化');
  assertEq(PomodoroCore.formatTime(90 * 1000), '01:30', '1分30秒格式化');
  assertEq(PomodoroCore.formatTime(0), '00:00', '0 格式化');
  assertEq(PomodoroCore.formatMinutes(25), '25 分钟', 'formatMinutes 25');
  assertEq(PomodoroCore.formatMinutes(60), '1 小时', 'formatMinutes 60');
  assertEq(PomodoroCore.formatMinutes(90), '1 小时 30 分', 'formatMinutes 90');
}

// 测试 15：进度计算
console.log('[测试] 进度计算');
{
  const core = new PomodoroCore({ workDuration: 10 });
  core.start();
  assertEq(core.progress(), 0, '开始时进度 0');
  core.tick(300); // 推进 5 分钟（一半）
  const p = core.progress();
  assert(p > 0.49 && p < 0.51, `半程进度约 0.5 (实际 ${p.toFixed(3)})`);
}

console.log(`\n结果：${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
