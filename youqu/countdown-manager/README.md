# 倒计时管家

> 一个优雅的桌面事件倒数日工具，记录你每一个重要的日子。

![平台](https://img.shields.io/badge/平台-Windows-blue)
![技术](https://img.shields.io/badge/技术栈-Electron-9feaf9)
![许可](https://img.shields.io/badge/license-MIT-green)

## ⬇️ 直接下载

| 版本 | 平台 | 下载 |
|------|------|------|
| v1.0.0 | Windows x64 | 见下方 Release 资产 |

## ✨ 功能特性

- **事件倒数** —— 记录任意事件，自动计算还有多少天 / 已过多少天
- **公历 + 农历** —— 支持农历日期（春节、中秋等传统节日不再错过），自动显示干支年与生肖
- **年度重复** —— 生日、纪念日每年自动循环，无需重新录入
- **分类管理** —— 生活 / 工作 / 学习 / 纪念日 / 节日 / 其他，颜色标签一目了然
- **置顶 & 筛选** —— 重要事件置顶，按状态（即将到来 / 已过去）和分类快速筛选
- **本地存储** —— 所有数据保存在本地，不会离开你的电脑
- **导入导出** —— JSON 格式备份与迁移
- **系统托盘** —— 关闭窗口后驻留托盘，随叫随到
- **苹果白设计** —— 参考 macOS / iOS 原生设计，细腻阴影、系统字体、蓝色强调

## 🎯 解决什么痛点

手机上的「倒数日」类 App 火爆多年，但 Windows 桌面长期缺少一个**美观、免费、本地存储**的同类工具。倒计时管家把这些重要日子搬上桌面，让你每次打开电脑都能一眼看到下一个值得期待的日子——考试、生日、纪念日、假期、项目截止日。

## 📦 使用方式

### 直接下载
1. 在 [Releases](../../releases) 页面下载 `倒计时管家 Setup 1.0.0.exe`（安装版）或 `倒计时管家 1.0.0.exe`（便携版）
2. 安装版双击安装；便携版双击直接运行

### 从源码运行
```bash
cd countdown-manager
npm install
npm start          # 启动应用
npm test           # 运行核心逻辑测试
npm run dist       # 打包为 exe
```

## 🖥️ 截图

启动后首屏：

- 顶部 Hero 卡片展示最近一个事件的大号倒计时
- 卡片网格列出全部事件，左侧色条区分分类
- 顶栏支持搜索、分类筛选、新建；底栏支持导入导出

## 🛠️ 技术栈

- **Electron 28** —— 跨平台桌面应用框架
- **原生 JavaScript** —— 无前端框架依赖，轻量
- **农历算法** —— 内置 1900-2099 农历查表转换
- **electron-builder** —— 打包为 Windows 安装包 / 便携版

## 📁 项目结构

```
countdown-manager/
├── src/
│   ├── core/
│   │   ├── date-utils.js     # 日期计算 + 农历转换
│   │   ├── event-store.js    # 事件 CRUD + 持久化
│   │   └── recurrence.js     # 重复规则
│   ├── renderer/
│   │   ├── index.html
│   │   ├── renderer.js
│   │   └── styles.css
│   ├── main.js               # Electron 主进程
│   └── preload.js
├── test/test.js              # 34 项核心逻辑测试
├── build/                    # 图标资源
└── package.json
```

## ☕ 支持我们

倒计时管家完全免费开源。如果它帮到了你，欢迎请我们喝杯咖啡：

👉 [爱发电 · giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 许可证

MIT License © 2026 grrtyre
