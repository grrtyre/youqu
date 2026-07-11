## ⬇️ 直接下载

| 版本 | 平台 | 下载链接 |
|------|------|----------|
| v1.0.0 安装版 | Windows x64 | [API管家 Setup 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/api-manager-v1.0.0/api-manager-setup-1.0.0.exe) |
| v1.0.0 便携版 | Windows x64 | [API管家 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/api-manager-v1.0.0/api-manager-1.0.0.exe) |

---

# 🔌 API管家

> 本地优先的 HTTP API 测试工具——集合管理、历史记录、环境变量、JSON 语法高亮，苹果白高端风格。

## ✨ 功能特性

- **集合管理** — 树形组织请求集合，支持文件夹分组，一键新建/编辑/删除
- **请求构建** — 支持 GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS 七种方法，参数/请求头/请求体（JSON/表单/文本）/认证（Basic/Bearer）完整配置
- **环境变量** — `{{变量名}}` 语法在 URL/请求头/请求体中引用，多环境切换，变量管理
- **响应格式化** — JSON 自动格式化 + 语法高亮（key/string/number/boolean/null 分色），响应头表格展示，状态码/耗时/大小一目了然
- **历史记录** — 自动记录每次请求，支持从历史快速重发
- **本地优先** — 所有数据存储在本地 userData 目录，零云端依赖，隐私安全
- **苹果白风格** — 参考 macOS/iOS 原生设计，白色/浅灰背景、细腻阴影、系统字体、蓝色强调

## 📸 截图

![API管家](build/icon-source.png)

## 🚀 使用方式

### 方式一：下载安装包（推荐）

1. 前往 [Releases](../../releases) 下载 `API管家 Setup 1.0.0.exe`
2. 双击安装，按提示完成
3. 从开始菜单或桌面快捷方式启动

### 方式二：便携版

1. 下载 `API管家 1.0.0.exe`
2. 双击即可运行，无需安装

### 方式三：源码运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 打包
npm run dist
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl` + `Enter` | 发送请求 |

## 🛠 技术栈

- **Electron 28** — 跨平台桌面框架
- **原生 Node.js** — HTTP 客户端使用内置 http/https 模块，零第三方依赖
- **原生 JavaScript** — 渲染进程无框架，纯 DOM 操作
- **electron-builder** — 打包为 Windows NSIS 安装包 + 便携版

## 📁 项目结构

```
api-manager/
├── src/
│   ├── main.js              # Electron 主进程
│   ├── preload.js           # 安全桥接
│   ├── core/
│   │   ├── http-client.js   # HTTP 客户端（原生 http/https）
│   │   └── store.js         # 本地存储层（集合/历史/环境变量）
│   └── renderer/
│       ├── index.html       # 页面结构
│       ├── renderer.js      # 渲染逻辑
│       └── styles.css       # 苹果白风格样式
├── build/
│   ├── icon.ico             # 应用图标
│   └── make_icon.py         # 图标生成脚本
├── test/
│   └── test.js              # 单元测试（47 项）
└── package.json
```

## 🧪 测试

```bash
npm test
```

覆盖环境变量替换、请求构建、body 格式化、Store 持久化、真实 HTTP 服务器等 47 项测试。

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT](./LICENSE)
