// 单位转换核心逻辑 - 支持14大类单位互转
// 设计思路：每类设基准单位，普通单位用 factor（乘法）换算；温度等用 toBase/fromBase 自定义函数

const categories = {
  length: {
    name: '长度',
    icon: '📏',
    base: 'm',
    units: {
      nm:    { name: '纳米 nm',     factor: 1e-9 },
      um:    { name: '微米 μm',     factor: 1e-6 },
      mm:    { name: '毫米 mm',     factor: 0.001 },
      cm:    { name: '厘米 cm',     factor: 0.01 },
      dm:    { name: '分米 dm',     factor: 0.1 },
      m:     { name: '米 m',        factor: 1 },
      km:    { name: '千米 km',     factor: 1000 },
      in:    { name: '英寸 in',     factor: 0.0254 },
      ft:    { name: '英尺 ft',     factor: 0.3048 },
      yd:    { name: '码 yd',       factor: 0.9144 },
      mi:    { name: '英里 mi',     factor: 1609.344 },
      nmi:   { name: '海里 nmi',    factor: 1852 },
      li:    { name: '市里',        factor: 500 },
      chi:   { name: '市尺',        factor: 1 / 3 },
      cun:   { name: '市寸',        factor: 1 / 30 }
    }
  },
  weight: {
    name: '重量',
    icon: '⚖️',
    base: 'kg',
    units: {
      mg:    { name: '毫克 mg',     factor: 1e-6 },
      g:     { name: '克 g',        factor: 0.001 },
      kg:    { name: '千克 kg',     factor: 1 },
      t:     { name: '吨 t',        factor: 1000 },
      ct:    { name: '克拉 ct',     factor: 0.0002 },
      oz:    { name: '盎司 oz',     factor: 0.028349523125 },
      lb:    { name: '磅 lb',       factor: 0.45359237 },
      jin:   { name: '市斤',        factor: 0.5 },
      liang: { name: '市两',        factor: 0.05 }
    }
  },
  temperature: {
    name: '温度',
    icon: '🌡️',
    base: 'C',
    custom: true,
    units: {
      C: { name: '摄氏度 °C', toBase: v => v,                  fromBase: v => v },
      F: { name: '华氏度 °F', toBase: v => (v - 32) * 5 / 9,    fromBase: v => v * 9 / 5 + 32 },
      K: { name: '开尔文 K',  toBase: v => v - 273.15,           fromBase: v => v + 273.15 },
      R: { name: '兰氏度 °R', toBase: v => (v - 491.67) * 5 / 9, fromBase: v => v * 9 / 5 + 491.67 }
    }
  },
  area: {
    name: '面积',
    icon: '📐',
    base: 'm2',
    units: {
      mm2:  { name: '平方毫米 mm²',  factor: 1e-6 },
      cm2:  { name: '平方厘米 cm²',  factor: 0.0001 },
      m2:   { name: '平方米 m²',     factor: 1 },
      km2:  { name: '平方千米 km²',  factor: 1e6 },
      ha:   { name: '公顷 ha',       factor: 1e4 },
      mu:   { name: '亩',            factor: 666.6666667 },
      qing: { name: '顷',            factor: 66666.66667 },
      in2:  { name: '平方英寸 in²',  factor: 0.00064516 },
      ft2:  { name: '平方英尺 ft²',  factor: 0.09290304 },
      yd2:  { name: '平方码 yd²',    factor: 0.83612736 },
      acre: { name: '英亩 acre',     factor: 4046.8564224 },
      muUK: { name: '英亩(亩)',      factor: 4046.8564224 }
    }
  },
  volume: {
    name: '体积',
    icon: '🧪',
    base: 'L',
    units: {
      mL:   { name: '毫升 mL',      factor: 0.001 },
      L:    { name: '升 L',         factor: 1 },
      m3:   { name: '立方米 m³',    factor: 1000 },
      cm3:  { name: '立方厘米 cm³', factor: 0.001 },
      gal:  { name: '加仑(美) gal', factor: 3.785411784 },
      qt:   { name: '夸脱(美) qt',  factor: 0.946352946 },
      pt:   { name: '品脱(美) pt',  factor: 0.473176473 },
      cup:  { name: '杯 cup',       factor: 0.2365882365 },
      floz: { name: '液量盎司 fl oz', factor: 0.0295735295625 },
      tbsp: { name: '汤匙 tbsp',    factor: 0.01478676478125 },
      tsp:  { name: '茶匙 tsp',     factor: 0.00492892159375 }
    }
  },
  speed: {
    name: '速度',
    icon: '🚀',
    base: 'mps',
    units: {
      mps:  { name: '米/秒 m/s',    factor: 1 },
      kmh:  { name: '千米/时 km/h', factor: 1 / 3.6 },
      mph:  { name: '英里/时 mph',  factor: 0.44704 },
      knot: { name: '节 knot',      factor: 0.514444444 },
      mach: { name: '马赫 mach',    factor: 340.3 },
      fps:  { name: '英尺/秒 ft/s', factor: 0.3048 }
    }
  },
  data: {
    name: '数据存储',
    icon: '💾',
    base: 'B',
    units: {
      bit:  { name: '比特 bit',  factor: 0.125 },
      B:    { name: '字节 B',    factor: 1 },
      KB:   { name: '千字节 KB', factor: 1024 },
      MB:   { name: '兆字节 MB', factor: 1048576 },
      GB:   { name: '吉字节 GB', factor: 1073741824 },
      TB:   { name: '太字节 TB', factor: 1099511627776 },
      PB:   { name: '拍字节 PB', factor: 1125899906842624 },
      Kb:   { name: '千比特 Kb', factor: 125 },
      Mb:   { name: '兆比特 Mb', factor: 125000 },
      Gb:   { name: '吉比特 Gb', factor: 125000000 }
    }
  },
  time: {
    name: '时间',
    icon: '⏱️',
    base: 's',
    units: {
      ns:    { name: '纳秒 ns',     factor: 1e-9 },
      us:    { name: '微秒 μs',     factor: 1e-6 },
      ms:    { name: '毫秒 ms',     factor: 0.001 },
      s:     { name: '秒 s',        factor: 1 },
      min:   { name: '分 min',      factor: 60 },
      h:     { name: '时 h',        factor: 3600 },
      day:   { name: '天 day',      factor: 86400 },
      week:  { name: '周 week',     factor: 604800 },
      month: { name: '月(30天)',    factor: 2592000 },
      year:  { name: '年(365天)',   factor: 31536000 }
    }
  },
  pressure: {
    name: '压力',
    icon: '🎈',
    base: 'Pa',
    units: {
      Pa:   { name: '帕 Pa',       factor: 1 },
      kPa:  { name: '千帕 kPa',    factor: 1000 },
      MPa:  { name: '兆帕 MPa',    factor: 1e6 },
      GPa:  { name: '吉帕 GPa',    factor: 1e9 },
      bar:  { name: '巴 bar',      factor: 1e5 },
      mbar: { name: '毫巴 mbar',   factor: 100 },
      atm:  { name: '标准大气压 atm', factor: 101325 },
      psi:  { name: '磅/平方英寸 psi', factor: 6894.757293168 },
      mmHg: { name: '毫米汞柱 mmHg',  factor: 133.322368421 },
      torr: { name: '托 torr',     factor: 133.322368421 }
    }
  },
  energy: {
    name: '能量',
    icon: '⚡',
    base: 'J',
    units: {
      J:     { name: '焦耳 J',       factor: 1 },
      kJ:    { name: '千焦 kJ',      factor: 1000 },
      cal:   { name: '卡 cal',       factor: 4.184 },
      kcal:  { name: '千卡 kcal',    factor: 4184 },
      Wh:    { name: '瓦时 Wh',      factor: 3600 },
      kWh:   { name: '千瓦时 kWh',   factor: 3.6e6 },
      eV:    { name: '电子伏 eV',    factor: 1.602176634e-19 },
      BTU:   { name: '英热 BTU',     factor: 1055.05585262 },
      ftlb:  { name: '英尺磅 ft·lb', factor: 1.3558179483314 }
    }
  },
  power: {
    name: '功率',
    icon: '🔧',
    base: 'W',
    units: {
      mW:   { name: '毫瓦 mW',    factor: 0.001 },
      W:    { name: '瓦 W',       factor: 1 },
      kW:   { name: '千瓦 kW',    factor: 1000 },
      MW:   { name: '兆瓦 MW',    factor: 1e6 },
      hp:   { name: '马力(公制) hp', factor: 735.49875 },
      hpUK: { name: '马力(英制) hp', factor: 745.6998715822702 },
      kcalh:{ name: '千卡/时',     factor: 1.1622222222 }
    }
  },
  angle: {
    name: '角度',
    icon: '📐',
    base: 'deg',
    units: {
      deg:  { name: '度 °',     factor: 1 },
      rad:  { name: '弧度 rad', factor: 57.29577951308232 },
      grad: { name: '梯度 grad', factor: 0.9 },
      arcmin: { name: '角分 ′', factor: 1 / 60 },
      arcsec: { name: '角秒 ″', factor: 1 / 3600 },
      turn: { name: '转 turn',  factor: 360 }
    }
  },
  frequency: {
    name: '频率',
    icon: '📡',
    base: 'Hz',
    units: {
      mHz:  { name: '毫赫 mHz',  factor: 0.001 },
      Hz:   { name: '赫兹 Hz',   factor: 1 },
      kHz:  { name: '千赫 kHz',  factor: 1000 },
      MHz:  { name: '兆赫 MHz',  factor: 1e6 },
      GHz:  { name: '吉赫 GHz',  factor: 1e9 },
      THz:  { name: '太赫 THz',  factor: 1e12 },
      rpm:  { name: '转/分 rpm',  factor: 1 / 60 }
    }
  },
  datarate: {
    name: '数据传输',
    icon: '📶',
    base: 'bps',
    units: {
      bps:   { name: '比特/秒 bps',   factor: 1 },
      Kbps:  { name: '千比特/秒 Kbps', factor: 1000 },
      Mbps:  { name: '兆比特/秒 Mbps', factor: 1e6 },
      Gbps:  { name: '吉比特/秒 Gbps', factor: 1e9 },
      Bps:   { name: '字节/秒 B/s',    factor: 8 },
      KBps:  { name: '千字节/秒 KB/s', factor: 8000 },
      MBps:  { name: '兆字节/秒 MB/s', factor: 8e6 },
      GBps:  { name: '吉字节/秒 GB/s', factor: 8e9 }
    }
  }
};

// 核心转换函数：将值从 fromUnit 转为 toUnit
function convert(category, value, fromUnit, toUnit) {
  const cat = categories[category];
  if (!cat) throw new Error(`未知类别: ${category}`);
  const from = cat.units[fromUnit];
  const to = cat.units[toUnit];
  if (!from || !to) throw new Error(`未知单位`);

  if (cat.custom) {
    // 自定义换算（如温度）
    const baseValue = from.toBase(value);
    return to.fromBase(baseValue);
  }
  // 标准乘法换算：先转到基准，再从基准转到目标
  const baseValue = value * from.factor;
  return baseValue / to.factor;
}

// 格式化数字：去除多余尾零，科学计数法处理极大极小值
function formatNumber(num) {
  if (!isFinite(num)) return '—';
  if (num === 0) return '0';
  const abs = Math.abs(num);
  if (abs < 1e-6 || abs >= 1e15) return num.toExponential(6);
  // 最多保留8位小数，去尾零
  const fixed = parseFloat(num.toFixed(8));
  return fixed.toString();
}

// 兼容 Node（测试）和浏览器（渲染进程）
if (typeof window !== 'undefined') {
  window.UnitConverter = { categories, convert, formatNumber };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { categories, convert, formatNumber };
}
