'use strict';

// API管家 · 本地存储层
// 管理请求集合（文件夹+请求）、历史记录、环境变量
// 纯 Node 实现，使用 userData 目录持久化（Electron 提供 path，测试时用临时目录）

const fs = require('fs');
const path = require('path');

const DEFAULT_ENV = {
  active: 'default',
  environments: [
    {
      id: 'default',
      name: '默认环境',
      variables: [
        { key: 'baseUrl', value: 'https://httpbin.org', enabled: true }
      ]
    }
  ]
};

function defaultData() {
  return {
    collections: [
      {
        id: genId(),
        name: 'httpbin 演示',
        expanded: true,
        items: [
          {
            id: genId(),
            type: 'request',
            name: '获取本机 IP',
            request: {
              method: 'GET',
              url: '{{baseUrl}}/ip',
              params: [],
              headers: [],
              body: { type: 'none', raw: '', form: [] },
              auth: { type: 'none' }
            }
          },
          {
            id: genId(),
            type: 'request',
            name: '查询 User-Agent',
            request: {
              method: 'GET',
              url: '{{baseUrl}}/user-agent',
              params: [],
              headers: [],
              body: { type: 'none', raw: '', form: [] },
              auth: { type: 'none' }
            }
          },
          {
            id: genId(),
            type: 'request',
            name: '提交 JSON 数据',
            request: {
              method: 'POST',
              url: '{{baseUrl}}/post',
              params: [],
              headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
              body: { type: 'json', raw: '{\n  "hello": "world",\n  "n": 42\n}', form: [] },
              auth: { type: 'none' }
            }
          },
          {
            id: genId(),
            type: 'request',
            name: '带 Token 认证',
            request: {
              method: 'GET',
              url: '{{baseUrl}}/bearer',
              params: [],
              headers: [],
              body: { type: 'none', raw: '', form: [] },
              auth: { type: 'bearer', token: 'my-secret-token' }
            }
          },
          {
            id: genId(),
            type: 'folder',
            name: '状态码测试',
            expanded: false,
            items: [
              {
                id: genId(),
                type: 'request',
                name: '200 成功',
                request: { method: 'GET', url: '{{baseUrl}}/status/200', params: [], headers: [], body: { type: 'none', raw: '', form: [] }, auth: { type: 'none' } }
              },
              {
                id: genId(),
                type: 'request',
                name: '404 未找到',
                request: { method: 'GET', url: '{{baseUrl}}/status/404', params: [], headers: [], body: { type: 'none', raw: '', form: [] }, auth: { type: 'none' } }
              },
              {
                id: genId(),
                type: 'request',
                name: '500 服务器错误',
                request: { method: 'GET', url: '{{baseUrl}}/status/500', params: [], headers: [], body: { type: 'none', raw: '', form: [] }, auth: { type: 'none' } }
              }
            ]
          }
        ]
      },
      {
        id: genId(),
        name: '我的接口',
        expanded: false,
        items: [
          {
            id: genId(),
            type: 'request',
            name: '用户登录',
            request: {
              method: 'POST',
              url: '{{baseUrl}}/login',
              params: [],
              headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
              body: { type: 'json', raw: '{\n  "username": "admin",\n  "password": "123456"\n}', form: [] },
              auth: { type: 'none' }
            }
          },
          {
            id: genId(),
            type: 'request',
            name: '获取用户列表',
            request: {
              method: 'GET',
              url: '{{baseUrl}}/users',
              params: [{ key: 'page', value: '1', enabled: true }, { key: 'size', value: '20', enabled: true }],
              headers: [],
              body: { type: 'none', raw: '', form: [] },
              auth: { type: 'bearer', token: '{{token}}' }
            }
          }
        ]
      }
    ],
    history: [],
    env: DEFAULT_ENV
  };
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

class Store {
  constructor(dirPath) {
    this.dir = dirPath;
    this.file = path.join(dirPath, 'api-manager-data.json');
    this.data = null;
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = mergeDefaults(parsed);
      } else {
        this.data = defaultData();
        this.save();
      }
    } catch (e) {
      this.data = defaultData();
    }
    return this.data;
  }

  save() {
    try {
      if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8');
      return true;
    } catch (e) {
      return false;
    }
  }

  getAll() {
    return this.data;
  }

  // ---------- 集合 ----------

  getCollections() {
    return this.data.collections;
  }

  addCollection(name) {
    const col = { id: genId(), name: name || '新集合', expanded: true, items: [] };
    this.data.collections.push(col);
    this.save();
    return col;
  }

  renameCollection(id, name) {
    const col = this.data.collections.find((c) => c.id === id);
    if (col) {
      col.name = name;
      this.save();
      return true;
    }
    return false;
  }

  deleteCollection(id) {
    const idx = this.data.collections.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.data.collections.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  addFolder(collectionId, name) {
    const col = this.data.collections.find((c) => c.id === collectionId);
    if (!col) return null;
    const folder = { id: genId(), type: 'folder', name: name || '新文件夹', expanded: true, items: [] };
    col.items.push(folder);
    this.save();
    return folder;
  }

  addItem(collectionId, parentId, item) {
    const col = this.data.collections.find((c) => c.id === collectionId);
    if (!col) return null;
    const newItem = {
      id: genId(),
      type: 'request',
      name: item.name || '新请求',
      request: item.request || blankRequest()
    };
    if (parentId) {
      const parent = findItemDeep(col.items, parentId);
      if (parent && parent.type === 'folder') {
        parent.items = parent.items || [];
        parent.items.push(newItem);
      } else {
        col.items.push(newItem);
      }
    } else {
      col.items.push(newItem);
    }
    this.save();
    return newItem;
  }

  updateItem(collectionId, itemId, patch) {
    const col = this.data.collections.find((c) => c.id === collectionId);
    if (!col) return false;
    const item = findItemDeep(col.items, itemId);
    if (!item) return false;
    if (patch.name != null) item.name = patch.name;
    if (patch.request != null) item.request = patch.request;
    if (patch.expanded != null) item.expanded = patch.expanded;
    this.save();
    return true;
  }

  deleteItem(collectionId, itemId) {
    const col = this.data.collections.find((c) => c.id === collectionId);
    if (!col) return false;
    return deleteItemDeep(col.items, itemId) && (this.save(), true);
  }

  // ---------- 历史 ----------

  addHistory(entry) {
    this.data.history.unshift({
      id: genId(),
      time: Date.now(),
      method: entry.method,
      url: entry.url,
      status: entry.status,
      time_ms: entry.time_ms
    });
    if (this.data.history.length > 100) this.data.history.length = 100;
    this.save();
    return true;
  }

  clearHistory() {
    this.data.history = [];
    this.save();
    return true;
  }

  getHistory() {
    return this.data.history;
  }

  // ---------- 环境变量 ----------

  getEnvConfig() {
    return this.data.env;
  }

  setActiveEnv(envId) {
    this.data.env.active = envId;
    this.save();
    return true;
  }

  saveEnvironment(env) {
    const idx = this.data.env.environments.findIndex((e) => e.id === env.id);
    if (idx >= 0) {
      this.data.env.environments[idx] = env;
    } else {
      this.data.env.environments.push(env);
    }
    this.save();
    return env;
  }

  deleteEnvironment(envId) {
    if (this.data.env.environments.length <= 1) return false;
    const idx = this.data.env.environments.findIndex((e) => e.id === envId);
    if (idx >= 0) {
      this.data.env.environments.splice(idx, 1);
      if (this.data.env.active === envId) {
        this.data.env.active = this.data.env.environments[0].id;
      }
      this.save();
      return true;
    }
    return false;
  }

  getActiveVariables() {
    const env = this.data.env.environments.find((e) => e.id === this.data.env.active);
    if (!env) return {};
    const out = {};
    for (const v of env.variables) {
      if (v.enabled !== false) out[v.key] = v.value;
    }
    return out;
  }
}

function blankRequest() {
  return {
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { type: 'none', raw: '', form: [] },
    auth: { type: 'none' }
  };
}

function findItemDeep(items, id) {
  if (!items) return null;
  for (const it of items) {
    if (it.id === id) return it;
    if (it.type === 'folder' && it.items) {
      const found = findItemDeep(it.items, id);
      if (found) return found;
    }
  }
  return null;
}

function deleteItemDeep(items, id) {
  if (!items) return false;
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) {
      items.splice(i, 1);
      return true;
    }
    if (items[i].type === 'folder' && items[i].items) {
      if (deleteItemDeep(items[i].items, id)) return true;
    }
  }
  return false;
}

function mergeDefaults(parsed) {
  const d = defaultData();
  if (!parsed) return d;
  return {
    collections: Array.isArray(parsed.collections) ? parsed.collections : d.collections,
    history: Array.isArray(parsed.history) ? parsed.history : d.history,
    env: parsed.env && typeof parsed.env === 'object' ? parsed.env : d.env
  };
}

module.exports = { Store, genId, blankRequest, defaultData };
