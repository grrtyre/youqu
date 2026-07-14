// 闹钟管家 - 农历转换单元测试
const { test, describe } = require('node:test');
const assert = require('node:assert');
const lunar = require('../src/lunar.js');

describe('公历转农历 - 已知日期', () => {
  test('2026-02-17 → 农历丙午年正月初一（春节）', () => {
    const r = lunar.solarToLunar(2026, 2, 17);
    assert.strictEqual(r.year, 2026);
    assert.strictEqual(r.month, 1);
    assert.strictEqual(r.day, 1);
    assert.strictEqual(r.isLeap, false);
    assert.strictEqual(r.dayName, '初一');
    assert.strictEqual(r.monthName, '正月');
  });

  test('2026-09-25 → 农历八月十五（中秋）', () => {
    const r = lunar.solarToLunar(2026, 9, 25);
    assert.strictEqual(r.month, 8);
    assert.strictEqual(r.day, 15);
    assert.strictEqual(r.dayName, '十五');
  });

  test('2025-01-29 → 农历乙巳年正月初一（春节）', () => {
    const r = lunar.solarToLunar(2025, 1, 29);
    assert.strictEqual(r.year, 2025);
    assert.strictEqual(r.month, 1);
    assert.strictEqual(r.day, 1);
  });

  test('2024-02-10 → 农历甲辰年正月初一（春节）', () => {
    const r = lunar.solarToLunar(2024, 2, 10);
    assert.strictEqual(r.year, 2024);
    assert.strictEqual(r.month, 1);
    assert.strictEqual(r.day, 1);
  });

  test('2025-06-15 → 农历五月二十', () => {
    const r = lunar.solarToLunar(2025, 6, 15);
    assert.strictEqual(r.month, 5);
    assert.strictEqual(r.day, 20);
  });

  test('2023-03-22 → 农历闰二月初一', () => {
    // 2023 年闰二月，闰二月初一对应公历 3 月 22 日
    const r = lunar.solarToLunar(2023, 3, 22);
    assert.strictEqual(r.month, 2);
    assert.strictEqual(r.isLeap, true);
    assert.strictEqual(r.day, 1);
  });
});

describe('农历转公历 - 往返测试', () => {
  test('2026 农历正月初一 → 2026-02-17', () => {
    const solar = lunar.lunarToSolar(2026, 1, 1, false);
    assert.strictEqual(solar.getFullYear(), 2026);
    assert.strictEqual(solar.getMonth() + 1, 2);
    assert.strictEqual(solar.getDate(), 17);
  });

  test('2026 农历八月十五 → 2026-09-25', () => {
    const solar = lunar.lunarToSolar(2026, 8, 15, false);
    assert.strictEqual(solar.getFullYear(), 2026);
    assert.strictEqual(solar.getMonth() + 1, 9);
    assert.strictEqual(solar.getDate(), 25);
  });

  test('2023 闰二月初一 → 2023-03-22', () => {
    const solar = lunar.lunarToSolar(2023, 2, 1, true);
    assert.strictEqual(solar.getFullYear(), 2023);
    assert.strictEqual(solar.getMonth() + 1, 3);
    assert.strictEqual(solar.getDate(), 22);
  });
});

describe('生肖与干支', () => {
  test('2026 年 → 丙午年（马）', () => {
    assert.strictEqual(lunar.ganZhiYear(2026), '丙午');
    assert.strictEqual(lunar.animalName(2026), '马');
  });
  test('2024 年 → 甲辰年（龙）', () => {
    assert.strictEqual(lunar.ganZhiYear(2024), '甲辰');
    assert.strictEqual(lunar.animalName(2024), '龙');
  });
  test('2025 年 → 乙巳年（蛇）', () => {
    assert.strictEqual(lunar.ganZhiYear(2025), '乙巳');
    assert.strictEqual(lunar.animalName(2025), '蛇');
  });
});

describe('日名显示', () => {
  test('初一到初十', () => {
    assert.strictEqual(lunar.dayName(1), '初一');
    assert.strictEqual(lunar.dayName(5), '初五');
    assert.strictEqual(lunar.dayName(10), '初十');
  });
  test('十一到十九', () => {
    assert.strictEqual(lunar.dayName(11), '十一');
    assert.strictEqual(lunar.dayName(15), '十五');
    assert.strictEqual(lunar.dayName(19), '十九');
  });
  test('二十到廿九', () => {
    assert.strictEqual(lunar.dayName(20), '二十');
    assert.strictEqual(lunar.dayName(21), '廿一');
    assert.strictEqual(lunar.dayName(29), '廿九');
  });
  test('三十', () => {
    assert.strictEqual(lunar.dayName(30), '三十');
  });
});

describe('边界', () => {
  test('超出范围抛错', () => {
    assert.throws(() => lunar.solarToLunar(1899, 1, 1), /1900-2100/);
    assert.throws(() => lunar.solarToLunar(2101, 1, 1), /1900-2100/);
  });
});
