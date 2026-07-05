# 🔤 字体管家

> 一个苹果白高端风格的本地字体浏览、对比与特性标签管理工具。让中文字体也能被优雅地管理。

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows 安装版 | [FontManager-Setup-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/font-manager-v1.0.0/FontManager-Setup-1.0.0.exe) | 约 73MB，安装到本机，自动创建快捷方式 |
| Windows 便携版 | [FontManager-Portable-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/font-manager-v1.0.0/FontManager-Portable-1.0.0.exe) | 约 73MB，免安装，双击即用 |

## ✨ 功能特性

- **极速字体枚举** —— 一键扫描系统已安装的全部字体（含中英文字体）
- **智能分类** —— 自动识别等宽 / 衬线 / 无衬线 / 手写 / 装饰 / 其他六大类
- **中文字体优先** —— 列表自动把中文字体排在前面，告别中英文混杂难找
- **自定义标签** —— 给字体打上任意标签（如「海报」「正文」「标题」），支持多标签筛选
- **收藏夹** —— 把常用字体收藏起来，一键过滤查看
- **实时预览** —— 自定义预览文本与字号，所见即所得
- **多字体对比** —— 抽屉式对比模式，同一文本多字体并排展示
- **复制 CSS** —— 一键复制 `font-family` CSS 片段（含正确转义）
- **纯本地隐私** —— 字体数据完全存储在本地，不联网、不上传

## 📸 截图

![字体管家](./build/icon-source.png)

## 🚀 使用方式

### 方式一：直接下载（推荐）

| 平台 | 下载 | 大小 |
|---|---|---|
| Windows 安装版 | 待上传 | - |
| Windows 便携版 | 待上传 | - |

### 方式二：从源码运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm start

# 运行测试
npm test

# 打包
npm run dist
```

## 🎨 设计风格

采用 **苹果白高端风格**：

- 纯白 / 浅灰背景，细腻多层阴影
- 系统字体（-apple-system, "PingFang SC", "Microsoft YaHei"）
- 蓝色强调色（#007aff）
- 圆角卡片、毛玻璃标题栏
- 参考 macOS / iOS 原生设计

## 🛠 技术栈

- **Electron 28** —— 跨平台桌面应用框架
- **原生 JavaScript** —— 不依赖任何前端框架
- **electron-store** —— 本地配置持久化
- **font-list** —— 跨平台字体枚举
- **opentype.js** —— 字体文件解析（用于精确检测中文字体）
- **Python PIL** —— 应用图标生成

## 📁 项目结构

```
font-manager/
├── src/
│   ├── main.js              # 主进程：窗口、IPC、字体枚举
│   ├── preload.js           # 预加载脚本（contextBridge）
│   ├── core/
│   │   └── font-utils.js    # 纯函数核心：分类、过滤、排序
│   └── renderer/
│       ├── index.html       # 渲染层 UI
│       ├── styles.css       # 苹果白样式
│       └── renderer.js      # 渲染层逻辑
├── test/
│   └── test.js              # 28 项核心逻辑测试
├── build/
│   ├── make_icon.py         # 图标生成脚本
│   ├── icon.ico             # 应用图标
│   └── icon-source.png      # 图标源文件
├── package.json
├── LICENSE
└── README.md
```

## ✅ 测试

核心逻辑（CJK 检测、分类推断、字体过滤、排序、CSS 转义）有 28 项自动化测试覆盖：

```bash
npm test
```

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](./LICENSE)
