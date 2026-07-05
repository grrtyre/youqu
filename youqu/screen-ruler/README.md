# 📏 屏幕标尺管家

> 一站式屏幕测量工具 · 标尺 / 框选 / 距离 / 量角器 / 放大镜 / 自由标注

屏幕标尺管家是一款专为设计师、前端开发者和产品经理打造的桌面屏幕测量工具，集成标尺、框选测距、两点连线、三点量角、像素放大镜和自由标注于一体，覆盖日常 UI 测量的所有场景。采用苹果白高端风格设计，轻量、无广告、开箱即用。

## ✨ 功能特性

- 📏 **标尺模式** — 顶部/左侧像素刻度，实时显示鼠标坐标与十字辅助线
- ▭ **框选测量** — 拖拽框选任意区域，实时显示宽 × 高（px 与物理 mm 估算）
- ↔ **距离测量** — 两点连线，显示像素距离与相对 X 轴的角度
- ∠ **量角器** — 三点定角，量取任意夹角（0~360°），自动绘制扇形角度区域
- 🔍 **放大镜** — 跟随鼠标的圆形放大镜，6 倍像素级放大，适合精确定位
- ✏️ **自由标注** — 在屏幕上自由涂画，标记重点区域
- 💾 **一键保存** — 将当前测量画面保存为 PNG 图片，方便分享
- ⌨️ **全局快捷键** — `Ctrl+Shift+R` 随时唤起/隐藏测量覆盖层

## 📸 截图

![主窗口](./build/icon-source.png)

## ⬇️ 直接下载

| 平台 | 下载链接 | 说明 |
| --- | --- | --- |
| Windows x64 | [屏幕标尺管家 Setup 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/screen-ruler-v1.0.0/屏幕标尺管家.Setup.1.0.0.exe) | 安装版，支持自定义安装路径 |
| Windows x64 | [屏幕标尺管家 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/screen-ruler-v1.0.0/屏幕标尺管家.1.0.0.exe) | 便携版，双击即用 |

> 若 GitHub Release 中文文件名被转为英文，请以 [Releases 页面](https://github.com/grrtyre/youqu/releases/tag/screen-ruler-v1.0.0) 实际下载链接为准。

## 🚀 使用方式

### 方式一：直接下载安装
1. 从上方下载链接获取安装包或便携版
2. 安装版双击运行安装；便携版直接双击运行
3. 启动后点击"开始测量"按钮，或按 `Ctrl+Shift+R` 唤起测量覆盖层

### 方式二：从源码运行
```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/screen-ruler
npm install
npm start
```

### 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl`+`Shift`+`R` | 显示 / 隐藏 测量覆盖层 |
| `1` ~ `6` | 在覆盖层中快速切换工具（标尺/框选/距离/量角器/放大镜/标注） |
| `Esc` | 隐藏覆盖层 |
| `C` | 清空当前测量 |
| `S` | 保存当前画面为图片 |

## 🛠 技术栈

- **Electron 28** — 跨平台桌面应用框架
- **原生 Canvas API** — 高性能测量绘制
- **desktopCapturer** — 屏幕截图捕获
- **纯 JavaScript** — 无前端框架依赖，轻量高效
- **苹果白高端风格** — 参考 macOS/iOS 原生设计

## 🎯 目标用户

- UI/UX 设计师 — 测量产稿尺寸、间距、对齐
- 前端开发者 — 还原设计稿，核对像素级实现
- 产品经理 — 标注竞品截图，沟通需求
- PPT 制作者 — 精确对齐元素位置

## 📦 项目结构

```
screen-ruler/
├── src/
│   ├── core/measure.js        # 测量核心纯函数（距离/角度/标尺/换算）
│   ├── renderer/
│   │   ├── index.html         # 主窗口
│   │   ├── overlay.html       # 测量覆盖层
│   │   ├── styles.css         # 主窗口样式
│   │   ├── overlay.css        # 覆盖层样式
│   │   ├── renderer.js        # 主窗口逻辑
│   │   └── overlay.js         # 覆盖层测量逻辑
│   ├── main.js                # Electron 主进程
│   └── preload.js             # 预加载脚本
├── test/test.js               # 单元测试（29 项）
├── build/                     # 图标资源
├── package.json
└── LICENSE
```

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡 ☕

👉 [爱发电 · 支持屏幕标尺管家](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：
<!-- 鸣谢名单占位 -->
_暂无，期待第一个支持者的出现。_

## 📄 License

MIT License © 2026 youqu
