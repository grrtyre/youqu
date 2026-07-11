// 正则管家 - 常用正则模式库
// 提供常见场景的正则模板，方便用户快速使用

'use strict';

const PATTERNS = [
  {
    category: '邮箱与网址',
    items: [
      {
        name: '邮箱地址',
        pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        flags: 'g',
        description: '匹配标准邮箱地址格式',
        example: '联系我：test@example.com 或 admin@site.org'
      },
      {
        name: 'URL 链接',
        pattern: 'https?://[\\w\\-]+(\\.[\\w\\-]+)+([\\w.,@?^=%&:/~+#-]*[\\w@?^=%&/~+#-])?',
        flags: 'g',
        description: '匹配 http/https 网址',
        example: '访问 https://www.example.com/path?q=1 获取详情'
      },
      {
        name: '域名',
        pattern: '\\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}\\b',
        flags: 'g',
        description: '匹配标准域名',
        example: 'api.example.com 和 sub.domain.co.uk'
      }
    ]
  },
  {
    category: '网络与 IP',
    items: [
      {
        name: 'IPv4 地址',
        pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b',
        flags: 'g',
        description: '匹配合法的 IPv4 地址',
        example: '服务器：192.168.1.1 和 10.0.0.255，无效：999.1.1.1'
      },
      {
        name: 'MAC 地址',
        pattern: '\\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\\b',
        flags: 'g',
        description: '匹配网卡 MAC 地址',
        example: 'MAC: 00:1A:2B:3C:4D:5E 或 AA-BB-CC-DD-EE-FF'
      },
      {
        name: '端口号',
        pattern: '\\b(?:[1-9]\\d{0,3}|[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])\\b',
        flags: 'g',
        description: '匹配 1-65535 范围的端口号',
        example: '端口：80 443 8080 65535，无效：0 99999'
      }
    ]
  },
  {
    category: '手机与证件',
    items: [
      {
        name: '手机号（中国大陆）',
        pattern: '1[3-9]\\d{9}',
        flags: 'g',
        description: '匹配中国大陆 11 位手机号',
        example: '电话：13812345678，无效：12345678901'
      },
      {
        name: '固定电话',
        pattern: '\\b0\\d{2,3}-?\\d{7,8}\\b',
        flags: 'g',
        description: '匹配带区号的固定电话',
        example: '座机：010-12345678 或 02187654321'
      },
      {
        name: '身份证号',
        pattern: '\\b[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]\\b',
        flags: 'g',
        description: '匹配 18 位身份证号（含校验位 X）',
        example: '身份证：110101199003071234 或 11010119900307123X'
      },
      {
        name: '邮政编码',
        pattern: '\\b[1-9]\\d{5}\\b',
        flags: 'g',
        description: '匹配中国 6 位邮政编码',
        example: '邮编：100000 和 518000'
      }
    ]
  },
  {
    category: '数字与金额',
    items: [
      {
        name: '整数',
        pattern: '-?\\b\\d+\\b',
        flags: 'g',
        description: '匹配正负整数',
        example: '数量：42 -7 0 1024'
      },
      {
        name: '小数',
        pattern: '-?\\b\\d+\\.\\d+\\b',
        flags: 'g',
        description: '匹配浮点数',
        example: '价格：3.14 -0.5 99.99'
      },
      {
        name: '货币金额',
        pattern: '(?:￥|¥|\\$)\\s?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?',
        flags: 'g',
        description: '匹配带货币符号的金额',
        example: '总价：￥1,299.00 和 $99.99'
      },
      {
        name: '科学计数法',
        pattern: '-?\\d+(?:\\.\\d+)?[eE][+-]?\\d+',
        flags: 'g',
        description: '匹配科学计数法数字',
        example: '数值：1.6e-19 和 3E8'
      }
    ]
  },
  {
    category: '日期与时间',
    items: [
      {
        name: '日期 YYYY-MM-DD',
        pattern: '\\b\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}\\b',
        flags: 'g',
        description: '匹配年月日格式',
        example: '日期：2026-07-12 和 2026/7/12'
      },
      {
        name: '时间 HH:MM:SS',
        pattern: '\\b([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)\\b',
        flags: 'g',
        description: '匹配 24 小时制时间',
        example: '时间：14:30:00 和 23:59:59'
      },
      {
        name: 'ISO 8601 时间',
        pattern: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?',
        flags: 'g',
        description: '匹配 ISO 8601 标准时间',
        example: '时间戳：2026-07-12T14:30:00.000Z'
      }
    ]
  },
  {
    category: '编程与编码',
    items: [
      {
        name: '十六进制颜色',
        pattern: '#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\\b',
        flags: 'g',
        description: '匹配 CSS 颜色值（3/6/8 位）',
        example: '颜色：#fff #007AFF #FF5733AA'
      },
      {
        name: 'UUID',
        pattern: '\\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\\b',
        flags: 'g',
        description: '匹配标准 UUID',
        example: 'ID：550e8400-e29b-41d4-a716-446655440000'
      },
      {
        name: 'HTML 标签',
        pattern: '</?[a-zA-Z][a-zA-Z0-9]*(?:\\s[^>]*)?>',
        flags: 'g',
        description: '匹配 HTML 标签',
        example: '<div class="box">内容</div>'
      },
      {
        name: 'JSON 键名',
        pattern: '"([^"]+)"\\s*:',
        flags: 'g',
        description: '提取 JSON 中的键名',
        example: '{"name": "张三", "age": 25}'
      },
      {
        name: 'Base64 字符串',
        pattern: '\\b[A-Za-z0-9+/]{16,}={0,2}\\b',
        flags: 'g',
        description: '匹配 Base64 编码串',
        example: '编码：SGVsbG8gV29ybGQ= 和 dGVzdA=='
      }
    ]
  },
  {
    category: '文本处理',
    items: [
      {
        name: '中文汉字',
        pattern: '[\\u4e00-\\u9fff]+',
        flags: 'g',
        description: '匹配所有中文汉字',
        example: 'Hello 世界，你好 world'
      },
      {
        name: '英文单词',
        pattern: '\\b[a-zA-Z]+\\b',
        flags: 'g',
        description: '匹配英文单词',
        example: 'Hello 世界 beautiful 好'
      },
      {
        name: '空白行',
        pattern: '^\\s*$',
        flags: 'gm',
        description: '匹配空行（用于清理文本）',
        example: '第一行\n\n第三行\n\n第五行'
      },
      {
        name: '连续空格',
        pattern: ' {2,}',
        flags: 'g',
        description: '匹配两个及以上连续空格',
        example: '文本  有   多余    空格'
      }
    ]
  }
];

module.exports = { PATTERNS };
