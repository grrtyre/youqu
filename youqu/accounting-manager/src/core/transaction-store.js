// 记账数据存储引擎 - 读写本地 JSON 文件
// 数据结构：
// {
//   transactions: [
//     { id, type, amount, category, account, date, note, createdAt, updatedAt }
//   ],
//   categories: { expense: [...], income: [...] },
//   accounts: [...],
//   budgets: { "YYYY-MM": amount },
//   version: 1
// }

const fs = require('fs');
const path = require('path');
const { toDateKey, toMonthKey } = require('./date-utils');

// 默认支出分类（图标用 emoji，颜色用苹果系统色）
const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'e_food', name: '餐饮', icon: '🍜', color: '#ff9500' },
  { id: 'e_transport', name: '交通', icon: '🚇', color: '#5ac8fa' },
  { id: 'e_shopping', name: '购物', icon: '🛍️', color: '#ff2d55' },
  { id: 'e_housing', name: '住房', icon: '🏠', color: '#34c759' },
  { id: 'e_entertain', name: '娱乐', icon: '🎬', color: '#af52de' },
  { id: 'e_medical', name: '医疗', icon: '⚕️', color: '#ff3b30' },
  { id: 'e_education', name: '教育', icon: '📚', color: '#007aff' },
  { id: 'e_comm', name: '通讯', icon: '📱', color: '#5856d6' },
  { id: 'e_social', name: '人情', icon: '🎁', color: '#ffcc00' },
  { id: 'e_other', name: '其他', icon: '✏️', color: '#8e8e93' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { id: 'i_salary', name: '工资', icon: '💼', color: '#34c759' },
  { id: 'i_bonus', name: '奖金', icon: '🎉', color: '#ff9500' },
  { id: 'i_parttime', name: '兼职', icon: '🔧', color: '#5ac8fa' },
  { id: 'i_invest', name: '投资', icon: '📈', color: '#007aff' },
  { id: 'i_gift', name: '红包', icon: '🧧', color: '#ff3b30' },
  { id: 'i_other', name: '其他', icon: '✏️', color: '#8e8e93' },
];

const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: '现金', icon: '💵', color: '#ff9500' },
  { id: 'bank', name: '银行卡', icon: '🏦', color: '#007aff' },
  { id: 'alipay', name: '支付宝', icon: '📱', color: '#5ac8fa' },
  { id: 'wechat', name: '微信', icon: '💬', color: '#34c759' },
  { id: 'credit', name: '信用卡', icon: '💳', color: '#ff3b30' },
];

class AccountStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      transactions: [],
      categories: { expense: DEFAULT_EXPENSE_CATEGORIES, income: DEFAULT_INCOME_CATEGORIES },
      accounts: DEFAULT_ACCOUNTS,
      budgets: {},
      version: 1,
    };
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.transactions)) {
          // 合并默认值，保证字段完整
          this.data = {
            transactions: parsed.transactions,
            categories: {
              expense: (parsed.categories && parsed.categories.expense) || DEFAULT_EXPENSE_CATEGORIES,
              income: (parsed.categories && parsed.categories.income) || DEFAULT_INCOME_CATEGORIES,
            },
            accounts: parsed.accounts || DEFAULT_ACCOUNTS,
            budgets: parsed.budgets || {},
            version: 1,
          };
        }
      }
    } catch (e) {
      if (fs.existsSync(this.filePath)) {
        const bak = this.filePath + '.bak.' + Date.now();
        try { fs.copyFileSync(this.filePath, bak); } catch (_) {}
      }
      this.data = {
        transactions: [],
        categories: { expense: DEFAULT_EXPENSE_CATEGORIES, income: DEFAULT_INCOME_CATEGORIES },
        accounts: DEFAULT_ACCOUNTS,
        budgets: {},
        version: 1,
      };
    }
  }

  _save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  // ===== 交易 CRUD =====
  listTransactions(filter = {}) {
    let items = this.data.transactions.slice();
    if (filter.monthKey) {
      items = items.filter((t) => t.date.startsWith(filter.monthKey));
    }
    if (filter.type) {
      items = items.filter((t) => t.type === filter.type);
    }
    if (filter.categoryId) {
      items = items.filter((t) => t.categoryId === filter.categoryId);
    }
    if (filter.dateKey) {
      items = items.filter((t) => t.date === filter.dateKey);
    }
    // 按日期倒序，同日期按创建时间倒序
    items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1;
    });
    return items;
  }

  getTransaction(id) {
    return this.data.transactions.find((t) => t.id === id);
  }

  createTransaction(data = {}) {
    const amount = parseFloat(data.amount);
    if (!isFinite(amount) || amount <= 0) throw new Error('金额必须为正数');
    const type = ['expense', 'income'].includes(data.type) ? data.type : 'expense';
    const tx = {
      id: 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      type,
      amount: Math.round(amount * 100) / 100,
      categoryId: data.categoryId || (type === 'income' ? 'i_other' : 'e_other'),
      accountId: data.accountId || 'cash',
      date: data.date || toDateKey(new Date()),
      note: String(data.note || '').trim().slice(0, 200),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.transactions.push(tx);
    this._save();
    return tx;
  }

  // ===== 转账 =====
  // 转账是独立的交易类型：在两个账户之间转移资金，不计入收支统计，不影响预算。
  // 交易对象：{ id, type:'transfer', amount, fromAccountId, toAccountId, date, note, createdAt, updatedAt }
  createTransfer(data = {}) {
    const amount = parseFloat(data.amount);
    if (!isFinite(amount) || amount <= 0) throw new Error('转账金额必须为正数');
    const fromAccountId = data.fromAccountId;
    const toAccountId = data.toAccountId;
    if (!fromAccountId || !toAccountId) throw new Error('请选择转出账户与转入账户');
    if (fromAccountId === toAccountId) throw new Error('转出与转入账户不能相同');
    const tx = {
      id: 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      type: 'transfer',
      amount: Math.round(amount * 100) / 100,
      fromAccountId,
      toAccountId,
      date: data.date || toDateKey(new Date()),
      note: String(data.note || '').trim().slice(0, 200),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.transactions.push(tx);
    this._save();
    return tx;
  }

  updateTransaction(id, patch = {}) {
    const t = this.getTransaction(id);
    if (!t) return null;
    if (patch.type !== undefined && ['expense', 'income'].includes(patch.type)) t.type = patch.type;
    if (patch.amount !== undefined) {
      const amt = parseFloat(patch.amount);
      if (!isFinite(amt) || amt <= 0) throw new Error('金额必须为正数');
      t.amount = Math.round(amt * 100) / 100;
    }
    if (patch.categoryId !== undefined) t.categoryId = patch.categoryId;
    if (patch.accountId !== undefined) t.accountId = patch.accountId;
    // 转账字段更新（转出 / 转入账户，校验不能相同）
    if (patch.fromAccountId !== undefined) {
      t.fromAccountId = patch.fromAccountId;
      if (t.toAccountId && t.fromAccountId === t.toAccountId) throw new Error('转出与转入账户不能相同');
    }
    if (patch.toAccountId !== undefined) {
      t.toAccountId = patch.toAccountId;
      if (t.fromAccountId && t.fromAccountId === t.toAccountId) throw new Error('转出与转入账户不能相同');
    }
    if (patch.date !== undefined) t.date = patch.date;
    if (patch.note !== undefined) t.note = String(patch.note || '').trim().slice(0, 200);
    t.updatedAt = new Date().toISOString();
    this._save();
    return t;
  }

  removeTransaction(id) {
    const idx = this.data.transactions.findIndex((t) => t.id === id);
    if (idx >= 0) {
      const [removed] = this.data.transactions.splice(idx, 1);
      this._save();
      return removed;
    }
    return null;
  }

  // ===== 分类 =====
  listCategories(type) {
    if (type === 'expense') return this.data.categories.expense.slice();
    if (type === 'income') return this.data.categories.income.slice();
    return {
      expense: this.data.categories.expense.slice(),
      income: this.data.categories.income.slice(),
    };
  }

  addCategory(type, { name, icon = '✏️', color = '#8e8e93' }) {
    const list = type === 'income' ? this.data.categories.income : this.data.categories.expense;
    const id = (type === 'income' ? 'i_' : 'e_') + Date.now().toString(36);
    const cat = { id, name: String(name || '新分类').trim(), icon, color };
    list.push(cat);
    this._save();
    return cat;
  }

  removeCategory(id) {
    let removed = null;
    for (const type of ['expense', 'income']) {
      const list = this.data.categories[type];
      const idx = list.findIndex((c) => c.id === id);
      if (idx >= 0) {
        removed = list.splice(idx, 1)[0];
        break;
      }
    }
    if (removed) this._save();
    return removed;
  }

  // ===== 账户 =====
  listAccounts() {
    return this.data.accounts.slice();
  }

  // ===== 预算 =====
  getBudget(monthKey) {
    return this.data.budgets[monthKey] || 0;
  }

  setBudget(monthKey, amount) {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt < 0) throw new Error('预算必须为非负数');
    this.data.budgets[monthKey] = Math.round(amt * 100) / 100;
    this._save();
    return this.data.budgets[monthKey];
  }

  listBudgets() {
    return { ...this.data.budgets };
  }

  // ===== 导入导出 =====
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  importJSON(json) {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.transactions)) throw new Error('无效的导入数据');
    this.data = {
      transactions: parsed.transactions,
      categories: {
        expense: (parsed.categories && parsed.categories.expense) || DEFAULT_EXPENSE_CATEGORIES,
        income: (parsed.categories && parsed.categories.income) || DEFAULT_INCOME_CATEGORIES,
      },
      accounts: parsed.accounts || DEFAULT_ACCOUNTS,
      budgets: parsed.budgets || {},
      version: 1,
    };
    this._save();
    return this.data;
  }

  /** 清空所有用户数据（交易 + 预算），保留默认分类与账户 */
  clearAll() {
    this.data.transactions = [];
    this.data.budgets = {};
    this._save();
    return true;
  }

  /** 导出 CSV（适合 Excel） */
  exportCSV() {
    const cats = this.listCategories();
    const catMap = {};
    [...cats.expense, ...cats.income].forEach((c) => { catMap[c.id] = c.name; });
    const accounts = this.listAccounts();
    const accMap = {};
    accounts.forEach((a) => { accMap[a.id] = a.name; });
    const rows = [['日期', '类型', '分类', '账户', '金额', '备注']];
    const sorted = this.listTransactions();
    sorted.forEach((t) => {
      if (t.type === 'transfer') {
        // 转账：分类列显示「账户A → 账户B」，账户列留空
        const fromAcc = accMap[t.fromAccountId] || t.fromAccountId;
        const toAcc = accMap[t.toAccountId] || t.toAccountId;
        rows.push([
          t.date,
          '转账',
          `${fromAcc} → ${toAcc}`,
          '-',
          t.amount.toFixed(2),
          (t.note || '').replace(/[\r\n,]/g, ' '),
        ]);
      } else {
        rows.push([
          t.date,
          t.type === 'income' ? '收入' : '支出',
          catMap[t.categoryId] || t.categoryId,
          accMap[t.accountId] || t.accountId,
          t.amount.toFixed(2),
          (t.note || '').replace(/[\r\n,]/g, ' '),
        ]);
      }
    });
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  /** 写入示例数据（首次启动时） */
  seedSampleData() {
    if (this.data.transactions.length > 0) return false;
    const today = new Date();
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const dby = new Date(today); dby.setDate(today.getDate() - 2);
    const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 5);

    // 本月数据（分散到不同账户，让账户余额更真实）
    this.createTransaction({ type: 'expense', amount: 38.5, categoryId: 'e_food', accountId: 'wechat', date: toDateKey(today), note: '午餐外卖' });
    this.createTransaction({ type: 'expense', amount: 12, categoryId: 'e_transport', accountId: 'alipay', date: toDateKey(today), note: '地铁通勤' });
    this.createTransaction({ type: 'expense', amount: 89, categoryId: 'e_shopping', accountId: 'credit', date: toDateKey(yest), note: '日用品' });
    this.createTransaction({ type: 'expense', amount: 45, categoryId: 'e_entertain', accountId: 'wechat', date: toDateKey(yest), note: '电影票' });
    this.createTransaction({ type: 'income', amount: 8800, categoryId: 'i_salary', accountId: 'bank', date: toDateKey(dby), note: '本月工资' });
    this.createTransaction({ type: 'expense', amount: 2500, categoryId: 'e_housing', accountId: 'bank', date: toDateKey(dby), note: '房租' });
    this.createTransaction({ type: 'income', amount: 500, categoryId: 'i_parttime', accountId: 'alipay', date: toDateKey(dby), note: '兼职收入' });
    this.createTransaction({ type: 'expense', amount: 68, categoryId: 'e_food', accountId: 'cash', date: toDateKey(lastWeek), note: '聚餐' });
    this.createTransaction({ type: 'expense', amount: 199, categoryId: 'e_comm', accountId: 'wechat', date: toDateKey(lastWeek), note: '话费充值' });
    this.createTransaction({ type: 'income', amount: 200, categoryId: 'i_gift', accountId: 'cash', date: toDateKey(lastWeek), note: '生日红包' });
    // 示例转账：银行卡转一部分到支付宝作日常零用（不计入收支，仅移动资金）
    this.createTransfer({ amount: 1500, fromAccountId: 'bank', toAccountId: 'alipay', date: toDateKey(yest), note: '转入支付宝备用' });

    // 前 5 个月的历史数据（让趋势图饱满）
    const historyData = [
      { monthsAgo: 5, items: [
        { type: 'income', amount: 8800, categoryId: 'i_salary', note: '工资' },
        { type: 'expense', amount: 2500, categoryId: 'e_housing', note: '房租' },
        { type: 'expense', amount: 1200, categoryId: 'e_food', note: '日常餐饮' },
        { type: 'expense', amount: 380, categoryId: 'e_transport', note: '通勤' },
        { type: 'expense', amount: 560, categoryId: 'e_shopping', note: '生活用品' },
        { type: 'expense', amount: 220, categoryId: 'e_entertain', note: '娱乐' },
      ]},
      { monthsAgo: 4, items: [
        { type: 'income', amount: 8800, categoryId: 'i_salary', note: '工资' },
        { type: 'income', amount: 1500, categoryId: 'i_parttime', note: '兼职' },
        { type: 'expense', amount: 2500, categoryId: 'e_housing', note: '房租' },
        { type: 'expense', amount: 1380, categoryId: 'e_food', note: '日常餐饮' },
        { type: 'expense', amount: 420, categoryId: 'e_transport', note: '通勤' },
        { type: 'expense', amount: 1280, categoryId: 'e_shopping', note: '买衣服' },
        { type: 'expense', amount: 180, categoryId: 'e_medical', note: '感冒药' },
      ]},
      { monthsAgo: 3, items: [
        { type: 'income', amount: 8800, categoryId: 'i_salary', note: '工资' },
        { type: 'expense', amount: 2500, categoryId: 'e_housing', note: '房租' },
        { type: 'expense', amount: 1100, categoryId: 'e_food', note: '日常餐饮' },
        { type: 'expense', amount: 350, categoryId: 'e_transport', note: '通勤' },
        { type: 'expense', amount: 880, categoryId: 'e_entertain', note: '游戏充值' },
        { type: 'expense', amount: 320, categoryId: 'e_education', note: '买书' },
      ]},
      { monthsAgo: 2, items: [
        { type: 'income', amount: 8800, categoryId: 'i_salary', note: '工资' },
        { type: 'income', amount: 800, categoryId: 'i_bonus', note: '奖金' },
        { type: 'expense', amount: 2500, categoryId: 'e_housing', note: '房租' },
        { type: 'expense', amount: 1450, categoryId: 'e_food', note: '日常餐饮' },
        { type: 'expense', amount: 460, categoryId: 'e_transport', note: '通勤' },
        { type: 'expense', amount: 1680, categoryId: 'e_shopping', note: '电子产品' },
        { type: 'expense', amount: 280, categoryId: 'e_comm', note: '话费' },
        { type: 'expense', amount: 660, categoryId: 'e_social', note: '生日礼物' },
      ]},
      { monthsAgo: 1, items: [
        { type: 'income', amount: 8800, categoryId: 'i_salary', note: '工资' },
        { type: 'expense', amount: 2500, categoryId: 'e_housing', note: '房租' },
        { type: 'expense', amount: 1320, categoryId: 'e_food', note: '日常餐饮' },
        { type: 'expense', amount: 380, categoryId: 'e_transport', note: '通勤' },
        { type: 'expense', amount: 720, categoryId: 'e_shopping', note: '日用品' },
        { type: 'expense', amount: 199, categoryId: 'e_comm', note: '话费' },
        { type: 'expense', amount: 150, categoryId: 'e_medical', note: '体检' },
      ]},
    ];

    historyData.forEach((m) => {
      const d = new Date(today.getFullYear(), today.getMonth() - m.monthsAgo, 10);
      m.items.forEach((it) => {
        // 分散到月中几天
        const day = 5 + Math.floor(Math.random() * 20);
        const date = new Date(today.getFullYear(), today.getMonth() - m.monthsAgo, day);
        // 根据分类分配账户：让余额分布更真实
        let accId;
        if (it.type === 'income') {
          accId = it.categoryId === 'i_parttime' || it.categoryId === 'i_bonus' ? 'alipay' : 'bank';
        } else {
          // 支出按分类分配到不同账户
          const accMap = {
            e_housing: 'bank', e_food: 'wechat', e_transport: 'alipay',
            e_shopping: 'credit', e_entertain: 'wechat', e_comm: 'wechat',
            e_medical: 'cash', e_education: 'alipay', e_social: 'cash',
          };
          accId = accMap[it.categoryId] || 'wechat';
        }
        this.createTransaction({
          type: it.type,
          amount: it.amount,
          categoryId: it.categoryId,
          accountId: accId,
          date: toDateKey(date),
          note: it.note,
        });
      });
    });

    // 设置本月预算
    this.setBudget(toMonthKey(today), 5000);
    return true;
  }
}

module.exports = { AccountStore, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_ACCOUNTS };
