## ⬇️ 直接下载

| 平台 | 下载链接 |
|---|---|
| Windows 便携版 | [JSON管家 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/json-manager-v1.0.0/JSON.1.0.0.exe) |
| Windows 安装版 | [JSON管家 Setup 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/json-manager-v1.0.0/JSON.Setup.1.0.0.exe) |

# 🧩 JSON管家 · json-manager

> 苹果白高端风格的 JSON 深度处理桌面工具：格式化、树形浏览、jq 过滤、JSON 对比、格式转换、Schema 校验，6 合 1 一站搞定。

基于 Electron 构建的本地桌面应用，所有计算在本地完成，不联网、不上传、不登录。专为中文开发者打造——双击即用，毫秒级响应。

## ✨ 功能特性

集成 6 个 JSON 深度处理工具：

- **📝 格式化** —— 美化（2/4 空格缩进）或压缩为一行，自动校验错误并定位，输入区实时语法高亮
- **🌲 树形浏览** —— 可折叠展开的树形视图，点击任意节点查看路径与值类型，支持全部展开/折叠
- **🔍 jq 过滤** —— 简化版 jq 语法：`.foo` 取字段、`.[]` 遍历数组、`|` 管道、`length`/`keys`/`values`/`map`/`select` 等内置函数，附常用表达式模板
- **⚖️ JSON 对比** —— 逐字段对比两个 JSON 的差异：新增、删除、修改，标注完整路径与类型标签
- **🔄 格式转换** —— 将 JSON 转换为 CSV / YAML / XML / Properties 格式，便于在其他场景使用
- **🛡️ Schema 校验** —— 用 JSON Schema 校验数据：支持 `type` / `required` / `properties` / `items` / `enum` / `minimum` / `maximum` / `pattern` / `minLength` / `maxLength` 等关键字子集

### 其他能力

- **文件读写** —— 打开 `.json` 文件、保存输出到文件
- **历史记录** —— 自动保存最近处理的 JSON 文本（最多 20 条），一键恢复
- **语法高亮** —— 输入区与输出区均有 JSON 语法高亮（键名蓝色、字符串绿色、数字橙色、布尔紫色）
- **实时统计** —— 状态栏显示字符数、键数、深度等元信息

## 🚀 使用

### 直接运行

```bash
# 安装依赖
npm install

# 启动应用
npm start
```

### 打包

```bash
npm run build
```

打包产物在 `dist/` 目录下，包含 NSIS 安装包和便携版 exe。

## 📁 项目结构

```
json-manager/
├── src/
│   ├── main.js              # Electron 主进程（窗口、文件 IPC、历史记录）
│   ├── preload.js           # 进程间通信桥接
│   ├── core/
│   │   ├── json-ops.js      # JSON 解析/美化/压缩/统计/类型判定
│   │   ├── jq-lite.js       # 简化版 jq 语法实现
│   │   └── converters.js    # CSV/YAML/XML/Properties 转换 + diff + Schema 校验
│   └── renderer/
│       ├── index.html       # 页面结构
│       ├── styles.css       # 苹果白高端风格样式
│       └── renderer.js      # 交互逻辑（工具切换、实时处理、语法高亮）
├── build/
│   ├── icon.ico             # 应用图标
│   ├── icon-source.png      # 图标源文件
│   └── make_icon.py         # 图标生成脚本
├── test/
│   └── test.js              # 核心逻辑测试（54 个用例）
├── .gitignore
├── LICENSE
└── README.md
```

## 🛠 技术栈

- Electron 28（桌面应用框架）
- 纯 JavaScript（零运行时依赖，核心算法全部手写）
- 苹果白高端风格（参考 macOS / iOS 原生设计）
- contextBridge 进程间通信（安全隔离）

## 🧪 测试

```bash
npm test
```

54 个用例覆盖：json-ops（解析/美化/压缩/统计/类型/路径）、jq-lite（根查询/字段/索引/切片/遍历/函数/管道/逗号）、converters（CSV/YAML/XML/Properties 转换 + diff 对比 + Schema 校验）。

## 🎨 设计理念

- **苹果白风格** —— 白色/浅灰背景、细腻多层阴影、系统字体、蓝色 `#007aff` 强调
- **隐私第一** —— 所有计算本地完成，绝不联网上传
- **深度处理** —— 不只是格式化，而是 6 大工具一站式 JSON 深度处理
- **实时反馈** —— 输入即处理，语法高亮即时同步

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

MIT
