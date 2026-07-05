# 屏幕尺管家 📐

> 看一眼就知道多大 — 屏幕测量与标注工具，Windows 桌面原生体验。

屏幕尺管家是一款轻量级屏幕测量工具，鼠标移动实时显示像素坐标与颜色值，拖拽即可测量矩形宽高、直线距离与角度，自带像素放大镜精确取色。Windows 没有内置屏幕尺，市面工具要么是浏览器插件（无法测量桌面），要么是老旧 WinForms 程序 — 屏幕尺管家专做"看一眼就知道多大"这件事。

## ✨ 核心功能

- **实时坐标与颜色** — 鼠标移动时顶部工具栏实时显示 x/y 坐标和当前像素 HEX 色值
- **矩形测量** — 拖拽出矩形，显示宽 × 高、面积，自带 10px/100px 标尺刻度
- **直线测量** — 拖拽出直线，显示距离和角度（0° 正东，顺时针）
- **像素取色** — 取色模式下显示 9×9 像素放大镜，单击复制 HEX
- **历史记录** — 自动保存最近 50 条测量结果，一键复制
- **全局热键** — `Ctrl+Shift+R` 随时唤起测量，`Ctrl+Shift+P` 显示/隐藏面板
- **HiDPI 适配** — 截图按显示器 scaleFactor 换算物理像素，150%/200% 缩放屏不模糊
- **多屏严格匹配** — 按 display.id 精确匹配桌面源，不再"取第一个源"兜底，避免多屏环境拿错屏
- **苹果白设计** — macOS 原生毛玻璃工具栏、系统字体、#007aff 蓝色强调

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | [屏幕尺管家 Setup 1.1.1.exe](https://github.com/grrtyre/youqu/releases/download/screen-ruler-v1.1.1/Setup.1.1.1.exe) | v1.1.1 安装版 |
| Windows x64 | [屏幕尺管家 Portable 1.1.1.exe](https://github.com/grrtyre/youqu/releases/download/screen-ruler-v1.1.1/1.1.1.exe) | v1.1.1 免安装便携版 |

> 若上方链接失效，请到 [Releases 页面](https://github.com/grrtyre/youqu/releases) 手动下载最新版。

## 🚀 使用方式

### 方式一：直接下载安装包
前往 [Releases 页面](https://github.com/grrtyre/youqu/releases) 下载最新版 `屏幕尺管家 Setup x.x.x.exe`（推荐）或 `屏幕尺管家 Portable x.x.x.exe`（免安装）。

### 方式二：从源码运行
```bash
# 安装依赖
npm install

# 启动应用
npm start

# 跑测试
npm test

# 打包
npm run dist
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Shift + R` | 唤起测量覆盖层 |
| `Ctrl + Shift + P` | 显示 / 隐藏主控面板 |
| `R` / `L` / `P` | 矩形 / 直线 / 取色 模式切换 |
| `C` | 复制当前测量结果 |
| `S` | 保存当前测量到历史 |
| `ESC` | 退出测量覆盖层 |

## 🛠 技术栈

- **Electron 28** — 跨平台桌面框架
- **原生 Canvas** — 测量绘制与像素采样，无第三方绘图依赖
- **desktopCapturer** — 桌面冻结截图作为取色底图
- **electron-store** — 测量历史持久化
- **electron-builder** — NSIS 安装包 + 绿色版打包
- 设计风格：苹果白高端风格（参考 macOS / iOS HIG）

## 📁 项目结构

```
screen-ruler/
├── src/
│   ├── main.js              # 主进程：窗口、热键、桌面截图（HiDPI + 多屏严格匹配）
│   ├── preload.js           # 上下文隔离桥接
│   ├── core/
│   │   └── ruler-core.js    # 几何/颜色/格式化 + HiDPI/多屏辅助（UMD，纯函数，可测试）
│   └── renderer/
│       ├── overlay.html/css/js  # 测量覆盖层（全屏透明 Canvas）
│       ├── panel.html/css/js     # 主控面板（小窗，常驻）
├── test/test.js             # 核心逻辑测试（37 用例：几何/颜色/HiDPI/多屏/UMD）
├── build/                   # 图标资源
└── package.json
```

## 🎨 设计理念

苹果白高端风格 — 白色/浅灰背景、细腻阴影、系统字体、#007aff 蓝色强调。工具栏采用 macOS 原生毛玻璃质感（`backdrop-filter: blur(20px)`），所有交互元素遵循 Apple Human Interface Guidelines 的圆角与间距规范。

## 🧪 测试

```bash
npm test
```

**37 个用例**覆盖：距离/角度/矩形几何、RGB↔HEX↔HSL 转换、像素采样与边界、测量结果格式化、HiDPI 物理像素换算（1.0/1.5/2.0/0/缺省）、多屏源严格匹配、UMD 加载兼容性（浏览器侧挂 `window.RulerCore`）。

## 📜 更新日志

### v1.1.1（2026-07-05）

**Bug 修复**
- 🐛 **HiDPI 模糊**：`captureDisplay` 用 `display.scaleFactor` 把逻辑像素换算成物理像素，150%/200% 缩放屏截图不再模糊
- 🐛 **多屏拿错屏**：从"取 `sources[0]` 兜底"改为严格按 `display.id` 匹配桌面源，找不到直接报错，避免多屏环境抓到错的屏幕
- 🐛 **截图失败容错**：`enterOverlay` 包了 try/catch，截图失败时仍打开覆盖层（坐标/十字线可用，仅取色和量距不可用）

**代码质量**
- 🧹 **删除死代码**：移除从未被 import 的 `src/core/measure.js`，以及从未被加载的 `src/renderer/index.html` / `renderer.js` / `styles.css`
- ♻️ **运行时与测试同源**：`ruler-core.js` 改造为 UMD，`overlay.js` 通过 `<script>` 引入并复用 `distance`/`angle`/`rgbToHex`/`rgbToHsl`/`pixelAt`/`formatMeasure`，消除了之前 overlay.js 里重新定义一份的重复代码
- 🔧 **版本统一**：package.json 从 v1.0.0 升到 v1.1.1，统一 productName 为"屏幕尺管家"（与 panel.html / 主仓库 README 一致；之前 dist-v1.1 误用"屏幕标尺管家"已清理）

**UI**
- 🎨 **overlay 标题统一**：从"屏幕尺"改为"屏幕尺管家 · 测量"
- 🔒 **CSP 收紧**：overlay.html 加 `script-src 'self'` 防止内联脚本

**文档**
- 📝 README 项目结构同步删除/重命名后的文件，新增下载链接表，新增更新日志章节

**测试**
- 🧪 单元测试从 22 项扩展到 37 项，新增覆盖 HiDPI 物理像素换算（6 项）、多屏源匹配（6 项）、UMD 浏览器侧加载（2 项）、未知 mode 边界（1 项）

### v1.0.0（初始版本）
- 实时坐标与颜色、矩形测量、直线测量、像素取色、历史记录、全局热键、苹果白设计

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡 ☕

[![爱发电](https://img.shields.io/badge/爱发电-支持我们-ff5f57)](https://www.ifdian.net/a/giquwei)

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

MIT © 2026 youqu
