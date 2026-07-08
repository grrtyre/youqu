# 📋 代码片段管家

> 本地优先的代码片段管理桌面应用：语法高亮、全文搜索、标签分类、收藏置顶、导入导出，苹果白高端风格。

## ✨ 功能特性

- **语法高亮** —— 自研轻量高亮引擎，支持 20+ 语言（JavaScript/TypeScript/Python/Java/C/Go/Rust/PHP/Ruby/Swift/Kotlin/SQL/Bash/JSON/YAML/CSS/HTML/XML/Markdown），零依赖，脱网可用
- **全文搜索** —— 多词 AND 逻辑，覆盖标题、内容、描述、标签、语言
- **分类导航** —— 按语言、按标签快速筛选，收藏与置顶独立分组
- **收藏置顶** —— 重要片段置顶显示，收藏快速访问
- **导入导出** —— JSON 格式，支持合并（按标题+语言去重）与替换两种模式
- **全局快捷键** —— `Ctrl+Shift+S` 唤起，`Ctrl+N` 新建，`Ctrl+F` 搜索
- **系统托盘** —— 关闭窗口不退出，托盘常驻随时唤起
- **纯本地存储** —— 数据存在 userData 目录，隐私优先，完全离线

## 🎨 设计风格

苹果白高端风格：白色/浅灰背景、细腻阴影、系统字体（-apple-system, PingFang SC）、蓝色强调（#007aff），参考 macOS/iOS 原生设计。

## 📦 下载安装

| 版本 | 说明 | 下载 |
|---|---|---|
| Windows 安装版 | 双击安装，自动创建快捷方式 | [snippet-manager-1.1.0-setup.exe](https://github.com/grrtyre/youqu/releases/download/snippet-manager-v1.1.0/snippet-manager-1.1.0-setup.exe) |
| Windows 便携版 | 免安装，双击即用 | [snippet-manager-1.1.0-portable.exe](https://github.com/grrtyre/youqu/releases/download/snippet-manager-v1.1.0/snippet-manager-1.1.0-portable.exe) |

> 下载链接以 GitHub Release 实际上传返回的地址为准。

## 🚀 使用方式

### 直接下载
下载上方 exe，双击运行即可。

### 从源码运行
```bash
cd snippet-manager
npm install
npm start
```

## 🛠 技术栈

- **Electron 31** —— 跨平台桌面框架
- **原生 JS** —— 零前端框架依赖
- **自研语法高亮引擎** —— 单次交替正则匹配，正确处理 token 优先级
- **本地 JSON 文件存储** —— 原子写入（tmp + renameSync），损坏自动备份

## 📁 项目结构

```
snippet-manager/
├── src/
│   ├── core/
│   │   ├── snippet-store.js   # 数据存储引擎（CRUD/搜索/导入导出）
│   │   └── highlight.js       # 语法高亮引擎
│   ├── renderer/
│   │   ├── index.html         # 三栏布局
│   │   ├── styles.css         # 苹果白风格样式
│   │   └── renderer.js        # 渲染层逻辑
│   ├── main.js                # Electron 主进程
│   └── preload.js             # 安全 IPC 桥
├── test/test.js               # 33 项自动化测试
├── build/icon.ico             # 应用图标
└── package.json
```

## ✅ 测试

```bash
node test/test.js
```

覆盖 33 项测试：数据 CRUD、搜索逻辑、导入导出、数据损坏恢复、语法高亮（HTML 转义/关键字/字符串/注释/数字/函数名/多语言/边界情况）。

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT](../LICENSE)
