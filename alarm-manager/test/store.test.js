// 闹钟管家 - 存储模块单元测试
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const store = require('../src/store.js');

let tmpFile = null;

function makeTmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alarm-test-'));
  return path.join(dir, 'alarms.json');
}

beforeEach(() => {
  tmpFile = makeTmpFile();
});

afterEach(() => {
  try {
    const dir = path.dirname(tmpFile);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {}
});

describe('defaultData', () => {
  test('返回完整默认结构', () => {
    const d = store.defaultData();
    assert.strictEqual(d.version, 1);
    assert.deepStrictEqual(d.alarms, []);
    assert.strictEqual(typeof d.settings, 'object');
    assert.strictEqual(d.settings.defaultSound, 'chime');
    assert.strictEqual(d.settings.defaultSnoozeMinutes, 5);
    assert.strictEqual(d.settings.maxSnoozeCount, 3);
    assert.deepStrictEqual(d.logs, []);
  });
});

describe('load - 空文件', () => {
  test('文件不存在返回默认数据', () => {
    const data = store.load(tmpFile);
    assert.deepStrictEqual(data.alarms, []);
    assert.strictEqual(data.settings.defaultSound, 'chime');
  });

  test('文件损坏返回默认数据', () => {
    fs.writeFileSync(tmpFile, 'not json {{{', 'utf8');
    const data = store.load(tmpFile);
    assert.deepStrictEqual(data.alarms, []);
  });
});

describe('save + load 往返', () => {
  test('保存后能正确读回', () => {
    const data = store.defaultData();
    data.alarms.push({
      id: 'a_test_1',
      label: '起床',
      hour: 7,
      minute: 30,
      enabled: true,
      repeat: { type: 'daily' },
      sound: 'chime',
      snoozeMinutes: 5,
      maxSnoozeCount: 3,
      volume: 0.9
    });
    store.save(data, tmpFile);
    const loaded = store.load(tmpFile);
    assert.strictEqual(loaded.alarms.length, 1);
    assert.strictEqual(loaded.alarms[0].label, '起床');
    assert.strictEqual(loaded.alarms[0].hour, 7);
  });

  test('保存的文件是 UTF-8 编码（中文不乱码）', () => {
    const data = store.defaultData();
    data.alarms.push({ id: 'a_cn', label: '起床闹钟', hour: 7, minute: 30 });
    store.save(data, tmpFile);
    const text = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(text.indexOf('起床闹钟') >= 0);
  });

  test('保存时生成 .bak 备份', () => {
    const data1 = store.defaultData();
    data1.alarms.push({ id: 'a1' });
    store.save(data1, tmpFile);
    // 第二次保存应生成 .bak
    const data2 = store.defaultData();
    data2.alarms.push({ id: 'a2' });
    store.save(data2, tmpFile);
    assert.ok(fs.existsSync(tmpFile + '.bak'));
  });
});

describe('mergeWithDefaults', () => {
  test('空对象返回默认', () => {
    const m = store.mergeWithDefaults({});
    assert.deepStrictEqual(m.alarms, []);
    assert.strictEqual(m.settings.defaultSound, 'chime');
  });

  test('保留自定义字段，补全缺失字段', () => {
    const m = store.mergeWithDefaults({
      alarms: [{ id: 'x' }],
      settings: { defaultSound: 'bell' }
    });
    assert.strictEqual(m.alarms.length, 1);
    assert.strictEqual(m.settings.defaultSound, 'bell');
    assert.strictEqual(m.settings.defaultSnoozeMinutes, 5);  // 默认值
  });
});

describe('appendLog', () => {
  test('追加并限制 200 条', () => {
    const data = store.defaultData();
    for (let i = 0; i < 250; i++) {
      store.appendLog(data, { type: 'fired', n: i });
    }
    assert.strictEqual(data.logs.length, 200);
    assert.strictEqual(data.logs[0].n, 50);   // 前 50 条被裁剪
    assert.strictEqual(data.logs[199].n, 249);
  });
});

describe('export / import', () => {
  test('导出 JSON 字符串可再次导入', () => {
    const data = store.defaultData();
    data.alarms.push({ id: 'a_exp', label: '导出测试' });
    const json = store.exportJson(data);
    const imported = store.importJson(json);
    assert.strictEqual(imported.alarms.length, 1);
    assert.strictEqual(imported.alarms[0].label, '导出测试');
  });

  test('导入无效 JSON 抛错', () => {
    assert.throws(() => store.importJson('not json'), SyntaxError);
  });
});

describe('newId', () => {
  test('每次返回不同 ID', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(store.newId());
    assert.strictEqual(ids.size, 100);
  });
});
