// 轻量语法高亮引擎 - 基于正则，零依赖，脱网可用
// 思路：先转义 HTML → 用占位符保护 注释/字符串 → 高亮 关键字/数字/函数名 → 还原占位符
// 支持语言：javascript/typescript/python/java/c/go/rust/php/ruby/swift/kotlin
//           html/xml/css/sql/bash/shell/json/yaml/markdown

const KEYWORDS = {
  javascript: ['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','new','class','extends','super','this','typeof','instanceof','in','of','try','catch','finally','throw','async','await','yield','import','export','default','from','as','void','delete','null','undefined','true','false','static','get','set'],
  typescript: ['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','new','class','extends','super','this','typeof','instanceof','in','of','try','catch','finally','throw','async','await','yield','import','export','default','from','as','void','delete','null','undefined','true','false','static','get','set','interface','type','enum','namespace','public','private','protected','readonly','abstract','implements','declare','keyof','infer','is','never','unknown','any','string','number','boolean','object','symbol','bigint'],
  python: ['def','return','if','elif','else','for','while','break','continue','pass','class','import','from','as','try','except','finally','raise','with','lambda','yield','global','nonlocal','assert','del','in','is','not','and','or','None','True','False','self','cls','async','await','print','len','range','open'],
  java: ['public','private','protected','class','interface','extends','implements','return','if','else','for','while','do','switch','case','break','continue','new','this','super','try','catch','finally','throw','throws','import','package','static','final','void','int','long','double','float','char','boolean','String','true','false','null','abstract','synchronized','volatile','transient','native','enum'],
  c: ['int','long','short','char','float','double','void','unsigned','signed','const','static','extern','register','volatile','struct','union','enum','typedef','return','if','else','for','while','do','switch','case','break','continue','default','goto','sizeof','include','define','ifdef','ifndef','endif','NULL','true','false'],
  go: ['package','import','func','return','if','else','for','switch','case','default','break','continue','var','const','type','struct','interface','map','chan','range','go','defer','select','fallthrough','goto','break','nil','true','false','make','new','len','cap','append','copy','delete','panic','recover'],
  rust: ['fn','let','mut','const','static','return','if','else','for','while','loop','match','break','continue','struct','enum','trait','impl','pub','use','mod','as','in','ref','move','where','type','self','Self','super','crate','unsafe','async','await','dyn','true','false','None','Some','Ok','Err'],
  php: ['function','return','if','else','elseif','for','foreach','while','do','switch','case','break','continue','new','class','extends','implements','public','private','protected','static','final','abstract','try','catch','finally','throw','use','namespace','as','echo','print','isset','unset','empty','array','string','int','float','bool','null','true','false','this','self','parent'],
  ruby: ['def','end','return','if','elsif','else','unless','while','until','for','do','break','next','redo','retry','class','module','def','begin','rescue','ensure','raise','yield','require','require_relative','include','extend','attr_accessor','attr_reader','attr_writer','public','private','protected','self','super','nil','true','false','puts','print','p'],
  swift: ['func','let','var','return','if','else','for','while','switch','case','default','break','continue','class','struct','enum','protocol','extension','import','init','deinit','self','Self','super','override','static','final','open','public','private','fileprivate','internal','lazy','guard','defer','where','as','is','try','catch','throw','throws','rethrows','async','await','nil','true','false'],
  kotlin: ['fun','val','var','return','if','else','for','while','do','when','is','in','as','class','object','interface','enum','sealed','data','import','package','init','this','super','override','open','final','abstract','companion','object','companion','by','lazy','try','catch','finally','throw','throws','null','true','false','Unit','Nothing','Any','String','Int','Long','Double','Float','Boolean'],
  sql: ['SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','ALTER','DROP','INDEX','VIEW','JOIN','LEFT','RIGHT','INNER','OUTER','ON','GROUP','BY','HAVING','ORDER','ASC','DESC','LIMIT','OFFSET','DISTINCT','UNION','ALL','AS','AND','OR','NOT','IN','LIKE','BETWEEN','IS','NULL','COUNT','SUM','AVG','MIN','MAX','CASE','WHEN','THEN','ELSE','END','PRIMARY','KEY','FOREIGN','REFERENCES','DEFAULT','UNIQUE','CONSTRAINT','CHECK','EXISTS','TRIGGER','PROCEDURE','FUNCTION','RETURNS','BEGIN','COMMIT','ROLLBACK','TRANSACTION'],
};

// 注释与字符串规则（按语言）
const LEXER = {
  default: {
    lineComment: null,
    blockComment: null,
    strings: ['"', "'", '`'],
  },
  javascript: { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'", '`'] },
  typescript: { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'", '`'] },
  python: { lineComment: '#', blockComment: null, strings: ['"', "'"] },
  java: { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'"] },
  c: { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'"] },
  go: { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'", '`'] },
  rust: { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'"] },
  php: { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'"] },
  ruby: { lineComment: '#', blockComment: null, strings: ['"', "'"] },
  swift: { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'"] },
  kotlin: { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'"] },
  sql: { lineComment: '--', blockComment: ['/*', '*/'], strings: ["'", '"'] },
  bash: { lineComment: '#', blockComment: null, strings: ['"', "'"] },
  shell: { lineComment: '#', blockComment: null, strings: ['"', "'"] },
  json: { lineComment: null, blockComment: null, strings: ['"'] },
  yaml: { lineComment: '#', blockComment: null, strings: ['"', "'"] },
  css: { lineComment: null, blockComment: ['/*', '*/'], strings: ['"', "'"] },
  html: { lineComment: null, blockComment: ['<!--', '-->'], strings: ['"', "'"] },
  xml: { lineComment: null, blockComment: ['<!--', '-->'], strings: ['"', "'"] },
  markdown: { lineComment: null, blockComment: null, strings: ['`'] },
};

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 高亮代码，返回 HTML 字符串
 * @param {string} code
 * @param {string} language
 * @returns {string}
 */
function highlight(code, language = 'javascript') {
  const lang = (language || '').toLowerCase();
  const lex = LEXER[lang] || LEXER.default;
  const kws = KEYWORDS[lang] || [];
  const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1. 转义 HTML
  const text = escapeHtml(String(code || ''));

  // 2. 按优先级构造 token 模式：块注释 > 行注释 > 字符串 > 关键字 > 数字 > 函数名
  //    单次交替匹配，从根本上避免「字符串内的 // 被识别为注释」等优先级问题
  const alts = [];
  // 块注释
  if (lex.blockComment) {
    const [o, c] = lex.blockComment;
    alts.push({ cls: 'comment', re: reEsc(escapeHtml(o)) + '[\\s\\S]*?' + reEsc(escapeHtml(c)) });
  }
  // 行注释
  if (lex.lineComment) {
    alts.push({ cls: 'comment', re: reEsc(escapeHtml(lex.lineComment)) + '[^\\n]*' });
  }
  // 字符串
  for (const q of lex.strings) {
    const qe = reEsc(escapeHtml(q));
    const multiline = q === '`';
    alts.push({ cls: 'string', re: qe + '(?:\\\\.|[^\\\\' + qe + (multiline ? '' : '\\n') + '])*' + qe });
  }
  // 关键字
  if (kws.length) {
    const sorted = kws.slice().sort((a, b) => b.length - a.length);
    alts.push({ cls: 'keyword', re: '\\b(?:' + sorted.map(reEsc).join('|') + ')\\b' });
  }
  // 数字
  alts.push({ cls: 'number', re: '\\b\\d+\\.?\\d*(?:e[+-]?\\d+)?\\b' });
  // 函数名（后跟括号，用零宽断言不消耗括号）
  alts.push({ cls: 'fn', re: '[a-zA-Z_$][\\w$]*(?=\\s*\\()' });

  // 3. 合并为单一正则，按优先级交替匹配
  const combined = alts.map((a) => '(' + a.re + ')').join('|');
  const re = new RegExp(combined, 'gi');

  return text.replace(re, function () {
    for (let i = 0; i < alts.length; i++) {
      if (arguments[i + 1] !== undefined) {
        return '<span class="tok-' + alts[i].cls + '">' + arguments[i + 1] + '</span>';
      }
    }
    return arguments[0];
  });
}

/** 支持的语言列表 */
const SUPPORTED = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'sql', label: 'SQL' },
  { id: 'bash', label: 'Bash' },
  { id: 'shell', label: 'Shell' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'css', label: 'CSS' },
  { id: 'html', label: 'HTML' },
  { id: 'xml', label: 'XML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'text', label: '纯文本' },
];

// 兼容 Node 与浏览器环境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { highlight, SUPPORTED };
}
if (typeof window !== 'undefined') {
  window.SnippetHighlight = { highlight, SUPPORTED };
}
