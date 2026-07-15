// 单位转换核心逻辑测试
const { categories, convert, formatNumber } = require('../src/conversions.js');

let passed = 0;
let failed = 0;

function assertClose(actual, expected, label, eps = 1e-6) {
  const ok = Math.abs(actual - expected) < eps;
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label} (期望 ${expected}, 实际 ${actual})`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label} (期望 ${expected}, 实际 ${actual})`);
    failed++;
  }
}

console.log('\n=== 单位转换器测试 ===\n');

// 长度
console.log('【长度】');
assertClose(convert('length', 1, 'm', 'cm'), 100, '1 m = 100 cm');
assertClose(convert('length', 1, 'km', 'm'), 1000, '1 km = 1000 m');
assertClose(convert('length', 1, 'mi', 'km'), 1.609344, '1 mi = 1.609344 km');
assertClose(convert('length', 1, 'ft', 'in'), 12, '1 ft = 12 in');
assertClose(convert('length', 1, 'nmi', 'km'), 1.852, '1 nmi = 1.852 km');
assertClose(convert('length', 3, 'chi', 'm'), 1, '3 市尺 = 1 m');

// 重量
console.log('【重量】');
assertClose(convert('weight', 1, 'kg', 'g'), 1000, '1 kg = 1000 g');
assertClose(convert('weight', 1, 'lb', 'kg'), 0.45359237, '1 lb = 0.45359237 kg');
assertClose(convert('weight', 1, 'oz', 'g'), 28.349523125, '1 oz = 28.349523125 g');
assertClose(convert('weight', 2, 'jin', 'kg'), 1, '2 市斤 = 1 kg');

// 温度（自定义换算）
console.log('【温度】');
assertClose(convert('temperature', 0, 'C', 'F'), 32, '0°C = 32°F');
assertClose(convert('temperature', 100, 'C', 'F'), 212, '100°C = 212°F');
assertClose(convert('temperature', 0, 'C', 'K'), 273.15, '0°C = 273.15 K');
assertClose(convert('temperature', 32, 'F', 'C'), 0, '32°F = 0°C');
assertClose(convert('temperature', 273.15, 'K', 'C'), 0, '273.15 K = 0°C');
assertClose(convert('temperature', -40, 'C', 'F'), -40, '-40°C = -40°F');

// 面积
console.log('【面积】');
assertClose(convert('area', 1, 'km2', 'm2'), 1e6, '1 km² = 1000000 m²');
assertClose(convert('area', 1, 'ha', 'm2'), 10000, '1 ha = 10000 m²');
assertClose(convert('area', 1, 'acre', 'm2'), 4046.8564224, '1 acre = 4046.8564224 m²');

// 体积
console.log('【体积】');
assertClose(convert('volume', 1, 'L', 'mL'), 1000, '1 L = 1000 mL');
assertClose(convert('volume', 1, 'm3', 'L'), 1000, '1 m³ = 1000 L');
assertClose(convert('volume', 1, 'gal', 'L'), 3.785411784, '1 gal = 3.785411784 L');

// 速度
console.log('【速度】');
assertClose(convert('speed', 1, 'kmh', 'mps'), 1 / 3.6, '1 km/h = 0.2778 m/s');
assertClose(convert('speed', 1, 'mph', 'kmh'), 1.609344, '1 mph = 1.609344 km/h');
assertClose(convert('speed', 1, 'knot', 'kmh'), 1.852, '1 knot = 1.852 km/h');

// 数据存储
console.log('【数据存储】');
assertClose(convert('data', 1, 'KB', 'B'), 1024, '1 KB = 1024 B');
assertClose(convert('data', 1, 'MB', 'KB'), 1024, '1 MB = 1024 KB');
assertClose(convert('data', 1, 'GB', 'MB'), 1024, '1 GB = 1024 MB');
assertClose(convert('data', 8, 'bit', 'B'), 1, '8 bit = 1 B');

// 时间
console.log('【时间】');
assertClose(convert('time', 1, 'min', 's'), 60, '1 min = 60 s');
assertClose(convert('time', 1, 'h', 'min'), 60, '1 h = 60 min');
assertClose(convert('time', 1, 'day', 'h'), 24, '1 day = 24 h');
assertClose(convert('time', 1, 'year', 'day'), 365, '1 year = 365 day');

// 压力
console.log('【压力】');
assertClose(convert('pressure', 1, 'bar', 'kPa'), 100, '1 bar = 100 kPa');
assertClose(convert('pressure', 1, 'atm', 'kPa'), 101.325, '1 atm = 101.325 kPa');

// 能量
console.log('【能量】');
assertClose(convert('energy', 1, 'kWh', 'Wh'), 1000, '1 kWh = 1000 Wh');
assertClose(convert('energy', 1, 'kcal', 'cal'), 1000, '1 kcal = 1000 cal');

// 功率
console.log('【功率】');
assertClose(convert('power', 1, 'kW', 'W'), 1000, '1 kW = 1000 W');

// 角度
console.log('【角度】');
assertClose(convert('angle', 180, 'deg', 'rad'), Math.PI, '180° = π rad', 1e-5);
assertClose(convert('angle', 360, 'deg', 'turn'), 1, '360° = 1 turn');

// 频率
console.log('【频率】');
assertClose(convert('frequency', 1, 'MHz', 'kHz'), 1000, '1 MHz = 1000 kHz');
assertClose(convert('frequency', 60, 'rpm', 'Hz'), 1, '60 rpm = 1 Hz');

// 数据传输
console.log('【数据传输】');
assertClose(convert('datarate', 1, 'MBps', 'Mbps'), 8, '1 MB/s = 8 Mbps');

// 格式化函数
console.log('【格式化】');
assertEqual(formatNumber(0), '0', '0 格式化为 0');
assertEqual(formatNumber(1.5), '1.5', '1.5 格式化为 1.5');
assertEqual(formatNumber(100), '100', '100 格式化为 100');

// 反向转换验证
console.log('【往返验证】');
const r1 = convert('length', 123.456, 'm', 'ft');
const r2 = convert('length', r1, 'ft', 'm');
assertClose(r2, 123.456, 'm→ft→m 往返一致');

const r3 = convert('temperature', 42, 'C', 'F');
const r4 = convert('temperature', r3, 'F', 'C');
assertClose(r4, 42, 'C→F→C 往返一致');

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===\n`);
process.exit(failed > 0 ? 1 : 0);
