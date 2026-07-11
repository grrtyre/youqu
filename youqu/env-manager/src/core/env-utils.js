// env-utils.js - 环境变量处理纯函数（可测试，无副作用）
// 所有函数不依赖 Node API，可在 Node 测试环境直接运行

'use strict';

/**
 * 解析 `reg query` 命令的输出，提取环境变量列表
 * 输出示例：
 *   (空行)
 *   HKEY_CURRENT_USER\Environment
 *       Path    REG_EXPAND_SZ    C:\Windows\System32;C:\Windows
 *       TEMP    REG_SZ    %USERPROFILE%\AppData\Local\Temp
 *   (空行)
 * 对于空值也兼容：
 *       EMPTYVAR    REG_SZ
 * @param {string} output - reg query 原始输出
 * @returns {Array<{name:string,type:string,value:string}>}
 */
function parseRegOutput(output) {
  if (!output) return [];
  const lines = output.split(/\r?\n/);
  const result = [];
  let headerPassed = false;
  for (const line of lines) {
    // 注册表根键行作为表头标志
    if (/^HKEY_/i.test(line.trim())) {
      headerPassed = true;
      continue;
    }
    if (!headerPassed) continue;
    // 数据行：前导空白 + 名称 + 类型 + 可选值
    // 兼容带值和不带值两种情况
    const m = line.match(/^\s+(\S+)\s+(REG_\S+)(?:\s+(.*))?$/);
    if (m) {
      result.push({
        name: m[1],
        type: m[2],
        value: m[3] !== undefined ? m[3] : ''
      });
    }
  }
  return result;
}

/**
 * 将 PATH 变量值拆分为路径数组
 * Windows 用分号分隔，空段保留以便察觉拼写错误
 * @param {string} value
 * @returns {string[]}
 */
function parsePathValue(value) {
  if (!value) return [];
  return value.split(';');
}

/**
 * 将路径数组序列化为 PATH 变量值
 * 不产生末尾分隔符
 * @param {string[]} paths
 * @returns {string}
 */
function serializePathValue(paths) {
  if (!Array.isArray(paths)) return '';
  return paths.filter((p) => p !== undefined && p !== null).join(';');
}

/**
 * 过滤环境变量（按名称或值，不区分大小写）
 * @param {Array<{name:string,value:string}>} vars
 * @param {string} query
 * @returns {Array}
 */
function filterEnvVars(vars, query) {
  if (!query) return vars.slice();
  const q = String(query).toLowerCase();
  return vars.filter((v) => {
    const n = String(v.name || '').toLowerCase();
    const val = String(v.value || '').toLowerCase();
    return n.indexOf(q) !== -1 || val.indexOf(q) !== -1;
  });
}

/**
 * 校验 Windows 环境变量名合法性
 * 规则：非空，仅含字母、数字、下划线、$、()，不能以数字开头（更严格）
 * 允许：A-Z a-z 0-9 _ ( ) $ - . （Windows 实际较宽松，此处取实用范围）
 * @param {string} name
 * @returns {{valid:boolean, reason?:string}}
 */
function validateVarName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, reason: '名称不能为空' };
  }
  if (name.length > 255) {
    return { valid: false, reason: '名称过长（>255）' };
  }
  if (/^\d/.test(name)) {
    return { valid: false, reason: '名称不能以数字开头' };
  }
  // 禁止空白和特殊控制字符
  if (/\s/.test(name)) {
    return { valid: false, reason: '名称不能包含空白字符' };
  }
  if (!/^[A-Za-z0-9_().$\-]+$/.test(name)) {
    return { valid: false, reason: '仅允许字母、数字、_ () . $ -' };
  }
  return { valid: true };
}

/**
 * 计算两组环境变量的差异
 * @param {Array<{name:string,value:string}>} before
 * @param {Array<{name:string,value:string}>} after
 * @returns {{added:string[],removed:string[],modified:string[]}}
 */
function diffEnvVars(before, after) {
  const beforeMap = new Map((before || []).map((v) => [v.name, v.value]));
  const afterMap = new Map((after || []).map((v) => [v.name, v.value]));
  const added = [];
  const removed = [];
  const modified = [];
  for (const [name, value] of afterMap.entries()) {
    if (!beforeMap.has(name)) added.push(name);
    else if (beforeMap.get(name) !== value) modified.push(name);
  }
  for (const [name] of beforeMap.entries()) {
    if (!afterMap.has(name)) removed.push(name);
  }
  // 按字母序输出，便于断言
  added.sort((a, b) => a.localeCompare(b));
  removed.sort((a, b) => a.localeCompare(b));
  modified.sort((a, b) => a.localeCompare(b));
  return { added, removed, modified };
}

/**
 * 判断变量值是否应使用 REG_EXPAND_SZ 类型
 * 当值包含 %VAR% 形式的引用时，使用 ExpandString
 * @param {string} value
 * @returns {boolean}
 */
function shouldUseExpandType(value) {
  return /%[A-Za-z0-9_().$\-]+%/.test(value || '');
}

/**
 * 生成备份 JSON 内容
 * @param {{user:Array,system:Array}} data
 * @returns {string} 格式化 JSON
 */
function buildBackupJson(data) {
  const payload = {
    app: 'env-manager',
    version: 1,
    exportedAt: new Date().toISOString(),
    user: (data.user || []).map((v) => ({ name: v.name, type: v.type, value: v.value })),
    system: (data.system || []).map((v) => ({ name: v.name, type: v.type, value: v.value }))
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * 解析备份 JSON
 * @param {string} jsonText
 * @returns {{user:Array,system:Array}}
 */
function parseBackupJson(jsonText) {
  const obj = JSON.parse(jsonText);
  if (!obj || typeof obj !== 'object') {
    throw new Error('备份文件格式无效');
  }
  const user = Array.isArray(obj.user) ? obj.user : [];
  const system = Array.isArray(obj.system) ? obj.system : [];
  return {
    user: user.map((v) => ({
      name: String(v.name),
      type: v.type === 'REG_EXPAND_SZ' ? 'REG_EXPAND_SZ' : 'REG_SZ',
      value: String(v.value || '')
    })),
    system: system.map((v) => ({
      name: String(v.name),
      type: v.type === 'REG_EXPAND_SZ' ? 'REG_EXPAND_SZ' : 'REG_SZ',
      value: String(v.value || '')
    }))
  };
}

/**
 * 对环境变量按名称排序（不区分大小写）
 * @param {Array<{name:string}>} vars
 * @returns {Array} 新数组
 */
function sortEnvVars(vars) {
  return vars.slice().sort((a, b) => {
    const n1 = String(a.name || '').toLowerCase();
    const n2 = String(b.name || '').toLowerCase();
    if (n1 < n2) return -1;
    if (n1 > n2) return 1;
    return 0;
  });
}

/**
 * 截断长值用于表格显示
 * @param {string} value
 * @param {number} max
 * @returns {string}
 */
function truncateValue(value, max) {
  const v = String(value || '');
  const m = max || 80;
  if (v.length <= m) return v;
  return v.slice(0, m) + '…';
}

module.exports = {
  parseRegOutput,
  parsePathValue,
  serializePathValue,
  filterEnvVars,
  validateVarName,
  diffEnvVars,
  shouldUseExpandType,
  buildBackupJson,
  parseBackupJson,
  sortEnvVars,
  truncateValue
};
