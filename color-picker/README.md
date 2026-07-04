# 🎨 拾色管家

> 苹果白高端风格的 Windows 屏幕取色器与调色板管理工具。系统托盘常驻，全局快捷键唤起，放大镜精准取色，多格式一键复制，调色板本地管理。

## ✨ 功能特性

- **🖱 全局快捷键取色** —— `Ctrl+Shift+C` 随时唤起，无需切窗口
- **🔍 放大镜精准对焦** —— 13× 像素级放大，中心十字定位，所见即所得
- **📋 多格式一键复制** —— HEX / RGB / HSL 三种格式，点击即复制
- **🕐 历史拾取记录** —— 自动去重，最新置顶，最多保留 50 条
- **🎨 多调色板管理** —— 新建/重命名/删除调色板，颜色一键加入/移除
- **☕ 托盘常驻** —— 关闭窗口不退出，后台待命，点击托盘快速唤起
- **🔒 纯本地隐私** —— 所有数据存本地，无网络、无上传、无追踪
- **⌨️ 键盘友好** —— `Esc` 取消、点击确认、右键也可取消

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | [ColorPicker-Setup-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/color-picker-v1.0.0/ColorPicker-Setup-1.0.0.exe) | 安装版，含开始菜单快捷方式 |
| Windows x64 | [ColorPicker-Portable-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/color-picker-v1.0.0/ColorPicker-Portable-1.0.0.exe) | 便携版，解压即用 |

> 前往 [Releases 页面](../../releases) 查看所有版本。

## 🚀 使用方式

### 方式一：直接下载安装

1. 下载上方安装包或便携版
2. 安装/解压后运行「拾色管家」
3. 系统托盘出现蓝色吸管图标，应用已在后台运行
4. 任意时刻按 `Ctrl+Shift+C` 进入取色模式
5. 鼠标移动到目标位置，点击即取色；按 `Esc` 取消

### 方式二：源码运行

```bash
cd color-picker
npm install
npm start              # 启动应用
npm test               # 运行核心逻辑测试
npm run build          # 打包 Windows exe（需 electron-builder）
```

## 🎯 使用场景

- **设计师取色** —— 从任意网页、图片、软件界面拾取颜色，建立自己的色卡
- **前端开发** —— 还原设计稿配色，复制 HEX 直接用
- **PPT/文档配色** —— 抓取品牌色，保持视觉一致
- **配色灵感收集** —— 看到好看的配色随手保存到调色板

## 🛠 技术栈

- **Electron 28** —— 跨平台桌面应用框架
- **原生 JavaScript** —— 无框架依赖，纯净轻量
- **desktopCapturer** —— 屏幕截图与像素采样
- **Canvas 2D** —— 放大镜实时渲染
- **IPC + contextBridge** —— 主进程/渲染进程安全通信
- **苹果白设计系统** —— 浅色背景、细腻阴影、系统字体、#007AFF 强调色

## 📁 项目结构

```
color-picker/
├── src/
│   ├── main.js              # 主进程：窗口、托盘、全局快捷键、取色流程
│   ├── preload.js           # 预加载：contextBridge 安全 API
│   ├── core/
│   │   ├── color-utils.js   # 颜色转换（HEX/RGB/HSL）+ 像素采样
│   │   └── storage.js       # 调色板与历史的本地持久化
│   └── renderer/
│       ├── index.html       # 主界面
│       ├── styles.css       # 苹果白风格样式
│       ├── renderer.js      # 主界面逻辑
│       ├── picker.html      # 取色覆盖层
│       ├── picker.css       # 放大镜样式
│       └── picker.js        # 取色逻辑
├── test/
│   └── test.js              # 32 个单元测试（颜色转换 + 存储）
├── build/
│   ├── icon.ico             # 应用图标（多尺寸）
│   └── make_icon.py         # 图标生成脚本
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## 🧪 测试

```bash
npm test
```

覆盖 32 项测试：颜色转换互逆性、边界值、非法输入、像素采样、存储往返、调色板增删改。

## 🎨 设计哲学

- **苹果白高端风格** —— 参考 macOS / iOS 原生设计
- **#007AFF 系统蓝** —— 唯一强调色，贯穿按钮/链接/选中态
- **细腻阴影分层** —— 卡片轻浮于背景，色块轻浮于卡片
- **pill 描边按钮** —— 次要操作统一 pill 描边样式
- **零干扰** —— 无原生菜单栏，沉浸式工作

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](./LICENSE) —— 可自由使用、修改、分发。
