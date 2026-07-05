# 重命名管家

> Windows 上最美、最实用的批量重命名工具——苹果白高端风格

拖入文件，添加规则，实时预览，一键重命名。支持文本替换、正则表达式、序号命名、日期命名（含 EXIF 拍摄日期）、大小写转换等 7 种规则，可组合使用、可撤销、可保存预设。

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|------|------|------|
| Windows x64 | [重命名管家 Setup 1.0.0](https://github.com/grrtyre/youqu/releases/download/file-rename-manager-v1.0.0/rename-manager-setup-1.0.0.exe) | 安装版，支持自定义安装路径 |
| Windows x64 | [重命名管家 Portable 1.0.0](https://github.com/grrtyre/youqu/releases/download/file-rename-manager-v1.0.0/rename-manager-portable-1.0.0.exe) | 便携版，解压即用 |

## ✨ 功能特性

- **拖拽添加** — 拖入文件或文件夹，自动递归扫描子目录
- **实时预览** — 修改规则时即时显示「旧名 → 新名」，高亮差异部分
- **文本替换** — 查找替换，支持区分大小写、全词匹配（文件名友好的词边界）
- **正则替换** — 支持捕获组重排，如 `(\\d{4})-(\\d{2})` → `$1$2`
- **序号命名** — 自定义前缀、起始号、步长、补零位数（如 `img_001`、`img_004`）
- **日期命名** — 基于修改时间/创建时间/出生时间/EXIF 拍摄日期，自定义格式
- **大小写转换** — 大写、小写、标题、驼峰、蛇形 5 种模式
- **插入/删除** — 在指定位置插入文本，或删除指定字符集
- **组合规则** — 多条规则按顺序应用，灵活组合
- **冲突检测** — 自动检测重名冲突，高亮提示
- **交换安全** — 智能处理 A↔B 交换式重命名（两阶段重命名）
- **一键撤销** — 操作历史可回退，文件名变更前自动备份映射
- **预设管理** — 常用规则组合可保存/加载，下次直接复用
- **EXIF 读取** — 内置极简 JPEG EXIF 解析器，无第三方依赖，按相机本地时间解析

## 🎨 设计风格

采用苹果白高端风格，参考 macOS 原生设计：
- 白色/浅灰背景、细腻阴影、系统字体
- 蓝色强调（#007aff）、绿色状态标签
- 禁止赛博朋克霓虹、深色毛玻璃

## 📸 截图

![重命名管家](./build/icon-source.png)

## 🚀 使用方式

### 方式一：直接下载（推荐）

从上方「直接下载」表格下载安装版或便携版，双击运行即可。

### 方式二：源码运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 运行测试
npm test

# 打包
npm run dist
```

## 🛠️ 技术栈

- **Electron 28** — 跨平台桌面框架
- **纯 JavaScript** — 无前端框架依赖，轻量高效
- **自定义 EXIF 解析器** — 极简 JPEG EXIF 日期读取，零依赖
- **electron-builder** — 打包为 Windows NSIS 安装版 + 便携版

## 📁 项目结构

```
file-rename-manager/
├── src/
│   ├── core/
│   │   ├── rename-engine.js   # 核心重命名引擎（纯逻辑，可独立测试）
│   │   ├── exif-reader.js     # 极简 JPEG EXIF 日期读取
│   │   └── preset-store.js    # 预设存储管理
│   ├── renderer/
│   │   ├── index.html         # UI 结构
│   │   ├── styles.css         # 苹果白高端风格样式
│   │   └── renderer.js        # 渲染层逻辑
│   ├── main.js                # Electron 主进程
│   └── preload.js             # 安全 IPC 桥
├── test/
│   └── test.js                # 37 项单元测试
├── build/
│   ├── icon.ico               # 应用图标
│   ├── icon-source.png        # 图标源文件
│   └── make_icon.py           # 图标生成脚本
└── package.json
```

## 🧪 测试

核心引擎包含 37 项单元测试，覆盖：
- 文本替换（基本/全词/大小写）
- 正则替换（捕获组/无效正则）
- 序号命名（替换/前缀/步长）
- 日期命名（mtime/birthtime/EXIF）
- 大小写转换（5 种模式）
- 插入/删除
- 组合规则
- 预览生成与冲突检测
- 实际文件重命名与撤销
- 交换冲突自动处理
- 文件名合法性校验
- 预设存储增删查

```bash
npm test
```

## ☕ 支持我们

如果这个工具对你有帮助，欢迎支持我们持续开发：

[![爱发电](https://img.shields.io/badge/爱发电-支持我们-ff69b4)](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：
<!-- 鸣谢名单占位 -->
_暂无，期待第一个支持者的出现。_

## 📄 License

MIT License — 自由使用、修改、分发。
