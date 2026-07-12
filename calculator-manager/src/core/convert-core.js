// 计算器管家 · 单位转换核心（纯函数，可单测）
// 支持：长度、重量、温度、面积、体积、速度、数据、时间、角度、压力 十大类
// 设计：线性单位用 toBase/fromBase 系数；温度用 toBase/fromBase 函数（非线性）
// 所有函数无副作用、不依赖外部状态，便于测试

'use strict';

// ============ 类别定义 ============
// 每个单位：{ name, symbol, toBase, fromBase }
// 线性单位：toBase = value * factor + offset；fromBase 反向
// 为简化，线性单位直接用 factor（toBase = v*factor），fromBase = v/factor
// 温度单独用函数

const CATEGORIES = {
  length: {
    label: '长度',
    icon: '📏',
    base: 'm',
    units: [
      { name: 'km', label: '千米', factor: 1000 },
      { name: 'm', label: '米', factor: 1 },
      { name: 'dm', label: '分米', factor: 0.1 },
      { name: 'cm', label: '厘米', factor: 0.01 },
      { name: 'mm', label: '毫米', factor: 0.001 },
      { name: 'um', label: '微米', factor: 1e-6 },
      { name: 'nm', label: '纳米', factor: 1e-9 },
      { name: 'mi', label: '英里', factor: 1609.344 },
      { name: 'yd', label: '码', factor: 0.9144 },
      { name: 'ft', label: '英尺', factor: 0.3048 },
      { name: 'in', label: '英寸', factor: 0.0254 },
      { name: 'nmi', label: '海里', factor: 1852 },
    ],
  },
  weight: {
    label: '重量',
    icon: '⚖️',
    base: 'kg',
    units: [
      { name: 't', label: '吨', factor: 1000 },
      { name: 'kg', label: '千克', factor: 1 },
      { name: 'g', label: '克', factor: 0.001 },
      { name: 'mg', label: '毫克', factor: 1e-6 },
      { name: 'lb', label: '磅', factor: 0.45359237 },
      { name: 'oz', label: '盎司', factor: 0.028349523125 },
      { name: 'ct', label: '克拉', factor: 0.0002 },
      { name: 'jin', label: '市斤', factor: 0.5 },
    ],
  },
  temperature: {
    label: '温度',
    icon: '🌡️',
    base: 'C',
    units: [
      { name: 'C', label: '摄氏度', toBase: (v) => v, fromBase: (v) => v },
      { name: 'F', label: '华氏度', toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => v * 9 / 5 + 32 },
      { name: 'K', label: '开尔文', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
      { name: 'R', label: '兰氏度', toBase: (v) => (v - 491.67) * 5 / 9, fromBase: (v) => (v + 273.15) * 9 / 5 },
    ],
  },
  area: {
    label: '面积',
    icon: '🔲',
    base: 'm2',
    units: [
      { name: 'km2', label: '平方千米', factor: 1e6 },
      { name: 'ha', label: '公顷', factor: 1e4 },
      { name: 'm2', label: '平方米', factor: 1 },
      { name: 'cm2', label: '平方厘米', factor: 1e-4 },
      { name: 'mm2', label: '平方毫米', factor: 1e-6 },
      { name: 'mu', label: '亩', factor: 666.6666666666666 },
      { name: 'ac', label: '英亩', factor: 4046.8564224 },
      { name: 'ft2', label: '平方英尺', factor: 0.09290304 },
      { name: 'in2', label: '平方英寸', factor: 0.00064516 },
      { name: 'mu2', label: '市亩', factor: 666.6666666666666 },
    ],
  },
  volume: {
    label: '体积',
    icon: '🧪',
    base: 'L',
    units: [
      { name: 'm3', label: '立方米', factor: 1000 },
      { name: 'L', label: '升', factor: 1 },
      { name: 'mL', label: '毫升', factor: 0.001 },
      { name: 'cm3', label: '立方厘米', factor: 0.001 },
      { name: 'mm3', label: '立方毫米', factor: 1e-6 },
      { name: 'gal', label: '美加仑', factor: 3.785411784 },
      { name: 'qt', label: '夸脱', factor: 0.946352946 },
      { name: 'pt', label: '品脱', factor: 0.473176473 },
      { name: 'cup', label: '杯', factor: 0.2365882365 },
      { name: 'floz', label: '液量盎司', factor: 0.0295735295625 },
      { name: 'tbsp', label: '汤匙', factor: 0.01478676478125 },
      { name: 'tsp', label: '茶匙', factor: 0.00492892159375 },
    ],
  },
  speed: {
    label: '速度',
    icon: '⚡',
    base: 'ms',
    units: [
      { name: 'ms', label: '米/秒', factor: 1 },
      { name: 'kmh', label: '千米/时', factor: 1 / 3.6 },
      { name: 'mph', label: '英里/时', factor: 0.44704 },
      { name: 'fts', label: '英尺/秒', factor: 0.3048 },
      { name: 'knot', label: '节', factor: 0.5144444444444445 },
      { name: 'mach', label: '马赫', factor: 343 },
    ],
  },
  data: {
    label: '数据',
    icon: '💾',
    base: 'B',
    units: [
      { name: 'bit', label: '比特', factor: 0.125 },
      { name: 'B', label: '字节', factor: 1 },
      { name: 'KB', label: '千字节', factor: 1024 },
      { name: 'MB', label: '兆字节', factor: 1024 * 1024 },
      { name: 'GB', label: '吉字节', factor: 1024 * 1024 * 1024 },
      { name: 'TB', label: '太字节', factor: 1024 * 1024 * 1024 * 1024 },
      { name: 'PB', label: '拍字节', factor: 1024 * 1024 * 1024 * 1024 * 1024 },
      { name: 'KiB', label: '千字节(ISO)', factor: 1024 },
      { name: 'MiB', label: '兆字节(ISO)', factor: 1024 * 1024 },
    ],
  },
  time: {
    label: '时间',
    icon: '⏱️',
    base: 's',
    units: [
      { name: 'ns', label: '纳秒', factor: 1e-9 },
      { name: 'us', label: '微秒', factor: 1e-6 },
      { name: 'ms', label: '毫秒', factor: 1e-3 },
      { name: 's', label: '秒', factor: 1 },
      { name: 'min', label: '分钟', factor: 60 },
      { name: 'h', label: '小时', factor: 3600 },
      { name: 'day', label: '天', factor: 86400 },
      { name: 'week', label: '周', factor: 604800 },
      { name: 'month', label: '月(30天)', factor: 2592000 },
      { name: 'year', label: '年(365天)', factor: 31536000 },
    ],
  },
  angle: {
    label: '角度',
    icon: '📐',
    base: 'deg',
    units: [
      { name: 'deg', label: '度', factor: 1 },
      { name: 'rad', label: '弧度', factor: 180 / Math.PI },
      { name: 'grad', label: '梯度', factor: 0.9 },
      { name: 'arcmin', label: '角分', factor: 1 / 60 },
      { name: 'arcsec', label: '角秒', factor: 1 / 3600 },
      { name: 'turn', label: '圈', factor: 360 },
    ],
  },
  pressure: {
    label: '压力',
    icon: '🔵',
    base: 'Pa',
    units: [
      { name: 'Pa', label: '帕斯卡', factor: 1 },
      { name: 'kPa', label: '千帕', factor: 1000 },
      { name: 'MPa', label: '兆帕', factor: 1e6 },
      { name: 'bar', label: '巴', factor: 1e5 },
      { name: 'atm', label: '标准大气压', factor: 101325 },
      { name: 'psi', label: '磅/平方英寸', factor: 6894.757293168 },
      { name: 'mmHg', label: '毫米汞柱', factor: 133.322387415 },
      { name: 'inHg', label: '英寸汞柱', factor: 3386.389 },
      { name: 'torr', label: '托', factor: 133.32236842105263 },
    ],
  },
};

// ============ 核心转换函数 ============

// 把 value 从 fromUnit 转为基准单位
function toBase(value, unit, category) {
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new Error('数值无效');
  }
  if (typeof unit !== 'string') throw new Error('单位必须是字符串');
  const cat = CATEGORIES[category];
  if (!cat) throw new Error(`未知类别: ${category}`);
  const u = cat.units.find(x => x.name === unit);
  if (!u) throw new Error(`未知单位: ${unit}`);

  if (typeof u.toBase === 'function') {
    const r = u.toBase(value);
    if (typeof r !== 'number' || !isFinite(r)) throw new Error('转换结果无效');
    return r;
  }
  // 线性：factor 可能为 0（理论上不会）
  if (u.factor == null) throw new Error(`单位 ${unit} 缺少转换系数`);
  return value * u.factor;
}

// 把 value 从基准单位转为 toUnit
function fromBase(value, unit, category) {
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new Error('数值无效');
  }
  if (typeof unit !== 'string') throw new Error('单位必须是字符串');
  const cat = CATEGORIES[category];
  if (!cat) throw new Error(`未知类别: ${category}`);
  const u = cat.units.find(x => x.name === unit);
  if (!u) throw new Error(`未知单位: ${unit}`);

  if (typeof u.fromBase === 'function') {
    const r = u.fromBase(value);
    if (typeof r !== 'number' || !isFinite(r)) throw new Error('转换结果无效');
    return r;
  }
  if (u.factor == null) throw new Error(`单位 ${unit} 缺少转换系数`);
  if (u.factor === 0) throw new Error('转换系数为零');
  return value / u.factor;
}

// 主入口：把 value 从 fromUnit 转为 toUnit（同一类别内）
function convert(value, fromUnit, toUnit, category) {
  const base = toBase(value, fromUnit, category);
  return fromBase(base, toUnit, category);
}

// ============ 查询函数 ============

function listCategories() {
  return Object.keys(CATEGORIES).map(key => ({
    key,
    label: CATEGORIES[key].label,
    icon: CATEGORIES[key].icon,
    base: CATEGORIES[key].base,
    units: CATEGORIES[key].units.map(u => ({
      name: u.name,
      label: u.label,
    })),
  }));
}

function getCategory(key) {
  const cat = CATEGORIES[key];
  if (!cat) return null;
  return {
    key,
    label: cat.label,
    icon: cat.icon,
    base: cat.base,
    units: cat.units.map(u => ({
      name: u.name,
      label: u.label,
    })),
  };
}

function findUnit(unitName, category) {
  const cat = CATEGORIES[category];
  if (!cat) return null;
  const u = cat.units.find(x => x.name === unitName);
  if (!u) return null;
  return { name: u.name, label: u.label };
}

// 获取某个类别的常见换算示例（用于界面展示参考）
// 返回 [{from, fromLabel, to, toLabel, value}]，其中 value = convert(1, from, to, category)
function getCommonConversions(category) {
  const cat = CATEGORIES[category];
  if (!cat) return [];
  // 每个类别挑选几组最常用的换算
  const COMMON = {
    length: [['m','cm'],['m','ft'],['km','mi'],['in','cm'],['km','m'],['ft','in'],['yd','m'],['nmi','km']],
    weight: [['kg','g'],['kg','lb'],['lb','g'],['t','kg'],['oz','g'],['ct','g'],['jin','kg'],['lb','oz']],
    temperature: [['C','F'],['C','K'],['F','C'],['K','C'],['C','R'],['F','K'],['K','F'],['R','C']],
    area: [['m2','ft2'],['km2','ha'],['ha','mu'],['ac','m2'],['m2','cm2'],['ft2','in2'],['km2','m2'],['ac','ft2']],
    volume: [['L','mL'],['m3','L'],['gal','L'],['cup','mL'],['L','pt'],['tbsp','tsp'],['qt','L'],['floz','mL']],
    speed: [['kmh','ms'],['ms','kmh'],['mph','kmh'],['knot','kmh'],['fts','ms'],['mach','ms'],['kmh','mph'],['mph','fts']],
    data: [['KB','B'],['MB','KB'],['GB','MB'],['TB','GB'],['PB','TB'],['MB','B'],['GB','KB'],['bit','B']],
    time: [['min','s'],['h','min'],['day','h'],['week','day'],['min','h'],['s','ms'],['year','day'],['month','day']],
    angle: [['rad','deg'],['deg','rad'],['turn','deg'],['arcmin','deg'],['arcsec','deg'],['grad','deg'],['turn','rad'],['arcmin','arcsec']],
    pressure: [['kPa','Pa'],['atm','kPa'],['bar','MPa'],['psi','kPa'],['MPa','Pa'],['mmHg','Pa'],['torr','Pa'],['atm','bar']],
  };
  const pairs = COMMON[category] || [];
  return pairs.map(([from, to]) => {
    const fromU = cat.units.find(u => u.name === from);
    const toU = cat.units.find(u => u.name === to);
    if (!fromU || !toU) return null;
    let value;
    try { value = convert(1, from, to, category); } catch (_) { return null; }
    return {
      from, fromLabel: fromU.label,
      to, toLabel: toU.label,
      value,
    };
  }).filter(Boolean);
}

// ============ 格式化输出 ============

// 智能格式化：整数直显，浮点保留有效数字并去尾零，极小值用科学计数
function formatResult(num, options) {
  if (typeof num !== 'number') return String(num);
  if (isNaN(num)) return 'NaN';
  if (!isFinite(num)) return num > 0 ? '∞' : '-∞';
  if (Object.is(num, -0)) num = 0;

  const opts = options || {};
  const precision = opts.precision != null ? opts.precision : 10;

  // 整数
  if (Number.isInteger(num) && Math.abs(num) < 1e15) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  // 极大或极小值用科学计数
  if (Math.abs(num) !== 0 && (Math.abs(num) >= 1e15 || Math.abs(num) < 1e-6)) {
    return num.toExponential(precision - 2).replace(/\.?0+e/, 'e');
  }

  // 一般浮点：先 toPrecision 再去尾零
  let s = num.toPrecision(precision);
  if (s.indexOf('.') !== -1 && s.indexOf('e') === -1 && s.indexOf('E') === -1) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  // 千分位（仅整数部分）
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const dotIdx = body.indexOf('.');
  const intPart = dotIdx === -1 ? body : body.slice(0, dotIdx);
  const fracPart = dotIdx === -1 ? '' : body.slice(dotIdx);
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + intWithSep + fracPart;
}

module.exports = {
  CATEGORIES,
  convert,
  toBase,
  fromBase,
  listCategories,
  getCategory,
  findUnit,
  getCommonConversions,
  formatResult,
};
