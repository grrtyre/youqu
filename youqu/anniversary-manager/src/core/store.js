// 纪念日数据存储（JSON 文件本地持久化）
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AnniversaryStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.events = [];
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        this.events = Array.isArray(data.events) ? data.events : [];
      }
    } catch (e) {
      this.events = [];
    }
  }

  _save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify({ events: this.events }, null, 2), 'utf-8');
  }

  _newId() {
    return 'evt_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
  }

  list() {
    return this.events.map((e) => ({ ...e }));
  }

  get(id) {
    const e = this.events.find((x) => x.id === id);
    return e ? { ...e } : null;
  }

  create(data) {
    const evt = this._validate(data);
    evt.id = this._newId();
    evt.createdAt = Date.now();
    evt.updatedAt = Date.now();
    this.events.push(evt);
    this._save();
    return { ...evt };
  }

  update(id, patch) {
    const idx = this.events.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error('事件不存在: ' + id);
    const merged = { ...this.events[idx], ...patch };
    const validated = this._validate(merged);
    validated.id = id;
    validated.createdAt = this.events[idx].createdAt;
    validated.updatedAt = Date.now();
    this.events[idx] = validated;
    this._save();
    return { ...validated };
  }

  remove(id) {
    const idx = this.events.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    this.events.splice(idx, 1);
    this._save();
    return true;
  }

  _validate(data) {
    if (!data || typeof data !== 'object') throw new Error('数据无效');
    if (!data.name || !String(data.name).trim()) throw new Error('名称不能为空');
    if (!data.date) throw new Error('日期不能为空');
    const evt = {
      name: String(data.name).trim().slice(0, 50),
      eventType: ['birthday', 'anniversary', 'memorial', 'custom'].includes(data.eventType)
        ? data.eventType
        : 'custom',
      category: ['family', 'friend', 'colleague', 'other'].includes(data.category)
        ? data.category
        : 'other',
      dateType: data.dateType === 'lunar' ? 'lunar' : 'solar',
      date: String(data.date),
      isLeap: !!data.isLeap,
      relationship: data.relationship ? String(data.relationship).slice(0, 30) : '',
      notes: data.notes ? String(data.notes).slice(0, 500) : '',
      color: data.color || '#007aff',
    };
    // 日期格式校验
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(evt.date)) {
      throw new Error('日期格式应为 YYYY-MM-DD');
    }
    return evt;
  }

  exportJSON() {
    return JSON.stringify({ events: this.events, exportedAt: new Date().toISOString() }, null, 2);
  }

  importJSON(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data.events)) throw new Error('导入文件格式错误：缺少 events 数组');
    let count = 0;
    for (const raw of data.events) {
      try {
        const evt = this._validate(raw);
        evt.id = raw.id || this._newId();
        evt.createdAt = raw.createdAt || Date.now();
        evt.updatedAt = Date.now();
        if (!this.events.find((x) => x.id === evt.id)) {
          this.events.push(evt);
          count++;
        }
      } catch (e) {
        // 跳过无效条目
      }
    }
    this._save();
    return { imported: count, total: this.events.length };
  }

  // 写入示例数据（首次启动）
  seedDemo() {
    if (this.events.length > 0) return false;
    // 动态生成一个"3 天后"的生日，让截图展示 urgent 高亮态
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    const soonStr = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    const soonYear = soon.getFullYear() - 28;
    const soonDate = `${soonYear}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    const demos = [
      { name: '小雅', eventType: 'birthday', category: 'friend', dateType: 'solar', date: soonDate, relationship: '闺蜜', notes: '记得挑她喜欢的礼物' },
      { name: '妈妈', eventType: 'birthday', category: 'family', dateType: 'lunar', date: '1965-08-15', relationship: '母亲', notes: '记得提前订蛋糕' },
      { name: '结婚纪念日', eventType: 'anniversary', category: 'family', dateType: 'solar', date: '2018-10-03', relationship: '相爱相伴', notes: '结婚登记日' },
      { name: '老张', eventType: 'birthday', category: 'friend', dateType: 'solar', date: '1990-06-20', relationship: '大学室友' },
      { name: '爸爸', eventType: 'birthday', category: 'family', dateType: 'lunar', date: '1962-12-08', relationship: '父亲' },
      { name: '女儿', eventType: 'birthday', category: 'family', dateType: 'solar', date: '2020-05-12', relationship: '宝贝' },
    ];
    for (const d of demos) {
      const evt = this._validate(d);
      evt.id = this._newId();
      evt.createdAt = Date.now();
      evt.updatedAt = Date.now();
      this.events.push(evt);
    }
    this._save();
    return true;
  }
}

module.exports = { AnniversaryStore };
