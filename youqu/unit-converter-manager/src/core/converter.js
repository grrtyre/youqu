// 换算管家 - 换算核心逻辑
// 与 UI 解耦，可独立测试

const { categories } = require('./unit-data');

// 数值格式化：智能截断避免浮点尾巴，保留有效精度，整数部分加千分位
function formatValue(value, precision = 10) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  if (value === 0) return '0';

  const abs = Math.abs(value);
  // 极大或极小数用科学计数法
  if (abs < 1e-6 || abs >= 1e15) {
    return value.toExponential(precision - 1);
  }
  // 普通数：用 precision 位有效数字，去掉浮点尾巴
  const fixed = Number(value.toPrecision(precision));
  let s = fixed.toString();
  // 整数部分加千分位分隔符（仅对绝对值 >= 1000 的数）
  if (abs >= 1000) {
    const parts = s.split('.');
    const sign = parts[0].startsWith('-') ? '-' : '';
    const intPart = sign ? parts[0].slice(1) : parts[0];
    parts[0] = sign + intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    s = parts.join('.');
  }
  return s;
}

// 找到类别
function getCategory(categoryId) {
  return categories.find(c => c.id === categoryId);
}

// 找到单位定义
function getUnit(categoryId, unitId) {
  const cat = getCategory(categoryId);
  if (!cat) return null;
  return cat.units.find(u => u.id === unitId) || null;
}

// 单值转基准
function toBase(value, unit) {
  if (typeof unit.toBase === 'function') {
    return unit.toBase(value);
  }
  return value * unit.factor;
}

// 基准转目标
function fromBase(baseValue, unit) {
  if (typeof unit.fromBase === 'function') {
    return unit.fromBase(baseValue);
  }
  return baseValue / unit.factor;
}

// 单值换算：fromUnitId -> toUnitId
function convert(categoryId, fromUnitId, value, toUnitId) {
  const fromUnit = getUnit(categoryId, fromUnitId);
  const toUnit = getUnit(categoryId, toUnitId);
  if (!fromUnit || !toUnit) return null;

  // 进制类特殊处理：toBase 返回字符串，需要先转 Number 再换算
  let baseValue = toBase(value, fromUnit);
  if (typeof baseValue === 'string') baseValue = Number(baseValue);
  if (baseValue === null || Number.isNaN(baseValue)) return null;

  let result = fromBase(baseValue, toUnit);
  // 进制类 fromBase 返回字符串
  if (typeof result === 'string') return result;
  if (Number.isNaN(result) || !Number.isFinite(result)) return null;
  return result;
}

// 批量换算：把一个值换算为该类别下所有其它单位
function convertAll(categoryId, fromUnitId, value) {
  const cat = getCategory(categoryId);
  if (!cat) return [];
  const fromUnit = getUnit(categoryId, fromUnitId);
  if (!fromUnit) return [];

  let baseValue = toBase(value, fromUnit);
  if (typeof baseValue === 'string') baseValue = Number(baseValue);
  if (baseValue === null || Number.isNaN(baseValue) || !Number.isFinite(baseValue)) return [];

  return cat.units.map(u => {
    let result = fromBase(baseValue, u);
    const isString = typeof result === 'string';
    if (!isString) {
      if (Number.isNaN(result) || !Number.isFinite(result)) {
        return { unitId: u.id, name: u.name, value: '', raw: null, isString: false };
      }
    }
    return {
      unitId: u.id,
      name: u.name,
      value: isString ? result : formatValue(result),
      raw: isString ? result : result,
      isString
    };
  });
}

// 解析用户输入：支持小数、负数、科学计数法
function parseInput(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (s === '') return null;
  // 允许千分位逗号
  const cleaned = s.replace(/,/g, '');
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return n;
}

module.exports = {
  categories,
  formatValue,
  getCategory,
  getUnit,
  convert,
  convertAll,
  parseInput,
  toBase,
  fromBase
};
