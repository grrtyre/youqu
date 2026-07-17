<div align="center">

# 🖼️ 图片压缩器

**苹果白风格的高效图片批量压缩工具**

支持 JPG · PNG · WebP · BMP · TIFF，拖拽即用，本地处理，隐私安全。

![platform](https://img.shields.io/badge/platform-Windows-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![version](https://img.shields.io/badge/version-1.0.0-007aff)

</div>

---

## ✨ 功能特性

- **批量压缩** —— 拖拽导入多张图片，一键批量压缩，效率倍增
- **质量可调** —— 滑块调节压缩质量（1-100），支持「极致 / 均衡 / 高清」预设
- **多格式支持** —— JPG、PNG、WebP 互转，保留原格式或指定输出
- **实时预览** —— 文件列表展示原始大小、压缩后大小、节省比例
- **本地处理** —— 图片不上传云端，隐私安全有保障
- **苹果白风格** —— 极简白底、细腻阴影、系统字体、蓝色强调，视觉舒适

## 📦 下载安装

| 平台 | 版本 | 下载 |
|------|------|------|
| Windows | v1.0.0 | [图片压缩器-1.0.0-portable.exe](#) |

> 便携版单文件，无需安装，双击即用。

## 🚀 快速开始

1. 下载便携版 EXE
2. 双击启动
3. 拖拽图片到拖拽区，或点击「选择图片」
4. 调整压缩质量（推荐 75 均衡）
5. 点击「开始压缩」，文件保存至原图目录

## ⌨️ 快捷操作

| 操作 | 说明 |
|------|------|
| 拖拽图片 | 直接拖入主窗口即可添加 |
| 质量滑块 | 拖动调节压缩程度 |
| 格式按钮 | 切换输出格式 |
| 目录选择 | 自定义输出位置 |

## 📂 项目结构

```
image-compressor/
├── src/
│   ├── main.js              # Electron 主进程 + sharp 压缩核心
│   ├── preload.js           # 预加载桥接
│   └── renderer/
│       ├── index.html       # 主界面
│       ├── renderer.js      # 渲染层逻辑
│       └── styles.css       # 苹果白样式
├── test/
│   └── test.js              # 核心逻辑测试
├── build/
│   └── icon-source.png      # 应用图标
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## 🛠️ 技术栈

- **Electron** —— 跨平台桌面应用框架
- **Sharp** —— 高性能原生图片处理库（基于 libvips）
- **原生 CSS** —— 苹果白设计系统，无 UI 框架依赖

## 🎨 设计规范

| 元素 | 数值 |
|------|------|
| 主色 | #007aff |
| 背景 | #f5f5f7 / #ffffff |
| 圆角 | 8 / 12 / 16 px |
| 字体 | -apple-system, "PingFang SC", "Microsoft YaHei" |
| 阴影 | 0 4px 12px rgba(0,0,0,0.04) |

## 📝 更新日志

### v1.0.0 (2026-07-17)

- 首次发布
- 支持批量图片压缩
- 支持 JPG / PNG / WebP 格式互转
- 质量滑块 + 三档预设
- 苹果白高端风格界面

## ☕ 支持我们

如果这个工具帮到了你，欢迎支持我们持续开发：

[爱发电 · 支持创作者](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

---

<div align="center">

Made with care · 苹果白设计系统

</div>
