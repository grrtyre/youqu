# 💽 磁盘管家

> 苹果白风格磁盘空间可视化分析器 · 本地优先 · 隐私安全

一眼看清磁盘空间被什么占用。Squarified Treemap 可视化 + 大文件排行 + 类型分布统计，纯本地扫描，不上传任何数据。

## ✨ 功能

- **Treemap 可视化** —— Squarified 算法把目录大小映射为矩形面积，一目了然谁占空间
- **分层钻取** —— 点击目录块进入下一层，面包屑导航随时返回
- **大文件排行** —— Top 大文件列表，一键定位到资源管理器，支持移到回收站
- **类型分布** —— 按视频/音频/图片/文档/压缩包/代码/程序/数据库分类统计
- **扩展名排行** —— 哪些扩展名最占空间
- **扫描概览** —— 总占用、文件数、文件夹数、扫描用时
- **深度可调** —— Treemap 渲染深度 1/2/3 层可选
- **纯本地隐私** —— 数据完全在本地处理，不联网、不上传

## 🎨 设计

- 苹果白高端风格：浅灰背景、白色卡片、细腻阴影
- 系统字体（-apple-system, PingFang SC）
- 蓝色强调（#007aff），参考 macOS/iOS 原生设计
- 文件按类型柔和配色，目录用中性灰渐变区分层级

## 🚀 使用

### 直接下载
见下方「⬇️ 直接下载」章节，下载 exe 双击运行。

### 从源码运行
```bash
cd disk-manager
npm install
npm start
```

### 测试
```bash
npm test
```

## 🛠 技术栈

- Electron 28 + 原生 JavaScript
- Canvas 绘制 Squarified Treemap
- Node.js fs 异步递归扫描
- contextIsolation + preload 安全桥接

## 📐 核心算法

- **扫描器**（`src/core/scanner.js`）：异步递归遍历，自动跳过 `$RECYCLE.BIN` 等系统目录，支持进度回调与取消，聚合大小至上层节点
- **Treemap**（`src/core/treemap.js`）：Bruls/Huijsmans/van Wijk 2000 的 Squarified Treemap 算法，优化长宽比让矩形更易读
- **统计**：按扩展名/大类聚合，Top N 大文件收集

## ⬇️ 直接下载

| 平台 | 下载 |
|---|---|
| Windows x64 安装包 | [磁盘管家 Setup 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/disk-manager-v1.0.0/disk-manager-setup-1.0.0.exe) |
| Windows x64 便携版 | [磁盘管家 Portable 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/disk-manager-v1.0.0/disk-manager-portable-1.0.0.exe) |

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT](./LICENSE)
