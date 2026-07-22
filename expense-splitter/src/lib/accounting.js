// 分账助手 - 核心账务逻辑（纯函数，无副作用，可独立测试）
// 所有金额内部以"分"为整数单位计算，避免浮点误差
// UMD：Node 用 require，浏览器用 window.Accounting

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Accounting = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

// ---------- 工具函数 ----------

// 生成唯一 id
function genId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// 元 -> 分（字符串/数字安全转换）
function yuanToFen(value) {
  const n = Number(value);
  if (!isFinite(n) || isNaN(n)) return 0;
  return Math.round(n * 100);
}

// 分 -> 元（保留两位小数字符串）
function fenToYuan(fen) {
  const n = Math.round(fen) / 100;
  return n.toFixed(2);
}

// 四舍五入到分
function roundFen(fen) {
  return Math.round(fen);
}

// ---------- 数据构造 ----------

function createGroup(name) {
  return {
    id: genId('grp'),
    name: name || '新分账',
    currency: '¥',
    members: [],
    expenses: [],
    settlements: [],
    createdAt: Date.now(),
  };
}

function createMember(group, name) {
  const member = {
    id: genId('mem'),
    name: name || '成员',
    color: pickColor(group.members.length),
  };
  group.members.push(member);
  return member;
}

// 苹果白风格的成员配色（柔和、低饱和）
const MEMBER_COLORS = [
  '#007aff', '#34c759', '#ff9500', '#af52de',
  '#ff2d55', '#5856d6', '#00c7be', '#ff3b30',
];
function pickColor(index) {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

// ---------- 费用分摊计算 ----------

// 计算单笔费用中每个成员应承担的份额（返回 {memberId: 分}）
// splitType:
//   'equal'   - 均摊（splits 为参与的 memberId 数组或留空=全部成员）
//   'share'   - 按份数（splits = {memberId: 份数}）
//   'exact'   - 指定金额（splits = {memberId: 分}）
//   'percent' - 按百分比（splits = {memberId: 百分比0-100}）
function computeShares(expense, group) {
  const amount = roundFen(expense.amount); // 分
  const type = expense.splitType || 'equal';
  let participants;
  if (type === 'equal') {
    // equal 模式：splits 可为参与成员 id 数组；为空则全体成员
    if (Array.isArray(expense.splits) && expense.splits.length > 0) {
      participants = expense.splits.slice();
    } else {
      participants = group.members.map((m) => m.id);
    }
    const result = {};
    if (participants.length === 0) return result;
    // 均摊，余数分给前几个人（保证总和等于 amount）
    const base = Math.floor(amount / participants.length);
    let remainder = amount - base * participants.length;
    for (const id of participants) {
      let v = base;
      if (remainder > 0) {
        v += 1;
        remainder -= 1;
      }
      result[id] = v;
    }
    return result;
  }

  if (type === 'share') {
    const result = {};
    const entries = Object.entries(expense.splits || {}).filter(([id, sh]) => sh > 0);
    const totalShares = entries.reduce((s, [, sh]) => s + sh, 0);
    if (totalShares <= 0) return result;
    let allocated = 0;
    // 先按比例分配并向下取整
    const provisional = entries.map(([id, sh]) => {
      const v = Math.floor((amount * sh) / totalShares);
      allocated += v;
      return [id, v];
    });
    // 余数按份数从大到小补齐
    let remainder = amount - allocated;
    const order = provisional
      .map(([id, v], i) => ({ id, v, sh: entries[i][1] }))
      .sort((a, b) => b.sh - a.sh);
    for (const item of order) {
      if (remainder <= 0) break;
      item.v += 1;
      remainder -= 1;
    }
    for (const item of order) result[item.id] = item.v;
    return result;
  }

  if (type === 'exact') {
    const result = {};
    for (const [id, v] of Object.entries(expense.splits || {})) {
      result[id] = roundFen(v);
    }
    return result;
  }

  if (type === 'percent') {
    const result = {};
    let allocated = 0;
    const entries = Object.entries(expense.splits || {}).filter(([, p]) => p > 0);
    const provisional = entries.map(([id, p]) => {
      const v = Math.floor((amount * p) / 100);
      allocated += v;
      return [id, v, p];
    });
    let remainder = amount - allocated;
    const order = provisional.slice().sort((a, b) => b[2] - a[2]);
    for (const item of order) {
      if (remainder <= 0) break;
      item[1] += 1;
      remainder -= 1;
    }
    for (const [id, v] of provisional) result[id] = v;
    return result;
  }

  return {};
}

// ---------- 余额计算 ----------

// 计算每个成员的净余额（分）：正值=别人欠TA，负值=TA欠别人
// 净余额 = 已付 - 应付
function computeBalances(group) {
  const balance = {};
  for (const m of group.members) balance[m.id] = 0;

  for (const exp of group.expenses) {
    const amount = roundFen(exp.amount);
    if (!balance.hasOwnProperty(exp.payerId)) continue;
    balance[exp.payerId] += amount; // 付款人先垫付，余额+
    const shares = computeShares(exp, group);
    for (const [id, v] of Object.entries(shares)) {
      if (balance.hasOwnProperty(id)) {
        balance[id] -= v; // 承担者余额-
      }
    }
  }

  // 结算记录：from 给 to 金额 -> from 余额+，to 余额-
  for (const st of group.settlements) {
    const amt = roundFen(st.amount);
    if (balance.hasOwnProperty(st.fromId)) balance[st.fromId] += amt;
    if (balance.hasOwnProperty(st.toId)) balance[st.toId] -= amt;
  }

  return balance;
}

// ---------- 债务简化（最小交易数结算） ----------

// 贪心算法：每次取最大债权人和最大债务人，结算较小的一方
// 返回 [{from, to, amount(分)}]，from 欠 to
function simplifyDebts(group) {
  const balance = computeBalances(group);
  const creditors = []; // 余额>0 [{id, amt}]
  const debtors = []; //  余额<0
  for (const [id, v] of Object.entries(balance)) {
    if (v > 0) creditors.push({ id, amt: v });
    else if (v < 0) debtors.push({ id, amt: -v });
  }

  const result = [];
  // 用副本避免修改原数组
  const cs = creditors.slice();
  const ds = debtors.slice();

  while (cs.length && ds.length) {
    cs.sort((a, b) => b.amt - a.amt);
    ds.sort((a, b) => b.amt - a.amt);
    const c = cs[0];
    const d = ds[0];
    const pay = Math.min(c.amt, d.amt);
    if (pay <= 0) break;
    result.push({ from: d.id, to: c.id, amount: pay });
    c.amt -= pay;
    d.amt -= pay;
    if (c.amt <= 0) cs.shift();
    if (d.amt <= 0) ds.shift();
  }
  return result;
}

// ---------- 操作函数（返回新 group，不可变风格） ----------

function addExpense(group, expenseData) {
  const exp = {
    id: genId('exp'),
    description: expenseData.description || '费用',
    amount: yuanToFen(expenseData.amount), // 元转分
    payerId: expenseData.payerId,
    date: expenseData.date || new Date().toISOString().slice(0, 10),
    splitType: expenseData.splitType || 'equal',
    splits: expenseData.splits || (expenseData.splitType === 'equal' ? null : {}),
    category: expenseData.category || 'general',
    createdAt: Date.now(),
  };
  const newGroup = shallowCloneGroup(group);
  newGroup.expenses.push(exp);
  return newGroup;
}

function addSettlement(group, data) {
  const st = {
    id: genId('set'),
    fromId: data.fromId,
    toId: data.toId,
    amount: yuanToFen(data.amount),
    date: data.date || new Date().toISOString().slice(0, 10),
    createdAt: Date.now(),
  };
  const newGroup = shallowCloneGroup(group);
  newGroup.settlements.push(st);
  return newGroup;
}

function addMember(group, name) {
  const newGroup = shallowCloneGroup(group);
  const member = {
    id: genId('mem'),
    name: name || '成员',
    color: pickColor(newGroup.members.length),
  };
  newGroup.members.push(member);
  return newGroup;
}

function removeExpense(group, expenseId) {
  const newGroup = shallowCloneGroup(group);
  newGroup.expenses = newGroup.expenses.filter((e) => e.id !== expenseId);
  return newGroup;
}

function shallowCloneGroup(group) {
  return {
    ...group,
    members: group.members.slice(),
    expenses: group.expenses.slice(),
    settlements: group.settlements.slice(),
  };
}

// 统计：总支出、人均、笔数
function computeStats(group) {
  const total = group.expenses.reduce((s, e) => s + roundFen(e.amount), 0);
  const count = group.expenses.length;
  const memberCount = group.members.length;
  const perPerson = memberCount > 0 ? Math.round(total / memberCount) : 0;
  return { total, count, memberCount, perPerson };
}

return {
  genId,
  yuanToFen,
  fenToYuan,
  roundFen,
  createGroup,
  createMember,
  addMember,
  computeShares,
  computeBalances,
  simplifyDebts,
  addExpense,
  addSettlement,
  removeExpense,
  computeStats,
  MEMBER_COLORS,
};

}); // end UMD factory
