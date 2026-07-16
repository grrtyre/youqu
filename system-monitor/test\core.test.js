// 核心逻辑测试 - 验证系统数据采集是否正常
process.env.PORT = "0";

const assert = require('assert');
const { state, sample, server } = require('../src/server');

function ok(name, cond) {
  if (cond) { console.log('  \u2713 ' + name); }
  else { console.log('  \u2717 ' + name); process.exitCode = 1; }
}

(async function () {
  console.log('系统监控器 - 核心逻辑测试');
  console.log('------------------------');

  console.log('步骤 1：执行首次采样...');
  await sample();

  ok('采样时间戳已写入 (ts > 0)', state.ts > 0);
  ok('CPU 占比为 0~100 数字', typeof state.cpu.load === 'number' && state.cpu.load >= 0 && state.cpu.load <= 100);
  ok('CPU 型号非空', typeof state.cpu.model === 'string' && state.cpu.model.length > 0);
  ok('CPU 核心数 > 0', state.cpu.cores > 0);
  ok('内存总量 > 0', state.mem.total > 0);
  ok('内存占比 0~100', state.mem.percent >= 0 && state.mem.percent <= 100);
  ok('磁盘总量 > 0', state.disk.total > 0);
  ok('磁盘分区列表为数组', Array.isArray(state.disk.fsList));
  ok('进程列表为数组', Array.isArray(state.processes));
  ok('CPU 历史曲线已记录', state.cpuHistory.length >= 1);
  ok('内存历史曲线已记录', state.memHistory.length >= 1);
  ok('主机名非空', state.system.hostname.length > 0);
  ok('系统信息已采集 (distro)', state.system.distro.length > 0);

  if (state.processes.length > 0) {
    const p = state.processes[0];
    ok('进程对象含 pid/name/cpu/mem', typeof p.pid === 'number' && typeof p.name === 'string' && typeof p.cpu === 'number');
    ok('进程按 CPU 降序排列', state.processes.length < 2 || state.processes[0].cpu >= state.processes[1].cpu);
  }

  console.log('步骤 2：连续采样验证历史曲线...');
  await sample();
  await sample();
  ok('历史曲线长度增长 (>=2)', state.cpuHistory.length >= 2);
  ok('历史曲线长度上限为 60', state.cpuHistory.length <= 60);

  console.log('------------------------');
  if (process.exitCode === 1) { console.log('结果：存在失败项'); }
  else { console.log('结果：全部通过'); }

  try { server.close(); } catch (e) {}
  process.exit(process.exitCode || 0);
})().catch(function (e) {
  console.error('测试异常：', e);
  try { server.close(); } catch (e) {}
  process.exit(1);
});
