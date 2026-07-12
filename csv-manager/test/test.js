'use strict';

// 表格管家核心逻辑测试
// 运行：node test/test.js

const csv = require('../src/core/csv-core');
let pass = 0;
let fail = 0;

function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else {
    fail++;
    console.log('  ✗ ' + msg);
    console.log('    期望: ' + e);
    console.log('    实际: ' + a);
  }
}

console.log('\n=== 表格管家核心测试 ===\n');

// ---------- 分隔符检测 ----------
console.log('[detectDelimiter]');
eq(csv.detectDelimiter('a,b,c\n1,2,3\n4,5,6'), ',', '逗号');
eq(csv.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t', '制表符');
eq(csv.detectDelimiter('a;b;c\n1;2;3'), ';', '分号');
eq(csv.detectDelimiter('a|b|c\n1|2|3'), '|', '竖线');

// ---------- 解析 ----------
console.log('[parseCSV]');
(function () {
  const r = csv.parseCSV('姓名,年龄,城市\n张三,28,北京\n李四,35,上海');
  eq(r.headers, ['姓名', '年龄', '城市'], '表头');
  eq(r.rows, [['张三', '28', '北京'], ['李四', '35', '上海']], '数据行');
  eq(r.delimiter, ',', '分隔符');
})();

// 引号包裹 + 内嵌分隔符
(function () {
  const r = csv.parseCSV('name,desc\n"张三","你好,世界"\n"李四","他说""嗨"""');
  eq(r.rows[0], ['张三', '你好,世界'], '引号内逗号');
  eq(r.rows[1], ['李四', '他说"嗨"'], '转义双引号');
})();

// 引号内换行
(function () {
  const r = csv.parseCSV('a,b\n"x\ny",z\n1,2');
  eq(r.rows.length, 2, '引号内换行行数');
  eq(r.rows[0], ['x\ny', 'z'], '引号内换行内容');
})();

// TSV
(function () {
  const r = csv.parseCSV('a\tb\tc\n1\t2\t3');
  eq(r.headers, ['a', 'b', 'c'], 'TSV 表头');
  eq(r.rows[0], ['1', '2', '3'], 'TSV 行');
})();

// 列数补齐
(function () {
  const r = csv.parseCSV('a,b,c\n1,2\n1,2,3,4');
  eq(r.rows[0], ['1', '2', ''], '短行补空');
  eq(r.rows[1].length, 3, '长行截断');
})();

// 无表头
(function () {
  const r = csv.parseCSV('1,2,3\n4,5,6', { hasHeader: false });
  eq(r.headers, ['列 1', '列 2', '列 3'], '无表头默认列名');
  eq(r.rows[0], ['1', '2', '3'], '无表头数据');
})();

// 空表头补列名
(function () {
  const r = csv.parseCSV('a,,c\n1,2,3');
  eq(r.headers, ['a', '列 2', 'c'], '空表头补列名');
})();

// ---------- 列分析 ----------
console.log('[analyzeColumns]');
(function () {
  const headers = ['姓名', '年龄', '入职日期', '城市'];
  const rows = [
    ['张三', '28', '2020-01-15', '北京'],
    ['李四', '35', '2019-06-20', '上海'],
    ['王五', '42', '2018-11-01', '广州']
  ];
  const info = csv.analyzeColumns(headers, rows);
  eq(info[0].type, 'text', '姓名列类型');
  eq(info[1].type, 'number', '年龄列类型');
  eq(info[1].stats.sum, 105, '年龄总和');
  eq(info[1].stats.avg, 35, '年龄平均');
  eq(info[1].stats.min, 28, '年龄最小');
  eq(info[1].stats.max, 42, '年龄最大');
  eq(info[2].type, 'date', '日期列类型');
})();

// ---------- 过滤 ----------
console.log('[filterRows]');
(function () {
  const rows = [['张三', '28'], ['李四', '35'], ['王五', '42']];
  eq(csv.filterRows(rows, '张'), [0], '搜索张');
  eq(csv.filterRows(rows, ''), [0, 1, 2], '空查询全选');
  eq(csv.filterRows(rows, '3'), [1], '搜索3匹配35');
  eq(csv.filterRows(rows, 'xyz'), [], '无匹配');
})();

// ---------- 排序 ----------
console.log('[sortRows]');
(function () {
  const rows = [['张三', '28'], ['李四', '35'], ['王五', '42']];
  const asc = csv.sortRows(rows, 1, 'asc');
  eq(asc.map(r => r[0]), ['张三', '李四', '王五'], '数值升序');
  const desc = csv.sortRows(rows, 1, 'desc');
  eq(desc.map(r => r[0]), ['王五', '李四', '张三'], '数值降序');
  const byName = csv.sortRows([['李', '1'], ['阿', '2'], ['周', '3']], 0, 'asc');
  eq(byName.map(r => r[0]), ['阿', '李', '周'], '中文升序');
  // 空值排末尾
  const withEmpty = [['a', ''], ['b', '2'], ['c', '1']];
  const sortedEmpty = csv.sortRows(withEmpty, 1, 'asc');
  eq(sortedEmpty[2][0], 'a', '空值排末尾');
})();

// ---------- 序列化 ----------
console.log('[toCSV]');
(function () {
  const headers = ['a', 'b'];
  const rows = [['1', 'x,y'], ['2', 'he said "hi"']];
  const out = csv.toCSV(headers, rows, ',');
  eq(out, 'a,b\n1,"x,y"\n2,"he said ""hi"""', 'CSV 序列化');
})();

(function () {
  const headers = ['a', 'b'];
  const rows = [['1', 'x\ty'], ['2', 'z']];
  const out = csv.toCSV(headers, rows, '\t');
  // 字段含分隔符必须包裹，符合 RFC 4180
  eq(out, 'a\tb\n1\t"x\ty"\n2\tz', 'TSV 序列化（含分隔符的字段需包裹）');
})();

// ---------- toJSON ----------
console.log('[toJSON]');
(function () {
  const headers = ['name', 'age'];
  const rows = [['张三', '28'], ['李四', '35']];
  const out = csv.toJSON(headers, rows);
  eq(out, [{ name: '张三', age: '28' }, { name: '李四', age: '35' }], '转 JSON');
})();

// ---------- toMarkdown ----------
console.log('[toMarkdown]');
(function () {
  const headers = ['name', 'age'];
  const rows = [['张三', '28']];
  const out = csv.toMarkdown(headers, rows);
  eq(out, '| name | age |\n| --- | --- |\n| 张三 | 28 |', '转 Markdown');
})();

// ---------- 直方图 ----------
console.log('[histogram]');
(function () {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const h = csv.histogram(values, 2);
  eq(h.length, 2, '两桶');
  eq(h[0].count + h[1].count, 10, '总计数');
  eq(csv.histogram([5], 10), [{ from: 5, to: 5, count: 1 }], '单值');
})();

// ---------- numericSeries ----------
console.log('[numericSeries]');
(function () {
  const rows = [['a', '1'], ['b', 'x'], ['c', '3']];
  const s = csv.numericSeries(rows, 1);
  eq(s, [1, 3], '只取数值');
})();

// ---------- valueCounts ----------
console.log('[valueCounts]');
(function () {
  const rows = [
    ['北京'], ['上海'], ['北京'], ['广州'], ['北京'], ['上海'], [''], ['深圳']
  ];
  const vc = csv.valueCounts(rows, 0);
  eq(vc.length, 4, '去重计数');
  eq(vc[0], { value: '北京', count: 3 }, '按计数降序首位');
  eq(vc[1], { value: '上海', count: 2 }, '第二位');
  // 空值不计入
  eq(vc.filter(function (x) { return x.value === ''; }).length, 0, '空值被忽略');
  // limit 截断
  const vc2 = csv.valueCounts(rows, 0, 2);
  eq(vc2.length, 2, 'limit 截断');
  // 空数据
  eq(csv.valueCounts([], 0), [], '空数据返回空数组');
})();

console.log('\n--------------------------------');
console.log('通过: ' + pass + '  失败: ' + fail);
console.log('--------------------------------\n');
process.exit(fail === 0 ? 0 : 1);
