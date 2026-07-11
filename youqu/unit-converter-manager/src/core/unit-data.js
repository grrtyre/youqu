// 换算管家 - 单位定义数据
// 每个类别定义基准单位与各单位的转换关系
// 线性单位用 factor（toBase = value * factor）；非线性单位（如温度）用 toBase/fromBase 函数

const categories = [
  {
    id: 'length',
    name: '长度',
    icon: '📏',
    baseUnit: 'm',
    units: [
      { id: 'nm', name: '纳米 nm', factor: 1e-9 },
      { id: 'um', name: '微米 μm', factor: 1e-6 },
      { id: 'mm', name: '毫米 mm', factor: 0.001 },
      { id: 'cm', name: '厘米 cm', factor: 0.01 },
      { id: 'dm', name: '分米 dm', factor: 0.1 },
      { id: 'm', name: '米 m', factor: 1 },
      { id: 'km', name: '千米 km', factor: 1000 },
      { id: 'in', name: '英寸 in', factor: 0.0254 },
      { id: 'ft', name: '英尺 ft', factor: 0.3048 },
      { id: 'yd', name: '码 yd', factor: 0.9144 },
      { id: 'mi', name: '英里 mile', factor: 1609.344 },
      { id: 'nmi', name: '海里 nmi', factor: 1852 },
      { id: 'li', name: '市里', factor: 500 },
      { id: 'cun', name: '市寸', factor: 1 / 30 },
      { id: 'chi', name: '市尺', factor: 1 / 3 },
      { id: 'zhang', name: '市丈', factor: 10 / 3 },
      { id: 'ly', name: '光年 ly', factor: 9.4607304725808e15 }
    ]
  },
  {
    id: 'area',
    name: '面积',
    icon: '🟦',
    baseUnit: 'm2',
    units: [
      { id: 'mm2', name: '平方毫米 mm²', factor: 1e-6 },
      { id: 'cm2', name: '平方厘米 cm²', factor: 1e-4 },
      { id: 'dm2', name: '平方分米 dm²', factor: 0.01 },
      { id: 'm2', name: '平方米 m²', factor: 1 },
      { id: 'km2', name: '平方千米 km²', factor: 1e6 },
      { id: 'ha', name: '公顷 ha', factor: 1e4 },
      { id: 'mu', name: '亩', factor: 2000 / 3 },
      { id: 'qing', name: '顷', factor: 2000 / 3 * 100 },
      { id: 'ft2', name: '平方英尺 ft²', factor: 0.09290304 },
      { id: 'in2', name: '平方英寸 in²', factor: 0.00064516 },
      { id: 'yd2', name: '平方码 yd²', factor: 0.83612736 },
      { id: 'acre', name: '英亩 acre', factor: 4046.8564224 },
      { id: 'mu-ft', name: '市亩（亩）', factor: 666.66666666667 },
      { id: 'mu-jia', name: '甲（台）', factor: 9699.17 }
    ]
  },
  {
    id: 'volume',
    name: '体积',
    icon: '🧊',
    baseUnit: 'l',
    units: [
      { id: 'ml', name: '毫升 ml', factor: 0.001 },
      { id: 'l', name: '升 L', factor: 1 },
      { id: 'm3', name: '立方米 m³', factor: 1000 },
      { id: 'cm3', name: '立方厘米 cm³', factor: 0.001 },
      { id: 'dm3', name: '立方分米 dm³', factor: 1 },
      { id: 'tsp', name: '茶匙 tsp', factor: 0.00492892159375 },
      { id: 'tbsp', name: '汤匙 tbsp', factor: 0.01478676478125 },
      { id: 'floz_uk', name: '英制液量盎司 fl oz(UK)', factor: 0.0284130625 },
      { id: 'floz_us', name: '美制液量盎司 fl oz(US)', factor: 0.0295735295625 },
      { id: 'cup', name: '杯 cup', factor: 0.2365882365 },
      { id: 'pt_uk', name: '品脱 pt(UK)', factor: 0.56826125 },
      { id: 'qt_us', name: '夸脱 qt(US)', factor: 0.946352946 },
      { id: 'gal_uk', name: '英制加仑 gal(UK)', factor: 4.54609 },
      { id: 'gal_us', name: '美制加仑 gal(US)', factor: 3.785411784 },
      { id: 'sheng', name: '市升', factor: 1 },
      { id: 'dou', name: '市斗', factor: 10 },
      { id: 'shi', name: '市石', factor: 100 }
    ]
  },
  {
    id: 'mass',
    name: '质量',
    icon: '⚖️',
    baseUnit: 'kg',
    units: [
      { id: 'mg', name: '毫克 mg', factor: 1e-6 },
      { id: 'g', name: '克 g', factor: 0.001 },
      { id: 'kg', name: '千克 kg', factor: 1 },
      { id: 't', name: '吨 t', factor: 1000 },
      { id: 'ct', name: '克拉 ct', factor: 0.0002 },
      { id: 'oz', name: '盎司 oz', factor: 0.028349523125 },
      { id: 'lb', name: '磅 lb', factor: 0.45359237 },
      { id: 'st', name: '英石 st', factor: 6.35029318 },
      { id: 'ton_us', name: '美吨 ton(US)', factor: 907.18474 },
      { id: 'ton_uk', name: '英吨 ton(UK)', factor: 1016.0469088 },
      { id: 'jin', name: '市斤', factor: 0.5 },
      { id: 'liang', name: '市两', factor: 0.05 },
      { id: 'qian', name: '市钱', factor: 0.005 },
      { id: 'dan', name: '市担', factor: 50 }
    ]
  },
  {
    id: 'temperature',
    name: '温度',
    icon: '🌡️',
    baseUnit: 'c',
    units: [
      { id: 'c', name: '摄氏度 ℃', toBase: v => v, fromBase: v => v },
      { id: 'f', name: '华氏度 ℉', toBase: v => (v - 32) * 5 / 9, fromBase: v => v * 9 / 5 + 32 },
      { id: 'k', name: '开尔文 K', toBase: v => v - 273.15, fromBase: v => v + 273.15 },
      { id: 'r', name: '兰氏度 °R', toBase: v => (v - 491.67) * 5 / 9, fromBase: v => (v + 273.15) * 9 / 5 },
      { id: 're', name: '列氏度 °Ré', toBase: v => v * 5 / 4, fromBase: v => v * 4 / 5 }
    ]
  },
  {
    id: 'speed',
    name: '速度',
    icon: '🚄',
    baseUnit: 'mps',
    units: [
      { id: 'mps', name: '米/秒 m/s', factor: 1 },
      { id: 'kmh', name: '千米/时 km/h', factor: 1 / 3.6 },
      { id: 'mph', name: '英里/时 mph', factor: 0.44704 },
      { id: 'kn', name: '节 knot', factor: 0.51444444444444 },
      { id: 'fts', name: '英尺/秒 ft/s', factor: 0.3048 },
      { id: 'mach', name: '马赫', factor: 340.3 }
    ]
  },
  {
    id: 'time',
    name: '时间',
    icon: '⏱️',
    baseUnit: 's',
    units: [
      { id: 'ns', name: '纳秒 ns', factor: 1e-9 },
      { id: 'us', name: '微秒 μs', factor: 1e-6 },
      { id: 'ms', name: '毫秒 ms', factor: 0.001 },
      { id: 's', name: '秒 s', factor: 1 },
      { id: 'min', name: '分钟 min', factor: 60 },
      { id: 'h', name: '小时 h', factor: 3600 },
      { id: 'd', name: '天 day', factor: 86400 },
      { id: 'wk', name: '周 week', factor: 604800 },
      { id: 'mo', name: '月(30天)', factor: 2592000 },
      { id: 'yr', name: '年(365天)', factor: 31536000 },
      { id: 'yr_leap', name: '闰年(366天)', factor: 31622400 },
      { id: 'dec', name: '十年', factor: 315360000 },
      { id: 'cent', name: '世纪', factor: 3153600000 }
    ]
  },
  {
    id: 'data',
    name: '数据存储',
    icon: '💾',
    baseUnit: 'b',
    units: [
      { id: 'bit', name: '比特 bit', factor: 1 },
      { id: 'b', name: '字节 B', factor: 8 },
      { id: 'kb', name: '千字节 KB (二进制)', factor: 8 * 1024 },
      { id: 'mb', name: '兆字节 MB', factor: 8 * 1024 ** 2 },
      { id: 'gb', name: '吉字节 GB', factor: 8 * 1024 ** 3 },
      { id: 'tb', name: '太字节 TB', factor: 8 * 1024 ** 4 },
      { id: 'pb', name: '拍字节 PB', factor: 8 * 1024 ** 5 },
      { id: 'kb_dec', name: '千字节 KB (十进制)', factor: 8 * 1000 },
      { id: 'mb_dec', name: '兆字节 MB (十进制)', factor: 8 * 1000 ** 2 },
      { id: 'gb_dec', name: '吉字节 GB (十进制)', factor: 8 * 1000 ** 3 },
      { id: 'tb_dec', name: '太字节 TB (十进制)', factor: 8 * 1000 ** 4 },
      { id: 'kib', name: 'Kibit', factor: 1024 },
      { id: 'mib', name: 'Mibit', factor: 1024 ** 2 },
      { id: 'gib', name: 'Gibit', factor: 1024 ** 3 }
    ]
  },
  {
    id: 'pressure',
    name: '压力',
    icon: '🎈',
    baseUnit: 'pa',
    units: [
      { id: 'pa', name: '帕 Pa', factor: 1 },
      { id: 'kpa', name: '千帕 kPa', factor: 1000 },
      { id: 'mpa', name: '兆帕 MPa', factor: 1e6 },
      { id: 'bar', name: '巴 bar', factor: 1e5 },
      { id: 'mbar', name: '毫巴 mbar', factor: 100 },
      { id: 'atm', name: '标准大气压 atm', factor: 101325 },
      { id: 'mmhg', name: '毫米汞柱 mmHg', factor: 133.322387415 },
      { id: 'inhg', name: '英寸汞柱 inHg', factor: 3386.389 },
      { id: 'psi', name: '磅/平方英寸 psi', factor: 6894.757293168 },
      { id: 'torr', name: '托 torr', factor: 133.322368421 },
      { id: 'kgcm2', name: '千克力/平方厘米', factor: 98066.5 }
    ]
  },
  {
    id: 'angle',
    name: '角度',
    icon: '📐',
    baseUnit: 'rad',
    units: [
      { id: 'rad', name: '弧度 rad', factor: 1 },
      { id: 'deg', name: '度 °', factor: Math.PI / 180 },
      { id: 'grad', name: '梯度 grad', factor: Math.PI / 200 },
      { id: 'arcmin', name: '角分 ′', factor: Math.PI / 10800 },
      { id: 'arcsec', name: '角秒 ″', factor: Math.PI / 648000 },
      { id: 'rev', name: '转 rev', factor: 2 * Math.PI },
      { id: 'mil', name: '密位 mil', factor: 2 * Math.PI / 6400 }
    ]
  },
  {
    id: 'energy',
    name: '能量',
    icon: '⚡',
    baseUnit: 'j',
    units: [
      { id: 'j', name: '焦耳 J', factor: 1 },
      { id: 'kj', name: '千焦 kJ', factor: 1000 },
      { id: 'cal', name: '卡 cal', factor: 4.184 },
      { id: 'kcal', name: '千卡 kcal', factor: 4184 },
      { id: 'wh', name: '瓦时 Wh', factor: 3600 },
      { id: 'kwh', name: '千瓦时 kWh', factor: 3.6e6 },
      { id: 'mwh', name: '兆瓦时 MWh', factor: 3.6e9 },
      { id: 'ev', name: '电子伏特 eV', factor: 1.602176634e-19 },
      { id: 'btu', name: '英热单位 BTU', factor: 1055.05585262 },
      { id: 'ftlb', name: '英尺磅 ft·lb', factor: 1.3558179483314 },
      { id: 'erg', name: '尔格 erg', factor: 1e-7 },
      { id: 't_tnt', name: '吨TNT', factor: 4.184e9 }
    ]
  },
  {
    id: 'power',
    name: '功率',
    icon: '🔧',
    baseUnit: 'w',
    units: [
      { id: 'w', name: '瓦 W', factor: 1 },
      { id: 'kw', name: '千瓦 kW', factor: 1000 },
      { id: 'mw', name: '兆瓦 MW', factor: 1e6 },
      { id: 'gw', name: '吉瓦 GW', factor: 1e9 },
      { id: 'hp_m', name: '公制马力 PS', factor: 735.49875 },
      { id: 'hp_mech', name: '英制马力 hp', factor: 745.69987158227 },
      { id: 'fts', name: '英尺·磅/秒', factor: 1.3558179483314 },
      { id: 'btuh', name: 'BTU/时', factor: 0.29307107 },
      { id: 'cal_s', name: '卡/秒', factor: 4.184 },
      { id: 'erg_s', name: '尔格/秒', factor: 1e-7 }
    ]
  },
  {
    id: 'fuel',
    name: '油耗',
    icon: '⛽',
    baseUnit: 'l100km',
    units: [
      { id: 'l100km', name: '升/100km', toBase: v => v, fromBase: v => v },
      { id: 'mpg_us', name: 'mpg(美)', toBase: v => 235.214583 / v, fromBase: v => 235.214583 / v },
      { id: 'mpg_uk', name: 'mpg(英)', toBase: v => 282.4809363 / v, fromBase: v => 282.4809363 / v },
      { id: 'kmpl', name: '千米/升', toBase: v => 100 / v, fromBase: v => 100 / v },
      { id: 'l100mi', name: '升/100英里', toBase: v => v / 1.609344, fromBase: v => v * 1.609344 }
    ]
  },
  {
    id: 'frequency',
    name: '频率',
    icon: '📡',
    baseUnit: 'hz',
    units: [
      { id: 'hz', name: '赫兹 Hz', factor: 1 },
      { id: 'khz', name: '千赫 kHz', factor: 1000 },
      { id: 'mhz', name: '兆赫 MHz', factor: 1e6 },
      { id: 'ghz', name: '吉赫 GHz', factor: 1e9 },
      { id: 'thz', name: '太赫 THz', factor: 1e12 },
      { id: 'rpm', name: '转/分 RPM', factor: 1 / 60 },
      { id: 'deg_s', name: '度/秒', factor: 1 / 360 }
    ]
  },
  {
    id: 'digital',
    name: '进制',
    icon: '🔢',
    baseUnit: 'dec',
    units: [
      { id: 'bin', name: '二进制 BIN', toBase: v => parseInt(String(v), 2), fromBase: v => v.toString(2) },
      { id: 'oct', name: '八进制 OCT', toBase: v => parseInt(String(v), 8), fromBase: v => v.toString(8) },
      { id: 'dec', name: '十进制 DEC', toBase: v => Number(v), fromBase: v => String(v) },
      { id: 'hex', name: '十六进制 HEX', toBase: v => parseInt(String(v), 16), fromBase: v => v.toString(16).toUpperCase() }
    ]
  }
];

module.exports = { categories };
